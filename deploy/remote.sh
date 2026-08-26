#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_HOST="${PDFTOOLS_SSH_HOST:-orace}"
REMOTE_APP_DIR="${PDFTOOLS_APP_DIR:-/var/www/pdftools}"
PUBLIC_HEALTH_URL="${PDFTOOLS_PUBLIC_HEALTH_URL:-https://congcuweb.duckdns.org/api/health}"
source "${ROOT_DIR}/deploy/ssh-options.sh"

cd "$ROOT_DIR"

for command_name in git ssh scp curl npm node tar mktemp du awk; do
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
git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=30 fetch --quiet origin main
local_revision="$(git rev-parse HEAD)"
remote_revision="$(git rev-parse origin/main)"
[[ "$local_revision" == "$remote_revision" ]] || {
  printf '%s\n' 'Commit local chưa trùng origin/main. Hãy pull hoặc push trước khi deploy.' >&2
  exit 1
}

revision_short="$(git rev-parse --short=12 HEAD)"
build_number="$(git rev-list --count HEAD)"
artifact_workspace="$(mktemp -d "${TMPDIR:-/tmp}/pdftools-deploy.XXXXXX")"
artifact_path="${artifact_workspace}/pdftools-${revision_short}.tar.gz"

cleanup() {
  local status="$?"
  if [[ "$artifact_workspace" == "${TMPDIR:-/tmp}/pdftools-deploy."* ]] \
    && [[ -d "$artifact_workspace" ]]; then
    rm -rf -- "$artifact_workspace"
  fi
  trap - EXIT
  exit "$status"
}
trap cleanup EXIT

printf '1/5 Build production trên máy hiện tại cho bản dựng #%s (%s)...\n' "$build_number" "$revision_short"
PDFTOOLS_BUILD_REVISION="$revision_short" \
  PDFTOOLS_BUILD_NUMBER="$build_number" \
  npm run build
[[ -f "${ROOT_DIR}/dist/index.html" ]] || {
  printf '%s\n' 'Build xong nhưng thiếu dist/index.html.' >&2
  exit 1
}

printf '%s\n' '2/5 Đóng gói frontend đã build...'
# COPYFILE_DISABLE chặn AppleDouble; --no-xattrs chặn các PAX header
# LIBARCHIVE.xattr.* của macOS làm GNU tar trên Ubuntu phát cảnh báo.
COPYFILE_DISABLE=1 tar --no-xattrs -czf "$artifact_path" -C "$ROOT_DIR" dist
if command -v shasum >/dev/null 2>&1; then
  artifact_sha256="$(shasum -a 256 "$artifact_path" | awk '{print $1}')"
elif command -v sha256sum >/dev/null 2>&1; then
  artifact_sha256="$(sha256sum "$artifact_path" | awk '{print $1}')"
else
  printf '%s\n' 'Thiếu shasum hoặc sha256sum để kiểm tra gói deploy.' >&2
  exit 1
fi
artifact_size="$(du -h "$artifact_path" | awk '{print $1}')"
remote_incoming_dir="${REMOTE_APP_DIR}/.deploy/incoming"
remote_artifact="${remote_incoming_dir}/${revision_short}-${artifact_sha256:0:12}.tar.gz"

printf '3/5 Kiểm tra SSH và chuẩn bị nơi nhận trên %s...\n' "$SSH_HOST"
remote_mkdir="$(printf 'mkdir -p %q' "$remote_incoming_dir")"
ssh "${PDFTOOLS_SSH_OPTIONS[@]}" "$SSH_HOST" "$remote_mkdir"

printf '4/5 Tải gói %s lên VPS...\n' "$artifact_size"
scp "${PDFTOOLS_SSH_OPTIONS[@]}" "$artifact_path" "${SSH_HOST}:${remote_artifact}"

printf '5/5 Tạo release %s trên VPS; website cũ vẫn phục vụ trong lúc chuẩn bị...\n' "$revision_short"
remote_command="$(printf \
  'cd %q && test -z "$(git status --porcelain)" && test "$(git branch --show-current)" = main && timeout 120 git fetch --prune origin main && test "$(git rev-parse origin/main)" = %q && git merge --ff-only origin/main && PDFTOOLS_EXPECTED_REVISION=%q PDFTOOLS_BUILD_ARCHIVE=%q PDFTOOLS_BUILD_SHA256=%q ./deploy/deploy.sh' \
  "$REMOTE_APP_DIR" "$local_revision" "$local_revision" "$remote_artifact" "$artifact_sha256")"
ssh "${PDFTOOLS_SSH_OPTIONS[@]}" "$SSH_HOST" "$remote_command"

maintenance_flag="$(printf '%q' "${REMOTE_APP_DIR}/.deploy/maintenance.flag")"
maintenance_enabled='false'
if ssh "${PDFTOOLS_SSH_OPTIONS[@]}" "$SSH_HOST" "test -f ${maintenance_flag}"; then
  maintenance_enabled='true'
  printf '%s\n' 'Bảo trì thủ công đang bật; bỏ qua public health cho tới khi tắt bảo trì.'
fi

if [[ -n "$PUBLIC_HEALTH_URL" && "$maintenance_enabled" == 'false' ]]; then
  printf 'Kiểm tra public HTTPS: %s...\n' "$PUBLIC_HEALTH_URL"
  curl --fail --silent --show-error --retry 3 --retry-delay 2 --retry-max-time 45 \
    --connect-timeout 10 --max-time 20 "$PUBLIC_HEALTH_URL" >/dev/null || {
    printf '%s\n' 'Release trên VPS healthy nội bộ nhưng kiểm tra public HTTPS thất bại. Hãy kiểm tra DNS/Nginx/Certbot.' >&2
    exit 1
  }
fi

if [[ "$maintenance_enabled" == 'true' ]]; then
  printf '%s\n' 'Deploy healthy nội bộ. Chạy: npm run maintenance:vps -- off'
else
  printf '%s\n' 'Deploy và kiểm tra public HTTPS thành công.'
fi
