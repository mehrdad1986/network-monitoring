---
status: frozen
title: TCP monitoring repair
---

Repair the existing /app/tcp page without changing its layout. Replace simulated
POST /api/v1/tools/tcp-connect responses with real, context-bound TCP dials.
Preserve host, port, open, connect_time and service response fields; add status
(open, closed, timeout, error). Validate host, port 1–65535 and timeout 1–30s.
Service names describe conventional port assignments, not detected protocols.

Acceptance: local listening and refused ports return measured results; malformed
requests return 400; frontend distinguishes unavailable API from a closed port;
Test All resets after completion and cannot overlap; custom targets validate and
removed targets do not contribute to totals. Refresh remains every 30 seconds.

Design: docs/design/tcp-monitoring-repair.md. Keep existing cards and controls.
Tests: Go local socket tests, React mocked API tests, production frontend build,
and HTTP integration against the running backend. No raw packet privileges needed.
Rollback: reverse only this task's edits; preserve all pre-existing working changes.
Runtime: start existing server with DEMO_MODE=true because no database is running;
TCP probes are real even in this mode. Other endpoints are outside scope.


## Runtime verification and launch
The full server cannot build here: installed Go is 1.22.2, while the existing SNMP
dependency requires 1.24; official toolchain downloads failed. The API package
compiles with installed Go. `backend/cmd/local-api/main.go` runs the same API router
on loopback without a database, scheduler, or SNMP imports. This is local use only.
The running binary is `/tmp/netmon-tcp-api`; restart it with that path. Reboot clears
/tmp. Rebuild with Go 1.24+ using `go build -o /tmp/netmon-tcp-api ./cmd/local-api`
from backend/. Current-session build used `/tmp/netmon-tcp.go.mod`, a temporary copy
with Go 1.22.2 declared; repository go.mod and dependencies are unchanged.
The local server does not validate functionality of unrelated database endpoints.
SystemFirewallRule was renamed solely to resolve a pre-existing duplicate type
that prevented the API package from compiling. Its JSON contract is unchanged.
