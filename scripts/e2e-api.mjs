import assert from 'node:assert/strict'
import ExcelJS from '@excel.js/exceljs'
import http from 'node:http'
import JSZip from 'jszip'
import path from 'node:path'
import sharp from 'sharp'
import { PDFDocument, PDFName, StandardFonts } from 'pdf-lib'
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createExactWordBuffer } from '../lib/exact-word.js'

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:13999'
const standardFontDataUrl = path.resolve('node_modules/pdfjs-dist/standard_fonts') + path.sep

const request = async (path, form) => {
  const response = await fetch(`${baseUrl}${path}`, { method: 'POST', body: form })
  const body = Buffer.from(await response.arrayBuffer())
  assert.equal(response.status, 200, `${path} trả HTTP ${response.status}: ${body.toString('utf8').slice(0, 300)}`)
  assert.ok(body.length > 0, `${path} trả về file rỗng.`)
  return { response, body }
}

const requestError = async (path, form, expectedStatus) => {
  const response = await fetch(`${baseUrl}${path}`, { method: 'POST', body: form })
  const body = await response.json()
  assert.equal(response.status, expectedStatus, `${path} cần trả HTTP ${expectedStatus}.`)
  return body
}

const requestWithHeadersOnly = (path, headers) => new Promise((resolve, reject) => {
  const url = new URL(`${baseUrl}${path}`)
  const req = http.request({ hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST', headers }, response => {
    const chunks = []
    response.on('data', chunk => chunks.push(chunk))
    response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks) }))
  })
  req.on('error', reject)
  req.end()
})

const openHeldUpload = path => {
  const url = new URL(`${baseUrl}${path}`)
  const req = http.request({
    agent: false,
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data; boundary=pdftools-held-upload',
      'Content-Length': '1024',
      Connection: 'close',
    },
  })
  req.on('error', () => {})
  req.flushHeaders()
  return req
}

const makePdf = async (width, height) => {
  const pdf = await PDFDocument.create()
  pdf.addPage([width, height])
  return Buffer.from(await pdf.save())
}

const makeTextPdf = async () => {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const first = pdf.addPage([595, 842])
  first.drawText('PDFTools editable office test', { x: 50, y: 780, size: 18, font })
  first.drawText('Name    Quantity    Price', { x: 50, y: 730, size: 12, font })
  first.drawText('Apple    2    30000', { x: 50, y: 705, size: 12, font })
  const second = pdf.addPage([595, 842])
  second.drawText('Second page content', { x: 50, y: 780, size: 18, font })
  return Buffer.from(await pdf.save())
}

const makeWordExportPdf = async () => {
  const pdf = await PDFDocument.create()
  pdf.setCreator('Microsoft® Word for Microsoft 365')
  pdf.setProducer('Microsoft® Word for Microsoft 365')
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic)
  const page = pdf.addPage([595, 842])
  const heading = 'WORD EXPORT HEADING'
  page.drawText(heading, { x: (595 - bold.widthOfTextAtSize(heading, 20)) / 2, y: 780, size: 20, font: bold })
  page.drawText('Editable paragraph reconstructed from PDF.', { x: 54, y: 728, size: 12, font: regular })
  page.drawText('Italic source style', { x: 54, y: 704, size: 11, font: italic })
  return Buffer.from(await pdf.save())
}

