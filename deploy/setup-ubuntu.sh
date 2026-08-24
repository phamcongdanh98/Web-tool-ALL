#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR='/var/www/pdftools'
APP_USER='ubuntu'
NODE_MAJOR='22'
APT_LOCK_TIMEOUT_SECONDS="${APT_LOCK_TIMEOUT_SECONDS:-600}"

fail() {
  printf 'Lỗi setup: %s\n' "$1" >&2
  exit 1
}

wait_for_apt() {
  command -v fuser >/dev/null 2>&1 || return 0

  local waited=0
  local interval=5
  local lock_files=(
    /var/lib/dpkg/lock-frontend
    /var/lib/dpkg/lock
    /var/cache/apt/archives/lock
    /var/lib/apt/lists/lock
  )

  while fuser "${lock_files[@]}" >/dev/null 2>&1; do
    if (( waited == 0 )); then
      printf 'Ubuntu đang cập nhật tự động; chờ khóa apt tối đa %s giây (không xóa lock)...\n' "$APT_LOCK_TIMEOUT_SECONDS"
    fi
    (( waited < APT_LOCK_TIMEOUT_SECONDS )) \
      || fail "apt vẫn bận sau ${APT_LOCK_TIMEOUT_SECONDS} giây. Hãy kiểm tra: systemctl status unattended-upgrades --no-pager"
    sleep "$interval"
    (( waited += interval ))
  done

  if (( waited > 0 )); then
    printf 'Khóa apt đã được giải phóng sau %s giây; tiếp tục setup.\n' "$waited"
  fi
}

apt_get() {
  apt-get -o "DPkg::Lock::Timeout=${APT_LOCK_TIMEOUT_SECONDS}" "$@"
}

[[ "$EUID" -eq 0 ]] || fail "Hãy chạy bằng sudo: sudo ${APP_DIR}/deploy/setup-ubuntu.sh"
[[ -r /etc/os-release ]] || fail 'Không nhận diện được hệ điều hành.'

# shellcheck disable=SC1091
source /etc/os-release
[[ "${ID:-}" == 'ubuntu' ]] || fail 'Script này chỉ hỗ trợ Ubuntu.'
[[ "$APT_LOCK_TIMEOUT_SECONDS" =~ ^[1-9][0-9]*$ ]] || fail 'APT_LOCK_TIMEOUT_SECONDS phải là số giây nguyên dương.'
id "$APP_USER" >/dev/null 2>&1 || fail "Không tồn tại user ${APP_USER}."
[[ -d "${APP_DIR}/.git" ]] || fail "Chưa có repository tại ${APP_DIR}."
[[ -f "${APP_DIR}/deploy/pdftools.service" ]] || fail 'Thiếu file cấu hình deploy. Hãy pull main mới nhất trước.'
[[ -f "${APP_DIR}/deploy/maintenance.html" && -f "${APP_DIR}/deploy/nginx-maintenance.conf" ]] \
  || fail 'Thiếu file giao diện/cấu hình bảo trì. Hãy pull main mới nhất trước.'

printf '1/6 Cài Git, curl, chứng chỉ, Nginx và công cụ lưu firewall...\n'
export DEBIAN_FRONTEND=noninteractive
wait_for_apt
apt_get update
wait_for_apt
apt_get install -y ca-certificates curl git nginx iptables-persistent

node_compatible='false'
if [[ -x /usr/bin/node ]] && /usr/bin/node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 12) ? 0 : 1)'; then
  node_compatible='true'
fi

if [[ "$node_compatible" != 'true' ]]; then
  printf '2/6 Cài Node.js %s từ repository NodeSource...\n' "$NODE_MAJOR"
  nodesource_setup="$(mktemp)"
  trap 'rm -f "$nodesource_setup"' EXIT
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" -o "$nodesource_setup"
  wait_for_apt
  bash "$nodesource_setup"
  wait_for_apt
  apt_get install -y nodejs
  rm -f "$nodesource_setup"
  trap - EXIT
