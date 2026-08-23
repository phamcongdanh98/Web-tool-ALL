import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import multer from 'multer'
import sharp from 'sharp'
import { degrees, PDFDocument } from 'pdf-lib'
import { createRequire } from 'module'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { convertPdfText } from './lib/pdf-office.js'

const require = createRequire(import.meta.url)
const { ZipArchive } = require('archiver')
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()
const app = express()
app.disable('x-powered-by')
app.use(cors())
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } })

const safeName = (name, extension) => `${name.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9-_]/gi, '-') || 'toolhub-file'}${extension}`
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))
const numberOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback
const escapeXml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
const download = (res, buffer, filename, type) => {
  res.set({ 'Content-Type': type, 'Content-Disposition': `attachment; filename="${filename}"`, 'Content-Length': buffer.length })
  res.send(buffer)
}

const parsePageSelection = (selection, pageCount) => {
  if (!selection?.trim()) return Array.from({ length: pageCount }, (_, index) => index)
  const selected = new Set()
  for (const token of selection.split(',').map(value => value.trim()).filter(Boolean)) {
    if (/^\d+$/.test(token)) {
      const page = Number(token)
      if (page < 1 || page > pageCount) throw new Error(`Trang ${page} không tồn tại. PDF này có ${pageCount} trang.`)
      selected.add(page - 1)
      continue
    }
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(token)
    if (!range) throw new Error(`Khoảng trang “${token}” không hợp lệ. Ví dụ đúng: 1-3, 5, 8-10.`)
    const start = Number(range[1]), end = Number(range[2])
    if (start < 1 || end > pageCount || start > end) throw new Error(`Khoảng trang “${token}” vượt quá PDF ${pageCount} trang.`)
    for (let page = start; page <= end; page++) selected.add(page - 1)
  }
  if (!selected.size) throw new Error('Hãy chọn ít nhất một trang để tách.')
  return [...selected].sort((a, b) => a - b)
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: Boolean(process.env.MONGODB_URI) }))

app.post('/api/tools/image/:action', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Vui lòng chọn một tệp ảnh.' })
    const { action } = req.params
    const { format = 'jpeg', quality = '82', width, height, left, top, cropWidth, cropHeight } = req.body
    let image = sharp(req.file.buffer, { animated: false }).rotate()
    const imageFormat = format === 'jpg' ? 'jpeg' : format
    if (!['jpeg', 'png', 'webp', 'avif'].includes(imageFormat)) return res.status(400).json({ message: 'Định dạng ảnh không được hỗ trợ.' })

    if (action === 'resize') {
      image = image.resize({ width: Number(width) || null, height: Number(height) || null, fit: 'inside', withoutEnlargement: true })
    } else if (action === 'crop') {
      const meta = await image.metadata()
      const w = Math.min(Number(cropWidth) || meta.width, meta.width)
      const h = Math.min(Number(cropHeight) || meta.height, meta.height)
      image = image.extract({ left: Math.max(0, Math.min(Number(left) || 0, meta.width - w)), top: Math.max(0, Math.min(Number(top) || 0, meta.height - h)), width: w, height: h })
    } else if (action === 'edit') {
      const brightness = clamp(numberOr(req.body.brightness, 100), 20, 200) / 100
      const saturation = clamp(numberOr(req.body.saturation, 100), 0, 200) / 100
      const hue = clamp(numberOr(req.body.hue, 0), -180, 180)
      const contrast = clamp(numberOr(req.body.contrast, 100), 20, 200) / 100
      const blur = clamp(numberOr(req.body.blur, 0), 0, 20)
      const rotation = [0, 90, 180, 270].includes(Number(req.body.rotation)) ? Number(req.body.rotation) : 0
      image = image.modulate({ brightness, saturation, hue })
      if (req.body.grayscale === 'true') image = image.grayscale()
      if (contrast !== 1) image = image.linear(contrast, 128 * (1 - contrast))
      if (blur >= 0.3) image = image.blur(blur)
      if (rotation) image = image.rotate(rotation)
      if (req.body.flip === 'true') image = image.flip()
      if (req.body.flop === 'true') image = image.flop()
    } else if (action === 'remove-background') {
      const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      const { width, height, channels } = info
      const sample = (x, y) => {
        const index = (y * width + x) * channels
        return [data[index], data[index + 1], data[index + 2]]
      }
      const edgeColors = [sample(0, 0), sample(width - 1, 0), sample(0, height - 1), sample(width - 1, height - 1)]
      const isBackgroundColor = (x, y) => {
        const [r, g, b] = sample(x, y)
        return edgeColors.some(([er, eg, eb]) => Math.abs(r - er) + Math.abs(g - eg) + Math.abs(b - eb) < 105)
      }
      // Flood-fill only from the image border so a similarly colored area inside the subject remains intact.
      const visited = new Uint8Array(width * height)
      const queue = []
      const enqueue = (x, y) => { const point = y * width + x; if (!visited[point] && isBackgroundColor(x, y)) { visited[point] = 1; queue.push([x, y]) } }
      for (let x = 0; x < width; x++) { enqueue(x, 0); enqueue(x, height - 1) }
      for (let y = 1; y < height - 1; y++) { enqueue(0, y); enqueue(width - 1, y) }
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const [x, y] = queue[cursor]
        data[(y * width + x) * channels + 3] = 0
        if (x > 0) enqueue(x - 1, y)
        if (x + 1 < width) enqueue(x + 1, y)
        if (y > 0) enqueue(x, y - 1)
        if (y + 1 < height) enqueue(x, y + 1)
      }
      return download(res, await sharp(data, { raw: info }).png().toBuffer(), safeName(req.file.originalname, '-no-background.png'), 'image/png')
    } else if (!['compress', 'convert'].includes(action)) return res.status(404).json({ message: 'Công cụ ảnh không tồn tại.' })

    const options = { quality: Math.max(10, Math.min(100, Number(quality) || 82)) }
    const buffer = await image.toFormat(imageFormat, options).toBuffer()
    download(res, buffer, safeName(req.file.originalname, `.${imageFormat === 'jpeg' ? 'jpg' : imageFormat}`), `image/${imageFormat}`)
  } catch (error) { next(error) }
})

