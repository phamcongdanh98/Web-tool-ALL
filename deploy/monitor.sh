#!/usr/bin/env bash
set -Eeuo pipefail

SSH_HOST="${PDFTOOLS_SSH_HOST:-orace}"
REMOTE_APP_DIR="${PDFTOOLS_APP_DIR:-/var/www/pdftools}"
SERVICE="${PDFTOOLS_SERVICE:-pdftools}"
WATCH_INTERVAL='5'
WATCH_MODE='false'

usage() {
  cat <<'USAGE'
Cách dùng:
  npm run monitor:vps
  npm run monitor:vps -- --watch [số-giây]

Mặc định lệnh chụp một lần CPU, RAM, swap, ổ đĩa, load, service và health.
Chế độ --watch tự làm mới mỗi 2–60 giây; nhấn Control + C để dừng.
USAGE
}

case "${1:-}" in
  '') ;;
  --watch)
    WATCH_MODE='true'
    WATCH_INTERVAL="${2:-5}"
    ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

[[ "$WATCH_INTERVAL" =~ ^[0-9]+$ ]] && ((WATCH_INTERVAL >= 2 && WATCH_INTERVAL <= 60)) || {
  printf '%s\n' 'Khoảng làm mới phải là số nguyên từ 2 đến 60 giây.' >&2
  exit 2
}

command -v ssh >/dev/null 2>&1 || {
  printf '%s\n' 'Thiếu lệnh ssh trên máy hiện tại.' >&2
  exit 1
}

snapshot() {
  ssh -o ConnectTimeout=10 "$SSH_HOST" bash -s -- "$REMOTE_APP_DIR" "$SERVICE" <<'REMOTE_SCRIPT'
set -Eeuo pipefail
export LC_ALL=C

app_dir="$1"
service="$2"

for command_name in awk basename curl df free getconf ps sed sleep systemctl uptime; do
  command -v "$command_name" >/dev/null 2>&1 || {
    printf 'Thiếu lệnh %s trên VPS.\n' "$command_name" >&2
    exit 1
  }
done
[[ -r /proc/stat && -r /proc/loadavg ]] || {
  printf '%s\n' 'VPS không cung cấp thông tin /proc cần thiết.' >&2
  exit 1
}

cpu_sample() {
  local label user nice system idle iowait irq softirq steal guest guest_nice
  read -r label user nice system idle iowait irq softirq steal guest guest_nice </proc/stat
  printf '%s %s\n' \
    "$((user + nice + system + idle + iowait + irq + softirq + steal))" \
    "$((idle + iowait))"
}

human_mib() {
  awk -v mib="$1" 'BEGIN {
    if (mib >= 1024) printf "%.1f GiB", mib / 1024;
    else printf "%.0f MiB", mib;
  }'
}

level_icon() {
  awk -v value="$1" 'BEGIN {
    if (value >= 85) printf "🔴";
    else if (value >= 70) printf "🟡";
    else printf "🟢";
  }'
}

read -r cpu_total_before cpu_idle_before < <(cpu_sample)
sleep 1
read -r cpu_total_after cpu_idle_after < <(cpu_sample)
cpu_delta_total="$((cpu_total_after - cpu_total_before))"
cpu_delta_idle="$((cpu_idle_after - cpu_idle_before))"
cpu_percent="$(awk -v total="$cpu_delta_total" -v idle="$cpu_delta_idle" 'BEGIN {
  if (total <= 0) print "0.0";
  else printf "%.1f", ((total - idle) * 100) / total;
}')"

read -r mem_total mem_available < <(free -m | awk '/^Mem:/ { print $2, $7 }')
mem_used="$((mem_total - mem_available))"
mem_percent="$(awk -v used="$mem_used" -v total="$mem_total" 'BEGIN {
  if (total <= 0) print "0.0"; else printf "%.1f", used * 100 / total;
}')"
read -r swap_total swap_used < <(free -m | awk '/^Swap:/ { print $2, $3 }')

read -r disk_total disk_used disk_available disk_percent < <(df -Pm "$app_dir" | awk 'NR == 2 {
  used_percent=$5; gsub(/%/, "", used_percent); print $2, $3, $4, used_percent
}')
read -r load_1 load_5 load_15 _ </proc/loadavg
cpu_cores="$(getconf _NPROCESSORS_ONLN)"

