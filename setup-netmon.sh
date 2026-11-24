#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="${PYTHON:-python3}"

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Required command is missing: %s\n' "$1" >&2
    exit 1
  fi
}

for command_name in go node npm "$PYTHON" curl setsid sha256sum; do
  need_command "$command_name"
done

node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
if (( node_major < 18 )); then
  printf 'Node.js 18 or newer is required; found %s.\n' "$(node --version)" >&2
  exit 1
fi

python_tag="$("$PYTHON" -c 'import platform, sys; print(f"{sys.version_info.major}.{sys.version_info.minor}-{platform.machine()}")')"
root_tag="$(printf '%s' "$ROOT" | sha256sum | cut -c1-10)"
venv_root="$ROOT/.netmon-venvs/${python_tag}-${root_tag}"
check_python="$venv_root/checks/bin/python"
dpi_python="$venv_root/dpi/bin/python"

ensure_venv() {
  local path="$1" requirements="$2"
  if [[ ! -x "$path/bin/python" ]]; then
    "$PYTHON" -m venv "$path" || {
      printf 'Could not create a Python environment. On Ubuntu install python3-venv, then rerun this script.\n' >&2
      exit 1
    }
  fi
  "$path/bin/python" -m pip install -r "$requirements"
}

if [[ ! -x "$ROOT/frontend/node_modules/.bin/react-scripts" ]]; then
  (cd "$ROOT/frontend" && npm ci)
fi

ensure_venv "$venv_root/checks" "$ROOT/integrations/check-apps/requirements.txt"
ensure_venv "$venv_root/dpi" "$ROOT/integrations/dpi-apps/requirements.txt"

mkdir -p "$ROOT/.runtime" "$ROOT/backend/data"
(
  cd "$ROOT/backend"
  GOTOOLCHAIN=auto go build -o "$ROOT/.runtime/netmon-local-api" ./cmd/local-api
)

printf 'NetMon dependencies are ready.\n'
