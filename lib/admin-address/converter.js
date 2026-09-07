/**
 * Core Conversion Engine:
 * - Tra cứu Cũ -> Mới (Exact, Partial/Ambiguous, Province-level, Not-found)
 * - Tra cứu Mới -> Cũ (Legacies: các đơn vị cũ cấu thành)
 * - Xử lý Excel hàng loạt (Bulk Convert) với hiệu năng cao
 */

import { getDatabase } from './db.js'
import { toMatchingKey, normalizeUnicode } from './normalizer.js'
import { parseAddressString } from './parser.js'
import ExcelJS from '@excel.js/exceljs'

/**
 * Cache tra cứu trong bộ nhớ (In-Memory Lookup Map) để đạt tốc độ cao
 */
let memoryCache = null

export const loadMemoryCache = (db = null) => {
  const database = db || getDatabase()

  // 1. Tải toàn bộ legal documents
  const docs = database.prepare('SELECT * FROM legal_documents').all()
  const docMap = new Map()
  for (const d of docs) {
    docMap.set(d.id, d)
  }

  // 2. Tải toàn bộ mappings
  const mappings = database.prepare('SELECT * FROM administrative_mappings').all()

  // 3. Tải toàn bộ đơn vị hành chính
  const units = database.prepare('SELECT * FROM administrative_units').all()

  // Xây dựng index
  // Key cấp xã: `${old_province_key}|${old_ward_key}` -> [mappings]
  const wardMap = new Map()
  // Key cấp tỉnh: `${old_province_key}` -> mapping
  const provinceMap = new Map()
  // Key mới -> cũ: `${new_province_key}|${new_ward_key}` -> [mappings]
  const newToOldMap = new Map()

  for (const m of mappings) {
    const doc = m.legal_document_id ? docMap.get(m.legal_document_id) : null
    const enriched = {
      ...m,
      legalBasis: doc ? {
        documentNumber: doc.document_number,
        title: doc.title,
        authority: doc.issuing_authority,
        effectiveDate: doc.effective_date,
        url: doc.source_url,
      } : null,
    }

    // Index mapping cấp xã
    if (m.old_ward_key && m.old_ward_key !== '*') {
      const keyWithDistrict = `${m.old_province_key}|${m.old_district_key || ''}|${m.old_ward_key}`
      const keyWithoutDistrict = `${m.old_province_key}|${m.old_ward_key}`

      if (!wardMap.has(keyWithDistrict)) wardMap.set(keyWithDistrict, [])
      wardMap.get(keyWithDistrict).push(enriched)

      if (!wardMap.has(keyWithoutDistrict)) wardMap.set(keyWithoutDistrict, [])
      wardMap.get(keyWithoutDistrict).push(enriched)

      // Index Mới -> Cũ
      const newKey = `${m.new_province_key}|${m.new_ward_key}`
      if (!newToOldMap.has(newKey)) newToOldMap.set(newKey, [])
      newToOldMap.get(newKey).push(enriched)
    } else {
      // Mapping cấp tỉnh tổng quát
      provinceMap.set(m.old_province_key, enriched)
    }
  }

  memoryCache = {
    docMap,
    wardMap,
    provinceMap,
    newToOldMap,
    units,
    lastLoaded: Date.now(),
  }

  return memoryCache
}

export const getCache = () => {
  if (!memoryCache) {
    return loadMemoryCache()
  }
  return memoryCache
}

export const reloadMemoryCache = (database = null) => {
  memoryCache = null
  return loadMemoryCache(database)
}

/**
 * Chuyển đổi một địa chỉ từ Cũ sang Mới
 */
