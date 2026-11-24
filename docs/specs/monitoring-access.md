---
status: frozen
---
# Monitoring access checks

Integrate the user-supplied Python apps from `/home/xxx/Desktop/check py apps`
into NetMon's Monitoring menu and show their live output and saved CSV results.
Design: `docs/design/monitoring-access.md`, implementing the user's requested
sidebar submenus and right-side results layout.

Acceptance: six deep-linkable submenus, saved reports with source timestamps,
bounded opt-in scans, live polling, stop control, responsive accessible layout,
honest filtering/legal-restriction labels. Existing navigation is preserved.

Bridge: loopback-only stdlib Python service on 3200 behind `/check-tools` dev
proxy. Fixed script allowlist; no shell; isolated temporary outputs; one scan at
a time; 15-minute deadline; local Origin/Host and same-origin proxy validation.
GET `/api/checks/:category?page=1` returns state, bounded log and paginated rows;
POST `/api/checks/:category` starts a scan with `{limit:20,target:"1.1.1.1"}`;
DELETE stops it. Categories share website results. Failed runs never reuse old
results as their own. Saved reports are explicitly labeled historical.

No source-script changes, automatic scans, privilege escalation, sanctions
claims, database changes, or replacement of existing diagnostics. Runtime
dependencies and physical-interface permissions remain those of the supplied
apps; failures appear in the live panel. Rollback only task-specific edits.

## Local operation

Run `python3 scripts/check_service.py` from the repository and start the existing
frontend with `npm start` from `frontend/`. The proxy configuration requires a
frontend restart on first installation. `NETMON_CHECK_APPS` can override the
checker directory. The bridge requires Python 3.9+; the supplied apps retain
their own Python/dependency requirements. Run results live under `/tmp/netmon-check-*`
and are retained until OS temporary-file cleanup. The bridge serves the newest
run per group while alive; after restart it loads the source folder's saved reports.
BGP lookup uses the existing `/api/v1/tools/bgp-route` backend, independently of
the Python route analyzer. No production reverse-proxy deployment is included.
