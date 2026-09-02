import dotenv from 'dotenv'
import os from 'node:os'
import { execSync } from 'node:child_process'
import { formatBytes } from './browser-utility.js'

dotenv.config()

export const makeProgressBar = (percent, length = 10) => {
  const clamped = Math.max(0, Math.min(100, Math.round(percent || 0)))
  const filled = Math.round((clamped / 100) * length)
  const empty = Math.max(0, length - filled)
  return '█'.repeat(filled) + '░'.repeat(empty)
}

export class TelegramBotManager {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN?.trim() || ''
    this.chatId = process.env.TELEGRAM_CHAT_ID?.trim() || ''
    this.notifyToolUse = process.env.TELEGRAM_NOTIFY_TOOL_USE !== 'false'
    this.dailyReport = process.env.TELEGRAM_DAILY_REPORT !== 'false'
    this.pollingEnabled = process.env.TELEGRAM_POLLING !== 'false'

    this.baseUrl = this.token ? `https://api.telegram.org/bot${this.token}` : ''
    this.isPolling = false
    this.abortController = null
    this.lastUpdateId = 0
    this.messageQueue = []
    this.isSending = false
    this.analyticsTracker = null
    this.dailyTimer = null
    this.lastDailyReportDate = ''
  }

  setAnalyticsTracker(tracker) {
    this.analyticsTracker = tracker
  }

  isConfigured() {
    return Boolean(this.token && this.chatId)
  }

  getSystemVpsMetrics() {
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem
    const memPercent = Math.round((usedMem / totalMem) * 100)

    const cpus = os.cpus()
    const cpuCount = cpus.length || 1
    const cpuModel = cpus[0]?.model ? cpus[0].model.replace(/\s+/g, ' ').trim() : 'Generic CPU'
    const loadAvg = os.loadavg().map(l => l.toFixed(2))
    const cpuPercent = Math.min(100, Math.round((os.loadavg()[0] / cpuCount) * 100))

    let diskTotalGb = '0'
    let diskUsedGb = '0'
    let diskFreeGb = '0'
    let diskPercent = 0
    try {
      const dfOutput = execSync('df -k /', { encoding: 'utf8', timeout: 3000 })
      const lines = dfOutput.trim().split('\n')
      if (lines.length > 1) {
        const parts = lines[1].split(/\s+/)
        const totalKib = parseInt(parts[1], 10)
        const usedKib = parseInt(parts[2], 10)
        const freeKib = parseInt(parts[3], 10)
        if (totalKib > 0) {
          diskTotalGb = (totalKib / 1024 / 1024).toFixed(1)
          diskUsedGb = (usedKib / 1024 / 1024).toFixed(1)
          diskFreeGb = (freeKib / 1024 / 1024).toFixed(1)
          diskPercent = Math.round((usedKib / totalKib) * 100)
        }
      }
    } catch {}

    const uptimeSec = Math.floor(os.uptime())
    const days = Math.floor(uptimeSec / 86400)
    const hours = Math.floor((uptimeSec % 86400) / 3600)
    const minutes = Math.floor((uptimeSec % 3600) / 60)
    const uptimeStr = `${days > 0 ? days + ' ngày ' : ''}${hours} giờ ${minutes} phút`

    return {
      uptimeStr,
      mem: {
        totalMb: Math.round(totalMem / 1024 / 1024),
        usedMb: Math.round(usedMem / 1024 / 1024),
        freeMb: Math.round(freeMem / 1024 / 1024),
        percent: memPercent,
      },
      cpu: {
        cores: cpuCount,
        model: cpuModel,
        loadAvg,
        percent: cpuPercent,
      },
      disk: {
        totalGb: diskTotalGb,
        usedGb: diskUsedGb,
        freeGb: diskFreeGb,
        percent: diskPercent,
      },
    }
  }

  async sendMessage(text, options = {}) {
    if (!this.token) return null
    const targetChatId = options.chatId || this.chatId
    if (!targetChatId) return null

    try {
      const payload = {
        chat_id: targetChatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }
      if (options.reply_markup) {
        payload.reply_markup = options.reply_markup
      }

      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(6000),
      })
      const result = await response.json()
      if (!result.ok) {
        console.warn('Telegram API sendMessage lỗi:', result.description)
      }
      return result
    } catch (error) {
      console.warn('Không thể gửi tin nhắn Telegram:', error.message)
      return null
    }
  }

  async sendChatAction(chatId, action = 'typing') {
    if (!this.token || !chatId) return
    try {
      await fetch(`${this.baseUrl}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action }),
        signal: AbortSignal.timeout(3000),
      })
    } catch {}
  }

  async _answerCallbackQuery(callbackQueryId, text = '') {
    if (!this.token || !callbackQueryId) return
    try {
      await fetch(`${this.baseUrl}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
        signal: AbortSignal.timeout(3000),
      })
    } catch {}
  }

  async _registerBotCommands() {
    if (!this.token) return
    try {
      await fetch(`${this.baseUrl}/setMyCommands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commands: [
            { command: 'stats', description: '📊 Thống kê tổng quan lượt truy cập & công cụ' },
            { command: 'today', description: '📅 Chi tiết IP & công cụ hoạt động hôm nay' },
            { command: 'vps', description: '🖥️ Cấu hình VPS: CPU, RAM, Ổ cứng Disk' },
            { command: 'top', description: '🏆 Bảng xếp hạng Top 5 công cụ và Top địa chỉ IP' },
            { command: 'recent', description: '⏱️ Xem 8 hoạt động mới nhất kèm thời gian' },
            { command: 'ping', description: '🏓 Kiểm tra tình trạng máy chủ (Uptime & RAM)' },
            { command: 'help', description: 'ℹ️ Hướng dẫn sử dụng & danh sách nút bấm' },
          ],
        }),
        signal: AbortSignal.timeout(5000),
      })
    } catch (err) {
      console.warn('Không thể đăng ký lệnh bot với Telegram:', err.message)
    }
  }

  getReplyKeyboard() {
    return {
      keyboard: [
        [{ text: '📊 Tổng quan' }, { text: '📅 Hôm nay' }],
        [{ text: '🏆 Xếp hạng' }, { text: '⏱️ Gần đây' }],
        [{ text: '🖥️ VPS' }, { text: '🏓 Máy chủ' }],
        [{ text: 'ℹ️ Trợ giúp' }],
      ],
      resize_keyboard: true,
      is_persistent: true,
    }
  }

  getInlineKeyboard(currentCmd = 'stats') {
    return {
      inline_keyboard: [
        [
          { text: '🔄 Làm mới', callback_data: currentCmd },
          { text: currentCmd === 'today' ? '📊 Tổng quan' : '📅 Hôm nay', callback_data: currentCmd === 'today' ? 'stats' : 'today' },
        ],
        [
          { text: '🖥️ VPS', callback_data: 'vps' },
          { text: currentCmd === 'top' ? '⏱️ Gần đây' : '🏆 Xếp hạng', callback_data: currentCmd === 'top' ? 'recent' : 'top' },
        ],
      ],
    }
  }

  enqueueNotification(text) {
    if (!this.isConfigured()) return
    this.messageQueue.push(text)
    this._processQueue()
  }

  async _processQueue() {
    if (this.isSending || !this.messageQueue.length) return
    this.isSending = true
    while (this.messageQueue.length > 0) {
      const text = this.messageQueue.shift()
      await this.sendMessage(text)
      if (this.messageQueue.length > 0) {
        await new Promise(r => setTimeout(r, 1000))
      }
    }
    this.isSending = false
  }

  notifyToolUsage(event) {
    if (!this.isConfigured() || !this.notifyToolUse) return
    const isSuccess = event.status !== 'error'
    const statusIcon = isSuccess ? '✅' : '❌'
    const statusText = isSuccess ? 'Thành công' : 'Thất bại'
    const dateStr = new Date(event.timestamp || Date.now()).toLocaleString('vi-VN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      day: '2-digit', month: '2-digit', year: 'numeric',
    })

    const sizeText = event.fileSize > 0 ? `\n📦 <b>Dung lượng:</b> ${formatBytes(event.fileSize)}` : ''
    const actionText = event.action ? ` (${event.action})` : ''

    const message = [
      `🔔 <b>[PDFTools] LƯỢT DÙNG CÔNG CỤ</b>`,
      `──────────────────────────`,
      `⏱️ <b>Thời gian:</b> ${dateStr}`,
      `🌐 <b>Địa chỉ IP:</b> <code>${event.ip || '127.0.0.1'}</code>`,
      `🔧 <b>Công cụ:</b> <b>${event.tool}</b>${actionText}`,
      `⚡ <b>Nguồn:</b> ${event.source === 'client' ? 'Trình duyệt (Client)' : 'Máy chủ (API)'}${sizeText}`,
      `${statusIcon} <b>Trạng thái:</b> ${statusText}`,
    ].join('\n')

    this.enqueueNotification(message)
  }

  start() {
    this.token = this.token || process.env.TELEGRAM_BOT_TOKEN?.trim() || ''
    this.chatId = this.chatId || process.env.TELEGRAM_CHAT_ID?.trim() || ''
    this.baseUrl = this.token ? `https://api.telegram.org/bot${this.token}` : ''

    if (!this.token) {
      console.log('ℹ️ Telegram Bot chưa được cấu hình (thiếu TELEGRAM_BOT_TOKEN trong .env).')
      return
    }
    console.log(`🤖 Khởi chạy Telegram Bot (@${this.token.split(':')[0]} / Chat ID: ${this.chatId || 'Chưa cấu hình'}).`)

    // Đăng ký menu lệnh chính thức với Telegram
    this._registerBotCommands()

    if (this.pollingEnabled) {
      this._startPolling()
    }
    if (this.dailyReport) {
      this._startDailyScheduler()
    }
  }

  stop() {
    this.isPolling = false
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    if (this.dailyTimer) {
      clearInterval(this.dailyTimer)
      this.dailyTimer = null
    }
    console.log('🛑 Đã dừng Telegram Bot an toàn.')
  }

  async _startPolling() {
    this.isPolling = true
    this.abortController = new AbortController()

    while (this.isPolling) {
      try {
        const offset = this.lastUpdateId ? this.lastUpdateId + 1 : 0
        const url = `${this.baseUrl}/getUpdates?offset=${offset}&timeout=10`
        const fetchSignal = this.abortController?.signal
          ? AbortSignal.any([this.abortController.signal, AbortSignal.timeout(15000)])
          : AbortSignal.timeout(15000)

        const response = await fetch(url, { signal: fetchSignal })
        if (!response.ok) {
          await new Promise(r => setTimeout(r, 2000))
          continue
        }
        const data = await response.json()
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id)
            if (update.message?.text) {
              this._handleIncomingMessage(update.message).catch(err => {
                console.warn('Lỗi xử lý tin nhắn bot:', err.message)
              })
            } else if (update.callback_query) {
              this._handleCallbackQuery(update.callback_query).catch(err => {
                console.warn('Lỗi xử lý callback bot:', err.message)
              })
            }
          }
        }
      } catch (err) {
        if (!this.isPolling) break
        await new Promise(r => setTimeout(r, 1500))
      }
    }
  }

  _resolveCommand(text) {
    if (!text) return null
    const t = text.trim().toLowerCase()
    if (t.startsWith('/stats') || t.includes('tổng quan') || t.includes('thống kê') || t === 'stats') return 'stats'
    if (t.startsWith('/today') || t.includes('hôm nay') || t === 'today') return 'today'
    if (t.startsWith('/vps') || t.includes('vps') || t.includes('cấu hình') || t.includes('tài nguyên') || t === 'vps') return 'vps'
    if (t.startsWith('/top') || t.includes('xếp hạng') || t === 'top') return 'top'
    if (t.startsWith('/recent') || t.includes('gần đây') || t.includes('mới nhất') || t === 'recent') return 'recent'
    if (t.startsWith('/ping') || t.includes('máy chủ') || t.includes('kiểm tra') || t === 'ping') return 'ping'
    if (t.startsWith('/help') || t.startsWith('/start') || t.includes('trợ giúp') || t.includes('hướng dẫn') || t === 'help') return 'help'
    return null
  }

  async _handleCallbackQuery(query) {
    const fromChatId = String(query.message?.chat?.id || query.from?.id)
    this._answerCallbackQuery(query.id).catch(() => {})

    if (this.chatId && fromChatId !== String(this.chatId)) {
      return
    }

    const command = this._resolveCommand(query.data) || 'stats'
    await this._dispatchCommand(command, fromChatId, true)
  }

  async _handleIncomingMessage(msg) {
    const fromChatId = String(msg.chat?.id)
    const text = msg.text.trim()

    this.sendChatAction(fromChatId, 'typing').catch(() => {})

    if (this.chatId && fromChatId !== String(this.chatId)) {
      await this.sendMessage(
        '⛔ <b>Từ chối truy cập</b>\nBạn không có quyền tương tác với hệ thống quản trị này.',
        { chatId: fromChatId }
      )
      return
    }

    const command = this._resolveCommand(text) || 'help'
    await this._dispatchCommand(command, fromChatId, false)
  }

  async _dispatchCommand(command, fromChatId, isCallback = false) {
    if (!this.analyticsTracker) {
      await this.sendMessage('⚠️ Hệ thống thống kê chưa sẵn sàng.', { chatId: fromChatId })
      return
    }

    const stats = this.analyticsTracker.getStats({ limit: 8 })
    const s = stats.summary || {}
    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

    if (command === 'help') {
      const helpMsg = [
        `🤖 <b>PDFTOOLS BOT — DANH SÁCH LỆNH QUẢN TRỊ</b>`,
        `──────────────────────────`,
        `Bạn có thể <b>chạm vào các nút bên dưới</b> mà không cần gõ:`,
        ``,
        `📊 <b>Tổng quan:</b> Lượt truy cập, IP & lượt dùng`,
        `📅 <b>Hôm nay:</b> Chi tiết từng IP & công cụ hôm nay`,
        `🖥️ <b>VPS:</b> Cấu hình CPU, RAM, Ổ cứng Disk dạng biểu đồ`,
        `🏆 <b>Xếp hạng:</b> Top 5 công cụ & Top địa chỉ IP`,
        `⏱️ <b>Gần đây:</b> 8 hoạt động mới nhất`,
        `🏓 <b>Máy chủ:</b> Uptime & tình trạng Node.js`,
        `ℹ️ <b>Trợ giúp:</b> Hiển thị menu này`,
      ].join('\n')

      await this.sendMessage(helpMsg, {
        chatId: fromChatId,
        reply_markup: this.getReplyKeyboard(),
      })
    } else if (command === 'stats') {
      const statsMsg = [
        `📊 <b>THỐNG KÊ TỔNG QUAN PDFTOOLS</b>`,
        `──────────────────────────`,
        `👁️ <b>Tổng lượt truy cập:</b> <b>${(s.totalVisits || 0).toLocaleString()}</b> <i>(+${s.todayVisits || 0} hôm nay)</i>`,
        `🌐 <b>Địa chỉ IP duy nhất:</b> <b>${(s.uniqueIps || 0).toLocaleString()}</b>`,
        `⚡ <b>Lượt dùng công cụ:</b> <b>${(s.totalToolUses || 0).toLocaleString()}</b> <i>(+${s.todayToolUses || 0} hôm nay)</i>`,
        `📦 <b>Sự kiện đã ghi nhận:</b> ${(s.totalEventsRecorded || 0).toLocaleString()}`,
        `⏱️ <i>Cập nhật lúc: ${nowStr}</i>`,
      ].join('\n')

      await this.sendMessage(statsMsg, {
        chatId: fromChatId,
        reply_markup: isCallback ? this.getInlineKeyboard('stats') : this.getReplyKeyboard(),
      })
    } else if (command === 'today') {
      const td = this.analyticsTracker.getTodayDetailedStats
        ? this.analyticsTracker.getTodayDetailedStats()
        : { todayVisits: s.todayVisits, todayToolUses: s.todayToolUses, uniqueIpsToday: 0, topIpsToday: [], topToolsToday: [] }

      const maxIpActions = td.topIpsToday[0]?.totalActions || 1
      const ipBreakdownList = td.topIpsToday.slice(0, 8).map((ip, idx) => {
        const pct = Math.round((ip.totalActions / maxIpActions) * 100)
        const lastTime = new Date(ip.lastActive).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        const toolsSummary = ip.toolsList.length > 0 ? ip.toolsList.map(t => `${t.tool} (${t.count})`).join(', ') : 'Chỉ xem'
        return [
          `<b>${idx + 1}.</b> <code>${ip.ip}</code> · <b>${ip.totalActions} lượt</b> (👁️ ${ip.visits} · 🔧 ${ip.toolUses})`,
          `   └─ [<code>${makeProgressBar(pct, 8)}</code>] <i>Cuối: ${lastTime}</i>`,
          `   └─ <i>Tool: ${toolsSummary}</i>`,
        ].join('\n')
      }).join('\n\n') || 'Chưa có lượt truy cập nào hôm nay.'

      const maxToolCount = td.topToolsToday[0]?.count || 1
      const toolBreakdownList = td.topToolsToday.slice(0, 6).map((t, idx) => {
        const pct = Math.round((t.count / maxToolCount) * 100)
        return `• <b>${t.tool}</b>: <b>${t.count} lượt</b> [<code>${makeProgressBar(pct, 6)}</code>]`
      }).join('\n') || 'Chưa có công cụ nào được dùng hôm nay.'

      const todayMsg = [
        `📅 <b>CHI TIẾT HOẠT ĐỘNG HÔM NAY (${td.dateStr || ''})</b>`,
        `──────────────────────────`,
        `👁️ Lượt truy cập web: <b>${td.todayVisits || 0}</b>`,
        `⚡ Lượt dùng công cụ: <b>${td.todayToolUses || 0}</b>`,
        `🌐 Số IP duy nhất hôm nay: <b>${td.uniqueIpsToday || 0} IP</b>`,
        `\n🌐 <b>DANH SÁCH IP TRUY CẬP HÔM NAY:</b>`,
        ipBreakdownList,
        `\n🏆 <b>CÔNG CỤ ĐƯỢC DÙNG HÔM NAY:</b>`,
        toolBreakdownList,
        `\n⏱️ <i>Cập nhật lúc: ${nowStr}</i>`,
      ].join('\n')

      await this.sendMessage(todayMsg, {
        chatId: fromChatId,
        reply_markup: isCallback ? this.getInlineKeyboard('today') : this.getReplyKeyboard(),
      })
    } else if (command === 'vps') {
      const m = this.getSystemVpsMetrics()
      const vpsMsg = [
        `🖥️ <b>THÔNG SỐ CẤU HÌNH & TÀI NGUYÊN VPS</b>`,
        `──────────────────────────`,
        `⏱️ <b>Thời gian chạy (Uptime):</b> ${m.uptimeStr}`,
        `🟢 <b>Trạng thái:</b> Online · Node ${process.version} (PID: ${process.pid})`,
        ``,
        `🧠 <b>BỘ NHỚ RAM (Tổng: ${m.mem.totalMb} MB)</b>`,
        `├── Đang sử dụng: <b>${m.mem.usedMb} MB</b> (${m.mem.percent}%)`,
        `├── Còn trống: <b>${m.mem.freeMb} MB</b>`,
        `└── Biểu đồ: [<code>${makeProgressBar(m.mem.percent, 10)}</code>] <b>${m.mem.percent}%</b>`,
        ``,
        `⚡ <b>VI XỬ LÝ CPU (${m.cpu.cores} Core)</b>`,
        `├── Chip: ${m.cpu.model}`,
        `├── Tải TB (1m, 5m, 15m): <b>${m.cpu.loadAvg.join(' · ')}</b>`,
        `└── Biểu đồ: [<code>${makeProgressBar(m.cpu.percent, 10)}</code>] <b>${m.cpu.percent}%</b>`,
        ``,
        `💾 <b>DUNG LƯỢNG Ổ CỨNG (${m.disk.totalGb} GB)</b>`,
        `├── Đang dùng: <b>${m.disk.usedGb} GB</b> (${m.disk.percent}%)`,
        `├── Còn trống: <b>${m.disk.freeGb} GB</b>`,
        `└── Biểu đồ: [<code>${makeProgressBar(m.disk.percent, 10)}</code>] <b>${m.disk.percent}%</b>`,
        `\n⏱️ <i>Cập nhật lúc: ${nowStr}</i>`,
      ].join('\n')

      await this.sendMessage(vpsMsg, {
        chatId: fromChatId,
        reply_markup: isCallback ? this.getInlineKeyboard('vps') : this.getReplyKeyboard(),
      })
    } else if (command === 'top') {
      const toolsList = (stats.topTools || []).slice(0, 5)
        .map((t, i) => `${i + 1}. <b>${t.tool}</b>: ${t.totalUses} lượt (${t.successes} ok, ${t.errors} lỗi)`)
        .join('\n') || 'Chưa có dữ liệu'

      const ipsList = (stats.topIps || []).slice(0, 5)
        .map((ip, i) => `${i + 1}. <code>${ip.ip}</code>: ${ip.toolUses} lần dùng, ${ip.visits} truy cập`)
        .join('\n') || 'Chưa có dữ liệu'

      const topMsg = [
        `🏆 <b>BẢNG XẾP HẠNG HOẠT ĐỘNG</b>`,
        `──────────────────────────`,
        `🔧 <b>Top 5 công cụ:</b>\n${toolsList}`,
        `\n🌐 <b>Top 5 địa chỉ IP:</b>\n${ipsList}`,
        `\n⏱️ <i>Cập nhật lúc: ${nowStr}</i>`,
      ].join('\n')

      await this.sendMessage(topMsg, {
        chatId: fromChatId,
        reply_markup: isCallback ? this.getInlineKeyboard('top') : this.getReplyKeyboard(),
      })
    } else if (command === 'recent') {
      const eventsList = (stats.recentEvents || []).slice(0, 8).map(e => {
        const time = new Date(e.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        const icon = e.type === 'visit' ? '👁️' : '🔧'
        const label = e.type === 'visit' ? 'Truy cập' : e.tool
        const status = e.status === 'error' ? '❌' : '✓'
        return `• [${time}] <code>${e.ip}</code> ${icon} <b>${label}</b> ${status}`
      }).join('\n') || 'Chưa có dữ liệu gần đây.'

      const recentMsg = [
        `⏱️ <b>8 HOẠT ĐỘNG MỚI NHẤT</b>`,
        `──────────────────────────`,
        eventsList,
        `\n⏱️ <i>Cập nhật lúc: ${nowStr}</i>`,
      ].join('\n')

      await this.sendMessage(recentMsg, {
        chatId: fromChatId,
        reply_markup: isCallback ? this.getInlineKeyboard('recent') : this.getReplyKeyboard(),
      })
    } else if (command === 'ping') {
      const uptimeSec = Math.floor(process.uptime())
      const hours = Math.floor(uptimeSec / 3600)
      const minutes = Math.floor((uptimeSec % 3600) / 60)
      const memMb = Math.round(process.memoryUsage().rss / 1024 / 1024)
      const pingMsg = [
        `🏓 <b>PONG! MÁY CHỦ ĐANG HOẠT ĐỘNG TỐT</b>`,
        `──────────────────────────`,
        `⏱️ <b>Thời gian chạy (Uptime):</b> ${hours}h ${minutes}m`,
        `💾 <b>RAM sử dụng:</b> ${memMb} MB`,
        `🟢 <b>Trạng thái:</b> Online (Node ${process.version})`,
        `⏱️ <i>Cập nhật lúc: ${nowStr}</i>`,
      ].join('\n')

      await this.sendMessage(pingMsg, {
        chatId: fromChatId,
        reply_markup: isCallback ? this.getInlineKeyboard('ping') : this.getReplyKeyboard(),
      })
    }
  }

  _startDailyScheduler() {
    this.dailyTimer = setInterval(() => {
      const now = new Date()
      const todayStr = now.toISOString().slice(0, 10)
      if (now.getHours() === 22 && this.lastDailyReportDate !== todayStr && this.analyticsTracker) {
        this.lastDailyReportDate = todayStr
        const td = this.analyticsTracker.getTodayDetailedStats
          ? this.analyticsTracker.getTodayDetailedStats()
          : null
        const stats = this.analyticsTracker.getStats()
        const s = stats.summary || {}
        const report = [
          `📢 <b>BÁO CÁO TỔNG KẾT NGÀY ${now.toLocaleDateString('vi-VN')}</b>`,
          `──────────────────────────`,
          `👁️ Lượt truy cập hôm nay: <b>${td?.todayVisits ?? (s.todayVisits || 0)}</b>`,
          `⚡ Lượt dùng công cụ hôm nay: <b>${td?.todayToolUses ?? (s.todayToolUses || 0)}</b>`,
          `🌐 Số IP duy nhất hôm nay: <b>${td?.uniqueIpsToday ?? (s.uniqueIps || 0)}</b>`,
          `\n🏆 <i>Chúc bạn một buổi tối tốt lành!</i>`,
        ].join('\n')
        this.enqueueNotification(report)
      }
    }, 15 * 60 * 1000)
  }
}

export const telegramBot = new TelegramBotManager()
