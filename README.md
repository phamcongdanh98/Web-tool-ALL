# 🧰 PDFTools

Ứng dụng web tiếng Việt để xử lý PDF, hình ảnh, QR và tệp ngay trên trình duyệt hoặc API nội bộ.

![React 18](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=111827)
![Vite 6](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white)
![Node.js 22+](https://img.shields.io/badge/Node.js-22.12%2B-339933?style=flat-square&logo=node.js&logoColor=white)
![Nginx](https://img.shields.io/badge/Production-Nginx-009639?style=flat-square&logo=nginx&logoColor=white)

> [!TIP]
> 💻 **Local:** [http://localhost:5175](http://localhost:5175) · 🌐 **Website:** [https://congcuweb.duckdns.org](https://congcuweb.duckdns.org)

## ✨ Chức năng

| Nhóm | Công cụ chính |
| --- | --- |
| 📄 **PDF** | Chỉnh sửa overlay, nén đặt MB/không mất dữ liệu, ghép, sắp xếp, tách, PDF → Word/Excel/PowerPoint/TXT. |
| 🖼️ **Hình ảnh** | Xóa nền AI, đổi định dạng, resize, crop kéo-thả, nén, chỉnh màu/xoay/lật và che thông tin bằng khối màu đặc. |
| 🧰 **Tiện ích** | Tạo QR, đọc QR từ ảnh và đổi tên tối đa 100 tệp rồi tải ZIP. |

- QR được tạo/đọc cục bộ, không gửi nội dung lên máy chủ và không tự mở liên kết.
- Che thông tin ảnh cho phép kéo/resize tối đa 20 vùng; Sharp ghi pixel thật vào PNG và loại EXIF/GPS.
- Link rút gọn đang ở trạng thái nghiên cứu, chưa giả lập bằng bộ nhớ tạm vì link sẽ mất sau restart/deploy.
- Footer hiển thị **Danh Phạm**, phiên bản semantic và số bản dựng tự lấy từ lịch sử Git.

> [!NOTE]
> Có **20 thẻ công cụ, 19 công cụ sẵn sàng**. Xem [DIAGRAMS.md](DIAGRAMS.md) để đọc sơ đồ luồng và [ROADMAP.md](ROADMAP.md) để biết hạng mục đang nghiên cứu.

## 🚀 Bắt đầu nhanh trên Mac

### 1. Kiểm tra công cụ

```bash
node --version
npm --version
git --version
```

| Lệnh | Giải thích ngắn |
| --- | --- |
| `node --version` | Phải từ **Node.js 22.12** trở lên. |
| `npm --version` | Xác nhận npm đã đi cùng Node.js. |
| `git --version` | Xác nhận máy đã cài Git. |

### 2. Cài dự án lần đầu

```bash
git clone https://github.com/phamcongdanh98/Web-tool-ALL.git
cd Web-tool-ALL
npm ci
```

| Lệnh | Giải thích ngắn |
| --- | --- |
| `git clone ...` | Tải repository về máy. |
| `cd Web-tool-ALL` | Đi vào thư mục vừa clone. |
| `npm ci` | Cài đúng dependency trong `package-lock.json`, không tự nâng phiên bản. |

Nếu dự án đã nằm ở đường dẫn hiện tại:

```bash
cd "/Users/danhpham/Documents/ChatGPT/Tool Web All"
npm ci
```

### 3. Chạy localhost

```bash
npm run dev
```

Lệnh này chạy đồng thời **Vite `5175`** và **Express API `3001`**. Website đang chạy khi Terminal còn giữ tiến trình và hiện gần giống:

```text
Local: http://localhost:5175/
ToolHub listening on http://127.0.0.1:3001
```

Mở [http://localhost:5175](http://localhost:5175). Nhấn `Control + C` tại đúng Terminal để dừng.

### 4. Nếu cổng đang bị dùng

```bash
lsof -nP -iTCP:5175 -sTCP:LISTEN
lsof -nP -iTCP:3001 -sTCP:LISTEN
kill <PID>
```

| Lệnh | Giải thích ngắn |
| --- | --- |
| `lsof ...5175...` | Tìm PID đang giữ frontend. |
| `lsof ...3001...` | Tìm PID đang giữ API. |
| `kill <PID>` | Dừng mềm đúng PID sau khi đã kiểm tra tên tiến trình. |

Không dùng `kill -9` hoặc tắt mọi tiến trình Node khi chưa xác định đúng PID.

## 📚 Bảng lệnh đầy đủ

### 💻 Chạy ứng dụng

| Lệnh | Tác dụng |
| --- | --- |
| `npm run dev` | Chạy đầy đủ Vite + Express; dùng cho phát triển hằng ngày. |
| `npm run client` | Chỉ chạy Vite; công cụ gọi API sẽ không hoạt động đầy đủ. |
| `npm run server` | Chỉ chạy Express API tại `127.0.0.1:3001`. |
| `npm run build` | Build production vào `dist` và sinh asset `.br`/`.gz`. |
| `npm run start` | Chạy Express production; phải có sẵn thư mục `dist`. |
| `npm run preview` | Chỉ preview frontend Vite; không thay thế `npm run dev`. |

### 🧪 Kiểm tra chất lượng

| Lệnh | Tác dụng |
| --- | --- |
| `npm run verify` | Cổng chuẩn trước commit: syntax, sơ đồ, shell, QR/ZIP, build, smoke và E2E ảnh/PDF thật. |
| `npm run test:browser-tools` | Kiểm tra QR round-trip, ZIP giữ nguyên byte, URL an toàn và tọa độ vùng che. |
| `npm run check:diagrams` | So danh sách/tên công cụ trong code với `DIAGRAMS.md`. |
| `npm run check:shell` | Kiểm tra cú pháp toàn bộ script deploy/monitor/bảo trì. |
| `npm run test:deploy` | Kiểm tra load guard tương thích GNU awk và gói Mac không chứa xattr. |
| `npm run test:smoke` | Cần build trước; chạy production tạm, health, asset nén và E2E API. |
| `npm run audit:prod` | Kiểm tra lỗ hổng dependency production mức `high`; lệnh này **không nằm trong `verify`**. |

## 🔄 Git và làm việc trên hai máy

Trước khi sửa code trên bất kỳ máy nào:

```bash
git status
git pull --ff-only
npm ci
```

| Lệnh | Giải thích ngắn |
| --- | --- |
| `git status` | Xem nhánh và file cục bộ chưa commit. |
| `git pull --ff-only` | Nhận code mới mà không tự tạo merge commit. |
| `npm ci` | Đồng bộ dependency theo lockfile, đặc biệt sau khi đổi máy. |

Quy trình review và đưa code lên GitHub:

```bash
git status
git diff
npm run verify
git add <file-can-commit>
git diff --cached
git commit -m "feat: mo ta thay doi"
git push origin main
```

| Lệnh | Giải thích ngắn |
| --- | --- |
| `git diff` | Xem thay đổi chưa stage. |
| `git add <file-can-commit>` | Stage có chủ đích, tránh đưa nhầm key/`.env`/file cá nhân. |
| `git diff --cached` | Review chính xác nội dung sắp commit. |
| `git commit -m "..."` | Tạo commit; footer sẽ có số bản dựng Git mới. |
| `git push origin main` | Đồng bộ commit lên GitHub. |

> [!IMPORTANT]
> Không làm đồng thời trên cùng nhánh ở hai máy. GitHub là nguồn chuẩn; không sửa source trực tiếp trên VPS.

## 🚀 Deploy code lên website

Luồng ngắn gọn:

```text
verify → commit → push → CI xanh → status:vps → deploy:vps → status:vps
```

```bash
npm run status:vps
npm run deploy:vps
npm run status:vps
```

| Lệnh | Giải thích ngắn |
| --- | --- |
| `npm run status:vps` | Chỉ đọc: so sánh Mac, GitHub, repo VPS, release đang chạy, public health và asset nén. |
| `npm run deploy:vps` | Build ở Mac, checksum/upload, preflight, switch release, restart và tự rollback nếu health lỗi. |
| `PDFTOOLS_SSH_HOST=alias-khac npm run deploy:vps` | Deploy bằng SSH alias khác `orace`. |

`deploy:vps` chỉ nhận nhánh `main` sạch và commit đã trùng `origin/main`. Deploy code hằng ngày **không cần** chạy lại setup Ubuntu.

## 📊 Kiểm tra CPU, RAM và VPS

### Cách tiện nhất

```bash
npm run monitor:vps
npm run monitor:vps -- --watch 5
```

| Lệnh | Giải thích ngắn |
| --- | --- |
| `npm run monitor:vps` | Chụp CPU/load, RAM, swap, disk, process, app, Nginx và health; chỉ đọc. |
| `npm run monitor:vps -- --watch 5` | Tự làm mới sau 5 giây; dừng bằng `Control + C`. |

### Lệnh SSH trực tiếp

| Mục đích | Lệnh |
| --- | --- |
| Vào VPS | `ssh orace` |
| CPU và load | `ssh orace 'uptime'` |
| RAM và swap | `ssh orace 'free -m'` |
| Dung lượng ổ đĩa | `ssh orace 'df -Pm /var/www/pdftools'` |
| Trạng thái app | `ssh orace 'systemctl status pdftools --no-pager'` |
| 100 dòng log app | `ssh orace 'journalctl -u pdftools -n 100 --no-pager'` |
| Trạng thái Nginx | `ssh orace 'systemctl status nginx --no-pager'` |
| Kiểm tra Nginx | `ssh orace 'sudo nginx -t'` |
| Health nội bộ | `ssh orace 'curl -fsS http://127.0.0.1:3001/api/health'` |
| Health public | `curl -fsS https://congcuweb.duckdns.org/api/health` |
| Log các lần deploy | `ssh orace 'tail -n 20 /var/www/pdftools/.deploy/deployments.log'` |

## 🛠️ Chế độ bảo trì

```bash
npm run maintenance:vps -- status
npm run maintenance:vps -- on
npm run maintenance:vps -- off
```

| Lệnh | Giải thích ngắn |
| --- | --- |
| `... status` | Chỉ xem public đang hoạt động hay trả trang bảo trì. |
| `... on` | Bật HTTP 503 thủ công; chỉ dùng khi thật sự cần ngắt website. |
| `... off` | Tắt bảo trì và xác nhận website public hoạt động lại. |

Deploy code thông thường vẫn phục vụ release cũ trong lúc chuẩn bị release mới, vì vậy thường **không cần bật bảo trì**.

## 🏗️ Cài VPS/domain một lần

Chỉ dùng khi cài máy chủ mới hoặc chủ động đổi Nginx/systemd/firewall:

```bash
ssh orace 'cd /var/www/pdftools && sudo ./deploy/setup-ubuntu.sh'
```

Nếu Ubuntu đang chạy `unattended-upgrades` và muốn chờ apt lâu hơn:

```bash
ssh orace 'cd /var/www/pdftools && sudo APT_LOCK_TIMEOUT_SECONDS=900 ./deploy/setup-ubuntu.sh'
```

Sau khi DNS đã trỏ đúng IP và cloud firewall đã mở `80/443`, chạy trên VPS:

```bash
cd /var/www/pdftools
sudo ./deploy/configure-domain.sh ten-mien-cua-ban email-cua-ban
sudo /usr/local/bin/certbot renew --dry-run
```

| Lệnh | Giải thích ngắn |
| --- | --- |
| `setup-ubuntu.sh` | Cài/cập nhật Nginx, systemd, firewall cổng 80 và release đầu; script có thể chạy lặp an toàn. |
| `APT_LOCK_TIMEOUT_SECONDS=900 ...` | Chờ khóa apt tối đa 15 phút; không xóa lock hoặc kill package manager. |
| `configure-domain.sh ...` | Cấu hình domain, Certbot, HTTPS redirect và thử gia hạn. |
| `certbot renew --dry-run` | Kiểm tra chứng chỉ có thể tự gia hạn. |

Chi tiết rollback và cấu hình hạ tầng nằm trong [deploy/README.md](deploy/README.md).

## 🗂️ Cấu trúc dự án

```text
src/App.jsx                 Giao diện chính và các công cụ PDF/ảnh hiện có
src/UtilityTools.jsx        QR, đổi tên hàng loạt và che thông tin ảnh
src/styles.css              Design system và responsive layout
server.js                   Express API xử lý ảnh/PDF
lib/browser-utility.js      Tên tệp, URL và tọa độ vùng che dùng chung
lib/pdf-office.js           PDF → DOCX/XLSX/TXT
lib/exact-word.js           Word giữ vị trí từng dòng
lib/pptx.js                 PowerPoint OOXML có chữ sửa được
scripts/                    Kiểm tra semantic, smoke và precompress
deploy/                     Release, Nginx, systemd, monitor và bảo trì
AGENTS.md                   Quy tắc phát triển và vận hành
DIAGRAMS.md                 Sơ đồ kiến trúc/chức năng/production
ROADMAP.md                  Ý tưởng đã phân loại và điều kiện triển khai
```

## 🔐 Giới hạn và riêng tư

- Tổng request API tối đa **50 MB**, ảnh tối đa **30 megapixel**, PDF tối đa **500 trang**, tối đa **2 tác vụ** cùng lúc.
- Nén PDF nhận riêng tối đa **50 MB/tệp**; công cụ khác mặc định **25 MB/tệp**.
- QR và đổi tên tệp chạy trong browser. Ảnh/PDF gọi API chỉ xử lý trong bộ nhớ, không tạo kho lưu trữ lâu dài.
- Không commit `.env`, private key, nội dung `~/.ssh`, `node_modules`, `dist` hoặc dữ liệu người dùng.

## 💬 Liên hệ

- Facebook: [Danh Phạm](https://www.facebook.com/danhpham100898)
- Zalo: [0356 719 463](https://zalo.me/0356719463)
- Telegram: [0356 719 463](https://t.me/+84356719463)

## 📝 Nhật ký thay đổi gần đây

### 2026-08-26

- Xây dựng hệ nhận diện cá nhân xuyên suốt: `by Danh Phạm` ở header và mọi modal, creator badge trong hero, monogram `DP` trên card, khối giới thiệu người sáng tạo kèm liên hệ và metadata/manifest thống nhất; tên lớn chỉ dùng ở splash và creator showcase để không lấn át công cụ.
- Nâng splash thành chuỗi cảnh 6,7 giây: file PDF phân rã thành dữ liệu, bốn engine khởi động, hội tụ thành **Công Cụ Web**, signature **Danh Phạm** rồi logo bay về header; thêm nút bỏ qua và chế độ giảm chuyển động khoảng 1,3 giây.
- Sửa deploy báo nhầm `load 0.08` là VPS quá tải do dùng tên dựng sẵn `load` của GNU awk; lỗi tính ngưỡng nay được phân biệt với trạng thái quá tải thật.
- Gói frontend từ macOS dùng `tar --no-xattrs`, không còn gửi header `LIBARCHIVE.xattr.com.apple.provenance` lên Ubuntu; thêm `npm run test:deploy` vào cổng `verify`.
- Thêm QR tạo/đọc cục bộ với `qrcode` + `jsqr`; tạo QR có tự đọc lại, đọc QR không tự mở URL.
- Thêm đổi tên tối đa 100 tệp/50 MB, preview tên mới và tải ZIP giữ nguyên byte nội dung.
- Thêm che thông tin ảnh bằng vùng kéo/resize; Sharp làm phẳng màu đặc vào PNG và bỏ EXIF/GPS.
- Gỡ khối giới thiệu mã nguồn/GitHub khỏi footer website chính; giữ thông tin Danh Phạm, phiên bản và liên hệ.
- Viết lại README thành bảng lệnh local, Git, test, CPU/RAM, deploy, bảo trì, setup VPS/domain và giải thích ngắn gọn.
- Dependency mới: `qrcode@1.5.4`, `jsqr@1.4.0`; máy khác phải chạy `git pull --ff-only` rồi `npm ci`.
- Sửa production smoke test dùng `grep` trực tiếp trên biến thay vì pipe lớn, tránh báo sai `Broken pipe` khi bundle tăng kích thước.
- `npm run verify` đã qua toàn bộ build, asset Brotli/Gzip, QR/ZIP semantic và E2E API ảnh/PDF; `npm run audit:prod` báo **0 lỗ hổng**.
- Browser QA đã đi hết tạo QR tiếng Việt, đọc QR từ ảnh, preview/tạo ZIP đổi tên, kéo vùng che → ảnh kết quả, trạng thái link rút gọn và layout **2560×1440 / 390×844**; không có lỗi console hoặc tràn ngang.

---

Phát triển bởi **Danh Phạm** · PDFTools phiên bản được lấy từ `package.json`, số bản dựng được lấy tự động từ Git.
