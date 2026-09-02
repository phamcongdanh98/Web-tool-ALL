import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { telegramBot } from './telegram.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const getClientIp = req => {
  if (!req) return '127.0.0.1'
  const forwarded = req.headers?.['x-forwarded-for']
  if (forwarded) {
    const first = String(forwarded).split(',')[0].trim()
    if (first) return first.replace(/^::ffff:/, '')
  }
  const realIp = req.headers?.['x-real-ip']
  if (realIp) return String(realIp).trim().replace(/^::ffff:/, '')
  const remote = req.socket?.remoteAddress || req.ip || '127.0.0.1'
  return String(remote).trim().replace(/^::ffff:/, '')
}

export class AnalyticsTracker {
  constructor(options = {}) {
    this.maxEvents = options.maxEvents || 2000
    this.dataDir = options.dataDir || process.env.DATA_DIR || path.join(path.dirname(__dirname), 'data')
    this.logFile = options.logFile || process.env.ANALYTICS_FILE || path.join(this.dataDir, 'analytics.jsonl')
    this.events = []
    this.ipMap = new Map()
    this.toolMap = new Map()
    this.totalVisits = 0
    this.totalToolUses = 0
    this.recentVisitTimes = new Map() // Rate limit visit logging per IP (e.g. 1 visit per 60s)
    this.initialized = false

    this.initPromise = this._loadInitialData().catch(error => {
      console.error('Không thể tải dữ liệu analytics cũ, khởi tạo bộ nhớ trống:', error.message)
    })
  }

  async _loadInitialData() {
    if (!existsSync(this.logFile)) {
      this.initialized = true
      return
    }
    try {
      const content = await readFile(this.logFile, 'utf8')
      const lines = content.split('\n').filter(Boolean)
      // Replay the lines into state
      for (const line of lines) {
        try {
          const event = JSON.parse(line)
          this._applyEventToMemory(event, true)
        } catch {}
      }
      this.initialized = true
    } catch (err) {
      this.initialized = true
      console.warn('Lỗi đọc log analytics ban đầu:', err.message)
    }
  }

  _applyEventToMemory(event, pushToEvents = true) {
    if (pushToEvents) {
      this.events.unshift(event)
      if (this.events.length > this.maxEvents) {
        this.events.pop()
      }
    }

    const { ip, type, tool, timestamp } = event

    // Cập nhật thống kê theo IP
    let ipEntry = this.ipMap.get(ip)
    if (!ipEntry) {
      ipEntry = {
        ip,
        visits: 0,
        toolUses: 0,
        tools: {},
        firstSeen: timestamp,
        lastSeen: timestamp,
      }
      this.ipMap.set(ip, ipEntry)
    }
    ipEntry.lastSeen = timestamp

    if (type === 'visit') {
      this.totalVisits += 1
      ipEntry.visits += 1
    } else if (type === 'tool_use') {
      this.totalToolUses += 1
      ipEntry.toolUses += 1
      const toolName = tool || 'unknown'
      ipEntry.tools[toolName] = (ipEntry.tools[toolName] || 0) + 1

      // Cập nhật thống kê theo Tool
      let toolEntry = this.toolMap.get(toolName)
      if (!toolEntry) {
        toolEntry = {
          tool: toolName,
          totalUses: 0,
          successes: 0,
          errors: 0,
          lastUsed: timestamp,
        }
        this.toolMap.set(toolName, toolEntry)
      }
      toolEntry.totalUses += 1
      toolEntry.lastUsed = timestamp
      if (event.status === 'error') {
        toolEntry.errors += 1
      } else {
        toolEntry.successes += 1
      }
    }
  }

  async _persistEvent(event) {
    try {
      if (!existsSync(this.dataDir)) {
        await mkdir(this.dataDir, { recursive: true })
      }
      await appendFile(this.logFile, JSON.stringify(event) + '\n', 'utf8')
    } catch (error) {
      // Ghi log thất bại không làm dừng ứng dụng
      // Dữ liệu vẫn được giữ trong memory
    }
  }

