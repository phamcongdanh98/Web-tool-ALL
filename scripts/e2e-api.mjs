import assert from 'node:assert/strict'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:13999'

const request = async (path, form) => {
  const response = await fetch(`${baseUrl}${path}`, { method: 'POST', body: form })
  const body = Buffer.from(await response.arrayBuffer())
  assert.equal(response.status, 200, `${path} trả HTTP ${response.status}: ${body.toString('utf8').slice(0, 300)}`)
  assert.ok(body.length > 0, `${path} trả về file rỗng.`)
  return { response, body }
}

const makePdf = async (width, height) => {
  const pdf = await PDFDocument.create()
  pdf.addPage([width, height])
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

const compressForm = new FormData()
compressForm.append('file', new Blob([merged.body], { type: 'application/pdf' }), 'merged.pdf')
compressForm.append('level', 'strong')
const compressedPdf = await request('/api/tools/pdf/compress', compressForm)
assert.equal((await PDFDocument.load(compressedPdf.body)).getPageCount(), 2)

const splitForm = new FormData()
splitForm.append('file', new Blob([merged.body], { type: 'application/pdf' }), 'merged.pdf')
splitForm.append('pagePlan', JSON.stringify([{ pageIndex: 1, rotation: 90 }]))
const split = await request('/api/tools/pdf/split', splitForm)
assert.match(split.response.headers.get('content-type') || '', /^application\/zip/)
assert.equal(split.body.subarray(0, 2).toString('ascii'), 'PK', 'Kết quả tách PDF không phải ZIP hợp lệ.')

console.log('E2E API thành công: nén/cắt ảnh và nén/ghép/tách PDF đều trả file hợp lệ.')
