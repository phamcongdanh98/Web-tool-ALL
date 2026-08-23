#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_HOST="${PDFTOOLS_SSH_HOST:-orace}"
REMOTE_APP_DIR="${PDFTOOLS_APP_DIR:-/var/www/pdftools}"

cd "$ROOT_DIR"

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
