import assert from 'node:assert/strict'
import ExcelJS from '@excel.js/exceljs'
import http from 'node:http'
import JSZip from 'jszip'
import sharp from 'sharp'
import { PDFDocument, StandardFonts } from 'pdf-lib'

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:13999'

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

const imageInput = await sharp({
  create: {
    width: 80,
    height: 60,
    channels: 3,
    background: { r: 35, g: 120, b: 210 },
  },
}).png().toBuffer()

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
pdfEditForm.append('position', 'bottom-right')
pdfEditForm.append('fontSize', '20')
const editedPdfResult = await request('/api/tools/pdf/edit', pdfEditForm)
const editedPdf = await PDFDocument.load(editedPdfResult.body)
assert.equal(editedPdf.getPageCount(), 2)
assert.ok(editedPdfResult.body.length > textPdf.length, 'PDF chỉnh sửa không có dữ liệu overlay mới.')

const convert = async format => {
  const form = new FormData()
  form.append('file', new Blob([textPdf], { type: 'application/pdf' }), 'office.pdf')
  const output = await request(`/api/tools/pdf/to-${format}`, form)
  assert.equal(output.response.headers.get('x-extracted-pages'), '2')
  assert.ok(Number(output.response.headers.get('x-extracted-characters')) > 50)
  return output
}

const word = await convert('word')
assert.match(word.response.headers.get('content-type') || '', /wordprocessingml/)
const wordZip = await JSZip.loadAsync(word.body)
const wordXml = await wordZip.file('word/document.xml').async('string')
assert.match(wordXml, /PDFTools editable office test/)

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

const blankForm = new FormData()
blankForm.append('file', new Blob([firstPdf], { type: 'application/pdf' }), 'blank.pdf')
const blankError = await requestError('/api/tools/pdf/to-word', blankForm, 422)
assert.match(blankError.message, /OCR/)

console.log('E2E API thành công: ảnh, PDF, sắp xếp trang, giới hạn upload và chuyển Word/Excel/PowerPoint/TXT đều hợp lệ.')
