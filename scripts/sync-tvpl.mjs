#!/usr/bin/env node
/**
 * CLI Script: Đồng bộ CSDL Địa giới Hành chính với Thư Viện Pháp Luật
 * Chạy thủ công: node scripts/sync-tvpl.mjs
 * Hoặc đặt crontab: 0 3 * * * cd /path/to/app && node scripts/sync-tvpl.mjs
 */

import { adminAddressSyncService } from '../lib/admin-address/sync-service.js'
import { closeDatabase } from '../lib/admin-address/db.js'

console.log('🔄 Bắt đầu chạy quét đồng bộ TVPL từ CLI...')
const startTime = Date.now()

try {
  const result = await adminAddressSyncService.triggerSync({ source: 'CLI_SCRIPT' })
  console.log('✅ Hoàn tất phiên đồng bộ TVPL:')
  console.log(`   - Trạng thái: ${result.status}`)
  console.log(`   - Thông điệp: ${result.message}`)
  console.log(`   - Thời gian xử lý: ${result.durationMs} ms`)
  console.log(`   - Tổng đơn vị mới phát hiện: ${result.newUnitsDetected}`)
} catch (error) {
  console.error('❌ Lỗi khi đồng bộ TVPL:', error)
  process.exitCode = 1
} finally {
  closeDatabase()
  process.exit(process.exitCode || 0)
}
