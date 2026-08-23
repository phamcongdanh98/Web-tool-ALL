#!/usr/bin/env bash
set -Eeuo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
NGINX_SITE='/etc/nginx/sites-available/pdftools'

fail() {
  printf 'Lỗi cấu hình domain: %s\n' "$1" >&2
  exit 1
}

[[ "$EUID" -eq 0 ]] || fail 'Hãy chạy: sudo ./deploy/configure-domain.sh ten-mien email'
[[ "$DOMAIN" =~ ^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$ ]] \
  || fail 'Domain không hợp lệ.'
[[ "$EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || fail 'Email cấp chứng chỉ không hợp lệ.'
[[ -f "$NGINX_SITE" ]] || fail "Không tìm thấy ${NGINX_SITE}. Hãy chạy setup Ubuntu trước."
getent ahostsv4 "$DOMAIN" >/dev/null 2>&1 || fail 'Domain chưa có bản ghi IPv4. Hãy cập nhật DNS trước.'

printf '1/5 Kiểm tra HTTP của domain...\n'
curl --fail --silent --show-error --max-time 20 "http://${DOMAIN}/api/health" >/dev/null \
  || fail 'Domain chưa truy cập được qua HTTP cổng 80; kiểm tra DNS và cloud firewall.'

printf '2/5 Cập nhật server_name an toàn...\n'
backup="${NGINX_SITE}.before-domain-$(date -u +%Y%m%d%H%M%S)"
cp -a "$NGINX_SITE" "$backup"
restore_nginx() {
  local status="$?"
  if ((status != 0)); then
    cp -a "$backup" "$NGINX_SITE"
    nginx -t >/dev/null 2>&1 && systemctl reload nginx || true
    printf 'Đã khôi phục Nginx từ %s.\n' "$backup" >&2
  fi
  trap - EXIT
  exit "$status"
}
trap restore_nginx EXIT

sed -E -i "s/^[[:space:]]*server_name[[:space:]]+[^;]+;/    server_name ${DOMAIN};/" "$NGINX_SITE"
nginx -t
systemctl reload nginx

printf '3/5 Mở và lưu host firewall TCP 443...\n'
if ! iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null; then
  reject_position="$(iptables -L INPUT --line-numbers -n | awk '$2 == "REJECT" { print $1; exit }')"
  if [[ "$reject_position" =~ ^[0-9]+$ ]]; then
    iptables -I INPUT "$reject_position" -p tcp --dport 443 -j ACCEPT
  else
    iptables -A INPUT -p tcp --dport 443 -j ACCEPT
  fi
fi
netfilter-persistent save

printf '4/5 Cài Certbot chính thức qua Snap...\n'
if ! command -v snap >/dev/null 2>&1; then
  apt-get update
  apt-get install -y snapd
fi
if ! snap list certbot >/dev/null 2>&1; then
  snap install --classic certbot
fi
ln -sfn /snap/bin/certbot /usr/local/bin/certbot

printf '5/5 Cấp chứng chỉ, ép HTTPS và kiểm tra gia hạn...\n'
/usr/local/bin/certbot --nginx -d "$DOMAIN" --email "$EMAIL" \
  --agree-tos --no-eff-email --redirect --non-interactive --keep-until-expiring
if ! /usr/local/bin/certbot renew --dry-run; then
  printf '%s\n' 'Cảnh báo: kiểm tra renew staging chưa thành công; chứng chỉ thật vẫn được giữ. Hãy chạy lại certbot renew --dry-run sau.' >&2
fi
curl --fail --silent --show-error --max-time 20 "https://${DOMAIN}/api/health" >/dev/null

trap - EXIT
printf 'Domain HTTPS hoạt động: https://%s\n' "$DOMAIN"
printf 'Bản sao Nginx trước thay đổi: %s\n' "$backup"
