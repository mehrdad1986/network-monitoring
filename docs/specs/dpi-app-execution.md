---
status: frozen
---
# Standalone DPI Application Execution

User authorized connecting standalone app controls to actual Python apps and returning reports. Preserve main frontend/backend sources. Extend only `dpi-frontend/` plus task documentation.

## Design and API
Design: `docs/design/dpi-app-execution.md`. Serve same-origin loopback HTTP API from the standalone Node server, using a Python worker that imports the existing backend's catalog validation, preflight and process-group cleanup. Run exact catalog entries, including explicitly selected batch runners. Python executable/backend path are operator environment configuration, never browser input.

- GET `/api/health`: interpreter and catalog connectivity.
- GET `/api/apps`: live backend catalog (no stale snapshot fallback for execution).
- GET `/api/runs`: latest 100 run summaries.
- POST `/api/runs`: `{file, args?: string[], timeout?: number}` → 202 job record. Arguments use defaults when omitted; timeout 1–600 seconds. One active job; concurrent submission returns 409.
- GET `/api/runs/:id`: job including final status, stdout/stderr tails, preflight reasons and timestamps.
- GET `/api/runs/:id/report`: downloadable JSON report.
- DELETE `/api/runs/:id`: cancel active job.

Loopback-only binding; validate Host against loopback address and actual port; reject cross-origin requests and mutations without JSON/custom request header. No shell interpolation, arbitrary script paths, or HTTP file access outside explicit static/API routes. Bound request size, arguments, output and job-list responses. Retain reports under ignored `.runs/`. No automatic retries of job submission. User supplies arguments as a JSON array so quoting is explicit. A zero exit code does not validate scientific conclusions.

## Acceptance and Validation
App details has Run control, timeout and optional arguments. Running job is shown on Runs page, polled with no overlapping requests; failure is visible with retry for reads. Cancel and download report work. A job is never marked successful just because it was accepted. Preflight failures must show reasons. Reuse backend preflight/cleanup, retaining process-group termination on timeout/cancel.

Focused tests: exact-path selection, shell metacharacters remain literal arguments, missing inputs, failed exit, timeout, cancellation, invalid input, unknown app, concurrent submission, hostile origin/Host, body size, restart history. Live smoke test uses a reviewed non-network fixture or environment diagnostic, never automatically runs the 103-app catalog.

Rollback: stop standalone server, restore only integration changes from pre-edit snapshots and keep prior `.runs/` reports; main app remains independent. Known limit: some scripts need dependencies/privileges/inputs or interactive prompts; report failures rather than inventing results. Server stderr is the operational error sink.
