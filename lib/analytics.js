import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { telegramBot } from './telegram.js'
import { lookupGeoIp, isPrivateIp } from './geoip.js'

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

export const detectDevice = (ua = '') => {
  if (!ua) return 'desktop'
  const lower = String(ua).toLowerCase()
  if (/mobile|iphone|ipod|android.*mobile|windows phone/i.test(lower)) return 'mobile'
  if (/ipad|tablet|android(?!.*mobile)/i.test(lower)) return 'tablet'
  return 'desktop'
}

export class AnalyticsTracker {
  constructor(options = {}) {
    this.maxEvents = options.maxEvents || 2000
    this.dataDir = options.dataDir || process.env.DATA_DIR || path.join(path.dirname(__dirname), 'data')
    this.logFile = options.logFile || process.env.ANALYTICS_FILE || path.join(this.dataDir, 'analytics.jsonl')
    this.blockedIpsFile = path.join(this.dataDir, 'blocked-ips.json')

    this.events = []
    this.ipMap = new Map()
    this.toolMap = new Map()
    this.blockedIps = new Map() // ip -> { ip, reason, geoLabel, blockedAt }
    this.ipRateTracker = new Map() // ip -> [timestamps]
    this.spamAlertTimes = new Map() // ip -> lastAlertTime

    this.totalVisits = 0
    this.totalToolUses = 0
    this.recentVisitTimes = new Map() // Rate limit visit logging per IP (60s cooldown)
    this.initialized = false

    this.initPromise = this._loadInitialData().catch(error => {
      console.error('Không thể tải dữ liệu analytics cũ, khởi tạo bộ nhớ trống:', error.message)
    })
  }

