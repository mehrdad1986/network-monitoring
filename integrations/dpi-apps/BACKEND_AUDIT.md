# Python backend audit — October 23, 2026

All **103 original Python files compile** with Python 3.14.4. The mother app checks all 103 catalog entries. **83 are ready to attempt; 20 need prerequisites or explicit arguments.** This is not a claim that every live network measurement succeeds.

## Deliverables

- [APP_INVENTORY.md](APP_INVENTORY.md): every original application, its role, description and preflight result.
- [mother_app.py](mother_app.py): sequential controller with per-app timeouts, process-group cleanup, logs, configuration and checkpointed JSON summaries.
- [MOTHER_APP_GUIDE.md](MOTHER_APP_GUIDE.md): usage, dependencies, inputs, selection policy and frontend relationship.
- [apps_catalog.json](apps_catalog.json): the exact original 103-app manifest.
- [reports/backend_preflight.json](reports/backend_preflight.json): per-app syntax and prerequisite evidence.
- [reports/backend_startup_smoke.json](reports/backend_startup_smoke.json): bounded startup evidence from a temporary copy.

## Fixed defects

1. Four root report writers referenced `os` without importing it. All ten root/daily report writers now create their report directories. Both copies of site/port scanners create output parents too.
2. Removed executable path references to old `kilo`, Downloads, Windows and `/root/Desktop/new` folders. Report paths resolve from script location. Data utilities accept an explicit dataset directory. Subscription probes use this checkout's `subs/all_links.txt`.
3. Both daily orchestrators now match the filenames actually emitted by their children. They accept only newly created or modified reports and fail a child result that exits successfully without creating a report. Missing/inconclusive findings remain unknown.
4. `test_all_apps.py` now tests this checkout with `sys.executable` and no shell. Its scanner `--help` really displays help instead of testing `--help` as a hostname. Timeouts cause a failing suite exit status.
5. Fixed the undefined `inject_rst` callback and undefined client address variables in packet experiments. Packet interfaces and Xray config paths are configurable. The controller reports missing executables/privileges before running experiments.
6. Replaced direct `SSLObject` construction with the supported MemoryBIO flow. The fragmentation probes complete the handshake and read decrypted HTTP data; encrypted TLS records no longer count as a successful page response. Zero-gap control sends the ClientHello in one write. Connection EOF/deadlines stop the probe.
7. Fixed invalid TLS version construction, invalid/unsupported cipher selection behavior, a nonexistent ALPN method, and the no-SNI test that always skipped despite being implemented. The first harness no longer leaves hostname checking enabled when omitting SNI.
8. Corrected DNS wire-format versus JSON handling in twelve DoH probes. Ten resolver functions are regression-tested against a real encoded DNS response. Their HTTP connections close even on exceptions. DoH clients that can use HTTP/2 explicitly fall back to HTTP/1.1 when `h2` is missing.
9. Fixed TCP-error formatting in `big5_dpi_methods.py`, division by zero when provider reports contain no measurements, and UDP cleanup that raised `UnboundLocalError` after socket creation failed.
10. DNS failures no longer count as clean observations. SNI filtering stays inconclusive when all controls fail, and generic errors do not count as successful passthrough. The DNS tunnel client no longer prints unconditional readiness after failed connectivity checks.
11. Added working entrypoints for the previously empty chunk and fragmentation scripts, explicit arguments for RST helpers, and a configurable Xray generator in place of an inert hardcoded template. The certificate utility uses owner-only private-key permissions, new directories and exclusive file creation.
12. Saved-result tools reject missing datasets and malformed IPv4 addresses instead of silently producing empty/stale-path output. `pytest.ini` prevents live network applications named `test_*.py` from executing during automatic test collection.

## Verification

- Syntax compilation: **103/103 passed**.
- Static symbol-table check: no unresolved global references observed, excluding star-import files. This is a focused check, not a complete linter or proof of correctness.
- `python3 -m pytest -q`: **17 tests passed, 23 subtests passed**.
- `python3 test_all_apps.py`: **5 smoke checks passed** against this directory after correcting the old working directory.
- Regression coverage includes all ten daily report writers, new/stale report selection, sequential failure continuation, working directory handling, missing dependency handling, timeout/descendant termination, real TLS encryption/decryption through in-memory client/server BIOs, wire-format DNS responses, saved-result fixtures, measurement validity and certificate key permissions.
- Startup smoke runs selected eligible apps in a temporary copy with a **one-second limit per app**. Nested runners, special utilities/monitors and packet experiments are skipped by default. Final counts: **31 completed, 24 failed, 19 timed out, 28 skipped, 1 unavailable**. No programming exception signatures were observed in that final bounded sweep. The failures include denied sockets/DNS and provider failure exit codes; completion still does not validate a network result. Per-app logs and the exact results are preserved in the JSON evidence. A timeout is not a software failure verdict, and exit code 0 is not a successful network measurement verdict.

## Remaining environment requirements

The 20 unavailable preflight entries overlap these requirements:

- Fourteen packet experiments need appropriate packet privileges; nine of those also require the missing `xray` executable.
- Four saved-data utilities need a dataset (`NETMON_DATA_DIR` or `--data-dir`).
- Four CLI tools require explicit arguments: `dropshape.py`, `fake_rst.py`, `spoof_rst.py`, and `make_xray.py`. Two also need packet privileges.

The audit sandbox rejects network socket operations and cannot resolve some remote endpoints. Consequently, external probes can fail or time out here even when the application code is functioning. Provider exit code 2 and DNS/server availability failures are preserved, not changed into successful execution. Historic fixed endpoints and captured connection sequence numbers still need current, relevant targets on the actual network. Packet injection, remote DNS tunnel and Lantern operations are not verified live.

Inspection of `netmonlast/frontend/src/services/api.ts` found that the frontend defaults to a Go API on port 8080. No bridge to this script collection was found in that backend. The new mother app provides a local JSON report interface; frontend integration was not added.