export const convertOldToNew = (input = {}) => {
  const cache = getCache()

  let detail = input.detail || ''
  let ward = input.ward || ''
  let district = input.district || ''
  let province = input.province || ''

  // Nếu người dùng nhập nguyên chuỗi địa chỉ
  if (input.addressString && (!ward || !province)) {
    const parsed = parseAddressString(input.addressString)
    detail = parsed.detail || detail
    ward = parsed.ward || ward
    district = parsed.district || district
    province = parsed.province || province
  }

  const pKey = toMatchingKey(province)
  const dKey = toMatchingKey(district)
  const wKey = toMatchingKey(ward)

  const oldAddress = {
    detail,
    ward,
    district,
    province,
    fullAddress: [detail, ward, district, province].filter(Boolean).join(', '),
  }

  // 1. Kiểm tra nếu thiếu dữ liệu tối thiểu
  if (!pKey && !wKey) {
    return {
      status: 'not_found',
      confidence: 0,
      message: 'Vui lòng cung cấp ít nhất Xã/Phường hoặc Tỉnh/Thành phố cần tra cứu.',
      oldAddress,
      original: { detail, ward, district, province },
      newAddress: null,
      legalBasis: null,
    }
  }

  // 2. Tìm kiếm chính xác cấp Xã (có huyện hoặc không có huyện)
  let matches = []
  if (pKey && dKey && wKey) {
    matches = cache.wardMap.get(`${pKey}|${dKey}|${wKey}`) || []
  }
  if (!matches.length && pKey && wKey) {
    matches = cache.wardMap.get(`${pKey}|${wKey}`) || []
  }

  // 3. Xử lý trường hợp tìm thấy mapping cấp Xã
  if (matches.length > 0) {
    // Kiểm tra trường hợp PARTIAL: có mapping PARTIAL hoặc nhiều mapping cho cùng 1 xã cũ
    const hasPartial = matches.some(m => m.mapping_type === 'PARTIAL')
    if (hasPartial || matches.length > 1) {
      // ⚠️ Không thể xác định duy nhất: Bắt buộc báo ambiguous kèm candidates
      const candidates = matches.map(m => ({
        newProvince: m.new_province_name,
        newWard: m.new_ward_name,
        mappingType: m.mapping_type,
        note: m.note,
        legalBasis: m.legalBasis,
      }))

      return {
        status: 'ambiguous',
        confidence: 0.5,
        mappingType: 'PARTIAL',
        message: '⚠️ Không thể xác định duy nhất. Đơn vị hành chính cũ này được chia tách sang nhiều đơn vị mới. Vui lòng cung cấp thêm số nhà, tên đường, thôn/tổ dân phố hoặc vị trí cụ thể.',
        oldAddress,
        original: { detail, ward, district, province },
        candidates,
        legalBasis: matches[0]?.legalBasis || null,
        newAddress: null,
      }
    }

    // Trường hợp 1 mapping duy nhất (FULL hoặc UNCHANGED)
    const match = matches[0]
    const fullNewAddress = [detail, match.new_ward_name, match.new_province_name]
      .filter(Boolean)
      .join(', ')

    return {
      status: 'exact',
      confidence: match.confidence || 1.0,
      mappingType: match.mapping_type || 'FULL',
      message: match.mapping_type === 'UNCHANGED'
        ? 'Đơn vị hành chính giữ nguyên ranh giới, trực thuộc trực tiếp theo mô hình 2 cấp.'
        : 'Chuyển đổi thành công sang đơn vị hành chính mới theo quyết nghị sắp xếp.',
      oldAddress,
      original: { detail, ward, district, province },
      newAddress: {
        province: match.new_province_name,
        ward: match.new_ward_name,
        detail,
        fullAddress: fullNewAddress,
      },
      effectiveFrom: match.effective_from || '2025-07-01',
      legalBasis: match.legalBasis,
      note: match.note || '',
    }
  }

  // 4. Nếu chưa có mapping cấp xã, kiểm tra mapping cấp Tỉnh (Nghị quyết 202/2025/QH15)
  const provMatch = cache.provinceMap.get(pKey)
  if (provMatch) {
    const fullNewAddress = [detail, ward, provMatch.new_province_name]
      .filter(Boolean)
      .join(', ')

    return {
      status: 'needs_review',
      confidence: 0.7,
      mappingType: provMatch.mapping_type || 'MERGED',
      message: `Đã xác định tỉnh/thành phố mới là “${provMatch.new_province_name}” theo Nghị quyết 202/2025/QH15. Đơn vị cấp xã giữ nguyên tên hoặc đang chờ cập nhật chi tiết.`,
      oldAddress,
      original: { detail, ward, district, province },
      newAddress: {
        province: provMatch.new_province_name,
        ward: ward ? ward : '',
        detail,
        fullAddress: fullNewAddress,
      },
      effectiveFrom: '2025-07-01',
      legalBasis: provMatch.legalBasis,
      note: provMatch.note || '',
    }
  }

  // 5. Không tìm thấy thông tin
  return {
    status: 'not_found',
    confidence: 0,
    mappingType: 'UNKNOWN',
    message: 'Không tìm thấy thông tin sắp xếp cho đơn vị hành chính này. Vui lòng kiểm tra lại tên gọi.',
    oldAddress,
    original: { detail, ward, district, province },
    newAddress: null,
    legalBasis: null,
  }
}

