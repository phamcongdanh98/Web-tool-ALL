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

maintenance_file="${ROOT_DIR}/deploy/maintenance.html"
maintenance_nginx="${ROOT_DIR}/deploy/nginx-maintenance.conf"
[[ -f "$maintenance_file" && -f "$maintenance_nginx" ]] || fail 'Thiếu giao diện hoặc Nginx fallback bảo trì.'
grep -Fq '<title>PDFTools đang cập nhật</title>' "$maintenance_file" || fail 'Trang bảo trì thiếu tiêu đề.'
grep -Fq 'http-equiv="refresh" content="15"' "$maintenance_file" || fail 'Trang bảo trì chưa tự thử lại sau 15 giây.'
grep -Fq 'Thử tải lại ngay' "$maintenance_file" || fail 'Trang bảo trì thiếu nút tải lại.'
if grep -Eq 'https?://' "$maintenance_file"; then fail 'Trang bảo trì không được phụ thuộc tài nguyên mạng ngoài.'; fi
grep -Fq 'error_page 502 503 504 =503' "$maintenance_nginx" || fail 'Nginx chưa chuyển lỗi upstream sang HTTP 503 bảo trì.'
grep -Fq 'Retry-After "15" always' "$maintenance_nginx" || fail 'Trang bảo trì thiếu Retry-After.'
grep -Fq 'include /etc/nginx/snippets/pdftools-maintenance.conf;' "${ROOT_DIR}/deploy/nginx.conf" || fail 'Nginx site chưa include fallback bảo trì.'
grep -Fq 'proxy_intercept_errors on;' "${ROOT_DIR}/deploy/nginx.conf" || fail 'Nginx chưa chặn lỗi upstream để hiển thị bảo trì.'
grep -Fq '/var/www/pdftools/.deploy/maintenance.flag' "${ROOT_DIR}/deploy/nginx.conf" || fail 'Nginx chưa hỗ trợ bật bảo trì thủ công.'
grep -Fq 'client_max_body_size 51M;' "${ROOT_DIR}/deploy/nginx.conf" || fail 'Nginx cần cho phép body 51 MB để chứa tệp 50 MB cùng multipart overhead.'
grep -Fq 'DPkg::Lock::Timeout=' "${ROOT_DIR}/deploy/setup-ubuntu.sh" || fail 'Setup Ubuntu chưa chờ khóa dpkg/apt.'
grep -Fq 'wait_for_apt' "${ROOT_DIR}/deploy/setup-ubuntu.sh" || fail 'Setup Ubuntu thiếu thông báo chờ cập nhật tự động.'
grep -Fq 'PDFTOOLS_BUILD_ARCHIVE' "${ROOT_DIR}/deploy/remote.sh" || fail 'Deploy local chưa truyền gói frontend đã build.'
grep -Fq 'scp "${PDFTOOLS_SSH_OPTIONS[@]}"' "${ROOT_DIR}/deploy/remote.sh" || fail 'Deploy local chưa tải artifact bằng kết nối SSH có timeout.'
grep -Fq 'PDFTOOLS_EXPECTED_REVISION' "${ROOT_DIR}/deploy/deploy.sh" || fail 'Deploy chưa khóa artifact vào đúng commit.'
grep -Fq 'sha256sum "$BUILD_ARCHIVE"' "${ROOT_DIR}/deploy/deploy.sh" || fail 'Deploy chưa kiểm tra checksum artifact.'
grep -Fq 'Tái sử dụng dependency production đã cache' "${ROOT_DIR}/deploy/deploy.sh" || fail 'Deploy chưa tái sử dụng dependency production.'
grep -Fq 'Khởi tạo cache nhanh từ dependency của release đang chạy' "${ROOT_DIR}/deploy/deploy.sh" || fail 'Deploy chưa seed cache từ release production hiện có.'
grep -Fq 'ensure_heavy_step_capacity' "${ROOT_DIR}/deploy/deploy.sh" || fail 'Deploy chưa chặn bước nặng khi VPS thiếu tài nguyên.'
grep -Fq 'timeout --signal=TERM --kill-after=15' "${ROOT_DIR}/deploy/deploy.sh" || fail 'npm ci/build trên VPS chưa có timeout hữu hạn.'
grep -Fq 'vẫn đang chạy' "${ROOT_DIR}/deploy/deploy.sh" || fail 'Deploy thiếu heartbeat cho bước nặng.'
(
  # shellcheck source=../deploy/ssh-options.sh
  source "${ROOT_DIR}/deploy/ssh-options.sh"
  printf '%s\n' "${PDFTOOLS_SSH_OPTIONS[@]}" | grep -Fq 'ConnectTimeout=' \
    || fail 'Tùy chọn SSH thiếu ConnectTimeout.'
  printf '%s\n' "${PDFTOOLS_SSH_OPTIONS[@]}" | grep -Fq 'ServerAliveInterval=' \
    || fail 'Tùy chọn SSH thiếu keepalive.'
)
bash "${ROOT_DIR}/deploy/monitor.sh" --help >/dev/null || fail 'Lệnh monitor:vps không hiển thị được hướng dẫn.'
bash "${ROOT_DIR}/deploy/maintenance.sh" --help >/dev/null || fail 'Lệnh maintenance:vps không hiển thị được hướng dẫn.'

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

NODE_ENV=production HOST="$SMOKE_HOST" PORT="$SMOKE_PORT" MAX_UPLOAD_TOTAL_MB=50 MAX_CONCURRENT_JOBS=2 node server.js >"$server_log" 2>&1 &
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
compressed_headers="$(curl --fail --silent --show-error --head --max-time 10 -H 'Accept-Encoding: br, gzip' "${BASE_URL}${asset_path}")"
printf '%s' "$compressed_headers" | grep -qi '^content-encoding: br' || fail 'Production chưa phục vụ asset Brotli.'
printf '%s' "$compressed_headers" | grep -qi '^vary:.*accept-encoding' || fail 'Asset nén chưa có Vary: Accept-Encoding.'
asset_body="$(curl --compressed --fail --silent --show-error --max-time 20 "${BASE_URL}${asset_path}")"
grep -Fq 'Danh Phạm' <<<"$asset_body" || fail 'Bản build chưa hiển thị tên tác giả Danh Phạm.'
grep -Fq 'Phiên bản' <<<"$asset_body" || fail 'Bản build chưa hiển thị phiên bản thân thiện.'
grep -Fq 'Bản dựng #' <<<"$asset_body" || fail 'Bản build chưa nhúng số bản dựng theo commit.'

BASE_URL="$BASE_URL" node scripts/e2e-api.mjs

printf 'Smoke test production thành công tại %s.\n' "$BASE_URL"
