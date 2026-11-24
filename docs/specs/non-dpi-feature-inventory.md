---
status: draft
classification: feature
---
# Non-DPI feature inventory and remaining backend work

User selection: **all non-DPI submenus**, including all ten sidebar groups and System. DPI Tools and `dpi-frontend/` are excluded. This inventory records the expanded user scope; the appearance/graphics spec remains the UI acceptance reference.

## Result boundary
The UI audit covers 72 registered route/view entries in dark/light at 1440px and 390px. Passing layout checks does **not** make the underlying feature operational. Preview data is identified in the application header and rebuilt summary pages. Several existing backend handlers also return fixed demo totals; PostgreSQL startup alone will not replace them with real monitoring.

Frontend and local diagnostic API are running at ports 3000 and 8080. Persistent monitoring endpoints return a clear 503 because the full PostgreSQL-backed service is unavailable. Docker socket access is denied even outside the sandbox; PostgreSQL binaries are absent. No privileged host changes, database migrations, device writes or notification delivery were performed.

## Additive local backend contract
- `GET /api/v1/tools/catalog`: sorted registered tool metadata (`name`, `binary`, `category`, `description`, `installed`) plus `count` and source. PATH checks only; no command execution or installation.
- `GET /api/v1/activity`: newest 100 actual startup/saved-target creation records (`id`, `time`, `category`, `action`). No target names, addresses or credentials. Scope and limit are explicit. This is a limited local activity view.
- Both routes use the existing loopback Host/Origin boundary. Existing target storage, routes and data are preserved. The normal production API/auth contracts are unchanged.
- Backup setup reads existing `GET /api/v1/targets`, selects actual router targets, and links to target setup. It does not pretend backups have been collected.

## Page-by-page inventory
“Checked” means layout, sampled text contrast and native icon visibility were inspected; safe internal tabs are recorded separately in the browser report. “Preview” means the displayed values/actions still require backend implementation or integration.

