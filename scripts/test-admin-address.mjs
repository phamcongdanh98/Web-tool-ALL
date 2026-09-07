import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDatabase, closeDatabase } from '../lib/admin-address/db.js'
import { seedDatabase } from '../lib/admin-address/seed-data.js'
import { toMatchingKey, removeDiacritics, stripAdminPrefix } from '../lib/admin-address/normalizer.js'
import { parseAddressString } from '../lib/admin-address/parser.js'
import { convertOldToNew, lookupNewToLegacies, processBulkExcel, loadMemoryCache } from '../lib/admin-address/converter.js'
import { recordCandidateChange, getCandidateChanges } from '../lib/admin-address/watcher.js'
import ExcelJS from '@excel.js/exceljs'

console.log('🧪 Bắt đầu kiểm thử Core Engine: Chuyển đổi Địa giới Hành chính...')

// 1. Khởi tạo database test
const db = getDatabase()
seedDatabase(db)
loadMemoryCache(db)

// 2. Test Normalizer
assert.equal(removeDiacritics('Đà Nẵng'), 'da nang')
assert.equal(toMatchingKey('TP. Hồ Chí Minh'), 'ho chi minh')
assert.equal(toMatchingKey('TP.HCM'), 'ho chi minh')
assert.equal(toMatchingKey('TPHCM'), 'ho chi minh')
assert.equal(toMatchingKey('Quận 1'), '1')
assert.equal(toMatchingKey('Q.1'), '1')
assert.equal(toMatchingKey('Quận I'), '1')
assert.equal(toMatchingKey('Xã Tam Thanh'), 'tam thanh')
assert.equal(toMatchingKey('Phường Bến Nghé'), 'ben nghe')
console.log('✅ 1. Normalizer: Chuẩn hóa tên, viết tắt, không dấu, số La Mã thành công.')

// 3. Test Parser
const p1 = parseAddressString('123 đường ABC, Phường Bến Nghé, Quận 1, TP.HCM')
assert.equal(p1.detail, '123 đường ABC')
assert.equal(p1.ward, 'Phường Bến Nghé')
assert.equal(p1.district, 'Quận 1')
assert.equal(p1.province, 'Thành phố Hồ Chí Minh')

const p2 = parseAddressString('Thôn 2, Xã Tam Thanh, Thành phố Tam Kỳ, Tỉnh Quảng Nam')
assert.equal(p2.detail, 'Thôn 2')
assert.equal(p2.ward, 'Xã Tam Thanh')
assert.equal(p2.district, 'Thành phố Tam Kỳ')
assert.equal(p2.province, 'Tỉnh Quảng Nam')

// Test chuỗi tự do không có dấu phẩy
const pNoComma = parseAddressString('Xã Tam Thanh Tam Kỳ Quảng Nam')
assert.equal(pNoComma.ward, 'Xã Tam Thanh')
assert.equal(pNoComma.district, 'Thành phố Tam Kỳ')
assert.equal(pNoComma.province, 'Tỉnh Quảng Nam')

// Test chuỗi không dấu
const pNoDia = parseAddressString('xa tam thanh tam ky quang nam')
assert.equal(pNoDia.ward, 'Xã Tam Thanh')
assert.equal(pNoDia.district, 'Thành phố Tam Kỳ')
assert.equal(pNoDia.province, 'Tỉnh Quảng Nam')

console.log('✅ 2. Parser: Tách chuỗi địa chỉ tự do thông minh (hỗ trợ có phẩy, không phẩy, không dấu) chính xác.')

// 4. Test Tra cứu Cũ -> Mới: EXACT (Ví dụ chuẩn của người dùng)
const resTamThanh = convertOldToNew({
  province: 'Tỉnh Quảng Nam',
  district: 'Thành phố Tam Kỳ',
  ward: 'Xã Tam Thanh',
})
assert.equal(resTamThanh.status, 'exact')
assert.equal(resTamThanh.newAddress.province, 'Thành phố Đà Nẵng')
assert.equal(resTamThanh.newAddress.ward, 'Phường Quảng Phú')
assert.equal(resTamThanh.legalBasis.documentNumber, '1659/NQ-UBTVQH15')
assert.equal(resTamThanh.mappingType, 'FULL')
console.log('✅ 3. Convert EXACT: Xã Tam Thanh, Tam Kỳ, Quảng Nam → Phường Quảng Phú, TP Đà Nẵng.')

// 5. Test Tra cứu Cũ -> Mới qua chuỗi tự do có số nhà
const resString = convertOldToNew({
  addressString: 'Số 45 Trần Hưng Đạo, Xã Tam Thanh, Thành phố Tam Kỳ, Tỉnh Quảng Nam'
})
assert.equal(resString.status, 'exact')
assert.equal(resString.newAddress.province, 'Thành phố Đà Nẵng')
assert.equal(resString.newAddress.ward, 'Phường Quảng Phú')
assert.equal(resString.newAddress.fullAddress, 'Số 45 Trần Hưng Đạo, Phường Quảng Phú, Thành phố Đà Nẵng')
console.log('✅ 4. Convert String: Tự động giữ nguyên số nhà/đường và thay phần hành chính.')

// 6. Test Tra cứu Cũ -> Mới: PARTIAL (Bắt buộc ambiguous - Căn cứ NQ 1659/NQ-UBTVQH15)
const resPartial = convertOldToNew({
  province: 'Thành phố Đà Nẵng',
  ward: 'Xã Hòa Liên'
})
assert.equal(resPartial.status, 'ambiguous')
assert.equal(resPartial.mappingType, 'PARTIAL')
assert.ok(resPartial.candidates.length >= 2)
assert.ok(resPartial.message.includes('Không thể xác định duy nhất'))
console.log('✅ 5. Convert PARTIAL: Báo ambiguous chính xác khi xã cũ (Xã Hòa Liên) bị chia tách sang nhiều xã mới.')

