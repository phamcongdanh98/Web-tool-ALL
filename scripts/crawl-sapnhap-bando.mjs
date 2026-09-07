/**
 * Crawler & Data Extractor cho CSDL Sáp nhập Đơn vị Hành chính Việt Nam
 * Nguồn: Cổng bản đồ tra cứu ĐVHC (Bộ Nông nghiệp & Môi trường / NXB TN-MT & Bản đồ Việt Nam)
 * URL: https://sapnhap.bando.com.vn/
 * 
 * Thu thập toàn diện:
 * - 34 tỉnh/thành phố mới sau sắp xếp (Nghị quyết 202/2025/QH15)
 * - 3.321 xã/phường/đặc khu mới
 * - Chi tiết các xã/phường cũ sáp nhập cấu thành, trụ sở UBND, diện tích, dân số
 * - 35 Nghị quyết chính thức của UBTVQH15 và đường dẫn văn bản gốc trên vanban.chinhphu.vn
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.dirname(__dirname)
const dataDir = path.join(rootDir, 'data')

const BASE_URL = 'https://sapnhap.bando.com.vn/p.co_bangbieu'

/**
 * Chuẩn hóa tên tỉnh/thành phố mới
 */
function formatProvinceName(name) {
  let n = String(name || '').trim()
  n = n.replace(/^Thành Phố\s+/i, 'Thành phố ')
  n = n.replace(/^Thủ Đô\s+/i, 'Thành phố ')
  n = n.replace(/^Tỉnh\s+/i, 'Tỉnh ')
  return n
}

/**
 * Chuẩn hóa và bóc tách tên đơn vị cấp xã cũ từ chuỗi truocsapnhap
 */
function cleanOldWardName(raw) {
  let name = String(raw || '').trim()
  let districtHint = ''
  let isPartial = false

  // Kiểm tra dấu hiệu một phần diện tích / dân số
  if (
    name.includes('một phần') ||
    name.includes('phần còn lại') ||
    name.includes('sau khi sáp nhập') ||
    name.includes('sau khi sắp xếp') ||
    name.includes('sau sắp xếp')
  ) {
    isPartial = true
  }

  // Bóc tách ghi chú trong ngoặc đơn, ví dụ: "Phường Thuận An (thị xã Long Mỹ)"
  const parenMatch = name.match(/^(.*?)\s*\((.*?)\)$/)
  if (parenMatch) {
    const mainPart = parenMatch[1].trim()
    const inside = parenMatch[2].trim()

    if (
      inside.toLowerCase().includes('thị xã') ||
      inside.toLowerCase().includes('huyện') ||
      inside.toLowerCase().includes('quận') ||
      inside.toLowerCase().includes('thành phố')
    ) {
      name = mainPart
      districtHint = inside
    } else if (
      inside.toLowerCase().includes('phần') ||
      inside.toLowerCase().includes('sáp nhập') ||
      inside.toLowerCase().includes('sắp xếp')
    ) {
      name = mainPart
      isPartial = true
    } else {
      name = mainPart
    }
  }

  // Dọn dẹp các từ nối hoặc cụm từ thừa ở đầu tên
  name = name.replace(/^(và\s+|của\s+|các\s+|toàn bộ\s+)+/i, '').trim()

  return { name, districtHint, isPartial }
}

/**
 * Tách danh sách xã cũ từ chuỗi mô tả
 */
function splitOldWards(truocStr) {
  if (!truocStr) return []
  const text = String(truocStr).trim()
  if (text.toLowerCase() === 'giữ nguyên' || text.toLowerCase() === 'giữ nguyên, không sáp nhập') {
    return []
  }

  // Tách theo dấu phẩy, chấm phẩy hoặc từ nối "và" (dùng khoảng trắng để tránh cắt nhầm từ "vào")
  const rawParts = text
    .split(/,\s*|;\s*|\s+và\s+/gi)
    .map(s => s.trim())
    .filter(Boolean)

  const result = []

  for (const part of rawParts) {
    // Bỏ qua các cụm mô tả phi danh từ riêng
    if (
      /^(một phần diện tích|quy mô dân số|diện tích tự nhiên|dân số|sau khi sắp xếp|sau khi sáp nhập|sau sắp xếp)$/i.test(
        part
      )
    ) {
      continue
    }

    const cleaned = cleanOldWardName(part)
    if (cleaned.name && cleaned.name.length >= 2) {
      if (/^(một phần|toàn bộ|sau khi|sau sắp xếp)$/i.test(cleaned.name)) {
        continue
      }
      result.push(cleaned)
    }
  }

  return result
}

