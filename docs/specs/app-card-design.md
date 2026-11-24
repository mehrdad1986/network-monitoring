---
status: frozen
classification: feature
---
# Application card design

## Scope and authorization
The user requests a professional, beautiful card redesign on Monitors and all `/app/...` feature pages. This is one shared visual system with a Monitors reference implementation. Existing navigation, data, API calls, actions and authentication retain their behavior. DPI is a separate document and retains its own design.

## Implementation-ready design
- Authenticated app scope only: graphite navy canvas `#080e18`, elevated surfaces `#101b2b` to `#0d1522`, slate hairline borders, 16px corners and restrained inset highlights/shadows.
- Primary accents are ice blue `#88c7ff` and teal `#65d6c0`. Success, warning and danger retain distinct meaningful colors. No decorative charts or fabricated data.
- KPI cards use 22px padding, 12px uppercase labels, 28px tabular values and 40px monochrome icon tiles. Detailed cards retain page structure, gain consistent surfaces and 16–24px internal spacing.
- Headers use 28px system-sans headings, small uppercase section labels and 14px secondary text. Controls use 36–40px height, 9px corners and visible keyboard focus.
- Hover adds a 3px lift, soft edge light and gentle icon tilt on pointer devices. Monitors status dots have a quiet ring while hovered. The user explicitly requested these microinteractions. Reduced motion disables movement and animation; touch devices keep stable cards. No external fonts, images or runtime dependencies.
- Monitors device cards use outlined device icons, named status pills, hostname/IP hierarchy, divided metric rows, thin utilization tracks and a separated action footer. Existing device and summary values remain unchanged.
- Responsive grids respect content width, wrapping at tablet/mobile sizes. Long names/IPs wrap. Inputs, tables and navigation remain usable at 390px and 320px.

## Plan
1. Add scoped shared card styles in `frontend/src/cards.css`, imported after `layout.css` by `App.tsx`. Cover actual card class tokens across registered feature pages while excluding card headers/bodies and grid containers.
2. Refine `NMS.tsx` and `NMS.css` with semantic status text, SVG icons and consistent metric/footer layout.
3. Verify production build, existing layout checks and frontend tests. Check all registered routes in a real browser at desktop and mobile widths; inspect screenshots of Monitors and representative card families. Exercise Targets create/detail and primary card controls where available.
4. Record evidence and handoff in `docs/reviews/app-card-design-handoff.md` and the Engine work log.

## Acceptance
- All authenticated feature cards receive the same elevated surface, border and corner system, with readable metrics and meaningful status accents.
- Monitors has polished KPI/device cards without emoji status dots or distorted metric rows.
- No horizontal document overflow or overlapping visible controls introduced at desktop/mobile; wide data tables scroll locally.
- Keyboard focus and reduced-motion preferences work; no new data/network behavior.
- Builds and relevant regression checks pass. Browser evidence identifies any existing page limitations separately.

## User-authorized navigation refinement
Main navigation group labels increase from 9px to 11px. The most recently expanded group uses 12px warm accent text, while other groups use 10.5px muted labels. Its submenu items gain 48px minimum height and 6px vertical margins, with 13px labels and a short reveal animation. Maintain the current multi-group expansion behavior, route highlighting, deep-link expansion, keyboard controls, mobile close behavior, and reduced-motion support. `Navigation.tsx` tracks visual group focus separately from expanded groups; `Navigation.css` owns its presentation.

## User-authorized System menu relocation
Remove the System group and its five links from the vertical sidebar. Add a slim header above each `/app` feature page with a System disclosure aligned to the right. Its 240px navy panel contains Users (`/app/users`), Audit Logs (`/app/audit-logs`), Settings (`/app/settings`), MT Backup (`/app/backup`), and Tool Management (`/app/tool-management`). Use native accessible links, a 38px trigger, 40px item rows, visible keyboard focus and current-page indication. Close on outside pointer click, Escape, or navigation; Escape restores trigger focus. Keep the mobile sidebar toggle unobstructed and contain the menu within a 320px viewport. Preserve existing routes and page contents.

## Rollback
Preserve the existing dirty working tree. Restore only the three source-file snapshots in `/tmp/netmon-card-before`, and remove the new shared stylesheet import. Target inventory and running backends remain untouched.
