---
status: frozen
---
# Standalone DPI Frontend

Build an independent frontend under `dpi-frontend/`; leave the main frontend unchanged. The user's 2026-10-23 direction confirms standalone delivery for later attachment.

Design: `docs/design/dpi-apps-standalone.md`. Use dependency-free browser modules and scoped CSS to keep the eventual integration small. Package scripts provide a local server and portable static build.

Acceptance: top navigation; all catalog applications listed; category navigation, searchable cards, app metadata details, empty state, responsive layout, keyboard access, no fake execution or results. Explicitly state that backend execution is not yet connected. No backend processes run as part of browsing.

Verification: focused filter tests, build, and local HTTP checks. Rollback: remove only newly created standalone assets; preserve all prior repository changes.