  async recordVisit(ip, metadata = {}) {
    const now = Date.now()
    const lastVisit = this.recentVisitTimes.get(ip) || 0
    // Cooldown 60s giữa các lần ghi nhận visit của cùng 1 IP
    if (now - lastVisit < 60_000) {
      return null
    }
    this.recentVisitTimes.set(ip, now)

    const event = {
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'visit',
      ip: ip || '127.0.0.1',
      path: metadata.path || '/',
      userAgent: metadata.userAgent || '',
      referer: metadata.referer || '',
      timestamp: new Date(now).toISOString(),
    }

    this._applyEventToMemory(event, true)
    await this._persistEvent(event)
    return event
  }

  async recordToolUsage(ip, tool, metadata = {}) {
    const now = Date.now()
    const event = {
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'tool_use',
      ip: ip || '127.0.0.1',
      tool: tool || 'unknown',
      action: metadata.action || '',
      source: metadata.source || 'api', // 'api' hoặc 'client'
      status: metadata.status || 'success', // 'success' hoặc 'error'
      fileSize: metadata.fileSize || 0,
      details: metadata.details || null,
      durationMs: metadata.durationMs || 0,
      timestamp: new Date(now).toISOString(),
    }

    this._applyEventToMemory(event, true)
    await this._persistEvent(event)
    try {
      telegramBot.notifyToolUsage(event)
    } catch {}
    return event
  }

  getStats(query = {}) {
    const range = query.range || 'all'
    const vnOffsetMs = 7 * 60 * 60 * 1000
    const now = Date.now()
    const nowVn = new Date(now + vnOffsetMs)
    const todayStr = nowVn.toISOString().slice(0, 10)

    // Xác định thời điểm bắt đầu lọc theo chu kỳ
    let cutoffTime = 0
    let daysCount = 7
    if (range === 'today') {
      const todayStart = new Date(nowVn)
      todayStart.setUTCHours(0, 0, 0, 0)
      cutoffTime = todayStart.getTime() - vnOffsetMs
      daysCount = 1
    } else if (range === '7days' || range === 'week') {
      cutoffTime = now - 7 * 24 * 60 * 60 * 1000
      daysCount = 7
    } else if (range === '30days' || range === 'month') {
      cutoffTime = now - 30 * 24 * 60 * 60 * 1000
      daysCount = 30
    }

    // Chuẩn bị các mốc ngày cho dailyTrend
    const dailyMap = new Map()
    const numDaysToGen = range === 'today' ? 1 : (range === '30days' ? 30 : 7)
    for (let i = numDaysToGen - 1; i >= 0; i--) {
      const dayDate = new Date(now + vnOffsetMs - i * 24 * 60 * 60 * 1000)
      const dateKey = dayDate.toISOString().slice(0, 10)
      const dayLabel = i === 0 ? 'Hôm nay' : (i === 1 ? 'Hôm qua' : `${dayDate.getUTCDate()}/${dayDate.getUTCMonth() + 1}`)
      dailyMap.set(dateKey, {
        dateKey,
        label: dayLabel,
        visits: 0,
        toolUses: 0,
        total: 0,
      })
    }

    const rangeIps = new Map()
    const rangeTools = new Map()
    let rangeVisits = 0
    let rangeToolUses = 0
    let todayVisits = 0
    let todayToolUses = 0

    let filteredEvents = []

    for (const event of this.events) {
      if (!event.timestamp) continue
      const eventTime = new Date(event.timestamp).getTime()
      const eventVn = new Date(eventTime + vnOffsetMs)
      const eventDateStr = eventVn.toISOString().slice(0, 10)

      // Đếm riêng hôm nay
      if (eventDateStr === todayStr) {
        if (event.type === 'visit') todayVisits += 1
        if (event.type === 'tool_use') todayToolUses += 1
      }

      // Kiểm tra chu kỳ
      if (cutoffTime > 0 && eventTime < cutoffTime) continue

      // Lọc theo IP hoặc Tool nếu có query
      if (filterIp && event.ip !== filterIp) continue
      if (filterTool && event.tool !== filterTool) continue

      filteredEvents.push(event)

      // Cập nhật dailyTrend
      const bucket = dailyMap.get(eventDateStr)
      if (bucket) {
        if (event.type === 'visit') bucket.visits += 1
        if (event.type === 'tool_use') bucket.toolUses += 1
        bucket.total = bucket.visits + bucket.toolUses
      }

      // Cập nhật thống kê trong chu kỳ
      const ip = event.ip || '127.0.0.1'
      let ipEntry = rangeIps.get(ip)
      if (!ipEntry) {
        ipEntry = { ip, visits: 0, toolUses: 0, lastSeen: event.timestamp }
        rangeIps.set(ip, ipEntry)
      }
      if (event.type === 'visit') {
        rangeVisits += 1
        ipEntry.visits += 1
      } else if (event.type === 'tool_use') {
        rangeToolUses += 1
        ipEntry.toolUses += 1

        const toolName = event.tool || 'unknown'
        let tEntry = rangeTools.get(toolName)
        if (!tEntry) {
          tEntry = { tool: toolName, totalUses: 0, successes: 0, errors: 0, lastUsed: event.timestamp }
          rangeTools.set(toolName, tEntry)
        }
        tEntry.totalUses += 1
        if (event.status === 'error') tEntry.errors += 1
        else tEntry.successes += 1
      }

      if (new Date(event.timestamp) > new Date(ipEntry.lastSeen)) {
        ipEntry.lastSeen = event.timestamp
      }
    }

    const topTools = Array.from(rangeTools.values())
      .sort((a, b) => b.totalUses - a.totalUses)
      .slice(0, 15)

    const topIps = Array.from(rangeIps.values())
      .sort((a, b) => (b.toolUses + b.visits) - (a.toolUses + a.visits))
      .slice(0, 20)

    const dailyTrend = Array.from(dailyMap.values())

    return {
      range,
      summary: {
        totalVisits: cutoffTime > 0 ? rangeVisits : this.totalVisits,
        uniqueIps: cutoffTime > 0 ? rangeIps.size : this.ipMap.size,
        totalToolUses: cutoffTime > 0 ? rangeToolUses : this.totalToolUses,
        todayVisits,
        todayToolUses,
        totalEventsRecorded: filteredEvents.length,
      },
      dailyTrend,
      topTools: topTools.length > 0 ? topTools : (cutoffTime === 0 ? Array.from(this.toolMap.values()).slice(0, 15) : []),
      topIps: topIps.length > 0 ? topIps : (cutoffTime === 0 ? Array.from(this.ipMap.values()).slice(0, 20) : []),
      recentEvents: filteredEvents.slice(0, limit),
      timestamp: new Date().toISOString(),
    }
  }

