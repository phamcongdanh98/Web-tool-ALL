#!/usr/bin/env node

const bold = text => `\x1b[1m${text}\x1b[0m`
const cyan = text => `\x1b[36m${text}\x1b[0m`
const green = text => `\x1b[32m${text}\x1b[0m`
const yellow = text => `\x1b[33m${text}\x1b[0m`
const magenta = text => `\x1b[35m${text}\x1b[0m`
const dim = text => `\x1b[2m${text}\x1b[0m`

const commandGroups = [
  {
    title: '💻 PHÁT TRIỂN & CHẠY LOCAL',
    color: cyan,
    items: [
      { cmd: 'npm run dev', desc: 'Chạy đồng thời Web (cổng 5176) và API Express (cổng 3002).' },
      { cmd: 'npm run client', desc: 'Chỉ chạy frontend Vite (mặc định cổng 5176).' },
      { cmd: 'npm run server', desc: 'Chỉ chạy backend Express (mặc định cổng 3002).' },
      { cmd: 'npm start', desc: 'Khởi chạy server Express ở chế độ production.' },
      { cmd: 'npm run preview', desc: 'Xem thử bản build production trên trình duyệt.' },
    ],
  },
  {
    title: '🧪 KIỂM THỬ & KIỂM TRA CHẤT LƯỢNG',
    color: green,
    items: [
      { cmd: 'npm run verify', desc: 'Cổng kiểm tra chuẩn: syntax, diagrams, shell, deploy, build và E2E smoke test.' },
      { cmd: 'npm run test:browser-tools', desc: 'Kiểm tra tiện ích browser: QR round-trip, ZIP đổi tên, formatBytes, redaction.' },
      { cmd: 'npm run test:smoke', desc: 'Chạy smoke test Express, asset nén Brotli/Gzip và E2E API thật.' },
      { cmd: 'npm run test:deploy', desc: 'Kiểm tra tính tương thích GNU awk trên Ubuntu và gói tar không xattr.' },
      { cmd: 'npm run check:diagrams', desc: 'Đối chiếu danh sách công cụ trong App.jsx với sơ đồ DIAGRAMS.md.' },
      { cmd: 'npm run check:shell', desc: 'Kiểm tra cú pháp toàn bộ shell script trong thư mục deploy/ và scripts/.' },
      { cmd: 'npm run audit:prod', desc: 'Quét lỗ hổng bảo mật của dependency production.' },
    ],
  },
  {
    title: '📦 ĐÓNG GÓI BẢN DỰNG',
    color: yellow,
    items: [
      { cmd: 'npm run build', desc: 'Build frontend Vite và nén trước tài nguyên tĩnh (.br / .gz).' },
    ],
  },
  {
    title: '🚀 VẬN HÀNH & TRIỂN KHAI VPS',
    color: magenta,
    items: [
      { cmd: 'npm run deploy:vps', desc: 'Build và triển khai release zero-downtime lên máy chủ Ubuntu.' },
      { cmd: 'npm run status:vps', desc: 'So sánh commit giữa Mac, GitHub, VPS release và public health.' },
      { cmd: 'npm run monitor:vps', desc: 'Chụp thông số CPU, RAM, disk, tiến trình, Nginx và health qua SSH.' },
      { cmd: 'npm run maintenance:vps', desc: 'Bật/tắt hoặc kiểm tra trang bảo trì thủ công (status | on | off).' },
    ],
  },
  {
    title: '📖 TRỢ GIÚP',
    color: cyan,
    items: [
      { cmd: 'npm run help', desc: 'Hiển thị danh sách tất cả các lệnh và hướng dẫn sử dụng.' },
    ],
  },
]

console.log(`\n${bold('🧰 PDFTools — BẢNG TRA CỨU CÁC LỆNH DỰ ÁN')}`)
console.log(dim('═'.repeat(68)))

for (const group of commandGroups) {
  console.log(`\n${bold(group.color(group.title))}`)
  for (const { cmd, desc } of group.items) {
    const paddedCmd = cmd.padEnd(28, ' ')
    console.log(`  ${green(paddedCmd)} ${desc}`)
  }
}

console.log(`\n${dim('═'.repeat(68))}`)
console.log(`${dim('💡 Mẹo: Chạy')} ${cyan('npm run verify')} ${dim('trước khi commit/push code để đảm bảo mọi bài test đều qua.')}\n`)