| Group | Route/view | UI | Backend status and remaining work |
|---|---|---|---|
| additional registered view | `/app/` | Checked | Preview dashboard totals and simulated charts; replace with real monitoring aggregates. |
| system | `/app/settings?tab=appearance` | Checked | Real browser appearance preferences; dark/light/device, shades and persistence. |
| additional registered view | `/app/realtime` | Checked | Real TCP/HTTP checks through existing local diagnostic service; browser-session history. |
| monitoring | `/app/targets` | Checked | Local file inventory; scheduler and measurement history unavailable. |
| monitoring | `/app/monitors` | Checked | Preview. Device/website collectors, scheduler, persistence and management actions remain to implement/connect. |
| monitoring | `/app/probes` | Checked | Full PostgreSQL service unavailable; registration, agents and heartbeat integration remain to configure/verify. |
| monitoring | `/app/website-monitor` | Checked | Preview. Device/website collectors, scheduler, persistence and management actions remain to implement/connect. |
| performance | `/app/latency` | Checked | Real latency requests; validated errors and cancellation; host/network capability dependent. |
| performance | `/app/network-performance` | Checked | Browser measurements and existing speed-test API; no historical monitoring store. |
| performance | `/app/throughput` | Checked | Preview. Replace simulated/static values with measured data and persistent aggregates. |
| performance | `/app/quality` | Checked | Preview. Replace simulated/static values with measured data and persistent aggregates. |
| performance | `/app/sla` | Checked | Preview. Replace simulated/static values with measured data and persistent aggregates. |
| protocols | `/app/icmp` | Checked | On-demand ICMP API; host permissions and destination reachability required. |
| protocols | `/app/tcp` | Checked | Real TCP connection API; no packet fabrication. |
| protocols | `/app/udp` | Checked | On-demand UDP API; timeout semantics depend on destination protocol. |
| protocols | `/app/dns-servers` | Checked | Existing ping/DoH diagnostic APIs; external resolvers must be reachable. |
| protocols | `/app/http-monitoring` | Checked | Existing HTTP diagnostic API; target URL and network policy apply. |
| protocols | `/app/tls-certificates` | Checked | Existing TLS-check API; target must be reachable. |
| diagnostics | `/app/diagnostics` | Checked | Preview. Existing view contains demo controls/data; connect it to actual diagnostics and event sources. |
| diagnostics | `/app/ping-tools` | Checked | Preview. Existing view contains demo controls/data; connect it to actual diagnostics and event sources. |
| diagnostics | `/app/traceroute` | Checked | Existing traceroute API; command availability and permissions required. |
| additional registered view | `/app/vpn` | Checked | Preview. Host/device collectors, persistence and authorized management actions remain to implement/connect. |
| diagnostics | `/app/mtu-discovery` | Checked | Existing MTU API; raw-socket/network capabilities required. |
| diagnostics | `/app/packet-capture` | Checked | Existing capture API; capture tool and interface privileges required. |
| diagnostics | `/app/network-tools` | Checked | Existing diagnostic API; per-tool availability/errors shown. |
| routing | `/app/as-path` | Checked | Preview. Routing/BGP feed or router integration and persistent route history remain to implement/connect. |
| routing | `/app/route-monitoring` | Checked | Preview. Routing/BGP feed or router integration and persistent route history remain to implement/connect. |
| routing | `/app/bgp-intelligence` | Checked | Preview. Routing/BGP feed or router integration and persistent route history remain to implement/connect. |
| routing | `/app/routing-history` | Checked | Preview. Routing/BGP feed or router integration and persistent route history remain to implement/connect. |
| additional registered view | `/app/system-dashboard` | Checked | Preview. Host/device collectors, persistence and authorized management actions remain to implement/connect. |
| additional registered view | `/app/infrastructure` | Checked | Preview API response data. Replace demo handlers with configured collectors and management services. |
| additional registered view | `/app/diagnostics-dashboard` | Checked | Preview API response data. Replace demo handlers with configured collectors and management services. |
| additional registered view | `/app/network-management` | Checked | Preview. Host/device collectors, persistence and authorized management actions remain to implement/connect. |
| additional registered view | `/app/firewall-management` | Checked | Preview. Host/device collectors, persistence and authorized management actions remain to implement/connect. |
| additional registered view | `/app/service-management` | Checked | Preview. Host/device collectors, persistence and authorized management actions remain to implement/connect. |
| additional registered view | `/app/storage-management` | Checked | Preview. Host/device collectors, persistence and authorized management actions remain to implement/connect. |
| additional registered view | `/app/user-management` | Checked | Preview user/profile data. Real identity, authorization and persistent management are not implemented by this UI work. |
| additional registered view | `/app/software-updates` | Checked | Preview. Host/device collectors, persistence and authorized management actions remain to implement/connect. |
| system | `/app/settings` | Checked | Appearance is validated, applied and persisted locally. Other pre-existing settings are session/demo controls. |
| additional registered view | `/app/profile` | Checked | Preview user/profile data. Real identity, authorization and persistent management are not implemented by this UI work. |
| additional registered view | `/app/iran-monitor` | Checked | Preview. Host/device collectors, persistence and authorized management actions remain to implement/connect. |
| additional registered view | `/app/radar` | Checked | Preview. Host/device collectors, persistence and authorized management actions remain to implement/connect. |
| additional registered view | `/app/discovery` | Checked | Preview. Host/device collectors, persistence and authorized management actions remain to implement/connect. |
| additional registered view | `/app/flows` | Checked | Preview. Host/device collectors, persistence and authorized management actions remain to implement/connect. |
| additional registered view | `/app/performance` | Checked | Preview. Host/device collectors, persistence and authorized management actions remain to implement/connect. |
| infrastructure | `/app/devices` | Checked | Preview. Device inventory/credentials, SNMP or agent collectors and management APIs remain to implement/connect. |
| infrastructure | `/app/snmp` | Checked | Preview. Device inventory/credentials, SNMP or agent collectors and management APIs remain to implement/connect. |
| infrastructure | `/app/interfaces` | Checked | Preview. Device inventory/credentials, SNMP or agent collectors and management APIs remain to implement/connect. |
| infrastructure | `/app/topology` | Checked | Preview. Device inventory/credentials, SNMP or agent collectors and management APIs remain to implement/connect. |
| infrastructure | `/app/datacenters` | Checked | Preview. Device inventory/credentials, SNMP or agent collectors and management APIs remain to implement/connect. |
| isp | `/app/isp-comparison` | Checked | Preview. Provider/location/address configuration, collectors and persistence remain to implement/connect. |
| additional registered view | `/app/isp-management` | Checked | Preview API response data. Replace demo handlers with configured collectors and management services. |
| isp | `/app/ipv4-monitoring` | Checked | Preview. Provider/location/address configuration, collectors and persistence remain to implement/connect. |
| isp | `/app/ipv6-monitoring` | Checked | Preview. Provider/location/address configuration, collectors and persistence remain to implement/connect. |
| isp | `/app/multi-location` | Checked | Preview. Provider/location/address configuration, collectors and persistence remain to implement/connect. |
| isp | `/app/connectivity` | Checked | Preview. Provider/location/address configuration, collectors and persistence remain to implement/connect. |
| incidents | `/app/alerts` | Checked | Preview. Real incident/rule persistence, evaluation and notification-provider delivery remain to implement/connect. |
| incidents | `/app/incidents` | Checked | Preview. Real incident/rule persistence, evaluation and notification-provider delivery remain to implement/connect. |
| incidents | `/app/alert-rules` | Checked | Preview. Real incident/rule persistence, evaluation and notification-provider delivery remain to implement/connect. |
| incidents | `/app/notifications` | Checked | Preview. Real incident/rule persistence, evaluation and notification-provider delivery remain to implement/connect. |
| analytics | `/app/historical` | Checked | Preview. Measurement storage, retention, queries and actual report aggregations remain to implement/connect. |
| analytics | `/app/trends` | Checked | Preview. Measurement storage, retention, queries and actual report aggregations remain to implement/connect. |
| analytics | `/app/availability` | Checked | Preview. Measurement storage, retention, queries and actual report aggregations remain to implement/connect. |
| analytics | `/app/capacity-planning` | Checked | Preview. Measurement storage, retention, queries and actual report aggregations remain to implement/connect. |
| analytics | `/app/comparative` | Checked | Preview. Measurement storage, retention, queries and actual report aggregations remain to implement/connect. |
| applications | `/app/api-monitoring` | Checked | Preview. Endpoint/database/CDN configuration, collectors and provider APIs remain to implement/connect. |
| applications | `/app/database-monitoring` | Checked | Preview. Endpoint/database/CDN configuration, collectors and provider APIs remain to implement/connect. |
| applications | `/app/cdn-performance` | Checked | Preview. Endpoint/database/CDN configuration, collectors and provider APIs remain to implement/connect. |
| system | `/app/users` | Checked | Preview user/profile data. Real identity, authorization and persistent management are not implemented by this UI work. |
| system | `/app/audit-logs` | Checked | NEW real read-only local activity endpoint; startup plus target creation records, capped at 100. Not a comprehensive security audit trail. |
| system | `/app/backup` | Checked | Actual saved router targets load; RouterOS backup collection and agent are not implemented/configured. |
| system | `/app/tool-management` | Checked | NEW real read-only PATH-based catalog of 51 registered tools; no installation or command execution. |