export async function crawlAllAdministrativeData(options = {}) {
  console.log('🚀 [Crawl] Bắt đầu kết nối Cổng Dữ liệu Bản đồ Sáp nhập Việt Nam...')
  console.log(`🌐 Endpoint: ${BASE_URL}`)

  const startTime = Date.now()

  // 1. Lấy danh sách 34 tỉnh/thành phố mới
  const provRes = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'ma=vn',
  })

  if (!provRes.ok) {
    throw new Error(`Lỗi kết nối API danh sách tỉnh: HTTP ${provRes.status}`)
  }

  const provText = await provRes.text()
  const provParts = provText.split('.synt.')
  if (!provParts[1]) {
    throw new Error('Định dạng phản hồi API tỉnh không hợp lệ')
  }

  const provinces = JSON.parse(provParts[1])
  console.log(`✅ Đã tìm thấy ${provinces.length} tỉnh/thành phố mới cấp trung ương.`)

  // 2. Thu thập xã/phường cho từng tỉnh (chạy song song)
  console.log('⏳ Đang thu thập dữ liệu xã/phường cho toàn bộ 34 tỉnh/thành phố...')
  const provincePromises = provinces.map(async p => {
    try {
      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `ma=${encodeURIComponent(p.malk)}`,
      })
      const txt = await res.text()
      const parts = txt.split('.synt.')
      const pInfo = JSON.parse(parts[0] || '{}')
      const wards = JSON.parse(parts[1] || '[]')
      return { pInfo: { ...p, ...pInfo }, wards }
    } catch (err) {
      console.warn(`⚠️ Lỗi lấy dữ liệu tỉnh ${p.ten}:`, err.message)
      return { pInfo: p, wards: [] }
    }
  })

  const allProvincesData = await Promise.all(provincePromises)

  // 3. Phân tích và cấu trúc hóa dữ liệu
  const legalDocsMap = new Map()
  let docIdCounter = 100

  const extracted = []
  let totalWardsCount = 0
  let fullCount = 0
  let partialCount = 0
  let unchangedCount = 0

  for (const { pInfo, wards } of allProvincesData) {
    totalWardsCount += wards.length

    for (const w of wards) {
      // Xác định văn bản pháp lý
      const cancu = (w.cancu || pInfo.cancu || '').trim()
      let legalId = 1

      if (cancu) {
        const docNumMatch = cancu.match(/\d+[\/\w\-]+/)
        const docNumber = docNumMatch ? docNumMatch[0] : cancu.replace(/[^\w\d]/g, '_')

        if (!legalDocsMap.has(docNumber)) {
          docIdCounter++
          legalDocsMap.set(docNumber, {
            id: docIdCounter,
            document_number: docNumber,
            document_type: 'Nghị quyết',
            title: cancu,
            issuing_authority: 'Ủy ban Thường vụ Quốc hội',
            issued_date: '2025-06-16',
            effective_date: '2025-07-01',
            source_url: w.link || pInfo.link || 'https://vanban.chinhphu.vn',
            article: 'Điều 1',
            clause: 'Khoản 1',
          })
        }
        legalId = legalDocsMap.get(docNumber).id
      }

      const truocStr = (w.truocsapnhap || '').trim()
      const isUnchanged =
        !truocStr ||
        truocStr.toLowerCase() === 'giữ nguyên' ||
        truocStr.toLowerCase() === 'giữ nguyên, không sáp nhập'

      const hq = w.trungtamhc ? ` (Trụ sở: ${w.trungtamhc})` : ''
      const areaPop = []
      if (w.dientichkm2) areaPop.push(`Diện tích: ${w.dientichkm2} km²`)
      if (w.dansonguoi) areaPop.push(`Dân số: ${w.dansonguoi} người`)
      const extraStats = areaPop.length ? ` [${areaPop.join(' · ')}]` : ''

      const formattedProvName = formatProvinceName(pInfo.ten)

      if (isUnchanged) {
        unchangedCount++
        extracted.push({
          old_ward: w.ten,
          district_hint: '',
          new_province: formattedProvName,
          new_ward: w.ten,
          mapping_type: 'UNCHANGED',
          legal_id: legalId,
          all_old_wards: [w.ten],
          note: `Đơn vị hành chính ${w.ten} giữ nguyên ranh giới theo ${cancu || 'Nghị quyết của UBTVQH'}${hq}${extraStats}`,
          trungtamhc: w.trungtamhc || '',
          dientichkm2: w.dientichkm2 || '',
          dansonguoi: w.dansonguoi || '',
          ward_code: w.ma || '',
        })
      } else {
        const oldWards = splitOldWards(truocStr)
        const allOldNames = oldWards.map(x => x.name)
        if (allOldNames.length === 0) {
          allOldNames.push(w.ten)
        }

        for (const ow of oldWards) {
          if (ow.isPartial) {
            partialCount++
          } else {
            fullCount++
          }

          extracted.push({
            old_ward: ow.name,
            district_hint: ow.districtHint || '',
            new_province: formattedProvName,
            new_ward: w.ten,
            mapping_type: ow.isPartial ? 'PARTIAL' : 'FULL',
            legal_id: legalId,
            all_old_wards: allOldNames,
            note: `Hình thành đơn vị mới: ${w.ten} theo ${cancu || 'Nghị quyết của UBTVQH'}${hq}${extraStats}`,
            trungtamhc: w.trungtamhc || '',
            dientichkm2: w.dientichkm2 || '',
            dansonguoi: w.dansonguoi || '',
            ward_code: w.ma || '',
          })
        }
      }
    }
  }

  const legalDocs = Array.from(legalDocsMap.values())

  // Tính toán Checksum SHA-256 của toàn bộ tập dữ liệu đã bóc tách
  const contentToHash = JSON.stringify({ extracted, legalDocs })
  const checksum = crypto.createHash('sha256').update(contentToHash).digest('hex')

  const bandoFile = path.join(dataDir, 'sapnhap-extracted-wards.json')
  const tvplFile = path.join(dataDir, 'tvpl-extracted-wards.json')

  let hasChanged = true
  if (fs.existsSync(bandoFile)) {
    try {
      const existing = JSON.parse(fs.readFileSync(bandoFile, 'utf8'))
      if (existing.metadata && existing.metadata.checksum === checksum) {
        hasChanged = false
      }
    } catch {}
  }

  const outputData = {
    metadata: {
      source: 'Cổng tra cứu Đơn vị hành chính Việt Nam (https://sapnhap.bando.com.vn/)',
      crawled_at: new Date().toISOString(),
      checksum,
      has_changed: hasChanged,
      provinces_count: allProvincesData.length,
      wards_count: totalWardsCount,
      mappings_count: extracted.length,
      full_mappings: fullCount,
      partial_mappings: partialCount,
      unchanged_mappings: unchangedCount,
      legal_docs_count: legalDocs.length,
    },
    legalDocs,
    extracted,
  }

  // 4. Lưu ra các file CSDL
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2)

  // Nếu dữ liệu không thay đổi và không ép buộc (force), bỏ qua việc ghi đè file
  if (!hasChanged && !options.force) {
    console.log(
      `ℹ️ [Crawl] Dữ liệu từ sapnhap.bando.com.vn không có sự thay đổi (SHA-256: ${checksum.slice(0, 10)}...). Bỏ qua ghi đĩa. (${duration}s)`
    )
    return { ...outputData, hasChanged: false, checksum }
  }

  fs.writeFileSync(bandoFile, JSON.stringify(outputData, null, 2), 'utf8')
  console.log(`💾 Đã lưu dữ liệu đầy đủ vào: ${bandoFile}`)

  // Đồng thời cập nhật file tvpl-extracted-wards.json để tương thích 100% với hệ thống hiện hữu
  fs.writeFileSync(tvplFile, JSON.stringify(outputData, null, 2), 'utf8')
  console.log(`🔄 Đã đồng bộ sang: ${tvplFile}`)

  console.log(`🎉 [Hoàn thành crawl & cập nhật trong ${duration}s]:`)
  console.log(`   - 🏛️ Tỉnh/thành mới: ${allProvincesData.length}`)
  console.log(`   - 📍 Xã/phường mới: ${totalWardsCount}`)
  console.log(`   - 🗺️ Tổng số mappings trích xuất: ${extracted.length}`)
  console.log(`   - 📜 Văn bản pháp lý: ${legalDocs.length}`)
  console.log(`   - 🔐 Checksum SHA-256: ${checksum}`)

  return { ...outputData, hasChanged: true, checksum }
}

// Chạy trực tiếp nếu file được gọi bằng node
if (process.argv[1] && process.argv[1].endsWith('crawl-sapnhap-bando.mjs')) {
  crawlAllAdministrativeData()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Lỗi chạy crawler:', err)
      process.exit(1)
    })
}
