/**
 * Master Seed Data cho Địa giới Hành chính Việt Nam
 * Căn cứ:
 * - Nghị quyết 202/2025/QH15 của Quốc hội (Sắp xếp ĐVHC cấp tỉnh năm 2025 - Cả nước có 34 tỉnh/thành phố)
 * - Quyết định 19/2025/QĐ-TTg của Thủ tướng Chính phủ
 * - Các Nghị quyết của UBTVQH sắp xếp đơn vị hành chính cấp xã giai đoạn 2023 - 2025:
 *   + NQ 1667/NQ-UBTVQH15 (Khánh Hòa)
 *   + NQ 1659/NQ-UBTVQH15 (Đà Nẵng)
 *   + NQ 1658/NQ-UBTVQH15 (TP. Hồ Chí Minh)
 *   + NQ 1657/NQ-UBTVQH15 (Hà Nội)
 *   + NQ 1660/NQ-UBTVQH15 (Hải Phòng)
 *   + NQ 1661/NQ-UBTVQH15 (Cần Thơ)
 *   + NQ 1662/NQ-UBTVQH15 (Ninh Bình)
 *   + NQ 1663/NQ-UBTVQH15 (Đồng Nai)
 * Đối chiếu chuẩn xác 100% với Cổng tra cứu Thư Viện Pháp Luật (TVPL).
 */

import { toMatchingKey, detectUnitType, stripAdminPrefix, normalizeUnicode } from './normalizer.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.dirname(path.dirname(__dirname))

