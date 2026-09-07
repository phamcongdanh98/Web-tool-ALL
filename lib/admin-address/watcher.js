/**
 * Update Watcher & Staging Pipeline
 * Nguyên tắc:
 * - Không crawler/watcher nào được ghi đè trực tiếp vào production database
 * - Mọi cập nhật được lưu vào candidate_changes để review/validate
 * - Các thay đổi có dấu hiệu 'chia', 'tách', 'một phần' bắt buộc gắn nhãn NEEDS_REVIEW
 */

import { getDatabase } from './db.js'

export const getCandidateChanges = (status = null) => {
  const db = getDatabase()
  if (status) {
    return db.prepare('SELECT * FROM candidate_changes WHERE validation_status = ? ORDER BY id DESC').all(status)
  }
  return db.prepare('SELECT * FROM candidate_changes ORDER BY id DESC').all()
}

export const recordCandidateChange = (change = {}) => {
  const db = getDatabase()
  const { source, source_document, change_type, old_value, new_value, review_note } = change

  // Kiểm tra nếu có dấu hiệu PARTIAL thì gán nhãn NEEDS_REVIEW
  const combinedText = `${old_value || ''} ${new_value || ''} ${review_note || ''}`.toLowerCase()
  let status = 'PENDING'
  if (/một phần|chia thành|phần còn lại|điều chỉnh địa giới/i.test(combinedText)) {
    status = 'NEEDS_REVIEW'
  }

  const result = db.prepare(`
    INSERT INTO candidate_changes 
    (source, source_document, change_type, old_value, new_value, validation_status, review_note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    source || 'Official Feed',
    source_document || 'Công báo / Chính phủ',
    change_type || 'UPDATE',
    typeof old_value === 'object' ? JSON.stringify(old_value) : String(old_value || ''),
    typeof new_value === 'object' ? JSON.stringify(new_value) : String(new_value || ''),
    status,
    review_note || (status === 'NEEDS_REVIEW' ? 'Chứa dấu hiệu chia tách địa giới, cần thẩm định thủ công trước khi xuất bản.' : '')
  )

  return { id: result.lastInsertRowid, status }
}

export const approveCandidateChange = (id, approverNote = '') => {
  const db = getDatabase()
  const candidate = db.prepare('SELECT * FROM candidate_changes WHERE id = ?').get(id)
  if (!candidate) {
    throw new Error(`Không tìm thấy thay đổi mã #${id}`)
  }

  db.prepare(`
    UPDATE candidate_changes 
    SET validation_status = 'APPROVED', review_note = review_note || ' · ' || ?
    WHERE id = ?
  `).run(`Đã duyệt: ${approverNote || 'Đạt yêu cầu đối chiếu nguồn pháp lý'}`, id)

  return { success: true, id, status: 'APPROVED' }
}

export const rejectCandidateChange = (id, reason = '') => {
  const db = getDatabase()
  db.prepare(`
    UPDATE candidate_changes 
    SET validation_status = 'REJECTED', review_note = ?
    WHERE id = ?
  `).run(`Từ chối: ${reason || 'Không khớp nguồn chính thức'}`, id)

  return { success: true, id, status: 'REJECTED' }
}

export const getDatabaseStats = () => {
  const db = getDatabase()
  const totalUnits = db.prepare('SELECT count(*) as count FROM administrative_units').get()?.count || 0
  const totalMappings = db.prepare('SELECT count(*) as count FROM administrative_mappings').get()?.count || 0
  const fullMappings = db.prepare("SELECT count(*) as count FROM administrative_mappings WHERE mapping_type = 'FULL'").get()?.count || 0
  const partialMappings = db.prepare("SELECT count(*) as count FROM administrative_mappings WHERE mapping_type = 'PARTIAL'").get()?.count || 0
  const pendingCandidates = db.prepare("SELECT count(*) as count FROM candidate_changes WHERE validation_status = 'PENDING'").get()?.count || 0
  const needsReviewCandidates = db.prepare("SELECT count(*) as count FROM candidate_changes WHERE validation_status = 'NEEDS_REVIEW'").get()?.count || 0
  const latestVersion = db.prepare('SELECT * FROM data_versions ORDER BY id DESC LIMIT 1').get() || { version: 'v2025.07.01' }
  const legalDocs = db.prepare('SELECT count(*) as count FROM legal_documents').get()?.count || 0

  return {
    totalUnits,
    totalMappings,
    fullMappings,
    partialMappings,
    pendingCandidates,
    needsReviewCandidates,
    latestVersion,
    legalDocsCount: legalDocs,
  }
}
