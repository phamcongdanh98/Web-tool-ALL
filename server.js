import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import multer from 'multer'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { ZipArchive } = require('archiver')

dotenv.config()
const app = express()
app.use(cors())
app.use(express.json())
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } })

const safeName = (name, extension) => `${name.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9-_]/gi, '-') || 'toolhub-file'}${extension}`
const download = (res, buffer, filename, type) => {
  res.set({ 'Content-Type': type, 'Content-Disposition': `attachment; filename="${filename}"`, 'Content-Length': buffer.length })
  res.send(buffer)
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: Boolean(process.env.MONGODB_URI) }))
app.post('/api/newsletter', (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ message: 'Vui lòng nhập email.' })
  // Ready to persist to MongoDB once MONGODB_URI is configured.
  res.status(201).json({ message: 'Đăng ký nhận tin thành công!' })
})

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
    if (!req.files?.length || req.files.length < 2) return res.status(400).json({ message: 'Hãy chọn ít nhất 2 tệp PDF để ghép.' })
    const output = await PDFDocument.create()
    for (const file of req.files) {
      const pdf = await PDFDocument.load(file.buffer, { ignoreEncryption: true })
      const pages = await output.copyPages(pdf, pdf.getPageIndices())
      pages.forEach((page) => output.addPage(page))
    }
    download(res, Buffer.from(await output.save({ useObjectStreams: true })), 'toolhub-merged.pdf', 'application/pdf')
  } catch (error) { next(error) }
})

app.post('/api/tools/pdf/compress', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Vui lòng chọn một tệp PDF.' })
    const pdf = await PDFDocument.load(req.file.buffer, { ignoreEncryption: true, updateMetadata: false })
    download(res, Buffer.from(await pdf.save({ useObjectStreams: true, addDefaultPage: false })), safeName(req.file.originalname, '-optimized.pdf'), 'application/pdf')
  } catch (error) { next(error) }
})

app.post('/api/tools/pdf/split', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Vui lòng chọn một tệp PDF.' })
    const source = await PDFDocument.load(req.file.buffer, { ignoreEncryption: true })
    const pages = source.getPageIndices()
    res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="toolhub-split-pages.zip"' })
    const zip = new ZipArchive({ zlib: { level: 9 } })
    zip.on('error', next)
    zip.pipe(res)
    for (const pageIndex of pages) {
      const pagePdf = await PDFDocument.create()
      const [page] = await pagePdf.copyPages(source, [pageIndex])
      pagePdf.addPage(page)
      zip.append(Buffer.from(await pagePdf.save()), { name: `page-${pageIndex + 1}.pdf` })
    }
    await zip.finalize()
  } catch (error) { next(error) }
})

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ message: 'Không thể xử lý tệp này. Hãy kiểm tra lại định dạng hoặc thử tệp nhỏ hơn.' })
})

const port = process.env.PORT || 3001
app.listen(port, () => console.log(`ToolHub API listening on ${port}`))