Target detail (`/app/targets/:id`) is data-dependent and is checked separately against the existing saved target. It reads actual inventory and explicitly shows that no measurements have been recorded.

## Next backend implementation sequence
1. Establish the intended local or remote monitoring environment and PostgreSQL access. Keep the running diagnostic service and existing target file intact.
2. Connect/verify persistent targets, probes, monitors, scheduler and measurement ingestion. Define which devices, sites and probe locations should be monitored.
3. Replace device/routing/ISP demo handlers with configured collectors. Router/SNMP/BGP/VPN operations need actual device access and explicit configuration; do not invent live metrics.
4. Add real incident/rule storage, evaluation and notification delivery after provider configuration is supplied securely.
5. Build historical reports and application/database/CDN monitoring from collected measurements and the selected provider APIs.
6. Implement real user/admin workflows with authentication/authorization review. Existing simulated login/profile screens are not production identity management.

## Rollback and evidence
Restore only this work unit's frontend source from `/tmp/netmon-appearance-before`; remove additive local catalog/activity registration and rebuild the previous local API if needed. Preserve all unrelated modified/untracked files and `backend/data/targets.json`. No database migration was introduced.

Detailed validation, screenshots, remaining limitations and review references are in `docs/reviews/appearance-and-page-graphics-handoff.md`. The reproducible graphical sweep is `frontend/scripts/check-appearance-browser.cjs`; CSS scoping is checked by `frontend/scripts/check-layout.cjs`.
