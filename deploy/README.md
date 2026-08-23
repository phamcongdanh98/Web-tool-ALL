# Triển khai PDFTools lên Ubuntu

Thiết kế production dùng Nginx ở cổng 80, Express ở `127.0.0.1:3001` và `systemd` để giữ ứng dụng hoạt động sau khi reboot. Mỗi lần deploy tạo một release độc lập trong `/var/www/pdftools/.deploy/releases`, kiểm tra release mới trước, rồi mới chuyển symlink `current` và restart. Nếu health check sau restart thất bại, script tự quay lại release trước.

Không lưu IP, SSH key, mật khẩu hoặc nội dung `~/.ssh/config` trong repository. Máy phát triển chỉ cần có SSH alias `orace`; có thể đổi alias bằng biến `PDFTOOLS_SSH_HOST`.

## Yêu cầu

- Ubuntu có Git, curl, Nginx và Node.js 20 trở lên được cài ở `/usr/bin/node`.
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

Script tự cài Git, curl và Nginx; nếu chưa có Node.js 20+ thì cài Node.js 22 từ NodeSource. Sau đó script cài `systemd`, sudoers, Nginx config, tạo release đầu tiên và kiểm tra cả API lẫn trang chủ.

Các lệnh thủ công tương đương để chẩn đoán khi script tự động báo lỗi:

```bash
cd /var/www/pdftools

sudo install -m 0644 deploy/pdftools.service /etc/systemd/system/pdftools.service
sudo install -m 0440 deploy/pdftools-sudoers /etc/sudoers.d/pdftools-deploy
sudo visudo -cf /etc/sudoers.d/pdftools-deploy

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

## Deploy hằng ngày

Trên máy phát triển, sau khi đã commit và push `main`:

```bash
npm run deploy:vps
```

Lệnh local sẽ kiểm tra working tree sạch và `HEAD` trùng `origin/main`, rồi gọi SSH. Phía VPS tiếp tục kiểm tra repository sạch, chỉ pull fast-forward, tạo release độc lập, chạy `npm ci`, build, preflight API/trang chủ, chuyển release, restart và health check.

Nếu máy khác dùng SSH alias khác:

```bash
PDFTOOLS_SSH_HOST=ten-alias-khac npm run deploy:vps
```

## Kiểm tra và xem log

```bash
ssh orace 'systemctl status pdftools --no-pager'
ssh orace 'journalctl -u pdftools -n 100 --no-pager'
ssh orace 'curl -fsS http://127.0.0.1:3001/api/health'
```

Nginx chỉ proxy vào loopback nên Node không bị mở trực tiếp ra Internet. Khi đã có domain, cấu hình HTTPS ở Nginx và thay `server_name _` bằng domain thật.
