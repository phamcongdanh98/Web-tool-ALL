#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR='/var/www/pdftools'
APP_USER='ubuntu'
NODE_MAJOR='22'

fail() {
  printf 'Lỗi setup: %s\n' "$1" >&2
  exit 1
}

[[ "$EUID" -eq 0 ]] || fail "Hãy chạy bằng sudo: sudo ${APP_DIR}/deploy/setup-ubuntu.sh"
[[ -r /etc/os-release ]] || fail 'Không nhận diện được hệ điều hành.'

# shellcheck disable=SC1091
source /etc/os-release
[[ "${ID:-}" == 'ubuntu' ]] || fail 'Script này chỉ hỗ trợ Ubuntu.'
id "$APP_USER" >/dev/null 2>&1 || fail "Không tồn tại user ${APP_USER}."
[[ -d "${APP_DIR}/.git" ]] || fail "Chưa có repository tại ${APP_DIR}."
[[ -f "${APP_DIR}/deploy/pdftools.service" ]] || fail 'Thiếu file cấu hình deploy. Hãy pull main mới nhất trước.'

printf '1/6 Cài Git, curl, chứng chỉ và Nginx...\n'
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git nginx

node_major='0'
if [[ -x /usr/bin/node ]]; then
  node_major="$(/usr/bin/node --version | sed -E 's/^v([0-9]+).*/\1/')"
fi

if [[ ! "$node_major" =~ ^[0-9]+$ ]] || ((node_major < 20)); then
  printf '2/6 Cài Node.js %s từ repository NodeSource...\n' "$NODE_MAJOR"
  nodesource_setup="$(mktemp)"
  trap 'rm -f "$nodesource_setup"' EXIT
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" -o "$nodesource_setup"
  bash "$nodesource_setup"
  apt-get install -y nodejs
  rm -f "$nodesource_setup"
  trap - EXIT
else
  printf '2/6 Đã có Node.js %s, bỏ qua cài đặt.\n' "$(/usr/bin/node --version)"
fi

[[ -x /usr/bin/node && -x /usr/bin/npm ]] || fail 'Node và npm phải được cài system-wide trong /usr/bin để systemd sử dụng ổn định.'
node_major="$(/usr/bin/node --version | sed -E 's/^v([0-9]+).*/\1/')"
((node_major >= 20)) || fail 'PDFTools yêu cầu Node.js 20 trở lên.'

printf '3/6 Chuẩn hóa quyền repository...\n'
chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"

printf '4/6 Cài systemd, sudoers và Nginx config...\n'
install -m 0644 "${APP_DIR}/deploy/pdftools.service" /etc/systemd/system/pdftools.service
install -m 0440 "${APP_DIR}/deploy/pdftools-sudoers" /etc/sudoers.d/pdftools-deploy
visudo -cf /etc/sudoers.d/pdftools-deploy

install -m 0644 "${APP_DIR}/deploy/nginx.conf" /etc/nginx/sites-available/pdftools
if [[ -L /etc/nginx/sites-enabled/default ]]; then
  unlink /etc/nginx/sites-enabled/default
fi
ln -sfn /etc/nginx/sites-available/pdftools /etc/nginx/sites-enabled/pdftools

printf '5/6 Kiểm tra và kích hoạt dịch vụ...\n'
systemctl daemon-reload
systemctl enable pdftools nginx
nginx -t
systemctl restart nginx

printf '6/6 Tạo release đầu tiên và kiểm tra health...\n'
sudo -H -u "$APP_USER" "${APP_DIR}/deploy/deploy.sh"
curl -fsS http://127.0.0.1:3001/api/health >/dev/null
curl -fsS http://127.0.0.1/ >/dev/null

printf '\nSetup Ubuntu thành công.\n'
printf 'Node: %s | npm: %s\n' "$(/usr/bin/node --version)" "$(/usr/bin/npm --version)"
printf 'Kiểm tra: systemctl status pdftools --no-pager\n'
printf 'Nếu trình duyệt bên ngoài chưa truy cập được, hãy mở inbound TCP 80 trong firewall của nhà cung cấp VPS.\n'