const makeStructuredLetterPdf = async () => {
  const pdf = await PDFDocument.create()
  pdf.setCreator('Microsoft Word for Microsoft 365')
  pdf.setProducer('Microsoft Word for Microsoft 365')
  const regular = await pdf.embedFont(StandardFonts.TimesRoman)
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold)
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic)
  const page = pdf.addPage([595, 842])
  const draw = (text, x, y, options = {}) => page.drawText(text, { x, y, size: options.size || 14, font: options.bold ? bold : options.italic ? italic : regular })

  draw('UBND PHUONG NAM NHA TRANG', 62, 801, { size: 13 })
  draw('CONG HOA XA HOI CHU NGHIA VIET NAM', 296, 801, { size: 13, bold: true })
  draw('TRUNG TAM PVHC CONG', 79, 785, { bold: true })
  draw('Doc lap - Tu do - Hanh phuc', 344, 785, { bold: true })
  draw('So: 278/TTPVHCC', 115, 754, { size: 13 })
  draw('Nam Nha Trang, ngay 18 thang 08 nam 2026', 305, 753, { italic: true })
  draw('V/v danh sach ho so tre han', 100, 734, { size: 12 })
  draw('Kinh gui: Don vi kiem tra', 225, 706)
  draw('Thuc hien y kien chi dao, Trung tam bao cao so luong ho so tre han nhu sau:', 121, 678)
  draw('Noi dung tiep theo cua doan van duoc tai dung thanh dong chay co the sua.', 85, 662)
  draw('Trong 849 ho so dang giai quyet, co cac nhom cu the:', 121, 630)

  const x = [85, 121, 331, 447, 552]
  const y = [468, 433, 399, 364, 329, 294, 259]
  x.forEach(value => page.drawLine({ start: { x: value, y: y.at(-1) }, end: { x: value, y: y[0] }, thickness: 0.8 }))
  y.forEach(value => page.drawLine({ start: { x: x[0], y: value }, end: { x: x.at(-1), y: value }, thickness: 0.8 }))
  draw('Dang giai quyet 849 ho so', 352, 450, { bold: true })
  draw('STT', 94, 433, { bold: true })
  draw('Linh vuc', 193, 433, { bold: true })
  draw('Con han', 345, 416, { bold: true })
  draw('Qua han', 462, 416, { bold: true })
  ;[
    ['1', 'Dat dai', '800', '41', 382],
    ['2', 'Tai chinh dat dai', '0', '5', 347],
    ['3', 'Dang ky cu tru', '3', '0', 312],
  ].forEach(([number, field, onTime, overdue, baseline]) => {
    draw(number, 103, baseline)
    draw(field, 133, baseline)
    draw(onTime, 360, baseline)
    draw(overdue, 480, baseline)
  })
  draw('Tong', 204, 277, { bold: true })
  draw('803', 360, 277)
  draw('46', 480, 277)
  draw('Kinh bao cao Don vi kiem tra./.', 121, 243)
  draw('(Dinh kem danh sach)', 121, 215, { italic: true })
  draw('Noi nhan:', 90, 187, { size: 12, bold: true })
  draw('GIAM DOC', 396, 187, { bold: true })
  draw('- Nhu tren;', 90, 171, { size: 11 })
  draw('- Luu: VT.', 90, 155, { size: 11 })
  draw('NGUYEN VAN A', 385, 107, { bold: true })
  const signatureField = pdf.context.register(pdf.context.obj({ FT: PDFName.of('Sig'), T: 'Signature1' }))
  pdf.catalog.set(PDFName.of('AcroForm'), pdf.context.obj({ Fields: [signatureField], SigFlags: 3 }))
  return Buffer.from(await pdf.save({ useObjectStreams: false }))
}

const makeImagePdf = async (image, withText = false) => {
  const pdf = await PDFDocument.create()
  if (withText) {
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const textPage = pdf.addPage([595, 842])
    textPage.drawText('Selectable page before scanned page', { x: 50, y: 780, size: 16, font })
  }
  const imagePage = pdf.addPage([595, 842])
  const embedded = await pdf.embedPng(image)
  imagePage.drawImage(embedded, { x: 40, y: 100, width: 515, height: 640 })
  return Buffer.from(await pdf.save())
}

const getLastImageTransform = async (buffer, pageNumber) => {
  const loadingTask = getDocument({ data: new Uint8Array(buffer), standardFontDataUrl })
  try {
    const pdf = await loadingTask.promise
    const page = await pdf.getPage(pageNumber)
    const operations = await page.getOperatorList()
    let lastTransform = null
    let paintedTransform = null
    operations.fnArray.forEach((operation, index) => {
      if (operation === OPS.transform) lastTransform = operations.argsArray[index]
      if ([OPS.paintImageXObject, OPS.paintInlineImageXObject].includes(operation)) paintedTransform = lastTransform
    })
    return paintedTransform
  } finally {
    await loadingTask.destroy().catch(() => null)
  }
}

const imageInput = await sharp({
  create: {
    width: 80,
    height: 60,
    channels: 3,
    background: { r: 35, g: 120, b: 210 },
  },
}).png().toBuffer()

