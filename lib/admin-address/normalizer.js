/**
 * Normalization Engine cho Địa giới hành chính Việt Nam
 * Xử lý: Unicode NFC, chữ thường, dấu câu, viết tắt (TP, Q, H, P, X), không dấu
 */

export const normalizeUnicode = (str = '') => {
  return String(str || '').normalize('NFC').trim()
}

// Bảng chuyển đổi ký tự tiếng Việt có dấu sang không dấu
const VIETNAMESE_MAP = {
  à: 'a', á: 'a', ả: 'a', ã: 'a', ạ: 'a',
  ă: 'a', ằ: 'a', ắ: 'a', ẳ: 'a', ẵ: 'a', ặ: 'a',
  â: 'a', ầ: 'a', ấ: 'a', ẩ: 'a', ẫ: 'a', ậ: 'a',
  è: 'e', é: 'e', ẻ: 'e', ẽ: 'e', ẹ: 'e',
  ê: 'e', ề: 'e', ế: 'e', ể: 'e', ễ: 'e', ệ: 'e',
  ì: 'i', í: 'i', ỉ: 'i', ĩ: 'i', ị: 'i',
  ò: 'o', ó: 'o', ỏ: 'o', õ: 'o', ọ: 'o',
  ô: 'o', ồ: 'o', ố: 'o', ổ: 'o', ỗ: 'o', ộ: 'o',
  ơ: 'o', ờ: 'o', ớ: 'o', ở: 'o', ỡ: 'o', ợ: 'o',
  ù: 'u', ú: 'u', ủ: 'u', ũ: 'u', ụ: 'u',
  ư: 'u', ừ: 'u', ứ: 'u', ử: 'u', ữ: 'u', ự: 'u',
  ỳ: 'y', ý: 'y', ỷ: 'y', ỹ: 'y', ỵ: 'y',
  đ: 'd',
}

export const removeDiacritics = (str = '') => {
  const normalized = normalizeUnicode(str).toLowerCase()
  let result = ''
  for (const char of normalized) {
    result += VIETNAMESE_MAP[char] || char
  }
  return result
}

// Chuyển số La Mã cơ bản thường dùng cho Quận/Phường (Quận I -> Quận 1, v.v.)
const ROMAN_NUMERALS = {
  'i': '1', 'ii': '2', 'iii': '3', 'iv': '4', 'v': '5',
  'vi': '6', 'vii': '7', 'viii': '8', 'ix': '9', 'x': '10',
  'xi': '11', 'xii': '12',
}

export const normalizeRomanNumbers = (str = '') => {
  // Chỉ thay thế số La Mã khi đi kèm sau quận/phường (ví dụ: Quận I -> Quận 1, P. II -> P. 2)
  return str.replace(/(quận|phường|q\.|p\.|q|p)\s*(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)(?=\s|$|[,\.])/gi, (match, prefix, roman) => {
    const num = ROMAN_NUMERALS[roman.toLowerCase()]
    return num ? `${prefix} ${num}` : match
  })
}

// Danh mục alias tỉnh/thành phổ biến
const PROVINCE_ALIASES = {
  'tp hcm': 'ho chi minh',
  'tphcm': 'ho chi minh',
  'tp.hcm': 'ho chi minh',
  'tp. hcm': 'ho chi minh',
  'tp ho chi minh': 'ho chi minh',
  'tp. ho chi minh': 'ho chi minh',
  'hcm': 'ho chi minh',
  'sai gon': 'ho chi minh',
  'saigon': 'ho chi minh',
  'hn': 'ha noi',
  'tp hn': 'ha noi',
  'tp.hn': 'ha noi',
  'tp ha noi': 'ha noi',
  'tp. ha noi': 'ha noi',
  'danang': 'da nang',
  'tp da nang': 'da nang',
  'tp. da nang': 'da nang',
  'tp.da nang': 'da nang',
  'hp': 'hai phong',
  'tp hai phong': 'hai phong',
  'tp. hai phong': 'hai phong',
  'ct': 'can tho',
  'tp can tho': 'can tho',
  'tp. can tho': 'can tho',
  'hue': 'thua thien hue',
  'thanh pho hue': 'thua thien hue',
  'tt hue': 'thua thien hue',
  't.t. hue': 'thua thien hue',
  'tth': 'thua thien hue',
  'brvt': 'ba ria vung tau',
  'ba ria - vung tau': 'ba ria vung tau',
  'ba ria – vung tau': 'ba ria vung tau',
  'thu do ha noi': 'ha noi',
  'thu do': 'ha noi',
  'ha noi': 'ha noi',
}

