#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${PDFTOOLS_APP_DIR:-/var/www/pdftools}"
BRANCH="${PDFTOOLS_BRANCH:-main}"
SERVICE="${PDFTOOLS_SERVICE:-pdftools}"
PREFLIGHT_PORT="${PDFTOOLS_PREFLIGHT_PORT:-13001}"
HEALTH_URL="${PDFTOOLS_HEALTH_URL:-http://127.0.0.1:3001/api/health}"
KEEP_RELEASES="${PDFTOOLS_KEEP_RELEASES:-3}"
MIN_FREE_MB="${PDFTOOLS_MIN_FREE_MB:-1024}"
MIN_AVAILABLE_MEMORY_MB="${PDFTOOLS_MIN_AVAILABLE_MEMORY_MB:-256}"
MAX_LOAD_PER_CPU="${PDFTOOLS_MAX_LOAD_PER_CPU:-2.5}"
INSTALL_TIMEOUT_SECONDS="${PDFTOOLS_INSTALL_TIMEOUT_SECONDS:-600}"
SYNC_TIMEOUT_SECONDS="${PDFTOOLS_SYNC_TIMEOUT_SECONDS:-120}"
RESTART_TIMEOUT_SECONDS="${PDFTOOLS_RESTART_TIMEOUT_SECONDS:-60}"
EXPECTED_REVISION="${PDFTOOLS_EXPECTED_REVISION:-}"
BUILD_ARCHIVE="${PDFTOOLS_BUILD_ARCHIVE:-}"
BUILD_SHA256="${PDFTOOLS_BUILD_SHA256:-}"
NODE_BIN='/usr/bin/node'
NPM_BIN='/usr/bin/npm'
DEPLOY_DIR="${APP_DIR}/.deploy"
RELEASES_DIR="${DEPLOY_DIR}/releases"
DEPENDENCIES_DIR="${DEPLOY_DIR}/dependencies"
INCOMING_DIR="${DEPLOY_DIR}/incoming"
CURRENT_LINK="${DEPLOY_DIR}/current"
MAINTENANCE_PAGE="${DEPLOY_DIR}/maintenance.html"
SHARED_DIR="${DEPLOY_DIR}/shared"
SHARED_DATA_DIR="${SHARED_DIR}/data"

fail() {
  printf 'Lỗi deploy: %s\n' "$1" >&2
  exit 1
}

for command_name in git curl sudo tar flock df awk find sort sed install sha256sum timeout nice uname getconf readlink env cp; do
  command -v "$command_name" >/dev/null 2>&1 || fail "Thiếu lệnh ${command_name}."
done
[[ -x "$NODE_BIN" && -x "$NPM_BIN" ]] || fail 'Thiếu Node/npm system-wide trong /usr/bin.'
[[ "$KEEP_RELEASES" =~ ^[0-9]+$ ]] && ((KEEP_RELEASES >= 2)) || fail 'PDFTOOLS_KEEP_RELEASES phải là số từ 2 trở lên.'
[[ "$MIN_FREE_MB" =~ ^[0-9]+$ ]] || fail 'PDFTOOLS_MIN_FREE_MB phải là số nguyên không âm.'
[[ "$MIN_AVAILABLE_MEMORY_MB" =~ ^[0-9]+$ ]] || fail 'PDFTOOLS_MIN_AVAILABLE_MEMORY_MB phải là số nguyên không âm.'
[[ "$MAX_LOAD_PER_CPU" =~ ^[0-9]+([.][0-9]+)?$ ]] || fail 'PDFTOOLS_MAX_LOAD_PER_CPU phải là số dương.'
[[ "$INSTALL_TIMEOUT_SECONDS" =~ ^[0-9]+$ ]] && ((INSTALL_TIMEOUT_SECONDS >= 60)) \
  || fail 'PDFTOOLS_INSTALL_TIMEOUT_SECONDS phải từ 60 giây trở lên.'
[[ "$SYNC_TIMEOUT_SECONDS" =~ ^[0-9]+$ ]] && ((SYNC_TIMEOUT_SECONDS >= 30)) \
  || fail 'PDFTOOLS_SYNC_TIMEOUT_SECONDS phải từ 30 giây trở lên.'
