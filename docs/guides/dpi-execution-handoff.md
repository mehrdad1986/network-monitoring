# DPI Execution Handoff

Standalone `dpi-frontend/` now uses the live catalog and executes exact selected Python apps through a loopback Node API/Python worker. Details includes Run, JSON arguments and timeout; Runs shows status/output, cancellation and downloadable saved JSON reports.

- Spec: `docs/specs/dpi-app-execution.md`
- Design: `docs/design/dpi-app-execution.md`
- Code: `dpi-frontend/src/app.js`, `dpi-frontend/scripts/serve.mjs`, `dpi-frontend/scripts/jobs.mjs`, `dpi-frontend/scripts/worker.py`
- Work log: `context/`
- Review: `docs/reviews/dpi-app-execution-review.md`
- Usage: `dpi-frontend/README.md`

Verification: nine Node tests pass for filtering, real Python-worker execution and failure/security/recovery paths. Build passes. Actual backend diagnostic completed with exit 0. Firefox click-to-run/report/download and mobile layout passed.

Run `cd dpi-frontend && npm start`, then http://127.0.0.1:3100. Configure `DPI_BACKEND_DIR` and `DPI_PYTHON` as needed. Server restarted after final code changes. Ignored `.runs/` holds reports/browser artifacts. Main frontend integration remains future work, as requested.

Limits are documented in the review. Rollback: stop the standalone server and restore only integration changes; retain `.runs/`. No main frontend rollback needed.
