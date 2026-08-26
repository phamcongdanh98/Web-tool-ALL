#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_SCRIPT="${ROOT_DIR}/deploy/deploy.sh"
REMOTE_SCRIPT="${ROOT_DIR}/deploy/remote.sh"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/pdftools-deploy-test.XXXXXX")"

cleanup() {
  rm -rf -- "$TEST_DIR"
}
trap cleanup EXIT

grep -Fq 'awk -v current_load="$load_1"' "$DEPLOY_SCRIPT" || {
  printf '%s\n' 'Deploy guard chưa dùng tên biến awk tương thích GNU awk.' >&2
  exit 1
}
if grep -Eq 'awk[[:space:]].*-v[[:space:]]+load=' "$DEPLOY_SCRIPT"; then
  printf '%s\n' 'Không được dùng `load` làm biến -v của GNU awk.' >&2
  exit 1
fi

load_is_safe() {
  local current_load="$1"
  local cores="$2"
  local limit="$3"
  awk -v current_load="$current_load" -v cores="$cores" -v limit="$limit" \
    'BEGIN { if (current_load <= cores * limit) exit 0; exit 1 }'
}

load_is_safe 0.08 2 2.5 || {
  printf '%s\n' 'Load thấp bị nhận nhầm là quá tải.' >&2
  exit 1
}
if load_is_safe 5.01 2 2.5; then
  printf '%s\n' 'Load vượt ngưỡng không bị chặn.' >&2
  exit 1
fi

grep -Fq 'tar --no-xattrs -czf' "$REMOTE_SCRIPT" || {
  printf '%s\n' 'Gói deploy chưa tắt extended attributes của macOS.' >&2
  exit 1
}

printf 'artifact test\n' >"${TEST_DIR}/asset.txt"
if command -v xattr >/dev/null 2>&1; then
  xattr -w com.apple.provenance pdftools-test "${TEST_DIR}/asset.txt" 2>/dev/null || true
fi
COPYFILE_DISABLE=1 tar --no-xattrs -cf "${TEST_DIR}/artifact.tar" \
  -C "$TEST_DIR" asset.txt
if LC_ALL=C grep -aqE 'LIBARCHIVE\.xattr|SCHILY\.xattr|com\.apple\.provenance' \
  "${TEST_DIR}/artifact.tar"; then
  printf '%s\n' 'Archive deploy vẫn chứa extended attribute của macOS.' >&2
  exit 1
fi

printf '%s\n' 'Deploy portability hợp lệ: load guard GNU awk và archive không xattr.'