[[ "$RESTART_TIMEOUT_SECONDS" =~ ^[0-9]+$ ]] && ((RESTART_TIMEOUT_SECONDS >= 10)) \
  || fail 'PDFTOOLS_RESTART_TIMEOUT_SECONDS phải từ 10 giây trở lên.'
[[ -z "$EXPECTED_REVISION" || "$EXPECTED_REVISION" =~ ^[0-9a-f]{40}$ ]] \
  || fail 'PDFTOOLS_EXPECTED_REVISION không hợp lệ.'
[[ -z "$BUILD_SHA256" || "$BUILD_SHA256" =~ ^[0-9a-f]{64}$ ]] \
  || fail 'PDFTOOLS_BUILD_SHA256 không hợp lệ.'
[[ -d "${APP_DIR}/.git" ]] || fail "Không tìm thấy Git repository tại ${APP_DIR}."

mkdir -p "$DEPLOY_DIR" "$RELEASES_DIR" "$DEPENDENCIES_DIR" "$INCOMING_DIR" "$SHARED_DATA_DIR"
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
timeout --signal=TERM --kill-after=10 "${SYNC_TIMEOUT_SECONDS}s" \
  git fetch --prune origin "$BRANCH" \
  || fail "Không đồng bộ được GitHub trong ${SYNC_TIMEOUT_SECONDS} giây."
if [[ -n "$EXPECTED_REVISION" ]]; then
  [[ "$(git rev-parse "origin/${BRANCH}")" == "$EXPECTED_REVISION" ]] \
    || fail 'origin/main đã thay đổi sau lúc tạo gói build; hãy chạy lại deploy để tránh trộn hai commit.'
fi
git merge --ff-only "origin/${BRANCH}"
[[ "$(git rev-parse HEAD)" == "$(git rev-parse "origin/${BRANCH}")" ]] \
  || fail 'HEAD trên VPS chưa trùng commit đã push lên GitHub.'
[[ -z "$EXPECTED_REVISION" || "$(git rev-parse HEAD)" == "$EXPECTED_REVISION" ]] \
  || fail 'Commit trên VPS không trùng commit của gói build.'
[[ -f "${APP_DIR}/deploy/maintenance.html" ]] || fail 'Thiếu giao diện bảo trì trong release nguồn.'
install -m 0644 "${APP_DIR}/deploy/maintenance.html" "$MAINTENANCE_PAGE"

revision="$(git rev-parse --short=12 HEAD)"
build_number="$(git rev-list --count HEAD)"
release_name="$(date -u +%Y%m%d%H%M%S)-${revision}"
release_dir="${RELEASES_DIR}/${release_name}"
release_switched='false'
preflight_log=''
preflight_pid=''
heavy_pid=''
dependency_temp=''
archive_cleanup='false'

