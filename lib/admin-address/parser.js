/**
 * Smart Vietnamese Address String Parser
 * Bóc tách và nhận diện địa chỉ thông minh dựa trên từ điển ĐVHC 63 tỉnh/thành:
 * - Nhận diện Tỉnh/TP, Quận/Huyện, Xã/Phường theo từ điển chính xác
 * - Hỗ trợ cả trường hợp có dấu phẩy lẫn không có dấu phẩy
 * - Hỗ trợ tiếng Việt có dấu, không dấu, viết tắt (TP, Q, H, P, X, TX...)
 * - Tự động suy luận Tỉnh nếu người dùng chỉ nhập Huyện (ví dụ: Tam Kỳ -> Quảng Nam, Quận 1 -> TP.HCM)
 * - Tự động suy luận Huyện và Tỉnh nếu nhập Xã đặc trưng (ví dụ: Phường Bến Nghé -> Q1, TP.HCM)
 * - Tự động bóc tách số nhà, tên đường, thôn, xóm, tòa nhà làm `detail`
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeUnicode, stripAdminPrefix, toMatchingKey, removeDiacritics, normalizeRomanNumbers } from './normalizer.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.dirname(path.dirname(__dirname))

let dictionary = null

/**
 * Khởi tạo từ điển tra cứu địa giới từ vietnam-units.json
 */
function getDictionary() {
  if (dictionary) return dictionary

  const unitsPath = path.join(rootDir, 'data', 'vietnam-units.json')
  let units = []
  try {
    if (fs.existsSync(unitsPath)) {
      units = JSON.parse(fs.readFileSync(unitsPath, 'utf8'))
    }
  } catch (e) {
    console.warn('Lỗi tải vietnam-units.json trong parser:', e.message)
  }

  // 1. Danh mục Tỉnh/Thành phố
  const provinces = []
  const provincesByKey = new Map()

  // Alias tỉnh/thành mở rộng
  const ALIAS_MAP = {
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
    'ct': 'can tho',
    'tp can tho': 'can tho',
    'brvt': 'ba ria vung tau',
    'ba ria - vung tau': 'ba ria vung tau',
    'ba ria – vung tau': 'ba ria vung tau',
    'thua thien hue': 'thua thien hue',
    'tt hue': 'thua thien hue',
    'hue': 'thua thien hue',
  }

  const districtsByProvKey = new Map()
  const wardsByProvKey = new Map()
  const allDistrictsLookup = new Map()
  const allWardsLookup = new Map()

  for (const p of units) {
    const pKey = toMatchingKey(p.name)
    const strippedKey = toMatchingKey(stripAdminPrefix(p.name))
    const pNoDia = removeDiacritics(p.name)
    const pStripNoDia = removeDiacritics(stripAdminPrefix(p.name))

    const pObj = {
      name: p.name,
      key: pKey,
      strippedKey,
      noDia: pNoDia,
      stripNoDia: pStripNoDia,
      districts: p.districts || [],
    }
    provinces.push(pObj)
    provincesByKey.set(pKey, pObj)
    if (strippedKey) provincesByKey.set(strippedKey, pObj)
    if (pNoDia) provincesByKey.set(pNoDia, pObj)
    if (pStripNoDia) provincesByKey.set(pStripNoDia, pObj)

    const dMap = new Map()
    const wMap = new Map()

    for (const d of p.districts || []) {
      const dKey = toMatchingKey(d.name)
      const dStrip = toMatchingKey(stripAdminPrefix(d.name))
      const dNoDia = removeDiacritics(d.name)
      const dStripNoDia = removeDiacritics(stripAdminPrefix(d.name))
      const isNumbered = /^\d+$/.test(dStrip)

      const dObj = {
        name: d.name,
        key: dKey,
        strippedKey: dStrip,
        provinceName: p.name,
        provinceKey: pKey,
        isNumbered,
        wards: d.wards || []
      }

      dMap.set(dKey, dObj)
      if (dStrip && !isNumbered) dMap.set(dStrip, dObj)
      if (dNoDia) dMap.set(dNoDia, dObj)
      if (dStripNoDia && !isNumbered) dMap.set(dStripNoDia, dObj)

      // Đăng ký tra cứu toàn quốc
      const regDistKeys = isNumbered ? [dKey, dNoDia] : [dKey, dStrip, dNoDia, dStripNoDia]
      for (const k of regDistKeys) {
        if (!k) continue
        if (!allDistrictsLookup.has(k)) allDistrictsLookup.set(k, [])
        allDistrictsLookup.get(k).push(dObj)
      }

      for (const w of d.wards || []) {
        const wKey = toMatchingKey(w.name)
        const wStrip = toMatchingKey(stripAdminPrefix(w.name))
        const wNoDia = removeDiacritics(w.name)
        const wStripNoDia = removeDiacritics(stripAdminPrefix(w.name))
        const isWardNumbered = /^\d+$/.test(wStrip)

        const wObj = {
          name: w.name,
          key: wKey,
          strippedKey: wStrip,
          districtName: d.name,
          provinceName: p.name,
          provinceKey: pKey,
          isNumbered: isWardNumbered
        }

        const regWardKeys = isWardNumbered ? [wKey, wNoDia] : [wKey, wStrip, wNoDia, wStripNoDia]
        for (const k of regWardKeys) {
          if (!k) continue
          if (!wMap.has(k)) wMap.set(k, [])
          wMap.get(k).push(wObj)

          if (!allWardsLookup.has(k)) allWardsLookup.set(k, [])
          allWardsLookup.get(k).push(wObj)
        }
      }
    }

    districtsByProvKey.set(pKey, dMap)
    wardsByProvKey.set(pKey, wMap)
  }

  dictionary = {
    provinces,
    provincesByKey,
    districtsByProvKey,
    wardsByProvKey,
    allDistrictsLookup,
    allWardsLookup,
    ALIAS_MAP,
  }

  return dictionary
}

