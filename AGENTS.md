# Hướng dẫn dự án cho Codex

## Mục tiêu

Đây là ứng dụng PDFTools tiếng Việt. Ưu tiên giữ giao diện một trang hiện đại và các xử lý tệp rõ ràng, có kết quả tải xuống được.

## Kiến trúc

- `src/App.jsx`: toàn bộ giao diện React và state của các modal công cụ.
- `src/styles.css`: kiểu giao diện. Không thêm framework CSS trừ khi người dùng yêu cầu.
- `server.js`: Express API. Dùng `sharp` cho ảnh, `pdf-lib` cho PDF và `archiver` cho ZIP.
- `lib/pdf-office.js`: trích xuất chữ bằng PDF.js và tạo DOCX/XLSX/TXT bằng `docx` cùng `@excel.js/exceljs`.
- `lib/pptx.js`: sinh PowerPoint OOXML bằng `jszip`; mỗi dòng PDF là một text shape có thể chỉnh sửa.
- `vite.config.js`: Vite proxy `/api` đến Express ở cổng 3001.
- `DIAGRAMS.md`: nguồn sơ đồ kiến trúc, bản đồ chức năng, luồng người dùng và production.

## Lệnh cần dùng

```bash
npm ci
npm run dev
npm run build
npm run check:diagrams
npm run verify
npm run audit:prod
npm run status:vps
npm run monitor:vps
npm run maintenance:vps -- status
```

`npm run dev` phải khởi chạy cả Express lẫn Vite. Không đổi sang chỉ chạy Vite nếu các công cụ API vẫn cần hoạt động.
`npm run check:diagrams` đối chiếu tên/số lượng công cụ trong `src/App.jsx` với `DIAGRAMS.md`; phải qua khi thêm, xóa hoặc đổi tên công cụ.
`npm run verify` là cổng chất lượng chuẩn trước khi commit/push: kiểm tra cú pháp, shell script, production build, smoke test Express và E2E API xử lý ảnh/PDF thật.
`npm run status:vps` là lệnh read-only để so sánh commit/bản dựng giữa Mac, GitHub, repository VPS, release đang chạy và public health.
`npm run monitor:vps` là lệnh read-only chụp CPU, RAM, swap, disk, load, tiến trình, systemd, Nginx và health qua SSH; thêm `-- --watch 5` để tự làm mới mỗi 5 giây.
`npm run maintenance:vps -- status|on|off` xem, bật hoặc tắt bảo trì thủ công. `on/off` thay đổi trạng thái public trên VPS; chỉ chạy khi người dùng chủ động yêu cầu. Sau deploy đang bật bảo trì, phải chạy `off` và xác nhận public HTTPS.
Runtime chuẩn là Node.js 22.12 trở lên; CI và VPS dùng Node 22. Không hạ xuống Node 20 vì dependency Excel hiện yêu cầu runtime mới hơn.

## Quy ước thay đổi

