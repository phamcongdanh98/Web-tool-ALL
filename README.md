# PDFTools

Ứng dụng web xử lý PDF và ảnh, xây dựng bằng React, Vite, Node.js và Express.

## Tính năng đang hoạt động

- Nén, đổi định dạng, đổi kích thước và cắt ảnh, với preview trước/sau và thống kê dung lượng thực tế.
- Cắt ảnh bằng khung kéo-thả, di chuyển và thu phóng trực tiếp; hỗ trợ tỷ lệ tự do, 1:1, 4:3 và 16:9.
- Xóa phông bằng AI chạy trong trình duyệt (JPG, PNG, WebP). Chế độ Nhanh dùng mô hình ~40 MB; Chất lượng cao dùng ~80 MB. Mô hình được tải và lưu cache khi dùng lần đầu.
- Preview PDF bằng PDF.js, có điều hướng từng trang.
- Nén PDF theo dung lượng MB thực tế, tự cân chỉnh nhiều lượt để kết quả nằm sát phía dưới mục tiêu; có chế độ bảo toàn văn bản riêng.
- Ghép PDF bằng bảng thumbnail: chọn, kéo đổi thứ tự, xoay, xóa và chèn thêm PDF tại vị trí mong muốn.
- Tách PDF bằng cách chọn trực tiếp thumbnail, hỗ trợ chọn tất cả, trang lẻ, trang chẵn và xoay trước khi xuất ZIP.
- Dark mode, tìm kiếm công cụ và giao diện responsive.
- Footer hiển thị người phát triển `Danh Phạm`, phiên bản ứng dụng và mã bản dựng tự đổi theo từng Git commit.

Các mục PDF sang Word/Excel/PowerPoint, chỉnh sửa nội dung PDF và chỉnh sửa ảnh nâng cao hiện đang hiển thị là “đang hoàn thiện”; không nên coi chúng là đã triển khai.

## Chạy trên máy mới

### 1. Cài đặt yêu cầu

- Node.js 20 LTS hoặc mới hơn.
- Git.
- Tài khoản GitHub có quyền với repository này nếu repository là private.

### 2. Clone và cài dependencies

```bash
git clone https://github.com/phamcongdanh98/Web-tool-ALL.git
cd Web-tool-ALL
npm ci
```

### 3. Cấu hình (tùy chọn)

Ứng dụng chạy không cần MongoDB. Nếu muốn dùng database sau này, sao chép file mẫu và đặt chuỗi kết nối:

```bash
cp .env.example .env
```

Sửa `MONGODB_URI` trong `.env`. Không commit file `.env`.

### 4. Chạy dự án

```bash
npm run dev
```

Lệnh này chạy đồng thời:

- React/Vite client tại `http://localhost:5175`.
- Express API tại `http://localhost:3001`.

Để tạo production build:

```bash
npm run build
```

Trước khi commit hoặc deploy, chạy cổng chất lượng đầy đủ:

```bash
npm run verify
npm run audit:prod
```

GitHub Actions cũng chạy các kiểm tra này tự động trên mọi push/PR vào `main`.

## Dùng Codex trên nhiều máy

Mỗi máy chỉ cần cài Codex, đăng nhập cùng tài khoản ChatGPT, sau đó clone repository và chạy `codex` ngay trong thư mục dự án:

```bash
cd Web-tool-ALL
codex
```

Codex sẽ đọc `AGENTS.md` trong repository để hiểu cấu trúc, lệnh kiểm tra và các quy ước của dự án. Để đồng bộ giữa các máy:

```bash
# Trước khi bắt đầu trên máy mới
git pull --ff-only
npm ci

# Sau khi hoàn thành thay đổi
git add .
git commit -m "mô tả thay đổi"
git push
```

Tránh làm việc đồng thời trên cùng một nhánh ở nhiều máy. Khi cần làm song song, tạo nhánh riêng trên mỗi máy rồi mở pull request để gộp.

Sau mỗi lần Codex thay đổi code, hãy xem mục **Nhật ký thay đổi gần đây** bên dưới và trạng thái Git được báo ở cuối công việc. Chỉ coi hai máy đã đồng bộ sau khi thay đổi được commit và push lên GitHub.

## Quy trình triển khai VPS khuyến nghị

GitHub là nguồn code chuẩn; VPS chỉ nhận và chạy commit đã push. Không sửa trực tiếp source production trên VPS.

Sau khi chạy một lần `sudo ./deploy/setup-ubuntu.sh` theo [hướng dẫn production](deploy/README.md), luồng cập nhật hằng ngày chỉ còn:

```bash
# Trên máy phát triển
git pull --ff-only
npm ci
npm run verify
git add .
git commit -m "mô tả thay đổi"
git push origin main

# Chờ CI xanh, sau đó kiểm tra Git và deploy qua SSH alias orace
npm run deploy:vps
```

Lệnh này dừng ngay nếu còn file chưa commit hoặc `HEAD` chưa trùng `origin/main`. Trên VPS, `deploy/deploy.sh` khóa chống chạy đồng thời, kiểm tra dung lượng, pull fast-forward đúng commit, tạo release độc lập, cài sạch bằng `npm ci` có retry, build và preflight trước khi chuyển phiên bản. Nếu restart/health thất bại, release trước được khôi phục và kiểm tra lại. Sau cùng máy phát triển kiểm tra public HTTPS thật.

