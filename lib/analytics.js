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
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 30))
    const filterIp = query.ip?.trim()
    const filterTool = query.tool?.trim()

    let filteredEvents = this.events
    if (filterIp) {
      filteredEvents = filteredEvents.filter(e => e.ip === filterIp)
    }
    if (filterTool) {
      filteredEvents = filteredEvents.filter(e => e.tool === filterTool)
    }

    const topTools = Array.from(this.toolMap.values())
      .sort((a, b) => b.totalUses - a.totalUses)
      .slice(0, 15)

    const topIps = Array.from(this.ipMap.values())
      .sort((a, b) => (b.toolUses + b.visits) - (a.toolUses + a.visits))
      .slice(0, 20)

    const todayStr = new Date().toISOString().slice(0, 10)
    let todayVisits = 0
    let todayToolUses = 0
    for (const event of this.events) {
      if (event.timestamp?.startsWith(todayStr)) {
        if (event.type === 'visit') todayVisits += 1
        if (event.type === 'tool_use') todayToolUses += 1
      }
    }

    return {
      summary: {
        totalVisits: this.totalVisits,
        uniqueIps: this.ipMap.size,
        totalToolUses: this.totalToolUses,
        todayVisits,
        todayToolUses,
        totalEventsRecorded: this.events.length,
      },
      topTools,
      topIps,
      recentEvents: filteredEvents.slice(0, limit),
      timestamp: new Date().toISOString(),
    }
  }
}

export const analytics = new AnalyticsTracker()
telegramBot.setAnalyticsTracker(analytics)
