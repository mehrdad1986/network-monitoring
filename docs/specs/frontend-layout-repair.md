# Frontend layout repair

Classification: hotfix. This fixes the existing frontend's layout regressions; it adds no features.

## Root cause

Forty-four page/base CSS files have identical generic content, replacing the original structural layouts in tracked pages. Eagerly imported page styles also share global selectors and animation names. Overview's nested `.main-content` collides with the application shell.

## Design reference

Restore the existing page-specific layouts from the repository HEAD where the current stylesheet was replaced by generic boilerplate. Retain the current dark navy backgrounds, cyan/blue accents, cards, sidebar navigation and repaired login. The current TSX page structure is the component specification. This is restoration and sizing correction authorized by the user's request, not a redesign.

Implementation-ready sizing: body 14px/1.5 using the system sans-serif stack; page titles 28px maximum (22px on small screens), section headings 18–20px, card headings 16px, metric values 24–28px. Inputs/buttons use inherited fonts; form controls wrap with at least 8px gaps. Page padding is owned by the shell, 24px desktop and 12–16px mobile. Charts/cards use min-width:0. Wide tables scroll within their containers. Sidebar remains 240px and collapses at the existing 768px breakpoint.

## Plan and target files

1. Restore original layout rules only for active page stylesheets matching the generic boilerplate, then scope active page CSS to named route wrappers and namespace animations. Targets: imported `frontend/src/pages/*.css`, `frontend/src/App.tsx`. Verify with CSS parsing and per-route style-scope coverage checks.
2. Separate shell selectors from page selectors and introduce a shared compact typography/responsive stylesheet. Targets: `frontend/src/App.css`, `frontend/src/index.css`, `frontend/src/components/Navigation.css` if browser evidence requires, `frontend/src/layout.css` (new). Verify heading sizes, font consistency, table containment and navigation at desktop/mobile widths.
3. Add focused stylesheet regression checks and browser route/layout checks. Targets: `frontend/scripts/check-layout.cjs` (new), `frontend/scripts/check-layout-browser.cjs` (new). Temporary browser dependencies stay in /tmp. Verify login, dashboard, every registered app route, internal tabs, narrow widths and long content.
4. Review actual session diff and run production build plus regression checks; document exact results and remaining data limitations in the work log.

## Acceptance criteria

- Each active page stylesheet is isolated from other pages and the navigation; repeated generic replacements no longer discard original page structure.
- Main content does not acquire a second sidebar margin; page titles and primary metrics are bounded and use a consistent font.
- Headers, filters, cards and tabs wrap or scroll on small screens without covering adjacent controls. Tables retain their columns and scroll locally when needed.
- Login remains usable. Every route receives browser checks at desktop and mobile widths. Production build passes with existing warnings reported.
- No authentication, backend, API, or data behavior changes.

## Risks and rollback

Original CSS can reference older class names; validate against current TSX and actual browser output. Dynamic content and unavailable backend data limit live-data verification, so include representative fixtures only inside browser tests. Preserve every pre-existing dirty file in a /tmp snapshot before edits; rollback restores only this work unit's files from that snapshot, including originally untracked files. Do not use git checkout/reset to discard user work.

Mode: Normal. Confidence: 95% based on byte-identical stylesheet families and original git layout evidence.

## Visual refinement authorized during implementation

The user requested a polished professional result. Apply restrained solid navy surfaces, subtle slate borders, consistent 12px card corners, 36–38px controls, 13px navigation/control labels and generous but compact 16–24px section spacing. Remove external font downloads; use the local system sans-serif stack consistently. Keep status colors meaningful and avoid decorative glow on shared controls. This refines the existing brand without changing navigation, content or functionality.