// 7. Test Tra cứu Cũ -> Mới: EXACT sáp nhập cấp xã TP.HCM (NQ 1658/NQ-UBTVQH15)
const resBenNghe = convertOldToNew({
  province: 'TP.HCM',
  district: 'Quận 1',
  ward: 'Phường Bến Nghé'
})
assert.equal(resBenNghe.status, 'exact')
assert.equal(resBenNghe.newAddress.province, 'Thành phố Hồ Chí Minh')
assert.equal(resBenNghe.newAddress.ward, 'Phường Sài Gòn')
assert.equal(resBenNghe.legalBasis.documentNumber, '1658/NQ-UBTVQH15')
console.log('✅ 6. Convert EXACT: Phường Bến Nghé, Q.1, TP.HCM → Phường Sài Gòn, TP.HCM (NQ 1658/NQ-UBTVQH15).')

// 7.1. Test Khánh Hòa - Nha Trang - Phước Đồng (Case người dùng thực tế)
const resKhanhHoa = convertOldToNew({
  province: 'Tỉnh Khánh Hòa',
  district: 'Thành phố Nha Trang',
  ward: 'Xã Phước Đồng',
})
assert.equal(resKhanhHoa.status, 'exact')
assert.equal(resKhanhHoa.newAddress.province, 'Tỉnh Khánh Hòa')
assert.equal(resKhanhHoa.newAddress.ward, 'Phường Nam Nha Trang')
assert.equal(resKhanhHoa.legalBasis.documentNumber, '1667/NQ-UBTVQH15')
assert.equal(resKhanhHoa.oldAddress.fullAddress, 'Xã Phước Đồng, Thành phố Nha Trang, Tỉnh Khánh Hòa')
console.log('✅ 6.1. Convert EXACT: Xã Phước Đồng, Nha Trang, Khánh Hòa → Phường Nam Nha Trang, Tỉnh Khánh Hòa.')

// 8. Test Tra cứu Cấp Tỉnh (Nghị quyết 202/2025/QH15)
const resHaGiang = convertOldToNew({
  province: 'Hà Giang',
  ward: 'Một xã lạ'
})
assert.equal(resHaGiang.status, 'needs_review')
assert.equal(resHaGiang.newAddress.province, 'Tỉnh Tuyên Quang')
assert.equal(resHaGiang.legalBasis.documentNumber, '202/2025/QH15')
console.log('✅ 7. Convert Cấp Tỉnh: Hà Giang → Tỉnh Tuyên Quang (NQ 202/2025/QH15).')

// 9. Test Tra cứu Mới -> Cũ (Legacies)
const legQuangPhu = lookupNewToLegacies('Thành phố Đà Nẵng', 'Phường Quảng Phú')
assert.equal(legQuangPhu.status, 'success')
assert.ok(legQuangPhu.legacies.some(l => l.oldWard === 'Xã Tam Thanh'))
assert.ok(legQuangPhu.legacies.some(l => l.oldWard === 'Phường An Phú'))
console.log('✅ 8. Tra cứu Mới -> Cũ: Phường Quảng Phú hiển thị đúng các xã cũ cấu thành.')

// 10. Test Xử lý Excel hàng loạt
const workbook = new ExcelJS.Workbook()
const sheet = workbook.addWorksheet('Danh sách')
sheet.addRow(['STT', 'Họ tên', 'Địa chỉ cũ'])
sheet.addRow([1, 'Nguyễn Văn A', 'Xã Tam Thanh, Tam Kỳ, Quảng Nam'])
sheet.addRow([2, 'Trần Thị B', 'Xã Hòa Liên, Hòa Vang, Đà Nẵng'])
sheet.addRow([3, 'Lê Văn C', 'Phường Bến Nghé, Quận 1, TP HCM'])
sheet.addRow([4, 'Phạm Văn D', 'Một địa chỉ hoàn toàn không tồn tại trên đời'])

const testExcelBuffer = await workbook.xlsx.writeBuffer()
const bulkResult = await processBulkExcel(Buffer.from(testExcelBuffer), { mode: 'auto' })

assert.equal(bulkResult.stats.total, 4)
assert.equal(bulkResult.stats.exact, 2) // Tam Thanh + Ben Nghe
assert.equal(bulkResult.stats.ambiguous, 1) // Dien Thang Bac (PARTIAL)
assert.equal(bulkResult.stats.not_found, 1) // Không tồn tại
assert.ok(bulkResult.buffer.length > 0)
console.log('✅ 9. Excel Bulk Convert: Xử lý chính xác 4 dòng với đủ các trạng thái EXACT, PARTIAL, NOT_FOUND.')

// 11. Test Staging Watcher
const changeItem = recordCandidateChange({
  source: 'Công báo 2026',
  source_document: 'Nghị quyết điều chỉnh địa giới',
  old_value: 'Xã A',
  new_value: 'Một phần nhập vào Xã B, phần còn lại vào Xã C',
  review_note: 'Phát hiện tự động từ feed',
})
assert.equal(changeItem.status, 'NEEDS_REVIEW')
const list = getCandidateChanges('NEEDS_REVIEW')
assert.ok(list.length > 0)
console.log('✅ 10. Staging Watcher: Tự động phát hiện từ khóa chia tách và gán nhãn NEEDS_REVIEW.')

console.log('\n🎉 TẤT CẢ 10 BỘ TEST CỦA ADMIN ADDRESS CONVERTER ĐÃ PASS 100%!')
