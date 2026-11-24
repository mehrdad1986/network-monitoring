---
status: frozen
title: Real-time connectivity monitor
---

Create /app/realtime as one live connectivity dashboard using existing verified
POST /api/v1/tools/tcp-connect. User requested creation of this page. Reuse the
current app shell; design source is docs/design/realtime-monitor.md.

Requirements:
- Replace the route's placeholder with a standalone page; retain navigation.
- Default targets: Google DNS TCP 53, Cloudflare HTTPS 443, Quad9 DNS TCP 53,
  and the local NetMon API TCP 8080. All measurements originate at the backend.
- Poll with user-selectable 5/10/30-second interval after each completed batch;
  no overlapping batches, 10-second request deadline and cleanup on navigation.
- Pause aborts in-flight checks; resume and refresh start a fresh batch.
- Cards show reachable, closed/timeouts, mean connect time for reachable targets,
  and session check count. API failures remain distinct from unreachable ports.
- Table shows status, latest measured latency, last completed check and latest
  30 actual samples per target, with gaps for unavailable/failed connections.
- Latest 30 state transitions form the event feed; initial state is recorded.
- Add validated host/port/name targets, reject duplicates, max 12 total, remove
  custom targets. Data is session-local; no credential storage or persistence.
- Preserve older readings while a new batch is pending, with checking indicator.

Verification: mocked real TCP contract tests for polling, pause/resume, request
cancellation, unavailable API, counters, target changes and bounded history;
frontend production build; live proxy checks and route HTTP response.
No backend contract or dependency change is needed. Existing backend zap logs
receive probe failures; UI logs unexpected API errors with operation context.
Local monitoring only; no production crash reporter is configured.
Rollback: restore only this route import/element and remove new page/hook/styles;
preserve all earlier TCP/traceroute work and unrelated user changes.