else
  printf '2/6 Đã có Node.js %s, bỏ qua cài đặt.\n' "$(/usr/bin/node --version)"
fi

[[ -x /usr/bin/node && -x /usr/bin/npm ]] || fail 'Node và npm phải được cài system-wide trong /usr/bin để systemd sử dụng ổn định.'
/usr/bin/node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 12) ? 0 : 1)' || fail 'PDFTools yêu cầu Node.js 22.12 trở lên.'

printf '3/6 Chuẩn hóa quyền repository...\n'
chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"

printf '4/6 Cài systemd, sudoers và Nginx config...\n'
install -m 0644 "${APP_DIR}/deploy/pdftools.service" /etc/systemd/system/pdftools.service
install -m 0440 "${APP_DIR}/deploy/pdftools-sudoers" /etc/sudoers.d/pdftools-deploy
visudo -cf /etc/sudoers.d/pdftools-deploy
install -d -m 0755 /etc/nginx/snippets
install -m 0644 "${APP_DIR}/deploy/nginx-assets.conf" /etc/nginx/snippets/pdftools-assets.conf
install -m 0644 "${APP_DIR}/deploy/nginx-maintenance.conf" /etc/nginx/snippets/pdftools-maintenance.conf
install -d -o "$APP_USER" -g "$APP_USER" -m 0755 "${APP_DIR}/.deploy"
install -o "$APP_USER" -g "$APP_USER" -m 0644 "${APP_DIR}/deploy/maintenance.html" "${APP_DIR}/.deploy/maintenance.html"

if [[ -f /etc/nginx/sites-available/pdftools ]]; then
  printf '%s\n' 'Giữ domain/chứng chỉ Certbot và chỉ bổ sung tuning Nginx còn thiếu.'
else
  install -m 0644 "${APP_DIR}/deploy/nginx.conf" /etc/nginx/sites-available/pdftools
fi

nginx_site='/etc/nginx/sites-available/pdftools'
nginx_backup="${nginx_site}.before-setup-$(date -u +%Y%m%d%H%M%S)"
cp -a "$nginx_site" "$nginx_backup"

if ! grep -Fq 'include /etc/nginx/snippets/pdftools-assets.conf;' "$nginx_site"; then
  nginx_site_next="$(mktemp)"
  awk '
    !inserted && $1 == "server_name" {
      print
      print "    include /etc/nginx/snippets/pdftools-assets.conf;"
      inserted = 1
      next
    }
    { print }
    END { if (!inserted) exit 1 }
  ' "$nginx_site" >"$nginx_site_next" || {
    rm -f "$nginx_site_next"
    fail 'Không tìm thấy server_name để chèn cấu hình asset Nginx.'
  }
  install -m 0644 "$nginx_site_next" "$nginx_site"
  rm -f "$nginx_site_next"
fi

if ! grep -Fq 'include /etc/nginx/snippets/pdftools-maintenance.conf;' "$nginx_site"; then
  nginx_site_next="$(mktemp)"
  awk '
    !inserted && $1 == "server_name" {
      print
      print "    include /etc/nginx/snippets/pdftools-maintenance.conf;"
      inserted = 1
      next
    }
    { print }
    END { if (!inserted) exit 1 }
  ' "$nginx_site" >"$nginx_site_next" || {
    rm -f "$nginx_site_next"
    fail 'Không tìm thấy server_name để chèn cấu hình bảo trì Nginx.'
  }
  install -m 0644 "$nginx_site_next" "$nginx_site"
  rm -f "$nginx_site_next"
fi

if grep -Fq 'client_max_body_size 30M;' "$nginx_site"; then
  sed -i 's/client_max_body_size 30M;/client_max_body_size 50M;/' "$nginx_site"
elif ! grep -Fq 'client_max_body_size ' "$nginx_site"; then
  sed -i '/server_name/a\    client_max_body_size 50M;' "$nginx_site"
fi
if ! grep -Fq 'client_body_timeout 300s;' "$nginx_site"; then
  sed -i '/client_max_body_size /a\    client_body_timeout 300s;' "$nginx_site"
