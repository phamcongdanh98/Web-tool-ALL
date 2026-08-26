import { useEffect, useMemo, useRef, useState } from 'react'
import UtilityToolModal from './UtilityTools.jsx'
import { useLanguage } from './i18n.jsx'
import { formatBytes } from '../lib/browser-utility.js'

const appVersion = import.meta.env.VITE_APP_VERSION
const appBuildNumber = import.meta.env.VITE_APP_BUILD_NUMBER
const appRevision = import.meta.env.VITE_APP_REVISION

const pdfTools = [
  { icon: '✎', name: 'Chỉnh sửa PDF', description: 'Thêm chữ, watermark và đánh số trang', color: 'coral', mode: 'pdf-edit' },
  { icon: '✳', name: 'Nén PDF', description: 'Đặt dung lượng MB và tự động nén sát mục tiêu', color: 'red', mode: 'pdf-compress' },
  { icon: '⊕', name: 'Ghép PDF', description: 'Sắp xếp và ghép nhiều tệp PDF thành một', color: 'blue', mode: 'pdf-merge' },
  { icon: '↕', name: 'Sắp xếp PDF', description: 'Kéo thả, xoay, nhân bản, thêm hoặc xóa trang', color: 'indigo', mode: 'pdf-organize' },
  { icon: '◫', name: 'Tách PDF', description: 'Chọn trực tiếp thumbnail và tải kết quả dạng ZIP', color: 'purple', mode: 'pdf-split' },
  { icon: 'W', name: 'PDF sang Word', description: 'Dựng đoạn, bảng, dấu và chữ ký thành Word dễ sửa', color: 'blue', mode: 'pdf-to-word' },
  { icon: 'X', name: 'PDF sang Excel', description: 'Tách dòng và cột thành workbook XLSX', color: 'green', mode: 'pdf-to-excel' },
  { icon: 'P', name: 'PDF sang PowerPoint', description: 'Mỗi trang thành slide với chữ có thể sửa', color: 'orange', mode: 'pdf-to-powerpoint' },
  { icon: 'TXT', name: 'PDF sang văn bản', description: 'Xuất nội dung có thể chọn thành tệp TXT', color: 'teal', mode: 'pdf-to-text' },
]

const imageTools = [
  { icon: '♙', name: 'Xóa phông nền', description: 'AI xóa nền kèm preview trong suốt', color: 'blue', mode: 'remove-background' },
  { icon: '▣', name: 'Chuyển đổi định dạng', description: 'Xem trước và đổi JPG, PNG, WebP, AVIF', color: 'teal', mode: 'convert' },
  { icon: '⛶', name: 'Thay đổi kích thước', description: 'Nhập kích thước và xem kết quả trước khi tải', color: 'violet', mode: 'resize' },
  { icon: '⌗', name: 'Cắt ảnh', description: 'Kéo, thả và thu phóng khung cắt trực tiếp', color: 'pink', mode: 'crop' },
  { icon: '✳', name: 'Nén ảnh', description: 'Điều chỉnh chất lượng và so sánh dung lượng', color: 'yellow', mode: 'compress' },
  { icon: '☷', name: 'Chỉnh sửa ảnh', description: 'Màu sắc, độ sáng, tương phản, xoay và lật', color: 'indigo', mode: 'edit' },
  { icon: '▰', name: 'Che thông tin', description: 'Kéo vùng che đặc để bảo vệ dữ liệu nhạy cảm', color: 'coral', mode: 'image-redact' },
]

const utilityTools = [
  { icon: '⌗', name: 'Tạo mã QR', description: 'Tạo, xem trước và kiểm tra QR ngay trên máy', color: 'indigo', mode: 'qr-create' },
  { icon: '◉', name: 'Đọc mã QR', description: 'Đọc QR từ ảnh mà không tự mở liên kết', color: 'teal', mode: 'qr-read' },
  { icon: 'Aa', name: 'Đổi tên file hàng loạt', description: 'Xem trước tên mới và tải về dạng ZIP', color: 'blue', mode: 'batch-rename' },
  { icon: '↗', name: 'Rút gọn liên kết', description: 'Đang thiết kế lưu trữ và chống lạm dụng', color: 'orange', mode: 'link-shortener', ready: false },
]

const englishTools = {
  'pdf-edit': ['Edit PDF', 'Add text, watermarks and page numbers'],
  'pdf-compress': ['Compress PDF', 'Set a target size and compress close to it automatically'],
  'pdf-merge': ['Merge PDF', 'Arrange and combine multiple PDF files'],
  'pdf-organize': ['Organize PDF', 'Drag, rotate, duplicate, add or delete pages'],
  'pdf-split': ['Split PDF', 'Select page thumbnails and download the result as ZIP'],
  'pdf-to-word': ['PDF to Word', 'Rebuild paragraphs, tables, stamps and signatures in Word'],
  'pdf-to-excel': ['PDF to Excel', 'Extract rows and columns into an XLSX workbook'],
  'pdf-to-powerpoint': ['PDF to PowerPoint', 'Turn each page into a slide with editable text'],
  'pdf-to-text': ['PDF to Text', 'Export selectable content as a TXT file'],
  'remove-background': ['Remove Background', 'AI background removal with transparent preview'],
  convert: ['Convert Image', 'Preview and convert JPG, PNG, WebP and AVIF'],
  resize: ['Resize Image', 'Enter dimensions and preview before downloading'],
  crop: ['Crop Image', 'Drag and resize the crop frame directly'],
  compress: ['Compress Image', 'Adjust quality and compare file sizes'],
  edit: ['Edit Image', 'Color, brightness, contrast, rotate and flip'],
  'image-redact': ['Redact Information', 'Drag solid blocks over sensitive information'],
  'qr-create': ['Create QR Code', 'Create, preview and verify QR codes on your device'],
  'qr-read': ['Read QR Code', 'Read QR from an image without opening its link'],
  'batch-rename': ['Batch Rename Files', 'Preview new names and download them as a ZIP'],
  'link-shortener': ['Shorten Link', 'Storage and abuse prevention are being designed'],
}

const specialToolModes = new Set(['image-redact', ...utilityTools.map(tool => tool.mode)])

const footerProducts = [
  { label: 'PDF Tools', href: '#pdf' },
  { label: 'Image Tools', href: '#images' },
  { label: 'Tiện ích', href: '#utilities' },
  { label: 'Vì sao chọn chúng tôi', href: '#benefits' },
]

const footerContacts = [
  { label: 'Facebook', detail: 'Danh Phạm', href: 'https://www.facebook.com/danhpham100898' },
  { label: 'Zalo', detail: '0356 719 463', href: 'https://zalo.me/0356719463' },
  { label: 'Telegram', detail: '0356 719 463', href: 'https://t.me/+84356719463' },
]

const labels = {
  'pdf-compress': 'Nén PDF',
  'pdf-merge': 'Ghép PDF',
  'pdf-organize': 'Sắp xếp PDF',
  'pdf-split': 'Tách PDF',
  'pdf-edit': 'Chỉnh sửa PDF',
  'pdf-to-word': 'PDF sang Word',
  'pdf-to-excel': 'PDF sang Excel',
  'pdf-to-powerpoint': 'PDF sang PowerPoint',
  'pdf-to-text': 'PDF sang văn bản',
  compress: 'Nén ảnh',
  convert: 'Chuyển đổi định dạng ảnh',
  resize: 'Thay đổi kích thước',
  crop: 'Cắt ảnh',
  edit: 'Chỉnh sửa ảnh',
  'remove-background': 'Xóa phông nền',
}

const labelsEn = Object.fromEntries(Object.entries(englishTools).map(([mode, [name]]) => [mode, name]))

const imageModes = ['compress', 'convert', 'resize', 'crop', 'edit', 'remove-background']
const pdfOfficeModes = ['pdf-to-word', 'pdf-to-excel', 'pdf-to-powerpoint', 'pdf-to-text']
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
// Kiểm tra chuỗi có chứa ký tự tiếng Việt không (để phát hiện error message từ server còn ở tiếng Việt)
const containsVietnamese = text => /[àáâãèéêìíòóôõùúýăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỷỹỵÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐƠƯ]/u.test(String(text || ''))

const maximumFileBytes = 25 * 1024 * 1024
const maximumPdfCompressionFileBytes = 50 * 1024 * 1024
const maximumUploadBytes = 50 * 1024 * 1024
const maximumPdfPages = 500
const maximumExactWordPages = 40
const exactWordDpi = 200
const maximumExactWordPixelsPerPage = 12_000_000
// formatBytes imported from lib/browser-utility.js

let pdfJsPromise
let pdfWorkerUrl
let pdfWarmPromise
let pdfPageId = 0
const thumbnailPdfCache = new Map()
const loadPdfJs = async () => {
  if (!pdfJsPromise) {
    pdfJsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfWorkerUrl = worker.default
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
      return pdfjs
    }).catch(error => {
      pdfJsPromise = null
      throw error
    })
  }
  return pdfJsPromise
}

const warmPdfTools = () => {
  if (!pdfWarmPromise) {
    pdfWarmPromise = Promise.all([loadPdfJs(), import('pdf-lib')]).then(async ([pdfjs]) => {
      if (pdfWorkerUrl) {
        const response = await fetch(pdfWorkerUrl, { cache: 'force-cache' })
        if (!response.ok) throw new Error(`Không tải được PDF worker (${response.status}).`)
        await response.arrayBuffer()
      }
      return pdfjs
    }).catch(error => {
      pdfWarmPromise = null
      throw error
    })
  }
  return pdfWarmPromise
}

const pdfSourceLabels = {
  'word-export': 'Có dấu hiệu xuất từ Microsoft Word',
  'signed-document': 'PDF văn bản đã ký số',
  digital: 'PDF có văn bản chọn được',
  mixed: 'PDF hỗn hợp: chữ và trang dạng ảnh',
  scan: 'Có thể là PDF scan',
}

const pdfSourceLabelsEn = {
  'word-export': 'Likely exported from Microsoft Word',
  'signed-document': 'Digitally signed text PDF',
  digital: 'PDF with selectable text',
  mixed: 'Mixed PDF: text and image-only pages',
  scan: 'Possibly a scanned PDF',
}

const readPdfTextPreview = async file => {
  const pdfjs = await loadPdfJs()
  const data = new Uint8Array(await file.arrayBuffer())
  const loadingTask = pdfjs.getDocument({ data })
  try {
    const pdf = await loadingTask.promise
    const metadata = await pdf.getMetadata().catch(() => ({ info: {} }))
    const signatures = await pdf.getSignatures().catch(() => null)
    const fieldObjects = signatures?.length ? null : await pdf.getFieldObjects().catch(() => null)
    const signatureCount = signatures?.length || (fieldObjects ? Object.values(fieldObjects).flat().filter(field => field?.type === 'signature').length : 0)
    const creator = String(metadata.info?.Creator || '')
    const producer = String(metadata.info?.Producer || '')
    const hasWordMetadata = /(microsoft\s*(?:office\s*)?word|word\s+for\s+mac|acrobat\s+pdfmaker[^\n]*word)/i.test(`${creator} ${producer}`.normalize('NFKD').replace(/[®™]/g, ''))
    const pageTexts = []
    const sampledPages = Math.min(pdf.numPages, 4)
    let checkedPages = 0
    let textPages = 0
    let imageOnlyPages = 0
    const imageOperations = new Set([
      pdfjs.OPS.paintImageMaskXObject,
      pdfjs.OPS.paintImageMaskXObjectGroup,
      pdfjs.OPS.paintImageXObject,
      pdfjs.OPS.paintImageXObjectRepeat,
      pdfjs.OPS.paintInlineImageXObject,
      pdfjs.OPS.paintInlineImageXObjectGroup,
    ].filter(Number.isFinite))
    for (let pageNumber = 1; pageNumber <= sampledPages; pageNumber++) {
      checkedPages += 1
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      const text = content.items.map(item => item.str || '').join(' ').replace(/\s+/g, ' ').trim()
      if (text) {
        textPages += 1
        pageTexts.push(`Trang ${pageNumber}\n${text}`)
      } else {
        const operations = await page.getOperatorList()
        if (operations.fnArray.some(operation => imageOperations.has(operation))) imageOnlyPages += 1
      }
      page.cleanup?.()
      if (pageTexts.join('\n\n').length >= 5000) break
    }
    const sourceKind = textPages && imageOnlyPages ? 'mixed'
      : !textPages ? 'scan'
        : signatureCount ? 'signed-document'
        : hasWordMetadata ? 'word-export'
          : 'digital'
    return {
      text: pageTexts.join('\n\n').slice(0, 5000),
      sourceKind,
      creator,
      producer,
      hasStructTree: Boolean(metadata.hasStructTree),
      signatureCount,
      textPages,
      imageOnlyPages,
      sampledPages: checkedPages,
      totalPages: pdf.numPages,
    }
  } finally {
    await loadingTask.destroy().catch(() => null)
  }
}

const loadThumbnailPdf = async url => {
  if (!thumbnailPdfCache.has(url)) {
    const promise = loadPdfJs().then(pdfjs => {
      const task = pdfjs.getDocument({ url })
      thumbnailPdfCache.set(url, { task, promise: task.promise })
      return task.promise
    })
    thumbnailPdfCache.set(url, { promise })
  }
  return thumbnailPdfCache.get(url).promise
}

const releaseThumbnailPdf = url => {
  const cached = thumbnailPdfCache.get(url)
  cached?.task?.destroy?.()
  thumbnailPdfCache.delete(url)
}

const makePageItems = (infos, firstFileIndex = 0) => infos.flatMap((info, infoIndex) =>
  Array.from({ length: info.pages || 0 }, (_, pageIndex) => ({
    id: `pdf-page-${++pdfPageId}`,
    fileIndex: firstFileIndex + infoIndex,
    pageIndex,
    rotation: 0,
  })))

const canvasToJpeg = (canvas, quality) => new Promise((resolve, reject) => {
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Không thể mã hóa trang PDF thành ảnh.')), 'image/jpeg', quality)
})

const canvasToPng = canvas => new Promise((resolve, reject) => {
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Không thể mã hóa trang PDF thành ảnh PNG.')), 'image/png')
})

const encodeExactWordPage = async canvas => {
  const [png, jpeg] = await Promise.all([canvasToPng(canvas), canvasToJpeg(canvas, 0.97)])
  return png.size <= Math.max(3.5 * 1024 * 1024, jpeg.size * 1.5) ? png : jpeg
}