app.post('/api/tools/pdf/merge', upload.array('files', 20), async (req, res, next) => {
  try {
    if (!req.files?.length) return res.status(400).json({ message: 'Hãy chọn ít nhất một tệp PDF.' })
    const sources = await Promise.all(req.files.map(file => PDFDocument.load(file.buffer, { ignoreEncryption: true })))
    const output = await PDFDocument.create()
    let pagePlan
    try { pagePlan = req.body.pagePlan ? JSON.parse(req.body.pagePlan) : null }
    catch { return res.status(400).json({ message: 'Thứ tự trang không hợp lệ.' }) }
    if (!Array.isArray(pagePlan)) pagePlan = sources.flatMap((pdf, fileIndex) => pdf.getPageIndices().map(pageIndex => ({ fileIndex, pageIndex, rotation: 0 })))
    if (!pagePlan.length) return res.status(400).json({ message: 'Tài liệu phải có ít nhất một trang.' })
    for (const item of pagePlan) {
      const source = sources[Number(item.fileIndex)]
      const pageIndex = Number(item.pageIndex)
      if (!source || !Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= source.getPageCount()) return res.status(400).json({ message: 'Thứ tự trang chứa dữ liệu không hợp lệ.' })
      const [page] = await output.copyPages(source, [pageIndex])
      const rotation = Number(item.rotation) || 0
      if (rotation) page.setRotation(degrees((page.getRotation().angle + rotation + 360) % 360))
      output.addPage(page)
    }
    download(res, Buffer.from(await output.save({ useObjectStreams: true })), 'toolhub-merged.pdf', 'application/pdf')
  } catch (error) { next(error) }
})

app.post('/api/tools/pdf/compress', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Vui lòng chọn một tệp PDF.' })
    const source = await PDFDocument.load(req.file.buffer, { ignoreEncryption: true, updateMetadata: false })
    const optimized = Buffer.from(await source.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 50 }))
    const buffer = optimized.length < req.file.buffer.length ? optimized : req.file.buffer
    res.set({
      'X-Compression-Mode': 'lossless',
      'X-Compression-Saved-Bytes': String(req.file.buffer.length - buffer.length),
    })
    download(res, buffer, safeName(req.file.originalname, '-lossless.pdf'), 'application/pdf')
  } catch (error) { next(error) }
})

