#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.dirname(__dirname)
const logFile = process.env.ANALYTICS_FILE || path.join(rootDir, 'data', 'analytics.jsonl')
const apiUrl = process.env.API_URL || 'http://127.0.0.1:3001/api/stats'

const isColor = Boolean(process.stdout.isTTY && !process.env.NO_COLOR)
const c = code => str => isColor ? `\x1b[${code}m${str}\x1b[0m` : String(str)
const bold = c('1')
const cyan = c('36')
const green = c('32')
const yellow = c('33')
const red = c('31')
const magenta = c('35')
const dim = c('2')
const blue = c('34')

// Parse CLI arguments
const args = process.argv.slice(2)
let filterIp = ''
let filterTool = ''
let limit = 20
let jsonOutput = false

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--ip' && args[i + 1]) {
    filterIp = args[++i].trim()
  } else if (args[i] === '--tool' && args[i + 1]) {
    filterTool = args[++i].trim()
  } else if (args[i] === '--limit' && args[i + 1]) {
    limit = parseInt(args[++i], 10) || 20
  } else if (args[i] === '--json') {
    jsonOutput = true
  }
}

async function fetchStatsFromApi() {
  try {
    const params = new URLSearchParams()
    if (filterIp) params.set('ip', filterIp)
    if (filterTool) params.set('tool', filterTool)
    params.set('limit', String(limit))
    const res = await fetch(`${apiUrl}?${params.toString()}`, { signal: AbortSignal.timeout(2000) })
    if (res.ok) return await res.json()
  } catch {}
  return null
}

async function parseStatsFromLogFile() {
  if (!existsSync(logFile)) return null
  try {
    const raw = await readFile(logFile, 'utf8')
    const lines = raw.split('\n').filter(Boolean)
    const events = []
    const ipMap = new Map()
    const toolMap = new Map()
    let totalVisits = 0
    let totalToolUses = 0
    const todayStr = new Date().toISOString().slice(0, 10)
    let todayVisits = 0
    let todayToolUses = 0

    for (const line of lines) {
      try {
        const ev = JSON.parse(line)
        events.unshift(ev)
        const { ip, type, tool, timestamp, status } = ev

        let ipEntry = ipMap.get(ip)
        if (!ipEntry) {
          ipEntry = { ip, visits: 0, toolUses: 0, tools: {}, lastSeen: timestamp }
          ipMap.set(ip, ipEntry)
        }
        ipEntry.lastSeen = timestamp

        if (type === 'visit') {
          totalVisits += 1
          ipEntry.visits += 1
          if (timestamp?.startsWith(todayStr)) todayVisits += 1
        } else if (type === 'tool_use') {
          totalToolUses += 1
          ipEntry.toolUses += 1
          if (timestamp?.startsWith(todayStr)) todayToolUses += 1
          const tName = tool || 'unknown'
          ipEntry.tools[tName] = (ipEntry.tools[tName] || 0) + 1

          let tEntry = toolMap.get(tName)
          if (!tEntry) {
            tEntry = { tool: tName, totalUses: 0, successes: 0, errors: 0, lastUsed: timestamp }
            toolMap.set(tName, tEntry)
          }
          tEntry.totalUses += 1
          tEntry.lastUsed = timestamp
          if (status === 'error') tEntry.errors += 1
          else tEntry.successes += 1
        }
      } catch {}
    }

    let filtered = events
    if (filterIp) filtered = filtered.filter(e => e.ip === filterIp)
    if (filterTool) filtered = filtered.filter(e => e.tool === filterTool)

    return {
      summary: {
        totalVisits,
        uniqueIps: ipMap.size,
        totalToolUses,
        todayVisits,
        todayToolUses,
        totalEventsRecorded: events.length,
      },
      topTools: Array.from(toolMap.values()).sort((a, b) => b.totalUses - a.totalUses).slice(0, 15),
      topIps: Array.from(ipMap.values()).sort((a, b) => (b.toolUses + b.visits) - (a.toolUses + a.visits)).slice(0, 20),
      recentEvents: filtered.slice(0, limit),
      timestamp: new Date().toISOString(),
      source: 'file',
    }
  } catch (err) {
    console.error('Lỗi đọc file log:', err.message)
    return null
  }
}