const exactWordFont = (fontObject, style = {}) => {
  const original = String(fontObject?.name || fontObject?.fallbackName || style.fontFamily || '').replace(/^[A-Z]{6}\+/, '')
  const normalized = original.toLowerCase()
  const font = /times|serif/.test(normalized) ? 'Times New Roman'
    : /courier|mono|consolas/.test(normalized) ? 'Courier New'
      : /calibri/.test(normalized) ? 'Calibri'
        : /cambria/.test(normalized) ? 'Cambria'
          : /arial|helvetica|sans/.test(normalized) ? 'Arial'
            : original.split(',')[0].replace(/["']/g, '').trim() || 'Arial'
  return {
    font,
    bold: /bold|black|heavy|semibold|demi/.test(normalized),
    italics: /italic|oblique/.test(normalized),
  }
}

const collectExactTextColors = (pdfjs, operatorList) => {
  const colors = []
  const stack = []
  let fillColor = '000000'
  operatorList.fnArray.forEach((operation, index) => {
    if (operation === pdfjs.OPS.save) stack.push(fillColor)
    else if (operation === pdfjs.OPS.restore) fillColor = stack.pop() || '000000'
    else if (operation === pdfjs.OPS.setFillRGBColor) {
      const value = operatorList.argsArray[index]?.[0]
      if (typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)) fillColor = value.slice(1).toUpperCase()
    } else if ([pdfjs.OPS.showText, pdfjs.OPS.showSpacedText, pdfjs.OPS.nextLineShowText, pdfjs.OPS.nextLineSetSpacingShowText].includes(operation)) colors.push(fillColor)
  })
  return colors
}

const makeExactTextItems = (pdfjs, page, viewport, content, colors = []) => {
  const measureCanvas = document.createElement('canvas')
  const measureContext = measureCanvas.getContext('2d')
  let textIndex = 0
  return content.items.flatMap(item => {
    if (typeof item.str !== 'string' || !item.str.trim() || !Array.isArray(item.transform)) return []
    const style = content.styles?.[item.fontName] || {}
    let fontObject = null
    try { fontObject = page.commonObjs.get(item.fontName) } catch {}
    const font = exactWordFont(fontObject, style)
    const tx = pdfjs.Util.transform(viewport.transform, item.transform)
    let angle = Math.atan2(tx[1], tx[0])
    if (style.vertical) angle += Math.PI / 2
    const fontSize = Math.max(4, Math.hypot(tx[2], tx[3]))
    const ascent = Number.isFinite(style.ascent) ? style.ascent : Number.isFinite(style.descent) ? 1 + style.descent : 0.8
    const fontAscent = fontSize * ascent
    const x = angle === 0 ? tx[4] : tx[4] + fontAscent * Math.sin(angle)
    const y = angle === 0 ? tx[5] - fontAscent : tx[5] - fontAscent * Math.cos(angle)
    const width = Math.max(Number(item.width) || fontSize * 0.5, fontSize * 0.35)
    let naturalWidth = width
    if (measureContext) {
      measureContext.font = `${font.italics ? 'italic ' : ''}${font.bold ? '700' : '400'} ${fontSize}px "${font.font}"`
      naturalWidth = measureContext.measureText(item.str).width || width
    }
    return [{
      text: item.str,
      x: Math.max(0, x),
      y: Math.max(0, y),
      // LibreOffice và một số bản Word dùng metric font rộng hơn PDF một chút.
      // Chừa khoảng trong suốt để tránh dòng bị wrap/clipping nhưng không đổi vị trí hay độ co ngang.
      width: Math.min(viewport.width - Math.max(0, x), width * 1.15 + Math.max(2, fontSize * 0.2)),
      height: fontSize * 1.24,
      fontSize,
      font: font.font,
      bold: font.bold,
      italics: font.italics,
      color: colors[textIndex++] || '000000',
      scale: Math.max(20, Math.min(600, width / Math.max(naturalWidth, 0.1) * 100)),
      rotation: angle * 180 / Math.PI,
      direction: item.dir,
    }]
  })
}

const createExactWordFromPdf = async (file, onProgress) => {
  const [pdfjs, exactWord] = await Promise.all([loadPdfJs(), import('../lib/exact-word.js')])
  const data = new Uint8Array(await file.arrayBuffer())
  const loadingTask = pdfjs.getDocument({ data })
  try {
    const pdf = await loadingTask.promise
    if (pdf.numPages > maximumExactWordPages) {
      throw new Error(`Chế độ bố cục chính xác xử lý tối đa ${maximumExactWordPages} trang mỗi lượt. Hãy tách PDF hoặc chọn chế độ dòng chảy.`)
    }
    const pages = []
    let textBoxCount = 0
    const textPaintOperations = new Set([
      pdfjs.OPS.showText,
      pdfjs.OPS.showSpacedText,
      pdfjs.OPS.nextLineShowText,
      pdfjs.OPS.nextLineSetSpacingShowText,
    ].filter(Number.isFinite))
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      onProgress?.(
        `Đang tái dựng chữ và đồ họa trang ${pageNumber}/${pdf.numPages}…`,
        `Rebuilding text and graphics for page ${pageNumber}/${pdf.numPages}…`
      )
      const page = await pdf.getPage(pageNumber)
      const sourceViewport = page.getViewport({ scale: 1 })
      const content = await page.getTextContent({ disableNormalization: false })
      const operatorList = await page.getOperatorList({ intent: 'print', annotationMode: pdfjs.AnnotationMode.ENABLE_STORAGE })
      const textItems = makeExactTextItems(pdfjs, page, sourceViewport, content, collectExactTextColors(pdfjs, operatorList))
      if (!textItems.length) throw new Error(`Trang ${pageNumber} không có lớp chữ. Chế độ bố cục chính xác chỉ dùng cho PDF số; PDF scan cần OCR trước.`)
      textBoxCount += textItems.length
      const idealScale = exactWordDpi / 72
      const pixelLimitedScale = Math.sqrt(maximumExactWordPixelsPerPage / (sourceViewport.width * sourceViewport.height))
      const scale = Math.min(idealScale, pixelLimitedScale)
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.ceil(viewport.width))
      canvas.height = Math.max(1, Math.ceil(viewport.height))
      const context = canvas.getContext('2d', { alpha: false })
      if (!context) throw new Error('Trình duyệt không thể dựng trang PDF.')
      await page.render({
        canvasContext: context,
        viewport,
        background: '#fff',
        intent: 'print',
        annotationMode: pdfjs.AnnotationMode.ENABLE_STORAGE,
        operationsFilter: index => !textPaintOperations.has(operatorList.fnArray[index]),
      }).promise
      const background = await encodeExactWordPage(canvas)
      pages.push({
        width: sourceViewport.width,
        height: sourceViewport.height,
        background: { data: await background.arrayBuffer(), mimeType: background.type },
        textItems,
      })
      canvas.width = 1
      canvas.height = 1
      page.cleanup?.()
    }
    onProgress?.('Đang đóng gói các trang vào Word…', 'Packaging pages into Word…')
    return {
      blob: await exactWord.createExactWordBlob(pages),
      pages: pdf.numPages,
      textBoxes: textBoxCount,
      dpi: exactWordDpi,
      imageFormats: [...new Set(pages.map(page => page.background.mimeType === 'image/png' ? 'PNG' : 'JPEG'))].join(' + '),
    }
  } finally {
    await loadingTask.destroy().catch(() => null)
  }
}

const compressionPreset = profile => profile === 'photo'
  ? { bytesPerPixel: 0.31, minimumQuality: 0.5, maximumQuality: 0.94, minimumScale: 0.9, maximumScale: 3.5 }
  : { bytesPerPixel: 0.18, minimumQuality: 0.34, maximumQuality: 0.9, minimumScale: 1.15, maximumScale: 4 }

const encodeCanvasNearBudget = async (canvas, budget, preset, allowPng) => {
  const { minimumQuality, maximumQuality } = preset
  if (allowPng) {
    const png = await canvasToPng(canvas)
    if (png.size <= budget) return { blob: png, quality: 1, format: 'png' }
  }
  const minimum = await canvasToJpeg(canvas, minimumQuality)
  if (minimum.size > budget) return { blob: minimum, quality: minimumQuality, format: 'jpeg' }
  const maximum = await canvasToJpeg(canvas, maximumQuality)
  if (maximum.size <= budget) return { blob: maximum, quality: maximumQuality, format: 'jpeg' }

  let best = minimum
  let bestQuality = minimumQuality
  let low = minimumQuality
  let high = maximumQuality
  for (let attempt = 0; attempt < 7; attempt++) {
    const quality = (low + high) / 2
    const candidate = await canvasToJpeg(canvas, quality)
    if (candidate.size <= budget) {
      best = candidate
      bestQuality = quality
      low = quality
    } else high = quality
  }
  return { blob: best, quality: bestQuality, format: 'jpeg' }
}

const renderPageNearBudget = async (page, budget, profile, hasSelectableText) => {
  const base = page.getViewport({ scale: 1 })
  const basePixels = Math.max(1, base.width * base.height)
  const preset = compressionPreset(profile)
  const maximumScale = Math.min(preset.maximumScale, 4200 / Math.max(base.width, base.height), Math.sqrt(10_000_000 / basePixels))
  let scale = clamp(Math.sqrt(budget / (basePixels * preset.bytesPerPixel)), preset.minimumScale, maximumScale)
  let chosen

  for (let resolutionAttempt = 0; resolutionAttempt < 4; resolutionAttempt++) {
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))
    const context = canvas.getContext('2d', { alpha: false })
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    await page.render({ canvasContext: context, viewport, background: '#fff' }).promise
    chosen = await encodeCanvasNearBudget(canvas, budget, preset, profile === 'document' && hasSelectableText)
    canvas.width = 1
    canvas.height = 1

    const isTooLarge = chosen.blob.size > budget * 1.01 && scale > preset.minimumScale * 0.72
    const isHighestEncodingQuality = chosen.format === 'png' || chosen.quality >= preset.maximumQuality - 0.01
    const hasRoomForMoreDetail = chosen.blob.size < budget * 0.88 && isHighestEncodingQuality && scale < maximumScale * 0.99
    if (!isTooLarge && !hasRoomForMoreDetail) break
    const correction = Math.sqrt(budget / Math.max(chosen.blob.size, 1))
    const nextScale = scale * correction * (isTooLarge ? 0.96 : 0.98)
    scale = clamp(nextScale, preset.minimumScale * 0.7, maximumScale)
  }

  return { ...chosen, width: base.width, height: base.height, scale, dpi: Math.round(scale * 72) }
}

const compressPdfToTarget = async (file, targetMb, profile, reportProgress) => {
  const targetBytes = Math.floor(Number(targetMb) * 1024 * 1024)
  if (!Number.isFinite(targetBytes) || targetBytes <= 0) throw new Error('Dung lượng mục tiêu không hợp lệ.')
  if (targetBytes >= file.size) throw new Error('Mục tiêu phải nhỏ hơn dung lượng tệp gốc.')

  const sourceBytes = new Uint8Array(await file.arrayBuffer())
  const pdfjs = await loadPdfJs()
  const loadingTask = pdfjs.getDocument({ data: sourceBytes.slice() })
  const source = await loadingTask.promise
  const minimumUsefulSize = 64 * 1024 + source.numPages * 18 * 1024
  if (targetBytes < minimumUsefulSize) {
    await loadingTask.destroy()
    throw new Error(`Mục tiêu quá thấp cho ${source.numPages} trang. Hãy chọn ít nhất ${formatBytes(minimumUsefulSize)}.`)
  }

  const { PDFDocument } = await import('pdf-lib')
  const idealBytes = Math.floor(targetBytes * 0.975)
  const pageFacts = []
  for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber++) {
    const page = await source.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1 })
    const textContent = await page.getTextContent({ disableNormalization: true }).catch(() => ({ items: [] }))
    pageFacts.push({ page, weight: viewport.width * viewport.height, hasSelectableText: textContent.items.some(item => item.str?.trim()) })
  }
  const pdfOverhead = 18 * 1024 + source.numPages * 1800
  let budgetScale = 1
  let closestUnderTarget = null

  try {
    for (let pass = 1; pass <= 4; pass++) {
      const imageBudget = Math.max(source.numPages * 10 * 1024, idealBytes * budgetScale - pdfOverhead)
      const totalWeight = pageFacts.reduce((sum, fact) => sum + fact.weight, 0)
      const output = await PDFDocument.create()
      const pageDetails = []
      for (let index = 0; index < pageFacts.length; index++) {
        reportProgress(
          `Lượt tối ưu ${pass}/4 · đang xử lý trang ${index + 1}/${source.numPages}…`,
          `Optimization pass ${pass}/4 · processing page ${index + 1}/${source.numPages}…`
        )

        const fact = pageFacts[index]
        const pageBudget = Math.max(10 * 1024, imageBudget * fact.weight / totalWeight)
        const encoded = await renderPageNearBudget(fact.page, pageBudget, profile, fact.hasSelectableText)
        const embeddedImage = encoded.format === 'png'
          ? await output.embedPng(await encoded.blob.arrayBuffer())
          : await output.embedJpg(await encoded.blob.arrayBuffer())
        const outputPage = output.addPage([encoded.width, encoded.height])
        outputPage.drawImage(embeddedImage, { x: 0, y: 0, width: encoded.width, height: encoded.height })
        pageDetails.push({ bytes: encoded.blob.size, dpi: encoded.dpi, quality: encoded.quality, format: encoded.format })
      }
      const bytes = await output.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 30 })
      if (bytes.length <= targetBytes && (!closestUnderTarget || bytes.length > closestUnderTarget.bytes.length)) closestUnderTarget = { bytes, pageDetails }
      const targetGap = Math.abs(bytes.length - idealBytes) / idealBytes
      if (bytes.length <= targetBytes && targetGap <= 0.035) break

      pageFacts.forEach((fact, index) => { fact.weight = Math.max(12 * 1024, pageDetails[index].bytes) })
      const reference = bytes.length > targetBytes ? targetBytes * 0.985 : idealBytes
      budgetScale = clamp(budgetScale * reference / Math.max(bytes.length, 1) * 0.99, 0.22, 2.8)
    }
  } finally {
    pageFacts.forEach(fact => fact.page.cleanup?.())
    await loadingTask.destroy()
  }

  if (!closestUnderTarget) throw new Error('Không thể đạt mức dung lượng này mà vẫn giữ trang có thể đọc. Hãy tăng mục tiêu một chút.')
  const dpis = closestUnderTarget.pageDetails.map(detail => detail.dpi)
  const qualities = closestUnderTarget.pageDetails.filter(detail => detail.format === 'jpeg').map(detail => detail.quality)
  return {
    blob: new Blob([closestUnderTarget.bytes], { type: 'application/pdf' }),
    compression: {
      profile,
      minimumDpi: Math.min(...dpis),
      maximumDpi: Math.max(...dpis),
      averageQuality: qualities.length ? Math.round(qualities.reduce((sum, quality) => sum + quality, 0) / qualities.length * 100) : 100,
      losslessPages: closestUnderTarget.pageDetails.filter(detail => detail.format === 'png').length,
    },
  }
}

function BrandLogo() {
  return <>
    <span className="brand-mark" aria-hidden="true"><img src="/favicon.svg" alt="" /></span>
    <span className="brand-word"><strong>PDF</strong>Tools</span>
  </>
}

function CreatorShowcase() {
  const { tx } = useLanguage()
  return <section className="creator-showcase" id="creator" aria-labelledby="creator-title">
    <div className="creator-showcase-glow" aria-hidden="true" />
    <div className="creator-showcase-monogram" aria-hidden="true"><span>D</span><i>✦</i><span>P</span></div>
    <div className="creator-showcase-copy">
      <span className="creator-eyebrow">{tx('DẤU ẤN NGƯỜI SÁNG TẠO', 'CREATOR SIGNATURE')}</span>
      <h2 id="creator-title"><small>{tx('Thiết kế & phát triển bởi', 'Designed & developed by')}</small><strong>Danh Phạm</strong></h2>
      <p>{tx('Mình xây dựng Công Cụ Web để những thao tác với PDF, hình ảnh và tệp hằng ngày trở nên rõ ràng, trực quan và dễ tiếp cận hơn với người Việt.', 'I built Công Cụ Web to make everyday PDF, image and file tasks clearer, more visual and easier to use.')}</p>
      <div className="creator-values" aria-label={tx('Giá trị thiết kế', 'Design values')}><span><i>01</i>{tx('Dễ thao tác', 'Easy to use')}</span><span><i>02</i>{tx('Preview rõ ràng', 'Clear previews')}</span><span><i>03</i>{tx('Không ngừng hoàn thiện', 'Always improving')}</span></div>
    </div>
    <div className="creator-connect">
      <small>{tx('KẾT NỐI TRỰC TIẾP', 'CONNECT DIRECTLY')}</small>
      <a className="creator-primary-link" href="https://www.facebook.com/danhpham100898" target="_blank" rel="noreferrer">Facebook <span>↗</span></a>
      <a href="https://zalo.me/0356719463" target="_blank" rel="noreferrer">Zalo · 0356 719 463 <span>↗</span></a>
      <a href="https://t.me/+84356719463" target="_blank" rel="noreferrer">Telegram · 0356 719 463 <span>↗</span></a>
    </div>
  </section>
}