/**
 * Tra cứu Mới -> Cũ (Legacies): xem đơn vị mới này được hình thành từ những đơn vị cũ nào
 */
export const lookupNewToLegacies = (newProvince = '', newWard = '') => {
  const cache = getCache()
  const pKey = toMatchingKey(newProvince)
  const wKey = toMatchingKey(newWard)

  const key = `${pKey}|${wKey}`
  const matches = cache.newToOldMap.get(key) || []

  if (!matches.length) {
    return {
      status: 'not_found',
      query: { newProvince, newWard },
      legacies: [],
      message: 'Chưa có thông tin cấu thành lịch sử cho đơn vị mới này.',
    }
  }

  const legacies = matches.map(m => ({
    oldProvince: m.old_province_name,
    oldDistrict: m.old_district_name || '—',
    oldWard: m.old_ward_name,
    mappingType: m.mapping_type,
    typeLabel: m.mapping_type === 'PARTIAL' ? 'Một phần diện tích/dân số' : 'Toàn bộ đơn vị',
    note: m.note,
    legalBasis: m.legalBasis,
  }))

  return {
    status: 'success',
    query: { newProvince, newWard },
    totalConstituents: legacies.length,
    legacies,
  }
}

/**
 * Xử lý tệp Excel hàng loạt (Bulk Convert)
 */
