# Triển khai PDFTools lên Ubuntu

Thiết kế production dùng Nginx ở cổng 80, Express ở `127.0.0.1:3001` và `systemd` để giữ ứng dụng hoạt động sau khi reboot. Mỗi lần deploy tạo một release độc lập trong `/var/www/pdftools/.deploy/releases`, kiểm tra release mới trước, rồi mới chuyển symlink `current` và restart. Nếu health check sau restart thất bại, script tự quay lại release trước. Trong khoảng Express tạm không phản hồi, Nginx trả trang bảo trì độc lập với HTTP 503 thay cho lỗi 502/504 thô.

Không lưu IP, SSH key, mật khẩu hoặc nội dung `~/.ssh/config` trong repository. Máy phát triển chỉ cần có SSH alias `orace`; có thể đổi alias bằng biến `PDFTOOLS_SSH_HOST`.

## Yêu cầu

- Ubuntu có Git, curl, Nginx và Node.js 22.12 trở lên được cài ở `/usr/bin/node`.
- Repository nằm tại `/var/www/pdftools`, thuộc quyền user `ubuntu` và đang ở nhánh `main`.
- SSH từ máy phát triển bằng `ssh orace` đã hoạt động.

Kiểm tra trước khi cài dịch vụ:

```bash
node --version
npm --version
command -v node
git -C /var/www/pdftools status
```

Nếu `command -v node` không trả về `/usr/bin/node`, hãy cài Node.js system-wide hoặc sửa `ExecStart` trong `pdftools.service` cho đúng. Không nên trỏ service vào một bản Node nằm trong thư mục cá nhân rồi bật `ProtectHome=true`.

## Cài lần đầu trên VPS

Sau khi repository đã được clone/pull tại `/var/www/pdftools`, cách nhanh nhất là chạy một lệnh trong terminal Remote SSH:

```bash
cd /var/www/pdftools
sudo ./deploy/setup-ubuntu.sh
```

Nếu Ubuntu đang chạy `unattended-upgrades`, script sẽ tự chờ khóa `apt/dpkg` tối đa 10 phút rồi tiếp tục. Không xóa các file `/var/lib/dpkg/lock*` và không kill tiến trình cập nhật. Có thể đổi giới hạn khi thật sự cần, ví dụ `sudo APT_LOCK_TIMEOUT_SECONDS=900 ./deploy/setup-ubuntu.sh`.

Script tự cài Git, curl và Nginx; nếu chưa có Node.js 22+ thì cài Node.js 22 từ NodeSource. Sau đó script mở TCP 80 trước rule `REJECT` của host, lưu firewall, cài `systemd`/sudoers/Nginx, cấu hình `/assets/` có cache lâu và Gzip build sẵn, cài trang bảo trì độc lập, tạo release đầu tiên rồi kiểm tra cả API lẫn trang chủ. Nếu đã có release healthy, script giữ release đó và không chạy lại `npm ci`/build. Nếu Nginx đã tồn tại, script giữ domain/chứng chỉ Certbot, chỉ bổ sung tuning còn thiếu, backup và chạy `nginx -t` trước khi reload. Security List hoặc Network Security Group của nhà cung cấp VPS vẫn phải cho phép inbound TCP 80.

Các lệnh thủ công tương đương để chẩn đoán khi script tự động báo lỗi:

```bash
cd /var/www/pdftools

sudo install -m 0644 deploy/pdftools.service /etc/systemd/system/pdftools.service
sudo install -m 0440 deploy/pdftools-sudoers /etc/sudoers.d/pdftools-deploy
sudo visudo -cf /etc/sudoers.d/pdftools-deploy

sudo install -d -m 0755 /etc/nginx/snippets
sudo install -m 0644 deploy/nginx-assets.conf /etc/nginx/snippets/pdftools-assets.conf
sudo install -m 0644 deploy/nginx-maintenance.conf /etc/nginx/snippets/pdftools-maintenance.conf
sudo install -m 0644 deploy/nginx.conf /etc/nginx/sites-available/pdftools
if [ -L /etc/nginx/sites-enabled/default ]; then sudo unlink /etc/nginx/sites-enabled/default; fi
sudo ln -sfn /etc/nginx/sites-available/pdftools /etc/nginx/sites-enabled/pdftools

sudo systemctl daemon-reload
sudo systemctl enable pdftools nginx
sudo nginx -t
sudo systemctl restart nginx

./deploy/deploy.sh
```

Lần đầu không chạy `systemctl start pdftools` thủ công; `deploy.sh` sẽ tạo release hợp lệ trước rồi mới khởi động service.