function WelcomeSplash({ phase, onSkip }) {
  const { tx } = useLanguage()
  const creatorName = 'Danh Phạm'
  const engines = [
    { code: 'PDF', name: 'PDF Engine', className: 'engine-pdf' },
    { code: 'WORD', name: 'Office Engine', className: 'engine-word' },
    { code: 'IMAGE', name: 'Image Engine', className: 'engine-image' },
    { code: 'QR', name: 'Utility Tools', className: 'engine-qr' },
  ]
  return <div className={`welcome-splash ${phase}`} aria-label={tx('Đang khởi động Công Cụ Web', 'Starting Công Cụ Web')}>
    <div className="welcome-orb orb-one" aria-hidden="true" />
    <div className="welcome-orb orb-two" aria-hidden="true" />
    <div className="welcome-screen-noise" aria-hidden="true" />
    <div className="welcome-hud" aria-hidden="true">
      <span><i /> CGW // CORE SYSTEM</span>
      <b><i /><i /><i /></b>
      <span>LOCAL FIRST <i /> VI</span>
    </div>
    <button className="welcome-skip" type="button" onClick={onSkip}>{tx('Bỏ qua', 'Skip')} <span>→</span></button>
    <section className="welcome-cinematic">
      <div className="welcome-depth-grid" aria-hidden="true" />
      <div className="welcome-data-tunnel" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => <span key={index} style={{ '--tunnel-index': index }} />)}
      </div>
      <div className="welcome-corner-frame" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="welcome-scene" aria-hidden="true">
        <div className="welcome-energy-field">
          <span className="energy-ring energy-one" />
          <span className="energy-ring energy-two" />
          <span className="energy-ring energy-three" />
          <i className="energy-axis axis-x" /><i className="energy-axis axis-y" />
        </div>
        <div className="welcome-source-file">
          <span className="welcome-file-shadow shadow-back" />
          <span className="welcome-file-shadow shadow-middle" />
          <span className="welcome-file-sheet"><b>PDF</b><i>01</i><em /></span>
          <span className="welcome-file-scan" />
          <span className="welcome-file-target"><i /><i /><i /><i /></span>
          <span className="welcome-file-spark">✦</span>
        </div>

        <div className="welcome-particles">
          {Array.from({ length: 16 }, (_, index) => <span
            key={index}
            style={{ '--particle-index': index, '--particle-angle': `${index * 22.5}deg` }}
          />)}
        </div>

        <div className="welcome-engine-system">
          <span className="welcome-engine-orbit orbit-horizontal" />
          <span className="welcome-engine-orbit orbit-vertical" />
          <span className="welcome-engine-core"><img src="/favicon.svg" alt="" /></span>
          {engines.map((engine, index) => <span
            className={`welcome-engine ${engine.className}`}
            style={{ '--engine-index': index }}
            key={engine.code}
          >
            <em>0{index + 1}</em><b>{engine.code}</b><small>{engine.name} <i>✓</i></small><span><i /></span>
          </span>)}
          <small className="welcome-engine-telemetry telemetry-left">MEM 24.8 <i>MB</i><b /></small>
          <small className="welcome-engine-telemetry telemetry-right">LATENCY 08 <i>MS</i><b /></small>
        </div>

        <div className="welcome-brand-phase">
          <span className="welcome-brand-halo"><i /><i /><i /></span>
          <div className="welcome-brand-lockup">
            <span className="welcome-brand-symbol"><img src="/favicon.svg" alt="" /><i>✦</i></span>
            <h1>Công Cụ Web</h1>
          </div>
          <p>PDF <i>•</i> {tx('Ảnh', 'Images')} <i>•</i> {tx('Văn phòng', 'Office')} <i>•</i> {tx('Tiện ích', 'Utilities')}</p>
        </div>

        <div className="welcome-signature-phase">
          <small>{tx('THIẾT KẾ & PHÁT TRIỂN BỞI', 'DESIGNED & DEVELOPED BY')}</small>
          <strong className="welcome-name" aria-label={creatorName}>
            {Array.from(creatorName).map((letter, index) => <i
              className={letter === ' ' ? 'space' : ''}
              style={{ '--letter-index': index }}
              aria-hidden="true"
              key={`${letter}-${index}`}
            >{letter === ' ' ? '\u00a0' : letter}</i>)}
          </strong>
          <span className="welcome-signature-line" />
          <p>{tx('Sáng tạo bằng tâm huyết · Phát triển cho trải nghiệm tốt hơn', 'Crafted with care · Built for a better experience')}</p>
          <em className="welcome-signature-code">DP / DIGITAL UTILITY SYSTEM / 2026</em>
        </div>

        <span className="welcome-flight-logo"><img src="/favicon.svg" alt="" /></span>
      </div>

      <div className="welcome-portal" aria-hidden="true"><span /><span /><i /></div>

      <div className="welcome-status" aria-hidden="true">
        <span className="status-file">{tx('Đang đọc cấu trúc tệp…', 'Reading file structure…')}</span>
        <span className="status-engine">{tx('Đang khởi động hệ công cụ…', 'Starting tool engines…')}</span>
        <span className="status-brand">{tx('Công Cụ Web đã sẵn sàng', 'Công Cụ Web is ready')}</span>
        <span className="status-home">{tx('Đang mở không gian làm việc…', 'Opening your workspace…')}</span>
      </div>
      <div className="welcome-loading" aria-hidden="true">
        <span />
      </div>
      <div className="welcome-meta">
        <span>{tx('Phiên bản', 'Version')} {appVersion} · {tx('Bản dựng', 'Build')} #{appBuildNumber}</span>
        <small>{tx('6,7 giây khởi tạo trải nghiệm', '6.7-second experience startup')}</small>
      </div>
      <div className="welcome-coordinates" aria-hidden="true"><span>10.8231° N</span><i>◆</i><span>106.6297° E</span></div>
      <span className="welcome-announcement" aria-live="polite">{tx('Công Cụ Web đang khởi tạo. Bạn có thể chọn Bỏ qua để vào trang chủ.', 'Công Cụ Web is starting. You can choose Skip to open the homepage.')}</span>
    </section>
  </div>
}

function ToolCard({ tool, open }) {
  const { language, tx } = useLanguage()
  const isReady = tool.ready !== false
  const [englishName, englishDescription] = englishTools[tool.mode] || [tool.name, tool.description]
  const name = language === 'en' ? englishName : tool.name
  const description = language === 'en' ? englishDescription : tool.description
  const prepare = () => { if (tool.mode.startsWith('pdf-')) warmPdfTools().catch(() => null) }
  return <button className="tool-card" onPointerEnter={prepare} onFocus={prepare} onTouchStart={prepare} onClick={() => { prepare(); open(tool.mode) }}>
    <span className={`tool-status ${isReady ? 'ready' : 'soon'}`}>{isReady ? tx('Sẵn sàng', 'Ready') : tx('Đang hoàn thiện', 'In development')}</span>
    <span className={`tool-icon ${tool.color}`}>{tool.icon}</span>
    <strong>{name}</strong>
    <small>{description}</small>
    <span className="tool-action">{isReady ? tx('Mở công cụ', 'Open tool') : tx('Xem thông tin', 'View details')} <b>→</b></span>
  </button>
}