/**
 * Tìm tỉnh phù hợp từ chuỗi
 */
function matchProvince(text = '') {
  if (!text) return null
  const dict = getDictionary()
  const key = toMatchingKey(text)
  if (!key) return null

  // 1. Kiểm tra alias trước
  const resolvedKey = dict.ALIAS_MAP[key] || key

  if (dict.provincesByKey.has(resolvedKey)) {
    return dict.provincesByKey.get(resolvedKey)
  }

  // 2. Tìm theo substring / prefix
  for (const p of dict.provinces) {
    if (key === p.key || key === p.strippedKey) return p
    if (key.endsWith(p.strippedKey) || key.endsWith(p.key)) return p
  }

  return null
}

/**
 * Tìm quận/huyện trong một tỉnh
 */
function matchDistrict(text = '', provKey = '') {
  if (!text) return null
  const dict = getDictionary()
  const dMap = dict.districtsByProvKey.get(provKey)
  if (!dMap) return null

  const key = toMatchingKey(text)
  if (dMap.has(key)) return dMap.get(key)

  const stripKey = toMatchingKey(stripAdminPrefix(text))
  if (dMap.has(stripKey)) return dMap.get(stripKey)

  for (const [k, d] of dMap.entries()) {
    if (key === k || key.endsWith(k)) return d
  }

  return null
}

/**
 * Tìm xã/phường trong một tỉnh (hoặc huyện)
 */
function matchWard(text = '', provKey = '', distKey = '') {
  if (!text) return null
  const dict = getDictionary()
  const wMap = dict.wardsByProvKey.get(provKey)
  if (!wMap) return null

  const key = toMatchingKey(text)
  const stripKey = toMatchingKey(stripAdminPrefix(text))

  let candidates = wMap.get(key) || wMap.get(stripKey) || []

  if (candidates.length === 0) {
    // Thử so khớp đuôi
    for (const [k, list] of wMap.entries()) {
      if (key === k || key.endsWith(k) || k.endsWith(key)) {
        candidates = list
        break
      }
    }
  }

  if (candidates.length === 0) return null

  if (distKey) {
    const filtered = candidates.filter(c => toMatchingKey(c.districtName).includes(distKey) || distKey.includes(toMatchingKey(c.districtName)))
    if (filtered.length > 0) return filtered[0]
  }

  return candidates[0]
}

/**
 * Trích xuất tiền tố chi tiết (số nhà, đường...) trước tên đơn vị hành chính trong 1 phân đoạn
 */
function extractLeadingDetail(segmentText = '', matchedUnitName = '') {
  if (!segmentText || !matchedUnitName) return ''
  const stripName = stripAdminPrefix(matchedUnitName)
  for (const n of [matchedUnitName, stripName]) {
    const escaped = escapeRegExp(n)
    const re = new RegExp(`(?:^|[\\s,;.-])${escaped}\\s*$`, 'i')
    if (re.test(segmentText)) {
      return segmentText.replace(re, '').trim()
    }
  }
  return ''
}

/**
 * Hàm phân tích chuỗi địa chỉ thông minh
 */