Biến môi trường production là tùy chọn. Khi cần, tạo `/etc/pdftools.env` bằng `sudoedit`, dựa trên `pdftools.env.example`, đặt quyền đọc phù hợp và tuyệt đối không commit giá trị thật.

## Domain và HTTPS lần đầu

1. Trỏ DNS về Public IPv4 của VPS và xác nhận HTTP cổng 80 hoạt động.
2. Mở inbound TCP 443 trong Security List/NSG của nhà cung cấp.
3. Chạy:

```bash
cd /var/www/pdftools
sudo ./deploy/configure-domain.sh ten-mien-cua-ban email-cua-ban
```

Script backup Nginx, đặt `server_name`, mở/lưu host firewall 443, cài Certbot qua Snap, cấp chứng chỉ, ép HTTPS và thử auto-renew. Token của nhà cung cấp DNS không được truyền vào hoặc lưu trong repository.

## Deploy hằng ngày

Trên máy phát triển, chạy verify, commit/push và chờ job GitHub Actions **Verify Node 22** xanh. Sau đó:

```bash
npm run deploy:vps
```

Lệnh local kiểm tra working tree sạch và `HEAD` trùng `origin/main`, rồi gọi SSH. Phía VPS khóa deploy, kiểm tra dung lượng, cập nhật bản sao trang bảo trì ổn định, tạo release độc lập, retry `npm ci`, build, preflight, chuyển release nguyên tử, restart và health/rollback. Khi VPS healthy, máy phát triển kiểm tra tiếp public HTTPS. Có thể đổi URL kiểm tra bằng `PDFTOOLS_PUBLIC_HEALTH_URL`.

Nếu máy khác dùng SSH alias khác:

```bash
PDFTOOLS_SSH_HOST=ten-alias-khac npm run deploy:vps
```

## Kiểm tra và xem log

Từ máy Mac, xem nhanh toàn bộ tài nguyên và trạng thái dịch vụ:

```bash
npm run monitor:vps
npm run monitor:vps -- --watch 5
```

Lệnh đầu chụp một lần; lệnh thứ hai tự làm mới mỗi 5 giây và dừng bằng `Control + C`. Cả hai chỉ đọc dữ liệu qua SSH.

## Bảo trì thủ công

Chế độ tự động luôn trả trang bảo trì khi Express lỗi 502/503/504. Chỉ bật thủ công khi cần chủ động chặn request public trong một thay đổi hạ tầng:

```bash
npm run maintenance:vps -- status
npm run maintenance:vps -- on
npm run deploy:vps
npm run maintenance:vps -- off
```

- `status` chỉ đọc cờ bảo trì và mã HTTP public.
- `on` tạo đúng một cờ `.deploy/maintenance.flag`, yêu cầu Nginx trả HTTP 503 và tự hoàn tác nếu cấu hình chưa hoạt động.
- Khi cờ đang bật, deploy vẫn chạy internal health/rollback nhưng bỏ qua public health có chủ đích.
- `off` xóa đúng cờ trên và yêu cầu website trở lại HTTP 200/301/302.

Không bật bảo trì thủ công cho deploy code thông thường: release cũ vẫn phục vụ trong lúc release mới build và trang fallback tự xuất hiện ở khoảng restart nếu cần.

Các lệnh chẩn đoán chi tiết:

```bash
ssh orace 'systemctl status pdftools --no-pager'
ssh orace 'journalctl -u pdftools -n 100 --no-pager'
ssh orace 'curl -fsS http://127.0.0.1:3001/api/health'
ssh orace 'tail -n 20 /var/www/pdftools/.deploy/deployments.log'
```

Nginx chỉ proxy vào loopback nên Node không bị mở trực tiếp ra Internet. Khi đã có domain, cấu hình HTTPS ở Nginx và thay `server_name _` bằng domain thật.

Production hiện dùng `congcuweb.duckdns.org` với HTTPS do Certbot quản lý. `npm run deploy:vps` không sửa Nginx hoặc chứng chỉ nên dùng cho mọi lần cập nhật code. Chỉ chạy lại `setup-ubuntu.sh` khi có commit thay đổi hạ tầng; script merge tuning có quản lý vào site hiện có nhưng vẫn cần kiểm tra `nginx -t`, service, header nén của `/assets/` và public HTTPS sau đó.

Kiểm tra asset lớn đã được nén sau khi cập nhật hạ tầng:

```bash
curl -sSI -H 'Accept-Encoding: gzip' https://congcuweb.duckdns.org/assets/ten-asset.mjs
```

Kết quả đúng phải có `Content-Encoding: gzip`, `Vary: Accept-Encoding` và `Cache-Control` chứa `immutable`. Lấy tên asset thật từ `dist/assets/` của release đang chạy; không dùng nguyên chữ `ten-asset.mjs`.
