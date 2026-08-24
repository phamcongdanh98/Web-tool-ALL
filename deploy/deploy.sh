#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${PDFTOOLS_APP_DIR:-/var/www/pdftools}"
BRANCH="${PDFTOOLS_BRANCH:-main}"
SERVICE="${PDFTOOLS_SERVICE:-pdftools}"
PREFLIGHT_PORT="${PDFTOOLS_PREFLIGHT_PORT:-13001}"
HEALTH_URL="${PDFTOOLS_HEALTH_URL:-http://127.0.0.1:3001/api/health}"
KEEP_RELEASES="${PDFTOOLS_KEEP_RELEASES:-3}"
MIN_FREE_MB="${PDFTOOLS_MIN_FREE_MB:-1024}"
NODE_BIN='/usr/bin/node'
NPM_BIN='/usr/bin/npm'
DEPLOY_DIR="${APP_DIR}/.deploy"
RELEASES_DIR="${DEPLOY_DIR}/releases"
CURRENT_LINK="${DEPLOY_DIR}/current"
MAINTENANCE_PAGE="${DEPLOY_DIR}/maintenance.html"

fail() {
  printf 'Lỗi deploy: %s\n' "$1" >&2
  exit 1
}

for command_name in git curl sudo tar flock df awk find sort sed install; do
  command -v "$command_name" >/dev/null 2>&1 || fail "Thiếu lệnh ${command_name}."
done
[[ -x "$NODE_BIN" && -x "$NPM_BIN" ]] || fail 'Thiếu Node/npm system-wide trong /usr/bin.'
[[ "$KEEP_RELEASES" =~ ^[0-9]+$ ]] && ((KEEP_RELEASES >= 2)) || fail 'PDFTOOLS_KEEP_RELEASES phải là số từ 2 trở lên.'
[[ "$MIN_FREE_MB" =~ ^[0-9]+$ ]] || fail 'PDFTOOLS_MIN_FREE_MB phải là số nguyên không âm.'
[[ -d "${APP_DIR}/.git" ]] || fail "Không tìm thấy Git repository tại ${APP_DIR}."

mkdir -p "$DEPLOY_DIR" "$RELEASES_DIR"
exec 9>"${DEPLOY_DIR}/deploy.lock"
flock -n 9 || fail 'Một tiến trình deploy khác đang chạy. Hãy chờ tiến trình đó hoàn tất.'

available_kb="$(df -Pk "$APP_DIR" | awk 'NR == 2 { print $4 }')"
required_kb="$((MIN_FREE_MB * 1024))"
[[ "$available_kb" =~ ^[0-9]+$ ]] || fail 'Không đọc được dung lượng trống của VPS.'
((available_kb >= required_kb)) || fail "VPS còn dưới ${MIN_FREE_MB} MB trống; dừng deploy để tránh hỏng release."

cd "$APP_DIR"
current_branch="$(git branch --show-current)"
[[ "$current_branch" == "$BRANCH" ]] || fail "Đang ở nhánh ${current_branch:-detached}, cần nhánh ${BRANCH}."
[[ -z "$(git status --porcelain)" ]] || fail 'Repository trên VPS có thay đổi chưa commit. Hãy xử lý trước khi deploy.'

printf '1/7 Đồng bộ chính xác origin/%s...\n' "$BRANCH"
git fetch --prune origin "$BRANCH"
git merge --ff-only "origin/${BRANCH}"
[[ "$(git rev-parse HEAD)" == "$(git rev-parse "origin/${BRANCH}")" ]] \
  || fail 'HEAD trên VPS chưa trùng commit đã push lên GitHub.'
[[ -f "${APP_DIR}/deploy/maintenance.html" ]] || fail 'Thiếu giao diện bảo trì trong release nguồn.'
install -m 0644 "${APP_DIR}/deploy/maintenance.html" "$MAINTENANCE_PAGE"

revision="$(git rev-parse --short=12 HEAD)"
build_number="$(git rev-list --count HEAD)"
release_name="$(date -u +%Y%m%d%H%M%S)-${revision}"
release_dir="${RELEASES_DIR}/${release_name}"
release_switched='false'
preflight_log=''
preflight_pid=''

cleanup() {
  local status="$?"
  if [[ -n "$preflight_pid" ]] && kill -0 "$preflight_pid" 2>/dev/null; then
    kill "$preflight_pid" 2>/dev/null || true
    wait "$preflight_pid" 2>/dev/null || true
  fi
  [[ -z "$preflight_log" ]] || rm -f "$preflight_log"
  if ((status != 0)) && [[ "$release_switched" != 'true' ]] \
    && [[ "$release_dir" == "${RELEASES_DIR}/"* ]] && [[ -d "$release_dir" ]]; then
    rm -rf -- "$release_dir"
  fi
  trap - EXIT
  exit "$status"
}
trap cleanup EXIT

