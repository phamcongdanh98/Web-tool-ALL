import assert from 'node:assert/strict'
import jsQR from 'jsqr'
import JSZip from 'jszip'
import QRCode from 'qrcode'
import sharp from 'sharp'
import { buildRenamedFileNames, formatBytes, parsePublicHttpUrl, redactionToPixels, sanitizeFileSegment, splitFileName, transformRedactionRegion } from '../lib/browser-utility.js'

assert.equal(formatBytes(0), '0 KB')
assert.equal(formatBytes(500), '500 B')
assert.equal(formatBytes(1024), '1.00 KB')
assert.equal(formatBytes(1024 * 1024 * 5.5), '5.50 MB')
assert.equal(formatBytes(1024 * 1024 * 1024 * 1.2), '1.20 GB')


const qrContent = 'PDFTools · Danh Phạm · https://congcuweb.duckdns.org'
const qrPng = await QRCode.toBuffer(qrContent, { type: 'png', width: 512, margin: 4, errorCorrectionLevel: 'M' })
const { data: qrPixels, info: qrInfo } = await sharp(qrPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const qrResult = jsQR(new Uint8ClampedArray(qrPixels), qrInfo.width, qrInfo.height, { inversionAttempts: 'dontInvert' })
assert.equal(qrResult?.data, qrContent, 'QR tạo ra phải đọc lại đúng nội dung Unicode và URL.')

assert.deepEqual(splitFileName('bao.cao.2026.pdf'), { stem: 'bao.cao.2026', extension: 'pdf' })
assert.equal(sanitizeFileSegment('../hồ sơ: mật?.pdf'), '-hồ sơ- mật-.pdf')
assert.equal(parsePublicHttpUrl('javascript:alert(1)'), null, 'Không được coi URL javascript là liên kết public an toàn.')
assert.equal(parsePublicHttpUrl('https://example.com/path')?.hostname, 'example.com')

const files = [
  { name: 'Ảnh hè?.JPG', bytes: Buffer.from('anh-mot') },
  { name: 'Ảnh hè*.jpg', bytes: Buffer.from('anh-hai') },
  { name: '../ghi chú.txt', bytes: Buffer.from('ghi-chu') },
]
const mapping = buildRenamedFileNames(files, { pattern: 'du-an-{n}', start: 7, digits: 3 })
assert.deepEqual(mapping.map(item => item.nextName), ['du-an-007.JPG', 'du-an-008.jpg', 'du-an-009.txt'])
assert.ok(mapping.every(item => !item.nextName.includes('/') && !item.nextName.includes('..')), 'Tên ZIP không được chứa đường dẫn traversal.')

const duplicateMapping = buildRenamedFileNames(files.slice(0, 2), { pattern: '{name}' })
assert.notEqual(duplicateMapping[0].nextName.toLocaleLowerCase('vi-VN'), duplicateMapping[1].nextName.toLocaleLowerCase('vi-VN'), 'Tên trùng phải được tự phân biệt.')
const zip = new JSZip()
mapping.forEach(item => zip.file(item.nextName, item.file.bytes, { compression: 'STORE' }))
const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
const reopened = await JSZip.loadAsync(zipBuffer)
assert.deepEqual(Object.keys(reopened.files), mapping.map(item => item.nextName))
for (const item of mapping) assert.deepEqual(await reopened.file(item.nextName).async('nodebuffer'), item.file.bytes, 'Đổi tên không được sửa byte tệp gốc.')

assert.deepEqual(redactionToPixels({ x: 25, y: 20, w: 50, h: 40 }, 800, 600), { left: 200, top: 120, width: 400, height: 240 })
assert.deepEqual(redactionToPixels({ x: -20, y: 99, w: 150, h: 20 }, 100, 100), { left: 0, top: 99, width: 100, height: 1 })
assert.deepEqual(transformRedactionRegion({ id: 'a', x: 10, y: 12, w: 34, h: 14 }, 'move', 8, 6), { id: 'a', x: 18, y: 18, w: 34, h: 14 })
assert.deepEqual(transformRedactionRegion({ id: 'a', x: 10, y: 12, w: 34, h: 14 }, 'se', 12, 8), { id: 'a', x: 10, y: 12, w: 46, h: 22 })
assert.deepEqual(transformRedactionRegion({ id: 'a', x: 10, y: 12, w: 34, h: 14 }, 'nw', 5, 4), { id: 'a', x: 15, y: 16, w: 29, h: 10 })

console.log('Tiện ích browser hợp lệ: QR round-trip · tên/ZIP nguyên byte · URL an toàn · tọa độ vùng che.')
