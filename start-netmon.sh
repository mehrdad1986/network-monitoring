#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
bash "$ROOT/setup-netmon.sh"

python_tag="$(python3 -c 'import platform, sys; print(f"{sys.version_info.major}.{sys.version_info.minor}-{platform.machine()}")')"
root_tag="$(printf '%s' "$ROOT" | sha256sum | cut -c1-10)"
venv_root="$ROOT/.netmon-venvs/${python_tag}-${root_tag}"
check_python="$venv_root/checks/bin/python"
dpi_python="$venv_root/dpi/bin/python"
pids=()

cleanup() {
  trap - EXIT INT TERM
  for pid in "${pids[@]}"; do
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  done
  for pid in "${pids[@]}"; do wait "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

ready() { curl -fsS --max-time 2 "$1" >/dev/null 2>&1; }

start_service() {
  local name="$1" url="$2" directory="$3"
  shift 3
  if ready "$url"; then
    printf '%s is already available.\n' "$name"
    return
  fi
  setsid bash -c 'cd "$1" && shift && exec "$@"' netmon "$directory" "$@" &
  local pid=$!
  pids+=("$pid")
  for _ in $(seq 1 90); do
    if ready "$url"; then
      printf '%s ready: %s\n' "$name" "$url"
      return
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      printf '%s failed to start; see its startup output above.\n' "$name" >&2
      exit 1
    fi
    sleep 1
  done
  printf '%s did not become ready at %s.\n' "$name" "$url" >&2
  exit 1
}

start_service 'NetMon API' 'http://127.0.0.1:8080/api/v1/targets' "$ROOT/backend" \
  env NETMON_TARGETS_FILE="$ROOT/backend/data/targets.json" "$ROOT/.runtime/netmon-local-api"
start_service 'DPI service' 'http://127.0.0.1:3100/api/health' "$ROOT" \
  env PORT=3100 DPI_BACKEND_DIR="$ROOT/integrations/dpi-apps" DPI_PYTHON="$dpi_python" \
  node "$ROOT/dpi-frontend/scripts/serve.mjs"
start_service 'Monitoring checks' 'http://127.0.0.1:3200/api/checks/doh?page=1' "$ROOT" \
  env NETMON_CHECK_APPS="$ROOT/integrations/check-apps" "$check_python" "$ROOT/scripts/check_service.py"
start_service 'Iran monitor data' 'http://127.0.0.1:4174/site.json' "$ROOT" \
  python3 -m http.server 4173 --bind 127.0.0.1 --directory "$ROOT/integrations/iran-internet-monitor/data"
start_service 'NetMon frontend' 'http://127.0.0.1:3000/' "$ROOT/frontend" \
  env BROWSER=none HOST=127.0.0.1 PORT=3000 "$ROOT/frontend/node_modules/.bin/react-scripts" start

if ((${#pids[@]} == 0)); then
  printf 'All NetMon services were already healthy.\n'
  exit 0
fi

printf '\nNetMon is running at http://127.0.0.1:3000\nPress Ctrl+C to stop services started by this command.\n'
wait -n "${pids[@]}"
