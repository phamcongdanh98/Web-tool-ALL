#!/usr/bin/env bash
set -Eeuo pipefail

SSH_HOST="${PDFTOOLS_SSH_HOST:-orace}"
REMOTE_APP_DIR="${PDFTOOLS_APP_DIR:-/var/www/pdftools}"
PUBLIC_SITE_URL="${PDFTOOLS_PUBLIC_SITE_URL:-https://congcuweb.duckdns.org}"
ACTION="${1:-status}"

usage() {
  cat <<'USAGE'
Cách dùng:
  npm run maintenance:vps -- status
  npm run maintenance:vps -- on
  npm run maintenance:vps -- off

status  Chỉ đọc trạng thái bảo trì và HTTP public.
on      Bật trang bảo trì thủ công; tự hoàn tác nếu Nginx chưa trả HTTP 503.
off     Tắt bảo trì và kiểm tra website public hoạt động trở lại.
USAGE
}

case "$ACTION" in
  status|on|off) ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

for command_name in ssh curl; do
  command -v "$command_name" >/dev/null 2>&1 || {
    printf 'Thiếu lệnh %s trên máy hiện tại.\n' "$command_name" >&2
    exit 1
  }
done

remote_deploy_dir="$(printf '%q' "${REMOTE_APP_DIR}/.deploy")"
remote_flag="$(printf '%q' "${REMOTE_APP_DIR}/.deploy/maintenance.flag")"
case "$ACTION" in
  status)
    remote_command="if test -f ${remote_flag}; then echo on; else echo off; fi"
    ;;
  on)
    remote_command="test -d ${remote_deploy_dir} && umask 022 && touch ${remote_flag} && echo on"
    ;;
  off)
    remote_command="rm -f -- ${remote_flag} && echo off"
    ;;
esac

remote_result="$(ssh -o ConnectTimeout=10 "$SSH_HOST" "$remote_command")" || {
  printf 'Không thay đổi được trạng thái bảo trì qua SSH host %s.\n' "$SSH_HOST" >&2
  exit 1
}

public_code="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 15 "$PUBLIC_SITE_URL/" || true)"
[[ "$public_code" =~ ^[0-9]{3}$ ]] || public_code='000'

if [[ "$ACTION" == 'status' ]]; then
  if [[ "$remote_result" == 'on' ]]; then
    printf '🛠️  Bảo trì thủ công: ĐANG BẬT · Public HTTP %s\n' "$public_code"
    printf '%s\n' 'Tắt bằng: npm run maintenance:vps -- off'
  else
    printf '✅ Bảo trì thủ công: đang tắt · Public HTTP %s\n' "$public_code"
  fi
  exit 0
fi

if [[ "$ACTION" == 'on' ]]; then
  if [[ "$public_code" == '503' ]]; then
    printf '%s\n' '🛠️  Đã bật bảo trì. Website public đang trả HTTP 503 đúng thiết kế.'
    printf '%s\n' 'Sau khi cập nhật xong, chạy: npm run maintenance:vps -- off'
    exit 0
  fi

  ssh -o ConnectTimeout=10 "$SSH_HOST" "rm -f -- ${remote_flag}"
  printf 'Nginx chưa trả HTTP 503 (nhận %s); đã tự tắt cờ bảo trì để tránh trạng thái treo.\n' "$public_code" >&2
  printf '%s\n' 'Hãy deploy code và chạy setup-ubuntu.sh một lần trước khi dùng lệnh on.' >&2
  exit 1
fi

if [[ "$public_code" =~ ^(200|301|302)$ ]]; then
  printf '✅ Đã tắt bảo trì. Website public trả HTTP %s.\n' "$public_code"
else
  printf '⚠️  Đã xóa cờ bảo trì nhưng website trả HTTP %s; hãy kiểm tra service và Nginx.\n' "$public_code" >&2
  exit 1
fi