app.post('/api/tools/pdf/edit', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Vui lòng chọn một tệp PDF.' })
    const source = await PDFDocument.load(req.file.buffer, { ignoreEncryption: true, updateMetadata: false })
    const pageCount = source.getPageCount()
    const editType = req.body.editType === 'page-numbers' ? 'page-numbers' : 'text'
    const text = String(req.body.text || '').trim().slice(0, 120)
    if (editType === 'text' && !text) return res.status(400).json({ message: 'Hãy nhập nội dung cần thêm vào PDF.' })
    let pageIndexes
    try { pageIndexes = req.body.pages?.trim() ? parsePageSelection(req.body.pages, pageCount) : source.getPageIndices() }
    catch (error) { return res.status(400).json({ message: error.message }) }

    const fontSize = clamp(Number(req.body.fontSize) || 16, 8, 72)
    const opacity = clamp(Number(req.body.opacity) || 0.75, 0.1, 1)
    const color = /^#[0-9a-f]{6}$/i.test(req.body.color || '') ? req.body.color : '#4f46e5'
    const position = ['top-left', 'top-center', 'top-right', 'center', 'bottom-left', 'bottom-center', 'bottom-right'].includes(req.body.position) ? req.body.position : 'bottom-center'
    const horizontal = position.endsWith('left') ? 'left' : position.endsWith('right') ? 'right' : 'center'
    const vertical = position.startsWith('top') ? 'top' : position.startsWith('bottom') ? 'bottom' : 'center'

    for (const pageIndex of pageIndexes) {
      const page = source.getPage(pageIndex)
      const label = editType === 'page-numbers'
        ? `Trang ${pageIndex + 1} / ${pageCount}`
        : text.replaceAll('{page}', String(pageIndex + 1)).replaceAll('{pages}', String(pageCount))
      const scale = 3
      const estimatedWidth = label.length * fontSize * 0.68
      const fittedFontSize = Math.max(6, fontSize * Math.min(1, (page.getWidth() - 48) / Math.max(estimatedWidth, 1)))
      const padding = fittedFontSize * 0.7
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil((label.length * fittedFontSize * 0.68 + padding * 2) * scale)}" height="${Math.ceil((fittedFontSize * 1.55 + padding) * scale)}"><text x="${padding * scale}" y="${(fittedFontSize * 1.18 + padding / 2) * scale}" font-family="Arial,DejaVu Sans,sans-serif" font-size="${fittedFontSize * scale}" fill="${escapeXml(color)}">${escapeXml(label)}</text></svg>`
      const overlayBuffer = await sharp(Buffer.from(svg)).png().toBuffer()
      const overlay = await source.embedPng(overlayBuffer)
      const overlayWidth = overlay.width / scale
      const overlayHeight = overlay.height / scale
      const margin = 24
      const x = horizontal === 'left' ? margin : horizontal === 'right' ? page.getWidth() - overlayWidth - margin : (page.getWidth() - overlayWidth) / 2
      const y = vertical === 'top' ? page.getHeight() - overlayHeight - margin : vertical === 'bottom' ? margin : (page.getHeight() - overlayHeight) / 2
      page.drawImage(overlay, { x: Math.max(0, x), y: Math.max(0, y), width: overlayWidth, height: overlayHeight, opacity })
    }

    const buffer = Buffer.from(await source.save({ useObjectStreams: true, addDefaultPage: false }))
    download(res, buffer, safeName(req.file.originalname, editType === 'page-numbers' ? '-numbered.pdf' : '-edited.pdf'), 'application/pdf')
  } catch (error) { next(error) }
})

app.post('/api/tools/pdf/to-:format', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Vui lòng chọn một tệp PDF.' })
    const result = await convertPdfText(req.file.buffer, req.params.format)
    res.set({
      'X-Extracted-Pages': String(result.pages),
      'X-Extracted-Characters': String(result.characterCount),
    })
    download(res, result.buffer, safeName(req.file.originalname, `.${result.extension}`), result.type)
  } catch (error) { next(error) }
})