- Chỉ tuyên bố một công cụ “hoạt động” sau khi đã kiểm thử đường đi thật: chọn tệp → xử lý → tải tệp kết quả.
- Chỉnh PDF hiện chỉ thêm lớp chữ Unicode/watermark hoặc đánh số trang; không mô tả thành sửa/xóa chữ gốc. Overlay dài phải tự co để không vượt khổ trang.
- PDF sang Word/Excel/PowerPoint/TXT chỉ xử lý văn bản có thể chọn, tối đa 100 trang. PDF scan phải trả 422 và hướng dẫn OCR; không fallback sang tệp Office rỗng. Bố cục Office là gần đúng và phải được mô tả trung thực trên UI.
- Khi sửa chuyển đổi Office, E2E phải kiểm tra **nội dung semantic bên trong** DOCX/XLSX/PPTX/TXT, không chỉ MIME, đuôi tệp hoặc chữ ký ZIP. Khi thay đổi cấu trúc PPTX, mở/chuyển thử bằng LibreOffice nếu runtime có sẵn.
- Chỉnh ảnh phải giữ preview CSS và pipeline Sharp đồng nghĩa cho sáng/tương phản/bão hòa/sắc độ/blur/xoay/lật/trắng-đen; E2E tối thiểu kiểm tra kích thước sau xoay và định dạng đầu ra.
- Xóa phông dùng `@imgly/background-removal` ở phía client. Chỉ nhận JPG, PNG và WebP. Lần đầu chạy phải tải model AI; giữ hiển thị tiến độ cho người dùng.
- Preview PDF dùng chiến lược hai lớp: thử viewer native trước, tự fallback sang PDF.js nếu viewer không phản hồi. PDF.js và worker được lazy-load/prewarm; không đổi lại sang tải đồng bộ trong bundle đầu trang.
- Nén PDF **đặt dung lượng** là chế độ raster có mất dữ liệu: giữ kích thước trang nhưng chữ/link/form không còn tương tác. Thuật toán phải ưu tiên DPI rồi mới hạ độ phân giải khi JPEG/PNG vẫn vượt ngân sách; luôn hiển thị DPI và kiểu mã hóa trong kết quả. Khi sửa thuật toán, kiểm thử bằng PDF tài liệu có chữ nhỏ và một mục tiêu thực tế, không chỉ kiểm tra tệp mở được.
- Nén PDF **không mất dữ liệu** chỉ tối ưu object streams/cấu trúc bằng `pdf-lib`: phải giữ chữ có thể trích xuất, liên kết và biểu mẫu, đồng thời không bao giờ trả tệp lớn hơn bản gốc. UI phải nói rõ tệp đã tối ưu có thể giảm 0%; không mô tả chế độ này là nén ảnh.
- Typography desktop dùng font hệ thống trước để hiển thị sắc nét trên macOS/Windows. Không đưa lại cỡ chữ nội dung/chú thích quan trọng xuống 7–10 px; sau thay đổi giao diện diện rộng phải kiểm tra thêm viewport 2560×1440 để tránh chữ quá nhỏ hoặc modal quá hẹp trên màn hình 27 inch 2K.
- Nguồn nhận diện chuẩn là `public/favicon.svg` cho biểu tượng vuông và `public/logo.svg` cho wordmark ngang. Header/footer phải dùng cùng biểu tượng. Khi sửa logo, phải tạo lại các PNG 32, 180, 192 và 512 px từ SVG, giữ liên kết trong `index.html`/`site.webmanifest`, rồi kiểm tra độ rõ ở kích thước favicon và production build.
- `npm run build` phải tiếp tục sinh `.br`/`.gz` qua `scripts/precompress-assets.mjs`. Express phục vụ Brotli/Gzip theo `Accept-Encoding`; Nginx phục vụ `/assets/` trực tiếp bằng `deploy/nginx-assets.conf` và `gzip_static`. Smoke test phải giữ kiểm tra `Content-Encoding` cùng `Vary: Accept-Encoding`.
- Giao diện bảo trì production là `deploy/maintenance.html`, phải độc lập, không tải asset/CDN/API và tự thử lại. Nginx dùng `deploy/nginx-maintenance.conf` để trả trang này với HTTP 503 + `Retry-After` khi Express lỗi 502/503/504; không bật bảo trì trong lúc build vì release cũ vẫn phục vụ bình thường. Sau khi sửa trang/snippet, kiểm tra HTML ở desktop/mobile và chạy `nginx -t` trên Ubuntu trước khi reload.
- Mỗi thay đổi thêm/xóa/đổi tên chức năng hoặc đổi nơi xử lý browser/API, preview, output, kiến trúc hay deploy phải cập nhật `DIAGRAMS.md` trong cùng công việc. Đối chiếu tên/số lượng công cụ với `pdfTools`/`imageTools`; không để sơ đồ mô tả chức năng chưa hoạt động.
- Không commit `.env`, `node_modules`, `dist` hoặc cấu hình IDE cục bộ.
- Không bao giờ commit private key, nội dung `~/.ssh`, địa chỉ máy chủ riêng hoặc thông tin đăng nhập. Chỉ ghi hướng dẫn chung trong repository; cấu hình kết nối cụ thể phải nằm ngoài dự án trên từng máy.
- Sau mỗi thay đổi code hoặc cấu hình runtime đáng kể, chạy `npm run verify`. Chỉ thay đổi tài liệu thuần túy mới có thể dùng kiểm tra hẹp hơn như `git diff --check`.
- Sau mỗi công việc làm thay đổi code, cấu hình hoặc dependency, cập nhật mục **Nhật ký thay đổi gần đây** trong `README.md`. Ghi ngắn gọn ngày, nội dung đã làm, kiểm thử đã chạy và lưu ý cần thiết khi mở dự án trên máy khác.
- Footer luôn hiển thị `Danh Phạm`, phiên bản từ `package.json` và số bản dựng thân thiện lấy từ tổng số Git commit. Không sửa số bản dựng bằng tay: `vite.config.js` tự tính ở local/CI; `deploy/deploy.sh` truyền số bản dựng và mã commit chính xác của release. Mã Git chỉ nằm trong tooltip để chẩn đoán. Chỉ tăng phiên bản semantic trong `package.json` khi chủ động phát hành mốc mới.

