#!/usr/bin/env bash

# Cấu hình dùng chung cho mọi kết nối từ máy phát triển tới VPS.
# ConnectTimeout chặn tình trạng chờ vô hạn trước khi SSH bắt tay; keepalive
# phát hiện sớm kết nối đã chết trong lúc deploy hoặc theo dõi tài nguyên.
PDFTOOLS_SSH_CONNECT_TIMEOUT="${PDFTOOLS_SSH_CONNECT_TIMEOUT:-15}"
PDFTOOLS_SSH_KEEPALIVE_INTERVAL="${PDFTOOLS_SSH_KEEPALIVE_INTERVAL:-10}"
PDFTOOLS_SSH_KEEPALIVE_COUNT="${PDFTOOLS_SSH_KEEPALIVE_COUNT:-3}"

for ssh_number in \
  "$PDFTOOLS_SSH_CONNECT_TIMEOUT" \
  "$PDFTOOLS_SSH_KEEPALIVE_INTERVAL" \
  "$PDFTOOLS_SSH_KEEPALIVE_COUNT"; do
  [[ "$ssh_number" =~ ^[1-9][0-9]*$ ]] || {
    printf '%s\n' 'Các timeout SSH phải là số nguyên dương.' >&2
    return 2 2>/dev/null || exit 2
  }
done
unset ssh_number

PDFTOOLS_SSH_OPTIONS=(
  -o BatchMode=yes
  -o "ConnectTimeout=${PDFTOOLS_SSH_CONNECT_TIMEOUT}"
  -o ConnectionAttempts=1
  -o TCPKeepAlive=yes
  -o "ServerAliveInterval=${PDFTOOLS_SSH_KEEPALIVE_INTERVAL}"
  -o "ServerAliveCountMax=${PDFTOOLS_SSH_KEEPALIVE_COUNT}"
)
