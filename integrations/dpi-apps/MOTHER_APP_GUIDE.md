# Backend mother application

The original 103 applications are listed in [APP_INVENTORY.md](APP_INVENTORY.md) and configured in [apps_catalog.json](apps_catalog.json). The controller and its support modules are additional files.

Requires Python 3.10 or newer (validated with Python 3.14.4). Run from this directory using the same Python interpreter where the dependencies are installed:

```bash
python3 mother_app.py --list
python3 mother_app.py --check
python3 mother_app.py --run --timeout 300
```

`--check` validates syntax and direct imports and checks declared executables, inputs, arguments and packet privileges. **Ready means eligible to attempt, not verified working.** It does not connect to remote services. Exit status 1 means at least one app is unavailable.

`--run` launches one app at a time, using that app's own directory and the current Python interpreter. It continues after a failure or timeout. Standard input is closed; batch arguments replace the scanners' interactive prompts. There is no shell command interpolation. The default timeout is five minutes per app; large scans may require substantially more time.

Each run creates a unique folder under `reports/mother/` with `summary.json`, a stdout log and a stderr log per executed app. The summary is checkpointed after each app. Ctrl+C stops the active process group and records remaining apps as not run. Descendants are terminated after normal completion as well as after timeout. `completed` means exit code 0; inspect measurement output for the actual network result. Provider exit code 2 is preserved as a failure, not silently turned into success.

The five nested batch runners are skipped because their children are already in the catalog. `master_kilo_runner.py` is a compatibility entrypoint for this controller. Run a daily orchestrator directly if you want its consolidation and archival behavior.

Utilities, live monitors and packet experiments require explicit selection or `--include-special`; other missing prerequisites are recorded as unavailable. Historical packet scripts require a current controlled connection and correct interface/configuration. `rst_simple_test.py` contains old captured addresses and sequence numbers that must be replaced before an actual experiment.

```bash
python3 mother_app.py --only 'dns_poisoning_detector.py'
python3 mother_app.py --only 'daily_tests/*.py' --timeout 900
python3 mother_app.py --include-special --timeout 300
python3 mother_app.py --config mother_config.example.json --timeout 300
```

Copy and edit `mother_config.example.json` for your own setup. A config is an object keyed by exact catalog paths. Allowed overrides are `args` (list of strings), `timeout` (positive seconds) and `enabled` (boolean). `enabled: true` opts a special app into execution; `enabled: false` skips it. Each `--only` pattern must match at least one app. Use `--only` repeatedly for multiple selections. `${APP_ROOT}` in an argument expands to this folder.

Some probes use historical fixed domains and addresses. Update them for the network you intend to measure. A timeout, failed certificate, DNS error or reset alone does not prove censorship. The corrected fragmentation probes complete TLS and require a decrypted HTTP response; they no longer count encrypted handshake bytes as a served web page.

## Dependencies and inputs

```bash
python3 -m pip install -r requirements.txt
```

The DoH clients fall back to HTTP/1.1 with an explicit notice if the optional `h2` dependency is missing. Installing `httpx[http2]` enables their HTTP/2 tests. External binaries are separate from Python packages. Packet/Xray experiments need `xray`, `curl` and `timeout`, plus root or Linux CAP_NET_RAW for packet operations. The controller does not install or elevate privileges automatically.

Optional environment settings:

```bash
export DPI_INTERFACE=your_network_interface
export DPI_XRAY_CONFIG=/absolute/path/to/your/xray_config.json
export NETMON_DATA_DIR=/absolute/path/to/saved/traceroutes
```

Without overrides, packet scripts select Scapy's default interface and use this folder's `xray_config.json`. Saved-result utilities use `data/` and accept `--data-dir` and, where relevant, `--output`. No dataset is fabricated when input is missing. `dropshape.py` requires a hostname and destination IP. `fake_rst.py` and `spoof_rst.py` require source IP, source port, destination IP, destination port and sequence number. `make_xray.py --help` describes the required connection parameters; it creates a new file and refuses to overwrite a config.

The certificate utility creates a new output directory and writes the private key with owner-only permissions. It does not install the certificate into a trust store.

## Validation and limits

```bash
python3 -m unittest discover -s tests -v
python3 -m pytest -q
python3 test_all_apps.py
```

`pytest.ini` keeps live probes named `test_*.py` out of automatic test collection. Those probes are applications, not isolated unit tests.

The original frontend is at `../../frontend` relative to this guide and defaults to a Go API at `http://localhost:8080/api/v1`. Inspection found no bridge connecting these 103 scripts to that API. This controller runs locally and writes JSON summaries; it does not add frontend integration.

Network sockets are restricted in the audit environment. Successful live measurements, interface-specific packet injection and remote DNS tunnel/Lantern readiness must be verified on the intended host/network. See [BACKEND_AUDIT.md](BACKEND_AUDIT.md) for observed results.
