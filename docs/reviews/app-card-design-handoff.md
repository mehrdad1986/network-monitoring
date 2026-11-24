# Application visual refinement handoff

Design and acceptance: [app-card-design.md](../specs/app-card-design.md).

## Delivered
- Shared graphite card surfaces, consistent borders/corners, typography and icon tiles across authenticated feature pages. Subtle hover lift, edge light and icon movement; reduced motion disables movement and pulse.
- Monitors device-card refinement with SVG icons, named status badges, readable metric rows and compact utilization bars. Existing demonstration data and action behavior retained.
- Larger vertical menu group labels, emphasis on the most recently opened group, smaller other labels and roomier expanded submenu links. Existing multiple-group expansion and route highlighting preserved.
- System removed from the vertical sidebar and relocated to the upper-right application header. Users, Audit Logs, Settings, MT Backup and Tool Management retain their existing routes. Disclosure supports native keyboard navigation, Escape focus restoration, outside-click dismissal and close on selection.

## Code
- `frontend/src/cards.css`; stylesheet import and header in `frontend/src/App.tsx`.
- `frontend/src/pages/NMS.tsx` and `NMS.css`.
- `frontend/src/components/Navigation.tsx`, `Navigation.css`, `Navigation.test.tsx`.
- `frontend/src/components/SystemMenu.tsx`, `SystemMenu.css`, `SystemMenu.test.tsx`.
- `frontend/scripts/check-layout.cjs`: validates actual positive route-scope selectors and current Home/Realtime ownership instead of obsolete syntactic assumptions.
- Work log: `context/`.

## Verification
- `CI=true npm test -- --watchAll=false --runInBand --silent`: 15 suites, 49 tests passed.
- `npm run build`: passed; existing lint warnings in unrelated pages remain.
- `node scripts/check-layout.cjs`: 57 isolated page stylesheets and 3737 scoped rules passed.
- Scoped `git diff --check`: passed.
- Browser card sweep: 70 registered feature routes at 1440px, 390px and 320px; no viewport overflow. Follow-up checks on six representative routes after Quality specificity correction: zero unstyled cards or overflow.
- Desktop hover verified by computed surface/icon transforms. Separate reduced-motion browser verified no surface/icon movement or status pulse.
- Final browser navigation checks: 10 sidebar groups, larger focused text, smaller other labels, increased submenu spacing, no clipped main labels, keyboard expansion and mobile close passed.
- System menu: all five routes opened at 1440/390/320px; panel fit, sidebar removal, native Tab navigation, Escape focus restoration, outside click and selection dismissal passed.
- Screenshots inspected: `/tmp/netmon-system-menu-1440.png`, `/tmp/netmon-system-menu-320.png`, `/tmp/netmon-sidebar-desktop.png`, `/tmp/netmon-cards-monitors-390.png`, `/tmp/netmon-cards-quality-1440.png`.

## Runtime and limitations
Frontend on 3000; DPI frontend/execution service on 3100; local NetMon API on 8080. Both backend health checks and direct/proxied target list/detail checks passed. The existing target inventory was preserved. The local API intentionally does not run the PostgreSQL monitoring scheduler. Existing demonstration pages and placeholder actions were not converted into live features by this visual work.

No commit or production deployment performed. The repository contains substantial pre-existing changes; review this session against the snapshots in `/tmp/netmon-card-before`.

## Rollback
Restore only this session's source changes from the pre-edit snapshots for App, NMS and Navigation; remove the SystemMenu header/import and shared card stylesheet import. Preserve all unrelated dirty files and `backend/data/targets.json`. The new visual files can remain unused. A rollback is indicated by visual or navigation regressions; verify the prior appearance and route behavior after restoration.