mkdir -p "$release_dir"
printf '2/7 Tạo release độc lập %s...\n' "$release_name"
git archive --format=tar HEAD | tar -xf - -C "$release_dir"

printf '3/7 Cài dependency khóa cứng, có retry mạng...\n'
cd "$release_dir"
install_ok='false'
for attempt in 1 2 3; do
  if "$NPM_BIN" ci --include=dev --no-audit --no-fund --prefer-offline \
    --fetch-retries=5 --fetch-retry-factor=2 \
    --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 \
    --fetch-timeout=600000; then
    install_ok='true'
    break
  fi
  if ((attempt < 3)); then
    printf 'npm ci lỗi mạng/lifecycle, thử lại lần %s/3 sau %s giây...\n' "$((attempt + 1))" "$((attempt * 10))" >&2
    sleep "$((attempt * 10))"
  fi
done
[[ "$install_ok" == 'true' ]] || fail 'npm ci thất bại sau ba lần; release hiện tại vẫn được giữ nguyên.'

printf '4/7 Build production và bỏ dependency chỉ dùng khi phát triển...\n'
PDFTOOLS_BUILD_REVISION="$revision" PDFTOOLS_BUILD_NUMBER="$build_number" "$NPM_BIN" run build
"$NPM_BIN" prune --omit=dev --no-audit --no-fund

printf '5/7 Preflight release trước khi chuyển phiên bản...\n'
preflight_log="$(mktemp)"
NODE_ENV=production HOST=127.0.0.1 PORT="$PREFLIGHT_PORT" "$NODE_BIN" server.js >"$preflight_log" 2>&1 &
preflight_pid="$!"

wait_for_url() {
  local url="$1"
  local attempts="${2:-20}"
  for ((_attempt = 1; _attempt <= attempts; _attempt++)); do
    if curl --fail --silent --max-time 10 "$url" >/dev/null; then return 0; fi
    sleep 1
  done
  return 1
}

if ! wait_for_url "http://127.0.0.1:${PREFLIGHT_PORT}/api/health" \
  || ! wait_for_url "http://127.0.0.1:${PREFLIGHT_PORT}/"; then
  printf '%s\n' '--- Log preflight ---' >&2
  tail -n 60 "$preflight_log" >&2 || true
  fail 'Bản mới không vượt qua preflight; phiên bản đang chạy được giữ nguyên.'
fi

kill "$preflight_pid" 2>/dev/null || true
wait "$preflight_pid" 2>/dev/null || true
preflight_pid=''
rm -f "$preflight_log"
preflight_log=''

previous_release=''
if [[ -L "$CURRENT_LINK" ]]; then
  previous_release="$(readlink -f "$CURRENT_LINK")"
fi

switch_release() {
  local target="$1"
  local next_link="${DEPLOY_DIR}/current-next"
  rm -f "$next_link"
  ln -s "$target" "$next_link"
  mv -Tf "$next_link" "$CURRENT_LINK"
}

rollback() {
  [[ -n "$previous_release" && -d "$previous_release" ]] || return 1
  printf 'Khôi phục release trước: %s\n' "$(basename "$previous_release")" >&2
  switch_release "$previous_release"
  if sudo -n /usr/bin/systemctl restart "$SERVICE" && wait_for_url "$HEALTH_URL" 20; then
    release_switched='false'
    printf '%s\n' 'Rollback thành công.' >&2
    return 0
  fi
  printf '%s\n' 'Rollback không healthy; cần kiểm tra systemd ngay.' >&2
  return 1
}

printf '6/7 Chuyển release nguyên tử và restart %s...\n' "$SERVICE"
switch_release "$release_dir"
release_switched='true'
if ! sudo -n /usr/bin/systemctl restart "$SERVICE"; then
  rollback || true
  fail 'Không restart được dịch vụ.'
fi

printf '7/7 Kiểm tra dịch vụ sau restart...\n'
if ! wait_for_url "$HEALTH_URL" 20; then
  /usr/bin/systemctl status "$SERVICE" --no-pager --lines=60 || true
  rollback || true
  fail "Dịch vụ không healthy tại ${HEALTH_URL}."
fi

mapfile -t release_paths < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn | sed 's/^[^ ]* //')
for ((index = KEEP_RELEASES; index < ${#release_paths[@]}; index++)); do
  old_release="${release_paths[$index]}"
  if [[ "$old_release" != "$previous_release" && "$old_release" != "$release_dir" ]]; then
    rm -rf -- "$old_release"
  fi
done

printf '%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$revision" "$release_name" >>"${DEPLOY_DIR}/deployments.log"
printf 'Deploy thành công commit %s, release %s.\n' "$revision" "$release_name"