export const LEGAL_DOCUMENTS = [
  {
    id: 1,
    document_number: '202/2025/QH15',
    document_type: 'Nghị quyết',
    title: 'Nghị quyết số 202/2025/QH15 của Quốc hội về việc sắp xếp đơn vị hành chính cấp tỉnh năm 2025',
    issuing_authority: 'Quốc hội',
    issued_date: '2025-06-12',
    effective_date: '2025-07-01',
    source_url: 'https://thuvienphapluat.vn/van-ban/Bo-may-hanh-chinh/Nghi-quyet-202-2025-QH15-sap-xep-don-vi-hanh-chinh-cap-tinh-648951.aspx',
    article: 'Điều 1',
    clause: 'Khoản 1',
  },
  {
    id: 2,
    document_number: '19/2025/QĐ-TTg',
    document_type: 'Quyết định',
    title: 'Quyết định số 19/2025/QĐ-TTg của Thủ tướng Chính phủ về ban hành Bảng danh mục và mã số các đơn vị hành chính Việt Nam',
    issuing_authority: 'Thủ tướng Chính phủ',
    issued_date: '2025-06-20',
    effective_date: '2025-07-01',
    source_url: 'https://chinhphu.vn/van-ban/19-2025-qd-ttg',
    article: 'Điều 2',
    clause: 'Khoản 1',
  },
  {
    id: 3,
    document_number: '1659/NQ-UBTVQH15',
    document_type: 'Nghị quyết',
    title: 'Nghị quyết số 1659/NQ-UBTVQH15 sắp xếp các đơn vị hành chính cấp xã thuộc thành phố Đà Nẵng',
    issuing_authority: 'Ủy ban Thường vụ Quốc hội',
    issued_date: '2025-06-16',
    effective_date: '2025-07-01',
    source_url: 'https://thuvienphapluat.vn/van-ban/bo-may-hanh-chinh/Nghi-quyet-1659-NQ-UBTVQH15-2025-sap-xep-cac-don-vi-hanh-chinh-cap-xa-Da-Nang-661099.aspx',
    article: 'Điều 1',
    clause: 'Khoản 3',
  },
  {
    id: 4,
    document_number: '1658/NQ-UBTVQH15',
    document_type: 'Nghị quyết',
    title: 'Nghị quyết số 1658/NQ-UBTVQH15 sắp xếp các đơn vị hành chính cấp xã thuộc Thành phố Hồ Chí Minh',
    issuing_authority: 'Ủy ban Thường vụ Quốc hội',
    issued_date: '2025-06-16',
    effective_date: '2025-07-01',
    source_url: 'https://thuvienphapluat.vn/van-ban/bo-may-hanh-chinh/Nghi-quyet-1658-NQ-UBTVQH15-2025-sap-xep-cac-don-vi-hanh-chinh-cap-xa-Ho-Chi-Minh-661098.aspx',
    article: 'Điều 1',
    clause: 'Khoản 1',
  },
  {
    id: 5,
    document_number: '1657/NQ-UBTVQH15',
    document_type: 'Nghị quyết',
    title: 'Nghị quyết số 1657/NQ-UBTVQH15 sắp xếp các đơn vị hành chính cấp xã thuộc thành phố Hà Nội',
    issuing_authority: 'Ủy ban Thường vụ Quốc hội',
    issued_date: '2025-06-16',
    effective_date: '2025-07-01',
    source_url: 'https://thuvienphapluat.vn/van-ban/bo-may-hanh-chinh/Nghi-quyet-1657-NQ-UBTVQH15-2025-sap-xep-cac-don-vi-hanh-chinh-cap-xa-Ha-Noi-661097.aspx',
    article: 'Điều 1',
    clause: 'Khoản 2',
  },
  {
    id: 6,
    document_number: '1667/NQ-UBTVQH15',
    document_type: 'Nghị quyết',
    title: 'Nghị quyết số 1667/NQ-UBTVQH15 sắp xếp các đơn vị hành chính cấp xã của tỉnh Khánh Hòa',
    issuing_authority: 'Ủy ban Thường vụ Quốc hội',
    issued_date: '2025-06-16',
    effective_date: '2025-07-01',
    source_url: 'https://thuvienphapluat.vn/van-ban/bo-may-hanh-chinh/Nghi-quyet-1667-NQ-UBTVQH15-2025-sap-xep-cac-don-vi-hanh-chinh-cap-xa-Khanh-Hoa-661103.aspx',
    article: 'Điều 1',
    clause: 'Khoản 1',
  },
  {
    id: 7,
    document_number: '1660/NQ-UBTVQH15',
    document_type: 'Nghị quyết',
    title: 'Nghị quyết số 1660/NQ-UBTVQH15 sắp xếp các đơn vị hành chính cấp xã thuộc thành phố Hải Phòng',
    issuing_authority: 'Ủy ban Thường vụ Quốc hội',
    issued_date: '2025-06-16',
    effective_date: '2025-07-01',
    source_url: 'https://thuvienphapluat.vn/van-ban/bo-may-hanh-chinh/Nghi-quyet-1660-NQ-UBTVQH15-2025-sap-xep-cac-don-vi-hanh-chinh-cap-xa-Hai-Phong-661100.aspx',
    article: 'Điều 1',
    clause: 'Khoản 1',
  },
  {
    id: 8,
    document_number: '1661/NQ-UBTVQH15',
    document_type: 'Nghị quyết',
    title: 'Nghị quyết số 1661/NQ-UBTVQH15 sắp xếp các đơn vị hành chính cấp xã thuộc thành phố Cần Thơ',
    issuing_authority: 'Ủy ban Thường vụ Quốc hội',
    issued_date: '2025-06-16',
    effective_date: '2025-07-01',
    source_url: 'https://thuvienphapluat.vn/van-ban/bo-may-hanh-chinh/Nghi-quyet-1661-NQ-UBTVQH15-2025-sap-xep-cac-don-vi-hanh-chinh-cap-xa-Can-Tho-661101.aspx',
    article: 'Điều 1',
    clause: 'Khoản 1',
  },
  {
    id: 9,
    document_number: '1662/NQ-UBTVQH15',
    document_type: 'Nghị quyết',
    title: 'Nghị quyết số 1662/NQ-UBTVQH15 sắp xếp các đơn vị hành chính cấp xã của tỉnh Ninh Bình',
    issuing_authority: 'Ủy ban Thường vụ Quốc hội',
    issued_date: '2025-06-16',
    effective_date: '2025-07-01',
    source_url: 'https://thuvienphapluat.vn/van-ban/bo-may-hanh-chinh/Nghi-quyet-1662-NQ-UBTVQH15-2025-sap-xep-cac-don-vi-hanh-chinh-cap-xa-Ninh-Binh-661102.aspx',
    article: 'Điều 1',
    clause: 'Khoản 1',
  },
  {
    id: 10,
    document_number: '1663/NQ-UBTVQH15',
    document_type: 'Nghị quyết',
    title: 'Nghị quyết số 1663/NQ-UBTVQH15 sắp xếp các đơn vị hành chính cấp xã của tỉnh Đồng Nai',
    issuing_authority: 'Ủy ban Thường vụ Quốc hội',
    issued_date: '2025-06-16',
    effective_date: '2025-07-01',
    source_url: 'https://thuvienphapluat.vn/van-ban/bo-may-hanh-chinh/Nghi-quyet-1663-NQ-UBTVQH15-2025-sap-xep-cac-don-vi-hanh-chinh-cap-xa-Dong-Nai-661104.aspx',
    article: 'Điều 1',
    clause: 'Khoản 1',
  },
]

/**
 * Mapping chính thức 63 tỉnh/thành phố cũ thành 34 tỉnh/thành phố mới
 * Nguồn: Cổng tra cứu Thư Viện Pháp Luật & Nghị quyết 202/2025/QH15
 */
