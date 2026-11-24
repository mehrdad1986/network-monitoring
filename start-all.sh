#!/usr/bin/env bash
# Portable one-command launcher for the NetMon application and local services.
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$ROOT/start-netmon.sh"