service_state="$(systemctl is-active "$service" 2>/dev/null || true)"
nginx_state="$(systemctl is-active nginx 2>/dev/null || true)"
main_pid="$(systemctl show "$service" --property=MainPID --value 2>/dev/null || printf '0')"
process_summary='không có tiến trình'
if [[ "$main_pid" =~ ^[0-9]+$ ]] && ((main_pid > 0)); then
  process_values="$(ps -p "$main_pid" -o %cpu=,%mem=,rss=,etimes= 2>/dev/null | awk 'NR == 1 { print $1, $2, $3, $4 }' || true)"
  if [[ -n "$process_values" ]]; then
    read -r process_cpu process_mem process_rss process_age <<<"$process_values"
    process_rss_mib="$(awk -v kib="$process_rss" 'BEGIN { printf "%.1f", kib / 1024 }')"
    process_summary="PID ${main_pid} · CPU ${process_cpu}% · RAM ${process_rss_mib} MiB · chạy ${process_age}s"
  fi
fi

health_state='❌ Không phản hồi'
if curl --fail --silent --max-time 5 http://127.0.0.1:3001/api/health >/dev/null; then
  health_state='✅ OK'
fi

release_path="$(readlink -f "${app_dir}/.deploy/current" 2>/dev/null || true)"
release_name='chưa có release'
[[ -z "$release_path" ]] || release_name="$(basename "$release_path")"
maintenance_state='TẮT'
[[ ! -f "${app_dir}/.deploy/maintenance.flag" ]] || maintenance_state='ĐANG BẬT'

printf '\n📊 TÀI NGUYÊN VPS PDFTOOLS\n'
printf '🕒 %s · %s\n\n' "$(date -u '+%Y-%m-%d %H:%M:%S UTC')" "$(uptime -p)"
printf '%s CPU    %s%% · %s vCPU · load %s / %s / %s\n' "$(level_icon "$cpu_percent")" "$cpu_percent" "$cpu_cores" "$load_1" "$load_5" "$load_15"
printf '%s RAM    %s / %s (%s%%) · còn %s\n' "$(level_icon "$mem_percent")" "$(human_mib "$mem_used")" "$(human_mib "$mem_total")" "$mem_percent" "$(human_mib "$mem_available")"
printf '⚪ Swap   %s / %s\n' "$(human_mib "$swap_used")" "$(human_mib "$swap_total")"
printf '%s Disk   %s / %s (%s%%) · còn %s\n\n' "$(level_icon "$disk_percent")" "$(human_mib "$disk_used")" "$(human_mib "$disk_total")" "$disk_percent" "$(human_mib "$disk_available")"

if ((swap_total == 0 && mem_total < 2048)); then
  printf '%s\n\n' '⚠️  VPS dưới 2 GiB RAM và chưa có swap; npm ci/build có thể thiếu bộ nhớ khi tải cao.'
fi

[[ "$service_state" == 'active' ]] && service_icon='✅' || service_icon='❌'
[[ "$nginx_state" == 'active' ]] && nginx_icon='✅' || nginx_icon='❌'
printf '%s App     %s · %s\n' "$service_icon" "$service_state" "$process_summary"
printf '%s Nginx   %s\n' "$nginx_icon" "$nginx_state"
printf '🩺 Health  %s\n' "$health_state"
printf '🛠️  Bảo trì %s\n' "$maintenance_state"
printf '🚀 Release %s\n\n' "$release_name"

printf '🔝 Tiến trình dùng nhiều RAM nhất\n'
ps -eo pid=,comm=,%cpu=,%mem=,rss= --sort=-rss | awk 'NR <= 5 {
  printf "   %-7s %-18s CPU %6s%% · RAM %6.1f MiB (%s%%)\n", $1, $2, $3, $5 / 1024, $4
}'
REMOTE_SCRIPT
}

if [[ "$WATCH_MODE" == 'false' ]]; then
  snapshot
  printf 'Gợi ý: npm run monitor:vps -- --watch 5\n'
  exit 0
fi

while true; do
  if [[ -t 1 ]]; then printf '\033[2J\033[H'; fi
  snapshot
  printf 'Tự làm mới sau %s giây · nhấn Control + C để dừng.\n' "$WATCH_INTERVAL"
  sleep "$WATCH_INTERVAL"
done
