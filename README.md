# 🧰 PDFTools — Công Cụ Web

<p>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=111827" alt="React 18" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite 6" />
  <img src="https://img.shields.io/badge/Node.js-22.12%2B-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js 22.12+" />
  <img src="https://img.shields.io/badge/Ngôn_ngữ-VI_%2F_EN-4F46E5?style=flat-square" alt="Vietnamese and English" />
  <img src="https://img.shields.io/badge/Production-Nginx-009639?style=flat-square&logo=nginx&logoColor=white" alt="Nginx" />
</p>

Bộ công cụ song ngữ Việt/Anh để xử lý PDF, hình ảnh, QR và tệp. Tác vụ nhẹ chạy ngay trong trình duyệt; tác vụ ảnh/PDF gọi Express API và chỉ xử lý tạm trong bộ nhớ.

> [!TIP]
> 💻 **Local:** [http://localhost:5175](http://localhost:5175) · API `127.0.0.1:3001`<br>
> 🌐 **Website:** [https://congcuweb.duckdns.org](https://congcuweb.duckdns.org)

🧭 **Đi nhanh:** [Chức năng](#-chức-năng) · [Chạy local](#-bắt-đầu-nhanh-trên-mac) · [Thống kê & Telegram](#-thống-kê--telegram-bot) · [Bảng lệnh](#-bảng-lệnh-nhanh) · [Deploy VPS](#-quy-trình-hằng-ngày) · [Nhật ký](#-nhật-ký-phiên-bản)

## ✨ Chức năng

| Nhóm | Công cụ nổi bật | Trạng thái |
| :--- | :--- | :---: |
| 📄 **PDF** | Chỉnh overlay, nén đặt MB/không mất dữ liệu, ghép, sắp xếp, tách, PDF → Word/Excel/PowerPoint/TXT | ✅ Sẵn sàng |
| 🖼️ **Hình ảnh** | Xóa nền AI, đổi định dạng, resize, crop kéo-thả, nén, chỉnh màu/xoay/lật và che thông tin | ✅ Sẵn sàng |
| 🧰 **Tiện ích** | Tạo/đọc QR cục bộ và đổi tên tối đa 100 tệp rồi tải ZIP | ✅ Sẵn sàng |
| 🔗 **Link rút gọn** | Database bền vững, chống spam và quản lý vòng đời liên kết | 🧪 Đang nghiên cứu |

Có **20 thẻ công cụ, 19 công cụ sẵn sàng**. Link rút gọn vẫn ở giai đoạn nghiên cứu vì chưa có database, chống lạm dụng và backup bền vững.

Xem [DIAGRAMS.md](DIAGRAMS.md) để đọc sơ đồ hoạt động và [ROADMAP.md](ROADMAP.md) để biết hạng mục đang nghiên cứu.

## 🚀 Bắt đầu nhanh trên Mac

```bash
git clone https://github.com/phamcongdanh98/Web-tool-ALL.git
cd Web-tool-ALL
npm ci
npm run dev
```

| Icon | Lệnh | Giải thích ngắn | Khi nào dùng? |
| :---: | :--- | :--- | :--- |
| 📦 | `npm ci` | Cài đúng dependency đã khóa trong `package-lock.json` | Sau khi clone, pull có đổi dependency hoặc chuyển máy |
| ▶️ | `npm run dev` | Chạy đồng thời Web `5175` và API `3001` | Khi phát triển và thử trên Mac |
| 🛑 | `Control + C` | Dừng mềm tiến trình đang chạy trong Terminal | Khi không dùng localhost nữa |

Website chạy thành công khi Terminal hiện:

```text
Local: http://localhost:5175/
ToolHub listening on http://127.0.0.1:3001
```

Nếu báo `EADDRINUSE`, tìm đúng tiến trình đang giữ cổng rồi dừng mềm:

```bash
lsof -nP -iTCP:5175 -sTCP:LISTEN
lsof -nP -iTCP:3001 -sTCP:LISTEN
kill <PID>
```

| Lệnh | Ý nghĩa |
| :--- | :--- |
| `lsof ... :5175` | Tìm PID của giao diện Vite đang giữ cổng `5175` |
| `lsof ... :3001` | Tìm PID của Express API đang giữ cổng `3001` |
| `kill <PID>` | Yêu cầu đúng tiến trình dừng an toàn; thay `<PID>` bằng số vừa tìm được |

## 📊 Thống kê & Telegram Bot

Dự án tích hợp sẵn hệ thống theo dõi lượt truy cập IP và bot Telegram quản trị 2 chiều hoàn toàn tự động, nhẹ nhàng và an toàn.

### 1. Thống kê lượt truy cập IP & Công cụ
- **Ghi nhận tự động:** Lưu trữ địa chỉ IP, thời gian, tên công cụ, kích thước tệp và kết quả (cả API phía máy chủ lẫn công cụ chạy trên trình duyệt).
- **Lưu trữ kép:** Dữ liệu giữ trong bộ nhớ đệm (In-memory) để truy vấn tức thời $O(1)$ và lưu file bền vững tại `data/analytics.jsonl`.
- **Kiểm tra trên Terminal:**
  ```bash
  npm run stats                      # Xem tổng quan, top công cụ, top IP và nhật ký
  npm run stats -- --ip 1.2.3.4       # Lọc riêng theo một địa chỉ IP
  npm run stats -- --tool pdf-to-word # Lọc riêng theo tên công cụ
  npm run stats -- --limit 50        # Số dòng nhật ký hiển thị
  ```
- **Kiểm tra trên Giao diện Web:** Nhấp nút **📊 Thống kê** trên Header hoặc Footer để mở Dashboard trực quan (xem thẻ KPI, bảng xếp hạng và lọc trực tiếp).

### 2. Quản lý qua Telegram Bot 2 chiều
- **Thông báo tức thì (Live Alert):** Bot tự động gửi tin nhắn báo về Telegram mỗi khi có người dùng công cụ (kèm IP, công cụ, dung lượng, trạng thái).
- **Báo cáo định kỳ:** Tự động tổng kết số liệu ngày vào 22:00 mỗi tối.
- **Tương tác lệnh 2 chiều (Long-Polling):** Nhắn tin trực tiếp cho bot từ điện thoại mọi lúc mọi nơi (không cần mở thêm port):
  - `/stats` — Xem tổng quan truy cập & lượt dùng
  - `/today` — Tình hình hoạt động hôm nay
  - `/top` — Top 5 công cụ & Top 5 địa chỉ IP
  - `/recent` — 8 hoạt động mới nhất
  - `/ping` — Kiểm tra thời gian chạy (Uptime) & RAM
  - `/help` — Danh sách lệnh hỗ trợ
- **Kích hoạt nhanh trong `.env`:**
  ```env
  TELEGRAM_BOT_TOKEN=123456789:AAFn... # Lấy từ @BotFather
  TELEGRAM_CHAT_ID=123456789           # Lấy từ @userinfobot
  ```
- **Kiểm tra kết nối Bot:**
  ```bash
  npm run test:telegram
  ```

## ⚡ Bảng lệnh nhanh

```bash
npm run help
```

Lệnh trên hiển thị bảng lệnh có màu ngay trong Terminal. Các lệnh quan trọng nhất:

| Icon | Lệnh | Làm gì? | Nên dùng khi nào? |
| :---: | :--- | :--- | :--- |
| 🧭 | `npm run help` | Hiện bảng lệnh có màu ngay trong Terminal | Khi quên lệnh hoặc mới mở dự án |
| 🧪 | `npm run verify` | Kiểm tra syntax, sơ đồ, shell, browser tools, build, smoke và E2E API | **Luôn chạy trước commit/push** |
| 📊 | `npm run stats` | Xem thống kê lượt truy cập IP, top công cụ và nhật ký hoạt động | Khi kiểm tra lưu lượng hoặc tra cứu IP |
| 🤖 | `npm run test:telegram` | Kiểm tra kết nối và gửi tin nhắn thử nghiệm tới Telegram Bot | Sau khi điền token/chat ID trong `.env` |
| 🏗️ | `npm run build` | Tạo bản production cùng asset Brotli/Gzip | Khi cần kiểm tra riêng quá trình build |
| 🛡️ | `npm run audit:prod` | Quét dependency production từ mức `high` | Khi kiểm tra bảo mật hoặc đổi dependency |
| 🔎 | `npm run status:vps` | So sánh Mac, GitHub, repository VPS, release và public health | Trước và sau deploy |
| 🚀 | `npm run deploy:vps` | Đưa commit sạch lên VPS, kiểm tra health và tự rollback khi lỗi | Sau khi push `main` và CI xanh |
| 📊 | `npm run monitor:vps` | Xem CPU, RAM, swap, disk, process, Nginx và health | Khi VPS chậm hoặc cần theo dõi tài nguyên |
| 🚧 | `npm run maintenance:vps -- status` | Kiểm tra trạng thái trang bảo trì | Trước khi bật/tắt bảo trì thủ công |

## 🔄 Quy trình hằng ngày

```text
git status → git pull --ff-only → npm ci → sửa code → npm run verify
→ commit → push → CI xanh → npm run status:vps → npm run deploy:vps
```

> [!IMPORTANT]
> Chỉ deploy commit `main` sạch, đã push lên GitHub. Không sửa source trực tiếp trên VPS và không làm đồng thời cùng một nhánh trên hai máy.

<details>
<summary><b>🔄 Git và làm việc trên hai máy</b></summary>

```bash
git status
git pull --ff-only
npm ci
```

Trước khi đưa code lên GitHub:

```bash
git diff
npm run verify
git add <file-can-commit>
git diff --cached
git commit -m "feat: mo ta thay doi"
git push origin main
```

| Icon | Lệnh | Giải thích |
| :---: | :--- | :--- |
| 👀 | `git status` | Xem đúng nhánh và các thay đổi local chưa commit |
| ⬇️ | `git pull --ff-only` | Nhận commit mới mà không tự tạo merge commit |
| 🔍 | `git diff` | Xem thay đổi hiện tại trước khi stage |
| ✅ | `npm run verify` | Chạy cổng chất lượng của dự án |
| 📥 | `git add <file>` | Chỉ đưa file có chủ đích vào commit |
| 🧐 | `git diff --cached` | Kiểm tra chính xác nội dung sắp commit |
| 📌 | `git commit -m "..."` | Tạo mốc lịch sử local có mô tả rõ ràng |
| ☁️ | `git push origin main` | Đồng bộ commit lên GitHub để máy khác/VPS có thể nhận |

> [!CAUTION]
> 🔐 Không commit `.env`, key SSH, `node_modules`, `dist` hoặc dữ liệu người dùng.

</details>

<details>
<summary><b>🚀 Deploy, giám sát và bảo trì VPS</b></summary>

Deploy hằng ngày:

```bash
npm run status:vps
npm run deploy:vps
npm run status:vps
```

| Bước | Lệnh | Mục đích |
| :---: | :--- | :--- |
| 1️⃣ | `npm run status:vps` | Xác nhận GitHub, VPS và release hiện tại trước khi đổi |
| 2️⃣ | `npm run deploy:vps` | Upload artifact, chuyển release an toàn và kiểm tra health |
| 3️⃣ | `npm run status:vps` | Xác nhận website đang chạy đúng commit mới |

Theo dõi tài nguyên:

```bash
npm run monitor:vps
npm run monitor:vps -- --watch 5
```

| Lệnh | Chế độ |
| :--- | :--- |
| `npm run monitor:vps` | Chụp trạng thái tài nguyên một lần |
| `npm run monitor:vps -- --watch 5` | Làm mới CPU/RAM/disk/health mỗi 5 giây |

Điều khiển bảo trì thủ công:

```bash
npm run maintenance:vps -- status
npm run maintenance:vps -- on
npm run maintenance:vps -- off
```

| Lệnh | Kết quả |
| :--- | :--- |
| `... -- status` | Chỉ đọc trạng thái, không thay đổi website |
| `... -- on` | Bật trang bảo trì HTTP 503 |
| `... -- off` | Tắt bảo trì và phục vụ website bình thường |

Deploy bình thường vẫn phục vụ release cũ trong lúc chuẩn bị release mới, vì vậy thường **không cần bật bảo trì**.

Một số lệnh SSH chẩn đoán:

| Icon | Lệnh | Kiểm tra |
| :---: | :--- | :--- |
| ⏱️ | `ssh orace 'uptime'` | Thời gian chạy và load average |
| 🧠 | `ssh orace 'free -m'` | RAM và swap theo MB |
| ⚙️ | `ssh orace 'systemctl status pdftools --no-pager'` | Trạng thái tiến trình PDFTools |
| 📜 | `ssh orace 'journalctl -u pdftools -n 100 --no-pager'` | 100 dòng log gần nhất |
| ❤️ | `ssh orace 'curl -fsS http://127.0.0.1:3001/api/health'` | Health API nội bộ |

</details>

<details>
<summary><b>🏗️ Cài VPS/domain lần đầu</b></summary>

Chỉ chạy khi tạo máy chủ mới hoặc chủ động đổi Nginx/systemd/firewall:

```bash
ssh orace 'cd /var/www/pdftools && sudo ./deploy/setup-ubuntu.sh'
```

| Trường hợp | Cách dùng |
| :--- | :--- |
| 🆕 VPS mới hoặc đổi hạ tầng | Chạy `setup-ubuntu.sh` một lần; script có thể chạy lặp an toàn |
| 🔒 Apt đang bận | Chờ tự động với `APT_LOCK_TIMEOUT_SECONDS=900`; không xóa lock hoặc kill apt |
| 🌐 DNS đã trỏ đúng | Chạy `configure-domain.sh`, sau đó kiểm tra gia hạn Certbot |

Nếu Ubuntu đang giữ khóa apt:

```bash
ssh orace 'cd /var/www/pdftools && sudo APT_LOCK_TIMEOUT_SECONDS=900 ./deploy/setup-ubuntu.sh'
```

Sau khi DNS trỏ đúng IP và firewall mở `80/443`:

```bash
cd /var/www/pdftools
sudo ./deploy/configure-domain.sh ten-mien-cua-ban email-cua-ban
sudo /usr/local/bin/certbot renew --dry-run
```

Chi tiết hạ tầng và rollback: [deploy/README.md](deploy/README.md).

</details>

<details>
<summary><b>🗂️ Kiến trúc, giới hạn và riêng tư</b></summary>

| Khu vực | Vai trò |
| :--- | :--- |
| 🎨 `src/App.jsx` | Giao diện chính và luồng PDF/ảnh |
| 🧰 `src/UtilityTools.jsx` | QR, đổi tên hàng loạt và che thông tin ảnh |
| 🌐 `src/i18n.jsx` | Ngôn ngữ Việt/Anh và metadata |
| 💅 `src/styles.css` | Design system và responsive layout |
| 🖥️ `server.js` | Express API xử lý ảnh/PDF |
| ⚙️ `lib/` | Engine Office/PPTX và helper dùng chung |
| 🧪 `scripts/` | Verify, E2E, smoke, help và precompress |
| 🚀 `deploy/` | Release, Nginx, systemd, monitor và bảo trì |

| Giới hạn | Giá trị |
| :--- | :--- |
| 🟢 Runtime | Node.js **22.12 trở lên** |
| 📦 Tổng request API | **50 MB/lượt** |
| 📄 Nén PDF | **50 MB/tệp**, tối đa **500 trang** |
| 🗂️ Công cụ khác | **25 MB/tệp** |
| 🖼️ Ảnh | Tối đa **30 megapixel** |
| ⚡ Đồng thời | Tối đa **2 tác vụ API** |
| 🔐 Riêng tư | QR/đổi tên chạy trong browser; API không tạo kho lưu trữ lâu dài |

</details>

## 💬 Liên hệ

| Kênh | Liên hệ |
| :---: | :--- |
| 🔵 **Facebook** | [Danh Phạm ↗](https://www.facebook.com/danhpham100898) |
| 🟢 **Zalo** | [0356 719 463 ↗](https://zalo.me/0356719463) |
| 🔷 **Telegram** | [0356 719 463 ↗](https://t.me/+84356719463) |

## 📝 Nhật ký phiên bản

<details open>
<summary><b>✨ v1.1.2 · 2026-09-02 — Thống kê IP và Quản trị Telegram Bot 2 chiều</b></summary>

| Hạng mục | Thay đổi |
| :--- | :--- |
| 📊 **Thống kê IP** | Module `lib/analytics.js` tự động bóc tách IP qua proxy/Nginx, ghi nhận lượt truy cập web và mọi lượt dùng công cụ (cả API và client-side) |
| 💾 **Lưu trữ kép** | In-Memory buffer 2,000 sự kiện siêu tốc kết hợp file log JSON Lines `data/analytics.jsonl` bền vững qua restart/deploy |
| 💻 **Lệnh CLI** | Thêm lệnh `npm run stats` với định dạng bảng màu sắc trực quan, hỗ trợ cờ lọc `--ip`, `--tool`, `--limit`, `--json` |
| 🌐 **Dashboard UI** | Thêm modal Thống kê hoạt động trực quan (`StatsDashboard.jsx`) với 4 thẻ KPI, 3 tab số liệu và bộ lọc tìm kiếm |
| 🤖 **Telegram Bot** | Module `lib/telegram.js` đẩy thông báo tức thì khi có người dùng công cụ, báo cáo định kỳ 22h và nhận lệnh tương tác (`/stats`, `/today`, `/top`, `/recent`, `/ping`, `/help`) |
| 🧪 **Kiểm thử** | Thêm lệnh `npm run test:telegram`; cập nhật `npm run verify` kiểm tra toàn bộ cú pháp và tích hợp |

</details>

<details>
<summary><b>📜 v1.1.1 · 2026-08-26 — Giao diện, song ngữ và vận hành</b></summary>

| Hạng mục | Thay đổi |
| :--- | :--- |
| 🌐 **Song ngữ** | Hoàn thiện giao diện Việt/Anh, lưu lựa chọn, đồng bộ metadata và dịch trạng thái xử lý |
| 🖥️ **Responsive** | Cân scale cho `1366×768`, Full HD và `2560×1440`; chữ, icon, card, header, hero, footer và modal tăng hợp lý mà mobile không tràn |
| 🎨 **Trải nghiệm** | Tăng tương phản, focus ô tìm kiếm, hiệu ứng card/icon và kích thước control màn hình lớn |
| ⌨️ **Thao tác** | Thêm `Esc` đóng modal, **Xử lý tệp khác**, tiến độ nén/Word song ngữ và cleanup URL/preview |
| 🛡️ **Bảo mật** | Thêm security headers cho Express và E2E giữ cấu hình |
| 🧭 **Tài liệu** | Thêm `npm run help`; README dùng bảng lệnh, icon trực quan, hướng dẫn thu gọn và nhật ký rõ ràng |
| ✨ **Thương hiệu** | Giữ splash cinematic 6,7 giây, **Danh Phạm** tại creator/footer và bản dựng tự lấy từ Git |
| ✅ **Kiểm thử** | `npm run verify` qua build production, Brotli/Gzip, deploy portability, browser utilities, smoke và E2E API ảnh/PDF thật |

</details>

<details>
<summary><b>📜 Các mốc trước</b></summary>

| Phiên bản | Ngày | Nội dung chính |
| :---: | :---: | :--- |
| 🟣 **v1.1.0** | 2026-08-26 | Hoàn thiện song ngữ, splash cinematic và nhận diện cá nhân có kiểm soát |
| 🟢 **v1.0.0** | 2026-08-25 | Ra mắt công cụ PDF/ảnh, QR, đổi tên ZIP, che thông tin và quy trình deploy VPS |

</details>

---

Phát triển bởi **Danh Phạm** · Phiên bản lấy từ `package.json` · Bản dựng lấy tự động từ lịch sử Git.
