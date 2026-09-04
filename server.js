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
import { redactionToPixels } from './lib/browser-utility.js'
import { analytics, getClientIp } from './lib/analytics.js'
import { telegramBot } from './lib/telegram.js'

const require = createRequire(import.meta.url)
const { ZipArchive } = require('archiver')
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()
const app = express()
app.disable('x-powered-by')
app.use(cors())
const escapeXml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')

const renderBlockedIpPage = (ip, reason = 'Vi phạm chính sách sử dụng') => `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>403 - Quyền truy cập bị từ chối | PDFTools</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card: #151d30;
      --line: #263352;
      --text: #f3f4f6;
      --muted: #94a3b8;
      --danger: #ef4444;
      --primary: #6366f1;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      line-height: 1.6;
    }
    .blocked-card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 20px;
      max-width: 520px;
      width: 100%;
      padding: 40px 32px;
      text-align: center;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(239, 68, 68, 0.15);
      animation: appear 0.3s ease-out;
    }
    @keyframes appear {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    .icon-wrap {
      width: 72px;
      height: 72px;
      margin: 0 auto 20px;
      border-radius: 50%;
      background: rgba(239, 68, 68, 0.15);
      border: 2px solid rgba(239, 68, 68, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
    }
    .badge {
      display: inline-block;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: var(--danger);
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.25);
      padding: 4px 12px;
      border-radius: 999px;
      margin-bottom: 14px;
    }
    h1 {
      font-size: 24px;
      font-weight: 800;
      margin-bottom: 12px;
      color: #fff;
    }
    p {
      color: var(--muted);
      font-size: 14px;
      margin-bottom: 24px;
    }
    .ip-box {
      background: rgba(11, 15, 25, 0.7);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 24px;
      text-align: left;
      font-size: 13px;
    }
    .ip-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .ip-row:last-child { margin-bottom: 0; }
    .ip-label { color: var(--muted); }
    .ip-val {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-weight: 600;
      color: var(--text);
    }
    .ip-val.danger { color: var(--danger); }
    .footer-text {
      font-size: 12px;
      color: var(--muted);
      border-top: 1px solid var(--line);
      padding-top: 18px;
      margin-top: 6px;
    }
  </style>
</head>
<body>
  <div class="blocked-card">
    <div class="icon-wrap">🚫</div>
    <div class="badge">HTTP 403 FORBIDDEN</div>
    <h1>Quyền truy cập bị từ chối</h1>
    <p>Địa chỉ IP của bạn đã bị từ chối truy cập vào trang web này do vi phạm chính sách sử dụng hoặc có hành vi bất thường.</p>
    
    <div class="ip-box">
      <div class="ip-row">
        <span class="ip-label">Địa chỉ IP:</span>
        <span class="ip-val">${escapeXml(ip)}</span>
      </div>
      <div class="ip-row">
        <span class="ip-label">Lý do từ chối:</span>
        <span class="ip-val danger">${escapeXml(reason)}</span>
      </div>
      <div class="ip-row">
        <span class="ip-label">Trạng thái:</span>
        <span class="ip-val danger">Bị chặn toàn bộ</span>
      </div>
    </div>

    <div class="footer-text">
      Nếu bạn cho rằng đây là một sự nhầm lẫn, vui lòng liên hệ Quản trị viên để được hỗ trợ kiểm tra và gỡ bỏ.
    </div>
  </div>
</body>
</html>`

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  })

  const ip = getClientIp(req)

  // Chặn IP thuộc danh sách đen đối với TOÀN BỘ trang web và API
  if (analytics.isIpBlocked(ip)) {
    const isAdminApi = req.path.startsWith('/api/admin/') || req.path.startsWith('/api/stats')
    const adminPassword = process.env.ADMIN_STATS_PASSWORD?.trim() || 'danhadmin2026'
    const provided = req.headers['x-admin-key'] || req.query?.key || req.body?.key
    const isAdminAuthorized = isAdminApi && provided === adminPassword

    if (!isAdminAuthorized) {
      const blockInfo = analytics.getBlockInfo(ip) || { reason: 'Vi phạm chính sách sử dụng' }

      // Trả về JSON nếu là API hoặc client yêu cầu JSON
      if (req.path.startsWith('/api/') || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({
          status: 'blocked',
          error: 'Forbidden',
          message: 'Địa chỉ IP của bạn đã bị từ chối truy cập toàn bộ hệ thống do vi phạm chính sách sử dụng.',
          ip,
          reason: blockInfo.reason,
        })
      }

      // Trả về trang HTML 403 chặn truy cập web
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      return res.status(403).send(renderBlockedIpPage(ip, blockInfo.reason))
    }
  }

  if (req.method === 'GET' && !req.path.startsWith('/api/') && !req.path.startsWith('/assets/') && !req.path.includes('.')) {
    analytics.recordVisit(ip, {
      path: req.path,
      userAgent: req.get('user-agent'),
      referer: req.get('referer'),
    }).catch(() => {})
  }
  next()
})
const megabyte = 1024 * 1024
const defaultMaximumFileMb = 25
const pdfCompressionMaximumFileMb = 50
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: defaultMaximumFileMb * megabyte } })
const pdfCompressionUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: pdfCompressionMaximumFileMb * megabyte } })

