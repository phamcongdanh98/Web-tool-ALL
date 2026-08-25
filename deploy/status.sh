#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_HOST="${PDFTOOLS_SSH_HOST:-orace}"
REMOTE_APP_DIR="${PDFTOOLS_APP_DIR:-/var/www/pdftools}"
PUBLIC_HEALTH_URL="${PDFTOOLS_PUBLIC_HEALTH_URL:-https://congcuweb.duckdns.org/api/health}"
PUBLIC_SITE_URL="${PDFTOOLS_PUBLIC_SITE_URL:-${PUBLIC_HEALTH_URL%/api/health}}"
source "${ROOT_DIR}/deploy/ssh-options.sh"

fail() {
  printf '❌ Không kiểm tra được trạng thái: %s\n' "$1" >&2
  exit 1
}

for command_name in git ssh curl node sed; do
  command -v "$command_name" >/dev/null 2>&1 || fail "thiếu lệnh ${command_name}."
done

cd "$ROOT_DIR"
git fetch --quiet origin main || fail 'không kết nối được GitHub.'

branch="$(git branch --show-current)"
local_revision="$(git rev-parse HEAD)"
github_revision="$(git rev-parse origin/main)"
app_version="$(node -p "JSON.parse(require('fs').readFileSync('package.json', 'utf8')).version")"
local_build="$(git rev-list --count HEAD)"
github_build="$(git rev-list --count origin/main)"
dirty='false'
[[ -z "$(git status --porcelain)" ]] || dirty='true'

remote_repo="$(printf '%q' "$REMOTE_APP_DIR")"
remote_current="$(printf '%q' "${REMOTE_APP_DIR}/.deploy/current")"
remote_maintenance="$(printf '%q' "${REMOTE_APP_DIR}/.deploy/maintenance.flag")"
remote_command="$(printf 'git -C %s rev-parse HEAD\nreadlink -f %s' "$remote_repo" "$remote_current")"
remote_command+=$'\n'
remote_command+="if test -f ${remote_maintenance}; then echo on; else echo off; fi"
remote_info="$(ssh "${PDFTOOLS_SSH_OPTIONS[@]}" "$SSH_HOST" "$remote_command")" \
  || fail "không kết nối được SSH host ${SSH_HOST} trong ${PDFTOOLS_SSH_CONNECT_TIMEOUT} giây."
vps_revision="$(printf '%s\n' "$remote_info" | sed -n '1p')"
running_path="$(printf '%s\n' "$remote_info" | sed -n '2p')"
maintenance_state="$(printf '%s\n' "$remote_info" | sed -n '3p')"
[[ -n "$vps_revision" && -n "$running_path" ]] || fail 'VPS chưa có repository hoặc release đang chạy.'

running_revision="${running_path##*-}"
vps_build="$(git rev-list --count "$vps_revision" 2>/dev/null || printf '?')"
running_build="$(git rev-list --count "$running_revision" 2>/dev/null || printf '?')"
local_suffix=''
[[ "$dirty" == 'false' ]] || local_suffix='-dev'

if [[ -t 1 ]]; then
  green=$'\033[32m'
  yellow=$'\033[33m'
  red=$'\033[31m'
  bold=$'\033[1m'
  reset=$'\033[0m'
else
  green=''
  yellow=''
  red=''
  bold=''
  reset=''
fi

asset_encoding=''
if [[ "$maintenance_state" == 'on' ]]; then
  website_state="${yellow}🛠️  Bảo trì thủ công${reset}"
  asset_state="${yellow}⏸️  Tạm dừng kiểm tra${reset}"
