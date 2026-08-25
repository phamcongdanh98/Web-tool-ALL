import { useEffect, useMemo, useRef, useState } from 'react'

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
]

const footerProducts = [
  { label: 'PDF Tools', href: '#pdf' },
  { label: 'Image Tools', href: '#images' },
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

const imageModes = ['compress', 'convert', 'resize', 'crop', 'edit', 'remove-background']
const pdfOfficeModes = ['pdf-to-word', 'pdf-to-excel', 'pdf-to-powerpoint', 'pdf-to-text']
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const maximumFileBytes = 25 * 1024 * 1024
const maximumUploadBytes = 50 * 1024 * 1024
const maximumPdfPages = 500
const maximumExactWordPages = 40
const exactWordDpi = 200
const maximumExactWordPixelsPerPage = 12_000_000
const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index ? 2 : 0)} ${units[index]}`
}

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
      onProgress?.(`Đang tái dựng chữ và đồ họa trang ${pageNumber}/${pdf.numPages}…`)
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
    onProgress?.('Đang đóng gói các trang vào Word…')
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
        reportProgress(`Lượt tối ưu ${pass}/4 · đang xử lý trang ${index + 1}/${source.numPages}…`)
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

function ToolCard({ tool, open }) {
  const isReady = tool.mode !== 'soon'
  const prepare = () => { if (tool.mode.startsWith('pdf-')) warmPdfTools().catch(() => null) }
  return <button className="tool-card" onPointerEnter={prepare} onFocus={prepare} onTouchStart={prepare} onClick={() => { prepare(); open(tool.mode) }}>
    <span className={`tool-status ${isReady ? 'ready' : 'soon'}`}>{isReady ? 'Sẵn sàng' : 'Đang hoàn thiện'}</span>
    <span className={`tool-icon ${tool.color}`}>{tool.icon}</span>
    <strong>{tool.name}</strong>
    <small>{tool.description}</small>
    <span className="tool-action">{isReady ? 'Mở công cụ' : 'Xem thông tin'} <b>→</b></span>
  </button>
}

function ToolSection({ title, tools, id, open, query }) {
  const visible = tools.filter(tool => `${tool.name} ${tool.description}`.toLowerCase().includes(query.toLowerCase()))
  return <section className="tool-section" id={id}>
    <div className="section-heading">
      <div><span>{id === 'pdf' ? 'TÀI LIỆU' : 'HÌNH ẢNH'}</span><h2>{title}</h2><p>{id === 'pdf' ? 'Các tác vụ PDF thiết yếu, dễ dùng và an toàn.' : 'Tối ưu hình ảnh nhanh chóng ngay trên trình duyệt.'}</p></div>
      <a href={`#${id}`}>Khám phá tất cả <span>→</span></a>
    </div>
    <div className="tools-grid">{visible.map(tool => <ToolCard key={tool.name} tool={tool} open={open} />)}</div>
    {!visible.length && <p className="empty">Chưa tìm thấy công cụ phù hợp.</p>}
  </section>
}

function PdfCanvasPreview({ info }) {
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
        setError('Không thể hiển thị trang PDF này trong preview.')
      }
    })
    return () => { cancelled = true; loadingTask?.destroy?.() }
  }, [info.url, pageNumber, renderMode])

  return <div className="pdf-canvas-preview">
    <div className="pdf-page-canvas">
      {rendering && <span>{renderMode === 'canvas' ? 'Đang dựng trang PDF…' : 'Đang mở bản xem trước…'}</span>}
      {error && <span>{error}</span>}
      <iframe className={renderMode === 'canvas' ? 'preview-hidden' : ''} key={previewUrl} src={previewUrl} title={`Xem trước trang ${pageNumber}`} onLoad={() => {
        if (renderMode !== 'native') return
        setRenderMode('viewer')
        setRendering(false)
      }} />
      <canvas className={renderMode === 'canvas' ? '' : 'preview-hidden'} ref={canvasRef} />
    </div>
    <div className="pdf-page-controls"><button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber(page => page - 1)}>←</button><b>Trang {pageNumber} / {info.pages}</b><button type="button" disabled={pageNumber >= info.pages} onClick={() => setPageNumber(page => page + 1)}>→</button></div>
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
  const canvasRef = useRef(null)
  const stageRef = useRef(null)
  const dragging = useRef(false)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageRatio, setPageRatio] = useState(595 / 842)
  const [rendering, setRendering] = useState(true)
  const [error, setError] = useState('')
  const point = position === 'custom' ? { x: xPercent, y: yPercent } : (pdfEditPresetPoints[position] || pdfEditPresetPoints['bottom-center'])
  const label = editType === 'page-numbers'
    ? `Trang ${pageNumber} / ${info.pages}`
    : (text || 'Nội dung').replaceAll('{page}', String(pageNumber)).replaceAll('{pages}', String(info.pages))

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
    render().catch(() => { if (!cancelled) setError('Không thể dựng trang PDF để đặt nội dung.') })
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
    <div className="preview-label"><span>Đặt trực tiếp trên trang</span><b>Kéo nội dung để di chuyển</b></div>
    <div className="pdf-edit-viewport">
      <div className="pdf-edit-stage" ref={stageRef} style={{ aspectRatio: pageRatio }} onPointerDown={event => {
        if (event.target.closest?.('.pdf-edit-overlay')) return
        dragging.current = true
        event.currentTarget.setPointerCapture?.(event.pointerId)
        moveToPointer(event)
      }} onPointerMove={event => { if (dragging.current) moveToPointer(event) }} onPointerUp={() => { dragging.current = false }} onPointerCancel={() => { dragging.current = false }}>
        {rendering && <span className="pdf-edit-status">Đang dựng trang PDF…</span>}
        {error && <span className="pdf-edit-status error">{error}</span>}
        <canvas ref={canvasRef} />
        <button type="button" className="pdf-edit-overlay" style={{ left: `${point.x}%`, top: `${point.y}%`, color, opacity: opacity / 100, fontSize: `${clamp(fontSize * 0.9, 9, 44)}px` }} onPointerDown={event => {
          dragging.current = true
          event.currentTarget.setPointerCapture?.(event.pointerId)
          moveToPointer(event)
        }} onPointerMove={event => { if (dragging.current) moveToPointer(event) }} onPointerUp={() => { dragging.current = false }} onPointerCancel={() => { dragging.current = false }} title="Giữ và kéo để đổi vị trí">{label}</button>
      </div>
    </div>
    <div className="pdf-page-controls"><button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber(page => page - 1)}>←</button><b>Trang {pageNumber} / {info.pages}</b><button type="button" disabled={pageNumber >= info.pages} onClick={() => setPageNumber(page => page + 1)}>→</button></div>
    <p className="pdf-edit-help">Preview dùng để đặt vị trí. PDF kết quả sẽ giữ nguyên nội dung gốc và thêm một lớp chữ mới lên trên.</p>
  </div>
}