const safeName = (name, extension) => `${name.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9-_]/gi, '-') || 'toolhub-file'}${extension}`
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))
const numberOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback
const clientError = (statusCode, message) => Object.assign(new Error(message), { statusCode })
const maxUploadBytes = Math.round(clamp(numberOr(process.env.MAX_UPLOAD_TOTAL_MB, 50), 1, 200) * megabyte)
const maxUploadRequestBytes = maxUploadBytes + 64 * 1024
const maxConcurrentJobs = Math.trunc(clamp(numberOr(process.env.MAX_CONCURRENT_JOBS, 2), 1, 8))
const maximumImagePixels = 30_000_000
const maximumPdfPages = 500
let activeJobs = 0

const uploadedFiles = req => req.files || (req.file ? [req.file] : [])
const enforceUploadedBytes = (req, res, next) => {
  const total = uploadedFiles(req).reduce((sum, file) => sum + file.size, 0)
  if (total > maxUploadBytes) return res.status(413).json({ message: `Tổng dung lượng tải lên vượt giới hạn ${Math.round(maxUploadBytes / 1024 / 1024)} MB.` })
  next()
}
const assertPdfFile = file => {
  if (!file?.buffer?.subarray(0, 1024).includes(Buffer.from('%PDF-'))) {
    throw clientError(415, 'Tệp đã chọn không phải PDF hợp lệ.')
  }
}
const assertImageFile = async file => {
  try {
    const metadata = await sharp(file.buffer, { animated: false, limitInputPixels: maximumImagePixels }).metadata()
    if (!['jpeg', 'png', 'webp', 'avif'].includes(metadata.format)) throw new Error('unsupported image')
  } catch {
    throw clientError(415, 'Ảnh phải là JPG, PNG, WebP hoặc AVIF hợp lệ và không vượt 30 megapixel.')
  }
}
const download = (res, buffer, filename, type) => {
  res.set({ 'Content-Type': type, 'Content-Disposition': `attachment; filename="${filename}"`, 'Content-Length': buffer.length })
  res.send(buffer)
}