export const processBulkExcel = async (fileBuffer, options = {}) => {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(fileBuffer)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) {
    throw new Error('Tệp Excel không chứa bảng dữ liệu hợp lệ.')
  }

  // Đọc hàng tiêu đề (header)
  const headerRow = worksheet.getRow(1)
  const headers = []
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = String(cell.value || '').trim()
  })

  // Xác định các cột dựa vào options hoặc tự nhận diện
  const colMode = options.mode || 'auto' // 'columns' | 'string' | 'auto'
  let provinceCol = Number(options.provinceCol) || 0
  let districtCol = Number(options.districtCol) || 0
  let wardCol = Number(options.wardCol) || 0
  let addressCol = Number(options.addressCol) || 0

  if (colMode === 'auto' || (!provinceCol && !addressCol)) {
    headers.forEach((h, colIdx) => {
      const lower = h.toLowerCase()
      if (/địa chỉ|dia chi|address/i.test(lower) && !addressCol) addressCol = colIdx
      else if (/tỉnh|thành phố|tinh|thanh pho|province/i.test(lower) && !provinceCol) provinceCol = colIdx
      else if (/quận|huyện|thị xã|quan|huyen|district/i.test(lower) && !districtCol) districtCol = colIdx
      else if (/xã|phường|thị trấn|xa|phuong|ward/i.test(lower) && !wardCol) wardCol = colIdx
    })
  }

  // Thêm các cột kết quả vào cuối
  const totalCols = headerRow.cellCount
  const colNewProvince = totalCols + 1
  const colNewWard = totalCols + 2
  const colNewFullAddress = totalCols + 3
  const colStatus = totalCols + 4
  const colConfidence = totalCols + 5
  const colMappingType = totalCols + 6
  const colLegal = totalCols + 7
  const colNote = totalCols + 8

  worksheet.getCell(1, colNewProvince).value = 'Tỉnh/TP mới'
  worksheet.getCell(1, colNewWard).value = 'Xã/Phường mới'
  worksheet.getCell(1, colNewFullAddress).value = 'Địa chỉ hành chính mới'
  worksheet.getCell(1, colStatus).value = 'Trạng thái chuyển đổi'
  worksheet.getCell(1, colConfidence).value = 'Độ tin cậy'
  worksheet.getCell(1, colMappingType).value = 'Loại mapping'
  worksheet.getCell(1, colLegal).value = 'Căn cứ pháp lý'
  worksheet.getCell(1, colNote).value = 'Ghi chú'

  const stats = {
    total: 0,
    exact: 0,
    ambiguous: 0,
    needs_review: 0,
    not_found: 0,
  }

  const results = []

  // Xử lý từng dòng (bỏ qua header dòng 1)
  const rowCount = worksheet.rowCount
  for (let r = 2; r <= rowCount; r++) {
    const row = worksheet.getRow(r)
    const isRowEmpty = !row.values || row.values.every(v => v === null || v === undefined || v === '')
    if (isRowEmpty) continue

    stats.total += 1

    let provVal = provinceCol ? String(row.getCell(provinceCol).value || '').trim() : ''
    let distVal = districtCol ? String(row.getCell(districtCol).value || '').trim() : ''
    let wardVal = wardCol ? String(row.getCell(wardCol).value || '').trim() : ''
    let addrVal = addressCol ? String(row.getCell(addressCol).value || '').trim() : ''

    const conv = convertOldToNew({
      province: provVal,
      district: distVal,
      ward: wardVal,
      addressString: addrVal,
    })

    // Ghi vào thống kê
    if (conv.status === 'exact') stats.exact += 1
    else if (conv.status === 'ambiguous') stats.ambiguous += 1
    else if (conv.status === 'needs_review') stats.needs_review += 1
    else stats.not_found += 1

    // Ghi kết quả vào ô Excel
    row.getCell(colNewProvince).value = conv.newAddress?.province || (conv.candidates?.[0]?.newProvince ? `Nhiều lựa chọn (${conv.candidates.map(c => c.newProvince).join(', ')})` : '—')
    row.getCell(colNewWard).value = conv.newAddress?.ward || (conv.candidates ? conv.candidates.map(c => c.newWard).join(' / ') : '—')
    row.getCell(colNewFullAddress).value = conv.newAddress?.fullAddress || (conv.status === 'ambiguous' ? 'Cần bổ sung số nhà/đường' : '—')

    const statusLabel = conv.status === 'exact' ? '🟢 Chính xác'
      : conv.status === 'ambiguous' ? '🟡 Cần kiểm tra (PARTIAL)'
      : conv.status === 'needs_review' ? '🟡 Cần kiểm tra cấp xã'
      : '🔴 Không tìm thấy'

    row.getCell(colStatus).value = statusLabel
    row.getCell(colConfidence).value = `${Math.round(conv.confidence * 100)}%`
    row.getCell(colMappingType).value = conv.mappingType || 'UNKNOWN'
    row.getCell(colLegal).value = conv.legalBasis?.documentNumber || '—'
    row.getCell(colNote).value = conv.note || conv.message || ''

    // Lưu preview row
    if (results.length < 50) {
      results.push({
        rowNumber: r,
        original: conv.original,
        newAddress: conv.newAddress,
        status: conv.status,
        mappingType: conv.mappingType,
        confidence: conv.confidence,
        note: conv.note || conv.message,
      })
    }
  }

  // Định dạng lại độ rộng cột mới
  [colNewProvince, colNewWard, colNewFullAddress, colStatus, colLegal].forEach(colIndex => {
    worksheet.getColumn(colIndex).width = 25
  })

  // Xuất file kết quả
  const outputBuffer = await workbook.xlsx.writeBuffer()

  return {
    stats,
    preview: results,
    buffer: Buffer.from(outputBuffer),
  }
}