/**
 * Loại bỏ tiền tố hành chính chuẩn (Tỉnh, TP, Quận, Huyện, Thị xã, Xã, Phường, Thị trấn, Thủ đô)
 */
export const stripAdminPrefix = (str = '') => {
  let cleaned = normalizeUnicode(str)
    .replace(/^[\s,.\-]+|[\s,.\-]+$/g, '')
    .trim()

  // 1. Tiền tố đầy đủ
  cleaned = cleaned.replace(/^(thủ đô|thành phố trực thuộc trung ương|thành phố|thị xã|tỉnh|quận|huyện|phường|thị trấn|xã|đặc khu)\s+/i, '')

  // 2. Viết tắt có dấu chấm: tp., q., h., p., x., tt. (theo sau có thể có hoặc không có dấu cách)
  cleaned = cleaned.replace(/^(tp|q|h|p|x|tt)\.\s*/i, '')

  // 3. Viết tắt có dấu cách: "tp ", "q ", "h ", "p ", "x ", "tt "
  cleaned = cleaned.replace(/^(tp|q|h|p|x|tt)\s+/i, '')

  // 4. Viết tắt dính liền với CHỮ SỐ (chỉ áp dụng cho q/p/h có số): q1, q12, p5, p10...
  cleaned = cleaned.replace(/^(q|p|h)(\d+)/i, '$2')

  return cleaned.trim()
}

/**
 * Chuẩn hóa tên phục vụ so khớp (Matching Key):
 * - Bỏ tiền tố hành chính
 * - Chuyển sang không dấu, chữ thường
 * - Quy đổi số La Mã sang số Ả Rập
 * - Loại bỏ dấu câu đặc biệt
 */
export const toMatchingKey = (str = '') => {
  if (!str) return ''
  let text = normalizeUnicode(str).toLowerCase()
  text = normalizeRomanNumbers(text)

  // Kiểm tra alias tỉnh trước
  const cleanAlias = text.replace(/[\s.-]+/g, ' ').trim()
  if (PROVINCE_ALIASES[cleanAlias]) {
    text = PROVINCE_ALIASES[cleanAlias]
  }

  // Bỏ tiền tố hành chính
  text = stripAdminPrefix(text)

  // Chuyển không dấu
  text = removeDiacritics(text)

  // Bỏ ký tự đặc biệt, chỉ giữ chữ cái, chữ số và khoảng trắng đơn
  text = text.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

  return text
}

/**
 * Phân loại loại đơn vị hành chính dựa vào tên gốc
 */
export const detectUnitType = (name = '', level = '') => {
  const lower = normalizeUnicode(name).toLowerCase()
  if (level === 'PROVINCE') {
    if (lower.startsWith('thành phố') || lower.startsWith('tp')) return 'Thành phố'
    return 'Tỉnh'
  }
  if (level === 'DISTRICT') {
    if (lower.startsWith('quận') || lower.startsWith('q.') || lower.startsWith('q ')) return 'Quận'
    if (lower.startsWith('thị xã') || lower.startsWith('tx')) return 'Thị xã'
    if (lower.startsWith('thành phố') || lower.startsWith('tp')) return 'Thành phố'
    return 'Huyện'
  }
  if (level === 'WARD') {
    if (lower.startsWith('phường') || lower.startsWith('p.') || lower.startsWith('p ')) return 'Phường'
    if (lower.startsWith('thị trấn') || lower.startsWith('tt.') || lower.startsWith('tt ')) return 'Thị trấn'
    if (lower.startsWith('đặc khu')) return 'Đặc khu'
    return 'Xã'
  }
  return ''
}
