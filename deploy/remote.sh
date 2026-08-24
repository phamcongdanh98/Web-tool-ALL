#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_HOST="${PDFTOOLS_SSH_HOST:-orace}"
REMOTE_APP_DIR="${PDFTOOLS_APP_DIR:-/var/www/pdftools}"
PUBLIC_HEALTH_URL="${PDFTOOLS_PUBLIC_HEALTH_URL:-https://congcuweb.duckdns.org/api/health}"

cd "$ROOT_DIR"

for command_name in git ssh curl; do
  command -v "$command_name" >/dev/null 2>&1 || {
    printf 'Thiếu lệnh %s.\n' "$command_name" >&2
    exit 1
  }
done

[[ "$(git branch --show-current)" == 'main' ]] || {
  printf '%s\n' 'Chỉ deploy từ nhánh main.' >&2
  exit 1
}

[[ -z "$(git status --porcelain)" ]] || {
  printf '%s\n' 'Còn thay đổi chưa commit. Hãy commit và push trước khi deploy.' >&2
  exit 1
}

printf '%s\n' 'Kiểm tra commit trên GitHub...'
git fetch --quiet origin main
local_revision="$(git rev-parse HEAD)"
remote_revision="$(git rev-parse origin/main)"
[[ "$local_revision" == "$remote_revision" ]] || {
  printf '%s\n' 'Commit local chưa trùng origin/main. Hãy pull hoặc push trước khi deploy.' >&2
  exit 1
}

printf 'Triển khai %s qua SSH host %s...\n' "$(git rev-parse --short HEAD)" "$SSH_HOST"
remote_command="$(printf 'cd %q && ./deploy/deploy.sh' "$REMOTE_APP_DIR")"
ssh "$SSH_HOST" "$remote_command"

maintenance_flag="$(printf '%q' "${REMOTE_APP_DIR}/.deploy/maintenance.flag")"
maintenance_enabled='false'
if ssh "$SSH_HOST" "test -f ${maintenance_flag}"; then
  maintenance_enabled='true'
  printf '%s\n' 'Bảo trì thủ công đang bật; bỏ qua public health cho tới khi tắt bảo trì.'
fi

if [[ -n "$PUBLIC_HEALTH_URL" && "$maintenance_enabled" == 'false' ]]; then
  printf 'Kiểm tra public HTTPS: %s...\n' "$PUBLIC_HEALTH_URL"
  curl --fail --silent --show-error --retry 3 --retry-delay 2 --max-time 20 "$PUBLIC_HEALTH_URL" >/dev/null || {
    printf '%s\n' 'Release trên VPS healthy nội bộ nhưng kiểm tra public HTTPS thất bại. Hãy kiểm tra DNS/Nginx/Certbot.' >&2
    exit 1
  }
fi

if [[ "$maintenance_enabled" == 'true' ]]; then
  printf '%s\n' 'Deploy healthy nội bộ. Chạy: npm run maintenance:vps -- off'
else
  printf '%s\n' 'Deploy và kiểm tra public HTTPS thành công.'
fi