export const parseAddressString = (rawAddress = '') => {
  const raw = normalizeUnicode(rawAddress).replace(/[\r\n\t]+/g, ' ').trim()
  if (!raw) {
    return { detail: '', ward: '', district: '', province: '', raw: '' }
  }

  const dict = getDictionary()

  // 1. Nếu có dấu phân cách (dấu phẩy, chấm phẩy, gạch ngang có khoảng trắng)
  const segments = raw
    .split(/[,;]+|\s+-\s+/)
    .map(s => s.trim())
    .filter(Boolean)

  if (segments.length >= 2) {
    let province = ''
    let provKey = ''
    let district = ''
    let distKey = ''
    let ward = ''
    let wardIndex = -1
    let districtIndex = -1
    let provinceIndex = -1
    let extraLeadingDetail = ''

    // Quét từ cuối lên đầu tìm Tỉnh/Thành
    for (let i = segments.length - 1; i >= 0; i--) {
      const p = matchProvince(segments[i])
      if (p) {
        province = p.name
        provKey = p.key
        provinceIndex = i
        break
      }
    }

    // Nếu tìm thấy tỉnh
    if (province && provinceIndex >= 0) {
      // Tìm Quận/Huyện trước vị trí Tỉnh
      for (let i = provinceIndex - 1; i >= 0; i--) {
        const d = matchDistrict(segments[i], provKey)
        if (d) {
          district = d.name
          distKey = d.key
          districtIndex = i
          break
        }
      }

      // Tìm Xã/Phường trước vị trí Huyện (hoặc trước Tỉnh nếu không có Huyện)
      const maxWardIdx = districtIndex >= 0 ? districtIndex - 1 : provinceIndex - 1
      for (let i = maxWardIdx; i >= 0; i--) {
        const w = matchWard(segments[i], provKey, distKey)
        if (w) {
          ward = w.name
          wardIndex = i
          if (!district && w.districtName) {
            district = w.districtName
            distKey = toMatchingKey(district)
          }
          extraLeadingDetail = extractLeadingDetail(segments[i], w.name)
          break
        }
      }

      // Phần chi tiết (Số nhà, tên đường, thôn, xóm...)
      let detailEndIdx = wardIndex >= 0 ? wardIndex : (districtIndex >= 0 ? districtIndex : provinceIndex)
      const detailParts = segments.slice(0, detailEndIdx)
      if (extraLeadingDetail) {
        detailParts.push(extraLeadingDetail)
      }
      const detail = detailParts.join(', ').trim()

      return {
        detail,
        ward,
        district,
        province,
        raw,
      }
    }

    // Trường hợp không có Tỉnh trong chuỗi: Kiểm tra Quận/Huyện từ allDistrictsLookup
    for (let i = segments.length - 1; i >= 0; i--) {
      const segKey = toMatchingKey(segments[i])
      const distMatches = dict.allDistrictsLookup.get(segKey)
      if (distMatches && distMatches.length > 0) {
        // Tìm thấy Quận/Huyện!
        const dCandidate = distMatches[0]
        district = dCandidate.name
        districtIndex = i
        province = dCandidate.provinceName
        provKey = dCandidate.provinceKey
        distKey = dCandidate.key

        // Tìm Xã/Phường trước vị trí Quận/Huyện này
        for (let j = districtIndex - 1; j >= 0; j--) {
          const w = matchWard(segments[j], provKey, distKey)
          if (w) {
            ward = w.name
            wardIndex = j
            extraLeadingDetail = extractLeadingDetail(segments[j], w.name)
            break
          }
        }

        let detailEndIdx = wardIndex >= 0 ? wardIndex : districtIndex
        const detailParts = segments.slice(0, detailEndIdx)
        if (extraLeadingDetail) detailParts.push(extraLeadingDetail)
        const detail = detailParts.join(', ').trim()

        return { detail, ward, district, province, raw }
      }
    }

    // Trường hợp không có cả Tỉnh lẫn Huyện: Kiểm tra Xã/Phường đặc trưng từ allWardsLookup
    for (let i = segments.length - 1; i >= 0; i--) {
      const segKey = toMatchingKey(segments[i])
      const wardMatches = dict.allWardsLookup.get(segKey)
      if (wardMatches && wardMatches.length > 0) {
        // Nếu là tên xã duy nhất hoặc người dùng chỉ nhập xã
        const wCandidate = wardMatches[0]
        ward = wCandidate.name
        district = wCandidate.districtName
        province = wCandidate.provinceName
        wardIndex = i
        extraLeadingDetail = extractLeadingDetail(segments[i], wCandidate.name)

        const detailParts = segments.slice(0, wardIndex)
        if (extraLeadingDetail) detailParts.push(extraLeadingDetail)
        const detail = detailParts.join(', ').trim()

        return { detail, ward, district, province, raw }
      }
    }
  }

  // 2. Không có dấu phẩy hoặc không tìm thấy theo phân đoạn: Quét tự do thông minh (Free-text Boundary Scanner)
  return parseFreeTextWithoutPunctuation(raw, dict)
}

/**
 * Phân tích chuỗi tự do không có dấu phân cách rõ ràng hoặc dính liền
 */
