# 🧰 PDFTools — Bộ Công Cụ Tài Liệu Trực Tuyến

<p align="left">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=111827" alt="React 18" />
  <img src="https://img.shields.io/badge/Vite-6.4-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite 6" />
  <img src="https://img.shields.io/badge/Node.js-22.12%2B-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js 22+" />
  <img src="https://img.shields.io/badge/Express-4.21-000000?style=flat-square&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/Nginx-Production-009639?style=flat-square&logo=nginx&logoColor=white" alt="Nginx" />
  <img src="https://img.shields.io/badge/Song_ngữ-VI_%2F_EN-4F46E5?style=flat-square" alt="Bilingual VI/EN" />
</p>

Ứng dụng web hiện đại, song ngữ Việt/Anh hỗ trợ xử lý toàn diện các tác vụ PDF, hình ảnh, mã QR và tệp tin nhanh chóng, bảo mật ngay trên trình duyệt hoặc API bộ nhớ trong.

> [!TIP]
> 🌐 **Website trực tuyến:** [https://congcuweb.duckdns.org](https://congcuweb.duckdns.org)  
> 💻 **Môi trường phát triển:** [http://localhost:5176](http://localhost:5176) *(API: `http://localhost:3002`)*

---

## ✨ 20 Công Cụ Sẵn Sàng

| Nhóm | Công cụ nổi bật | Cơ chế xử lý |
|---|---|---|
| 📄 **PDF** | • **Chỉnh sửa PDF**: Thêm lớp chữ Unicode, watermark, đánh số trang theo tọa độ.<br>• **Nén PDF**: Tự động tinh chỉnh 4 lượt đạt dung lượng mục tiêu (DPI + Quality) hoặc tối ưu không mất dữ liệu.<br>• **Ghép / Sắp xếp / Tách PDF**: Kéo thả thumbnail, xoay, nhân bản, xóa và tải ZIP.<br>• **PDF sang Office**: Chuyển đổi sang Word (DOCX có cấu trúc/giữ vị trí), Excel (XLSX), PowerPoint (PPTX), Văn bản (TXT). | Browser + API in-memory (`pdf-lib`, `pdfjs-dist`, `docx`, `exceljs`) |
| 🖼️ **Hình ảnh** | • **Xóa phông nền AI**: Tự động tách nền với preview trong suốt.<br>• **Che thông tin**: Kéo vùng che đặc bảo vệ dữ liệu nhạy cảm, loại bỏ EXIF/GPS.<br>• **Chuyển đổi / Nén / Cắt / Đổi cỡ**: Hỗ trợ WebP, JPG, PNG, AVIF với preview thời gian thực. | AI On-Device (`@imgly`) + Sharp API |
| 🧰 **Tiện ích** | • **Tạo & Đọc mã QR**: Tạo QR kiểm tra độ tương phản, đọc QR từ ảnh an toàn (không tự mở URL).<br>• **Đổi tên hàng loạt**: Đổi tên tối đa 100 tệp theo mẫu `{name}-{n}` và tải về file ZIP. | Client-side 100% (Riêng tư tuyệt đối) |

> 📌 Chi tiết sơ đồ luồng dữ liệu xem tại [**DIAGRAMS.md**](DIAGRAMS.md). Lộ trình nghiên cứu xem tại [**ROADMAP.md**](ROADMAP.md).

---

## 🚀 Bắt Đầu Nhanh

### Yêu cầu môi trường
- **Node.js:** `>= 22.12.0`
- **npm:** Đi kèm Node.js
- **Git:** Quản lý mã nguồn

### Cài đặt và Chạy Local

```bash
# 1. Clone dự án và cài đặt đúng dependencies
git clone https://github.com/phamcongdanh98/Web-tool-ALL.git
cd Web-tool-ALL
npm ci

# 2. Khởi chạy môi trường phát triển
npm run dev
```

Mở trình duyệt tại **[http://localhost:5176](http://localhost:5176)**.

---

## ⚡ Bảng Tra Cứu Lệnh Nhanh (`npm run help`)

Để xem hướng dẫn tất cả các lệnh bất kỳ lúc nào trong terminal:

```bash
npm run help
```

```text
💻 PHÁT TRIỂN & LOCAL
  npm run dev                  Chạy đồng thời Web (cổng 5176) và API Express (cổng 3002).
  npm run client               Chỉ chạy frontend Vite.
  npm run server               Chỉ chạy backend Express.
  npm start                    Khởi chạy server Express ở chế độ production.
  npm run preview              Xem thử bản build production.

🧪 KIỂM THỬ & CHẤT LƯỢNG
  npm run verify               Cổng kiểm tra chuẩn: syntax, diagrams, shell, deploy, build và E2E smoke test.
  npm run test:browser-tools   Kiểm tra tiện ích browser: QR round-trip, ZIP đổi tên, formatBytes.
  npm run test:smoke           Chạy smoke test Express, asset nén Brotli/Gzip và E2E API thật.
  npm run test:deploy          Kiểm tra tính tương thích GNU awk trên Ubuntu và gói tar không xattr.
  npm run check:diagrams       Đối chiếu danh sách công cụ trong code với DIAGRAMS.md.
  npm run check:shell          Kiểm tra cú pháp toàn bộ shell script.
  npm run audit:prod           Quét lỗ hổng bảo mật dependency production.

📦 ĐÓNG GÓI & DEPLOY
  npm run build                Build frontend Vite và nén trước tài nguyên tĩnh (.br / .gz).
  npm run deploy:vps           Build và triển khai release zero-downtime lên VPS Ubuntu.
  npm run status:vps           So sánh commit giữa Mac, GitHub, VPS release và public health.
  npm run monitor:vps          Chụp thông số CPU, RAM, disk, Nginx và health qua SSH.
  npm run maintenance:vps      Bật/tắt hoặc kiểm tra trang bảo trì thủ công (status | on | off).
```

---

## 🔒 Bảo Mật & Giới Hạn Tài Nguyên

- **Xử lý an toàn trong bộ nhớ:** File upload chỉ tồn tại trong RAM tạm thời trong lúc xử lý, không lưu trữ dài hạn trên ổ cứng server.
- **Giới hạn hệ thống:** Tổng request tối đa **50 MB**, file PDF tối đa **500 trang**, tối đa **2 tác vụ đồng thời**, kích thước ảnh tối đa **30 megapixel**.
- **Bảo mật Header & Chống spam:** Tích hợp Security Headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) và bộ giới hạn tần suất request (Rate Limiter).

---

## 🗂️ Cấu Trúc Dự Án

```text
├── src/
│   ├── App.jsx                 Giao diện chính React & bộ điều khiển công cụ
│   ├── UtilityTools.jsx        Modal chuyên biệt cho QR, Đổi tên tệp & Che thông tin
│   ├── i18n.jsx                Context đa ngôn ngữ (Tiếng Việt / English)
│   └── styles.css              Hệ thống CSS Design System & Responsive layout
├── lib/
│   ├── browser-utility.js      Tiện ích xử lý tên file, format dung lượng, URL & tọa độ
│   ├── pdf-office.js           Engine trích xuất cấu trúc PDF → Word, Excel, TXT
│   ├── exact-word.js           Engine dựng Word giữ vị trí tọa độ từng dòng
│   └── pptx.js                 Engine sinh PowerPoint OOXML từ trang PDF
├── deploy/                     Script cấu hình VPS, Nginx, Systemd, Zero-downtime deploy
├── scripts/                    Bộ kiểm thử E2E, Smoke test, Kiểm tra sơ đồ & Nén asset
└── server.js                   Express API trung tâm xử lý PDF & Hình ảnh
```

---

## 💬 Liên Hệ & Tác Giả

Ứng dụng được phát triển và tối ưu bởi **Danh Phạm**.

- **Facebook:** [Danh Phạm](https://www.facebook.com/danhpham100898)
- **Zalo:** `0356 719 463` ([https://zalo.me/0356719463](https://zalo.me/0356719463))
- **Telegram:** `0356 719 463` ([https://t.me/+84356719463](https://t.me/+84356719463))

---

## 📝 Nhật Ký Thay Đổi Gần Đây

### 2026-08-26 (Bản v1.1.1 — Nhánh `codex/claude-gemini`)
- **Tối ưu Dev Server:** Chuyển cổng phát triển sang `5176` (Web) và `3002` (API) để tránh lỗi bận cổng `EADDRINUSE`.
- **Lệnh CLI Trợ Giúp:** Thêm lệnh `npm run help` hiển thị bảng tra cứu lệnh màu sắc trực quan trong terminal.
- **Bảo mật & Rate Limit:** Bổ sung Security Headers chuẩn và Sliding-window Rate Limiter trong `server.js`.
- **Trải nghiệm UX:** Bổ sung phím tắt `ESC` đóng modal, thêm nút `↩ Làm mới` reset nhanh sau khi xử lý, cải thiện cuộn modal trên di động.
- **Đa ngôn ngữ & Sạch mã:** Đồng bộ tiến độ nén/Word song ngữ `(vi, en)`, dùng chung `formatBytes`, dọn cache PDF task tránh rò rỉ RAM.
- **Kiểm định chất lượng:** Toàn bộ test suite (`verify`, `test:browser-tools`, `test:smoke`, `check:diagrams`) đạt 100%.
