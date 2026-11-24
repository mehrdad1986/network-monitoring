# DPI Application Readiness Audit

Audited all 103 catalog apps without running probes. 81 pass preflight; 22 require setup. Passing preflight does not verify network measurements.

Shared fixes: live bounded output, interactive stdin replies, argument hints, and longer batch timeout. Real controller menu/reply/exit verified in Firefox.

| Application | Remaining requirement |
| --- | --- |
| `analyze_paths.py` | Missing input: backend/data |
| `test_dns_servers_list.py` | Missing Python module: httpx |
| `test_doh.py` | Missing Python module: httpx |
| `dropshape.py` | Arguments required; enter arguments in app details |
| `extract_azix.py` | Missing input: backend/data |
| `fake_rst.py` | Packet capture/injection requires root or CAP_NET_RAW; Arguments required; enter arguments in app details |
| `generate_all_ips.py` | Missing input: backend/data |
| `make_xray.py` | Arguments required; enter arguments in app details |
| `netmon_analyzer.py` | Missing input: backend/data |
| `rst_comprehensive.py` | Packet capture/injection requires root or CAP_NET_RAW |
| `rst_comprehensive_v2.py` | Packet capture/injection requires root or CAP_NET_RAW |
| `rst_evader.py` | Packet capture/injection requires root or CAP_NET_RAW |
| `rst_evader_v2.py` | Packet capture/injection requires root or CAP_NET_RAW |
| `rst_final.py` | Packet capture/injection requires root or CAP_NET_RAW |
| `rst_simple_test.py` | Packet capture/injection requires root or CAP_NET_RAW |
| `rst_simple_v2.py` | Packet capture/injection requires root or CAP_NET_RAW |
| `rst_test_v2.py` | Packet capture/injection requires root or CAP_NET_RAW |
| `rst_test_v3.py` | Packet capture/injection requires root or CAP_NET_RAW |
| `rst_test_v4.py` | Packet capture/injection requires root or CAP_NET_RAW |
| `rst_test_v5.py` | Packet capture/injection requires root or CAP_NET_RAW |
| `spoof_rst.py` | Packet capture/injection requires root or CAP_NET_RAW; Arguments required; enter arguments in app details |
| `tcp_flag_evader.py` | Packet capture/injection requires root or CAP_NET_RAW |

Dependency install was attempted in an isolated local environment but files.pythonhosted.org could not resolve; no offline httpx wheel found. System python3 remains selected, preserving existing installed dependencies. Packet privileges were not elevated and no missing datasets or target arguments were invented.