  getTodayDetailedStats() {
    const vnOffsetMs = 7 * 60 * 60 * 1000
    const nowVn = new Date(Date.now() + vnOffsetMs)
    const todayDateStr = nowVn.toISOString().slice(0, 10)

    let todayVisits = 0
    let todayToolUses = 0
    const ipStatsMap = new Map()
    const toolStatsMap = new Map()

    for (const event of this.events) {
      if (!event.timestamp) continue
      const eventVn = new Date(new Date(event.timestamp).getTime() + vnOffsetMs)
      const eventDateStr = eventVn.toISOString().slice(0, 10)
      if (eventDateStr !== todayDateStr) continue

      const ip = event.ip || '127.0.0.1'
      let ipData = ipStatsMap.get(ip)
      if (!ipData) {
        ipData = { ip, visits: 0, toolUses: 0, tools: new Map(), lastActive: event.timestamp }
        ipStatsMap.set(ip, ipData)
      }

      if (event.type === 'visit') {
        todayVisits += 1
        ipData.visits += 1
      } else if (event.type === 'tool_use') {
        todayToolUses += 1
        ipData.toolUses += 1
        const tName = event.tool || 'unknown'
        ipData.tools.set(tName, (ipData.tools.get(tName) || 0) + 1)
        toolStatsMap.set(tName, (toolStatsMap.get(tName) || 0) + 1)
      }

      if (new Date(event.timestamp) > new Date(ipData.lastActive)) {
        ipData.lastActive = event.timestamp
      }
    }

    const topIpsToday = Array.from(ipStatsMap.values())
      .map(d => ({
        ...d,
        totalActions: d.visits + d.toolUses,
        toolsList: Array.from(d.tools.entries()).map(([tool, count]) => ({ tool, count })),
      }))
      .sort((a, b) => b.totalActions - a.totalActions)

    const topToolsToday = Array.from(toolStatsMap.entries())
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count)

    return {
      dateStr: todayDateStr,
      todayVisits,
      todayToolUses,
      uniqueIpsToday: ipStatsMap.size,
      topIpsToday,
      topToolsToday,
    }
  }
}

export const analytics = new AnalyticsTracker()
telegramBot.setAnalyticsTracker(analytics)