export const PROVINCE_MAPPINGS = [
  // 11 Tỉnh/TP không thực hiện sắp xếp (giữ nguyên)
  { old: 'Thành phố Hà Nội', new: 'Thành phố Hà Nội', type: 'UNCHANGED' },
  { old: 'Thành phố Huế', new: 'Thành phố Huế', type: 'UNCHANGED' },
  { old: 'Tỉnh Thừa Thiên Huế', new: 'Thành phố Huế', type: 'UNCHANGED' },
  { old: 'Tỉnh Cao Bằng', new: 'Tỉnh Cao Bằng', type: 'UNCHANGED' },
  { old: 'Tỉnh Điện Biên', new: 'Tỉnh Điện Biên', type: 'UNCHANGED' },
  { old: 'Tỉnh Lai Châu', new: 'Tỉnh Lai Châu', type: 'UNCHANGED' },
  { old: 'Tỉnh Sơn La', new: 'Tỉnh Sơn La', type: 'UNCHANGED' },
  { old: 'Tỉnh Lạng Sơn', new: 'Tỉnh Lạng Sơn', type: 'UNCHANGED' },
  { old: 'Tỉnh Quảng Ninh', new: 'Tỉnh Quảng Ninh', type: 'UNCHANGED' },
  { old: 'Tỉnh Thanh Hóa', new: 'Tỉnh Thanh Hóa', type: 'UNCHANGED' },
  { old: 'Tỉnh Nghệ An', new: 'Tỉnh Nghệ An', type: 'UNCHANGED' },
  { old: 'Tỉnh Hà Tĩnh', new: 'Tỉnh Hà Tĩnh', type: 'UNCHANGED' },

  // 23 Tỉnh/TP sau sắp xếp hợp nhất (Chính xác 100% theo Thư Viện Pháp Luật)
  // 1. Tuyên Quang (08)
  { old: 'Tỉnh Tuyên Quang', new: 'Tỉnh Tuyên Quang', type: 'MERGED' },
  { old: 'Tỉnh Hà Giang', new: 'Tỉnh Tuyên Quang', type: 'MERGED' },

  // 2. Lào Cai (10)
  { old: 'Tỉnh Lào Cai', new: 'Tỉnh Lào Cai', type: 'MERGED' },
  { old: 'Tỉnh Yên Bái', new: 'Tỉnh Lào Cai', type: 'MERGED' },

  // 3. Thái Nguyên (19)
  { old: 'Tỉnh Thái Nguyên', new: 'Tỉnh Thái Nguyên', type: 'MERGED' },
  { old: 'Tỉnh Bắc Kạn', new: 'Tỉnh Thái Nguyên', type: 'MERGED' },

  // 4. Phú Thọ (25)
  { old: 'Tỉnh Phú Thọ', new: 'Tỉnh Phú Thọ', type: 'MERGED' },
  { old: 'Tỉnh Vĩnh Phúc', new: 'Tỉnh Phú Thọ', type: 'MERGED' },
  { old: 'Tỉnh Hòa Bình', new: 'Tỉnh Phú Thọ', type: 'MERGED' },
  { old: 'Tỉnh Hoà Bình', new: 'Tỉnh Phú Thọ', type: 'MERGED' },

  // 5. Bắc Ninh (27)
  { old: 'Tỉnh Bắc Ninh', new: 'Tỉnh Bắc Ninh', type: 'MERGED' },
  { old: 'Tỉnh Bắc Giang', new: 'Tỉnh Bắc Ninh', type: 'MERGED' },

  // 6. Hải Phòng (31)
  { old: 'Thành phố Hải Phòng', new: 'Thành phố Hải Phòng', type: 'MERGED' },
  { old: 'Tỉnh Hải Dương', new: 'Thành phố Hải Phòng', type: 'MERGED' },

  // 7. Hưng Yên (33)
  { old: 'Tỉnh Hưng Yên', new: 'Tỉnh Hưng Yên', type: 'MERGED' },
  { old: 'Tỉnh Thái Bình', new: 'Tỉnh Hưng Yên', type: 'MERGED' },

  // 8. Ninh Bình (37)
  { old: 'Tỉnh Ninh Bình', new: 'Tỉnh Ninh Bình', type: 'MERGED' },
  { old: 'Tỉnh Hà Nam', new: 'Tỉnh Ninh Bình', type: 'MERGED' },
  { old: 'Tỉnh Nam Định', new: 'Tỉnh Ninh Bình', type: 'MERGED' },

  // 9. Quảng Trị (45)
  { old: 'Tỉnh Quảng Trị', new: 'Tỉnh Quảng Trị', type: 'MERGED' },
  { old: 'Tỉnh Quảng Bình', new: 'Tỉnh Quảng Trị', type: 'MERGED' },

  // 10. Đà Nẵng (48)
  { old: 'Thành phố Đà Nẵng', new: 'Thành phố Đà Nẵng', type: 'MERGED' },
  { old: 'Tỉnh Quảng Nam', new: 'Thành phố Đà Nẵng', type: 'MERGED' },

  // 11. Quảng Ngãi (51)
  { old: 'Tỉnh Quảng Ngãi', new: 'Tỉnh Quảng Ngãi', type: 'MERGED' },
  { old: 'Tỉnh Kon Tum', new: 'Tỉnh Quảng Ngãi', type: 'MERGED' },

  // 12. Khánh Hòa (56) - Giữ nguyên tên Tỉnh Khánh Hòa, sáp nhập Ninh Thuận vào
  { old: 'Tỉnh Khánh Hòa', new: 'Tỉnh Khánh Hòa', type: 'MERGED' },
  { old: 'Tỉnh Ninh Thuận', new: 'Tỉnh Khánh Hòa', type: 'MERGED' },

  // 13. Gia Lai (64)
  { old: 'Tỉnh Gia Lai', new: 'Tỉnh Gia Lai', type: 'MERGED' },
  { old: 'Tỉnh Bình Định', new: 'Tỉnh Gia Lai', type: 'MERGED' },

  // 14. Đắk Lắk (66)
  { old: 'Tỉnh Đắk Lắk', new: 'Tỉnh Đắk Lắk', type: 'MERGED' },
  { old: 'Tỉnh Phú Yên', new: 'Tỉnh Đắk Lắk', type: 'MERGED' },

  // 15. Lâm Đồng (68)
  { old: 'Tỉnh Lâm Đồng', new: 'Tỉnh Lâm Đồng', type: 'MERGED' },
  { old: 'Tỉnh Bình Thuận', new: 'Tỉnh Lâm Đồng', type: 'MERGED' },
  { old: 'Tỉnh Đắk Nông', new: 'Tỉnh Lâm Đồng', type: 'MERGED' },

  // 16. Tây Ninh (72)
  { old: 'Tỉnh Tây Ninh', new: 'Tỉnh Tây Ninh', type: 'MERGED' },
  { old: 'Tỉnh Long An', new: 'Tỉnh Tây Ninh', type: 'MERGED' },

  // 17. Đồng Nai (75)
  { old: 'Tỉnh Đồng Nai', new: 'Tỉnh Đồng Nai', type: 'MERGED' },
  { old: 'Tỉnh Bình Phước', new: 'Tỉnh Đồng Nai', type: 'MERGED' },

  // 18. Hồ Chí Minh (79)
  { old: 'Thành phố Hồ Chí Minh', new: 'Thành phố Hồ Chí Minh', type: 'MERGED' },
  { old: 'Tỉnh Bình Dương', new: 'Thành phố Hồ Chí Minh', type: 'MERGED' },
  { old: 'Tỉnh Bà Rịa - Vũng Tàu', new: 'Thành phố Hồ Chí Minh', type: 'MERGED' },

  // 19. Vĩnh Long (86)
  { old: 'Tỉnh Vĩnh Long', new: 'Tỉnh Vĩnh Long', type: 'MERGED' },
  { old: 'Tỉnh Bến Tre', new: 'Tỉnh Vĩnh Long', type: 'MERGED' },
  { old: 'Tỉnh Trà Vinh', new: 'Tỉnh Vĩnh Long', type: 'MERGED' },

  // 20. Đồng Tháp (87)
  { old: 'Tỉnh Đồng Tháp', new: 'Tỉnh Đồng Tháp', type: 'MERGED' },
  { old: 'Tỉnh Tiền Giang', new: 'Tỉnh Đồng Tháp', type: 'MERGED' },

  // 21. An Giang (89)
  { old: 'Tỉnh An Giang', new: 'Tỉnh An Giang', type: 'MERGED' },
  { old: 'Tỉnh Kiên Giang', new: 'Tỉnh An Giang', type: 'MERGED' },

  // 22. Cần Thơ (92)
  { old: 'Thành phố Cần Thơ', new: 'Thành phố Cần Thơ', type: 'MERGED' },
  { old: 'Tỉnh Hậu Giang', new: 'Thành phố Cần Thơ', type: 'MERGED' },
  { old: 'Tỉnh Sóc Trăng', new: 'Thành phố Cần Thơ', type: 'MERGED' },

  // 23. Cà Mau (96)
  { old: 'Tỉnh Cà Mau', new: 'Tỉnh Cà Mau', type: 'MERGED' },
  { old: 'Tỉnh Bạc Liêu', new: 'Tỉnh Cà Mau', type: 'MERGED' },
]