/**
 * Lấy dữ liệu danh mục phân cấp để phục vụ UI dropdowns và gợi ý
 */
export const getAdminMetadata = () => {
  const db = getDatabase()
  const oldProvinces = db.prepare(`
    SELECT DISTINCT old_province_name as name, old_province_key as key
    FROM administrative_mappings
    WHERE old_province_name IS NOT NULL AND old_province_name != ''
    ORDER BY old_province_name COLLATE NOCASE
  `).all()

  const newProvinces = db.prepare(`
    SELECT DISTINCT new_province_name as name, new_province_key as key
    FROM administrative_mappings
    WHERE new_province_name IS NOT NULL AND new_province_name != ''
    ORDER BY new_province_name COLLATE NOCASE
  `).all()

  const legalDocs = db.prepare(`
    SELECT document_number, title, issuing_authority, issued_date, effective_date, source_url
    FROM legal_documents
    ORDER BY id
  `).all()

  return {
    oldProvinces,
    newProvinces,
    legalDocs,
  }
}

/**
 * Lấy danh sách quận/huyện theo tỉnh cũ
 */
export const getDistrictsByProvince = (province = '') => {
  if (!province) return []
  const db = getDatabase()
  const pKey = toMatchingKey(province)
  return db.prepare(`
    SELECT DISTINCT old_district_name as name, old_district_key as key
    FROM administrative_mappings
    WHERE (old_province_key = ? OR old_province_name = ?)
      AND old_district_name IS NOT NULL AND old_district_name != ''
    ORDER BY old_district_name COLLATE NOCASE
  `).all(pKey, province)
}

/**
 * Lấy danh sách xã/phường theo huyện và tỉnh cũ
 */
export const getWardsByDistrict = (province = '', district = '') => {
  if (!province) return []
  const db = getDatabase()
  const pKey = toMatchingKey(province)

  if (district) {
    const dKey = toMatchingKey(district)
    return db.prepare(`
      SELECT DISTINCT old_ward_name as name, old_ward_key as key
      FROM administrative_mappings
      WHERE (old_province_key = ? OR old_province_name = ?)
        AND (old_district_key = ? OR old_district_name = ?)
        AND old_ward_name IS NOT NULL AND old_ward_name != '*'
      ORDER BY old_ward_name COLLATE NOCASE
    `).all(pKey, province, dKey, district)
  }

  return db.prepare(`
    SELECT DISTINCT old_ward_name as name, old_ward_key as key
    FROM administrative_mappings
    WHERE (old_province_key = ? OR old_province_name = ?)
      AND old_ward_name IS NOT NULL AND old_ward_name != '*'
    ORDER BY old_ward_name COLLATE NOCASE
  `).all(pKey, province)
}

/**
 * Lấy danh sách xã/phường mới theo tỉnh/thành phố mới
 */
export const getNewWardsByProvince = (newProvince = '') => {
  if (!newProvince) return []
  const db = getDatabase()
  const pKey = toMatchingKey(newProvince)
  return db.prepare(`
    SELECT DISTINCT new_ward_name as name, new_ward_key as key
    FROM administrative_mappings
    WHERE (new_province_key = ? OR new_province_name = ?)
      AND new_ward_name IS NOT NULL AND new_ward_name != '*' AND new_ward_name != ''
    ORDER BY new_ward_name COLLATE NOCASE
  `).all(pKey, newProvince)
}


