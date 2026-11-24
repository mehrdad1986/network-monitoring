# Real-time monitor handoff

## Scope
Replace the /app/realtime placeholder with live TCP connectivity monitoring.
Doc: docs/specs/realtime-monitor.md. Design: docs/design/realtime-monitor.md.
Code: frontend/src/pages/RealtimeDashboard.tsx and RealtimeDashboard.css;
polling: frontend/src/hooks/useRealtimeMonitor.ts; route: frontend/src/App.tsx.
Work log: context/ Engine-realtime-20261025 session.

## Behavior
Four default targets; selectable interval; refresh and pause/resume; validated
custom targets (12 total maximum); latest 30 real samples and 30 status events.
Requests use the existing TCP API. Failed API calls remain distinct from closed
ports. Targets/history exist only while this page is mounted. No WebSocket stream
is claimed. Timing starts after each completed batch, preventing overlap.

## Review
Verdict: PASS. No new endpoint, dependency, credential storage or HTML injection.
Inputs render as React text; named targets are bounded; arrays are capped;
navigation/pause cancels requests and timers; previous generations cannot publish
late results. API errors show in the dashboard and log with operation context.
The existing local backend binds 127.0.0.1. This frontend change does not add
authorization or alter the existing API's access policy.

## Verification
Focused component and hook tests cover real response mapping, refresh/pause/
resume, duplicate/invalid targets, custom target removal, failed API calls,
cancellation, lack of overlapping batches, and 30-item retention under 36 checks.
Firefox isolated component preview used real backend data; four targets reached,
pause worked, desktop 1440px and narrow 500px views had no outer overflow.
The preview avoids reading or changing the user's login session. Route wiring and
HTTP response are checked separately. Screenshots: /tmp/netmon-realtime-desktop.png
and /tmp/netmon-realtime-mobile.png (temporary local artifacts).
Production build passed with pre-existing unrelated warnings.

## Runtime and limits
Frontend remains on localhost:3000; local API remains on 127.0.0.1:8080 using
/tmp/netmon-traceroute-api. Full scheduler/SNMP launch still requires a newer Go
toolchain; this page needs only the already-running, verified TCP endpoint.
Unexpected browser failures log to console; no external crash reporter is set up.
No reload persistence or background monitoring after navigation is implemented.

## Rollback and resume
Restore only the realtime route import/element and original placeholder export;
remove the new realtime page/style/hook/tests. Preserve TCP/traceroute repairs and
all pre-existing user changes. Verify page rendering, API health and TCP regression
tests after rollback. Next work should start from the current dirty working tree,
not a reset. No additional feature work is required for the stated scope.
