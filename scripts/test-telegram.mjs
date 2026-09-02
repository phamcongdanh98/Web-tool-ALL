#!/usr/bin/env node

import dotenv from 'dotenv'

dotenv.config()

const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
const chatId = process.env.TELEGRAM_CHAT_ID?.trim()

const isColor = Boolean(process.stdout.isTTY && !process.env.NO_COLOR)
const c = code => str => isColor ? `\x1b[${code}m${str}\x1b[0m` : String(str)
const bold = c('1')
const green = c('32')
const yellow = c('33')
const red = c('31')
const cyan = c('36')
const dim = c('2')

console.log(`\n${bold(cyan('🤖 KIỂM TRA KẾT NỐI TELEGRAM BOT — PDFTOOLS'))}`)
console.log(dim('═'.repeat(60)))

if (!token || !chatId) {
  console.log(`\n${yellow('⚠️  Chưa cấu hình Telegram Bot trong file .env!')}`)
  console.log(`\nĐể kích hoạt bot, vui lòng thêm 2 dòng sau vào file ${bold('.env')}:`)
  console.log(cyan('  TELEGRAM_BOT_TOKEN=123456789:AAFn...  ') + dim('(Lấy từ @BotFather)'))
  console.log(cyan('  TELEGRAM_CHAT_ID=123456789            ') + dim('(Lấy từ @userinfobot)'))
  console.log(`\n${dim('Sau khi thêm vào .env, hãy chạy lại lệnh: npm run test:telegram')}\n`)
  process.exit(0)
}

console.log(`\n1. Kiểm tra Token và thông tin Bot...`)
try {
  const getMeRes = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
    signal: AbortSignal.timeout(8000),
  })
  const meData = await getMeRes.json()

  if (!meData.ok) {
    console.error(red(`❌ Token không hợp lệ: ${meData.description}`))
    process.exit(1)
  }

  const bot = meData.result
  console.log(green(`   ✓ Kết nối thành công tới Bot: ${bold(bot.first_name)} (@${bot.username}) [ID: ${bot.id}]`))

  console.log(`\n2. Gửi tin nhắn thử nghiệm tới Chat ID: ${bold(chatId)}...`)
  const testMessage = [
    `🎉 <b>[PDFTools] KẾT NỐI TELEGRAM BOT THÀNH CÔNG!</b>`,
    `──────────────────────────`,
    `⏱️ <b>Thời gian:</b> ${new Date().toLocaleString('vi-VN')}`,
    `🤖 <b>Tên Bot:</b> @${bot.username}`,
    `\n✅ Hệ thống thông báo lượt dùng công cụ và quản trị thống kê đã sẵn sàng hoạt động!`,
    `\n<i>Hãy thử gõ các lệnh sau để trò chuyện với Bot:</i>`,
    `• /stats — Xem tổng quan`,
    `• /today — Xem hôm nay`,
    `• /top — Top công cụ & Top IP`,
    `• /recent — Hoạt động gần nhất`,
    `• /ping — Kiểm tra máy chủ`,
  ].join('\n')

  const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: testMessage,
      parse_mode: 'HTML',
    }),
    signal: AbortSignal.timeout(8000),
  })

  const sendData = await sendRes.json()
  if (!sendData.ok) {
    console.error(red(`❌ Không thể gửi tin nhắn tới Chat ID ${chatId}: ${sendData.description}`))
    console.log(yellow(`💡 Lưu ý: Hãy đảm bảo bạn đã mở khung chat với Bot @${bot.username} và bấm nút START trước!`))
    process.exit(1)
  }

  console.log(green(`   ✓ Đã gửi tin nhắn thành công! (Message ID: ${sendData.result.message_id})`))
  console.log(`\n${bold(green('🎉 Hoàn tất! Telegram Bot đã sẵn sàng nhận thông báo và trả lời lệnh.'))}\n`)
} catch (error) {
  console.error(red(`❌ Lỗi kết nối Telegram: ${error.message}`))
  process.exit(1)
}
