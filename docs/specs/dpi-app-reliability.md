---
status: frozen
---
# DPI App Reliability Fix

User reports apps do not work correctly. Reproduction: run an interactive app with the current worker; it receives DEVNULL and cannot answer prompts. Any long-running app produces no visible output until completion because the worker buffers all output and the browser displays it only at the end. Full non-executing preflight: 103 apps, 81 ready, 22 blocked by missing httpx, data, required arguments or CAP_NET_RAW.

Fix only adapter/environment issues justified by these observations. Add live bounded stdout/stderr, stdin replies to the selected active run, a non-executing all-app readiness check, per-app blocker visibility and clearer argument launch metadata. Install missing httpx into a project-local environment; do not install system packages or elevate packet capture. Do not fabricate missing data or bypass requirements. Preserve existing backend sources and main frontend.

Design: docs/design/dpi-app-reliability.md. API adds POST `/api/runs/:id/inputs` with `{text}` (max 4096 characters, one line) and GET `/api/readiness`. Existing same-origin/host/mutation validation applies. Worker communicates framed JSON events: progress/results, bounded buffers; browser polls without overlapping requests and preserves focused input form while refreshing output. Readiness uses the selected Python and existing backend preflight with no probes.

Test: reproduce missing live output and interactive input before fix with safe fixture; validate real stdin replies, small/flushed/Unicode output, timeout/cancel, malformed input, full readiness and existing regression suite. Audit every catalog file without executing intrusive/network/privileged jobs. True missing datasets, permissions, or user target configuration must be explicitly reported as blockers, not claimed fixed.
