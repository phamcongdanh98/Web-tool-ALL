# PDFTools

Ứng dụng web xử lý PDF và ảnh, xây dựng bằng React, Vite, Node.js và Express.

![React 18](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=111827)
![Vite 6](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white)
![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933?style=flat-square&logo=node.js&logoColor=white)
![Production](https://img.shields.io/badge/Production-Online-16A34A?style=flat-square&logo=nginx&logoColor=white)

> [!TIP]
> **Local:** [http://localhost:5175](http://localhost:5175) · **Website:** [https://congcuweb.duckdns.org](https://congcuweb.duckdns.org)

## ✨ Tính năng đang hoạt động

- Nén, đổi định dạng, đổi kích thước và cắt ảnh, với preview trước/sau và thống kê dung lượng thực tế.
- Cắt ảnh bằng khung kéo-thả, di chuyển và thu phóng trực tiếp; hỗ trợ tỷ lệ tự do, 1:1, 4:3 và 16:9.
- Xóa phông bằng AI chạy trong trình duyệt (JPG, PNG, WebP). Chế độ Nhanh dùng mô hình ~40 MB; Chất lượng cao dùng ~80 MB. Mô hình được tải và lưu cache khi dùng lần đầu.
- Preview PDF bằng PDF.js, có điều hướng từng trang.
- Nén PDF theo dung lượng MB thực tế, tự cân chỉnh nhiều lượt để kết quả nằm sát phía dưới mục tiêu; có chế độ bảo toàn văn bản riêng.
- Ghép PDF bằng bảng thumbnail: chọn, kéo đổi thứ tự, xoay, xóa và chèn thêm PDF tại vị trí mong muốn.
- Tách PDF bằng cách chọn trực tiếp thumbnail, hỗ trợ chọn tất cả, trang lẻ, trang chẵn và xoay trước khi xuất ZIP.
- Dark mode, tìm kiếm công cụ và giao diện responsive.
- Footer hiển thị `Danh Phạm` và phiên bản dễ đọc, ví dụ `Phiên bản 1.0.0 · Bản dựng #11`; số bản dựng tự tăng theo Git commit.

Các mục PDF sang Word/Excel/PowerPoint, chỉnh sửa nội dung PDF và chỉnh sửa ảnh nâng cao hiện đang hiển thị là “đang hoàn thiện”; không nên coi chúng là đã triển khai.

## 🚀 Hướng dẫn nhanh

### 💻 1. Chạy website trên máy Mac

Mở Terminal trong VS Code, đi vào thư mục dự án rồi khởi động:

```bash
cd "/Users/danhpham/Documents/ChatGPT/Tool Web All"
npm run dev
```

| Lệnh | Giải thích |
| --- | --- |
| `cd ".../Tool Web All"` | Đi vào đúng thư mục dự án trên Mac. Dấu ngoặc kép cần thiết vì đường dẫn có khoảng trắng. |
| `npm run dev` | Khởi động đồng thời giao diện Vite và Express API. |

Khi Terminal hiện hai dòng dưới đây và chưa trả lại dấu nhắc `%`, website đang chạy:

```text
Local: http://localhost:5175/
ToolHub listening on http://127.0.0.1:3001
```

> [!IMPORTANT]
> Mở [http://localhost:5175](http://localhost:5175), giữ tab Terminal hoạt động và nhấn `Control + C` khi muốn dừng.

Nếu thấy `EADDRINUSE` hoặc `Port 5175 is in use`, một dev server khác đang chạy. Không chạy thêm lần nữa; mở localhost hiện tại hoặc tìm PID bằng:

```bash
lsof -nP -iTCP:5175 -sTCP:LISTEN
lsof -nP -iTCP:3001 -sTCP:LISTEN
```

Hai lệnh `lsof` chỉ kiểm tra tiến trình nào đang dùng cổng giao diện `5175` và API `3001`; chúng không dừng hoặc thay đổi tiến trình.

### 🧰 2. Cài trên máy mới

Cần Node.js 20+ và Git. Sau đó chạy một lần:

```bash
git clone https://github.com/phamcongdanh98/Web-tool-ALL.git
cd Web-tool-ALL
npm ci
npm run dev
```

| Lệnh | Giải thích |
| --- | --- |
| `git clone ...` | Tải repository từ GitHub về máy. |
| `cd Web-tool-ALL` | Đi vào thư mục vừa clone. |
| `npm ci` | Cài đúng phiên bản dependency trong `package-lock.json`. |
| `npm run dev` | Chạy website local. |

> [!NOTE]
> Ứng dụng chạy được mà không cần database. `.env` chỉ cần khi cấu hình dịch vụ bên ngoài và tuyệt đối không được commit.

### 🌐 3. Đưa code mới lên domain

Luồng chuẩn:

```text
Sửa code → Kiểm tra → Commit → Push GitHub → CI xanh → Deploy VPS → Mở domain
```

Trước tiên, xem trạng thái đồng bộ bằng một lệnh:

```bash
npm run status:vps
```

Lệnh này chỉ đọc dữ liệu và hiển thị trực quan Mac, GitHub, VPS, release đang chạy cùng trạng thái website. Nếu VPS cũ hơn GitHub, lệnh sẽ nhắc chạy deploy.

Chạy lần lượt trong Terminal trên Mac:

```bash
npm run verify
git add .
git commit -m "mô tả thay đổi"
git push origin main
npm run deploy:vps
```

| Bước | Lệnh | Giải thích |
| --- | --- | --- |
| 🔎 Trạng thái | `npm run status:vps` | So sánh phiên bản giữa Mac, GitHub, VPS và domain. |
| 🧪 Kiểm tra | `npm run verify` | Build và thử production, ảnh, PDF trước khi phát hành. |
| 📦 Chuẩn bị | `git add .` | Đưa toàn bộ file đã sửa vào commit sắp tạo. |
| 🏷️ Tạo phiên bản | `git commit -m "..."` | Tạo commit mới; footer tự tăng số **Bản dựng**. |
| ☁️ Đồng bộ | `git push origin main` | Đẩy commit từ Mac lên nhánh `main` của GitHub. |
| 🚀 Phát hành | `npm run deploy:vps` | Đưa đúng commit lên VPS, kiểm tra domain và rollback nếu lỗi. |

> [!IMPORTANT]
> Sau `git push`, chờ job **Verify Node 22** trong GitHub Actions chuyển màu xanh rồi mới chạy deploy. Khi hoàn tất, mở website và đối chiếu số **Bản dựng** ở footer.

Chỉ khi thay đổi file Nginx hoặc `systemd` mới chạy thêm một lần:

```bash
ssh orace 'cd /var/www/pdftools && sudo ./deploy/setup-ubuntu.sh'
```

Không chạy lệnh setup này cho các lần chỉ sửa giao diện hoặc chức năng.

### 🔄 4. Làm việc trên hai máy

Trước khi bắt đầu trên máy vừa chuyển sang:

```bash
git status
git pull --ff-only
npm ci
```

Không sửa đồng thời trên cùng một nhánh ở hai máy. Chỉ coi hai máy đã đồng bộ sau khi commit được push lên GitHub.

| Lệnh | Giải thích |
| --- | --- |
| `git status` | Xem máy hiện tại có file chưa commit hay không. |
| `git pull --ff-only` | Nhận commit mới nhất từ GitHub mà không tự tạo merge commit. |
| `npm ci` | Đồng bộ dependency theo lockfile mới nhất. |

### 🩺 5. Kiểm tra VPS khi có lỗi

```bash
ssh orace 'systemctl status pdftools --no-pager'
ssh orace 'journalctl -u pdftools -n 100 --no-pager'
curl https://congcuweb.duckdns.org/api/health
```

| Lệnh | Giải thích |
| --- | --- |
| `systemctl status` | Xem dịch vụ PDFTools đang chạy hay đã lỗi. |
| `journalctl` | Xem 100 dòng log gần nhất để tìm nguyên nhân. |
| `curl .../api/health` | Kiểm tra website public có trả trạng thái khỏe hay không. |

Hướng dẫn cài VPS, domain, HTTPS và rollback chi tiết nằm trong [`deploy/README.md`](deploy/README.md).

## 🗂️ Cấu trúc chính

```text
src/App.jsx       Giao diện React và luồng xử lý tệp
src/styles.css    Hệ thống giao diện và responsive layout
server.js         Express API xử lý ảnh/PDF
vite.config.js    Vite và proxy /api sang Express
deploy/           Script release, systemd, Nginx và hướng dẫn VPS
scripts/          Smoke/E2E production dùng cho local và CI
.github/workflows CI tự động trên push và pull request
.env.example      Biến môi trường mẫu
AGENTS.md         Hướng dẫn dành cho Codex
```

## 📝 Nhật ký thay đổi gần đây

### 2026-08-23

- Thêm nén PDF theo dung lượng mục tiêu thực tế; thử nghiệm PDF 6,75 MB xuống 3,86 MB với mục tiêu 4 MB.
- Thiết kế lại ghép và tách PDF bằng thumbnail trực quan; thứ tự, trang bị xóa và góc xoay được áp dụng thật vào kết quả backend.
- Thêm preview PDF bằng PDF.js và cải thiện khu vực chọn tệp để hỗ trợ kéo-thả, chọn tệp và chèn thêm PDF.
- Kiểm thử: `npm run build`; ghép 4 trang có đổi thứ tự và xoay; tách trang 1 và 3 thành ZIP; kiểm tra preview và liên kết tải kết quả.
- Dependency mới: `pdfjs-dist`. Khi cập nhật trên máy còn lại, cần chạy `git pull --ff-only` rồi `npm ci`.
- SSH alias `orace` do người dùng quản lý ngoài repository; private key, IP và nội dung SSH config không được lưu trong Git.
- Hoàn thiện production runtime: Express phục vụ `dist`, cache asset có hash, SPA fallback không cache, lắng nghe loopback và đóng tiến trình an toàn khi nhận SIGTERM/SIGINT.
- Thêm hệ thống deploy trong `deploy/`: release độc lập, preflight trước restart, health check, rollback tự động, giữ ba release gần nhất, cấu hình `systemd`, Nginx và quyền restart giới hạn.
- Thêm `deploy/setup-ubuntu.sh` để cài production lần đầu trên Ubuntu bằng một lệnh, bao gồm dependency hệ thống, Node.js khi cần, cấu hình dịch vụ và release đầu tiên.
- Đã triển khai thành công release `c2b747da2a1d` trên Ubuntu: health API và `systemd` hoạt động, Nginx trả HTTP 200 và website truy cập được từ mạng công cộng sau khi cho phép TCP 80 ở cả host `iptables` lẫn firewall của nhà cung cấp.
- Cập nhật script setup để tự chèn rule TCP 80 trước rule `REJECT` và lưu bằng `netfilter-persistent`; cổng Express 3001 vẫn chỉ lắng nghe loopback.
- Đã trỏ `congcuweb.duckdns.org` về VPS, cấu hình Nginx/Certbot và xác nhận website truy cập ổn định qua HTTPS. Deploy code hằng ngày không thay đổi cấu hình domain hoặc chứng chỉ.
- Thêm `npm run deploy:vps`: chỉ triển khai khi working tree sạch và commit local trùng `origin/main`; SSH host mặc định là alias `orace` và không chứa IP/key trong code.
- Tối ưu pipeline: thêm `npm run verify`, smoke/E2E production thật, audit production dependency và GitHub Actions CI trên Node.js 22.
- Tăng an toàn deploy bằng khóa `flock`, kiểm tra dung lượng, đối chiếu chính xác `origin/main`, retry npm nhiều lớp, dọn release lỗi, xác nhận rollback và log lịch sử release.
- Tăng hardening `systemd`, tối ưu Nginx/gzip, merge tuning mà không ghi đè domain/chứng chỉ Certbot khi chạy lại setup và thêm script cấu hình domain/HTTPS có backup/rollback.
- `npm run deploy:vps` hiện kiểm tra thêm public HTTPS sau khi VPS healthy nội bộ.
- Thêm footer nhận diện `Danh Phạm`; phiên bản semantic lấy từ `package.json`, số bản dựng dễ đọc tự tăng theo tổng số commit, còn mã Git kỹ thuật chỉ hiện trong tooltip.
- Làm README trực quan hơn bằng badge màu, icon, callout và bảng giải thích ngắn gọn cho từng câu lệnh.
- Thêm `npm run status:vps` để kiểm tra trực quan Mac ↔ GitHub ↔ VPS ↔ domain bằng một lệnh read-only.
- Viết lại hướng dẫn README theo luồng local → GitHub → VPS, giải thích ngắn gọn từng lệnh và bổ sung cách nhận biết dev server hoặc lỗi cổng bị chiếm.
- Kiểm thử deploy/runtime: `npm ci`, `npm run verify`, syntax toàn bộ shell script, guard Git; production smoke xác nhận `/api/health`, trang SPA, cache header asset, graceful shutdown và API thật cho nén/cắt ảnh, nén/ghép/tách PDF.
- `package.json` yêu cầu Node.js 20+, có script `start` và `deploy:vps`; `package-lock.json` đã đồng bộ. Máy còn lại cần pull rồi chạy `npm ci`.
- Bổ sung `.DS_Store` vào `.gitignore` để tránh đồng bộ tệp hệ thống macOS sang máy khác.
- Trạng thái tại thời điểm ghi chú: production đang chạy **Phiên bản 1.0.0 · Bản dựng #9**; giao diện phiên bản thân thiện mới đang ở máy cục bộ, chưa commit, chưa push và chưa deploy.

## 🤖 Lưu ý về xóa phông AI

Ảnh được xử lý local trong browser, không gửi tệp lên Express API. Lần đầu người dùng phải có Internet để tải mô hình AI; sau đó browser cache model. Thư viện `@imgly/background-removal` có giấy phép AGPL, nên cần xem xét yêu cầu giấy phép trước khi phát hành sản phẩm thương mại.