const inferToolName = reqPath => {
  if (reqPath.includes('/image/')) {
    const action = reqPath.split('/image/')[1]?.split('/')[0]
    if (action === 'redact') return 'image-redact'
    return action || 'image-tool'
  }
  if (reqPath.includes('/pdf/')) {
    const action = reqPath.split('/pdf/')[1]?.split('/')[0]
    if (action?.startsWith('to-')) return `pdf-${action}`
    return `pdf-${action}` || 'pdf-tool'
  }
  return reqPath.replace(/^\/api\/tools\/?/, '').replace(/\//g, '-') || 'tool'
}

app.use('/api/tools', (req, res, next) => {
  const startTime = Date.now()
  const clientIp = getClientIp(req)
  const contentLength = Number(req.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxUploadRequestBytes) {
    return res.status(413).json({ message: `Tổng request vượt giới hạn ${Math.round(maxUploadBytes / 1024 / 1024)} MB.` })
  }
  if (activeJobs >= maxConcurrentJobs) {
    res.setHeader('Retry-After', '5')
    return res.status(503).json({ message: 'Máy chủ đang xử lý nhiều tệp. Vui lòng đợi vài giây rồi thử lại.' })
  }

  activeJobs += 1
  let released = false
  const release = () => {
    if (released) return
    released = true
    activeJobs = Math.max(0, activeJobs - 1)

    const durationMs = Date.now() - startTime
    const isSuccess = res.statusCode >= 200 && res.statusCode < 400
    const toolName = inferToolName(req.path)
    const files = uploadedFiles(req)
    const totalBytes = files.reduce((sum, file) => sum + (file?.size || 0), 0)
    analytics.recordToolUsage(clientIp, toolName, {
      source: 'api',
      status: isSuccess ? 'success' : 'error',
      action: req.params?.action || req.path.split('/').filter(Boolean).pop() || '',
      fileSize: totalBytes,
      durationMs,
      userAgent: req.get('user-agent') || '',
      details: { statusCode: res.statusCode },
    }).catch(() => {})
  }
  res.once('finish', release)
  res.once('close', release)
  next()
})

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

app.get('/api/health', (_req, res) => res.json({
  status: 'ok',
  database: Boolean(process.env.MONGODB_URI),
  processing: { active: activeJobs, limit: maxConcurrentJobs },
}))

app.post('/api/analytics/track', express.json(), async (req, res) => {
  try {
    const ip = getClientIp(req)
    const { tool, action, status, fileSize, details } = req.body || {}
    if (!tool) return res.status(400).json({ message: 'Thiếu tên công cụ.' })
    const event = await analytics.recordToolUsage(ip, String(tool).slice(0, 50), {
      source: 'client',
      action: String(action || '').slice(0, 50),
      status: status === 'error' ? 'error' : 'success',
      fileSize: Number(fileSize) || 0,
      details,
    })
    res.json({ success: true, eventId: event?.id })
  } catch {
    res.status(500).json({ message: 'Lỗi ghi nhận thống kê.' })
  }
})

const verifyAdminPasscode = (req, res, next) => {
  const adminPassword = process.env.ADMIN_STATS_PASSWORD?.trim() || 'danhadmin2026'
  const provided = req.headers['x-admin-key'] || req.query.key || req.body?.key
  if (provided === adminPassword) {
    return next()
  }
  return res.status(401).json({
    status: 'unauthorized',
    message: 'Yêu cầu mật khẩu quản trị viên chính xác.',
  })
}

app.post('/api/stats/verify', express.json(), (req, res) => {
  const adminPassword = process.env.ADMIN_STATS_PASSWORD?.trim() || 'danhadmin2026'
  const provided = req.headers['x-admin-key'] || req.body?.key
  if (provided === adminPassword) {
    return res.json({ ok: true, message: 'Xác thực thành công.' })
  }
  return res.status(401).json({ ok: false, message: 'Mật khẩu quản trị không chính xác.' })
})

app.get('/api/stats', verifyAdminPasscode, (req, res) => {
  const stats = analytics.getStats(req.query)
  res.json(stats)
})

app.post('/api/admin/block-ip', express.json(), verifyAdminPasscode, async (req, res) => {
  const { ip, reason } = req.body || {}
  if (!ip) return res.status(400).json({ success: false, message: 'Vui lòng cung cấp địa chỉ IP cần chặn.' })
  try {
    const result = await analytics.blockIp(ip, reason)
    res.json({ success: true, message: `Đã chặn IP ${result.ip} thành công.`, item: result })
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || 'Không thể chặn địa chỉ IP này.' })
  }
})

app.post('/api/admin/unblock-ip', express.json(), verifyAdminPasscode, async (req, res) => {
  const { ip } = req.body || {}
  if (!ip) return res.status(400).json({ success: false, message: 'Vui lòng cung cấp địa chỉ IP cần gỡ chặn.' })
  try {
    const result = await analytics.unblockIp(ip)
    if (!result) {
      return res.status(404).json({ success: false, message: `Địa chỉ IP ${ip} không có trong danh sách chặn.` })
    }
    res.json({ success: true, message: `Đã gỡ chặn IP ${ip} thành công.`, unblocked: true })
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || 'Không thể gỡ chặn địa chỉ IP này.' })
  }
})

