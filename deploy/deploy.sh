#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${PDFTOOLS_APP_DIR:-/var/www/pdftools}"
BRANCH="${PDFTOOLS_BRANCH:-main}"
SERVICE="${PDFTOOLS_SERVICE:-pdftools}"
PREFLIGHT_PORT="${PDFTOOLS_PREFLIGHT_PORT:-13001}"
NODE_BIN='/usr/bin/node'
NPM_BIN='/usr/bin/npm'
DEPLOY_DIR="${APP_DIR}/.deploy"
RELEASES_DIR="${DEPLOY_DIR}/releases"
CURRENT_LINK="${DEPLOY_DIR}/current"

fail() {
  printf 'Lỗi deploy: %s\n' "$1" >&2
  exit 1
}

for command_name in git curl sudo tar; do
  command -v "$command_name" >/dev/null 2>&1 || fail "Thiếu lệnh ${command_name}."
done
[[ -x "$NODE_BIN" && -x "$NPM_BIN" ]] || fail 'Thiếu Node/npm system-wide trong /usr/bin.'

[[ -d "${APP_DIR}/.git" ]] || fail "Không tìm thấy Git repository tại ${APP_DIR}."
cd "$APP_DIR"

current_branch="$(git branch --show-current)"
[[ "$current_branch" == "$BRANCH" ]] || fail "Đang ở nhánh ${current_branch:-detached}, cần nhánh ${BRANCH}."
[[ -z "$(git status --porcelain)" ]] || fail 'Repository trên VPS có thay đổi chưa commit. Hãy xử lý trước khi deploy.'

printf '1/7 Đồng bộ origin/%s...\n' "$BRANCH"
git fetch --prune origin "$BRANCH"
git merge --ff-only "origin/${BRANCH}"

revision="$(git rev-parse --short=12 HEAD)"
release_name="$(date -u +%Y%m%d%H%M%S)-${revision}"
release_dir="${RELEASES_DIR}/${release_name}"
mkdir -p "$release_dir"

printf '2/7 Tạo release độc lập %s...\n' "$release_name"
git archive --format=tar HEAD | tar -xf - -C "$release_dir"

printf '3/7 Cài dependency theo package-lock.json...\n'
cd "$release_dir"
"$NPM_BIN" ci --include=dev --no-audit --no-fund

printf '4/7 Build production và bỏ dependency chỉ dùng khi phát triển...\n'
"$NPM_BIN" run build
"$NPM_BIN" prune --omit=dev --no-audit --no-fund

printf '5/7 Chạy kiểm tra production trước khi chuyển phiên bản...\n'
preflight_log="$(mktemp)"
preflight_pid=''
cleanup_preflight() {
  if [[ -n "$preflight_pid" ]] && kill -0 "$preflight_pid" 2>/dev/null; then
    kill "$preflight_pid" 2>/dev/null || true
    wait "$preflight_pid" 2>/dev/null || true
  fi
  rm -f "$preflight_log"
}
trap cleanup_preflight EXIT

NODE_ENV=production HOST=127.0.0.1 PORT="$PREFLIGHT_PORT" "$NODE_BIN" server.js >"$preflight_log" 2>&1 &
preflight_pid="$!"

preflight_ok='false'
for _attempt in {1..20}; do
  if curl --fail --silent "http://127.0.0.1:${PREFLIGHT_PORT}/api/health" >/dev/null \
    && curl --fail --silent "http://127.0.0.1:${PREFLIGHT_PORT}/" >/dev/null; then
    preflight_ok='true'
    break
  fi
  if ! kill -0 "$preflight_pid" 2>/dev/null; then break; fi
  sleep 1
done

if [[ "$preflight_ok" != 'true' ]]; then
  printf '%s\n' '--- Log preflight ---' >&2
  tail -n 60 "$preflight_log" >&2 || true
  fail 'Bản mới không vượt qua kiểm tra; phiên bản đang chạy được giữ nguyên.'
fi

cleanup_preflight
preflight_pid=''
trap - EXIT

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
  if [[ -n "$previous_release" && -d "$previous_release" ]]; then
    printf 'Khôi phục release trước: %s\n' "$(basename "$previous_release")" >&2
    switch_release "$previous_release"
    sudo -n /usr/bin/systemctl restart "$SERVICE" || true
  fi
}

printf '6/7 Chuyển release và restart %s...\n' "$SERVICE"
switch_release "$release_dir"
if ! sudo -n /usr/bin/systemctl restart "$SERVICE"; then
  rollback
  fail 'Không restart được dịch vụ. Đã thử khôi phục release trước.'
fi

printf '7/7 Kiểm tra dịch vụ sau restart...\n'
production_health_url="${PDFTOOLS_HEALTH_URL:-http://127.0.0.1:3001/api/health}"
production_ok='false'
for _attempt in {1..20}; do
  if curl --fail --silent "$production_health_url" >/dev/null; then
    production_ok='true'
    break
  fi
  sleep 1
done

if [[ "$production_ok" != 'true' ]]; then
  /usr/bin/systemctl status "$SERVICE" --no-pager --lines=60 || true
  rollback
  fail "Dịch vụ không healthy tại ${production_health_url}; đã thử khôi phục release trước."
fi

# Giữ ba release gần nhất để có điểm quay lại mà không làm đầy ổ đĩa.
mapfile -t release_paths < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn | sed 's/^[^ ]* //')
for ((index = 3; index < ${#release_paths[@]}; index++)); do
  old_release="${release_paths[$index]}"
  if [[ "$old_release" != "$previous_release" && "$old_release" != "$release_dir" ]]; then
    rm -rf -- "$old_release"
  fi
done

printf 'Deploy thành công commit %s, release %s.\n' "$revision" "$release_name"