function ToolSection({ title, eyebrow, description, tools, id, open, query }) {
  const { tx } = useLanguage()
  const visible = tools.filter(tool => {
    const english = englishTools[tool.mode]?.join(' ') || ''
    return `${tool.name} ${tool.description} ${english}`.toLowerCase().includes(query.toLowerCase())
  })
  return <section className="tool-section" id={id}>
    <div className="section-heading">
      <div><span>{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>
      <a href={`#${id}`}>{tx('Khám phá tất cả', 'Explore all')} <span>→</span></a>
    </div>
    <div className="tools-grid">{visible.map(tool => <ToolCard key={tool.name} tool={tool} open={open} />)}</div>
    {!visible.length && <p className="empty">{tx('Chưa tìm thấy công cụ phù hợp.', 'No matching tools found.')}</p>}
  </section>
}

function PdfCanvasPreview({ info }) {
  const { tx } = useLanguage()
  const canvasRef = useRef(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [rendering, setRendering] = useState(true)
  const [renderMode, setRenderMode] = useState('native')
  const [error, setError] = useState('')
  const previewUrl = `${info.url}#page=${pageNumber}&toolbar=0&navpanes=0&scrollbar=0&view=FitH`

  useEffect(() => { setPageNumber(1) }, [info.url])
  useEffect(() => {
    setRendering(true)
    setRenderMode('native')
    setError('')
    const fallbackTimer = setTimeout(() => setRenderMode(mode => mode === 'native' ? 'canvas' : mode), 1200)
    return () => clearTimeout(fallbackTimer)
  }, [previewUrl])
  useEffect(() => {
    if (renderMode !== 'canvas') return undefined
    let cancelled = false
    let loadingTask
    const renderPage = async () => {
      try {
        const pdfjs = await loadPdfJs()
        loadingTask = pdfjs.getDocument({ url: info.url })
        const pdf = await loadingTask.promise
        const page = await pdf.getPage(pageNumber)
        const viewport = page.getViewport({ scale: 1.35 })
        const canvas = canvasRef.current
        if (!canvas || cancelled) return
        const ratio = Math.min(globalThis.devicePixelRatio || 1, 2)
        canvas.width = Math.floor(viewport.width * ratio)
        canvas.height = Math.floor(viewport.height * ratio)
        canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`
        const context = canvas.getContext('2d')
        await page.render({ canvasContext: context, viewport, transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0] }).promise
      } finally {
        if (!cancelled) setRendering(false)
      }
    }
    renderPage().catch(() => {
      if (!cancelled) {
        setRendering(false)
        setError(tx('Không thể hiển thị trang PDF này trong preview.', 'This PDF page cannot be displayed in the preview.'))
      }
    })
    return () => { cancelled = true; loadingTask?.destroy?.() }
  }, [info.url, pageNumber, renderMode])

  return <div className="pdf-canvas-preview">
    <div className="pdf-page-canvas">
      {rendering && <span>{renderMode === 'canvas' ? tx('Đang dựng trang PDF…', 'Rendering PDF page…') : tx('Đang mở bản xem trước…', 'Opening preview…')}</span>}
      {error && <span>{error}</span>}
      <iframe className={renderMode === 'canvas' ? 'preview-hidden' : ''} key={previewUrl} src={previewUrl} title={`${tx('Xem trước trang', 'Preview page')} ${pageNumber}`} onLoad={() => {
        if (renderMode !== 'native') return
        setRenderMode('viewer')
        setRendering(false)
      }} />
      <canvas className={renderMode === 'canvas' ? '' : 'preview-hidden'} ref={canvasRef} />
    </div>
    <div className="pdf-page-controls"><button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber(page => page - 1)}>←</button><b>{tx('Trang', 'Page')} {pageNumber} / {info.pages}</b><button type="button" disabled={pageNumber >= info.pages} onClick={() => setPageNumber(page => page + 1)}>→</button></div>
  </div>
}

const pdfEditPresetPoints = {
  'top-left': { x: 8, y: 7 },
  'top-center': { x: 50, y: 7 },
  'top-right': { x: 92, y: 7 },
  center: { x: 50, y: 50 },
  'bottom-left': { x: 8, y: 93 },
  'bottom-center': { x: 50, y: 93 },
  'bottom-right': { x: 92, y: 93 },
}

function PdfEditPreview({ info, editType, text, position, setPosition, xPercent, setXPercent, yPercent, setYPercent, fontSize, color, opacity }) {
  const { tx } = useLanguage()
  const canvasRef = useRef(null)
  const stageRef = useRef(null)
  const dragging = useRef(false)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageRatio, setPageRatio] = useState(595 / 842)
  const [rendering, setRendering] = useState(true)
  const [error, setError] = useState('')
  const point = position === 'custom' ? { x: xPercent, y: yPercent } : (pdfEditPresetPoints[position] || pdfEditPresetPoints['bottom-center'])
  const label = editType === 'page-numbers'
    ? `${tx('Trang', 'Page')} ${pageNumber} / ${info.pages}`
    : (text || tx('Nội dung', 'Content')).replaceAll('{page}', String(pageNumber)).replaceAll('{pages}', String(info.pages))

  useEffect(() => { setPageNumber(1) }, [info.url])
  useEffect(() => {
    let cancelled = false
    let loadingTask
    let renderTask
    setRendering(true); setError('')
    const render = async () => {
      const pdfjs = await loadPdfJs()
      loadingTask = pdfjs.getDocument({ url: info.url })
      const pdf = await loadingTask.promise
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1.35 })
      const canvas = canvasRef.current
      if (!canvas || cancelled) return
      const ratio = Math.min(globalThis.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.floor(viewport.width * ratio))
      canvas.height = Math.max(1, Math.floor(viewport.height * ratio))
      setPageRatio(viewport.width / viewport.height)
      const context = canvas.getContext('2d', { alpha: false })
      renderTask = page.render({ canvasContext: context, viewport, background: '#fff', transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0] })
      await renderTask.promise
      page.cleanup?.()
    }
    render().catch(() => { if (!cancelled) setError(tx('Không thể dựng trang PDF để đặt nội dung.', 'The PDF page could not be rendered for content placement.')) })
      .finally(() => { if (!cancelled) setRendering(false) })
    return () => { cancelled = true; renderTask?.cancel?.(); loadingTask?.destroy?.() }
  }, [info.url, pageNumber])

  const moveToPointer = event => {
    const bounds = stageRef.current?.getBoundingClientRect()
    if (!bounds) return
    setPosition('custom')
    setXPercent(Math.round(clamp((event.clientX - bounds.left) / bounds.width * 100, 2, 98) * 10) / 10)
    setYPercent(Math.round(clamp((event.clientY - bounds.top) / bounds.height * 100, 2, 98) * 10) / 10)
  }

  return <div className="pdf-edit-preview">
    <div className="preview-label"><span>{tx('Đặt trực tiếp trên trang', 'Place directly on page')}</span><b>{tx('Kéo nội dung để di chuyển', 'Drag content to move it')}</b></div>
    <div className="pdf-edit-viewport">
      <div className="pdf-edit-stage" ref={stageRef} style={{ aspectRatio: pageRatio }} onPointerDown={event => {
        if (event.target.closest?.('.pdf-edit-overlay')) return
        dragging.current = true
        event.currentTarget.setPointerCapture?.(event.pointerId)
        moveToPointer(event)
      }} onPointerMove={event => { if (dragging.current) moveToPointer(event) }} onPointerUp={() => { dragging.current = false }} onPointerCancel={() => { dragging.current = false }}>
        {rendering && <span className="pdf-edit-status">{tx('Đang dựng trang PDF…', 'Rendering PDF page…')}</span>}
        {error && <span className="pdf-edit-status error">{error}</span>}
        <canvas ref={canvasRef} />
        <button type="button" className="pdf-edit-overlay" style={{ left: `${point.x}%`, top: `${point.y}%`, color, opacity: opacity / 100, fontSize: `${clamp(fontSize * 0.9, 9, 44)}px` }} onPointerDown={event => {
          dragging.current = true
          event.currentTarget.setPointerCapture?.(event.pointerId)
          moveToPointer(event)
        }} onPointerMove={event => { if (dragging.current) moveToPointer(event) }} onPointerUp={() => { dragging.current = false }} onPointerCancel={() => { dragging.current = false }} title={tx('Giữ và kéo để đổi vị trí', 'Hold and drag to reposition')}>{label}</button>
      </div>
    </div>
    <div className="pdf-page-controls"><button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber(page => page - 1)}>←</button><b>{tx('Trang', 'Page')} {pageNumber} / {info.pages}</b><button type="button" disabled={pageNumber >= info.pages} onClick={() => setPageNumber(page => page + 1)}>→</button></div>
    <p className="pdf-edit-help">{tx('Preview dùng để đặt vị trí. PDF kết quả sẽ giữ nguyên nội dung gốc và thêm một lớp chữ mới lên trên.', 'The preview is used for placement. The output PDF keeps the original content and adds a new text layer on top.')}</p>
  </div>
}

function PdfPageThumbnail({ item, info, number, selected, mode, onSelect, onDropPage, onDragPage, onDelete, onInsert }) {
  const { tx } = useLanguage()
  const canvasRef = useRef(null)
  const [rendering, setRendering] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    let renderTask
    const render = async () => {
      setRendering(true); setError(false)
      try {
        const pdf = await loadThumbnailPdf(info.url)
        const page = await pdf.getPage(item.pageIndex + 1)
        const base = page.getViewport({ scale: 1, rotation: page.rotate + item.rotation })
        const scale = Math.min(0.42, 210 / Math.max(base.width, 1))
        const viewport = page.getViewport({ scale, rotation: page.rotate + item.rotation })
        const canvas = canvasRef.current
        if (!canvas || cancelled) return
        const ratio = Math.min(globalThis.devicePixelRatio || 1, 2)
        canvas.width = Math.max(1, Math.floor(viewport.width * ratio))
        canvas.height = Math.max(1, Math.floor(viewport.height * ratio))
        canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`
        const context = canvas.getContext('2d', { alpha: false })
        renderTask = page.render({ canvasContext: context, viewport, background: '#fff', transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0] })
        await renderTask.promise
      } catch (renderError) { if (!cancelled) setError(true) }
      finally { if (!cancelled) setRendering(false) }
    }
    render()
    return () => { cancelled = true; renderTask?.cancel?.() }
  }, [info.url, item.pageIndex, item.rotation])

  const pageLabel = info.pages > 1 ? `${info.name} · ${tx('trang', 'page')} ${item.pageIndex + 1}` : info.name
  const canEditPages = mode === 'pdf-merge' || mode === 'pdf-organize'
  return <article className={`pdf-page-card ${selected ? 'selected' : ''}`} draggable onDragStart={() => onDragPage(item.id)} onDragOver={event => event.preventDefault()} onDrop={() => onDropPage(item.id)}>
    <button className="page-check" type="button" aria-label={`${selected ? tx('Bỏ chọn', 'Deselect') : tx('Chọn', 'Select')} ${tx('trang', 'page')} ${number}`} aria-pressed={selected} onClick={() => onSelect(item.id)}>{selected ? '✓' : ''}</button>
    <button className="page-thumbnail" type="button" onClick={() => onSelect(item.id)}>
      <span className="page-paper">{rendering && <i>{tx('Đang tải…', 'Loading…')}</i>}{error && <i>{tx('Không thể xem', 'Preview unavailable')}</i>}<canvas ref={canvasRef} /></span>
      <span className="page-name" title={pageLabel}>{pageLabel}</span>
      <small>{tx('Trang', 'Page')} {number}</small>
    </button>
    {canEditPages && <button className="page-delete" type="button" aria-label={`${tx('Xóa trang', 'Delete page')} ${number}`} onClick={() => onDelete(item.id)}>×</button>}
    {canEditPages && <label className="page-insert"><input type="file" accept=".pdf,application/pdf" multiple aria-label={`${tx('Chèn PDF sau trang', 'Insert PDF after page')} ${number}`} onChange={event => { onInsert(event.target.files, number); event.target.value = '' }} /><span>+</span></label>}
  </article>
}

function PdfPageBoard({ mode, pages, fileInfo, selectedPages, setSelectedPages, setPages, onAddFiles }) {
  const { tx } = useLanguage()
  const draggedPage = useRef(null)
  const selectedCount = selectedPages.size
  const allSelected = pages.length > 0 && selectedCount === pages.length
  const isMerge = mode === 'pdf-merge'
  const isOrganize = mode === 'pdf-organize'
  const canEditPages = isMerge || isOrganize

  const selectAll = () => setSelectedPages(allSelected ? new Set() : new Set(pages.map(page => page.id)))
  const selectPreset = preset => {
    if (preset === 'all') return setSelectedPages(new Set(pages.map(page => page.id)))
    setSelectedPages(new Set(pages.filter(page => (page.pageIndex + 1) % 2 === (preset === 'odd' ? 1 : 0)).map(page => page.id)))
  }
  const rotateSelected = delta => {
    if (!selectedCount) return
    setPages(current => current.map(page => selectedPages.has(page.id) ? { ...page, rotation: (page.rotation + delta + 360) % 360 } : page))
  }
  const deletePages = ids => {
    setPages(current => {
      if (ids.size >= current.length) return current
      return current.filter(page => !ids.has(page.id))
    })
    if (ids.size < pages.length) setSelectedPages(current => new Set([...current].filter(id => !ids.has(id))))
  }
  const moveSelected = direction => {
    if (!selectedCount) return
    setPages(current => {
      const next = [...current]
      const indexes = direction < 0 ? [...next.keys()] : [...next.keys()].reverse()
      indexes.forEach(index => {
        if (!selectedPages.has(next[index]?.id)) return
        const target = index + direction
        if (target < 0 || target >= next.length || selectedPages.has(next[target]?.id)) return
        ;[next[index], next[target]] = [next[target], next[index]]
      })
      return next
    })
  }
  const duplicateSelected = () => {
    if (!selectedCount) return
    setPages(current => current.flatMap(page => selectedPages.has(page.id)
      ? [page, { ...page, id: `pdf-page-${++pdfPageId}` }]
      : [page]))
  }
  const dropPage = targetId => {
    const sourceId = draggedPage.current
    if (!sourceId || sourceId === targetId) return
    setPages(current => {
      const next = [...current]
      const from = next.findIndex(page => page.id === sourceId)
      const to = next.findIndex(page => page.id === targetId)
      if (from < 0 || to < 0) return current
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    draggedPage.current = null
  }

  return <section className="pdf-page-board">
    <div className="page-board-toolbar">
      <label className="select-all-pages"><input type="checkbox" checked={allSelected} onChange={selectAll} /><span>{allSelected ? tx('Bỏ chọn tất cả', 'Deselect all') : tx('Chọn tất cả', 'Select all')}</span></label>
      <span className="selection-count"><b>{selectedCount}</b> / {pages.length} {tx('trang được chọn', 'pages selected')}</span>
      <div className="page-actions">
        {canEditPages && <label className="add-pages-button"><input type="file" accept=".pdf,application/pdf" multiple aria-label={tx('Thêm PDF vào cuối', 'Add PDF at the end')} onChange={event => { onAddFiles(event.target.files, pages.length); event.target.value = '' }} /><span>＋ {tx('Thêm PDF', 'Add PDF')}</span></label>}
        {!canEditPages && <><button type="button" onClick={() => selectPreset('all')}>{tx('Tất cả', 'All')}</button><button type="button" onClick={() => selectPreset('odd')}>{tx('Trang lẻ', 'Odd pages')}</button><button type="button" onClick={() => selectPreset('even')}>{tx('Trang chẵn', 'Even pages')}</button></>}
        <button type="button" disabled={!selectedCount} onClick={() => rotateSelected(-90)} aria-label={tx('Xoay trái các trang đã chọn', 'Rotate selected pages left')}>↶ {tx('Xoay trái', 'Rotate left')}</button>
        <button type="button" disabled={!selectedCount} onClick={() => rotateSelected(90)} aria-label={tx('Xoay phải các trang đã chọn', 'Rotate selected pages right')}>↷ {tx('Xoay phải', 'Rotate right')}</button>
        {canEditPages && <><button type="button" disabled={!selectedCount} onClick={() => moveSelected(-1)}>← {tx('Dịch trái', 'Move left')}</button><button type="button" disabled={!selectedCount} onClick={() => moveSelected(1)}>{tx('Dịch phải', 'Move right')} →</button><button type="button" disabled={!selectedCount} onClick={duplicateSelected}>{tx('Nhân bản', 'Duplicate')}</button><button type="button" disabled={pages.length < 2} onClick={() => setPages(current => [...current].reverse())}>{tx('Đảo thứ tự', 'Reverse order')}</button><button className="danger" type="button" disabled={!selectedCount || selectedCount === pages.length} onClick={() => deletePages(selectedPages)}>{tx('Xóa', 'Delete')}</button></>}
      </div>
    </div>
    <div className="page-board-tip"><span>{canEditPages ? tx('Giữ và kéo thumbnail để đổi thứ tự trang.', 'Hold and drag thumbnails to reorder pages.') : tx('Nhấp vào từng thumbnail để chọn trang cần tách.', 'Click thumbnails to select pages to split.')}</span><b>{canEditPages ? (isOrganize ? tx('Có thể xoay, nhân bản, thêm hoặc xóa trang trước khi lưu.', 'Rotate, duplicate, add or delete pages before saving.') : tx('PDF kết quả theo thứ tự từ trái sang phải.', 'The output PDF follows the left-to-right order.')) : tx('Mỗi trang đã chọn sẽ được xuất thành một PDF trong tệp ZIP.', 'Each selected page is exported as a PDF inside a ZIP file.')}</b></div>
    <div className="page-thumbnail-grid">
      {pages.map((item, index) => <PdfPageThumbnail key={item.id} item={item} info={fileInfo[item.fileIndex]} number={index + 1} selected={selectedPages.has(item.id)} mode={mode} onSelect={id => setSelectedPages(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })} onDragPage={id => { draggedPage.current = id }} onDropPage={dropPage} onDelete={id => deletePages(new Set([id]))} onInsert={onAddFiles} />)}
      {canEditPages && <label className="add-pdf-tile"><input type="file" accept=".pdf,application/pdf" multiple aria-label={tx('Thêm PDF vào cuối tài liệu', 'Add PDF at the end of the document')} onChange={event => { onAddFiles(event.target.files, pages.length); event.target.value = '' }} /><i>＋</i><b>{tx('Thêm PDF', 'Add PDF')}</b><small>{tx('Chèn thêm trang vào tài liệu', 'Insert more pages into the document')}</small></label>}
    </div>
  </section>
}

function MediaPreview({ info, title, checkerboard = false, imageStyle }) {
  const { locale, tx } = useLanguage()
  if (!info) return null
  return <div className={`media-preview ${checkerboard ? 'checkerboard' : ''}`}>
    <div className="preview-label"><span>{title}</span><b>{formatBytes(info.size)}</b></div>
    {info.kind === 'image' && <img src={info.url} alt={title} style={imageStyle} />}
    {info.kind === 'pdf' && <PdfCanvasPreview info={info} />}
    {info.kind === 'archive' && <div className="archive-preview"><i>ZIP</i><strong>{tx('Kết quả đã sẵn sàng', 'Your result is ready')}</strong><small>{tx('Các trang PDF được đóng gói trong một tệp ZIP.', 'PDF pages are packaged in one ZIP file.')}</small></div>}
    {info.kind === 'document' && <div className="document-preview"><i>{info.extension?.toUpperCase()}</i><strong>{info.outputLabel || tx('Tệp đã sẵn sàng', 'File ready')}</strong>{info.pages && <small>{info.pages} {tx('trang', 'pages')} · {Number(info.characters || 0).toLocaleString(locale)} {tx('ký tự được trích xuất', 'characters extracted')}</small>}{info.previewText && <pre>{info.previewText}</pre>}</div>}
  </div>
}

function FileFacts({ info }) {
  const { tx } = useLanguage()
  if (!info) return null
  return <div className="file-facts">
    <span><small>{tx('Dung lượng', 'File size')}</small><b>{formatBytes(info.size)}</b></span>
    {info.width && <span><small>{tx('Kích thước', 'Dimensions')}</small><b>{info.width} × {info.height} px</b></span>}
    {info.pages && <span><small>{tx('Số trang', 'Pages')}</small><b>{info.pages} {tx('trang', 'pages')}</b></span>}
    <span><small>{tx('Định dạng', 'Format')}</small><b>{info.extension?.toUpperCase() || tx('Tệp', 'File')}</b></span>
  </div>
}

function RangeControl({ label, value, setValue, min, max, step = 1, suffix = '' }) {
  return <div className="adjustment-row"><div className="range-label"><span>{label}</span><b>{value}{suffix}</b></div><input type="range" min={min} max={max} step={step} value={value} onChange={event => setValue(Number(event.target.value))} /></div>
}

function CropPreview({ info, crop, setCrop, cropStageRef }) {
  const { tx } = useLanguage()
  const drag = useRef(null)
  const pixels = info ? {
    left: Math.round(info.width * crop.x / 100),
    top: Math.round(info.height * crop.y / 100),
    width: Math.round(info.width * crop.w / 100),
    height: Math.round(info.height * crop.h / 100),
  } : null

  const begin = event => {
    event.preventDefault()
    const handle = event.target.dataset.handle || 'move'
    drag.current = { handle, x: event.clientX, y: event.clientY, crop: { ...crop } }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const move = event => {
    if (!drag.current || !cropStageRef.current) return
    const bounds = cropStageRef.current.getBoundingClientRect()
    const dx = (event.clientX - drag.current.x) / bounds.width * 100
    const dy = (event.clientY - drag.current.y) / bounds.height * 100
    const original = drag.current.crop
    const min = 8
    let next = { ...original }
    if (drag.current.handle === 'move') {
      next.x = clamp(original.x + dx, 0, 100 - original.w)
      next.y = clamp(original.y + dy, 0, 100 - original.h)
    } else {
      if (drag.current.handle.includes('e')) next.w = clamp(original.w + dx, min, 100 - original.x)
      if (drag.current.handle.includes('s')) next.h = clamp(original.h + dy, min, 100 - original.y)
      if (drag.current.handle.includes('w')) {
        next.x = clamp(original.x + dx, 0, original.x + original.w - min)
        next.w = original.w + original.x - next.x
      }
      if (drag.current.handle.includes('n')) {
        next.y = clamp(original.y + dy, 0, original.y + original.h - min)
        next.h = original.h + original.y - next.y
      }
    }
    setCrop(next)
  }
  const applyRatio = ratio => {
    if (!info || ratio === 'free') return setCrop({ x: 10, y: 10, w: 80, h: 80 })
    const imageRatio = info.width / info.height
    let w = 76
    let h = w * imageRatio / ratio
    if (h > 82) { h = 82; w = h * ratio / imageRatio }
    setCrop({ x: (100 - w) / 2, y: (100 - h) / 2, w, h })
  }

  return <div className="crop-workspace">
    <div className="crop-toolbar">
      <span>{tx('Tỷ lệ khung', 'Aspect ratio')}</span>
      <button type="button" onClick={() => applyRatio('free')}>{tx('Tự do', 'Free')}</button>
      <button type="button" onClick={() => applyRatio(1)}>1:1</button>
      <button type="button" onClick={() => applyRatio(4 / 3)}>4:3</button>
      <button type="button" onClick={() => applyRatio(16 / 9)}>16:9</button>
    </div>
    <div className="crop-viewport">
      <div className="crop-canvas" ref={cropStageRef}>
        <img src={info.url} alt={tx('Ảnh đang cắt', 'Image being cropped')} draggable="false" />
        <div className="crop-box" style={{ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.w}%`, height: `${crop.h}%` }} onPointerDown={begin} onPointerMove={move} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}>
          <span className="crop-grid vertical one" /><span className="crop-grid vertical two" /><span className="crop-grid horizontal one" /><span className="crop-grid horizontal two" />
          {['nw', 'ne', 'sw', 'se'].map(handle => <i key={handle} className={`crop-handle ${handle}`} data-handle={handle} />)}
          <b>{pixels?.width} × {pixels?.height}</b>
        </div>
      </div>
    </div>
    <p className="crop-help">{tx('Kéo bên trong khung để di chuyển · Kéo bốn góc để thu phóng', 'Drag inside the frame to move · Drag the corners to resize')}</p>
  </div>
}

function ToolModal({ mode, close }) {
  const { language, locale, tx } = useLanguage()
  const [files, setFiles] = useState([])
  const [fileInfo, setFileInfo] = useState([])
  const [format, setFormat] = useState('webp')
  const [quality, setQuality] = useState(82)
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [lockRatio, setLockRatio] = useState(true)
  const [crop, setCrop] = useState({ x: 10, y: 10, w: 80, h: 80 })
  const [backgroundQuality, setBackgroundQuality] = useState('balanced')
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [saturation, setSaturation] = useState(100)
  const [hue, setHue] = useState(0)
  const [blur, setBlur] = useState(0)
  const [rotation, setRotation] = useState(0)
  const [flip, setFlip] = useState(false)
  const [flop, setFlop] = useState(false)
  const [grayscale, setGrayscale] = useState(false)
  const [pdfCompression, setPdfCompression] = useState('target')
  const [pdfContentProfile, setPdfContentProfile] = useState('document')
  const [targetMb, setTargetMb] = useState('4')
  const [wordMode, setWordMode] = useState('editable')
  const [pdfEditType, setPdfEditType] = useState('text')
  const [pdfEditText, setPdfEditText] = useState('PDFTools')
  const [pdfEditPages, setPdfEditPages] = useState('')
  const [pdfEditPosition, setPdfEditPosition] = useState('bottom-center')
  const [pdfEditX, setPdfEditX] = useState(50)
  const [pdfEditY, setPdfEditY] = useState(88)
  const [pdfEditFontSize, setPdfEditFontSize] = useState(16)
  const [pdfEditColor, setPdfEditColor] = useState('#4f46e5')
  const [pdfEditOpacity, setPdfEditOpacity] = useState(75)
  const [pdfTextPreview, setPdfTextPreview] = useState('')
  const [pdfDiagnosis, setPdfDiagnosis] = useState(null)
  const [pdfPages, setPdfPages] = useState([])
  const [selectedPages, setSelectedPages] = useState(new Set())
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const input = useRef(null)
  const cropStageRef = useRef(null)
  const urlPool = useRef(new Set())
  const isImage = imageModes.includes(mode)
  const isMerge = mode === 'pdf-merge'
  const isOrganize = mode === 'pdf-organize'
  const isPageComposer = isMerge || isOrganize
  const isPdf = mode?.startsWith('pdf-')
  const isPdfOffice = pdfOfficeModes.includes(mode)
  const maximumSelectedFileBytes = mode === 'pdf-compress' ? maximumPdfCompressionFileBytes : maximumFileBytes
  const maximumSelectedFileMb = maximumSelectedFileBytes / 1024 / 1024
  const fileAccept = mode === 'remove-background'
    ? '.png,.jpg,.jpeg,.webp'
    : isImage ? '.png,.jpg,.jpeg,.webp,.avif,image/png,image/jpeg,image/webp,image/avif' : '.pdf,application/pdf'

  // Giải phóng tất cả PDF task và URL object khi modal unmount
  useEffect(() => () => {
    urlPool.current.forEach(url => { releaseThumbnailPdf(url); URL.revokeObjectURL(url) })
    // Xóa toàn bộ thumbnail cache khi đóng modal để giải phóng bộ nhớ
    thumbnailPdfCache.forEach((_entry, url) => releaseThumbnailPdf(url))
  }, [])
  useEffect(() => () => {
    if (result?.url) {
      URL.revokeObjectURL(result.url)
      urlPool.current.delete(result.url)
    }
  }, [result?.url])
  const makeUrl = blob => { const url = URL.createObjectURL(blob); urlPool.current.add(url); return url }

  const analyze = async (blob, name = blob.name || tx('kết-quả', 'result')) => {
    const url = makeUrl(blob)
    const extension = name.split('.').pop() || ''
    if (blob.type.startsWith('image/')) {
      const bitmap = await createImageBitmap(blob)
      const info = { url, name, size: blob.size, type: blob.type, kind: 'image', width: bitmap.width, height: bitmap.height, extension }
      bitmap.close()
      return info
    }
    if (blob.type === 'application/pdf' || extension.toLowerCase() === 'pdf') {
      const { PDFDocument } = await import('pdf-lib')
      const pdf = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false })
      return { url, name, size: blob.size, type: 'application/pdf', kind: 'pdf', pages: pdf.getPageCount(), extension: 'pdf' }
    }
    if (['docx', 'xlsx', 'pptx', 'txt'].includes(extension.toLowerCase())) {
      const previewText = extension.toLowerCase() === 'txt' ? (await blob.text()).slice(0, 5000) : ''
      return { url, name, size: blob.size, type: blob.type, kind: 'document', extension: extension.toLowerCase(), previewText }
    }
    return { url, name, size: blob.size, type: blob.type, kind: 'archive', extension }
  }

  const choose = async selected => {
    const picked = Array.from(selected || [])
    if (!picked.length) return
    const nextFiles = isPageComposer ? picked : picked.slice(0, 1)
    if (nextFiles.some(file => file.size > maximumSelectedFileBytes)) return setMessage(tx(`Mỗi tệp không được vượt quá ${maximumSelectedFileMb} MB.`, `Each file must be ${maximumSelectedFileMb} MB or smaller.`))
    if (nextFiles.reduce((sum, file) => sum + file.size, 0) > maximumUploadBytes) return setMessage(tx('Tổng dung lượng mỗi lượt không được vượt quá 50 MB.', 'The total size per operation must not exceed 50 MB.'))
    setLoading(true); setMessage(tx('Đang đọc thông tin tệp…', 'Reading file information…')); setResult(null)
    try {
      let extractedPreview = ''
      const nextInfo = await Promise.all(nextFiles.map(file => analyze(file)))
      if (isPageComposer && nextInfo.reduce((sum, info) => sum + (info.pages || 0), 0) > maximumPdfPages) throw new Error(tx(`Mỗi lượt chỉ xử lý tối đa ${maximumPdfPages} trang PDF.`, `Each operation supports up to ${maximumPdfPages} PDF pages.`))
      setFiles(nextFiles); setFileInfo(nextInfo); setCrop({ x: 10, y: 10, w: 80, h: 80 })
      setBrightness(100); setContrast(100); setSaturation(100); setHue(0); setBlur(0); setRotation(0); setFlip(false); setFlop(false); setGrayscale(false)
      if (isPdfOffice) {
        setMessage(tx('Đang đọc trước phần văn bản có thể chuyển đổi…', 'Scanning selectable text for conversion…'))
        const diagnosis = await readPdfTextPreview(nextFiles[0])
        extractedPreview = diagnosis.text
        setPdfTextPreview(extractedPreview)
        setPdfDiagnosis(diagnosis)
      } else {
        setPdfTextPreview('')
        setPdfDiagnosis(null)
      }
      if (nextInfo[0]?.width) { setWidth(String(nextInfo[0].width)); setHeight(String(nextInfo[0].height)) }
      if (isPageComposer || mode === 'pdf-split') {
        const nextPages = makePageItems(nextInfo)
        setPdfPages(nextPages)
        setSelectedPages(mode === 'pdf-split' ? new Set(nextPages.map(page => page.id)) : new Set())
      }
      if (mode === 'pdf-compress' && nextInfo[0]?.size) {
        const sourceMb = nextInfo[0].size / 1024 / 1024
        const suggestedMb = Math.max(0.15, Math.floor(sourceMb * 0.6 * 10) / 10)
        setTargetMb(String(Math.min(suggestedMb, Math.max(0.1, sourceMb - 0.1)).toFixed(1)))
      }
      setMessage(isPdfOffice && !extractedPreview
        ? tx('Không thấy chữ có thể chọn. PDF scan cần OCR trước khi tạo Word có thể chỉnh sửa.', 'No selectable text was found. Scanned PDFs need OCR before an editable Word file can be created.')
        : '')
    } catch (error) {
      // Nếu user đang dùng EN và server trả message tiếng Việt, hiển thị fallback tiếng Anh
      setMessage(language === 'en' && containsVietnamese(error.message)
        ? 'Unable to read this file. Please check its format and limits.'
        : (error.message || tx('Không thể đọc tệp này.', 'Unable to read this file.')))
    }
    finally { setLoading(false) }
  }

  const addMergeFiles = async (selected, insertionIndex = pdfPages.length) => {
    const picked = Array.from(selected || [])
    if (!picked.length) return
    if (picked.some(file => file.size > maximumFileBytes)) return setMessage(tx('Mỗi tệp không được vượt quá 25 MB.', 'Each file must be 25 MB or smaller.'))
    if ([...files, ...picked].reduce((sum, file) => sum + file.size, 0) > maximumUploadBytes) return setMessage(tx('Tổng dung lượng các PDF không được vượt quá 50 MB.', 'The combined PDF size must not exceed 50 MB.'))
    setLoading(true); setMessage(tx('Đang thêm và dựng thumbnail PDF…', 'Adding PDFs and rendering thumbnails…')); setResult(null)
    try {
      const addedInfo = await Promise.all(picked.map(file => analyze(file)))
      const firstFileIndex = files.length
      const addedPages = makePageItems(addedInfo, firstFileIndex)
      if (pdfPages.length + addedPages.length > maximumPdfPages) throw new Error(tx(`Mỗi lượt chỉ xử lý tối đa ${maximumPdfPages} trang PDF.`, `Each operation supports up to ${maximumPdfPages} PDF pages.`))
      const insertion = clamp(insertionIndex, 0, pdfPages.length)
      setFiles(current => [...current, ...picked])
      setFileInfo(current => [...current, ...addedInfo])
      setPdfPages(current => [...current.slice(0, insertion), ...addedPages, ...current.slice(insertion)])
      setMessage(tx(`Đã thêm ${addedPages.length} trang. Kéo thumbnail để sắp xếp lại.`, `Added ${addedPages.length} pages. Drag thumbnails to reorder them.`))
    } catch (error) { setMessage(error.message || tx('Không thể thêm PDF này.', 'Unable to add this PDF.')) }
    finally { setLoading(false) }
  }

  const resizeValue = (field, value) => {
    const info = fileInfo[0]
    if (field === 'width') {
      setWidth(value)
      if (lockRatio && info?.width && value) setHeight(String(Math.max(1, Math.round(Number(value) * info.height / info.width))))
    } else {
      setHeight(value)
      if (lockRatio && info?.height && value) setWidth(String(Math.max(1, Math.round(Number(value) * info.width / info.height))))
    }
  }

  // Nhận cặp (vi, en) để hiển thị đúng ngôn ngữ người dùng đang dùng
  const reportProgress = (vietnamese, english) => setMessage(tx(vietnamese, english || vietnamese))

  const submit = async event => {
    event.preventDefault()
    if (!files.length) return setMessage(tx('Hãy chọn tệp trước khi xử lý.', 'Choose a file before processing.'))
    if (isPageComposer && !pdfPages.length) return setMessage(tx('Tài liệu phải còn ít nhất một trang.', 'The document must contain at least one page.'))
    if (mode === 'pdf-split' && !selectedPages.size) return setMessage(tx('Hãy chọn ít nhất một trang cần tách.', 'Select at least one page to split.'))
    if (mode === 'pdf-edit' && pdfEditType === 'text' && !pdfEditText.trim()) return setMessage(tx('Hãy nhập nội dung cần thêm vào PDF.', 'Enter the content to add to the PDF.'))
    setLoading(true); setMessage(tx('Đang xử lý tệp…', 'Processing file…')); setResult(null)
    try {
      let blob, name, outputMetadata = {}
      if (mode === 'pdf-to-word' && wordMode === 'exact') {
        const exactWord = await createExactWordFromPdf(files[0], reportProgress)
        blob = exactWord.blob
        name = `${files[0].name.replace(/\.[^/.]+$/, '')}-${tx('giu-vi-tri-tung-dong', 'line-positioned')}.docx`
        outputMetadata = {
          pages: exactWord.pages,
          pdfSourceKind: pdfDiagnosis?.sourceKind,
          pdfSignatures: pdfDiagnosis?.signatureCount || 0,
          wordLayoutMode: 'exact-text-boxes',
          wordTextBoxes: exactWord.textBoxes,
          exactDpi: exactWord.dpi,
          exactImageFormats: exactWord.imageFormats,
        }
      } else if (mode === 'remove-background') {
        setMessage(tx('Đang chuẩn bị AI xóa phông…', 'Preparing background removal AI…'))
        const { removeBackground } = await import('@imgly/background-removal')
        const options = {
          model: backgroundQuality === 'high' ? 'isnet_fp16' : 'isnet_quint8',
          output: { format: 'image/png', quality: .95, type: 'foreground' },
          progress: (_key, current, total) => total && setMessage(tx(`Đang tải mô hình AI: ${Math.round(current / total * 100)}%…`, `Downloading AI model: ${Math.round(current / total * 100)}%…`)),
        }
        const run = device => removeBackground(files[0], { ...options, device })
        try { blob = await run(globalThis.navigator?.gpu ? 'gpu' : 'cpu') }
        catch (gpuError) { if (!globalThis.navigator?.gpu) throw gpuError; setMessage(tx('GPU không khả dụng, đang chuyển sang CPU…', 'GPU is unavailable; switching to CPU…')); blob = await run('cpu') }
        name = `${files[0].name.replace(/\.[^/.]+$/, '')}-no-background.png`
      } else if (mode === 'pdf-compress' && pdfCompression === 'target') {
        const compressed = await compressPdfToTarget(files[0], targetMb, pdfContentProfile, reportProgress)
        blob = compressed.blob
        outputMetadata = { compression: compressed.compression }
        name = `${files[0].name.replace(/\.[^/.]+$/, '')}-under-${String(targetMb).replace('.', '-')}-mb.pdf`
      } else {
        const form = new FormData()
        if (isPageComposer) {
          const activeFileIndexes = [...new Set(pdfPages.map(page => page.fileIndex))]
          const fileIndexMap = new Map(activeFileIndexes.map((fileIndex, nextIndex) => [fileIndex, nextIndex]))
          activeFileIndexes.forEach(fileIndex => form.append('files', files[fileIndex]))
          form.append('pagePlan', JSON.stringify(pdfPages.map(page => ({ fileIndex: fileIndexMap.get(page.fileIndex), pageIndex: page.pageIndex, rotation: page.rotation }))))
        } else form.append('file', files[0])
        if (isImage) {
          const info = fileInfo[0]
          const cropValues = mode === 'crop' && info ? {
            left: Math.round(info.width * crop.x / 100), top: Math.round(info.height * crop.y / 100),
            cropWidth: Math.round(info.width * crop.w / 100), cropHeight: Math.round(info.height * crop.h / 100),
          } : {}
          Object.entries({ format, quality, width, height, ...cropValues, brightness, contrast, saturation, hue, blur, rotation, flip, flop, grayscale }).forEach(([key, value]) => form.append(key, value))
        }
        if (mode === 'pdf-compress') form.append('level', 'balanced')
        if (mode === 'pdf-edit') {
          Object.entries({ editType: pdfEditType, text: pdfEditText, pages: pdfEditPages, position: pdfEditPosition, xPercent: pdfEditX, yPercent: pdfEditY, fontSize: pdfEditFontSize, color: pdfEditColor, opacity: pdfEditOpacity / 100 }).forEach(([key, value]) => form.append(key, value))
        }
        if (mode === 'pdf-split') {
          const chosenPages = pdfPages.filter(page => selectedPages.has(page.id))
          form.append('pages', chosenPages.map(page => page.pageIndex + 1).join(','))
          form.append('pagePlan', JSON.stringify(chosenPages.map(page => ({ pageIndex: page.pageIndex, rotation: page.rotation }))))
        }
        const url = isImage ? `/api/tools/image/${mode}` : `/api/tools/pdf/${mode.replace('pdf-', '')}`
        const response = await fetch(url, { method: 'POST', body: form })
        if (!response.ok) {
          const serverMessage = (await response.json().catch(() => ({}))).message
          throw new Error(language === 'en' ? 'The server could not process this file. Check the format, size and page limits.' : (serverMessage || 'Không thể xử lý tệp.'))
        }
        blob = await response.blob()
        const disposition = response.headers.get('content-disposition') || ''
        name = /filename="?([^";]+)"?/i.exec(disposition)?.[1] || `pdftools-result.${blob.type.includes('pdf') ? 'pdf' : blob.type.includes('zip') ? 'zip' : format}`
        outputMetadata = {
          pages: Number(response.headers.get('x-extracted-pages')) || undefined,
          characters: Number(response.headers.get('x-extracted-characters')) || undefined,
          savedBytes: Number(response.headers.get('x-compression-saved-bytes')) || 0,
          compressionMode: response.headers.get('x-compression-mode') || undefined,
          pdfSourceKind: response.headers.get('x-pdf-source-kind') || undefined,
          pdfTextPages: Number(response.headers.get('x-pdf-text-pages')) || undefined,
          pdfImageOnlyPages: Number(response.headers.get('x-pdf-image-only-pages')) || 0,
          pdfSignatures: Number(response.headers.get('x-pdf-signatures')) || 0,
          wordLayoutMode: response.headers.get('x-word-layout-mode') || undefined,
          wordDetectedTables: Number(response.headers.get('x-word-detected-tables')) || 0,
          wordEmbeddedGraphics: Number(response.headers.get('x-word-embedded-graphics')) || 0,
          editPosition: response.headers.get('x-pdf-edit-position') || undefined,
        }
      }
      const output = await analyze(blob, name)
      setResult({ ...output, ...outputMetadata, previewText: output.previewText || (isPdfOffice ? pdfTextPreview : ''), outputLabel: mode === 'pdf-to-word' && wordMode === 'exact' ? tx('Word giữ vị trí từng dòng đã sẵn sàng', 'Line-positioned Word file is ready') : mode === 'pdf-to-word' ? tx('Word có cấu trúc và đồ họa đã sẵn sàng', 'Structured Word file with graphics is ready') : isPdfOffice ? tx('Tệp Office có thể chỉnh sửa đã sẵn sàng', 'Editable Office file is ready') : undefined, blob })
      if (mode === 'pdf-compress' && pdfCompression === 'target') {
        const targetBytes = Number(targetMb) * 1024 * 1024
        const proximity = Math.max(0, (targetBytes - blob.size) / targetBytes * 100)
        const { minimumDpi, maximumDpi } = outputMetadata.compression
        const dpiLabel = minimumDpi === maximumDpi ? `${minimumDpi} DPI` : `${minimumDpi}–${maximumDpi} DPI`
        setMessage(tx(`Xử lý hoàn tất — thấp hơn mục tiêu ${proximity.toFixed(1)}%, độ nét ${dpiLabel}. Hãy xem preview trước khi tải.`, `Complete — ${proximity.toFixed(1)}% below the limit at ${dpiLabel}. Review the preview before downloading.`))
      } else if (mode === 'pdf-compress' && pdfCompression === 'preserve') {
        setMessage(outputMetadata.savedBytes > 0
          ? tx(`Tối ưu không mất dữ liệu hoàn tất — giữ nguyên chữ, liên kết và biểu mẫu; giảm ${formatBytes(outputMetadata.savedBytes)}.`, `Lossless optimization complete — text, links and forms were preserved; saved ${formatBytes(outputMetadata.savedBytes)}.`)
          : tx('Tối ưu không mất dữ liệu hoàn tất — PDF gốc đã có cấu trúc tốt nên không thể giảm thêm mà vẫn giữ nguyên chữ, liên kết và biểu mẫu. Muốn giảm rõ rệt, hãy chọn “Đạt dung lượng mục tiêu”.', 'Lossless optimization complete — the PDF was already well optimized, so it could not be made smaller while preserving text, links and forms. Choose “Target file size” for a larger reduction.'))
      } else if (mode === 'pdf-to-word' && wordMode === 'exact') {
        const signatureNotice = outputMetadata.pdfSignatures ? tx(`, gồm phần hiển thị của ${outputMetadata.pdfSignatures} chữ ký số`, `, including the visible appearance of ${outputMetadata.pdfSignatures} digital signatures`) : ''
        setMessage(tx(`Chuyển đổi hoàn tất — ${outputMetadata.wordTextBoxes.toLocaleString(locale)} khối chữ đã được đặt theo vị trí trên ${outputMetadata.pages} trang${signatureNotice}. Đây là chế độ dự phòng; Word có cấu trúc thường dễ sửa và ổn định hơn.`, `Conversion complete — ${outputMetadata.wordTextBoxes.toLocaleString(locale)} text boxes were positioned across ${outputMetadata.pages} pages${signatureNotice}. This is a fallback mode; structured Word is usually easier and more reliable to edit.`))
      } else if (isPdfOffice) {
        const sourceLabel = (language === 'en' ? pdfSourceLabelsEn : pdfSourceLabels)[outputMetadata.pdfSourceKind] || tx('PDF có văn bản chọn được', 'PDF with selectable text')
        const mixedNotice = outputMetadata.pdfImageOnlyPages ? tx(`; ${outputMetadata.pdfImageOnlyPages} trang ảnh chưa có OCR`, `; ${outputMetadata.pdfImageOnlyPages} image-only pages still need OCR`) : ''
        const graphicsNotice = mode === 'pdf-to-word' && outputMetadata.wordEmbeddedGraphics ? tx(`; giữ ${outputMetadata.wordEmbeddedGraphics} ảnh, dấu hoặc chữ ký hiển thị`, `; preserved ${outputMetadata.wordEmbeddedGraphics} visible images, stamps or signatures`) : ''
        setMessage(tx(`Chuyển đổi hoàn tất — ${sourceLabel.toLowerCase()}, đã trích xuất ${Number(outputMetadata.characters || 0).toLocaleString(locale)} ký tự từ ${outputMetadata.pages || 0} trang${graphicsNotice}${mixedNotice}.`, `Conversion complete — ${sourceLabel.toLowerCase()}; extracted ${Number(outputMetadata.characters || 0).toLocaleString(locale)} characters from ${outputMetadata.pages || 0} pages${graphicsNotice}${mixedNotice}.`))
      }
      else setMessage(tx('Xử lý hoàn tất — hãy xem preview và tải xuống khi đã hài lòng.', 'Processing complete — review the preview and download when you are satisfied.'))
    } catch (error) {
      setMessage(language === 'en' && containsVietnamese(error.message)
        ? 'Unable to process this file. Please try again.'
        : (error.message || tx('Không thể xử lý tệp này. Hãy thử lại.', 'Unable to process this file. Please try again.')))
    }
    finally { setLoading(false) }
  }

  if (mode === 'soon') return <div className="modal-shade"><div className="tool-modal intro"><button className="close" onClick={close}>×</button><i>✦</i><h2>{tx('Tính năng đang hoàn thiện', 'Feature in development')}</h2><p>{tx('Công cụ này cần backend chuyên dụng để bảo toàn bố cục và nội dung. Chúng tôi chưa gắn nhãn hoạt động cho đến khi kiểm thử được toàn bộ luồng xử lý và tải xuống.', 'This tool needs a dedicated backend to preserve layout and content. It will not be marked ready until the complete processing and download flow has been verified.')}</p><button className="primary" onClick={close}>{tx('Khám phá công cụ khác', 'Explore other tools')}</button></div></div>

  const source = fileInfo[0]
  const inputSize = files.reduce((sum, file) => sum + file.size, 0)
  const reduction = result && inputSize ? Math.round((1 - result.size / inputSize) * 100) : null
  const targetBytes = Number(targetMb) * 1024 * 1024
  const targetRatio = files[0]?.size && Number.isFinite(targetBytes) ? Math.round(targetBytes / files[0].size * 100) : 0
  const imageEditStyle = mode === 'edit' ? {
    filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg) blur(${blur}px) grayscale(${grayscale ? 100 : 0}%)`,
    transform: `rotate(${rotation}deg) scaleX(${flop ? -1 : 1}) scaleY(${flip ? -1 : 1})`,
  } : undefined
  const sourceLabels = language === 'en' ? pdfSourceLabelsEn : pdfSourceLabels
  const diagnosisMessage = pdfDiagnosis ? (() => {
    if (mode === 'pdf-to-word' && wordMode === 'exact') {
      if (pdfDiagnosis.sourceKind === 'scan') return tx('Không thấy lớp chữ trong các trang đã kiểm tra. Cần OCR trước khi tạo Word có thể chỉnh sửa.', 'No text layer was found on the sampled pages. Run OCR before creating an editable Word file.')
      if (pdfDiagnosis.sourceKind === 'mixed') return tx('Một số trang chỉ có ảnh. Hãy OCR các trang đó trước để toàn bộ chữ trong Word đều sửa được.', 'Some pages contain images only. OCR those pages first so all text in Word can be edited.')
      if (pdfDiagnosis.signatureCount) return tx(`Phát hiện ${pdfDiagnosis.signatureCount} chữ ký số. Chế độ dự phòng đặt chữ thành text box và giữ phần nhìn thấy của chữ ký ở nền; hiệu lực mật mã không chuyển sang DOCX.`, `${pdfDiagnosis.signatureCount} digital signatures detected. Fallback mode positions text in boxes and preserves the visible signature appearance in the background; cryptographic validity does not carry into DOCX.`)
      return tx('Có lớp chữ để đặt lại từng dòng theo tọa độ; chế độ này khó chỉnh sửa hơn Word có cấu trúc.', 'A text layer is available for line-by-line positioning; this mode is harder to edit than structured Word.')
    }
    if (pdfDiagnosis.sourceKind === 'word-export') return tx('Metadata cho thấy PDF có thể được xuất từ Word; hệ thống sẽ dựng lại đoạn, cột và bảng Word thật.', 'Metadata suggests this PDF may have been exported from Word; real Word paragraphs, columns and tables will be rebuilt.')
    if (pdfDiagnosis.sourceKind === 'signed-document') return tx(`Phát hiện ${pdfDiagnosis.signatureCount} chữ ký số. Công cụ giữ phần dấu/chữ ký nhìn thấy được và dựng nội dung thành Word có cấu trúc; hiệu lực chữ ký số không chuyển sang DOCX.`, `${pdfDiagnosis.signatureCount} digital signatures detected. The tool preserves their visible appearance and rebuilds structured Word content; signature validity does not carry into DOCX.`)
    if (pdfDiagnosis.sourceKind === 'scan') return tx('Không thấy lớp chữ trong các trang đã kiểm tra. Cần OCR trước khi chuyển.', 'No text layer was found on the sampled pages. Run OCR before converting.')
    if (pdfDiagnosis.sourceKind === 'mixed') return tx('Một số trang có chữ, một số trang chỉ có ảnh; trang ảnh sẽ cần OCR.', 'Some pages have text while others contain images only; image-only pages need OCR.')
    return tx('Có lớp chữ để tái dựng thành đoạn văn, bảng và hình ảnh trong Word.', 'A text layer is available to rebuild paragraphs, tables and images in Word.')
  })() : ''
  const officeDescription = mode === 'pdf-to-word' && wordMode === 'exact'
    ? tx(`PDFTools đặt từng dòng chữ vào text box theo tọa độ và giữ lớp đồ họa nền ${exactWordDpi} DPI. Cách này ưu tiên vị trí nhưng khó sửa đoạn dài và có thể khác nhau giữa Word/LibreOffice.`, `PDFTools places each line in a coordinate-based text box and preserves a ${exactWordDpi} DPI graphics layer. This prioritizes position but makes long edits harder and can vary between Word and LibreOffice.`)
    : mode === 'pdf-to-word' ? tx('Dựng lại đoạn văn, tiêu đề hai cột và bảng thành phần tử Word thật; ảnh, dấu và chữ ký được tách khỏi PDF rồi neo theo tọa độ trang.', 'Rebuilds paragraphs, two-column headings and tables as real Word elements; images, stamps and signatures are extracted and anchored to page coordinates.')
      : mode === 'pdf-to-excel' ? tx('Mỗi trang thành một sheet; khoảng cách lớn được tách thành cột.', 'Each page becomes a worksheet; large gaps are separated into columns.')
        : mode === 'pdf-to-powerpoint' ? tx('Mỗi trang thành một slide; chữ được đặt gần vị trí gốc.', 'Each page becomes a slide with text placed near its original position.')
          : tx('Xuất văn bản UTF-8, phân tách rõ từng trang.', 'Exports UTF-8 text with clear page separation.')

  return <div className="modal-shade" role="dialog" aria-modal="true">
    <form className={`tool-modal ${files.length ? 'tool-modal-wide' : ''} ${isPdfOffice ? 'pdf-office-modal' : ''} ${mode === 'pdf-edit' ? 'pdf-edit-modal' : ''}`} onSubmit={submit}>
      <button className="close" type="button" onClick={close}>×</button>
      <div className="modal-heading"><i>✦</i><div><p>{tx('CÔNG CỤ PDFTOOLS', 'PDFTOOLS')}</p><h2>{language === 'en' ? labelsEn[mode] : labels[mode]}</h2></div></div>
      <p className="modal-copy">{isOrganize ? tx('Kéo thả để đổi thứ tự; xoay, nhân bản, thêm hoặc xóa trang rồi xem lại PDF trước khi tải.', 'Drag to reorder; rotate, duplicate, add or delete pages, then review the PDF before downloading.') : isMerge ? tx('Xem từng trang, kéo để sắp xếp và chèn thêm PDF vào đúng vị trí.', 'Preview every page, drag to reorder and insert more PDFs exactly where needed.') : mode === 'pdf-split' ? tx('Chọn trực tiếp các thumbnail cần tách; không cần nhớ hay nhập số trang.', 'Select page thumbnails directly—no page numbers to remember or type.') : mode === 'crop' ? tx('Đặt khung trực tiếp trên ảnh; phần sáng bên trong là vùng sẽ được giữ lại.', 'Position the frame directly on the image; the bright area is what will be kept.') : mode === 'pdf-compress' ? tx('Nhập dung lượng cần đạt; PDFTools sẽ tự cân chỉnh nhiều lượt để tệp nằm ngay dưới mục tiêu.', 'Enter a size limit and PDFTools will tune several passes to finish just below it.') : mode === 'pdf-edit' ? tx('Thêm chữ Unicode, watermark hoặc số trang vào vị trí bạn chọn rồi xem trước PDF kết quả.', 'Add Unicode text, a watermark or page numbers at your chosen position, then preview the result.') : mode === 'pdf-to-word' ? tx('Mặc định dựng lại đoạn văn, bảng và cột Word thật; ảnh, con dấu và chữ ký nhìn thấy được neo lại theo vị trí trên trang.', 'By default, real Word paragraphs, tables and columns are rebuilt while visible images, stamps and signatures are anchored to the page.') : isPdfOffice ? tx('Trích xuất phần văn bản có thể chọn thành tệp Office; PDF scan cần OCR trước.', 'Extract selectable text into an Office file; scanned PDFs need OCR first.') : mode === 'edit' ? tx('Điều chỉnh trực tiếp trên preview, sau đó tạo ảnh thật bằng cùng thông số.', 'Adjust the live preview, then create the real image with the same settings.') : tx('Tệp chỉ được tải xuống sau khi bạn đã xem preview kết quả.', 'The file becomes downloadable after you review its preview.')}</p>

      {!files.length ? <div className="drop-zone" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); choose(event.dataTransfer.files) }}>
        <input ref={input} className="drop-file-input" aria-label={tx('Chọn tệp từ máy tính', 'Choose files from your computer')} type="file" accept={fileAccept} multiple={isPageComposer} onChange={event => choose(event.target.files)} />
        <span>⇧</span><b>{tx(`Kéo thả ${isPageComposer ? 'các tệp' : 'tệp'} vào đây`, `Drop ${isPageComposer ? 'files' : 'a file'} here`)}</b><small>{tx(`hoặc nhấp để chọn từ máy tính · tối đa ${maximumSelectedFileMb} MB mỗi tệp, 50 MB mỗi lượt${isPdf ? ' · 500 trang PDF' : ''}`, `or click to browse · up to ${maximumSelectedFileMb} MB per file and 50 MB per operation${isPdf ? ' · 500 PDF pages' : ''}`)}</small>
      </div> : <>
        <input ref={input} className="file-input" aria-label={tx('Đổi tệp từ máy tính', 'Replace files from your computer')} type="file" accept={fileAccept} multiple={isPageComposer} onChange={event => choose(event.target.files)} />
        <div className="selected-file-bar"><div><i>{isPdf ? 'PDF' : 'IMG'}</i><span><b>{files.length > 1 ? tx(`${files.length} tệp đã chọn`, `${files.length} files selected`) : files[0].name}</b><small>{files.length > 1 ? tx(`${formatBytes(files.reduce((sum, file) => sum + file.size, 0))} tổng cộng`, `${formatBytes(files.reduce((sum, file) => sum + file.size, 0))} total`) : formatBytes(files[0].size)}</small></span></div><button type="button" onClick={() => input.current?.click()}>{tx('Đổi tệp', 'Replace')}</button></div>

        {mode === 'pdf-split' && <FileFacts info={source} />}
        {(isPageComposer || mode === 'pdf-split') ? <PdfPageBoard mode={mode} pages={pdfPages} fileInfo={fileInfo} selectedPages={selectedPages} setSelectedPages={setSelectedPages} setPages={setPdfPages} onAddFiles={addMergeFiles} /> : <>
          <FileFacts info={source} />
          <div className="editor-layout">
          <div className="editor-preview">
            {mode === 'crop' ? <CropPreview info={source} crop={crop} setCrop={setCrop} cropStageRef={cropStageRef} />
              : mode === 'pdf-edit' ? <PdfEditPreview info={source} editType={pdfEditType} text={pdfEditText} position={pdfEditPosition} setPosition={setPdfEditPosition} xPercent={pdfEditX} setXPercent={setPdfEditX} yPercent={pdfEditY} setYPercent={setPdfEditY} fontSize={pdfEditFontSize} color={pdfEditColor} opacity={pdfEditOpacity} />
                : <MediaPreview info={source} title={mode === 'edit' ? tx('Preview chỉnh sửa', 'Edit preview') : tx('Bản gốc', 'Original')} imageStyle={imageEditStyle} />}
          </div>
          <div className="editor-controls">
            {mode === 'remove-background' && <div className="control-group"><span>{tx('Chế độ AI', 'AI mode')}</span><div className="option-cards"><button type="button" className={backgroundQuality === 'balanced' ? 'active' : ''} onClick={() => setBackgroundQuality('balanced')}><b>{tx('Nhanh', 'Fast')}</b><small>{tx('~40 MB · ảnh thông thường', '~40 MB · everyday images')}</small></button><button type="button" className={backgroundQuality === 'high' ? 'active' : ''} onClick={() => setBackgroundQuality('high')}><b>{tx('Chất lượng cao', 'High quality')}</b><small>{tx('~80 MB · viền tóc tốt hơn', '~80 MB · finer hair edges')}</small></button></div></div>}

            {isImage && mode !== 'remove-background' && <>
              <div className="control-group"><label>{tx('Định dạng kết quả', 'Output format')}<select value={format} onChange={event => setFormat(event.target.value)}><option value="webp">{tx('WebP — nhẹ, hiện đại', 'WebP — compact and modern')}</option><option value="jpeg">{tx('JPG — tương thích cao', 'JPG — widely compatible')}</option><option value="png">{tx('PNG — không mất dữ liệu', 'PNG — lossless')}</option><option value="avif">{tx('AVIF — dung lượng thấp', 'AVIF — smallest files')}</option></select></label></div>
              <div className="control-group"><div className="range-label"><span>{tx('Chất lượng', 'Quality')}</span><b>{quality}%</b></div><input type="range" min="20" max="100" value={quality} onChange={event => setQuality(event.target.value)} /><small>{tx('Chất lượng thấp hơn thường tạo tệp nhẹ hơn. PNG có thể ít thay đổi.', 'Lower quality usually creates a smaller file. PNG may change very little.')}</small></div>
              {mode === 'resize' && <div className="control-group"><div className="dimensions"><label>{tx('Rộng (px)', 'Width (px)')}<input inputMode="numeric" value={width} onChange={event => resizeValue('width', event.target.value)} /></label><label>{tx('Cao (px)', 'Height (px)')}<input inputMode="numeric" value={height} onChange={event => resizeValue('height', event.target.value)} /></label></div><button className={`ratio-lock ${lockRatio ? 'active' : ''}`} type="button" onClick={() => setLockRatio(!lockRatio)}>{lockRatio ? tx('🔗 Đang khóa tỷ lệ', '🔗 Aspect ratio locked') : tx('Mở khóa tỷ lệ', 'Unlock aspect ratio')}</button></div>}
              {mode === 'edit' && <>
                <div className="control-group adjustment-stack"><span>{tx('Màu sắc và hiệu ứng', 'Color and effects')}</span><RangeControl label={tx('Độ sáng', 'Brightness')} value={brightness} setValue={setBrightness} min={20} max={180} suffix="%" /><RangeControl label={tx('Tương phản', 'Contrast')} value={contrast} setValue={setContrast} min={20} max={180} suffix="%" /><RangeControl label={tx('Độ bão hòa', 'Saturation')} value={saturation} setValue={setSaturation} min={0} max={200} suffix="%" /><RangeControl label={tx('Sắc độ', 'Hue')} value={hue} setValue={setHue} min={-180} max={180} suffix="°" /><RangeControl label={tx('Làm mờ', 'Blur')} value={blur} setValue={setBlur} min={0} max={8} step={0.2} suffix="px" /></div>
                <div className="control-group"><span>{tx('Xoay và lật', 'Rotate and flip')}</span><div className="edit-actions"><button type="button" onClick={() => setRotation(value => (value + 270) % 360)}>↶ {tx('Xoay trái', 'Rotate left')}</button><button type="button" onClick={() => setRotation(value => (value + 90) % 360)}>↷ {tx('Xoay phải', 'Rotate right')}</button><button type="button" className={flop ? 'active' : ''} onClick={() => setFlop(!flop)}>↔ {tx('Lật ngang', 'Flip horizontally')}</button><button type="button" className={flip ? 'active' : ''} onClick={() => setFlip(!flip)}>↕ {tx('Lật dọc', 'Flip vertically')}</button><button type="button" className={grayscale ? 'active' : ''} onClick={() => setGrayscale(!grayscale)}>◐ {tx('Trắng đen', 'Grayscale')}</button></div></div>
              </>}
            </>}

            {mode === 'pdf-edit' && <>
              <div className="control-group"><span>{tx('Nội dung thêm', 'Content to add')}</span><div className="option-cards"><button type="button" className={pdfEditType === 'text' ? 'active' : ''} onClick={() => setPdfEditType('text')}><b>{tx('Chữ / watermark', 'Text / watermark')}</b><small>{tx('Hỗ trợ', 'Supports')} {`{page}`} {tx('và', 'and')} {`{pages}`}</small></button><button type="button" className={pdfEditType === 'page-numbers' ? 'active' : ''} onClick={() => setPdfEditType('page-numbers')}><b>{tx('Đánh số trang', 'Page numbers')}</b><small>{tx('Tự tạo Trang 1 / N', 'Automatically creates Page 1 / N')}</small></button></div></div>
              {pdfEditType === 'text' && <div className="control-group"><label>{tx('Nội dung', 'Content')}<input maxLength="120" value={pdfEditText} onChange={event => setPdfEditText(event.target.value)} placeholder={tx('Ví dụ: PDFTools · Trang {page}', 'Example: PDFTools · Page {page}')} /></label></div>}
              <div className="control-group"><label>{tx('Áp dụng cho trang', 'Apply to pages')}<input value={pdfEditPages} onChange={event => setPdfEditPages(event.target.value)} placeholder={tx('Để trống = tất cả · Ví dụ 1-3, 5', 'Leave blank = all · Example: 1-3, 5')} /></label></div>
              <div className="control-group"><label>{tx('Vị trí', 'Position')}<select value={pdfEditPosition} onChange={event => setPdfEditPosition(event.target.value)}><option value="custom">{tx('Tự kéo trên trang', 'Drag on page')}</option><option value="top-left">{tx('Trên trái', 'Top left')}</option><option value="top-center">{tx('Trên giữa', 'Top center')}</option><option value="top-right">{tx('Trên phải', 'Top right')}</option><option value="center">{tx('Chính giữa', 'Center')}</option><option value="bottom-left">{tx('Dưới trái', 'Bottom left')}</option><option value="bottom-center">{tx('Dưới giữa', 'Bottom center')}</option><option value="bottom-right">{tx('Dưới phải', 'Bottom right')}</option></select></label><small>{tx('Kéo nội dung ngay trên preview để chuyển sang vị trí tùy chỉnh.', 'Drag the content on the preview to switch to a custom position.')}</small></div>
              {pdfEditPosition === 'custom' && <div className="control-group adjustment-stack"><span>{tx('Tọa độ chính xác', 'Exact coordinates')}</span><RangeControl label={tx('Ngang', 'Horizontal')} value={pdfEditX} setValue={setPdfEditX} min={2} max={98} step={0.5} suffix="%" /><RangeControl label={tx('Dọc', 'Vertical')} value={pdfEditY} setValue={setPdfEditY} min={2} max={98} step={0.5} suffix="%" /></div>}
              <div className="control-group adjustment-stack"><span>{tx('Kiểu hiển thị', 'Appearance')}</span><RangeControl label={tx('Cỡ chữ', 'Font size')} value={pdfEditFontSize} setValue={setPdfEditFontSize} min={8} max={48} suffix=" pt" /><RangeControl label={tx('Độ đậm', 'Opacity')} value={pdfEditOpacity} setValue={setPdfEditOpacity} min={10} max={100} suffix="%" /><label className="color-control">{tx('Màu chữ', 'Text color')}<input type="color" value={pdfEditColor} onChange={event => setPdfEditColor(event.target.value)} /></label></div>
              <div className="control-note"><b>{tx('Phạm vi chỉnh sửa thực tế', 'What this editor changes')}</b><span>{tx('Công cụ thêm lớp chữ mới lên PDF; chưa sửa hoặc xóa trực tiếp chữ gốc. Preview vị trí được đồng bộ bằng phần trăm với tệp kết quả.', 'The tool adds a new text layer to the PDF; it does not directly edit or delete original text. Preview positions are synchronized to the output using percentages.')}</span></div>
            </>}

            {isPdfOffice && <>
              {mode === 'pdf-to-word' && <div className="control-group word-mode-control"><span>{tx('Kiểu tệp Word', 'Word output type')}</span><div className="option-cards"><button type="button" className={wordMode === 'editable' ? 'active' : ''} onClick={() => { setWordMode('editable'); setResult(null); setMessage(pdfTextPreview ? tx('Word sẽ có đoạn văn, cột và bảng thật; ảnh, dấu và chữ ký nhìn thấy được giữ theo vị trí.', 'Word will contain real paragraphs, columns and tables while visible images, stamps and signatures keep their positions.') : tx('PDF chưa có lớp chữ để tạo Word có cấu trúc. Hãy OCR trước.', 'The PDF has no text layer for structured Word. Run OCR first.')) }}><b>{tx('Word có cấu trúc', 'Structured Word')} <em>{tx('Khuyên dùng', 'Recommended')}</em></b><small>{tx('Đoạn và bảng thật · giữ ảnh, dấu, chữ ký · dễ chỉnh sửa', 'Real paragraphs and tables · preserves images, stamps and signatures · easier to edit')}</small></button><button type="button" className={wordMode === 'exact' ? 'active' : ''} onClick={() => { setWordMode('exact'); setResult(null); setMessage(pdfTextPreview ? tx('Mỗi dòng chữ sẽ thành text box theo tọa độ; phù hợp làm phương án dự phòng khi bố cục đặc biệt.', 'Each line becomes a coordinate-based text box; useful as a fallback for unusual layouts.') : tx('PDF chưa có lớp chữ. Hãy OCR trước khi dùng chế độ giữ vị trí.', 'The PDF has no text layer. Run OCR before using line-positioned mode.')) }}><b>{tx('Giữ vị trí từng dòng', 'Keep each line positioned')}</b><small>{tx('Text box theo tọa độ · khó sửa dài · có thể lệch giữa các phần mềm Word', 'Coordinate-based text boxes · harder for long edits · may vary across Word apps')}</small></button></div></div>}
              {pdfDiagnosis && <div className={`pdf-diagnosis ${pdfDiagnosis.sourceKind}`}><strong>{sourceLabels[pdfDiagnosis.sourceKind]}</strong><span>{diagnosisMessage}</span><small>{tx(`Kiểm tra nhanh ${pdfDiagnosis.sampledPages}/${pdfDiagnosis.totalPages} trang`, `Quick check: ${pdfDiagnosis.sampledPages}/${pdfDiagnosis.totalPages} pages`)}{pdfDiagnosis.producer ? tx(` · Trình tạo: ${pdfDiagnosis.producer}`, ` · Producer: ${pdfDiagnosis.producer}`) : ''}{pdfDiagnosis.hasStructTree ? tx(' · Có cấu trúc PDF được gắn thẻ', ' · Tagged PDF structure found') : ''}</small></div>}
              <div className="control-note office-note"><b>{mode === 'pdf-to-word' && wordMode === 'exact' ? tx('Giữ vị trí từng dòng — phương án dự phòng', 'Keep each line positioned — fallback') : mode === 'pdf-to-word' ? tx('Word có cấu trúc gần bản PDF', 'Structured Word close to the PDF') : tx('Chuyển đổi văn bản có thể chỉnh sửa', 'Editable text conversion')}</b><span>{officeDescription}</span><em>{mode === 'pdf-to-word' && wordMode === 'exact' ? tx(`Tối đa ${maximumExactWordPages} trang/lượt và chỉ dùng cho PDF có chữ chọn được. Một số font nhúng đặc biệt có thể được Word thay thế; chữ ký số không còn giá trị xác thực.`, `Up to ${maximumExactWordPages} pages per operation and only for PDFs with selectable text. Word may substitute some embedded fonts; digital signatures lose their cryptographic validity.`) : pdfTextPreview ? tx(`Đã đọc trước ${pdfTextPreview.replace(/\s/g, '').length.toLocaleString(locale)} ký tự. Kết quả giữ phần nhìn thấy của chữ ký nhưng không thể khôi phục file Word gốc hay hiệu lực chữ ký số.`, `Previewed ${pdfTextPreview.replace(/\s/g, '').length.toLocaleString(locale)} characters. The result preserves visible signatures but cannot recover the original Word file or digital signature validity.`) : tx('Chưa tìm thấy chữ có thể chọn trong phần xem trước.', 'No selectable text was found in the preview.')}</em></div>
            </>}

            {mode === 'pdf-compress' && <>
              <div className="control-group"><span>{tx('Kiểu nén', 'Compression mode')}</span><div className="option-cards"><button type="button" className={pdfCompression === 'target' ? 'active' : ''} onClick={() => setPdfCompression('target')}><b>{tx('Đạt dung lượng mục tiêu', 'Target file size')}</b><small>{tx('Nén từng trang, tự cân bằng độ nét để bám sát số MB', 'Compresses each page and balances clarity to stay close to the MB limit')}</small></button><button type="button" className={pdfCompression === 'preserve' ? 'active' : ''} onClick={() => setPdfCompression('preserve')}><b>{tx('Không mất dữ liệu', 'Lossless')}</b><small>{tx('Giữ chữ, liên kết và biểu mẫu; có thể giảm 0%', 'Preserves text, links and forms; reduction may be 0%')}</small></button></div></div>
              {pdfCompression === 'target' ? <>
                <div className="control-group"><span>{tx('Nội dung PDF', 'PDF content')}</span><div className="option-cards"><button type="button" className={pdfContentProfile === 'document' ? 'active' : ''} onClick={() => setPdfContentProfile('document')}><b>{tx('Tài liệu / chữ', 'Document / text')}</b><small>{tx('Ưu tiên DPI cao để chữ nhỏ và nét mảnh rõ hơn', 'Prioritizes higher DPI for small text and fine lines')}</small></button><button type="button" className={pdfContentProfile === 'photo' ? 'active' : ''} onClick={() => setPdfContentProfile('photo')}><b>{tx('Ảnh / màu sắc', 'Photos / color')}</b><small>{tx('Ưu tiên chuyển sắc và giảm vỡ màu ở ảnh chụp', 'Prioritizes gradients and reduces color artifacts in photos')}</small></button></div></div>
                <div className="control-group target-size-control">
                  <label>{tx('Dung lượng tối đa', 'Maximum size')}<input type="number" min="0.1" max={files[0] ? Math.max(0.1, files[0].size / 1024 / 1024 - 0.01).toFixed(2) : undefined} step="0.1" value={targetMb} onChange={event => setTargetMb(event.target.value)} /></label><b>MB</b>
                  <div className="target-summary"><span>{tx('Mục tiêu tối ưu', 'Optimized range')}</span><strong>{Number(targetMb) > 0 ? `${(Number(targetMb) * 0.95).toFixed(2)}–${(Number(targetMb) * 0.99).toFixed(2)} MB` : '—'}</strong><small>{targetRatio > 0 ? tx(`Khoảng ${targetRatio}% tệp gốc · luôn ưu tiên không vượt ${targetMb || 0} MB`, `About ${targetRatio}% of the original · always prioritizes staying below ${targetMb || 0} MB`) : tx('Nhập dung lượng cần đạt', 'Enter the desired file size')}</small></div>
                  <p>{tx('Chế độ này làm phẳng mỗi trang thành ảnh PNG/JPEG: hình thức được giữ, nhưng chữ, liên kết và biểu mẫu sẽ không còn chọn hoặc chỉnh sửa được.', 'This mode flattens every page into a PNG/JPEG image: the appearance is preserved, but text, links and forms will no longer be selectable or editable.')}</p>
                </div>
              </> : <div className="control-note"><b>{tx('Tối ưu không mất dữ liệu là gì?', 'What is lossless optimization?')}</b><span>{tx('Không biến trang thành ảnh: chữ vẫn chọn/copy được, liên kết và biểu mẫu được giữ nguyên. Chế độ này chỉ tối ưu cấu trúc PDF, nên tệp đã nén tốt có thể giảm 0% — đây không phải lỗi.', 'Pages are not turned into images: text remains selectable and copyable, and links and forms are preserved. This mode only optimizes PDF structure, so a well-optimized file may shrink by 0%—that is expected.')}</span></div>}
            </>}

          </div>
          </div>
        </>}
      </>}

      <button className="primary process" disabled={loading}>{loading ? tx('Đang xử lý…', 'Processing…') : !files.length ? tx('Chọn tệp để bắt đầu', 'Choose a file to begin') : isOrganize ? tx(`Lưu PDF gồm ${pdfPages.length} trang  →`, `Save ${pdfPages.length}-page PDF  →`) : isMerge ? tx(`Ghép ${pdfPages.length} trang  →`, `Merge ${pdfPages.length} pages  →`) : mode === 'pdf-split' ? tx(`Tách ${selectedPages.size} trang  →`, `Split ${selectedPages.size} pages  →`) : mode === 'pdf-to-word' && wordMode === 'exact' ? tx('Tạo Word giữ vị trí  →', 'Create positioned Word  →') : mode === 'pdf-to-word' ? tx('Tạo Word có cấu trúc  →', 'Create structured Word  →') : isPdfOffice ? tx('Chuyển đổi và xem kết quả  →', 'Convert and review result  →') : mode === 'pdf-compress' && pdfCompression === 'preserve' ? tx('Tối ưu không mất dữ liệu  →', 'Optimize losslessly  →') : tx('Tạo bản xem trước kết quả  →', 'Create result preview  →')}</button>
      {message && <p className={`result ${result ? 'success' : ''}`}>{message}</p>}

      {result && <div className="result-workspace">
        <div className="result-heading"><div><span>{tx('KẾT QUẢ', 'RESULT')}</span><h3>{result.name}</h3></div><div className="result-actions"><button type="button" className="reset-result" onClick={() => { setResult(null); setFiles([]); setFileInfo([]); setMessage('') }} title={tx('Xử lý tệp khác', 'Process another file')}>↩ {tx('Làm mới', 'Start over')}</button><a className="primary download-result" href={result.url} download={result.name}>{tx('Tải xuống', 'Download')} <b>↓</b></a></div></div>

        <div className="result-comparison"><MediaPreview info={fileInfo[0]} title={tx('Trước xử lý', 'Before')} /><MediaPreview info={result.wordLayoutMode === 'exact-text-boxes' ? fileInfo[0] : result} title={result.wordLayoutMode === 'exact-text-boxes' ? tx('Sau xử lý · bố cục chính xác', 'After · positioned layout') : tx('Sau xử lý', 'After')} checkerboard={mode === 'remove-background'} /></div>
        <div className="result-stats"><span><small>{tx('Trước', 'Before')}</small><b>{formatBytes(inputSize)}</b></span><i>→</i><span><small>{tx('Sau', 'After')}</small><b>{formatBytes(result.size)}</b></span>{reduction !== null && <strong className={reduction >= 0 ? 'positive' : 'negative'}>{reduction >= 0 ? tx(`Giảm ${reduction}%`, `${reduction}% smaller`) : tx(`Tăng ${Math.abs(reduction)}%`, `${Math.abs(reduction)}% larger`)}</strong>}{result.width && <span><small>{tx('Kích thước mới', 'New dimensions')}</small><b>{result.width} × {result.height}px</b></span>}{result.pages && <span><small>{tx('Số trang', 'Pages')}</small><b>{tx(`${result.pages} trang`, `${result.pages} pages`)}</b></span>}{result.compression && <span><small>{tx('Độ nét trang', 'Page clarity')}</small><b>{result.compression.minimumDpi === result.compression.maximumDpi ? `${result.compression.minimumDpi} DPI` : `${result.compression.minimumDpi}–${result.compression.maximumDpi} DPI`}</b></span>}{result.compression && <span><small>{tx('Mã hóa ảnh', 'Image encoding')}</small><b>{result.compression.losslessPages ? tx(`${result.compression.losslessPages} trang PNG`, `${result.compression.losslessPages} PNG pages`) : `JPEG ${result.compression.averageQuality}%`}</b></span>}{result.compressionMode === 'lossless' && <span><small>{tx('Nội dung', 'Content')}</small><b>{tx('Giữ chữ · link · form', 'Text · links · forms preserved')}</b></span>}{result.pdfSourceKind && <span><small>{tx('Loại PDF', 'PDF type')}</small><b>{sourceLabels[result.pdfSourceKind] || result.pdfSourceKind}</b></span>}{result.wordLayoutMode && <span><small>{tx('Chế độ Word', 'Word mode')}</small><b>{result.wordLayoutMode === 'exact-text-boxes' ? tx('Giữ vị trí từng dòng', 'Positioned lines') : tx('Đoạn + bảng + đồ họa', 'Paragraphs + tables + graphics')}</b></span>}{result.wordTextBoxes > 0 && <span><small>{tx('Chữ chỉnh sửa', 'Editable text')}</small><b>{tx(`${result.wordTextBoxes.toLocaleString(locale)} khối`, `${result.wordTextBoxes.toLocaleString(locale)} boxes`)}</b></span>}{result.exactDpi && <span><small>{tx('Nền đồ họa', 'Graphics layer')}</small><b>{result.exactDpi} DPI · {result.exactImageFormats}</b></span>}{result.wordDetectedTables > 0 && <span><small>{tx('Bảng nhận diện', 'Detected tables')}</small><b>{tx(`${result.wordDetectedTables} bảng Word`, `${result.wordDetectedTables} Word tables`)}</b></span>}{result.wordEmbeddedGraphics > 0 && <span><small>{tx('Đồ họa giữ lại', 'Preserved graphics')}</small><b>{tx(`${result.wordEmbeddedGraphics} ảnh/dấu/chữ ký`, `${result.wordEmbeddedGraphics} images/stamps/signatures`)}</b></span>}{result.pdfSignatures > 0 && <span><small>{tx('Chữ ký PDF', 'PDF signatures')}</small><b>{tx(`${result.pdfSignatures} · giữ phần nhìn thấy, không giữ hiệu lực`, `${result.pdfSignatures} · visible appearance kept, validity not preserved`)}</b></span>}{result.pdfImageOnlyPages > 0 && <span><small>{tx('Chưa OCR', 'Needs OCR')}</small><b>{tx(`${result.pdfImageOnlyPages} trang ảnh`, `${result.pdfImageOnlyPages} image pages`)}</b></span>}</div>
      </div>}
    </form>
  </div>
}