fi
if ! grep -Fq 'gzip on;' "$nginx_site"; then
  sed -i '/client_body_timeout 300s;/a\
\    gzip on;\
\    gzip_vary on;\
\    gzip_min_length 1024;\
\    gzip_types text/css application/javascript application/json application/wasm image/svg+xml;' "$nginx_site"
fi
if ! grep -Fq 'gzip_comp_level 5;' "$nginx_site"; then
  sed -i '/gzip_min_length 1024;/a\    gzip_comp_level 5;' "$nginx_site"
fi
if ! grep -Fq 'gzip_proxied any;' "$nginx_site"; then
  sed -i '/gzip_comp_level 5;/a\    gzip_proxied any;' "$nginx_site"
fi
if ! grep -Fq 'Permissions-Policy "camera=(), microphone=(), geolocation=()" always;' "$nginx_site"; then
  sed -i '/add_header Referrer-Policy/a\    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;' "$nginx_site"
fi
if ! grep -Fq 'proxy_set_header Connection "";' "$nginx_site"; then
  sed -i '/proxy_set_header X-Forwarded-Proto/a\        proxy_set_header Connection "";' "$nginx_site"
fi
if ! grep -Fq 'proxy_intercept_errors on;' "$nginx_site"; then
  sed -i '/proxy_pass http:\/\/127.0.0.1:3001;/a\        proxy_intercept_errors on;' "$nginx_site"
fi
if ! grep -Fq '/var/www/pdftools/.deploy/maintenance.flag' "$nginx_site"; then
  sed -i '/location \/ {/a\        if (-f /var/www/pdftools/.deploy/maintenance.flag) { return 503; }' "$nginx_site"
fi

if [[ -L /etc/nginx/sites-enabled/default ]]; then
  unlink /etc/nginx/sites-enabled/default
fi
ln -sfn /etc/nginx/sites-available/pdftools /etc/nginx/sites-enabled/pdftools

if ! nginx -t; then
  cp -a "$nginx_backup" "$nginx_site"
  nginx -t >/dev/null 2>&1 || true
  fail "Nginx mới không hợp lệ; đã khôi phục ${nginx_backup}."
fi

printf '5/6 Kiểm tra và kích hoạt dịch vụ...\n'
if ! iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null; then
  reject_position="$(iptables -L INPUT --line-numbers -n | awk '$2 == "REJECT" { print $1; exit }')"
  if [[ "$reject_position" =~ ^[0-9]+$ ]]; then
    iptables -I INPUT "$reject_position" -p tcp --dport 80 -j ACCEPT
  else
    iptables -A INPUT -p tcp --dport 80 -j ACCEPT
  fi
fi
netfilter-persistent save

systemctl daemon-reload
systemctl enable pdftools nginx
if systemctl is-active --quiet nginx; then
  systemctl reload nginx
else
  systemctl start nginx
fi

printf '6/6 Kiểm tra release và health...\n'
if [[ -L "${APP_DIR}/.deploy/current" ]] \
  && curl -fsS http://127.0.0.1:3001/api/health >/dev/null 2>&1; then
  printf '%s\n' 'Release hiện tại đang healthy; giữ nguyên, không build/deploy lại.'
else
  printf '%s\n' 'Chưa có release healthy; tạo release đầu tiên.'
  sudo -H -u "$APP_USER" "${APP_DIR}/deploy/deploy.sh"
fi
curl -fsS http://127.0.0.1:3001/api/health >/dev/null
curl -fsS http://127.0.0.1/ >/dev/null

printf '\nSetup Ubuntu thành công.\n'
printf 'Node: %s | npm: %s\n' "$(/usr/bin/node --version)" "$(/usr/bin/npm --version)"
printf 'Kiểm tra: systemctl status pdftools --no-pager\n'
printf 'Host firewall đã mở TCP 80. Nếu bên ngoài chưa truy cập được, hãy mở cùng cổng trong firewall của nhà cung cấp VPS.\n'
