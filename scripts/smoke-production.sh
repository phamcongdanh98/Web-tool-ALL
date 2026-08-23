#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SMOKE_HOST='127.0.0.1'
SMOKE_PORT="${SMOKE_PORT:-13999}"
BASE_URL="http://${SMOKE_HOST}:${SMOKE_PORT}"

fail() {
  printf 'Smoke test lỗi: %s\n' "$1" >&2
  exit 1
}

for command_name in node curl sed grep mktemp; do
  command -v "$command_name" >/dev/null 2>&1 || fail "Thiếu lệnh ${command_name}."
done
[[ -f "${ROOT_DIR}/dist/index.html" ]] || fail 'Thiếu dist/index.html. Hãy chạy npm run build trước.'

cd "$ROOT_DIR"
server_log="$(mktemp)"
server_pid=''
cleanup() {
  local status="$?"
  if [[ -n "$server_pid" ]] && kill -0 "$server_pid" 2>/dev/null; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  if ((status != 0)); then
    printf '%s\n' '--- Log production smoke test ---' >&2
    tail -n 80 "$server_log" >&2 || true
  fi
  rm -f "$server_log"
  trap - EXIT
  exit "$status"
}
trap cleanup EXIT

NODE_ENV=production HOST="$SMOKE_HOST" PORT="$SMOKE_PORT" node server.js >"$server_log" 2>&1 &
server_pid="$!"

ready='false'
for _attempt in {1..30}; do
  if curl --fail --silent --max-time 5 "${BASE_URL}/api/health" >/dev/null; then
    ready='true'
    break
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then break; fi
  sleep 1
done
[[ "$ready" == 'true' ]] || fail 'Production server không healthy.'

health_json="$(curl --fail --silent --max-time 10 "${BASE_URL}/api/health")"
[[ "$health_json" == *'"status":"ok"'* ]] || fail 'Health response không có status ok.'
curl --fail --silent --max-time 10 "${BASE_URL}/" >/dev/null || fail 'Không tải được trang chủ.'

spa_headers="$(curl --fail --silent --show-error --head --max-time 10 "${BASE_URL}/smoke-test-spa-route")"
printf '%s' "$spa_headers" | grep -qi '^cache-control: no-cache' || fail 'SPA fallback chưa đặt no-cache.'

asset_path="$(sed -n 's/.*src="\([^"]*\/assets\/[^"]*\.js\)".*/\1/p' dist/index.html | head -n 1)"
[[ -n "$asset_path" ]] || fail 'Không tìm thấy asset JavaScript đã hash trong dist/index.html.'
asset_headers="$(curl --fail --silent --show-error --head --max-time 10 "${BASE_URL}${asset_path}")"
printf '%s' "$asset_headers" | grep -qi '^cache-control:.*immutable' || fail 'Asset đã hash chưa có cache immutable.'
printf '%s' "$asset_headers" | grep -qi '^x-powered-by:' && fail 'Express vẫn lộ header X-Powered-By.'
asset_body="$(curl --fail --silent --show-error --max-time 20 "${BASE_URL}${asset_path}")"
printf '%s' "$asset_body" | grep -Fq 'Danh Phạm' || fail 'Bản build chưa hiển thị tên tác giả Danh Phạm.'
printf '%s' "$asset_body" | grep -Fq 'Phiên bản' || fail 'Bản build chưa hiển thị phiên bản thân thiện.'
printf '%s' "$asset_body" | grep -Fq 'Bản dựng #' || fail 'Bản build chưa nhúng số bản dựng theo commit.'

BASE_URL="$BASE_URL" node scripts/e2e-api.mjs

printf 'Smoke test production thành công tại %s.\n' "$BASE_URL"