## Đồng bộ khi dùng hai máy

- Luôn chạy `git status` trước khi bắt đầu để tránh ghi đè thay đổi chưa commit từ máy khác.
- Trước khi sửa code, chạy `git pull --ff-only`. Nếu pull bị chặn vì thay đổi cục bộ, dừng lại và báo rõ; không tự xóa hoặc reset thay đổi.
- Nếu `package.json` hoặc lockfile thay đổi, ghi rõ trong `README.md` và nhắc chạy `npm ci` trên máy còn lại.
- Kết thúc mỗi công việc phải nói rõ trạng thái: **chưa commit**, **đã commit nhưng chưa push**, hoặc **đã push**, kèm commit hash khi có.
- Không được nói hai máy đã đồng bộ nếu commit mới nhất chưa được push lên remote.
- SSH key dùng để vào máy chủ không phải là Git credential và tuyệt đối không được đưa vào repository. Mỗi máy tự giữ key riêng với quyền `600` và cấu hình qua `~/.ssh/config`.
- Khi chuyển sang máy còn lại: pull trước, chạy `npm ci` nếu dependency thay đổi, rồi chạy lại build hoặc kiểm thử liên quan.
- Không làm đồng thời trên cùng nhánh ở hai máy. Nếu cần làm song song, dùng nhánh riêng có tiền tố `codex/` và gộp qua pull request.
- GitHub là nguồn code chuẩn. VPS chỉ pull commit đã push để build và chạy; không sửa trực tiếp source production trên VPS nhằm tránh lệch code giữa hai máy và máy chủ.
- Production dùng các file trong `deploy/`: Nginx proxy vào Express loopback, `systemd` chạy symlink `.deploy/current`, và `deploy/deploy.sh` tạo release độc lập. Không đổi lại sang chạy `vite preview` trong production.
- Mỗi deploy cập nhật bản sao ổn định `.deploy/maintenance.html`; Nginx không phụ thuộc Node hoặc asset của release để hiển thị trang bảo trì. `npm run monitor:vps` chỉ được đọc trạng thái, không restart/kill/dọn tài nguyên.
- `deploy/setup-ubuntu.sh` chỉ mở public TCP 80 ở host firewall và lưu bằng `netfilter-persistent`; không mở trực tiếp cổng Express 3001. Firewall/Security List phía nhà cung cấp vẫn được cấu hình ngoài repository.
- Sau khi commit và push `main`, deploy từ máy phát triển bằng `npm run deploy:vps`. Script phải giữ các guard Git, preflight, health check và rollback; nếu bước chuẩn bị lỗi thì không restart phiên bản đang chạy.
- `deploy/setup-ubuntu.sh` dùng khi cài VPS lần đầu hoặc khi chủ động cập nhật hạ tầng. Script phải có tính lặp lại an toàn, giữ domain/chứng chỉ Certbot, chỉ merge tuning được quản lý sau khi backup và kiểm tra `nginx -t`. Deploy code hằng ngày không chạy setup hạ tầng.
- Setup Ubuntu phải chờ khóa `apt/dpkg` bằng timeout hữu hạn khi `unattended-upgrades` đang chạy; không xóa file lock hoặc kill cưỡng bức tiến trình package manager. Nếu timeout, giữ hệ thống nguyên trạng và hướng dẫn kiểm tra service cập nhật.
- Sau commit làm thay đổi `deploy/nginx-assets.conf`, `deploy/nginx.conf` hoặc logic merge Nginx, phải deploy code trước rồi chạy `sudo ./deploy/setup-ubuntu.sh` một lần trên VPS. Xác nhận asset trả `Content-Encoding: gzip`/`br`, cache immutable và public HTTPS trước khi tuyên bố tối ưu đã lên production.
- Khi sửa shell script, tối thiểu chạy `npm run check:shell` và `git diff --check`. Các lệnh Linux-only như `apt-get`, `systemctl`, `nginx -t`, `iptables` phải được xác nhận trên Ubuntu trước khi tuyên bố VPS đã triển khai thành công.

## Git

- Nhánh chính: `main`.
- Trước khi bắt đầu: `git pull --ff-only`.
- Kiểm tra thay đổi bằng `git status` trước khi commit.
- Dùng commit message ngắn, mô tả được thay đổi, ví dụ: `fix: repair PDF split output`.
- Chỉ commit hoặc push khi người dùng yêu cầu; nếu chưa được yêu cầu, giữ thay đổi cục bộ và báo rõ để tránh hiểu nhầm trên máy còn lại.