async function main() {
  let stats = await fetchStatsFromApi()
  if (!stats) {
    stats = await parseStatsFromLogFile()
  }

  if (!stats) {
    console.log(yellow('⚠️  Chưa có dữ liệu thống kê hoặc server chưa chạy. Hãy khởi động server hoặc truy cập website trước.'))
    process.exit(0)
  }

  if (jsonOutput) {
    console.log(JSON.stringify(stats, null, 2))
    return
  }

  console.log(`\n${bold(cyan('📊 PDFTOOLS — THỐNG KÊ LƯỢT TRUY CẬP VÀ SỬ DỤNG CÔNG CỤ'))}`)
  console.log(dim('═'.repeat(74)))

  // 1. TỔNG QUAN
  const s = stats.summary || {}
  console.log(`\n${bold('📈 TỔNG QUAN:')}`)
  console.log(`  • Tổng lượt truy cập (Visits):    ${bold(green(s.totalVisits || 0))}  ${dim(`(Hôm nay: ${s.todayVisits || 0})`)}`)
  console.log(`  • Địa chỉ IP duy nhất (Unique):    ${bold(cyan(s.uniqueIps || 0))}`)
  console.log(`  • Tổng lượt dùng công cụ:          ${bold(yellow(s.totalToolUses || 0))}  ${dim(`(Hôm nay: ${s.todayToolUses || 0})`)}`)
  console.log(`  • Tổng sự kiện đã lưu trữ:        ${bold(s.totalEventsRecorded || 0)}`)

  // 2. TOP CÔNG CỤ
  if (stats.topTools?.length) {
    console.log(`\n${bold('🏆 TOP CÔNG CỤ ĐƯỢC SỬ DỤNG NHIỀU NHẤT:')}`)
    console.log(dim('  ┌─────────────────────────┬──────────────┬──────────────┬──────────────┐'))
    console.log(dim('  │ ') + bold('Công cụ'.padEnd(23)) + dim(' │ ') + bold('Lượt dùng'.padEnd(12)) + dim(' │ ') + bold('Thành công'.padEnd(12)) + dim(' │ ') + bold('Lỗi'.padEnd(12)) + dim(' │'))
    console.log(dim('  ├─────────────────────────┼──────────────┼──────────────┼──────────────┤'))
    for (const item of stats.topTools.slice(0, 10)) {
      const toolCol = item.tool.slice(0, 23).padEnd(23)
      const usesCol = String(item.totalUses).padEnd(12)
      const succCol = green(String(item.successes).padEnd(12))
      const errCol = item.errors > 0 ? red(String(item.errors).padEnd(12)) : dim('0'.padEnd(12))
      console.log(`  ${dim('│')} ${cyan(toolCol)} ${dim('│')} ${bold(usesCol)} ${dim('│')} ${succCol} ${dim('│')} ${errCol} ${dim('│')}`)
    }
    console.log(dim('  └─────────────────────────┴──────────────┴──────────────┴──────────────┘'))
  }

  // 3. TOP IP
  if (stats.topIps?.length) {
    console.log(`\n${bold('🌐 TOP ĐỊA CHỈ IP HOẠT ĐỘNG:')}`)
    console.log(dim('  ┌─────────────────────────┬──────────────┬──────────────┬─────────────────────┐'))
    console.log(dim('  │ ') + bold('Địa chỉ IP'.padEnd(23)) + dim(' │ ') + bold('Truy cập'.padEnd(12)) + dim(' │ ') + bold('Dùng Tool'.padEnd(12)) + dim(' │ ') + bold('Lần cuối'.padEnd(19)) + dim(' │'))
    console.log(dim('  ├─────────────────────────┼──────────────┼──────────────┼─────────────────────┤'))
    for (const item of stats.topIps.slice(0, 8)) {
      const ipCol = item.ip.slice(0, 23).padEnd(23)
      const visCol = String(item.visits).padEnd(12)
      const useCol = String(item.toolUses).padEnd(12)
      const timeStr = item.lastSeen ? new Date(item.lastSeen).toLocaleString('vi-VN') : '—'
      const timeCol = timeStr.slice(0, 19).padEnd(19)
      console.log(`  ${dim('│')} ${magenta(ipCol)} ${dim('│')} ${visCol} ${dim('│')} ${bold(useCol)} ${dim('│')} ${dim(timeCol)} ${dim('│')}`)
    }
    console.log(dim('  └─────────────────────────┴──────────────┴──────────────┴─────────────────────┘'))
  }

  // 4. NHẬT KÝ HOẠT ĐỘNG GẦN NHẤT
  if (stats.recentEvents?.length) {
    const filterNotice = filterIp ? ` (Lọc IP: ${filterIp})` : filterTool ? ` (Lọc Tool: ${filterTool})` : ''
    console.log(`\n${bold(`⏱️  NHẬT KÝ HOẠT ĐỘNG GẦN NHẤT${filterNotice}:`)}`)
    console.log(dim('  ┌────────────────────┬─────────────────┬──────────────────────┬─────────┬──────────┐'))
    console.log(dim('  │ ') + bold('Thời gian'.padEnd(18)) + dim(' │ ') + bold('Địa chỉ IP'.padEnd(15)) + dim(' │ ') + bold('Hoạt động / Công cụ'.padEnd(20)) + dim(' │ ') + bold('Nguồn'.padEnd(7)) + dim(' │ ') + bold('Kết quả'.padEnd(8)) + dim(' │'))
    console.log(dim('  ├────────────────────┼─────────────────┼──────────────────────┼─────────┼──────────┤'))
    for (const ev of stats.recentEvents) {
      const timeStr = new Date(ev.timestamp).toLocaleTimeString('vi-VN') + ' ' + new Date(ev.timestamp).toLocaleDateString('vi-VN', { month: '2-digit', day: '2-digit' })
      const timeCol = timeStr.slice(0, 18).padEnd(18)
      const ipCol = ev.ip.slice(0, 15).padEnd(15)
      const name = ev.type === 'visit' ? '👁️ Truy cập web' : `🔧 ${ev.tool}`
      const nameCol = name.slice(0, 20).padEnd(20)
      const srcCol = (ev.source || (ev.type === 'visit' ? 'web' : 'api')).slice(0, 7).padEnd(7)
      const statusText = ev.status === 'error' ? red('Thất bại') : green('Thành công')
      const statusCol = ev.status === 'error' ? red('Lỗi'.padEnd(8)) : green('OK'.padEnd(8))
      console.log(`  ${dim('│')} ${dim(timeCol)} ${dim('│')} ${blue(ipCol)} ${dim('│')} ${yellow(nameCol)} ${dim('│')} ${srcCol} ${dim('│')} ${statusCol} ${dim('│')}`)
    }
    console.log(dim('  └────────────────────┴─────────────────┴──────────────────────┴─────────┴──────────┘'))
  }

  console.log(`\n${dim(`💡 Tùy chọn: npm run stats -- --ip <IP> | --tool <tên_tool> | --limit <số_lượng> | --json`)}\n`)
}

main()