const exactPageImage = await sharp(Buffer.from(`
  <svg width="1240" height="1754" xmlns="http://www.w3.org/2000/svg">
    <rect width="1240" height="1754" fill="white"/>
    <text x="110" y="155" font-family="serif" font-size="42" fill="#111827">PDFTOOLS EXACT WORD TEST</text>
    <text x="110" y="235" font-family="serif" font-size="27" fill="#111827">Giữ nguyên lề, dấu và chữ ký hiển thị</text>
    <circle cx="890" cy="1280" r="105" fill="none" stroke="#dc2626" stroke-width="16"/>
    <text x="820" y="1295" font-family="sans-serif" font-size="35" fill="#dc2626">DẤU</text>
    <path d="M720 1420 C800 1350 875 1490 1015 1365" fill="none" stroke="#2563eb" stroke-width="13"/>
  </svg>
`)).png().toBuffer()
const exactWordBuffer = await createExactWordBuffer([{ data: exactPageImage, mimeType: 'image/png', width: 595, height: 842 }])
const exactWordZip = await JSZip.loadAsync(exactWordBuffer)
const exactWordXml = await exactWordZip.file('word/document.xml').async('string')
assert.match(exactWordXml, /<wp:anchor/, 'Word giữ nguyên hình thức phải dùng ảnh neo toàn trang.')
assert.match(exactWordXml, /<wp:positionH relativeFrom="page"/, 'Ảnh phải được đặt theo gốc trang Word.')
assert.match(exactWordXml, /<wp:positionV relativeFrom="page"/, 'Ảnh phải được đặt theo gốc trang Word.')
assert.match(exactWordXml, /<w:pgSz w:w="11900" w:h="16840"/, 'Khổ Word phải khớp chính xác khổ PDF nguồn.')
assert.match(exactWordXml, /<w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0"/, 'Chế độ giữ nguyên hình thức không được tự thêm lề Word.')
assert.equal(exactWordZip.file(/^word\/media\//).length, 1, 'DOCX phải nhúng đúng một ảnh cho mỗi trang PDF.')

const imageForm = new FormData()
imageForm.append('file', new Blob([imageInput], { type: 'image/png' }), 'smoke.png')
imageForm.append('format', 'jpeg')
imageForm.append('quality', '70')
const compressedImage = await request('/api/tools/image/compress', imageForm)
assert.match(compressedImage.response.headers.get('content-type') || '', /^image\/jpeg/)
assert.equal((await sharp(compressedImage.body).metadata()).format, 'jpeg')

const invalidImageForm = new FormData()
invalidImageForm.append('file', new Blob(['not-an-image'], { type: 'image/png' }), 'fake.png')
const invalidImage = await requestError('/api/tools/image/compress', invalidImageForm, 415)
assert.match(invalidImage.message, /JPG|PNG|WebP|AVIF/)

const cropForm = new FormData()
cropForm.append('file', new Blob([imageInput], { type: 'image/png' }), 'smoke.png')
cropForm.append('format', 'png')
cropForm.append('left', '10')
cropForm.append('top', '10')
cropForm.append('cropWidth', '40')
cropForm.append('cropHeight', '30')
const croppedImage = await request('/api/tools/image/crop', cropForm)
const cropMetadata = await sharp(croppedImage.body).metadata()
assert.deepEqual([cropMetadata.width, cropMetadata.height], [40, 30])

const editImageForm = new FormData()
editImageForm.append('file', new Blob([imageInput], { type: 'image/png' }), 'smoke.png')
editImageForm.append('format', 'png')
editImageForm.append('saturation', '0')
editImageForm.append('brightness', '120')
editImageForm.append('contrast', '110')
editImageForm.append('rotation', '90')
editImageForm.append('flop', 'true')
const editedImage = await request('/api/tools/image/edit', editImageForm)
const editedImageMetadata = await sharp(editedImage.body).metadata()
assert.deepEqual([editedImageMetadata.width, editedImageMetadata.height], [60, 80])

const firstPdf = await makePdf(200, 300)
const secondPdf = await makePdf(400, 500)
const mergeForm = new FormData()
mergeForm.append('files', new Blob([firstPdf], { type: 'application/pdf' }), 'first.pdf')
mergeForm.append('files', new Blob([secondPdf], { type: 'application/pdf' }), 'second.pdf')
mergeForm.append('pagePlan', JSON.stringify([
  { fileIndex: 1, pageIndex: 0, rotation: 90 },
  { fileIndex: 0, pageIndex: 0, rotation: 0 },
]))
const merged = await request('/api/tools/pdf/merge', mergeForm)
assert.match(merged.response.headers.get('content-type') || '', /^application\/pdf/)
const mergedPdf = await PDFDocument.load(merged.body)
assert.equal(mergedPdf.getPageCount(), 2)
assert.equal(mergedPdf.getPage(0).getRotation().angle, 90)

const organizeForm = new FormData()
organizeForm.append('files', new Blob([firstPdf], { type: 'application/pdf' }), 'first.pdf')
organizeForm.append('files', new Blob([secondPdf], { type: 'application/pdf' }), 'second.pdf')
organizeForm.append('pagePlan', JSON.stringify([
  { fileIndex: 0, pageIndex: 0, rotation: 180 },
  { fileIndex: 0, pageIndex: 0, rotation: 0 },
  { fileIndex: 1, pageIndex: 0, rotation: 270 },
]))
const organized = await request('/api/tools/pdf/organize', organizeForm)
assert.match(organized.response.headers.get('content-disposition') || '', /pdftools-organized\.pdf/)
const organizedPdf = await PDFDocument.load(organized.body)
assert.equal(organizedPdf.getPageCount(), 3, 'Sắp xếp PDF phải hỗ trợ đổi thứ tự và nhân bản trang.')
assert.equal(organizedPdf.getPage(0).getRotation().angle, 180)
assert.equal(organizedPdf.getPage(2).getRotation().angle, 270)

const tooManyPagesForm = new FormData()
tooManyPagesForm.append('files', new Blob([firstPdf], { type: 'application/pdf' }), 'first.pdf')
tooManyPagesForm.append('pagePlan', JSON.stringify(Array.from({ length: 501 }, () => ({ fileIndex: 0, pageIndex: 0, rotation: 0 }))))
const tooManyPages = await requestError('/api/tools/pdf/organize', tooManyPagesForm, 413)
assert.match(tooManyPages.message, /500 trang/)

const invalidPdfForm = new FormData()
invalidPdfForm.append('file', new Blob(['not-a-pdf'], { type: 'application/pdf' }), 'fake.pdf')
const invalidPdf = await requestError('/api/tools/pdf/compress', invalidPdfForm, 415)
assert.match(invalidPdf.message, /không phải PDF hợp lệ/)

const oversized = await requestWithHeadersOnly('/api/tools/pdf/compress', {
  'Content-Type': 'application/octet-stream',
  'Content-Length': String(51 * 1024 * 1024),
})
assert.equal(oversized.status, 413, 'Request vượt tổng 50 MB phải bị chặn trước khi đọc upload.')
assert.match(JSON.parse(oversized.body.toString('utf8')).message, /50 MB/)

const concurrencyLimit = await fetch(`${baseUrl}/api/health`).then(response => response.json()).then(health => health.processing.limit)
const heldUploads = Array.from({ length: concurrencyLimit }, () => openHeldUpload('/api/tools/pdf/compress'))
try {
  let activeJobCount = 0
  for (let attempt = 0; attempt < 30; attempt++) {
    const health = await fetch(`${baseUrl}/api/health`).then(response => response.json())
    activeJobCount = health.processing?.active || 0
    if (activeJobCount === concurrencyLimit) break
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  assert.equal(activeJobCount, concurrencyLimit, 'Các upload giữ chỗ phải chiếm đủ processing slot trước khi thử overload.')
  const busyForm = new FormData()
  busyForm.append('file', new Blob([firstPdf], { type: 'application/pdf' }), 'busy.pdf')
  const busyResponse = await fetch(`${baseUrl}/api/tools/pdf/compress`, { method: 'POST', body: busyForm })
  const busyBytes = Buffer.from(await busyResponse.arrayBuffer())
  assert.equal(busyResponse.status, 503, 'Tác vụ vượt giới hạn phải bị chặn khi VPS đã dùng hết processing slot.')
  assert.equal(busyResponse.headers.get('retry-after'), '5')
  const busyBody = JSON.parse(busyBytes.toString('utf8'))
  assert.match(busyBody.message, /đợi vài giây/)
} finally {
  heldUploads.forEach(request => request.destroy())
}

const compressForm = new FormData()
compressForm.append('file', new Blob([merged.body], { type: 'application/pdf' }), 'merged.pdf')
const compressedPdf = await request('/api/tools/pdf/compress', compressForm)
assert.equal((await PDFDocument.load(compressedPdf.body)).getPageCount(), 2)
assert.ok(compressedPdf.body.length <= merged.body.length, 'Nén không mất dữ liệu không được làm tệp lớn hơn.')
assert.equal(compressedPdf.response.headers.get('x-compression-mode'), 'lossless')

const splitForm = new FormData()
splitForm.append('file', new Blob([merged.body], { type: 'application/pdf' }), 'merged.pdf')
splitForm.append('pagePlan', JSON.stringify([{ pageIndex: 1, rotation: 90 }]))
const split = await request('/api/tools/pdf/split', splitForm)
assert.match(split.response.headers.get('content-type') || '', /^application\/zip/)
assert.equal(split.body.subarray(0, 2).toString('ascii'), 'PK', 'Kết quả tách PDF không phải ZIP hợp lệ.')

const textPdf = await makeTextPdf()
const preserveForm = new FormData()
preserveForm.append('file', new Blob([textPdf], { type: 'application/pdf' }), 'selectable-text.pdf')
const preservedPdf = await request('/api/tools/pdf/compress', preserveForm)
assert.ok(preservedPdf.body.length <= textPdf.length, 'Tối ưu PDF chữ không được làm tệp lớn hơn.')
const preservedTextForm = new FormData()
preservedTextForm.append('file', new Blob([preservedPdf.body], { type: 'application/pdf' }), 'selectable-text-lossless.pdf')
const preservedText = await request('/api/tools/pdf/to-text', preservedTextForm)
assert.match(preservedText.body.toString('utf8'), /PDFTools editable office test/, 'Chế độ không mất dữ liệu phải giữ chữ có thể trích xuất.')

const pdfEditForm = new FormData()
pdfEditForm.append('file', new Blob([textPdf], { type: 'application/pdf' }), 'office.pdf')
pdfEditForm.append('editType', 'text')
pdfEditForm.append('text', 'Danh Pham - Trang {page}/{pages}')
pdfEditForm.append('pages', '2')
pdfEditForm.append('position', 'custom')
pdfEditForm.append('xPercent', '23')
pdfEditForm.append('yPercent', '42')
pdfEditForm.append('fontSize', '20')
const editedPdfResult = await request('/api/tools/pdf/edit', pdfEditForm)
const editedPdf = await PDFDocument.load(editedPdfResult.body)
assert.equal(editedPdf.getPageCount(), 2)
assert.ok(editedPdfResult.body.length > textPdf.length, 'PDF chỉnh sửa không có dữ liệu overlay mới.')
assert.equal(editedPdfResult.response.headers.get('x-pdf-edit-position'), 'custom')
assert.equal(editedPdfResult.response.headers.get('x-pdf-edit-x'), '23')
assert.equal(editedPdfResult.response.headers.get('x-pdf-edit-y'), '42')
const editedPlacement = await getLastImageTransform(editedPdfResult.body, 2)
assert.ok(Array.isArray(editedPlacement) && editedPlacement.length === 6, 'Overlay tùy chỉnh phải thực sự được vẽ lên trang PDF.')
assert.ok(editedPlacement[4] < 595 / 2, 'Tọa độ 23% phải đặt overlay ở nửa trái trang PDF.')

const convert = async format => {
  const form = new FormData()
  form.append('file', new Blob([textPdf], { type: 'application/pdf' }), 'office.pdf')
  const output = await request(`/api/tools/pdf/to-${format}`, form)
  assert.equal(output.response.headers.get('x-extracted-pages'), '2')
  assert.ok(Number(output.response.headers.get('x-extracted-characters')) > 50)
  assert.equal(output.response.headers.get('x-pdf-source-kind'), 'digital')
  assert.equal(output.response.headers.get('x-pdf-text-pages'), '2')
  return output
}

const word = await convert('word')
assert.match(word.response.headers.get('content-type') || '', /wordprocessingml/)
assert.equal(word.response.headers.get('x-word-layout-mode'), 'flowing-reconstruction')
const wordZip = await JSZip.loadAsync(word.body)
const wordXml = await wordZip.file('word/document.xml').async('string')
assert.match(wordXml, /PDFTools editable office test/)
assert.match(wordXml, /<w:pgSz/, 'DOCX phải giữ khổ giấy được suy ra từ PDF.')

const excel = await convert('excel')
assert.match(excel.response.headers.get('content-type') || '', /spreadsheetml/)
const workbook = new ExcelJS.Workbook()
await workbook.xlsx.load(excel.body)
assert.equal(workbook.worksheets.length, 2)
assert.match(workbook.getWorksheet(1).getCell('A1').value, /PDFTools editable office test/)

const powerPoint = await convert('powerpoint')
assert.match(powerPoint.response.headers.get('content-type') || '', /presentationml/)
const powerPointZip = await JSZip.loadAsync(powerPoint.body)
assert.ok(powerPointZip.file('ppt/slides/slide1.xml'))
assert.ok(powerPointZip.file('ppt/slides/slide2.xml'))
assert.match(await powerPointZip.file('ppt/slides/slide1.xml').async('string'), /PDFTools editable office test/)

const text = await convert('text')
assert.match(text.response.headers.get('content-type') || '', /^text\/plain/)
assert.match(text.body.toString('utf8'), /Second page content/)

const wordExportPdf = await makeWordExportPdf()
const wordExportForm = new FormData()
wordExportForm.append('file', new Blob([wordExportPdf], { type: 'application/pdf' }), 'word-export.pdf')
const reconstructedWord = await request('/api/tools/pdf/to-word', wordExportForm)
assert.equal(reconstructedWord.response.headers.get('x-pdf-source-kind'), 'word-export')
assert.equal(reconstructedWord.response.headers.get('x-word-layout-mode'), 'flowing-reconstruction')
const reconstructedZip = await JSZip.loadAsync(reconstructedWord.body)
const reconstructedXml = await reconstructedZip.file('word/document.xml').async('string')
assert.match(reconstructedXml, /WORD EXPORT HEADING/)
assert.match(reconstructedXml, /<w:jc w:val="center"/, 'Tiêu đề ở giữa PDF phải được căn giữa trong Word.')
assert.match(reconstructedXml, /<w:b\/>/, 'Kiểu chữ đậm còn nhận diện được phải được giữ trong Word.')
assert.match(reconstructedXml, /<w:i\/>/, 'Kiểu chữ nghiêng còn nhận diện được phải được giữ trong Word.')

const structuredLetterPdf = await makeStructuredLetterPdf()
const structuredLetterForm = new FormData()
structuredLetterForm.append('file', new Blob([structuredLetterPdf], { type: 'application/pdf' }), 'structured-letter.pdf')
const structuredWord = await request('/api/tools/pdf/to-word', structuredLetterForm)
assert.equal(structuredWord.response.headers.get('x-word-layout-mode'), 'flowing-reconstruction')
assert.equal(structuredWord.response.headers.get('x-word-detected-tables'), '1')
assert.equal(structuredWord.response.headers.get('x-pdf-source-kind'), 'signed-document')
assert.equal(structuredWord.response.headers.get('x-pdf-signatures'), '1')
const structuredWordZip = await JSZip.loadAsync(structuredWord.body)
const structuredWordXml = await structuredWordZip.file('word/document.xml').async('string')
assert.match(structuredWordXml, /<w:tbl>/, 'Bảng PDF phải được tái dựng thành bảng Word thật.')
assert.match(structuredWordXml, /<w:gridSpan w:val="2"\/>/, 'Tiêu đề bảng nhiều cột phải giữ ô gộp ngang.')
assert.match(structuredWordXml, /<w:vMerge w:val="restart"\/>/, 'Tiêu đề STT phải giữ ô gộp dọc.')
assert.match(structuredWordXml, /Noi dung tiep theo cua doan van/, 'Nội dung đoạn văn phải còn trong DOCX.')

const mixedPdf = await makeImagePdf(imageInput, true)
const mixedForm = new FormData()
mixedForm.append('file', new Blob([mixedPdf], { type: 'application/pdf' }), 'mixed.pdf')
const mixedText = await request('/api/tools/pdf/to-text', mixedForm)
assert.equal(mixedText.response.headers.get('x-pdf-source-kind'), 'mixed')
assert.equal(mixedText.response.headers.get('x-pdf-text-pages'), '1')
assert.equal(mixedText.response.headers.get('x-pdf-image-only-pages'), '1')
assert.match(mixedText.body.toString('utf8'), /Selectable page before scanned page/)

const scannedPdf = await makeImagePdf(imageInput)
const scannedForm = new FormData()
scannedForm.append('file', new Blob([scannedPdf], { type: 'application/pdf' }), 'scan.pdf')
const scannedError = await requestError('/api/tools/pdf/to-word', scannedForm, 422)
assert.match(scannedError.message, /PDF scan|OCR/)

const blankForm = new FormData()
blankForm.append('file', new Blob([firstPdf], { type: 'application/pdf' }), 'blank.pdf')
const blankError = await requestError('/api/tools/pdf/to-word', blankForm, 422)
assert.match(blankError.message, /OCR/)

console.log('E2E API thành công: ảnh, PDF, chỉnh vị trí overlay, phân loại scan/Word và chuyển Word/Excel/PowerPoint/TXT đều hợp lệ.')