app.post('/api/tools/image/:action', upload.single('file'), enforceUploadedBytes, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Vui lòng chọn một tệp ảnh.' })
    await assertImageFile(req.file)
    const { action } = req.params
    const { format = 'jpeg', quality = '82', width, height, left, top, cropWidth, cropHeight } = req.body
    let image = sharp(req.file.buffer, { animated: false, limitInputPixels: maximumImagePixels }).rotate()
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
    } else if (action === 'redact') {
      let regions
      try { regions = JSON.parse(req.body.regions || '[]') }
      catch { return res.status(400).json({ message: 'Danh sách vùng che không hợp lệ.' }) }
      if (!Array.isArray(regions) || !regions.length) return res.status(400).json({ message: 'Hãy tạo ít nhất một vùng che.' })
      if (regions.length > 20) return res.status(400).json({ message: 'Mỗi ảnh chỉ được có tối đa 20 vùng che.' })
      const invalidRegion = regions.some(region => !['x', 'y', 'w', 'h'].every(key => Number.isFinite(Number(region?.[key]))) || Number(region.w) < 0.25 || Number(region.h) < 0.25)
      if (invalidRegion) return res.status(400).json({ message: 'Tọa độ vùng che không hợp lệ.' })
      const color = /^#[0-9a-f]{6}$/i.test(req.body.redactionColor || '') ? req.body.redactionColor : '#111827'
      const metadata = await sharp(req.file.buffer, { animated: false, limitInputPixels: maximumImagePixels }).metadata()
      const orientedWidth = metadata.autoOrient?.width || ([5, 6, 7, 8].includes(metadata.orientation) ? metadata.height : metadata.width)
      const orientedHeight = metadata.autoOrient?.height || ([5, 6, 7, 8].includes(metadata.orientation) ? metadata.width : metadata.height)
      const rectangles = regions.map(region => redactionToPixels(region, orientedWidth, orientedHeight))
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${orientedWidth}" height="${orientedHeight}" viewBox="0 0 ${orientedWidth} ${orientedHeight}">${rectangles.map(rectangle => `<rect x="${rectangle.left}" y="${rectangle.top}" width="${rectangle.width}" height="${rectangle.height}" fill="${color}" shape-rendering="crispEdges"/>`).join('')}</svg>`
      const buffer = await image.composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).png().toBuffer()
      res.set({ 'X-Redaction-Regions': String(rectangles.length), 'X-Metadata-Stripped': 'yes' })
      return download(res, buffer, safeName(req.file.originalname, '-redacted.png'), 'image/png')
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

app.post(['/api/tools/pdf/merge', '/api/tools/pdf/organize'], upload.array('files', 20), enforceUploadedBytes, async (req, res, next) => {
  try {
    if (!req.files?.length) return res.status(400).json({ message: 'Hãy chọn ít nhất một tệp PDF.' })
    req.files.forEach(assertPdfFile)
    const sources = await Promise.all(req.files.map(file => PDFDocument.load(file.buffer, { ignoreEncryption: true })))
    const output = await PDFDocument.create()
    let pagePlan
    try { pagePlan = req.body.pagePlan ? JSON.parse(req.body.pagePlan) : null }
    catch { return res.status(400).json({ message: 'Thứ tự trang không hợp lệ.' }) }
    if (!Array.isArray(pagePlan)) pagePlan = sources.flatMap((pdf, fileIndex) => pdf.getPageIndices().map(pageIndex => ({ fileIndex, pageIndex, rotation: 0 })))
    if (!pagePlan.length) return res.status(400).json({ message: 'Tài liệu phải có ít nhất một trang.' })
    if (pagePlan.length > maximumPdfPages) return res.status(413).json({ message: `Mỗi lượt chỉ xử lý tối đa ${maximumPdfPages} trang PDF.` })
    for (const item of pagePlan) {
      const source = sources[Number(item.fileIndex)]
      const pageIndex = Number(item.pageIndex)
      if (!source || !Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= source.getPageCount()) return res.status(400).json({ message: 'Thứ tự trang chứa dữ liệu không hợp lệ.' })
      const [page] = await output.copyPages(source, [pageIndex])
      const rotation = Number(item.rotation) || 0
      if (rotation) page.setRotation(degrees((page.getRotation().angle + rotation + 360) % 360))
      output.addPage(page)
    }
    const filename = req.path.endsWith('/organize') ? 'pdftools-organized.pdf' : 'pdftools-merged.pdf'
    download(res, Buffer.from(await output.save({ useObjectStreams: true })), filename, 'application/pdf')
  } catch (error) { next(error) }
})