export default function App() {
  const { language, toggleLanguage, tx } = useLanguage()
  const [dark, setDark] = useState(() => localStorage.getItem('pdftools-theme') === 'dark')
  const [modal, setModal] = useState(null)
  const [query, setQuery] = useState('')
  const [welcomePhase, setWelcomePhase] = useState('showing')
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('pdftools-theme', dark ? 'dark' : 'light') }, [dark])
  useEffect(() => {
    document.body.classList.add('welcome-active')
    const prefersReducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const beginExit = setTimeout(() => setWelcomePhase('leaving'), prefersReducedMotion ? 650 : 6100)
    return () => {
      clearTimeout(beginExit)
      document.body.classList.remove('welcome-active')
    }
  }, [])
  useEffect(() => {
    if (welcomePhase !== 'leaving') return undefined
    const removeSplash = setTimeout(() => {
      setWelcomePhase('hidden')
      document.body.classList.remove('welcome-active')
    }, 620)
    return () => clearTimeout(removeSplash)
  }, [welcomePhase])
  useEffect(() => {
    if (welcomePhase !== 'hidden' || !window.location.hash) return
    const targetId = decodeURIComponent(window.location.hash.slice(1))
    document.getElementById(targetId)?.scrollIntoView({ block: 'start' })
  }, [welcomePhase])
  useEffect(() => {
    if (navigator.connection?.saveData) return undefined
    const warm = () => { warmPdfTools().catch(() => null) }
    if ('requestIdleCallback' in globalThis) {
      const idleId = globalThis.requestIdleCallback(warm, { timeout: 4000 })
      return () => globalThis.cancelIdleCallback(idleId)
    }
    const timer = setTimeout(warm, 2500)
    return () => clearTimeout(timer)
  }, [])
  const count = useMemo(() => [...pdfTools, ...imageTools, ...utilityTools].filter(tool => `${tool.name} ${tool.description} ${(englishTools[tool.mode] || []).join(' ')}`.toLowerCase().includes(query.toLowerCase())).length, [query])
  const closeModal = () => setModal(null)
  const skipWelcome = () => setWelcomePhase(current => current === 'showing' ? 'leaving' : current)

  return <>
    {welcomePhase !== 'hidden' && <WelcomeSplash phase={welcomePhase} onSkip={skipWelcome} />}
    <div className="app redesigned">
      <header className="header">
        <div className="header-brand-group"><a className="brand" href="#home" aria-label={tx('PDFTools — Trang chủ', 'PDFTools — Home')}><BrandLogo /></a></div>
        <nav><a className="active" href="#home">{tx('Trang chủ', 'Home')}</a><a href="#pdf">PDF Tools</a><a href="#images">Image Tools</a><a href="#utilities">{tx('Tiện ích', 'Utilities')}</a><a href="#benefits">{tx('Lợi ích', 'Benefits')}</a></nav>
        <div className="header-actions"><button className="theme-toggle" aria-label={tx('Đổi chế độ màu', 'Toggle color theme')} onClick={() => setDark(!dark)}>{dark ? '☀' : '☾'}</button><button className="language" type="button" onClick={toggleLanguage} aria-label={language === 'vi' ? 'Switch to English' : 'Chuyển sang tiếng Việt'} title={language === 'vi' ? 'Switch to English' : 'Chuyển sang tiếng Việt'}><span aria-hidden="true">◎</span><b>{language === 'vi' ? 'VI' : 'EN'}</b><small>→ {language === 'vi' ? 'EN' : 'VI'}</small></button><a className="header-cta" href="#pdf">{tx('Dùng miễn phí', 'Use for free')} <span>→</span></a></div>
      </header>
      <main id="home">
        <section className="hero"><div className="hero-copy"><div className="hero-kicker"><span>✦</span> {tx('Bộ công cụ tài liệu trực tuyến', 'Online document toolkit')}</div><h1>{tx('Làm việc với', 'Work with')}<br /><em>{tx('PDF & hình ảnh', 'PDFs & images')}</em><br />{tx('nhẹ nhàng hơn.', 'with less effort.')}</h1><p className="hero-text">{tx('Nén, chuyển đổi và xử lý tệp trong vài bước.', 'Compress, convert and process files in a few steps.')}<br />{tx('Nhanh chóng, rõ ràng và luôn tôn trọng dữ liệu của bạn.', 'Fast, transparent and always respectful of your data.')}</p><label className="search"><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder={tx('Bạn muốn làm gì với tệp của mình?', 'What would you like to do with your file?')} /><small>{query && `${count} ${tx('công cụ', count === 1 ? 'tool' : 'tools')}`}</small></label><div className="hero-trust"><span>✓ {tx('Không cần đăng ký', 'No sign-up')}</span><span>✓ {tx('Tiếng Việt & English', 'English & Vietnamese')}</span><span>✓ {tx('Preview trước khi tải', 'Preview before download')}</span></div></div><div className="hero-illustration"><div className="document"><div className="doc-dots">●　●　●</div><div className="doc-sidebar" /><div className="doc-lines"><b /><b /><b /><b /><div /><b /></div></div><span className="hero-chip pdf">PDF</span><span className="hero-chip word">W</span><span className="hero-chip image">▣</span><span className="hero-chip add">＋</span><i className="spark s1">✦</i><i className="spark s2">✦</i></div></section>
        <div className="content">
          <ToolSection title={tx('Công cụ PDF', 'PDF Tools')} eyebrow={tx('TÀI LIỆU', 'DOCUMENTS')} description={tx('Các tác vụ PDF thiết yếu, dễ dùng và an toàn.', 'Essential PDF tasks that are simple and safe to use.')} tools={pdfTools} id="pdf" open={setModal} query={query} />
          <ToolSection title={tx('Công cụ Ảnh', 'Image Tools')} eyebrow={tx('HÌNH ẢNH', 'IMAGES')} description={tx('Tối ưu và bảo vệ hình ảnh với preview trực quan.', 'Optimize and protect images with visual previews.')} tools={imageTools} id="images" open={setModal} query={query} />
          <ToolSection title={tx('Công cụ Tiện ích', 'Utility Tools')} eyebrow={tx('QR & TỆP', 'QR & FILES')} description={tx('Các thao tác nhỏ hữu ích, ưu tiên xử lý riêng tư ngay trên máy.', 'Useful everyday tasks with private, on-device processing whenever possible.')} tools={utilityTools} id="utilities" open={setModal} query={query} />
          <section className="benefits" id="benefits"><Benefit icon="♢" title={tx('Không lưu tệp lâu dài', 'No long-term file storage')} text={tx('Tệp chỉ được xử lý trong bộ nhớ hoặc ngay trên trình duyệt, không tạo hồ sơ lưu trữ trên máy chủ.', 'Files are processed in memory or directly in your browser without creating a server-side archive.')} /><Benefit icon="ϟ" title={tx('Xử lý tối ưu', 'Optimized processing')} text={tx('Mỗi luồng ảnh và PDF được tối ưu riêng, kèm trạng thái rõ ràng trong lúc chờ.', 'Each image and PDF workflow is optimized separately with clear progress feedback.')} /><Benefit icon="☁" title={tx('Hỗ trợ mọi thiết bị', 'Works on every device')} text={tx('Sử dụng dễ dàng trên mọi thiết bị, mọi nền tảng.', 'Easy to use across devices and platforms.')} /><Benefit icon="✪" title={tx('Dùng miễn phí', 'Free to use')} text={tx('Các công cụ hiện tại được sử dụng miễn phí, không cần đăng ký tài khoản.', 'Current tools are free to use with no account required.')} /></section>
          <CreatorShowcase />
        </div>
      </main>
      <footer><div className="footer-top"><div className="footer-brand"><a className="brand" href="#home" aria-label={tx('PDFTools — Trang chủ', 'PDFTools — Home')}><BrandLogo /></a><p>{tx('Một nơi đơn giản để xử lý tài liệu, hình ảnh và các tác vụ tệp hằng ngày.', 'One simple place for documents, images and everyday file tasks.')}</p></div><Footer title={tx('Sản phẩm', 'Products')} items={footerProducts.map(item => item.href === '#utilities' ? { ...item, label: tx('Tiện ích', 'Utilities') } : item.href === '#benefits' ? { ...item, label: tx('Vì sao chọn chúng tôi', 'Why choose us') } : item)} /><Footer title={tx('Liên hệ', 'Contact')} items={footerContacts} /></div><div className="copyright"><span>© 2026 PDFTools · {tx('Làm việc thông minh hơn, mỗi ngày.', 'Work smarter, every day.')}</span><span className="footer-signature">{tx('Phát triển bởi', 'Developed by')} <strong>Danh Phạm</strong><span className="version-badge" data-build-label="Bản dựng #" title={`${tx('Mã Git kỹ thuật', 'Technical Git revision')}: ${appRevision}`}>{tx('Phiên bản', 'Version')} {appVersion}<i>•</i>{tx('Bản dựng', 'Build')} #{appBuildNumber}</span></span></div></footer>
      {modal && (specialToolModes.has(modal) ? <UtilityToolModal mode={modal} close={closeModal} /> : <ToolModal mode={modal} close={closeModal} />)}
    </div>
  </>
}

function Benefit({ icon, title, text }) { return <div><i>{icon}</i><span><strong>{title}</strong><small>{text}</small></span></div> }
function Footer({ title, items }) {
  return <div className="footer-column"><h3>{title}</h3>{items.map(item => {
    const external = item.href.startsWith('http')
    return <a className={item.detail ? 'contact-link' : ''} href={item.href} key={item.label} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined} aria-label={item.detail ? `${item.label} — ${item.detail}` : undefined}><span>{item.label}</span>{item.detail && <small>{item.detail}</small>}{external && <b aria-hidden="true">↗</b>}</a>
  })}</div>
}
