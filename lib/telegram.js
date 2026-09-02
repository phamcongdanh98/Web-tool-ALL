import dotenv from 'dotenv'
import { formatBytes } from './browser-utility.js'

dotenv.config()

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

  async sendMessage(text, options = {}) {
    if (!this.token) return null
    const targetChatId = options.chatId || this.chatId
    if (!targetChatId) return null

    try {
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(10000),
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
      // Giãn cách 1 giây để tránh rate limit của Telegram
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
              // Phản hồi tức thời không chặn vòng lặp getUpdates
              this._handleIncomingMessage(update.message).catch(err => {
                console.warn('Lỗi xử lý tin nhắn bot:', err.message)
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

  async _handleIncomingMessage(msg) {
    const fromChatId = String(msg.chat?.id)
    const text = msg.text.trim()
    const command = text.split(' ')[0].toLowerCase().replace(/@.+$/, '')

    // Gửi trạng thái "đang nhập..." tức thì để người dùng nhận biết bot đang phản hồi
    this.sendChatAction(fromChatId, 'typing').catch(() => {})

    // Bảo mật: Chỉ trả lời đúng Chat ID được cấp quyền (nếu có cấu hình)
    if (this.chatId && fromChatId !== String(this.chatId)) {
      await this.sendMessage(
        '⛔ <b>Từ chối truy cập</b>\nBạn không có quyền tương tác với hệ thống quản trị này.',
        { chatId: fromChatId }
      )
      return
    }

    if (!this.analyticsTracker) {
      await this.sendMessage('⚠️ Hệ thống thống kê chưa sẵn sàng.', { chatId: fromChatId })
      return
    }

    const stats = this.analyticsTracker.getStats({ limit: 8 })
    const s = stats.summary || {}

    if (command === '/start' || command === '/help') {
      const helpMsg = [
        `🤖 <b>PDFTOOLS BOT — DANH SÁCH LỆNH</b>`,
        `──────────────────────────`,
        `📊 /stats — Xem tổng quan truy cập & lượt dùng`,
        `📅 /today — Xem thống kê chi tiết hôm nay`,
        `🏆 /top — Top công cụ & Top địa chỉ IP`,
        `⏱️ /recent — Xem 8 hoạt động mới nhất`,
        `🏓 /ping — Kiểm tra tình trạng máy chủ`,
        `ℹ️ /help — Hiển thị trợ giúp này`,
      ].join('\n')
      await this.sendMessage(helpMsg, { chatId: fromChatId })
    } else if (command === '/stats') {
      const statsMsg = [
        `📊 <b>THỐNG KÊ TỔNG QUAN PDFTOOLS</b>`,
        `──────────────────────────`,
        `👁️ <b>Tổng lượt truy cập:</b> <b>${(s.totalVisits || 0).toLocaleString()}</b> <i>(+${s.todayVisits || 0} hôm nay)</i>`,
        `🌐 <b>Địa chỉ IP duy nhất:</b> <b>${(s.uniqueIps || 0).toLocaleString()}</b>`,
        `⚡ <b>Lượt dùng công cụ:</b> <b>${(s.totalToolUses || 0).toLocaleString()}</b> <i>(+${s.todayToolUses || 0} hôm nay)</i>`,
        `📦 <b>Sự kiện đã ghi nhận:</b> ${(s.totalEventsRecorded || 0).toLocaleString()}`,
        `\n<i>Gõ /today để xem chi tiết hôm nay hoặc /top để xem xếp hạng.</i>`,
      ].join('\n')
      await this.sendMessage(statsMsg, { chatId: fromChatId })
    } else if (command === '/today') {
      const todayMsg = [
        `📅 <b>TÌNH HÌNH HOẠT ĐỘNG HÔM NAY</b>`,
        `──────────────────────────`,
        `👁️ <b>Lượt truy cập mới:</b> <b>${s.todayVisits || 0}</b>`,
        `⚡ <b>Lượt dùng công cụ mới:</b> <b>${s.todayToolUses || 0}</b>`,
        `\n🏆 <b>Top công cụ phổ biến:</b>`,
        ...(stats.topTools || []).slice(0, 5).map((t, idx) => `${idx + 1}. <b>${t.tool}</b>: ${t.totalUses} lượt`),
      ].join('\n')
      await this.sendMessage(todayMsg, { chatId: fromChatId })
    } else if (command === '/top') {
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
      ].join('\n')
      await this.sendMessage(topMsg, { chatId: fromChatId })
    } else if (command === '/recent') {
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
      ].join('\n')
      await this.sendMessage(recentMsg, { chatId: fromChatId })
    } else if (command === '/ping') {
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
      ].join('\n')
      await this.sendMessage(pingMsg, { chatId: fromChatId })
    }
  }

  _startDailyScheduler() {
    // Kiểm tra mỗi 15 phút, nếu thời gian là 22:xx và chưa gửi báo cáo ngày hôm nay thì gửi
    this.dailyTimer = setInterval(() => {
      const now = new Date()
      const todayStr = now.toISOString().slice(0, 10)
      // Gửi vào lúc 22h tối (giờ local)
      if (now.getHours() === 22 && this.lastDailyReportDate !== todayStr && this.analyticsTracker) {
        this.lastDailyReportDate = todayStr
        const stats = this.analyticsTracker.getStats()
        const s = stats.summary || {}
        const report = [
          `📢 <b>BÁO CÁO TỔNG KẾT NGÀY ${now.toLocaleDateString('vi-VN')}</b>`,
          `──────────────────────────`,
          `👁️ Lượt truy cập hôm nay: <b>${s.todayVisits || 0}</b>`,
          `⚡ Lượt dùng công cụ hôm nay: <b>${s.todayToolUses || 0}</b>`,
          `🌐 Tổng IP duy nhất đã biết: <b>${s.uniqueIps || 0}</b>`,
          `\n🏆 <i>Chúc bạn một buổi tối tốt lành!</i>`,
        ].join('\n')
        this.enqueueNotification(report)
      }
    }, 15 * 60 * 1000)
  }
}

export const telegramBot = new TelegramBotManager()
