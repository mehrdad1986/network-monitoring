# DPI Apps Frontend

Independent browser frontend for the Python DPI app catalog. Does not modify or depend on the main NetMon frontend. Requires Node.js 18+; no package installation needed.

```sh
cd dpi-frontend
npm start
```

Open http://127.0.0.1:3100. Override the port with `PORT=3200 npm start`.

Includes searchable application cards, eight category filters, application execution, cancellation, and saved JSON reports. The app list comes from the live Python backend catalog.

Open an app's details, optionally enter arguments as a JSON string array and a timeout (1–3600 seconds), then click **Run application**. Batch runners default to 1800 seconds; other apps default to 300. Runs shows live stdout/stderr, cancellation and a downloadable final JSON report. Answer interactive prompts using **Reply to app prompt → Send input**; an empty reply sends Enter. Polling preserves your typed reply. Only one job runs at a time. Completed means exit code 0, not a verified network finding.

Cards display actual preflight readiness. Details shows blockers, interactive-input hints and required argument names. Connection → Refresh all-app readiness rechecks all scripts without running probes. Missing data/privileges must be supplied; do not interpret “Preflight ready” as verified network reachability.

Default backend directory: `../integrations/dpi-apps` relative to this app; default interpreter: `python3`. Configure a different installation before starting:

```sh
DPI_BACKEND_DIR="/path/to/dpi apps" DPI_PYTHON="/path/to/venv/bin/python" npm start
```

The selected interpreter must have the backend's dependencies installed. The server imports the backend's existing `mother_app.py` for catalog checks, dependency preflight and subprocess cleanup, then executes the exact selected script without a shell. No backend source changes are needed. Batch runners explicitly selected in this interface run directly; their children may produce additional reports in their usual locations.

HTTPX and its HTTP/2 dependencies are installed privately under `.python-deps/`, which the worker adds to its import path. `requirements-httpx.txt` pins the ten wheels with SHA-256 hashes independently checked against official PyPI. To recreate this local installation when package access is available: `python3 -m pip install --target .python-deps --no-deps --only-binary=:all: --require-hashes -r requirements-httpx.txt`. Other backend dependencies remain in the selected interpreter; system packages are not modified.

For saved-traceroute utilities, the server uses `NETMON_DATA_DIR` if set, then an existing backend `data/` directory. Otherwise it imports valid observed IPv4 routes from `bgp_route_analysis.json` into `.runs/traceroute-data/<source-hash>/`, with a provenance file. These remain saved observations, not live traces. App forms can override the data directory. No dummy dataset is generated.

`dropshape`, `make_xray`, `fake_rst` and `spoof_rst` have labeled connection fields. You must provide your actual hostname/address and connection parameters; the app does not invent them. UUID input is masked and values are not saved in job metadata.

Packet experiments require CAP_NET_RAW. An optional transient systemd service runs as your normal user, with only this capability, restricted filesystem writes, and no global changes to Python capabilities. Before using it, stop the standard frontend server on port 3100. In your own terminal:

```sh
sudo -v
npm run start:packets
```

Stop it with `sudo systemctl stop dpi-apps-packets`; then `npm start` restores the ordinary unprivileged server. Logs: `journalctl -u dpi-apps-packets`. Starting this service requires administrator approval; it has not been enabled by creating the launcher file.

Run reports persist under local ignored `.runs/`. Live output retains the last 32,768 characters per stream, strips terminal color codes and redacts common credential formats; do not put secrets in arguments, replies or script output. Script-generated files remain in the backend's normal output locations. JSON downloads include execution metadata and output, not arbitrary backend files.

This is a local execution service bound to `127.0.0.1`; do not expose it through a public proxy. Browser requests are restricted to the same local origin. A static host alone supports assets only, not the execution API.

```sh
npm test
npm run build
```

`dist/` contains browser assets; run the included Node server for the execution API. Relative asset/API URLs allow later integration under a shared prefix if the main server mounts the API at that same prefix. Later integration can translate `src/app.js` into main-app components; `src/catalog.js` holds reusable catalog filtering. Keep document-level styles isolated when embedding (for example in an iframe).

## Open inside NetMon

After signing in to NetMon on port 3000, choose **DPI Tools** on the dashboard, or use **DPI Applications**, **DPI Runs**, or **DPI Connection** in its sidebar. The authenticated entry at `/app/dpi-tools` opens the complete DPI application at `http://localhost:3000/dpi-tools/#applications` in the current tab. It uses the exact DPI page, styling and controls from port 3100, fills the browser page, and has no surrounding NetMon sidebar or iframe. Browser Back returns to the dashboard. Runs and Connection links open their matching sections.

Keep this DPI service running on port 3100 and restart the NetMon development server after installing this integration. NetMon proxies `/dpi-tools/` assets and API calls to the loopback service, so browser navigation stays on port 3000. A production host serving `frontend/build` needs the same `/dpi-tools/` reverse proxy with that prefix stripped and trusted host/origin translation; the development proxy is not part of the static build. This uses NetMon's existing browser login; it does not add server authorization to the local DPI service.