elif curl --fail --silent --show-error --max-time 15 "$PUBLIC_HEALTH_URL" >/dev/null; then
  website_state="${green}✅ Online${reset}"
  public_html="$(curl --fail --silent --show-error --max-time 15 "${PUBLIC_SITE_URL}/" || true)"
  public_asset="$(printf '%s' "$public_html" | sed -n 's/.*src="\([^"]*\/assets\/[^"]*\.js\)".*/\1/p' | sed -n '1p')"
  if [[ -n "$public_asset" ]]; then
    asset_headers="$(curl --fail --silent --show-error --head --max-time 15 -H 'Accept-Encoding: br, gzip' "${PUBLIC_SITE_URL}${public_asset}" || true)"
    asset_encoding="$(printf '%s' "$asset_headers" | sed -n 's/^[Cc]ontent-[Ee]ncoding:[[:space:]]*\([^[:space:]]*\).*/\1/p' | sed -n '1p')"
  fi
else
  website_state="${red}❌ Không phản hồi${reset}"
fi

if [[ "$maintenance_state" == 'on' ]]; then
  :
elif [[ "$asset_encoding" == 'br' || "$asset_encoding" == 'gzip' ]]; then
  asset_state="${green}✅ ${asset_encoding}${reset}"
else
  asset_state="${yellow}⚠️  Chưa nén${reset}"
fi

printf '\n%s🔎 TRẠNG THÁI PDFTOOLS%s\n\n' "$bold" "$reset"
printf '💻 Mac       Phiên bản %s · Bản dựng #%s%s  (%s)\n' "$app_version" "$local_build" "$local_suffix" "${local_revision:0:7}"
printf '☁️  GitHub    Phiên bản %s · Bản dựng #%s      (%s)\n' "$app_version" "$github_build" "${github_revision:0:7}"
printf '🖥️  VPS repo  Phiên bản %s · Bản dựng #%s      (%s)\n' "$app_version" "$vps_build" "${vps_revision:0:7}"
printf '🚀 Đang chạy Phiên bản %s · Bản dựng #%s      (%s)\n' "$app_version" "$running_build" "${running_revision:0:7}"
printf '🌐 Website   %s\n' "$website_state"
if [[ "$maintenance_state" == 'on' ]]; then
  printf '🛠️  Bảo trì   %sĐANG BẬT%s\n\n' "$yellow" "$reset"
else
  printf '🛠️  Bảo trì   %sTắt%s\n\n' "$green" "$reset"
fi
printf '📦 Asset web %s\n\n' "$asset_state"

if [[ "$maintenance_state" == 'on' ]]; then
  printf '\n🛠️  Website đang bảo trì thủ công. Khi cập nhật xong chạy: npm run maintenance:vps -- off\n'
elif [[ "$dirty" == 'true' ]]; then
  printf '%s⚠️  Mac có file chưa commit.%s\n' "$yellow" "$reset"
elif [[ "$local_revision" == "$github_revision" ]]; then
  printf '%s✅ Mac và GitHub đã đồng bộ.%s\n' "$green" "$reset"
else
  printf '%s⚠️  Mac và GitHub đang khác nhau.%s\n' "$yellow" "$reset"
fi

if [[ "$vps_revision" == "$github_revision" && "$running_revision" == "${github_revision:0:12}" ]]; then
  printf '%s✅ VPS đang chạy đúng phiên bản mới nhất trên GitHub.%s\n' "$green" "$reset"
else
  printf '%s⚠️  VPS chưa chạy phiên bản mới nhất trên GitHub.%s\n' "$yellow" "$reset"
fi

if [[ "$dirty" == 'true' ]]; then
  printf '\n➡️  Hãy verify, commit và push các file đang sửa trước.\n'
elif [[ "$local_revision" != "$github_revision" ]]; then
  printf '\n➡️  Hãy đồng bộ Mac với GitHub trước khi deploy.\n'
elif [[ "$vps_revision" != "$github_revision" || "$running_revision" != "${github_revision:0:12}" ]]; then
  printf '\n➡️  Website cần cập nhật. Chạy: npm run deploy:vps\n'
elif [[ -z "$asset_encoding" ]]; then
  printf '\n⚡ Code đã đồng bộ nhưng asset public chưa được nén. Chạy setup Nginx một lần.\n'
else
  printf '\n🎉 Mọi nơi đã đồng bộ, không cần làm gì thêm.\n'
fi

printf '\nNhánh local: %s · SSH: %s\n' "$branch" "$SSH_HOST"