function parseFreeTextWithoutPunctuation(raw, dict) {
  let text = raw.trim()
  let province = ''
  let provKey = ''
  let district = ''
  let distKey = ''
  let ward = ''

  // 1. Tìm tỉnh ở phần đuôi của chuỗi
  for (const p of dict.provinces) {
    const names = [
      p.name,
      stripAdminPrefix(p.name),
      removeDiacritics(p.name),
      removeDiacritics(stripAdminPrefix(p.name))
    ]
    for (const [alias, targetKey] of Object.entries(dict.ALIAS_MAP)) {
      if (targetKey === p.key) names.push(alias)
    }

    // Sắp xếp các tên theo độ dài giảm dần để ưu tiên tên dài nhất
    names.sort((a, b) => b.length - a.length)

    for (const name of names) {
      if (!name) continue
      const escaped = escapeRegExp(name)
      const regex = new RegExp(`(?:^|[\\s,;.-])${escaped}\\s*$`, 'i')
      if (regex.test(text)) {
        province = p.name
        provKey = p.key
        text = text.replace(regex, '').replace(/[,; -]+$/, '').trim()
        break
      }
    }
    if (province) break
  }

  // 2. Nếu tìm thấy tỉnh, tìm tiếp quận/huyện ở đuôi phần còn lại
  if (provKey) {
    const dMap = dict.districtsByProvKey.get(provKey)
    if (dMap) {
      // Sắp xếp quận/huyện theo độ dài tên giảm dần
      const dList = Array.from(dMap.values())
      dList.sort((a, b) => b.name.length - a.name.length)

      for (const d of dList) {
        const names = [
          d.name,
          stripAdminPrefix(d.name),
          removeDiacritics(d.name),
          removeDiacritics(stripAdminPrefix(d.name))
        ]
        names.sort((a, b) => b.length - a.length)

        for (const name of names) {
          if (!name) continue
          const escaped = escapeRegExp(name)
          const regex = new RegExp(`(?:^|[\\s,;.-])${escaped}\\s*$`, 'i')
          if (regex.test(text)) {
            district = d.name
            distKey = d.key
            text = text.replace(regex, '').replace(/[,; -]+$/, '').trim()
            break
          }
        }
        if (district) break
      }
    }

    // 3. Tìm xã/phường ở đuôi phần còn lại
    const wMap = dict.wardsByProvKey.get(provKey)
    if (wMap) {
      const allWList = []
      for (const list of wMap.values()) {
        for (const w of list) {
          if (district && w.districtName !== district) continue
          allWList.push(w)
        }
      }
      allWList.sort((a, b) => b.name.length - a.name.length)

      for (const w of allWList) {
        const names = [
          w.name,
          stripAdminPrefix(w.name),
          removeDiacritics(w.name),
          removeDiacritics(stripAdminPrefix(w.name))
        ]
        names.sort((a, b) => b.length - a.length)

        for (const name of names) {
          if (!name) continue
          const escaped = escapeRegExp(name)
          const regex = new RegExp(`(?:^|[\\s,;.-])${escaped}\\s*$`, 'i')
          if (regex.test(text)) {
            ward = w.name
            if (!district) {
              district = w.districtName
              distKey = toMatchingKey(district)
            }
            text = text.replace(regex, '').replace(/[,; -]+$/, '').trim()
            break
          }
        }
        if (ward) break
      }
    }
  } else {
    // Không tìm thấy tỉnh ở cuối: Thử tìm theo Quận/Huyện từ allDistrictsLookup
    for (const [k, dMatches] of dict.allDistrictsLookup.entries()) {
      if (k.length < 3) continue // Tránh khớp số 1, 2 nhầm với số nhà
      const escaped = escapeRegExp(k)
      const regex = new RegExp(`(?:^|[\\s,;.-])${escaped}\\s*$`, 'i')
      if (regex.test(text)) {
        const dCandidate = dMatches[0]
        district = dCandidate.name
        distKey = dCandidate.key
        province = dCandidate.provinceName
        provKey = dCandidate.provinceKey
        text = text.replace(regex, '').replace(/[,; -]+$/, '').trim()

        // Tìm tiếp xã
        const wMap = dict.wardsByProvKey.get(provKey)
        if (wMap) {
          for (const list of wMap.values()) {
            for (const w of list) {
              if (w.districtName !== district) continue
              const wNames = [w.name, stripAdminPrefix(w.name)]
              for (const wn of wNames) {
                const wEsc = escapeRegExp(wn)
                const wReg = new RegExp(`(?:^|[\\s,;.-])${wEsc}\\s*$`, 'i')
                if (wReg.test(text)) {
                  ward = w.name
                  text = text.replace(wReg, '').replace(/[,; -]+$/, '').trim()
                  break
                }
              }
              if (ward) break
            }
            if (ward) break
          }
        }
        break
      }
    }
  }

  return {
    detail: text.replace(/[,; -]+$/, '').trim(),
    ward,
    district,
    province,
    raw,
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