  async _loadInitialData() {
    await this._loadBlockedIps()

    if (!existsSync(this.logFile)) {
      this.initialized = true
      return
    }
    try {
      const content = await readFile(this.logFile, 'utf8')
      const lines = content.split('\n').filter(Boolean)
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

  async _loadBlockedIps() {
    if (!existsSync(this.blockedIpsFile)) return
    try {
      const data = await readFile(this.blockedIpsFile, 'utf8')
      const list = JSON.parse(data)
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item?.ip) {
            this.blockedIps.set(item.ip, item)
          }
        }
      }
    } catch (err) {
      console.warn('Không thể đọc danh sách IP bị chặn:', err.message)
    }
  }

  async _saveBlockedIps() {
    try {
      if (!existsSync(this.dataDir)) {
        await mkdir(this.dataDir, { recursive: true })
      }
      const list = Array.from(this.blockedIps.values())
      await writeFile(this.blockedIpsFile, JSON.stringify(list, null, 2), 'utf8')
    } catch (err) {
      console.warn('Lỗi ghi danh sách IP bị chặn:', err.message)
    }
  }

  async blockIp(ip, reason = 'Chặn bởi Quản trị viên') {
    if (!ip) throw new Error('Vui lòng cung cấp địa chỉ IP cần chặn.')
    const cleanIp = String(ip).replace(/^::ffff:/, '').trim().toLowerCase()
    if (!cleanIp || cleanIp === 'unknown') throw new Error('Địa chỉ IP không hợp lệ.')
    if (isPrivateIp(cleanIp)) {
      throw new Error(`Không thể chặn IP nội bộ (${cleanIp}) để đảm bảo an toàn truy cập máy chủ.`)
    }

    const geo = await lookupGeoIp(cleanIp)
    const blockItem = {
      ip: cleanIp,
      reason: String(reason || 'Chặn bởi Quản trị viên').trim().slice(0, 120),
      geoLabel: geo.label,
      blockedAt: new Date().toISOString(),
    }
    this.blockedIps.set(cleanIp, blockItem)
    await this._saveBlockedIps()

    // Cập nhật trạng thái trong ipMap
    const ipEntry = this.ipMap.get(cleanIp)
    if (ipEntry) ipEntry.isBlocked = true

    return blockItem
  }

  async unblockIp(ip) {
    if (!ip) return false
    const cleanIp = String(ip).replace(/^::ffff:/, '').trim().toLowerCase()
    const existed = this.blockedIps.delete(cleanIp)
    if (existed) {
      await this._saveBlockedIps()
      const ipEntry = this.ipMap.get(cleanIp)
      if (ipEntry) ipEntry.isBlocked = false
    }
    return existed
  }

  isIpBlocked(ip) {
    if (!ip) return false
    const cleanIp = String(ip).replace(/^::ffff:/, '').trim().toLowerCase()
    return this.blockedIps.has(cleanIp)
  }

  getBlockedIps() {
    return Array.from(this.blockedIps.values()).sort((a, b) => new Date(b.blockedAt || 0) - new Date(a.blockedAt || 0))
  }

  _applyEventToMemory(event, pushToEvents = true) {
    if (pushToEvents) {
      this.events.unshift(event)
      if (this.events.length > this.maxEvents) {
        this.events.pop()
      }
    }

    const { ip, type, tool, timestamp, geo } = event

    // Cập nhật thống kê theo IP
    let ipEntry = this.ipMap.get(ip)
    if (!ipEntry) {
      ipEntry = {
        ip,
        geo: geo || { flag: '🌐', city: '', countryCode: '', label: '🌐' },
        visits: 0,
        toolUses: 0,
        tools: {},
        isBlocked: this.isIpBlocked(ip),
        firstSeen: timestamp,
        lastSeen: timestamp,
        userAgent: event.userAgent || '',
      }
      this.ipMap.set(ip, ipEntry)
    }
    if (geo && (!ipEntry.geo || ipEntry.geo.flag === '🌐')) {
      ipEntry.geo = geo
    }
    if (event.userAgent && !ipEntry.userAgent) {
      ipEntry.userAgent = event.userAgent
    }
    ipEntry.lastSeen = timestamp
    ipEntry.isBlocked = this.isIpBlocked(ip)

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
    } catch {}
  }

  async recordVisit(ip, metadata = {}) {
    const cleanIp = ip ? ip.replace(/^::ffff:/, '').trim() : '127.0.0.1'
    const now = Date.now()
    const lastVisit = this.recentVisitTimes.get(cleanIp) || 0
    // Cooldown 60s giữa các lần ghi nhận visit của cùng 1 IP
    if (now - lastVisit < 60_000) {
      return null
    }
    this.recentVisitTimes.set(cleanIp, now)

    const geo = await lookupGeoIp(cleanIp)

    const event = {
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'visit',
      ip: cleanIp,
      geo: {
        flag: geo.flag,
        city: geo.city,
        countryCode: geo.countryCode,
        label: geo.label,
      },
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
    const cleanIp = ip ? ip.replace(/^::ffff:/, '').trim() : '127.0.0.1'
    const now = Date.now()
    const geo = await lookupGeoIp(cleanIp)

    const event = {
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'tool_use',
      ip: cleanIp,
      geo: {
        flag: geo.flag,
        city: geo.city,
        countryCode: geo.countryCode,
        label: geo.label,
      },
      tool: tool || 'unknown',
      action: metadata.action || '',
      source: metadata.source || 'api',
      status: metadata.status || 'success',
      fileSize: metadata.fileSize || 0,
      details: metadata.details || null,
      durationMs: metadata.durationMs || 0,
      userAgent: metadata.userAgent || '',
      timestamp: new Date(now).toISOString(),
    }

    this._applyEventToMemory(event, true)
    await this._persistEvent(event)

    // Phát hiện và gửi cảnh báo Spam (> 15 reqs / 60 giây)
    this._checkSpam(cleanIp, geo, tool)

    try {
      telegramBot.notifyToolUsage({ ...event, geoLabel: geo.label })
    } catch {}
    return event
  }

  _checkSpam(ip, geo, tool) {
    if (isPrivateIp(ip)) return
    const now = Date.now()
    let timestamps = this.ipRateTracker.get(ip) || []
    timestamps = timestamps.filter(t => now - t < 60_000)
    timestamps.push(now)
    this.ipRateTracker.set(ip, timestamps)

    // Nếu gọi >= 15 lần trong 60 giây
    if (timestamps.length >= 15) {
      const lastAlert = this.spamAlertTimes.get(ip) || 0
      // Cooldown cảnh báo 5 phút
      if (now - lastAlert > 5 * 60 * 1000) {
        this.spamAlertTimes.set(ip, now)
        try {
          telegramBot.notifySpamAlert({
            ip,
            count: timestamps.length,
            geoLabel: geo.label,
            tool,
          })
        } catch {}
      }
    }
  }

  getStats(query = {}) {
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 30))
    const filterIp = query.ip?.trim()
    const filterTool = query.tool?.trim()
    const range = query.range || 'all'
    const vnOffsetMs = 7 * 60 * 60 * 1000
    const now = Date.now()
    const nowVn = new Date(now + vnOffsetMs)
    const todayStr = nowVn.toISOString().slice(0, 10)

    let cutoffTime = 0
    if (range === 'today') {
      const todayStart = new Date(nowVn)
      todayStart.setUTCHours(0, 0, 0, 0)
      cutoffTime = todayStart.getTime() - vnOffsetMs
    } else if (range === '7days' || range === 'week') {
      cutoffTime = now - 7 * 24 * 60 * 60 * 1000
    } else if (range === '30days' || range === 'month') {
      cutoffTime = now - 30 * 24 * 60 * 60 * 1000
    }

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

    let totalBytesProcessed = 0
    let totalDurationMs = 0
    let toolUsesWithDuration = 0
    let successCount = 0
    let errorCount = 0
    const deviceBreakdown = { desktop: 0, mobile: 0, tablet: 0 }
    const recentlyActiveIps = new Set()
    const fifteenMinutesAgo = now - 15 * 60 * 1000

    let filteredEvents = []

    for (const event of this.events) {
      if (!event.timestamp) continue
      const eventTime = new Date(event.timestamp).getTime()
      const eventVn = new Date(eventTime + vnOffsetMs)
      const eventDateStr = eventVn.toISOString().slice(0, 10)

      if (eventDateStr === todayStr) {
        if (event.type === 'visit') todayVisits += 1
        if (event.type === 'tool_use') todayToolUses += 1
      }

      if (eventTime >= fifteenMinutesAgo && event.ip) {
        recentlyActiveIps.add(event.ip)
      }

      if (cutoffTime > 0 && eventTime < cutoffTime) continue

      if (filterIp && event.ip !== filterIp) continue
      if (filterTool && event.tool !== filterTool) continue

      filteredEvents.push(event)

      // Metrics tính toán chi tiết
      if (event.fileSize) totalBytesProcessed += Number(event.fileSize) || 0
      if (event.durationMs && Number(event.durationMs) > 0) {
        totalDurationMs += Number(event.durationMs)
        toolUsesWithDuration += 1
      }
      if (event.type === 'tool_use') {
        if (event.status === 'error') errorCount += 1
        else successCount += 1
      }
      if (event.userAgent) {
        const dev = detectDevice(event.userAgent)
        deviceBreakdown[dev] = (deviceBreakdown[dev] || 0) + 1
      }

      const bucket = dailyMap.get(eventDateStr)
      if (bucket) {
        if (event.type === 'visit') bucket.visits += 1
        if (event.type === 'tool_use') bucket.toolUses += 1
        bucket.total = bucket.visits + bucket.toolUses
      }

      const ip = event.ip || '127.0.0.1'
      let ipEntry = rangeIps.get(ip)
      if (!ipEntry) {
        const memEntry = this.ipMap.get(ip)
        ipEntry = {
          ip,
          geo: event.geo || { flag: '🌐', city: '', countryCode: '', label: '🌐' },
          visits: 0,
          toolUses: 0,
          successes: 0,
          errors: 0,
          totalBytes: 0,
          isBlocked: this.isIpBlocked(ip),
          firstSeen: memEntry?.firstSeen || event.timestamp,
          lastSeen: event.timestamp,
          userAgent: event.userAgent || memEntry?.userAgent || '',
        }
        rangeIps.set(ip, ipEntry)
      }
      if (event.geo && (!ipEntry.geo || ipEntry.geo.flag === '🌐')) {
        ipEntry.geo = event.geo
      }
      if (event.userAgent && !ipEntry.userAgent) {
        ipEntry.userAgent = event.userAgent
      }
      if (event.fileSize) {
        ipEntry.totalBytes += Number(event.fileSize) || 0
      }
      if (event.type === 'visit') {
        rangeVisits += 1
        ipEntry.visits += 1
      } else if (event.type === 'tool_use') {
        rangeToolUses += 1
        ipEntry.toolUses += 1
        if (event.status === 'error') {
          ipEntry.errors += 1
        } else {
          ipEntry.successes += 1
        }

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
      if (new Date(event.timestamp) < new Date(ipEntry.firstSeen)) {
        ipEntry.firstSeen = event.timestamp
      }
    }

    const topTools = Array.from(rangeTools.values())
      .sort((a, b) => b.totalUses - a.totalUses)
      .slice(0, 15)

    const topIps = Array.from(rangeIps.values())
      .map(entry => {
        const totalActions = entry.toolUses + entry.visits
        const successRate = entry.toolUses > 0 ? Math.round((entry.successes / entry.toolUses) * 100) : 100
        return {
          ...entry,
          totalActions,
          successRate,
          device: detectDevice(entry.userAgent),
          isBlocked: this.isIpBlocked(entry.ip),
        }
      })
      .sort((a, b) => b.totalActions - a.totalActions)
      .slice(0, 25)

    const totalToolEvents = successCount + errorCount
    const successRate = totalToolEvents > 0 ? Number(((successCount / totalToolEvents) * 100).toFixed(1)) : 100
    const avgDurationMs = toolUsesWithDuration > 0 ? Math.round(totalDurationMs / toolUsesWithDuration) : 0

    const dailyTrend = Array.from(dailyMap.values())

    return {
      range,
      summary: {
        totalVisits: cutoffTime > 0 ? rangeVisits : this.totalVisits,
        uniqueIps: cutoffTime > 0 ? rangeIps.size : this.ipMap.size,
        totalToolUses: cutoffTime > 0 ? rangeToolUses : this.totalToolUses,
        todayVisits,
        todayToolUses,
        totalBlockedIps: this.blockedIps.size,
        totalEventsRecorded: filteredEvents.length,
        totalBytesProcessed,
        avgDurationMs,
        successCount,
        errorCount,
        successRate,
        recentlyActiveCount: recentlyActiveIps.size,
        deviceBreakdown,
      },
      dailyTrend,
      topTools: topTools.length > 0 ? topTools : (cutoffTime === 0 ? Array.from(this.toolMap.values()).slice(0, 15) : []),
      topIps: topIps.length > 0 ? topIps : (cutoffTime === 0 ? Array.from(this.ipMap.values()).slice(0, 25) : []),
      blockedIps: this.getBlockedIps(),
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
        ipData = {
          ip,
          geo: event.geo || { flag: '🌐', city: '', countryCode: '', label: '🌐' },
          visits: 0,
          toolUses: 0,
          tools: new Map(),
          isBlocked: this.isIpBlocked(ip),
          lastActive: event.timestamp,
        }
        ipStatsMap.set(ip, ipData)
      }

      if (event.geo && (!ipData.geo || ipData.geo.flag === '🌐')) {
        ipData.geo = event.geo
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
