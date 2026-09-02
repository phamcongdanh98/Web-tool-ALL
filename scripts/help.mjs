#!/usr/bin/env node

const colorEnabled = Boolean(process.stdout.isTTY && !process.env.NO_COLOR)
const paint = code => value => colorEnabled ? `\x1b[${code}m${value}\x1b[0m` : value
const bold = paint('1')
const cyan = paint('36')
const green = paint('32')
const yellow = paint('33')
const magenta = paint('35')
const dim = paint('2')

const groups = [
  ['💻 LOCAL', cyan, [
    ['npm run dev', 'Chạy Web :5175 và API :3001.'],
    ['npm run client', 'Chỉ chạy frontend Vite.'],
    ['npm run server', 'Chỉ chạy Express API.'],
    ['npm run build', 'Build production và tạo asset .br/.gz.'],
    ['npm run stats', 'Xem thống kê lượt truy cập IP và lịch sử dùng công cụ.'],
    ['npm run test:telegram', 'Kiểm tra kết nối và gửi tin nhắn test Telegram Bot.'],
  ]],
  ['🧪 CHẤT LƯỢNG', green, [
    ['npm run verify', 'Cổng chuẩn trước commit/push.'],
    ['npm run test:browser-tools', 'Test QR, ZIP, URL, dung lượng và vùng che.'],
    ['npm run test:smoke', 'Test production server và API thật; cần build trước.'],
    ['npm run audit:prod', 'Quét lỗ hổng dependency production.'],
  ]],
  ['🔄 GIT HAI MÁY', yellow, [
    ['git status', 'Kiểm tra nhánh và thay đổi local.'],
    ['git pull --ff-only', 'Nhận commit mới, không tự merge.'],
    ['npm ci', 'Cài đúng dependency trong lockfile.'],
  ]],
  ['🚀 VPS', magenta, [
    ['npm run status:vps', 'So sánh Mac, GitHub, VPS và public health.'],
    ['npm run deploy:vps', 'Deploy release đã push, có health/rollback.'],
    ['npm run monitor:vps', 'Xem CPU, RAM, disk, app và Nginx.'],
    ['npm run monitor:vps -- --watch 5', 'Tự làm mới trạng thái mỗi 5 giây.'],
    ['npm run maintenance:vps -- status', 'Xem trạng thái bảo trì.'],
  ]],
]

console.log(`\n${bold('🧰 PDFTools — Bảng lệnh nhanh')}`)
console.log(dim('─'.repeat(74)))
for (const [title, color, commands] of groups) {
  console.log(`\n${bold(color(title))}`)
  for (const [command, description] of commands) {
    console.log(`  ${green(command.padEnd(38))} ${description}`)
  }
}
console.log(`\n${dim('Chi tiết và quy trình VPS: README.md · deploy/README.md')}\n`)
