/**
 * Trích xuất dữ liệu sáp nhập xã/phường từ các trang Thư Viện Pháp Luật đã tải về
 * Xử lý thông minh:
 * - Bóc tách tên xã và quận/huyện cũ đi kèm trong ngoặc (ví dụ: "Phường Hiệp Thành (thành phố Thủ Dầu Một)")
 * - Nhận diện trường hợp PARTIAL (chia tách một phần diện tích/dân số)
 * - Bỏ qua các dòng "Không sáp nhập"
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.dirname(path.dirname(__dirname))

function decodeEntities(str) {
  return str
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function normalizeNewWardName(raw) {
  const m = raw.match(/^(.*?)\s*\((Phường|Xã|Đặc khu|Thị trấn)\)$/i)
  if (m) {
    const name = m[1].trim()
    const type = m[2].trim()
    return `${type} ${name}`
  }
  return raw
}

const sources = [
  {
    path: '/Users/danhpham/.gemini/antigravity-ide/brain/c703268a-fa52-44e4-825c-42af11b19e6a/.system_generated/steps/618/content.md',
    province: 'Tỉnh Khánh Hòa',
    legalDoc: {
      number: '1667/NQ-UBTVQH15',
      title: 'Nghị quyết số 1667/NQ-UBTVQH15 sắp xếp các đơn vị hành chính cấp xã của tỉnh Khánh Hòa',
      authority: 'Ủy ban Thường vụ Quốc hội',
      effectiveDate: '2025-07-01',
      url: 'https://thuvienphapluat.vn/van-ban/bo-may-hanh-chinh/Nghi-quyet-1667-NQ-UBTVQH15-2025-sap-xep-cac-don-vi-hanh-chinh-cap-xa-Khanh-Hoa-661103.aspx',
    },
  },
  {
    path: '/Users/danhpham/.gemini/antigravity-ide/brain/c703268a-fa52-44e4-825c-42af11b19e6a/.system_generated/steps/644/content.md',
    province: 'Thành phố Đà Nẵng',
    legalDoc: {
      number: '1659/NQ-UBTVQH15',
      title: 'Nghị quyết số 1659/NQ-UBTVQH15 sắp xếp các đơn vị hành chính cấp xã thuộc thành phố Đà Nẵng',
      authority: 'Ủy ban Thường vụ Quốc hội',
      effectiveDate: '2025-07-01',
      url: 'https://thuvienphapluat.vn/van-ban/bo-may-hanh-chinh/Nghi-quyet-1659-NQ-UBTVQH15-2025-sap-xep-cac-don-vi-hanh-chinh-cap-xa-Da-Nang-661099.aspx',
    },
  },
  {
    path: '/Users/danhpham/.gemini/antigravity-ide/brain/c703268a-fa52-44e4-825c-42af11b19e6a/.system_generated/steps/806/content.md',
    province: 'Thành phố Hồ Chí Minh',
    legalDoc: {
      number: '1658/NQ-UBTVQH15',
      title: 'Nghị quyết số 1658/NQ-UBTVQH15 sắp xếp các đơn vị hành chính cấp xã thuộc Thành phố Hồ Chí Minh',
      authority: 'Ủy ban Thường vụ Quốc hội',
      effectiveDate: '2025-07-01',
      url: 'https://thuvienphapluat.vn/van-ban/bo-may-hanh-chinh/Nghi-quyet-1658-NQ-UBTVQH15-2025-sap-xep-cac-don-vi-hanh-chinh-cap-xa-Ho-Chi-Minh-661098.aspx',
    },
  },
  {
    path: '/Users/danhpham/.gemini/antigravity-ide/brain/c703268a-fa52-44e4-825c-42af11b19e6a/.system_generated/steps/808/content.md',
    province: 'Thành phố Hà Nội',
    legalDoc: {
      number: '1657/NQ-UBTVQH15',
      title: 'Nghị quyết số 1657/NQ-UBTVQH15 sắp xếp các đơn vị hành chính cấp xã thuộc thành phố Hà Nội',
      authority: 'Ủy ban Thường vụ Quốc hội',
      effectiveDate: '2025-07-01',
      url: 'https://thuvienphapluat.vn/van-ban/bo-may-hanh-chinh/Nghi-quyet-1657-NQ-UBTVQH15-2025-sap-xep-cac-don-vi-hanh-chinh-cap-xa-Ha-Noi-661097.aspx',
    },
  },
  {
    path: '/Users/danhpham/.gemini/antigravity-ide/brain/c703268a-fa52-44e4-825c-42af11b19e6a/.system_generated/steps/812/content.md',
    province: 'Thành phố Hải Phòng',
    legalDoc: {
      number: '1660/NQ-UBTVQH15',
      title: 'Nghị quyết số 1660/NQ-UBTVQH15 sắp xếp các đơn vị hành chính cấp xã thuộc thành phố Hải Phòng',
      authority: 'Ủy ban Thường vụ Quốc hội',
      effectiveDate: '2025-07-01',
      url: 'https://thuvienphapluat.vn/van-ban/bo-may-hanh-chinh/Nghi-quyet-1660-NQ-UBTVQH15-2025-sap-xep-cac-don-vi-hanh-chinh-cap-xa-Hai-Phong-661100.aspx',
    },
  },
  {
    path: '/Users/danhpham/.gemini/antigravity-ide/brain/c703268a-fa52-44e4-825c-42af11b19e6a/.system_generated/steps/814/content.md',
    province: 'Thành phố Cần Thơ',
    legalDoc: {
      number: '1661/NQ-UBTVQH15',
      title: 'Nghị quyết số 1661/NQ-UBTVQH15 sắp xếp các đơn vị hành chính cấp xã thuộc thành phố Cần Thơ',
      authority: 'Ủy ban Thường vụ Quốc hội',
      effectiveDate: '2025-07-01',
      url: 'https://thuvienphapluat.vn/van-ban/bo-may-hanh-chinh/Nghi-quyet-1661-NQ-UBTVQH15-2025-sap-xep-cac-don-vi-hanh-chinh-cap-xa-Can-Tho-661101.aspx',
    },
  },
  {
    path: '/Users/danhpham/.gemini/antigravity-ide/brain/c703268a-fa52-44e4-825c-42af11b19e6a/.system_generated/steps/816/content.md',
    province: 'Tỉnh Ninh Bình',
    legalDoc: {
      number: '1662/NQ-UBTVQH15',
      title: 'Nghị quyết số 1662/NQ-UBTVQH15 sắp xếp các đơn vị hành chính cấp xã của tỉnh Ninh Bình',
      authority: 'Ủy ban Thường vụ Quốc hội',
      effectiveDate: '2025-07-01',
      url: 'https://thuvienphapluat.vn/van-ban/bo-may-hanh-chinh/Nghi-quyet-1662-NQ-UBTVQH15-2025-sap-xep-cac-don-vi-hanh-chinh-cap-xa-Ninh-Binh-661102.aspx',
    },
  },
  {
    path: '/Users/danhpham/.gemini/antigravity-ide/brain/c703268a-fa52-44e4-825c-42af11b19e6a/.system_generated/steps/818/content.md',
    province: 'Tỉnh Đồng Nai',
    legalDoc: {
      number: '1663/NQ-UBTVQH15',
      title: 'Nghị quyết số 1663/NQ-UBTVQH15 sắp xếp các đơn vị hành chính cấp xã của tỉnh Đồng Nai',
      authority: 'Ủy ban Thường vụ Quốc hội',
      effectiveDate: '2025-07-01',
      url: 'https://thuvienphapluat.vn/van-ban/bo-may-hanh-chinh/Nghi-quyet-1663-NQ-UBTVQH15-2025-sap-xep-cac-don-vi-hanh-chinh-cap-xa-Dong-Nai-661104.aspx',
    },
  },
]

export function extractAllWards() {
  const extracted = []
  const legalDocs = []
  let docIdCounter = 100

  for (const src of sources) {
    if (!fs.existsSync(src.path)) {
      console.warn(`File không tồn tại: ${src.path}`)
      continue
    }

    const content = fs.readFileSync(src.path, 'utf8')
    const trRegex = /<tr>\s*<td class="text-center">(\d+)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<\/tr>/gs
    let match

    const docId = ++docIdCounter
    legalDocs.push({
      id: docId,
      document_number: src.legalDoc.number,
      document_type: 'Nghị quyết',
      title: src.legalDoc.title,
      issuing_authority: src.legalDoc.authority,
      issued_date: '2025-06-16',
      effective_date: src.legalDoc.effectiveDate,
      source_url: src.legalDoc.url,
      article: 'Điều 1',
      clause: 'Khoản 1',
    })

    while ((match = trRegex.exec(content)) !== null) {
      const stt = match[1]
      const newWardRaw = decodeEntities(match[2].trim())
      const newWardName = normalizeNewWardName(newWardRaw)
      const oldWardsRaw = decodeEntities(match[3].trim())

      if (oldWardsRaw.toLowerCase().includes('không sáp nhập')) {
        continue
      }

      const oldWards = oldWardsRaw
        .split(/,\s*/)
        .map(s => s.trim())
        .filter(Boolean)

      for (const rawItem of oldWards) {
        if (!rawItem || rawItem.toLowerCase().includes('không sáp nhập')) continue

        // Kiểm tra xem có ngoặc chỉ huyện/ghi chú không
        let cleanOldWard = rawItem
        let districtHint = ''
        let isPartial = false

        // Trường hợp: "Xã Hòa Liên (phần còn lại sau khi sáp nhập...)"
        if (rawItem.includes('phần còn lại') || rawItem.includes('một phần')) {
          isPartial = true
        }

        // Tách huyện đi kèm: "Phường Hiệp Thành (thành phố Thủ Dầu Một)"
        const parenMatch = rawItem.match(/^(.*?)\s*\((.*?)\)$/)
        if (parenMatch) {
          cleanOldWard = parenMatch[1].trim()
          districtHint = parenMatch[2].trim()
        }

        extracted.push({
          old_ward: cleanOldWard,
          district_hint: districtHint,
          new_province: src.province,
          new_ward: newWardName,
          mapping_type: isPartial ? 'PARTIAL' : 'FULL',
          legal_id: docId,
          all_old_wards: oldWards,
          note: isPartial
            ? `Sắp xếp một phần đơn vị hành chính theo ${src.legalDoc.number}`
            : `Hình thành đơn vị hành chính mới: ${newWardName} theo ${src.legalDoc.number}`,
        })
      }
    }
  }

  return { extracted, legalDocs }
}

const outDir = path.join(rootDir, 'data')
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}

const result = extractAllWards()
fs.writeFileSync(
  path.join(outDir, 'tvpl-extracted-wards.json'),
  JSON.stringify(result, null, 2),
  'utf8'
)

console.log(`Đã xuất ${result.extracted.length} mappings xã phường và ${result.legalDocs.length} căn cứ pháp lý vào data/tvpl-extracted-wards.json`)
