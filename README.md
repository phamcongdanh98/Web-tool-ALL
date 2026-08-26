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

## ✨ Chức năng

| Nhóm | Công cụ |
| --- | --- |
| 📄 **PDF** | Chỉnh overlay, nén đặt MB/không mất dữ liệu, ghép, sắp xếp, tách, PDF → Word/Excel/PowerPoint/TXT. |
| 🖼️ **Hình ảnh** | Xóa nền AI, đổi định dạng, resize, crop kéo-thả, nén, chỉnh màu/xoay/lật và che thông tin. |
| 🧰 **Tiện ích** | Tạo/đọc QR cục bộ và đổi tên tối đa 100 tệp rồi tải ZIP. |

Có **20 thẻ công cụ, 19 công cụ sẵn sàng**. Link rút gọn vẫn ở giai đoạn nghiên cứu vì chưa có database, chống lạm dụng và backup bền vững.

Xem [DIAGRAMS.md](DIAGRAMS.md) để đọc sơ đồ hoạt động và [ROADMAP.md](ROADMAP.md) để biết hạng mục đang nghiên cứu.

## 🚀 Bắt đầu nhanh trên Mac

```bash
git clone https://github.com/phamcongdanh98/Web-tool-ALL.git
cd Web-tool-ALL
npm ci
npm run dev
```

| Lệnh | Ý nghĩa |
| --- | --- |
| `npm ci` | Cài đúng dependency trong `package-lock.json`; dùng sau khi clone hoặc đổi máy. |
| `npm run dev` | Chạy đồng thời Web `5175` và API `3001`. |
| `Control + C` | Dừng đúng tiến trình đang chạy trong Terminal. |

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

## ⚡ Bảng lệnh nhanh

```bash
npm run help
```

Lệnh trên hiển thị bảng lệnh có màu ngay trong Terminal. Các lệnh quan trọng nhất:

| Lệnh | Tác dụng |
| --- | --- |
| `npm run verify` | Cổng chuẩn trước commit: syntax, sơ đồ, shell, browser tools, build, smoke và E2E API. |
| `npm run build` | Build production và tạo asset Brotli/Gzip. |
| `npm run audit:prod` | Quét dependency production mức `high`; không nằm trong `verify`. |
| `npm run status:vps` | So sánh Mac, GitHub, VPS, release đang chạy và public health. |
| `npm run deploy:vps` | Deploy release bất biến; có preflight, health check và rollback. |
| `npm run monitor:vps` | Xem CPU, RAM, disk, process, Nginx và health. |
| `npm run maintenance:vps -- status` | Xem website có đang ở chế độ bảo trì hay không. |

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

- `git status`: xem nhánh và thay đổi local.
- `git pull --ff-only`: nhận commit mới mà không tự tạo merge commit.
- `git diff --cached`: kiểm tra chính xác nội dung sắp commit.
- Không commit `.env`, key SSH, `node_modules`, `dist` hoặc dữ liệu người dùng.

</details>

<details>
<summary><b>🚀 Deploy, giám sát và bảo trì VPS</b></summary>

Deploy hằng ngày:

```bash
npm run status:vps
npm run deploy:vps
npm run status:vps
```

Theo dõi tài nguyên:

```bash
npm run monitor:vps
npm run monitor:vps -- --watch 5
```

Điều khiển bảo trì thủ công:

```bash
npm run maintenance:vps -- status
npm run maintenance:vps -- on
npm run maintenance:vps -- off
```

Deploy bình thường vẫn phục vụ release cũ trong lúc chuẩn bị release mới, vì vậy thường **không cần bật bảo trì**.

Một số lệnh SSH chẩn đoán:

```bash
ssh orace 'uptime'
ssh orace 'free -m'
ssh orace 'systemctl status pdftools --no-pager'
ssh orace 'journalctl -u pdftools -n 100 --no-pager'
ssh orace 'curl -fsS http://127.0.0.1:3001/api/health'
```

</details>

<details>
<summary><b>🏗️ Cài VPS/domain lần đầu</b></summary>

Chỉ chạy khi tạo máy chủ mới hoặc chủ động đổi Nginx/systemd/firewall:

```bash
ssh orace 'cd /var/www/pdftools && sudo ./deploy/setup-ubuntu.sh'
```

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

```text
src/App.jsx                 Giao diện chính và luồng PDF/ảnh
src/UtilityTools.jsx        QR, đổi tên hàng loạt, che thông tin ảnh
src/i18n.jsx                Ngôn ngữ Việt/Anh và metadata
src/styles.css              Design system và responsive layout
server.js                   Express API xử lý ảnh/PDF
lib/                        Engine Office/PPTX và helper dùng chung
scripts/                    Verify, E2E, smoke, help và precompress
deploy/                     Release, Nginx, systemd, monitor, bảo trì
```

- Node.js chuẩn: **22.12 trở lên**.
- Tổng request API: **50 MB**; nén PDF: **50 MB/tệp**; công cụ khác: **25 MB/tệp**.
- PDF tối đa **500 trang**, ảnh tối đa **30 megapixel**, tối đa **2 tác vụ API** cùng lúc.
- QR và đổi tên chạy trong browser. Ảnh/PDF gọi API không tạo kho lưu trữ lâu dài.

</details>

## 💬 Liên hệ

- Facebook: [Danh Phạm](https://www.facebook.com/danhpham100898)
- Zalo: [0356 719 463](https://zalo.me/0356719463)
- Telegram: [0356 719 463](https://t.me/+84356719463)

## 📝 Nhật ký phiên bản

<details open>
<summary><b>✨ v1.1.1 · 2026-08-26 — Giao diện, song ngữ và vận hành</b></summary>

- Thêm giao diện Việt/Anh toàn diện; lưu lựa chọn, đồng bộ metadata và dịch trạng thái xử lý.
- Cân lại scale riêng cho `1366×768`, Full HD và `2560×1440`: chữ, icon, card, header, hero, footer và modal tăng theo không gian nhưng mobile không tràn ngang.
- Nâng tương phản chữ phụ, focus ô tìm kiếm, hiệu ứng card/icon và kích thước control trên màn hình lớn.
- Thêm `Esc` đóng modal, **Xử lý tệp khác**, tiến độ nén/Word song ngữ và cleanup URL/preview khi reset.
- Thêm security headers cho Express và test E2E để giữ cấu hình này.
- Thêm `npm run help`; README được rút gọn, còn hướng dẫn Git/VPS trong các mục thu gọn.
- Giữ splash cinematic 6,7 giây, nhận diện **Danh Phạm** ở khu vực creator/footer và bản dựng tự lấy từ Git.
- Kiểm thử: `npm run verify` đã qua production build, asset Brotli/Gzip, deploy portability, browser utilities, smoke server và E2E API ảnh/PDF thật.

</details>

<details>
<summary><b>📜 Các mốc trước</b></summary>

- **v1.1.0 · 2026-08-26:** Hoàn thiện song ngữ, splash cinematic và nhận diện cá nhân có kiểm soát.
- **v1.0.0 · 2026-08-25:** Ra mắt các công cụ PDF/ảnh, QR, đổi tên ZIP, che thông tin và quy trình deploy VPS.

</details>

---

Phát triển bởi **Danh Phạm** · Phiên bản lấy từ `package.json` · Bản dựng lấy tự động từ lịch sử Git.