function PdfPageThumbnail({ item, info, number, selected, mode, onSelect, onDropPage, onDragPage, onDelete, onInsert }) {
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

  const pageLabel = info.pages > 1 ? `${info.name} · trang ${item.pageIndex + 1}` : info.name
  const canEditPages = mode === 'pdf-merge' || mode === 'pdf-organize'
  return <article className={`pdf-page-card ${selected ? 'selected' : ''}`} draggable onDragStart={() => onDragPage(item.id)} onDragOver={event => event.preventDefault()} onDrop={() => onDropPage(item.id)}>
    <button className="page-check" type="button" aria-label={`${selected ? 'Bỏ chọn' : 'Chọn'} trang ${number}`} aria-pressed={selected} onClick={() => onSelect(item.id)}>{selected ? '✓' : ''}</button>
    <button className="page-thumbnail" type="button" onClick={() => onSelect(item.id)}>
      <span className="page-paper">{rendering && <i>Đang tải…</i>}{error && <i>Không thể xem</i>}<canvas ref={canvasRef} /></span>
      <span className="page-name" title={pageLabel}>{pageLabel}</span>
      <small>Trang {number}</small>
    </button>
    {canEditPages && <button className="page-delete" type="button" aria-label={`Xóa trang ${number}`} onClick={() => onDelete(item.id)}>×</button>}
    {canEditPages && <label className="page-insert"><input type="file" accept=".pdf,application/pdf" multiple aria-label={`Chèn PDF sau trang ${number}`} onChange={event => { onInsert(event.target.files, number); event.target.value = '' }} /><span>+</span></label>}
  </article>
}

function PdfPageBoard({ mode, pages, fileInfo, selectedPages, setSelectedPages, setPages, onAddFiles }) {
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
      <label className="select-all-pages"><input type="checkbox" checked={allSelected} onChange={selectAll} /><span>{allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</span></label>
      <span className="selection-count"><b>{selectedCount}</b> / {pages.length} trang được chọn</span>
      <div className="page-actions">
        {canEditPages && <label className="add-pages-button"><input type="file" accept=".pdf,application/pdf" multiple aria-label="Thêm PDF vào cuối" onChange={event => { onAddFiles(event.target.files, pages.length); event.target.value = '' }} /><span>＋ Thêm PDF</span></label>}
        {!canEditPages && <><button type="button" onClick={() => selectPreset('all')}>Tất cả</button><button type="button" onClick={() => selectPreset('odd')}>Trang lẻ</button><button type="button" onClick={() => selectPreset('even')}>Trang chẵn</button></>}
        <button type="button" disabled={!selectedCount} onClick={() => rotateSelected(-90)} aria-label="Xoay trái các trang đã chọn">↶ Xoay trái</button>
        <button type="button" disabled={!selectedCount} onClick={() => rotateSelected(90)} aria-label="Xoay phải các trang đã chọn">↷ Xoay phải</button>
        {canEditPages && <><button type="button" disabled={!selectedCount} onClick={() => moveSelected(-1)}>← Dịch trái</button><button type="button" disabled={!selectedCount} onClick={() => moveSelected(1)}>Dịch phải →</button><button type="button" disabled={!selectedCount} onClick={duplicateSelected}>Nhân bản</button><button type="button" disabled={pages.length < 2} onClick={() => setPages(current => [...current].reverse())}>Đảo thứ tự</button><button className="danger" type="button" disabled={!selectedCount || selectedCount === pages.length} onClick={() => deletePages(selectedPages)}>Xóa</button></>}
      </div>
    </div>
    <div className="page-board-tip"><span>{canEditPages ? 'Giữ và kéo thumbnail để đổi thứ tự trang.' : 'Nhấp vào từng thumbnail để chọn trang cần tách.'}</span><b>{canEditPages ? (isOrganize ? 'Có thể xoay, nhân bản, thêm hoặc xóa trang trước khi lưu.' : 'PDF kết quả theo thứ tự từ trái sang phải.') : 'Mỗi trang đã chọn sẽ được xuất thành một PDF trong tệp ZIP.'}</b></div>
    <div className="page-thumbnail-grid">
      {pages.map((item, index) => <PdfPageThumbnail key={item.id} item={item} info={fileInfo[item.fileIndex]} number={index + 1} selected={selectedPages.has(item.id)} mode={mode} onSelect={id => setSelectedPages(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })} onDragPage={id => { draggedPage.current = id }} onDropPage={dropPage} onDelete={id => deletePages(new Set([id]))} onInsert={onAddFiles} />)}
      {canEditPages && <label className="add-pdf-tile"><input type="file" accept=".pdf,application/pdf" multiple aria-label="Thêm PDF vào cuối tài liệu" onChange={event => { onAddFiles(event.target.files, pages.length); event.target.value = '' }} /><i>＋</i><b>Thêm PDF</b><small>Chèn thêm trang vào tài liệu</small></label>}
    </div>
  </section>
}

function MediaPreview({ info, title, checkerboard = false, imageStyle }) {
  if (!info) return null
  return <div className={`media-preview ${checkerboard ? 'checkerboard' : ''}`}>
    <div className="preview-label"><span>{title}</span><b>{formatBytes(info.size)}</b></div>
    {info.kind === 'image' && <img src={info.url} alt={title} style={imageStyle} />}
    {info.kind === 'pdf' && <PdfCanvasPreview info={info} />}
    {info.kind === 'archive' && <div className="archive-preview"><i>ZIP</i><strong>Kết quả đã sẵn sàng</strong><small>Các trang PDF được đóng gói trong một tệp ZIP.</small></div>}
    {info.kind === 'document' && <div className="document-preview"><i>{info.extension?.toUpperCase()}</i><strong>{info.outputLabel || 'Tệp đã sẵn sàng'}</strong>{info.pages && <small>{info.pages} trang · {Number(info.characters || 0).toLocaleString('vi-VN')} ký tự được trích xuất</small>}{info.previewText && <pre>{info.previewText}</pre>}</div>}
  </div>
}

function FileFacts({ info }) {
  if (!info) return null
  return <div className="file-facts">
    <span><small>Dung lượng</small><b>{formatBytes(info.size)}</b></span>
    {info.width && <span><small>Kích thước</small><b>{info.width} × {info.height} px</b></span>}
    {info.pages && <span><small>Số trang</small><b>{info.pages} trang</b></span>}
    <span><small>Định dạng</small><b>{info.extension?.toUpperCase() || 'Tệp'}</b></span>
  </div>
}

function RangeControl({ label, value, setValue, min, max, step = 1, suffix = '' }) {
  return <div className="adjustment-row"><div className="range-label"><span>{label}</span><b>{value}{suffix}</b></div><input type="range" min={min} max={max} step={step} value={value} onChange={event => setValue(Number(event.target.value))} /></div>
}