Kiến trúc production đã được chuẩn bị trong thư mục `deploy/`:

- Express phục vụ cả frontend đã build và API trên `127.0.0.1:3001`; Nginx làm reverse proxy tại cổng 80/443.
- `systemd` sandbox Express bằng filesystem chỉ đọc, bỏ capability, giữ tiến trình sau reboot và gửi log vào journal.
- Mỗi release nằm riêng trong `.deploy/releases`; symlink `.deploy/current` giúp chuyển phiên bản nhanh và có điểm rollback.
- Nginx đặt giới hạn upload lớn hơn giới hạn 25 MB của ứng dụng, ví dụ `client_max_body_size 30M`.
- Domain/HTTPS có script riêng `deploy/configure-domain.sh`; Certbot quản lý redirect và gia hạn.
- VS Code Remote SSH dùng để xem log, terminal và chẩn đoán; không dùng để sửa trực tiếp bản production nếu thay đổi chưa đi qua Git.

### Kết nối VPS bằng VS Code Remote SSH

Máy Mac đã có host SSH tên `orace` trong `~/.ssh/config`. Không đưa private key hoặc nội dung file cấu hình này vào repository.

1. Trên trang quản trị VPS, cho phép inbound TCP cổng SSH từ IP mạng hiện tại của máy Mac. Cổng mặc định là `22`; nếu VPS dùng cổng khác thì cập nhật trường `Port` trong SSH config.
2. Nếu VPS chưa chạy SSH, mở web console của nhà cung cấp và chạy `sudo systemctl enable --now ssh`. Có thể kiểm tra bằng `sudo ss -ltnp | grep ':22'`.
3. Trên Mac, mở Terminal và chạy `ssh orace`. Chỉ tiếp tục với VS Code sau khi lệnh này đăng nhập thành công.
4. Mở VS Code, nhấn `Shift + Command + P`, chọn **Remote-SSH: Connect to Host...**, rồi chọn `orace`.
5. Lần đầu kết nối, kiểm tra fingerprint máy chủ trước khi chấp nhận và chọn nền tảng **Linux**. Chờ VS Code Server cài đặt hoàn tất.
6. Trong cửa sổ VS Code mới, chọn **File → Open Folder...** và mở `/var/www/pdftools`.
7. Mở **Terminal → New Terminal**. Terminal này chạy trên Ubuntu; kiểm tra bằng `whoami`, `pwd`, `git --version`, `node --version` và `npm --version`.
8. Nếu repository chưa có trên VPS, chạy:

```bash
sudo mkdir -p /var/www/pdftools
sudo chown ubuntu:ubuntu /var/www/pdftools
git clone https://github.com/phamcongdanh98/Web-tool-ALL.git /var/www/pdftools
cd /var/www/pdftools
```

Sau khi clone, làm phần cài lần đầu trong [`deploy/README.md`](deploy/README.md); script deploy sẽ tự cài dependency và build trong release riêng.

Nếu Terminal báo timeout trước khi hỏi xác nhận key, lỗi thuộc cổng SSH, firewall hoặc dịch vụ SSH trên VPS; chưa liên quan đến private key. Nếu báo `Permission denied (publickey)`, kiểm tra public key đã được thêm vào `~/.ssh/authorized_keys` của user `ubuntu` hay chưa.

Codex CLI chạy trực tiếp trên repository cục bộ, có thể đọc/sửa/chạy lệnh trong dự án. Bạn có thể cài và đăng nhập theo [hướng dẫn Codex chính thức](https://learn.chatgpt.com/docs/codex/cli).

## Cấu trúc chính

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

## Nhật ký thay đổi gần đây

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
- Thêm footer nhận diện `Danh Phạm`; phiên bản semantic lấy từ `package.json`, còn mã bản dựng được gắn tự động theo từng commit và truyền chính xác vào mỗi release VPS.
- Kiểm thử deploy/runtime: `npm ci`, `npm run verify`, syntax toàn bộ shell script, guard Git; production smoke xác nhận `/api/health`, trang SPA, cache header asset, graceful shutdown và API thật cho nén/cắt ảnh, nén/ghép/tách PDF.
- `package.json` yêu cầu Node.js 20+, có script `start` và `deploy:vps`; `package-lock.json` đã đồng bộ. Máy còn lại cần pull rồi chạy `npm ci`.
- Bổ sung `.DS_Store` vào `.gitignore` để tránh đồng bộ tệp hệ thống macOS sang máy khác.
- Trạng thái tại thời điểm ghi chú: release production đang chạy commit `0400c493e595`; bộ tối ưu CI/deploy/hạ tầng và quy trình AGENTS đang ở máy cục bộ, chưa commit và chưa push.

## Lưu ý về xóa phông AI

Ảnh được xử lý local trong browser, không gửi tệp lên Express API. Lần đầu người dùng phải có Internet để tải mô hình AI; sau đó browser cache model. Thư viện `@imgly/background-removal` có giấy phép AGPL, nên cần xem xét yêu cầu giấy phép trước khi phát hành sản phẩm thương mại.