cleanup() {
  local status="$?"
  if [[ -n "$preflight_pid" ]] && kill -0 "$preflight_pid" 2>/dev/null; then
    kill "$preflight_pid" 2>/dev/null || true
    wait "$preflight_pid" 2>/dev/null || true
  fi
  if [[ -n "$heavy_pid" ]] && kill -0 "$heavy_pid" 2>/dev/null; then
    kill "$heavy_pid" 2>/dev/null || true
    wait "$heavy_pid" 2>/dev/null || true
  fi
  [[ -z "$preflight_log" ]] || rm -f "$preflight_log"
  if [[ -n "$dependency_temp" && "$dependency_temp" == "${DEPENDENCIES_DIR}/."* ]] \
    && [[ -d "$dependency_temp" ]]; then
    rm -rf -- "$dependency_temp"
  fi
  if [[ "$archive_cleanup" == 'true' && "$BUILD_ARCHIVE" == "${INCOMING_DIR}/"* ]]; then
    rm -f -- "$BUILD_ARCHIVE"
  fi
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

ensure_heavy_step_capacity() {
  [[ -r /proc/meminfo && -r /proc/loadavg ]] \
    || fail 'Không đọc được RAM/load của VPS trước bước nặng.'
  local available_memory_kb minimum_memory_kb load_1 cpu_count load_check_status
  available_memory_kb="$(awk '/^MemAvailable:/ { print $2; exit }' /proc/meminfo)"
  minimum_memory_kb="$((MIN_AVAILABLE_MEMORY_MB * 1024))"
  [[ "$available_memory_kb" =~ ^[0-9]+$ ]] || fail 'Không đọc được MemAvailable của VPS.'
  ((available_memory_kb >= minimum_memory_kb)) \
    || fail "VPS chỉ còn $((available_memory_kb / 1024)) MB RAM khả dụng; cần ít nhất ${MIN_AVAILABLE_MEMORY_MB} MB trước khi cài/build. Release hiện tại vẫn chạy."

  load_1="$(awk '{ print $1 }' /proc/loadavg)"
  cpu_count="$(getconf _NPROCESSORS_ONLN)"
  [[ "$load_1" =~ ^[0-9]+([.][0-9]+)?$ ]] \
    || fail 'Không đọc được load 1 phút của VPS trước bước nặng.'
  [[ "$cpu_count" =~ ^[0-9]+$ ]] && ((cpu_count >= 1)) \
    || fail 'Không đọc được số vCPU của VPS trước bước nặng.'

  # GNU awk dành tên `load` cho extension loader, nên không được dùng tên đó
  # làm biến -v. Phân biệt quá tải thật (exit 1) với lỗi awk (>1) để không
  # báo nhầm một VPS rảnh là đang quá tải.
  if awk -v current_load="$load_1" -v cores="$cpu_count" -v limit="$MAX_LOAD_PER_CPU" \
    'BEGIN { if (current_load <= cores * limit) exit 0; exit 1 }'; then
    load_check_status=0
  else
    load_check_status="$?"
  fi
  ((load_check_status <= 1)) \
    || fail 'Không tính được ngưỡng tải VPS; dừng an toàn trước bước cài/build.'
  ((load_check_status == 0)) \
    || fail "VPS đang quá tải (load ${load_1}, ${cpu_count} vCPU); hoãn bước cài/build để không làm đứng web."
}

run_with_heartbeat() {
  local label="$1"
  shift
  local elapsed=0 command_status
  "$@" &
  heavy_pid="$!"
  while kill -0 "$heavy_pid" 2>/dev/null; do
    sleep 1
    elapsed="$((elapsed + 1))"
    if ((elapsed % 15 == 0)) && kill -0 "$heavy_pid" 2>/dev/null; then
      printf '   … %s vẫn đang chạy (%ss)\n' "$label" "$elapsed"
    fi
  done
  if wait "$heavy_pid"; then command_status=0; else command_status="$?"; fi
  heavy_pid=''
  return "$command_status"
}

install_dependencies() {
  local dependency_mode="$1"
  local install_ok='false'
  for attempt in 1 2; do
    printf 'npm ci (%s), lần %s/2; timeout %ss...\n' "$dependency_mode" "$attempt" "$INSTALL_TIMEOUT_SECONDS"
    if run_with_heartbeat 'cài dependency' \
      env NPM_CONFIG_UPDATE_NOTIFIER=false \
      timeout --signal=TERM --kill-after=15 "${INSTALL_TIMEOUT_SECONDS}s" \
      nice -n 10 "$NPM_BIN" ci "$dependency_mode" \
      --no-audit --no-fund --prefer-offline --progress=false \
      --fetch-retries=2 --fetch-retry-factor=2 \
      --fetch-retry-mintimeout=10000 --fetch-retry-maxtimeout=60000 \
      --fetch-timeout=180000; then
      install_ok='true'
      break
    fi
    if ((attempt < 2)); then
      printf '%s\n' 'npm ci chưa thành công; chờ 10 giây rồi thử lần cuối...' >&2
      sleep 10
    fi
  done
  [[ "$install_ok" == 'true' ]] \
    || fail 'npm ci thất bại hoặc hết thời gian; release hiện tại vẫn được giữ nguyên.'
}

ensure_production_dependencies() {
  local lock_hash node_abi machine_arch dependency_key dependency_dir
  local current_release current_revision current_lock_hash
  lock_hash="$(sha256sum "${release_dir}/package-lock.json" | awk '{print $1}')"
  node_abi="$("$NODE_BIN" -p 'process.versions.modules')"
  machine_arch="$(uname -m)"
  dependency_key="${lock_hash}-${node_abi}-${machine_arch}"
  dependency_dir="${DEPENDENCIES_DIR}/${dependency_key}"

  if [[ -f "${dependency_dir}/.ready" && -d "${dependency_dir}/node_modules" ]]; then
    printf '3/7 Tái sử dụng dependency production đã cache (%s)...\n' "${dependency_key:0:12}"
  else
    dependency_temp="${DEPENDENCIES_DIR}/.${dependency_key}.tmp.$$"
    mkdir -p "$dependency_temp"
    install -m 0644 "${release_dir}/package.json" "${dependency_temp}/package.json"
    install -m 0644 "${release_dir}/package-lock.json" "${dependency_temp}/package-lock.json"
    if [[ -f "${release_dir}/.npmrc" ]]; then
      install -m 0644 "${release_dir}/.npmrc" "${dependency_temp}/.npmrc"
    fi

    current_release=''
    [[ ! -L "$CURRENT_LINK" ]] || current_release="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
    current_revision="${current_release##*-}"
    current_lock_hash=''
    if [[ "$current_revision" =~ ^[0-9a-f]{12}$ \
      && -d "${current_release}/node_modules" && ! -L "${current_release}/node_modules" ]] \
      && git cat-file -e "${current_revision}:package-lock.json" 2>/dev/null; then
      # npm prune của quy trình cũ có thể ghi lại lockfile trong release. Lấy
      # bản gốc từ đúng commit giúp seed cache chính xác mà không tin file đã đổi.
      current_lock_hash="$(git show "${current_revision}:package-lock.json" | sha256sum | awk '{print $1}')"
    fi

    if [[ "$current_lock_hash" == "$lock_hash" ]]; then
      printf '3/7 Khởi tạo cache nhanh từ dependency của release đang chạy (%s)...\n' "${dependency_key:0:12}"
      cp -al "${current_release}/node_modules" "${dependency_temp}/node_modules"
    else
      printf '3/7 Tạo cache dependency production lần đầu (%s)...\n' "${dependency_key:0:12}"
      ensure_heavy_step_capacity
      cd "$dependency_temp"
      install_dependencies '--omit=dev'
    fi
    : >"${dependency_temp}/.ready"
    if [[ -f "${dependency_dir}/.ready" && -d "${dependency_dir}/node_modules" ]]; then
      rm -rf -- "$dependency_temp"
    else
      mv "$dependency_temp" "$dependency_dir"
    fi
    dependency_temp=''
  fi
  ln -s "${dependency_dir}/node_modules" "${release_dir}/node_modules"
}

validate_build_archive() {
  [[ -n "$BUILD_ARCHIVE" && -n "$BUILD_SHA256" ]] \
    || fail 'Gói build và checksum phải được truyền cùng nhau.'
  [[ -f "$BUILD_ARCHIVE" ]] || fail 'Không tìm thấy gói frontend đã tải lên VPS.'
  local incoming_real archive_real actual_sha archive_entries archive_entry
  incoming_real="$(readlink -f "$INCOMING_DIR")"
  archive_real="$(readlink -f "$BUILD_ARCHIVE")"
  [[ "${archive_real%/*}" == "$incoming_real" && "$archive_real" == *.tar.gz ]] \
    || fail 'Gói build phải nằm trực tiếp trong thư mục .deploy/incoming.'
  BUILD_ARCHIVE="$archive_real"
  archive_cleanup='true'
  actual_sha="$(sha256sum "$BUILD_ARCHIVE" | awk '{print $1}')"
  [[ "$actual_sha" == "$BUILD_SHA256" ]] || fail 'Checksum gói build không khớp; không giải nén.'
  archive_entries="$(tar -tzf "$BUILD_ARCHIVE")" || fail 'Không đọc được gói build.'
  while IFS= read -r archive_entry; do
    archive_entry="${archive_entry#./}"
    case "$archive_entry" in
      dist|dist/|dist/*) ;;
      *) fail "Gói build chứa đường dẫn ngoài dist: ${archive_entry}" ;;
    esac
  done <<<"$archive_entries"
}

if [[ -n "$BUILD_ARCHIVE" || -n "$BUILD_SHA256" ]]; then
  validate_build_archive
  ensure_production_dependencies
  printf '%s\n' '4/7 Giải nén frontend đã build và kiểm tra checksum...'
  tar -xzf "$BUILD_ARCHIVE" -C "$release_dir"
  [[ -f "${release_dir}/dist/index.html" ]] || fail 'Gói build thiếu dist/index.html.'
  rm -f -- "$BUILD_ARCHIVE"
  BUILD_ARCHIVE=''
  archive_cleanup='false'
else
  printf '%s\n' '3/7 Không có gói local; dùng chế độ bootstrap nặng trên VPS...'
  ensure_heavy_step_capacity
  cd "$release_dir"
  install_dependencies '--include=dev'
  printf '%s\n' '4/7 Build bootstrap trên VPS và bỏ dependency phát triển...'
  run_with_heartbeat 'build bootstrap' \
    env NPM_CONFIG_UPDATE_NOTIFIER=false \
    timeout --signal=TERM --kill-after=15 "${INSTALL_TIMEOUT_SECONDS}s" \
    nice -n 10 env \
    PDFTOOLS_BUILD_REVISION="$revision" PDFTOOLS_BUILD_NUMBER="$build_number" \
    "$NPM_BIN" run build \
    || fail 'Build bootstrap thất bại hoặc hết thời gian; release hiện tại vẫn chạy.'
  "$NPM_BIN" prune --omit=dev --no-audit --no-fund
fi

cd "$release_dir"

# Đảm bảo dữ liệu thống kê dùng chung vĩnh viễn không mất qua các release
current_running_release=''
if [[ -L "$CURRENT_LINK" ]]; then
  current_running_release="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
fi
if [[ -n "$current_running_release" && -f "${current_running_release}/data/analytics.jsonl" && ! -f "${SHARED_DATA_DIR}/analytics.jsonl" ]]; then
  cp -p "${current_running_release}/data/analytics.jsonl" "${SHARED_DATA_DIR}/analytics.jsonl" || true
fi
rm -rf "${release_dir}/data"
ln -sfn "$SHARED_DATA_DIR" "${release_dir}/data"

printf '5/7 Preflight release trước khi chuyển phiên bản...\n'
preflight_log="$(mktemp)"
NODE_ENV=production HOST=127.0.0.1 PORT="$PREFLIGHT_PORT" "$NODE_BIN" server.js >"$preflight_log" 2>&1 &
preflight_pid="$!"

wait_for_url() {
  local url="$1"
  local attempts="${2:-20}"
  for ((_attempt = 1; _attempt <= attempts; _attempt++)); do
    if curl --fail --silent --max-time 3 "$url" >/dev/null; then return 0; fi
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
  if timeout "${RESTART_TIMEOUT_SECONDS}s" sudo -n /usr/bin/systemctl restart "$SERVICE" \
    && wait_for_url "$HEALTH_URL" 20; then
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
if ! timeout "${RESTART_TIMEOUT_SECONDS}s" sudo -n /usr/bin/systemctl restart "$SERVICE"; then
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

# Chỉ xóa cache không còn release nào tham chiếu; rollback của các release còn
# giữ lại vì thế không bao giờ bị mất node_modules.
for dependency_dir in "${DEPENDENCIES_DIR}"/*; do
  [[ -d "$dependency_dir" ]] || continue
  dependency_in_use='false'
  dependency_modules="$(readlink -f "${dependency_dir}/node_modules" 2>/dev/null || true)"
  for node_modules_link in "${RELEASES_DIR}"/*/node_modules; do
    [[ -L "$node_modules_link" ]] || continue
    if [[ "$(readlink -f "$node_modules_link" 2>/dev/null || true)" == "$dependency_modules" ]]; then
      dependency_in_use='true'
      break
    fi
  done
  if [[ "$dependency_in_use" == 'false' && "$dependency_dir" == "${DEPENDENCIES_DIR}/"* ]]; then
    rm -rf -- "$dependency_dir"
  fi
done
find "$INCOMING_DIR" -mindepth 1 -maxdepth 1 -type f -name '*.tar.gz' -mtime +2 -delete

printf '%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$revision" "$release_name" >>"${DEPLOY_DIR}/deployments.log"
printf 'Deploy thành công commit %s, release %s.\n' "$revision" "$release_name"