## Quy trình chuẩn tái sử dụng cho mọi dự án

Phần này là baseline dùng lại khi bắt đầu dự án khác. Không sao chép mù quáng các lệnh npm hoặc tên dịch vụ PDFTools: trước tiên phải thay **Hồ sơ dự án** và **Ma trận lệnh** cho đúng công nghệ, hệ điều hành, đường dẫn, user dịch vụ và môi trường triển khai mới.

### 1. Hồ sơ dự án bắt buộc

Ngay khi khởi tạo repository, `AGENTS.md` phải ghi rõ:

- Mục tiêu, phạm vi và những tính năng chưa triển khai.
- Kiến trúc, entrypoint, vị trí frontend/backend/database và luồng dữ liệu chính.
- Nhánh triển khai, nguồn code chuẩn, runtime/phiên bản tối thiểu và package manager.
- Ma trận lệnh chuẩn: install khóa cứng, dev, lint/typecheck, test, build, smoke/E2E, audit và deploy.
- Biến môi trường cần có; chỉ commit `.env.example`, không commit giá trị thật.
- Môi trường local/staging/production, domain, health endpoint, nơi xem log và cách rollback.
- Quy tắc dữ liệu: backup, migration, retention và điều kiện được phép chạy thao tác phá hủy.

### 2. Khởi tạo dự án một lần

1. Tạo Git repository, `.gitignore`, `README.md`, `AGENTS.md`, file lock và khai báo phiên bản runtime.
2. Tạo một lệnh `verify` duy nhất gom các kiểm tra bắt buộc; không để người dùng phải nhớ nhiều lệnh rời rạc.
3. Tạo CI chạy trên push/PR bằng bản runtime production, cài từ lockfile và chạy `verify` cùng security audit phù hợp.
4. Giữ `main` luôn deploy được. Dự án có nhiều người hoặc production quan trọng nên bảo vệ `main`, yêu cầu PR và CI xanh.
5. Tách cấu hình khỏi code; secrets nằm trong secret manager hoặc file chỉ đọc trên máy chủ, không nằm trong Git/ảnh/log/chat.
6. Hạ tầng production phải có service manager, reverse proxy, HTTPS tự gia hạn, health endpoint, log tập trung và rollback đã thử.

### 3. Bắt đầu mỗi công việc

1. Đọc `AGENTS.md`, `README.md` và ghi chú gần nhất; không dựa vào trí nhớ của phiên trước.
2. Chạy `git status`. Nếu có thay đổi lạ, dừng và xác định chủ sở hữu; không reset/xóa thay đổi người khác.
3. Chạy `git pull --ff-only` trên nhánh đúng. Nếu cần làm song song, tạo nhánh `codex/<ten-task>` hoặc nhánh feature riêng.
4. Cài dependency từ lockfile (`npm ci`, `pnpm --frozen-lockfile`, `poetry sync`, v.v.), không cập nhật dependency ngoài phạm vi.
5. Chạy kiểm tra baseline liên quan để biết repository đang xanh trước khi sửa.

### 4. Trong khi triển khai thay đổi

- Chia thay đổi thành phần nhỏ, có thể review và rollback; không trộn refactor không liên quan.
- Ưu tiên xử lý lỗi tận gốc; không che lỗi bằng fallback giả hoặc tuyên bố tính năng hoạt động khi chưa đi hết đường thực tế.
- Mọi input từ mạng/tệp/người dùng phải được validate; đặt giới hạn kích thước, timeout và thông báo lỗi không lộ bí mật.
- Thay đổi database dùng migration có phiên bản và chiến lược expand/contract tương thích ngược. Backup trước migration phá hủy.
- Dependency mới phải được xem xét độ cần thiết, license, maintenance, kích thước và advisory bảo mật.
- Cập nhật tài liệu và `.env.example` cùng lúc với code; ghi rõ ảnh hưởng tới máy khác và production.

### 5. Cổng chất lượng trước Git

Chạy từ kiểm tra rẻ đến đắt, tùy stack nhưng không bỏ kiểm tra có liên quan:

1. Format/syntax và `git diff --check`.
2. Lint/typecheck.
3. Unit/integration test.
4. Production build.
5. Smoke test tiến trình production thật: start → health → route chính → shutdown sạch.
6. E2E đường người dùng quan trọng, đặc biệt upload/xử lý/download hoặc thanh toán/đăng nhập.
7. Audit dependency production và quét secrets khi dự án có công cụ tương ứng.

Nếu một bước không tồn tại, ghi rõ là chưa có thay vì nói “tất cả test đã qua”. Chỉ tuyên bố hoàn thành khi các cổng liên quan đều xanh.