app.post('/api/tools/pdf/compress', pdfCompressionUpload.single('file'), enforceUploadedBytes, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Vui lòng chọn một tệp PDF.' })
    assertPdfFile(req.file)
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

app.post('/api/tools/pdf/edit', upload.single('file'), enforceUploadedBytes, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Vui lòng chọn một tệp PDF.' })
    assertPdfFile(req.file)
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
    const position = ['custom', 'top-left', 'top-center', 'top-right', 'center', 'bottom-left', 'bottom-center', 'bottom-right'].includes(req.body.position) ? req.body.position : 'bottom-center'
    const xPercent = clamp(Number(req.body.xPercent) || 50, 2, 98)
    const yPercent = clamp(Number(req.body.yPercent) || 88, 2, 98)
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
      const x = position === 'custom'
        ? page.getWidth() * xPercent / 100 - overlayWidth / 2
        : horizontal === 'left' ? margin : horizontal === 'right' ? page.getWidth() - overlayWidth - margin : (page.getWidth() - overlayWidth) / 2
      const y = position === 'custom'
        ? page.getHeight() * (1 - yPercent / 100) - overlayHeight / 2
        : vertical === 'top' ? page.getHeight() - overlayHeight - margin : vertical === 'bottom' ? margin : (page.getHeight() - overlayHeight) / 2
      page.drawImage(overlay, {
        x: clamp(x, 0, Math.max(0, page.getWidth() - overlayWidth)),
        y: clamp(y, 0, Math.max(0, page.getHeight() - overlayHeight)),
        width: overlayWidth,
        height: overlayHeight,
        opacity,
      })
    }

    const buffer = Buffer.from(await source.save({ useObjectStreams: true, addDefaultPage: false }))
    res.set({
      'X-PDF-Edit-Position': position,
      'X-PDF-Edit-X': String(xPercent),
      'X-PDF-Edit-Y': String(yPercent),
    })
    download(res, buffer, safeName(req.file.originalname, editType === 'page-numbers' ? '-numbered.pdf' : '-edited.pdf'), 'application/pdf')
  } catch (error) { next(error) }
})

app.post('/api/tools/pdf/to-:format', upload.single('file'), enforceUploadedBytes, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Vui lòng chọn một tệp PDF.' })
    assertPdfFile(req.file)
    const result = await convertPdfText(req.file.buffer, req.params.format)
    res.set({
      'X-Extracted-Pages': String(result.pages),
      'X-Extracted-Characters': String(result.characterCount),
      'X-PDF-Source-Kind': result.source.kind,
      'X-PDF-Text-Pages': String(result.source.textPageCount),
      'X-PDF-Image-Only-Pages': String(result.source.imageOnlyPageCount),
      'X-PDF-Blank-Pages': String(result.source.blankPageCount),
      'X-PDF-Has-Structure': result.source.hasStructTree ? 'yes' : 'no',
      'X-PDF-Signatures': String(result.source.signatureCount || 0),
      ...(result.layoutMode ? { 'X-Word-Layout-Mode': result.layoutMode } : {}),
      ...(Number.isFinite(result.detectedTables) ? { 'X-Word-Detected-Tables': String(result.detectedTables) } : {}),
      ...(Number.isFinite(result.embeddedGraphics) ? { 'X-Word-Embedded-Graphics': String(result.embeddedGraphics) } : {}),
    })
    download(res, result.buffer, safeName(req.file.originalname, `.${result.extension}`), result.type)
  } catch (error) { next(error) }
})

app.post('/api/tools/pdf/split', upload.single('file'), enforceUploadedBytes, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Vui lòng chọn một tệp PDF.' })
    assertPdfFile(req.file)
    const source = await PDFDocument.load(req.file.buffer, { ignoreEncryption: true })
    let pages
    let pagePlan
    try {
      pagePlan = req.body.pagePlan ? JSON.parse(req.body.pagePlan) : null
      pages = Array.isArray(pagePlan) ? pagePlan.map(item => Number(item.pageIndex)) : parsePageSelection(req.body.pages, source.getPageCount())
      if (!pages.length || pages.some(page => !Number.isInteger(page) || page < 0 || page >= source.getPageCount())) throw new Error('Danh sách trang cần tách không hợp lệ.')
      if (pages.length > maximumPdfPages) return res.status(413).json({ message: `Mỗi lượt chỉ xử lý tối đa ${maximumPdfPages} trang PDF.` })
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

app.use((error, req, res, _next) => {
  console.error(error)
  if (error?.code === 'LIMIT_FILE_SIZE') {
    const maximumFileMb = req.path === '/api/tools/pdf/compress' ? pdfCompressionMaximumFileMb : defaultMaximumFileMb
    return res.status(413).json({ message: `Tệp vượt quá giới hạn ${maximumFileMb} MB.` })
  }
  const status = Number(error?.statusCode)
  res.status(status >= 400 && status < 500 ? status : 500).json({
    message: status >= 400 && status < 500 ? error.message : 'Không thể xử lý tệp này. Hãy kiểm tra lại định dạng hoặc thử tệp nhỏ hơn.',
  })
})

const port = process.env.PORT || 3001
const host = process.env.HOST || '127.0.0.1'
const server = app.listen(port, host, () => {
  console.log(`ToolHub listening on http://${host}:${port}`)
  telegramBot.start()
})

const shutdown = signal => {
  console.log(`${signal} received, closing ToolHub gracefully.`)
  telegramBot.stop()
  server.close(error => process.exit(error ? 1 : 0))
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
