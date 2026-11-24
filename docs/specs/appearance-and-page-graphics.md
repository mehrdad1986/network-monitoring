---
status: frozen
classification: feature
---
# Appearance and submenu graphics

## User scope
Implement real appearance preferences and review the graphics of every registered submenu page. Preserve the current navy/blue color families, changing only lightness/depth. Prior card/menu work remains the baseline. Cloudflare is a reference for restrained dashboard structure, clear typography and functional appearance settings, not a brand-color replacement.

## Design and behavior
- Expose Appearance as a Settings subsection at `/app/settings?tab=appearance`, also reachable directly from System. Browser Back and direct links select the correct subsection.
- Provide Dark, Light and Use device mode; three background depths and three related blue accent shades. Default remains balanced dark navy and the current pale blue accent. Settings apply immediately and survive reload through a validated, versioned, non-sensitive local preference record.
- Dark surfaces stay close to `#080e18` / `#111c2b`; light surfaces use a pale blue-gray canvas with white panels and deep navy text. Background depth changes shades within each mode. Coordinate sidebar, content, cards, controls, tables and dropdowns. Increase submenu text contrast in dark mode. Use semantic danger/success/warning colors with readable text.
- Appearance panel uses compact headings, clear option cards with visible selection, short explanatory text, a real live preview and Reset to defaults. Keyboard, storage failures, device-theme changes and reduced motion are handled.
- Replace unreliable presentation emoji with consistent native inline SVG glyphs in actual card/control icon slots; preserve labels and data semantics. Do not hide icons without a visible replacement. Correct shared metric layout according to actual child structure.
- Latency must show readable metric/loading/error bodies rather than empty cards, finish its measuring state, and handle unavailable or invalid measurements without fabricated zero readings.

## Acceptance and verification
1. Appearance navigation works through System and Settings, including direct links and Back.
2. Mode/depth/accent settings visibly apply to application surfaces and persist; malformed or blocked storage safely falls back; device mode tracks OS preference.
3. Menus, submenu labels, cards, tables, controls and page text remain readable in dark/light. Check contrast of standard text roles, selected states and representative numeric/status values.
4. Latency cards have visible icons and consistent layout, show honest loading/error states and recover after failures. Focused tests cover lifecycle and failures.
5. Audit each registered submenu route individually using a route-indexed screenshot inventory and a findings/results matrix. Inspect desktop screenshots, mobile containment, icon visibility and dark/light styling; test safe page tabs and section controls. Record incomplete backend/placeholder features without claiming they are repaired by styling.
6. Complete frontend test suite, production build, CSS isolation and scoped whitespace checks pass. Preserve earlier hover/reduced-motion and System/sidebar navigation behaviors.

## Implementation
Add a shared appearance provider and tokens; integrate the existing Settings appearance section and System menu. Use one shared SVG icon component, surgical presentation updates and evidence-driven page fixes. Keep API routes/authentication/backend behavior and existing user data unchanged.

## Rollback
Use pre-session snapshots in `/tmp/netmon-appearance-before`; preserve all unrelated modified/untracked files and `backend/data/targets.json`. Reset appearance to defaults or remove only its local preference key. No database migration or production deployment.

## Reference
[Cloudflare appearance settings](https://developers.cloudflare.com/fundamentals/user-profiles/customize-account/) and [Cloudflare dark-mode design system](https://blog.cloudflare.com/dark-mode/).
