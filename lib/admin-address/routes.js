import express from 'express'
import multer from 'multer'
import { getDatabase } from './db.js'
import { seedDatabase } from './seed-data.js'
import {
  convertOldToNew,
  lookupNewToLegacies,
  processBulkExcel,
  getAdminMetadata,
  getDistrictsByProvince,
  getWardsByDistrict,
  getNewWardsByProvince,
} from './converter.js'
import { getCandidateChanges, approveCandidateChange, rejectCandidateChange, getDatabaseStats } from './watcher.js'

const router = express.Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
})

// Đảm bảo database đã khởi tạo và seed
try {
  const db = getDatabase()
  seedDatabase(db)
} catch (e) {
  console.warn('Lỗi khởi tạo DB địa giới hành chính:', e.message)
}

// 0.1 Metadata danh mục tỉnh/thành phục vụ giao diện
router.get('/meta', (_req, res) => {
  try {
    const meta = getAdminMetadata()
    res.json(meta)
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message || 'Lỗi lấy metadata địa giới.' })
  }
})

// 0.2 Lấy danh sách quận/huyện theo tỉnh cũ
router.get('/districts', (req, res) => {
  try {
    const province = req.query.province || ''
    const list = getDistrictsByProvince(province)
    res.json({ districts: list })
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message || 'Lỗi lấy danh sách huyện.' })
  }
})

// 0.3 Lấy danh sách xã/phường theo huyện và tỉnh cũ
router.get('/wards', (req, res) => {
  try {
    const province = req.query.province || ''
    const district = req.query.district || ''
    const list = getWardsByDistrict(province, district)
    res.json({ wards: list })
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message || 'Lỗi lấy danh sách xã.' })
  }
})

// 0.4 Lấy danh sách xã/phường mới theo tỉnh mới
router.get('/new-wards', (req, res) => {
  try {
    const province = req.query.province || ''
    const list = getNewWardsByProvince(province)
    res.json({ wards: list })
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message || 'Lỗi lấy danh sách xã mới.' })
  }
})

// 1. Tra cứu Cũ -> Mới (Đơn lẻ hoặc chuỗi địa chỉ)
router.post('/convert', express.json(), (req, res) => {
  try {
    const result = convertOldToNew(req.body || {})
    res.json(result)
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message || 'Lỗi xử lý tra cứu địa chỉ.' })
  }
})

// 2. Tra cứu Mới -> Cũ (Legacies)
router.get('/legacies', (req, res) => {
  try {
    const { province, ward } = req.query || {}
    const result = lookupNewToLegacies(province, ward)
    res.json(result)
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message || 'Lỗi tra cứu đơn vị cấu thành.' })
  }
})

// 3. Chuyển đổi Excel hàng loạt
router.post('/bulk-convert', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng chọn tệp Excel (.xlsx, .csv) để chuyển đổi.' })
    }

    const options = {
      mode: req.body?.mode || 'auto',
      provinceCol: req.body?.provinceCol,
      districtCol: req.body?.districtCol,
      wardCol: req.body?.wardCol,
      addressCol: req.body?.addressCol,
    }

    const result = await processBulkExcel(req.file.buffer, options)

    // Nếu yêu cầu tải trực tiếp file kết quả
    if (req.query.download === 'true') {
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="chuyen-doi-dia-chi-hanh-chinh.xlsx"',
        'Content-Length': result.buffer.length,
      })
      return res.send(result.buffer)
    }

    // Mặc định trả về dữ liệu preview và thống kê
    res.json({
      success: true,
      stats: result.stats,
      preview: result.preview,
      totalProcessed: result.stats.total,
    })
  } catch (error) {
    res.status(500).json({ message: error.message || 'Không thể xử lý tệp Excel.' })
  }
})

// 4. Thống kê cơ sở dữ liệu và phiên bản
router.get('/stats', (_req, res) => {
  try {
    const stats = getDatabaseStats()
    res.json(stats)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// 5. Danh sách candidate changes (Staging)
router.get('/candidates', (req, res) => {
  try {
    const list = getCandidateChanges(req.query?.status || null)
    res.json({ candidates: list })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// 6. Phê duyệt / Từ chối candidate change
router.post('/candidates/review', express.json(), (req, res) => {
  try {
    const { id, action, note } = req.body || {}
    if (!id || !action) {
      return res.status(400).json({ message: 'Thiếu ID hoặc hành động (approve/reject).' })
    }
    if (action === 'approve') {
      const result = approveCandidateChange(id, note)
      return res.json(result)
    }
    if (action === 'reject') {
      const result = rejectCandidateChange(id, note)
      return res.json(result)
    }
    res.status(400).json({ message: 'Hành động không hợp lệ.' })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

// 7. Lấy trạng thái đồng bộ TVPL tự động
router.get('/sync-status', async (_req, res) => {
  try {
    const { adminAddressSyncService } = await import('./sync-service.js')
    const status = adminAddressSyncService.getStatus()
    res.json(status)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// 8. Kích hoạt quét đồng bộ TVPL ngay lập tức
router.post('/sync-trigger', async (_req, res) => {
  try {
    const { adminAddressSyncService } = await import('./sync-service.js')
    const result = await adminAddressSyncService.triggerSync({ source: 'MANUAL_TRIGGER_API' })
    res.json(result)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

export default router