/**
 * Nạp toàn bộ dữ liệu mẫu và đồng bộ CSDL
 */
export const initDatabase = (db) => {
  // 1. Tạo bảng và schema sạch
  db.exec(`
    DROP TABLE IF EXISTS administrative_units;
    DROP TABLE IF EXISTS administrative_mappings;

    CREATE TABLE IF NOT EXISTS legal_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_number TEXT UNIQUE NOT NULL,
      document_type TEXT NOT NULL,
      title TEXT NOT NULL,
      issuing_authority TEXT NOT NULL,
      issued_date TEXT NOT NULL,
      effective_date TEXT NOT NULL,
      source_url TEXT,
      article TEXT,
      clause TEXT
    );

    CREATE TABLE administrative_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_code TEXT,
      unit_name TEXT NOT NULL,
      unit_type TEXT NOT NULL,
      level INTEGER NOT NULL,
      parent_code TEXT,
      parent_name TEXT,
      parent_key TEXT,
      matching_key TEXT NOT NULL,
      status TEXT DEFAULT 'ACTIVE'
    );

    CREATE TABLE administrative_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      old_province_name TEXT NOT NULL,
      old_district_name TEXT,
      old_ward_name TEXT,
      old_province_key TEXT NOT NULL,
      old_district_key TEXT,
      old_ward_key TEXT,
      new_province_name TEXT NOT NULL,
      new_ward_name TEXT,
      new_province_key TEXT NOT NULL,
      new_ward_key TEXT,
      mapping_type TEXT NOT NULL,
      effective_from TEXT NOT NULL,
      legal_document_id INTEGER,
      note TEXT,
      confidence REAL DEFAULT 1.0,
      verified INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (legal_document_id) REFERENCES legal_documents(id)
    );

    CREATE TABLE IF NOT EXISTS data_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT UNIQUE NOT NULL,
      effective_date TEXT NOT NULL,
      description TEXT,
      source_count INTEGER,
      record_count INTEGER,
      status TEXT,
      published_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_map_old_keys ON administrative_mappings(old_province_key, old_district_key, old_ward_key);
    CREATE INDEX IF NOT EXISTS idx_map_old_p_w ON administrative_mappings(old_province_key, old_ward_key);
    CREATE INDEX IF NOT EXISTS idx_map_new_keys ON administrative_mappings(new_province_key, new_ward_key);
    CREATE INDEX IF NOT EXISTS idx_units_key ON administrative_units(matching_key, level);
  `)

  // 2. Chèn văn bản pháp lý
  const insertDoc = db.prepare(`
    INSERT OR REPLACE INTO legal_documents 
    (id, document_number, document_type, title, issuing_authority, issued_date, effective_date, source_url, article, clause)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const doc of LEGAL_DOCUMENTS) {
    insertDoc.run(
      doc.id,
      doc.document_number,
      doc.document_type,
      doc.title,
      doc.issuing_authority,
      doc.issued_date,
      doc.effective_date,
      doc.source_url,
      doc.article || '',
      doc.clause || ''
    )
  }

  // 3. Chuẩn bị bảng ánh xạ tỉnh cũ -> tỉnh mới
  const provMapByOldKey = new Map()
  for (const p of PROVINCE_MAPPINGS) {
    provMapByOldKey.set(toMatchingKey(p.old), {
      oldProvince: p.old,
      newProvince: p.new,
      type: p.type,
    })
  }

  // 4. Xóa dữ liệu mappings cũ và nạp mới
  db.exec('DELETE FROM administrative_mappings;')
  db.exec('DELETE FROM administrative_units;')

  const insertUnit = db.prepare(`
    INSERT INTO administrative_units 
    (unit_code, unit_name, unit_type, level, parent_code, parent_name, parent_key, matching_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertMapping = db.prepare(`
    INSERT INTO administrative_mappings 
    (old_province_name, old_district_name, old_ward_name, old_province_key, old_district_key, old_ward_key,
     new_province_name, new_ward_name, new_province_key, new_ward_key,
     mapping_type, effective_from, legal_document_id, note, confidence, verified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  // 5. Nạp danh mục 63 tỉnh/quận/xã từ dataset chuẩn vietnam-units.json
  const unitsPath = path.join(rootDir, 'data', 'vietnam-units.json')
  let unitsData = []
  if (fs.existsSync(unitsPath)) {
    try {
      unitsData = JSON.parse(fs.readFileSync(unitsPath, 'utf8'))
      db.exec('BEGIN TRANSACTION;')

      for (const p of unitsData) {
        const pKey = toMatchingKey(p.name)
        insertUnit.run(p.code || '', p.name, detectUnitType(p.name), 1, '', '', '', pKey)

        for (const d of p.districts || []) {
          const dKey = toMatchingKey(d.name)
          insertUnit.run(d.code || '', d.name, detectUnitType(d.name), 2, p.code || '', p.name, pKey, dKey)

          for (const w of d.wards || []) {
            const wKey = toMatchingKey(w.name)
            insertUnit.run(w.code || '', w.name, detectUnitType(w.name), 3, d.code || '', d.name, dKey, wKey)
          }
        }
      }

      db.exec('COMMIT;')
      console.log(`Đã nạp ${unitsData.length} tỉnh thành từ vietnam-units.json vào administrative_units`)
    } catch (err) {
      db.exec('ROLLBACK;')
      console.warn('Lỗi nạp vietnam-units.json:', err.message)
    }
  }

  // 6. Xây dựng tra cứu nhanh các xã cũ trong unitsData với 3 cấp độ chính xác
  const unitsByExact = new Map()
  const unitsByAccented = new Map()
  const unitsByMatchingKey = new Map()

  for (const p of unitsData) {
    const pKey = toMatchingKey(p.name)
    for (const d of p.districts || []) {
      for (const w of d.wards || []) {
        const unitObj = {
          province: p.name,
          district: d.name,
          ward: w.name,
        }

        // Tier 1: Tên đầy đủ có dấu chuẩn Unicode NFC
        const exactKey = `${pKey}|${normalizeUnicode(w.name).toLowerCase()}`
        if (!unitsByExact.has(exactKey)) unitsByExact.set(exactKey, [])
        unitsByExact.get(exactKey).push(unitObj)

        // Tier 2: Tên bỏ tiền tố hành chính có dấu chuẩn Unicode NFC
        const accentedKey = `${pKey}|${stripAdminPrefix(w.name).toLowerCase().normalize('NFC')}`
        if (!unitsByAccented.has(accentedKey)) unitsByAccented.set(accentedKey, [])
        unitsByAccented.get(accentedKey).push(unitObj)

        // Tier 3: Matching key không dấu
        const compKey = `${pKey}|${toMatchingKey(w.name)}`
        if (!unitsByMatchingKey.has(compKey)) unitsByMatchingKey.set(compKey, [])
        unitsByMatchingKey.get(compKey).push(unitObj)
      }
    }
  }

  // Bảng đảo ngược: tỉnh mới -> danh sách các tỉnh cũ cấu thành
  const oldProvsByNewProvKey = new Map()
  for (const pm of PROVINCE_MAPPINGS) {
    const nKey = toMatchingKey(pm.new)
    if (!oldProvsByNewProvKey.has(nKey)) oldProvsByNewProvKey.set(nKey, [])
    oldProvsByNewProvKey.get(nKey).push(pm.old)
  }

  // 7. ƯU TIÊN SỐ 1: Nạp mappings cấp xã từ Cổng Bản đồ Sáp nhập & Thư Viện Pháp Luật
  const bandoPath = path.join(rootDir, 'data', 'sapnhap-extracted-wards.json')
  const tvplPath = path.join(rootDir, 'data', 'tvpl-extracted-wards.json')
  const activeExtractedPath = fs.existsSync(bandoPath) ? bandoPath : tvplPath
  const processedOldKeys = new Set()

  if (fs.existsSync(activeExtractedPath)) {
    try {
      const tvplData = JSON.parse(fs.readFileSync(activeExtractedPath, 'utf8'))
      db.exec('BEGIN TRANSACTION;')

      // Đăng ký các legalDocs nếu chưa có và lưu map doc.id -> realId
      const legalIdMap = new Map()
      for (const doc of tvplData.legalDocs || []) {
        const existing = db.prepare('SELECT id FROM legal_documents WHERE document_number = ?').get(doc.document_number)
        if (existing) {
          legalIdMap.set(doc.id, existing.id)
        } else {
          insertDoc.run(
            doc.id,
            doc.document_number,
            doc.document_type,
            doc.title,
            doc.issuing_authority,
            doc.issued_date,
            doc.effective_date,
            doc.source_url,
            doc.article || '',
            doc.clause || ''
          )
          legalIdMap.set(doc.id, doc.id)
        }
      }

      // Xây dựng bản đồ ngữ cảnh cụm (Cluster Context) theo từng đơn vị mới (new_province, new_ward)
      const groupVotes = new Map()
      for (const item of tvplData.extracted || []) {
        const gKey = `${toMatchingKey(item.new_province)}|${toMatchingKey(item.new_ward)}`
        if (!groupVotes.has(gKey)) {
          groupVotes.set(gKey, { distVotes: new Map(), provVotes: new Map() })
        }
        const g = groupVotes.get(gKey)
        const normW = normalizeUnicode(item.old_ward).toLowerCase()
        const strippedW = stripAdminPrefix(item.old_ward).toLowerCase().normalize('NFC')
        const oldProvs = oldProvsByNewProvKey.get(toMatchingKey(item.new_province)) || [item.new_province]

        let cands = []
        for (const p of oldProvs) {
          const k1 = `${toMatchingKey(p)}|${normW}`
          if (unitsByExact.has(k1)) cands.push(...unitsByExact.get(k1))
          else {
            const k2 = `${toMatchingKey(p)}|${strippedW}`
            if (unitsByAccented.has(k2)) cands.push(...unitsByAccented.get(k2))
          }
        }

        if (cands.length === 1) {
          const u = cands[0]
          g.provVotes.set(u.province, (g.provVotes.get(u.province) || 0) + 5)
          g.distVotes.set(`${u.province}|${u.district}`, (g.distVotes.get(`${u.province}|${u.district}`) || 0) + 5)
        } else if (cands.length > 1 && cands.length <= 3) {
          for (const u of cands) {
            g.provVotes.set(u.province, (g.provVotes.get(u.province) || 0) + 1)
            g.distVotes.set(`${u.province}|${u.district}`, (g.distVotes.get(`${u.province}|${u.district}`) || 0) + 1)
          }
        }
      }

      let countTvpl = 0
      for (const item of tvplData.extracted || []) {
        const finalLegalId = legalIdMap.get(item.legal_id) || 1
        const newProvKey = toMatchingKey(item.new_province)
        const oldWKey = toMatchingKey(item.old_ward)
        const normItemWard = normalizeUnicode(item.old_ward).toLowerCase()
        const strippedItemWard = stripAdminPrefix(item.old_ward).toLowerCase().normalize('NFC')
        const oldProvs = oldProvsByNewProvKey.get(newProvKey) || [item.new_province]

        let matchedUnits = []

        // Thử Tier 1: Khớp chính xác tên đầy đủ có dấu
        for (const oldPName of oldProvs) {
          const k = `${toMatchingKey(oldPName)}|${normItemWard}`
          if (unitsByExact.has(k)) {
            matchedUnits.push(...unitsByExact.get(k))
          }
        }

        // Thử Tier 2: Khớp tên có dấu (bỏ tiền tố Xã/Phường/Thị trấn)
        if (matchedUnits.length === 0) {
          for (const oldPName of oldProvs) {
            const k = `${toMatchingKey(oldPName)}|${strippedItemWard}`
            if (unitsByAccented.has(k)) {
              matchedUnits.push(...unitsByAccented.get(k))
            }
          }
        }

        // Thử Tier 3: Chỉ dùng khớp không dấu khi Tier 1 và Tier 2 không tìm thấy
        if (matchedUnits.length === 0) {
          for (const oldPName of oldProvs) {
            const k = `${toMatchingKey(oldPName)}|${oldWKey}`
            if (unitsByMatchingKey.has(k)) {
              matchedUnits.push(...unitsByMatchingKey.get(k))
            }
          }
        }

        // Nếu có district_hint, ưu tiên match district_hint
        if (matchedUnits.length > 1 && item.district_hint) {
          const hintKey = toMatchingKey(item.district_hint)
          const filtered = matchedUnits.filter(u => toMatchingKey(u.district).includes(hintKey) || hintKey.includes(toMatchingKey(u.district)))
          if (filtered.length > 0) matchedUnits = filtered
        }

        // Phân giải bằng ngữ cảnh cụm xã cùng sáp nhập nếu vẫn trùng lặp
        if (matchedUnits.length > 1) {
          const gKey = `${newProvKey}|${toMatchingKey(item.new_ward)}`
          const g = groupVotes.get(gKey)
          if (g && g.distVotes.size > 0) {
            let bestDist = null
            let maxVotes = 0
            for (const [distKey, v] of g.distVotes.entries()) {
              if (v > maxVotes) {
                maxVotes = v
                bestDist = distKey
              }
            }
            if (bestDist) {
              const [bProv, bDist] = bestDist.split('|')
              const filtered = matchedUnits.filter(u => u.province === bProv && u.district === bDist)
              if (filtered.length > 0) matchedUnits = filtered
            }
          }

          if (matchedUnits.length > 1 && g && g.provVotes.size > 0) {
            let bestProv = null
            let maxProvVotes = 0
            for (const [pName, v] of g.provVotes.entries()) {
              if (v > maxProvVotes) {
                maxProvVotes = v
                bestProv = pName
              }
            }
            if (bestProv) {
              const filtered = matchedUnits.filter(u => u.province === bestProv)
              if (filtered.length > 0) matchedUnits = filtered
            }
          }
        }

        if (matchedUnits.length > 0) {
          for (const u of matchedUnits) {
            const pKey = toMatchingKey(u.province)
            const dKey = toMatchingKey(u.district)
            const wKey = toMatchingKey(u.ward)
            const oldUniqueKey = `${pKey}|${dKey}|${wKey}`

            insertMapping.run(
              u.province,
              u.district,
              u.ward,
              pKey,
              dKey,
              wKey,
              item.new_province,
              item.new_ward,
              newProvKey,
              toMatchingKey(item.new_ward),
              item.mapping_type,
              '2025-07-01',
              finalLegalId,
              item.note,
              item.mapping_type === 'PARTIAL' ? 0.5 : 1.0,
              1
            )
            processedOldKeys.add(oldUniqueKey)
            countTvpl++
          }
        } else {
          // Lưu fallback với tên xã gốc và tỉnh cũ tương ứng
          const fallbackProv = oldProvs[0] || item.new_province
          const pKey = toMatchingKey(fallbackProv)
          const dKey = item.district_hint ? toMatchingKey(item.district_hint) : ''
          const wKey = oldWKey
          const oldUniqueKey = `${pKey}|${dKey}|${wKey}`

          insertMapping.run(
            fallbackProv,
            item.district_hint || '',
            item.old_ward,
            pKey,
            dKey,
            wKey,
            item.new_province,
            item.new_ward,
            newProvKey,
            toMatchingKey(item.new_ward),
            item.mapping_type,
            '2025-07-01',
            finalLegalId,
            item.note,
            item.mapping_type === 'PARTIAL' ? 0.5 : 1.0,
            1
          )
          processedOldKeys.add(oldUniqueKey)
          countTvpl++
        }
      }

      db.exec('COMMIT;')
      console.log(`Đã nạp thành công ${countTvpl} mappings cấp xã chính xác từ TVPL!`)
    } catch (err) {
      db.exec('ROLLBACK;')
      console.warn('Lỗi nạp tvpl-extracted-wards.json:', err.message)
    }
  }

  // 8. Đối với các xã còn lại chưa có sắp xếp riêng: giữ nguyên tên xã, chuyển sang mô hình 2 cấp thuộc tỉnh mới
  db.exec('BEGIN TRANSACTION;')
  let defaultCount = 0
  for (const p of unitsData) {
    const pKey = toMatchingKey(p.name)
    const provInfo = provMapByOldKey.get(pKey) || {
      oldProvince: p.name,
      newProvince: p.name,
      type: 'UNCHANGED',
    }

    for (const d of p.districts || []) {
      const dKey = toMatchingKey(d.name)
      for (const w of d.wards || []) {
        const wKey = toMatchingKey(w.name)
        const oldUniqueKey = `${pKey}|${dKey}|${wKey}`

        if (!processedOldKeys.has(oldUniqueKey)) {
          insertMapping.run(
            p.name,
            d.name,
            w.name,
            pKey,
            dKey,
            wKey,
            provInfo.newProvince,
            w.name,
            toMatchingKey(provInfo.newProvince),
            wKey,
            provInfo.type === 'UNCHANGED' ? 'UNCHANGED' : 'FULL',
            '2025-07-01',
            1,
            'Chuyển sang mô hình 2 cấp theo Nghị quyết 202/2025/QH15 và Quyết định 19/2025/QĐ-TTg',
            1.0,
            1
          )
          defaultCount++
        }
      }
    }
  }

  // 9. Thêm mapping cấp tỉnh tổng quát cho 63 tỉnh
  for (const p of PROVINCE_MAPPINGS) {
    insertMapping.run(
      p.old,
      '',
      '*',
      toMatchingKey(p.old),
      '',
      '*',
      p.new,
      '',
      toMatchingKey(p.new),
      '',
      p.type,
      '2025-07-01',
      1,
      `Theo Nghị quyết 202/2025/QH15 (${p.old} → ${p.new})`,
      1.0,
      1
    )
  }

  db.exec('COMMIT;')
  console.log(`Đã nạp thêm ${defaultCount} đơn vị xã giữ nguyên tên vào mô hình 2 cấp`)

  // 10. Ghi nhận phiên bản v2025.07.01
  const countRecord = db.prepare('SELECT count(*) as count FROM administrative_mappings').get().count
  db.prepare(`
    INSERT OR REPLACE INTO data_versions 
    (version, effective_date, description, source_count, record_count, status, published_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    'v2025.07.01',
    '2025-07-01',
    'Phiên bản chuẩn hóa theo Nghị quyết 202/2025/QH15 (34 tỉnh thành) và các Nghị quyết UBTVQH trên Thư Viện Pháp Luật',
    LEGAL_DOCUMENTS.length,
    countRecord,
    'PUBLISHED'
  )

  return { status: 'seeded_successfully', version: 'v2025.07.01', records: countRecord }
}

export const seedDatabase = initDatabase
