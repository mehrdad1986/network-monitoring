# Run NetMon after copying to Ubuntu

Copy the complete `netmonlast` folder to the new Desktop, open a terminal in
that folder, then run:

```bash
bash start-all.sh
```

The launcher prepares missing frontend and Python dependencies, builds the Go
local API at the new folder location, and starts the API, DPI service,
Monitoring checks, Iran monitor data server, and frontend. Open
`http://127.0.0.1:3000`. Press Ctrl+C in that terminal to stop services started
by the launcher. It does not need Docker or a database for the local target
inventory.

Requirements are Node.js 18+, npm, Go, Python 3 with `venv`, `curl`, and
`setsid`. The Go toolchain in `backend/go.mod` is selected automatically by Go.
The first setup needs internet access to download Go modules, npm packages, and
Python packages. If Python environment creation reports that `venv` is missing,
install Ubuntu's `python3-venv` package and run the launcher again.

Target inventory remains in `backend/data/targets.json`. The bundled Iran
monitor snapshot is served locally; refreshing that snapshot requires running
the monitor separately. `integrations/network-checker/` and
`integrations/nova-radar/` are preserved source projects; NetMon's integrated
features run through the main API.

The launcher resolves all project directories relative to its own location, so
the copied folder can have a different Desktop username or path. Credentials
and existing local configuration are left unchanged.
