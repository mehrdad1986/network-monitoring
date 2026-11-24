---
status: frozen
---
# Repair Specific DPI App Setup

User listed saved-data utilities, missing httpx, required-argument tools and packet privileges. Resolve setup in the standalone adapter while preserving main frontend and backend source.

Use actual saved `bgp_route_analysis.json` route observations to derive input text under ignored standalone `.runs/traceroute-data/`, with source provenance. Only valid observed IPv4 hops and explicit IPv4 destinations may be imported. No placeholder measurements or fabricated routes. Respect an explicit NETMON_DATA_DIR first; otherwise prefer an existing backend data directory.

Add labeled launch fields for dropshape, make_xray, fake_rst/spoof_rst and saved-data utilities. Convert form values to CLI string arrays, validate required values and bounds, and keep custom arguments optional. Never invent connection parameters or persist credentials in job metadata. Design: docs/design/dpi-app-setup.md.

Retry dependency installation without modifying system Python or DNS. If successful, verify imports before selecting an environment. Packet privileges require a concrete administrator-approved process-scoped launch; do not grant capabilities globally to Python or run the entire server as root.

Acceptance: real analysis utilities execute on imported observations; forms generate correct argument order/flags, reject missing/invalid inputs; raw packet apps expose actionable permission setup; dependency errors are reported truthfully. Full app operation requires real target parameters and appropriate privilege. Verify actual utility output, fixtures, browser forms and existing regressions. Rollback restores adapter changes and stops optional packet service; keep saved reports.