app.post('/api/tools/pdf/split', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Vui lòng chọn một tệp PDF.' })
    const source = await PDFDocument.load(req.file.buffer, { ignoreEncryption: true })
    let pages
    let pagePlan
    try {
      pagePlan = req.body.pagePlan ? JSON.parse(req.body.pagePlan) : null
      pages = Array.isArray(pagePlan) ? pagePlan.map(item => Number(item.pageIndex)) : parsePageSelection(req.body.pages, source.getPageCount())
      if (!pages.length || pages.some(page => !Number.isInteger(page) || page < 0 || page >= source.getPageCount())) throw new Error('Danh sách trang cần tách không hợp lệ.')
    }
    catch (error) { return res.status(400).json({ message: error.message }) }
    res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="toolhub-split-pages.zip"' })
    const zip = new ZipArchive({ zlib: { level: 9 } })
    zip.on('error', next)
    zip.pipe(res)
    for (let outputIndex = 0; outputIndex < pages.length; outputIndex++) {
      const pageIndex = pages[outputIndex]
      const pagePdf = await PDFDocument.create()
      const [page] = await pagePdf.copyPages(source, [pageIndex])
      const rotation = Number(pagePlan?.[outputIndex]?.rotation) || 0
      if (rotation) page.setRotation(degrees((page.getRotation().angle + rotation + 360) % 360))
      pagePdf.addPage(page)
      zip.append(Buffer.from(await pagePdf.save()), { name: `page-${pageIndex + 1}.pdf` })
    }
    await zip.finalize()
  } catch (error) { next(error) }
})

if (process.env.NODE_ENV === 'production') {
  const staticDirectory = path.resolve(process.env.STATIC_DIR || path.join(__dirname, 'dist'))
  const assetsDirectory = path.join(staticDirectory, 'assets')
  const indexFile = path.join(staticDirectory, 'index.html')

  if (!existsSync(indexFile)) {
    throw new Error(`Không tìm thấy bản build production tại ${indexFile}. Hãy chạy npm run build trước.`)
  }

  const assetContentTypes = new Map([
    ['.css', 'text/css; charset=UTF-8'],
    ['.js', 'text/javascript; charset=UTF-8'],
    ['.json', 'application/json; charset=UTF-8'],
    ['.mjs', 'text/javascript; charset=UTF-8'],
    ['.svg', 'image/svg+xml'],
    ['.wasm', 'application/wasm'],
  ])

  app.get('/assets/*', (req, res, next) => {
    const relativePath = req.path.slice('/assets/'.length)
    const originalPath = path.resolve(assetsDirectory, relativePath)
    if (!originalPath.startsWith(`${assetsDirectory}${path.sep}`)) return next()

    const acceptedEncoding = req.get('Accept-Encoding') || ''
    const suffix = acceptedEncoding.includes('br') && existsSync(`${originalPath}.br`)
      ? '.br'
      : acceptedEncoding.includes('gzip') && existsSync(`${originalPath}.gz`) ? '.gz' : ''
    if (!suffix) return next()

    res.set({
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Encoding': suffix === '.br' ? 'br' : 'gzip',
      'Content-Type': assetContentTypes.get(path.extname(originalPath)) || 'application/octet-stream',
      Vary: 'Accept-Encoding',
    })
    res.sendFile(`${originalPath}${suffix}`, error => error ? next(error) : undefined)
  })

  app.use(express.static(staticDirectory, {
    etag: true,
    setHeaders: (res, filePath) => {
      const isVersionedAsset = filePath.includes(`${path.sep}assets${path.sep}`)
      res.setHeader('Cache-Control', isVersionedAsset
        ? 'public, max-age=31536000, immutable'
        : 'no-cache')
    },
  }))

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(indexFile, error => error ? next(error) : undefined)
  })
}

app.use((error, _req, res, _next) => {
  console.error(error)
  if (error?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'Tệp vượt quá giới hạn 25 MB.' })
  const status = Number(error?.statusCode)
  res.status(status >= 400 && status < 500 ? status : 500).json({
    message: status >= 400 && status < 500 ? error.message : 'Không thể xử lý tệp này. Hãy kiểm tra lại định dạng hoặc thử tệp nhỏ hơn.',
  })
})

const port = process.env.PORT || 3001
const host = process.env.HOST || '127.0.0.1'
const server = app.listen(port, host, () => console.log(`ToolHub listening on http://${host}:${port}`))

const shutdown = signal => {
  console.log(`${signal} received, closing ToolHub gracefully.`)
  server.close(error => process.exit(error ? 1 : 0))
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