function CropPreview({ info, crop, setCrop, cropStageRef }) {
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
      <span>Tỷ lệ khung</span>
      <button type="button" onClick={() => applyRatio('free')}>Tự do</button>
      <button type="button" onClick={() => applyRatio(1)}>1:1</button>
      <button type="button" onClick={() => applyRatio(4 / 3)}>4:3</button>
      <button type="button" onClick={() => applyRatio(16 / 9)}>16:9</button>
    </div>
    <div className="crop-viewport">
      <div className="crop-canvas" ref={cropStageRef}>
        <img src={info.url} alt="Ảnh đang cắt" draggable="false" />
        <div className="crop-box" style={{ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.w}%`, height: `${crop.h}%` }} onPointerDown={begin} onPointerMove={move} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}>
          <span className="crop-grid vertical one" /><span className="crop-grid vertical two" /><span className="crop-grid horizontal one" /><span className="crop-grid horizontal two" />
          {['nw', 'ne', 'sw', 'se'].map(handle => <i key={handle} className={`crop-handle ${handle}`} data-handle={handle} />)}
          <b>{pixels?.width} × {pixels?.height}</b>
        </div>
      </div>
    </div>
    <p className="crop-help">Kéo bên trong khung để di chuyển · Kéo bốn góc để thu phóng</p>
  </div>
}

function ToolModal({ mode, close }) {
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
  const [pdfEditText, setPdfEditText] = useState('Danh Phạm')
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
  const fileAccept = mode === 'remove-background'
    ? '.png,.jpg,.jpeg,.webp'
    : isImage ? '.png,.jpg,.jpeg,.webp,.avif,image/png,image/jpeg,image/webp,image/avif' : '.pdf,application/pdf'

  useEffect(() => () => urlPool.current.forEach(url => { releaseThumbnailPdf(url); URL.revokeObjectURL(url) }), [])
  useEffect(() => () => {
    if (result?.url) {
      URL.revokeObjectURL(result.url)
      urlPool.current.delete(result.url)
    }
  }, [result?.url])
  const makeUrl = blob => { const url = URL.createObjectURL(blob); urlPool.current.add(url); return url }

  const analyze = async (blob, name = blob.name || 'kết-quả') => {
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
    if (nextFiles.some(file => file.size > maximumFileBytes)) return setMessage('Mỗi tệp không được vượt quá 25 MB.')
    if (nextFiles.reduce((sum, file) => sum + file.size, 0) > maximumUploadBytes) return setMessage('Tổng dung lượng mỗi lượt không được vượt quá 50 MB.')
    setLoading(true); setMessage('Đang đọc thông tin tệp…'); setResult(null)
    try {
      let extractedPreview = ''
      const nextInfo = await Promise.all(nextFiles.map(file => analyze(file)))
      if (isPageComposer && nextInfo.reduce((sum, info) => sum + (info.pages || 0), 0) > maximumPdfPages) throw new Error(`Mỗi lượt chỉ xử lý tối đa ${maximumPdfPages} trang PDF.`)
      setFiles(nextFiles); setFileInfo(nextInfo); setCrop({ x: 10, y: 10, w: 80, h: 80 })
      setBrightness(100); setContrast(100); setSaturation(100); setHue(0); setBlur(0); setRotation(0); setFlip(false); setFlop(false); setGrayscale(false)
      if (isPdfOffice) {
        setMessage('Đang đọc trước phần văn bản có thể chuyển đổi…')
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
        ? 'Không thấy chữ có thể chọn. PDF scan cần OCR trước khi tạo Word có thể chỉnh sửa.'
        : '')
    } catch (error) { setMessage(error.message || 'Không thể đọc tệp này.') }
    finally { setLoading(false) }
  }

  const addMergeFiles = async (selected, insertionIndex = pdfPages.length) => {
    const picked = Array.from(selected || [])
    if (!picked.length) return
    if (picked.some(file => file.size > maximumFileBytes)) return setMessage('Mỗi tệp không được vượt quá 25 MB.')
    if ([...files, ...picked].reduce((sum, file) => sum + file.size, 0) > maximumUploadBytes) return setMessage('Tổng dung lượng các PDF không được vượt quá 50 MB.')
    setLoading(true); setMessage('Đang thêm và dựng thumbnail PDF…'); setResult(null)
    try {
      const addedInfo = await Promise.all(picked.map(file => analyze(file)))
      const firstFileIndex = files.length
      const addedPages = makePageItems(addedInfo, firstFileIndex)
      if (pdfPages.length + addedPages.length > maximumPdfPages) throw new Error(`Mỗi lượt chỉ xử lý tối đa ${maximumPdfPages} trang PDF.`)
      const insertion = clamp(insertionIndex, 0, pdfPages.length)
      setFiles(current => [...current, ...picked])
      setFileInfo(current => [...current, ...addedInfo])
      setPdfPages(current => [...current.slice(0, insertion), ...addedPages, ...current.slice(insertion)])
      setMessage(`Đã thêm ${addedPages.length} trang. Kéo thumbnail để sắp xếp lại.`)
    } catch (error) { setMessage(error.message || 'Không thể thêm PDF này.') }
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

  const submit = async event => {
    event.preventDefault()
    if (!files.length) return setMessage('Hãy chọn tệp trước khi xử lý.')
    if (isPageComposer && !pdfPages.length) return setMessage('Tài liệu phải còn ít nhất một trang.')
    if (mode === 'pdf-split' && !selectedPages.size) return setMessage('Hãy chọn ít nhất một trang cần tách.')
    if (mode === 'pdf-edit' && pdfEditType === 'text' && !pdfEditText.trim()) return setMessage('Hãy nhập nội dung cần thêm vào PDF.')
    setLoading(true); setMessage('Đang xử lý tệp…'); setResult(null)
    try {
      let blob, name, outputMetadata = {}
      if (mode === 'pdf-to-word' && wordMode === 'exact') {
        const exactWord = await createExactWordFromPdf(files[0], setMessage)
        blob = exactWord.blob
        name = `${files[0].name.replace(/\.[^/.]+$/, '')}-giu-vi-tri-tung-dong.docx`
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
        setMessage('Đang chuẩn bị AI xóa phông…')
        const { removeBackground } = await import('@imgly/background-removal')
        const options = {
          model: backgroundQuality === 'high' ? 'isnet_fp16' : 'isnet_quint8',
          output: { format: 'image/png', quality: .95, type: 'foreground' },
          progress: (_key, current, total) => total && setMessage(`Đang tải mô hình AI: ${Math.round(current / total * 100)}%…`),
        }
        const run = device => removeBackground(files[0], { ...options, device })
        try { blob = await run(globalThis.navigator?.gpu ? 'gpu' : 'cpu') }
        catch (gpuError) { if (!globalThis.navigator?.gpu) throw gpuError; setMessage('GPU không khả dụng, đang chuyển sang CPU…'); blob = await run('cpu') }
        name = `${files[0].name.replace(/\.[^/.]+$/, '')}-no-background.png`
      } else if (mode === 'pdf-compress' && pdfCompression === 'target') {
        const compressed = await compressPdfToTarget(files[0], targetMb, pdfContentProfile, setMessage)
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
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'Không thể xử lý tệp.')
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
      setResult({ ...output, ...outputMetadata, previewText: output.previewText || (isPdfOffice ? pdfTextPreview : ''), outputLabel: mode === 'pdf-to-word' && wordMode === 'exact' ? 'Word giữ vị trí từng dòng đã sẵn sàng' : mode === 'pdf-to-word' ? 'Word có cấu trúc và đồ họa đã sẵn sàng' : isPdfOffice ? 'Tệp Office có thể chỉnh sửa đã sẵn sàng' : undefined, blob })
      if (mode === 'pdf-compress' && pdfCompression === 'target') {
        const targetBytes = Number(targetMb) * 1024 * 1024
        const proximity = Math.max(0, (targetBytes - blob.size) / targetBytes * 100)
        const { minimumDpi, maximumDpi } = outputMetadata.compression
        const dpiLabel = minimumDpi === maximumDpi ? `${minimumDpi} DPI` : `${minimumDpi}–${maximumDpi} DPI`
        setMessage(`Xử lý hoàn tất — thấp hơn mục tiêu ${proximity.toFixed(1)}%, độ nét ${dpiLabel}. Hãy xem preview trước khi tải.`)
      } else if (mode === 'pdf-compress' && pdfCompression === 'preserve') {
        setMessage(outputMetadata.savedBytes > 0
          ? `Tối ưu không mất dữ liệu hoàn tất — giữ nguyên chữ, liên kết và biểu mẫu; giảm ${formatBytes(outputMetadata.savedBytes)}.`
          : 'Tối ưu không mất dữ liệu hoàn tất — PDF gốc đã có cấu trúc tốt nên không thể giảm thêm mà vẫn giữ nguyên chữ, liên kết và biểu mẫu. Muốn giảm rõ rệt, hãy chọn “Đạt dung lượng mục tiêu”.')
      } else if (mode === 'pdf-to-word' && wordMode === 'exact') {
        const signatureNotice = outputMetadata.pdfSignatures ? `, gồm phần hiển thị của ${outputMetadata.pdfSignatures} chữ ký số` : ''
        setMessage(`Chuyển đổi hoàn tất — ${outputMetadata.wordTextBoxes.toLocaleString('vi-VN')} khối chữ đã được đặt theo vị trí trên ${outputMetadata.pages} trang${signatureNotice}. Đây là chế độ dự phòng; Word có cấu trúc thường dễ sửa và ổn định hơn.`)
      } else if (isPdfOffice) {
        const sourceLabel = pdfSourceLabels[outputMetadata.pdfSourceKind] || 'PDF có văn bản chọn được'
        const mixedNotice = outputMetadata.pdfImageOnlyPages ? `; ${outputMetadata.pdfImageOnlyPages} trang ảnh chưa có OCR` : ''
        const graphicsNotice = mode === 'pdf-to-word' && outputMetadata.wordEmbeddedGraphics ? `; giữ ${outputMetadata.wordEmbeddedGraphics} ảnh, dấu hoặc chữ ký hiển thị` : ''
        setMessage(`Chuyển đổi hoàn tất — ${sourceLabel.toLowerCase()}, đã trích xuất ${Number(outputMetadata.characters || 0).toLocaleString('vi-VN')} ký tự từ ${outputMetadata.pages || 0} trang${graphicsNotice}${mixedNotice}.`)
      }
      else setMessage('Xử lý hoàn tất — hãy xem preview và tải xuống khi đã hài lòng.')
    } catch (error) { setMessage(error.message || 'Không thể xử lý tệp này. Hãy thử lại.') }
    finally { setLoading(false) }
  }

  if (mode === 'soon') return <div className="modal-shade"><div className="tool-modal intro"><button className="close" onClick={close}>×</button><i>✦</i><h2>Tính năng đang hoàn thiện</h2><p>Công cụ này cần backend chuyên dụng để bảo toàn bố cục và nội dung. Chúng tôi chưa gắn nhãn hoạt động cho đến khi kiểm thử được toàn bộ luồng xử lý và tải xuống.</p><button className="primary" onClick={close}>Khám phá công cụ khác</button></div></div>

  const source = fileInfo[0]
  const inputSize = files.reduce((sum, file) => sum + file.size, 0)
  const reduction = result && inputSize ? Math.round((1 - result.size / inputSize) * 100) : null
  const targetBytes = Number(targetMb) * 1024 * 1024
  const targetRatio = files[0]?.size && Number.isFinite(targetBytes) ? Math.round(targetBytes / files[0].size * 100) : 0
  const imageEditStyle = mode === 'edit' ? {
    filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg) blur(${blur}px) grayscale(${grayscale ? 100 : 0}%)`,
    transform: `rotate(${rotation}deg) scaleX(${flop ? -1 : 1}) scaleY(${flip ? -1 : 1})`,
  } : undefined

  return <div className="modal-shade" role="dialog" aria-modal="true">
    <form className={`tool-modal ${files.length ? 'tool-modal-wide' : ''} ${isPdfOffice ? 'pdf-office-modal' : ''} ${mode === 'pdf-edit' ? 'pdf-edit-modal' : ''}`} onSubmit={submit}>
      <button className="close" type="button" onClick={close}>×</button>
      <div className="modal-heading"><i>✦</i><div><p>CÔNG CỤ PDFTOOLS</p><h2>{labels[mode]}</h2></div></div>
      <p className="modal-copy">{isOrganize ? 'Kéo thả để đổi thứ tự; xoay, nhân bản, thêm hoặc xóa trang rồi xem lại PDF trước khi tải.' : isMerge ? 'Xem từng trang, kéo để sắp xếp và chèn thêm PDF vào đúng vị trí.' : mode === 'pdf-split' ? 'Chọn trực tiếp các thumbnail cần tách; không cần nhớ hay nhập số trang.' : mode === 'crop' ? 'Đặt khung trực tiếp trên ảnh; phần sáng bên trong là vùng sẽ được giữ lại.' : mode === 'pdf-compress' ? 'Nhập dung lượng cần đạt; PDFTools sẽ tự cân chỉnh nhiều lượt để tệp nằm ngay dưới mục tiêu.' : mode === 'pdf-edit' ? 'Thêm chữ Unicode, watermark hoặc số trang vào vị trí bạn chọn rồi xem trước PDF kết quả.' : mode === 'pdf-to-word' ? 'Mặc định dựng lại đoạn văn, bảng và cột Word thật; ảnh, con dấu và chữ ký nhìn thấy được neo lại theo vị trí trên trang.' : isPdfOffice ? 'Trích xuất phần văn bản có thể chọn thành tệp Office; PDF scan cần OCR trước.' : mode === 'edit' ? 'Điều chỉnh trực tiếp trên preview, sau đó tạo ảnh thật bằng cùng thông số.' : 'Tệp chỉ được tải xuống sau khi bạn đã xem preview kết quả.'}</p>

      {!files.length ? <div className="drop-zone" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); choose(event.dataTransfer.files) }}>
        <input ref={input} className="drop-file-input" aria-label="Chọn tệp từ máy tính" type="file" accept={fileAccept} multiple={isPageComposer} onChange={event => choose(event.target.files)} />
        <span>⇧</span><b>Kéo thả {isPageComposer ? 'các tệp' : 'tệp'} vào đây</b><small>hoặc nhấp để chọn từ máy tính · tối đa 25 MB mỗi tệp, 50 MB mỗi lượt{isPdf ? ' · 500 trang PDF' : ''}</small>
      </div> : <>
        <input ref={input} className="file-input" aria-label="Đổi tệp từ máy tính" type="file" accept={fileAccept} multiple={isPageComposer} onChange={event => choose(event.target.files)} />
        <div className="selected-file-bar"><div><i>{isPdf ? 'PDF' : 'IMG'}</i><span><b>{files.length > 1 ? `${files.length} tệp đã chọn` : files[0].name}</b><small>{files.length > 1 ? `${formatBytes(files.reduce((sum, file) => sum + file.size, 0))} tổng cộng` : formatBytes(files[0].size)}</small></span></div><button type="button" onClick={() => input.current?.click()}>Đổi tệp</button></div>

        {mode === 'pdf-split' && <FileFacts info={source} />}
        {(isPageComposer || mode === 'pdf-split') ? <PdfPageBoard mode={mode} pages={pdfPages} fileInfo={fileInfo} selectedPages={selectedPages} setSelectedPages={setSelectedPages} setPages={setPdfPages} onAddFiles={addMergeFiles} /> : <>
          <FileFacts info={source} />
          <div className="editor-layout">
          <div className="editor-preview">
            {mode === 'crop' ? <CropPreview info={source} crop={crop} setCrop={setCrop} cropStageRef={cropStageRef} />
              : mode === 'pdf-edit' ? <PdfEditPreview info={source} editType={pdfEditType} text={pdfEditText} position={pdfEditPosition} setPosition={setPdfEditPosition} xPercent={pdfEditX} setXPercent={setPdfEditX} yPercent={pdfEditY} setYPercent={setPdfEditY} fontSize={pdfEditFontSize} color={pdfEditColor} opacity={pdfEditOpacity} />
                : <MediaPreview info={source} title={mode === 'edit' ? 'Preview chỉnh sửa' : 'Bản gốc'} imageStyle={imageEditStyle} />}
          </div>
          <div className="editor-controls">
            {mode === 'remove-background' && <div className="control-group"><span>Chế độ AI</span><div className="option-cards"><button type="button" className={backgroundQuality === 'balanced' ? 'active' : ''} onClick={() => setBackgroundQuality('balanced')}><b>Nhanh</b><small>~40 MB · ảnh thông thường</small></button><button type="button" className={backgroundQuality === 'high' ? 'active' : ''} onClick={() => setBackgroundQuality('high')}><b>Chất lượng cao</b><small>~80 MB · viền tóc tốt hơn</small></button></div></div>}

            {isImage && mode !== 'remove-background' && <>
              <div className="control-group"><label>Định dạng kết quả<select value={format} onChange={event => setFormat(event.target.value)}><option value="webp">WebP — nhẹ, hiện đại</option><option value="jpeg">JPG — tương thích cao</option><option value="png">PNG — không mất dữ liệu</option><option value="avif">AVIF — dung lượng thấp</option></select></label></div>
              <div className="control-group"><div className="range-label"><span>Chất lượng</span><b>{quality}%</b></div><input type="range" min="20" max="100" value={quality} onChange={event => setQuality(event.target.value)} /><small>Chất lượng thấp hơn thường tạo tệp nhẹ hơn. PNG có thể ít thay đổi.</small></div>
              {mode === 'resize' && <div className="control-group"><div className="dimensions"><label>Rộng (px)<input inputMode="numeric" value={width} onChange={event => resizeValue('width', event.target.value)} /></label><label>Cao (px)<input inputMode="numeric" value={height} onChange={event => resizeValue('height', event.target.value)} /></label></div><button className={`ratio-lock ${lockRatio ? 'active' : ''}`} type="button" onClick={() => setLockRatio(!lockRatio)}>{lockRatio ? '🔗 Đang khóa tỷ lệ' : 'Mở khóa tỷ lệ'}</button></div>}
              {mode === 'edit' && <>
                <div className="control-group adjustment-stack"><span>Màu sắc và hiệu ứng</span><RangeControl label="Độ sáng" value={brightness} setValue={setBrightness} min={20} max={180} suffix="%" /><RangeControl label="Tương phản" value={contrast} setValue={setContrast} min={20} max={180} suffix="%" /><RangeControl label="Độ bão hòa" value={saturation} setValue={setSaturation} min={0} max={200} suffix="%" /><RangeControl label="Sắc độ" value={hue} setValue={setHue} min={-180} max={180} suffix="°" /><RangeControl label="Làm mờ" value={blur} setValue={setBlur} min={0} max={8} step={0.2} suffix="px" /></div>
                <div className="control-group"><span>Xoay và lật</span><div className="edit-actions"><button type="button" onClick={() => setRotation(value => (value + 270) % 360)}>↶ Xoay trái</button><button type="button" onClick={() => setRotation(value => (value + 90) % 360)}>↷ Xoay phải</button><button type="button" className={flop ? 'active' : ''} onClick={() => setFlop(!flop)}>↔ Lật ngang</button><button type="button" className={flip ? 'active' : ''} onClick={() => setFlip(!flip)}>↕ Lật dọc</button><button type="button" className={grayscale ? 'active' : ''} onClick={() => setGrayscale(!grayscale)}>◐ Trắng đen</button></div></div>
              </>}
            </>}

            {mode === 'pdf-edit' && <>
              <div className="control-group"><span>Nội dung thêm</span><div className="option-cards"><button type="button" className={pdfEditType === 'text' ? 'active' : ''} onClick={() => setPdfEditType('text')}><b>Chữ / watermark</b><small>Hỗ trợ {`{page}`} và {`{pages}`}</small></button><button type="button" className={pdfEditType === 'page-numbers' ? 'active' : ''} onClick={() => setPdfEditType('page-numbers')}><b>Đánh số trang</b><small>Tự tạo Trang 1 / N</small></button></div></div>
              {pdfEditType === 'text' && <div className="control-group"><label>Nội dung<input maxLength="120" value={pdfEditText} onChange={event => setPdfEditText(event.target.value)} placeholder="Ví dụ: Danh Phạm · Trang {page}" /></label></div>}
              <div className="control-group"><label>Áp dụng cho trang<input value={pdfEditPages} onChange={event => setPdfEditPages(event.target.value)} placeholder="Để trống = tất cả · Ví dụ 1-3, 5" /></label></div>
              <div className="control-group"><label>Vị trí<select value={pdfEditPosition} onChange={event => setPdfEditPosition(event.target.value)}><option value="custom">Tự kéo trên trang</option><option value="top-left">Trên trái</option><option value="top-center">Trên giữa</option><option value="top-right">Trên phải</option><option value="center">Chính giữa</option><option value="bottom-left">Dưới trái</option><option value="bottom-center">Dưới giữa</option><option value="bottom-right">Dưới phải</option></select></label><small>Kéo nội dung ngay trên preview để chuyển sang vị trí tùy chỉnh.</small></div>
              {pdfEditPosition === 'custom' && <div className="control-group adjustment-stack"><span>Tọa độ chính xác</span><RangeControl label="Ngang" value={pdfEditX} setValue={setPdfEditX} min={2} max={98} step={0.5} suffix="%" /><RangeControl label="Dọc" value={pdfEditY} setValue={setPdfEditY} min={2} max={98} step={0.5} suffix="%" /></div>}
              <div className="control-group adjustment-stack"><span>Kiểu hiển thị</span><RangeControl label="Cỡ chữ" value={pdfEditFontSize} setValue={setPdfEditFontSize} min={8} max={48} suffix=" pt" /><RangeControl label="Độ đậm" value={pdfEditOpacity} setValue={setPdfEditOpacity} min={10} max={100} suffix="%" /><label className="color-control">Màu chữ<input type="color" value={pdfEditColor} onChange={event => setPdfEditColor(event.target.value)} /></label></div>
              <div className="control-note"><b>Phạm vi chỉnh sửa thực tế</b><span>Công cụ thêm lớp chữ mới lên PDF; chưa sửa hoặc xóa trực tiếp chữ gốc. Preview vị trí được đồng bộ bằng phần trăm với tệp kết quả.</span></div>
            </>}

            {isPdfOffice && <>
              {mode === 'pdf-to-word' && <div className="control-group word-mode-control"><span>Kiểu tệp Word</span><div className="option-cards"><button type="button" className={wordMode === 'editable' ? 'active' : ''} onClick={() => { setWordMode('editable'); setResult(null); setMessage(pdfTextPreview ? 'Word sẽ có đoạn văn, cột và bảng thật; ảnh, dấu và chữ ký nhìn thấy được giữ theo vị trí.' : 'PDF chưa có lớp chữ để tạo Word có cấu trúc. Hãy OCR trước.') }}><b>Word có cấu trúc <em>Khuyên dùng</em></b><small>Đoạn và bảng thật · giữ ảnh, dấu, chữ ký · dễ chỉnh sửa</small></button><button type="button" className={wordMode === 'exact' ? 'active' : ''} onClick={() => { setWordMode('exact'); setResult(null); setMessage(pdfTextPreview ? 'Mỗi dòng chữ sẽ thành text box theo tọa độ; phù hợp làm phương án dự phòng khi bố cục đặc biệt.' : 'PDF chưa có lớp chữ. Hãy OCR trước khi dùng chế độ giữ vị trí.') }}><b>Giữ vị trí từng dòng</b><small>Text box theo tọa độ · khó sửa dài · có thể lệch giữa các phần mềm Word</small></button></div></div>}
              {pdfDiagnosis && <div className={`pdf-diagnosis ${pdfDiagnosis.sourceKind}`}><strong>{pdfSourceLabels[pdfDiagnosis.sourceKind]}</strong><span>{mode === 'pdf-to-word' && wordMode === 'exact' ? pdfDiagnosis.sourceKind === 'scan' ? 'Không thấy lớp chữ trong các trang đã kiểm tra. Cần OCR trước khi tạo Word có thể chỉnh sửa.' : pdfDiagnosis.sourceKind === 'mixed' ? 'Một số trang chỉ có ảnh. Hãy OCR các trang đó trước để toàn bộ chữ trong Word đều sửa được.' : pdfDiagnosis.signatureCount ? `Phát hiện ${pdfDiagnosis.signatureCount} chữ ký số. Chế độ dự phòng đặt chữ thành text box và giữ phần nhìn thấy của chữ ký ở nền; hiệu lực mật mã không chuyển sang DOCX.` : 'Có lớp chữ để đặt lại từng dòng theo tọa độ; chế độ này khó chỉnh sửa hơn Word có cấu trúc.' : pdfDiagnosis.sourceKind === 'word-export' ? 'Metadata cho thấy PDF có thể được xuất từ Word; hệ thống sẽ dựng lại đoạn, cột và bảng Word thật.' : pdfDiagnosis.sourceKind === 'signed-document' ? `Phát hiện ${pdfDiagnosis.signatureCount} chữ ký số. Công cụ giữ phần dấu/chữ ký nhìn thấy được và dựng nội dung thành Word có cấu trúc; hiệu lực chữ ký số không chuyển sang DOCX.` : pdfDiagnosis.sourceKind === 'scan' ? 'Không thấy lớp chữ trong các trang đã kiểm tra. Cần OCR trước khi chuyển.' : pdfDiagnosis.sourceKind === 'mixed' ? 'Một số trang có chữ, một số trang chỉ có ảnh; trang ảnh sẽ cần OCR.' : 'Có lớp chữ để tái dựng thành đoạn văn, bảng và hình ảnh trong Word.'}</span><small>Kiểm tra nhanh {pdfDiagnosis.sampledPages}/{pdfDiagnosis.totalPages} trang{pdfDiagnosis.producer ? ` · Trình tạo: ${pdfDiagnosis.producer}` : ''}{pdfDiagnosis.hasStructTree ? ' · Có cấu trúc PDF được gắn thẻ' : ''}</small></div>}
              <div className="control-note office-note"><b>{mode === 'pdf-to-word' && wordMode === 'exact' ? 'Giữ vị trí từng dòng — phương án dự phòng' : mode === 'pdf-to-word' ? 'Word có cấu trúc gần bản PDF' : 'Chuyển đổi văn bản có thể chỉnh sửa'}</b><span>{mode === 'pdf-to-word' && wordMode === 'exact' ? `PDFTools đặt từng dòng chữ vào text box theo tọa độ và giữ lớp đồ họa nền ${exactWordDpi} DPI. Cách này ưu tiên vị trí nhưng khó sửa đoạn dài và có thể khác nhau giữa Word/LibreOffice.` : mode === 'pdf-to-word' ? 'Dựng lại đoạn văn, tiêu đề hai cột và bảng thành phần tử Word thật; ảnh, dấu và chữ ký được tách khỏi PDF rồi neo theo tọa độ trang.' : mode === 'pdf-to-excel' ? 'Mỗi trang thành một sheet; khoảng cách lớn được tách thành cột.' : mode === 'pdf-to-powerpoint' ? 'Mỗi trang thành một slide; chữ được đặt gần vị trí gốc.' : 'Xuất văn bản UTF-8, phân tách rõ từng trang.'}</span><em>{mode === 'pdf-to-word' && wordMode === 'exact' ? `Tối đa ${maximumExactWordPages} trang/lượt và chỉ dùng cho PDF có chữ chọn được. Một số font nhúng đặc biệt có thể được Word thay thế; chữ ký số không còn giá trị xác thực.` : pdfTextPreview ? `Đã đọc trước ${pdfTextPreview.replace(/\s/g, '').length.toLocaleString('vi-VN')} ký tự. Kết quả giữ phần nhìn thấy của chữ ký nhưng không thể khôi phục file Word gốc hay hiệu lực chữ ký số.` : 'Chưa tìm thấy chữ có thể chọn trong phần xem trước.'}</em></div>
            </>}

            {mode === 'pdf-compress' && <>
              <div className="control-group"><span>Kiểu nén</span><div className="option-cards"><button type="button" className={pdfCompression === 'target' ? 'active' : ''} onClick={() => setPdfCompression('target')}><b>Đạt dung lượng mục tiêu</b><small>Nén từng trang, tự cân bằng độ nét để bám sát số MB</small></button><button type="button" className={pdfCompression === 'preserve' ? 'active' : ''} onClick={() => setPdfCompression('preserve')}><b>Không mất dữ liệu</b><small>Giữ chữ, liên kết và biểu mẫu; có thể giảm 0%</small></button></div></div>
              {pdfCompression === 'target' ? <>
                <div className="control-group"><span>Nội dung PDF</span><div className="option-cards"><button type="button" className={pdfContentProfile === 'document' ? 'active' : ''} onClick={() => setPdfContentProfile('document')}><b>Tài liệu / chữ</b><small>Ưu tiên DPI cao để chữ nhỏ và nét mảnh rõ hơn</small></button><button type="button" className={pdfContentProfile === 'photo' ? 'active' : ''} onClick={() => setPdfContentProfile('photo')}><b>Ảnh / màu sắc</b><small>Ưu tiên chuyển sắc và giảm vỡ màu ở ảnh chụp</small></button></div></div>
                <div className="control-group target-size-control">
                  <label>Dung lượng tối đa<input type="number" min="0.1" max={files[0] ? Math.max(0.1, files[0].size / 1024 / 1024 - 0.01).toFixed(2) : undefined} step="0.1" value={targetMb} onChange={event => setTargetMb(event.target.value)} /></label><b>MB</b>
                  <div className="target-summary"><span>Mục tiêu tối ưu</span><strong>{Number(targetMb) > 0 ? `${(Number(targetMb) * 0.95).toFixed(2)}–${(Number(targetMb) * 0.99).toFixed(2)} MB` : '—'}</strong><small>{targetRatio > 0 ? `Khoảng ${targetRatio}% tệp gốc · luôn ưu tiên không vượt ${targetMb || 0} MB` : 'Nhập dung lượng cần đạt'}</small></div>
                  <p>Chế độ này làm phẳng mỗi trang thành ảnh PNG/JPEG: hình thức được giữ, nhưng chữ, liên kết và biểu mẫu sẽ không còn chọn hoặc chỉnh sửa được.</p>
                </div>
              </> : <div className="control-note"><b>Tối ưu không mất dữ liệu là gì?</b><span>Không biến trang thành ảnh: chữ vẫn chọn/copy được, liên kết và biểu mẫu được giữ nguyên. Chế độ này chỉ tối ưu cấu trúc PDF, nên tệp đã nén tốt có thể giảm 0% — đây không phải lỗi.</span></div>}
            </>}

          </div>
          </div>
        </>}
      </>}

      <button className="primary process" disabled={loading}>{loading ? 'Đang xử lý…' : !files.length ? 'Chọn tệp để bắt đầu' : isOrganize ? `Lưu PDF gồm ${pdfPages.length} trang  →` : isMerge ? `Ghép ${pdfPages.length} trang  →` : mode === 'pdf-split' ? `Tách ${selectedPages.size} trang  →` : mode === 'pdf-to-word' && wordMode === 'exact' ? 'Tạo Word giữ vị trí  →' : mode === 'pdf-to-word' ? 'Tạo Word có cấu trúc  →' : isPdfOffice ? 'Chuyển đổi và xem kết quả  →' : mode === 'pdf-compress' && pdfCompression === 'preserve' ? 'Tối ưu không mất dữ liệu  →' : 'Tạo bản xem trước kết quả  →'}</button>
      {message && <p className={`result ${message.includes('hoàn tất') ? 'success' : ''}`}>{message}</p>}

      {result && <div className="result-workspace">
        <div className="result-heading"><div><span>KẾT QUẢ</span><h3>{result.name}</h3></div><a className="primary download-result" href={result.url} download={result.name}>Tải xuống <b>↓</b></a></div>
        <div className="result-comparison"><MediaPreview info={fileInfo[0]} title="Trước xử lý" /><MediaPreview info={result.wordLayoutMode === 'exact-text-boxes' ? fileInfo[0] : result} title={result.wordLayoutMode === 'exact-text-boxes' ? 'Sau xử lý · bố cục chính xác' : 'Sau xử lý'} checkerboard={mode === 'remove-background'} /></div>
        <div className="result-stats"><span><small>Trước</small><b>{formatBytes(inputSize)}</b></span><i>→</i><span><small>Sau</small><b>{formatBytes(result.size)}</b></span>{reduction !== null && <strong className={reduction >= 0 ? 'positive' : 'negative'}>{reduction >= 0 ? `Giảm ${reduction}%` : `Tăng ${Math.abs(reduction)}%`}</strong>}{result.width && <span><small>Kích thước mới</small><b>{result.width} × {result.height}px</b></span>}{result.pages && <span><small>Số trang</small><b>{result.pages} trang</b></span>}{result.compression && <span><small>Độ nét trang</small><b>{result.compression.minimumDpi === result.compression.maximumDpi ? `${result.compression.minimumDpi} DPI` : `${result.compression.minimumDpi}–${result.compression.maximumDpi} DPI`}</b></span>}{result.compression && <span><small>Mã hóa ảnh</small><b>{result.compression.losslessPages ? `${result.compression.losslessPages} trang PNG` : `JPEG ${result.compression.averageQuality}%`}</b></span>}{result.compressionMode === 'lossless' && <span><small>Nội dung</small><b>Giữ chữ · link · form</b></span>}{result.pdfSourceKind && <span><small>Loại PDF</small><b>{pdfSourceLabels[result.pdfSourceKind] || result.pdfSourceKind}</b></span>}{result.wordLayoutMode && <span><small>Chế độ Word</small><b>{result.wordLayoutMode === 'exact-text-boxes' ? 'Giữ vị trí từng dòng' : 'Đoạn + bảng + đồ họa'}</b></span>}{result.wordTextBoxes > 0 && <span><small>Chữ chỉnh sửa</small><b>{result.wordTextBoxes.toLocaleString('vi-VN')} khối</b></span>}{result.exactDpi && <span><small>Nền đồ họa</small><b>{result.exactDpi} DPI · {result.exactImageFormats}</b></span>}{result.wordDetectedTables > 0 && <span><small>Bảng nhận diện</small><b>{result.wordDetectedTables} bảng Word</b></span>}{result.wordEmbeddedGraphics > 0 && <span><small>Đồ họa giữ lại</small><b>{result.wordEmbeddedGraphics} ảnh/dấu/chữ ký</b></span>}{result.pdfSignatures > 0 && <span><small>Chữ ký PDF</small><b>{result.pdfSignatures} · giữ phần nhìn thấy, không giữ hiệu lực</b></span>}{result.pdfImageOnlyPages > 0 && <span><small>Chưa OCR</small><b>{result.pdfImageOnlyPages} trang ảnh</b></span>}</div>
      </div>}
    </form>
  </div>
}

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('pdftools-theme') === 'dark')
  const [modal, setModal] = useState(null)
  const [query, setQuery] = useState('')
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('pdftools-theme', dark ? 'dark' : 'light') }, [dark])
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
  const count = useMemo(() => [...pdfTools, ...imageTools].filter(tool => tool.name.toLowerCase().includes(query.toLowerCase())).length, [query])

  return <div className="app redesigned"><header className="header"><a className="brand" href="#home" aria-label="PDFTools — Trang chủ"><BrandLogo /></a><nav><a className="active" href="#home">Trang chủ</a><a href="#pdf">PDF Tools</a><a href="#images">Image Tools</a><a href="#benefits">Vì sao chọn chúng tôi</a></nav><div className="header-actions"><button className="theme-toggle" aria-label="Đổi chế độ màu" onClick={() => setDark(!dark)}>{dark ? '☀' : '☾'}</button><button className="language">VI</button><a className="header-cta" href="#pdf">Dùng miễn phí <span>→</span></a></div></header><main id="home"><section className="hero"><div className="hero-copy"><div className="hero-kicker"><span>✦</span> Bộ công cụ tài liệu trực tuyến</div><h1>Làm việc với<br /><em>PDF &amp; hình ảnh</em><br />nhẹ nhàng hơn.</h1><p className="hero-text">Nén, chuyển đổi và xử lý tệp trong vài bước.<br />Nhanh chóng, rõ ràng và luôn tôn trọng dữ liệu của bạn.</p><label className="search"><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Bạn muốn làm gì với tệp của mình?" /><small>{query && `${count} công cụ`}</small></label><div className="hero-trust"><span>✓ Không cần đăng ký</span><span>✓ Giao diện tiếng Việt</span><span>✓ Preview trước khi tải</span></div></div><div className="hero-illustration"><div className="document"><div className="doc-dots">●　●　●</div><div className="doc-sidebar" /><div className="doc-lines"><b /><b /><b /><b /><div /><b /></div></div><span className="hero-chip pdf">PDF</span><span className="hero-chip word">W</span><span className="hero-chip image">▣</span><span className="hero-chip add">＋</span><i className="spark s1">✦</i><i className="spark s2">✦</i></div></section><div className="content"><ToolSection title="Công cụ PDF" tools={pdfTools} id="pdf" open={setModal} query={query} /><ToolSection title="Công cụ Ảnh" tools={imageTools} id="images" open={setModal} query={query} /><section className="benefits" id="benefits"><Benefit icon="♢" title="Không lưu tệp lâu dài" text="Tệp chỉ được xử lý trong bộ nhớ hoặc ngay trên trình duyệt, không tạo hồ sơ lưu trữ trên máy chủ." /><Benefit icon="ϟ" title="Xử lý tối ưu" text="Mỗi luồng ảnh và PDF được tối ưu riêng, kèm trạng thái rõ ràng trong lúc chờ." /><Benefit icon="☁" title="Hỗ trợ mọi thiết bị" text="Sử dụng dễ dàng trên mọi thiết bị, mọi nền tảng." /><Benefit icon="✪" title="Dùng miễn phí" text="Các công cụ hiện tại được sử dụng miễn phí, không cần đăng ký tài khoản." /></section></div></main><footer><div className="footer-top"><div className="footer-brand"><a className="brand" href="#home" aria-label="PDFTools — Trang chủ"><BrandLogo /></a><p>Một nơi đơn giản để xử lý mọi tài liệu và hình ảnh của bạn.</p></div><Footer title="Sản phẩm" items={footerProducts} /><Footer title="Liên hệ" items={footerContacts} /><div className="newsletter"><p>CẬP NHẬT SẢN PHẨM</p><h3>Theo dõi mã nguồn và phiên bản mới</h3><a className="newsletter-link" href="https://github.com/phamcongdanh98/Web-tool-ALL" target="_blank" rel="noreferrer">Mở GitHub <span>↗</span></a></div></div><div className="copyright"><span>© 2026 PDFTools · Làm việc thông minh hơn, mỗi ngày.</span><span className="footer-signature">Phát triển bởi <strong>Danh Phạm</strong><span className="version-badge" title={`Mã Git kỹ thuật: ${appRevision}`}>Phiên bản {appVersion}<i>•</i>Bản dựng #{appBuildNumber}</span></span></div></footer>{modal && <ToolModal mode={modal} close={() => setModal(null)} />}</div>
}

function Benefit({ icon, title, text }) { return <div><i>{icon}</i><span><strong>{title}</strong><small>{text}</small></span></div> }
function Footer({ title, items }) {
  return <div className="footer-column"><h3>{title}</h3>{items.map(item => {
    const external = item.href.startsWith('http')
    return <a className={item.detail ? 'contact-link' : ''} href={item.href} key={item.label} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined} aria-label={item.detail ? `${item.label} — ${item.detail}` : undefined}><span>{item.label}</span>{item.detail && <small>{item.detail}</small>}{external && <b aria-hidden="true">↗</b>}</a>
  })}</div>
}