### 6. Git, CI và review

1. Xem `git status`, `git diff` và danh sách file mới; xác nhận không có `.env`, key, token, build output hay dữ liệu người dùng.
2. Stage có chủ đích, review `git diff --cached`, dùng commit message mô tả kết quả.
3. Chỉ commit/push khi được người dùng cho phép. Sau push, chờ CI xanh trước khi deploy production.
4. Với thay đổi rủi ro cao, dùng PR, review và branch protection; không bypass required checks để “deploy cho nhanh”.
5. Git tag/release version được dùng khi sản phẩm cần lịch sử phát hành rõ; commit hash vẫn phải được ghi trong log deploy.

### 7. Triển khai production chuẩn

- Git/registry là nguồn artifact chuẩn; không sửa source trực tiếp trên production.
- Chỉ deploy commit đã push và đã qua CI. Khóa deploy để không có hai tiến trình chạy đồng thời.
- Kiểm tra working tree sạch, nhánh/commit đúng, dung lượng đĩa và dependency lock trước khi thay đổi dịch vụ.
- Tạo release bất biến ở thư mục riêng; cài dependency khóa cứng với retry có giới hạn, build và preflight trên cổng nội bộ.
- Nếu có database: backup, kiểm tra tương thích và chạy migration theo kế hoạch rollback trước khi switch.
- Chuyển release bằng symlink/đổi tên nguyên tử, restart qua service manager, rồi kiểm tra health nội bộ và public HTTPS.
- Nếu restart/health thất bại, tự quay lại release trước và kiểm tra rollback. Giữ số release hữu hạn và log timestamp/commit/release.
- Không dùng development server (`vite preview`, `next dev`, Flask debug, v.v.) làm production server.

### 8. Hạ tầng, domain và HTTPS

- Setup hạ tầng phải idempotent, có validation và không ghi đè chứng chỉ/cấu hình đang hoạt động.
- App lắng nghe loopback hoặc private network; chỉ reverse proxy mở 80/443. Không public trực tiếp cổng ứng dụng/database.
- Mở cổng ở cả host firewall lẫn cloud firewall/NSG; giữ SSH giới hạn theo IP khi có thể.
- Trình tự domain: DNS trỏ đúng public IP → HTTP cổng 80 hoạt động → đặt `server_name` → mở 443 → cấp TLS → ép HTTPS → thử auto-renew.
- Token DNS, SSH key và TLS private key nằm ngoài repository. Dùng reserved IP hoặc bộ cập nhật DDNS nếu public IP có thể thay đổi.
- Mọi thay đổi Nginx phải backup, chạy `nginx -t`, rồi reload graceful; lỗi thì giữ cấu hình cũ.

### 9. Kiểm tra sau deploy và vận hành

1. Xác nhận commit/release đang chạy, service active, health nội bộ và public HTTPS.
2. Thử ít nhất một luồng người dùng quan trọng trên production khi mức rủi ro yêu cầu.
3. Xem log/error rate/tài nguyên trong khoảng quan sát phù hợp; không coi lệnh deploy trả về 0 là bằng chứng duy nhất.
4. Kiểm tra timer gia hạn TLS, backup và cảnh báo định kỳ.
5. Khi có sự cố: dừng deploy mới, lưu log/bằng chứng, rollback release, xác nhận health rồi mới phân tích; không hot-fix trực tiếp trên VPS.

### 10. Làm việc trên nhiều máy

- Mỗi lần đổi máy: `git status` → `git pull --ff-only` → cài từ lockfile → chạy verify liên quan.
- Không làm đồng thời trên cùng nhánh. Mỗi máy dùng nhánh riêng khi cần song song và hợp nhất qua PR.
- README/nhật ký phải ghi dependency, migration, setup hoặc lệnh mới; cuối mỗi công việc báo rõ chưa commit/đã commit/chưa push/đã push và commit hash.
- Chỉ coi các máy và VPS đồng bộ khi commit đã push, CI xanh và production health xác nhận đúng release.

### 11. Definition of Done tối thiểu

- Phạm vi yêu cầu đã hoàn thành, không mở rộng ngoài ý người dùng.
- Diff đã review, không có secret hoặc thay đổi ngoài phạm vi.
- Lockfile/tài liệu/migration được cập nhật khi cần.
- `verify` và các E2E liên quan đã qua; CI xanh.
- Nếu deploy: internal health, public HTTPS, log và rollback path đã kiểm tra.
- README/AGENTS ghi thay đổi và trạng thái Git/deploy chính xác.
