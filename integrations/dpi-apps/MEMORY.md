# DPI Analysis Project Memory

## Project: Iranian DPI Analysis (MCI Network)

## Environment
- Client IP (current): 192.168.1.5
- Client IP (Oct 2 capture): 10.170.48.221
- Default Gateway: 192.168.1.1 (TTL=30)
- Client TTL: 64 (Linux default)
- Cloudflare response TTL: 48-49 (16 hops)
- DPI-forged RST TTL: 191 (unique fingerprint)
- DNS: 8.8.8.8, 1.1.1.1, 9.9.9.9 (all DoH blocked)
- Sinkhole: 10.10.34.36

## Files
- `/media/user/kilo/pcap/session_2026-10-02.pcap` — 325 packets, 134KB
- `/media/user/kilo/reports/` — 14 DPI analysis reports
- `/media/user/kilo/PACKET_LEVEL_REPORT.md` — packet-level findings
- `/media/user/kilo/FINAL_REPORT.md` — comprehensive summary

## Scripts
| Script | Purpose |
|--------|---------|
| `sni_fragment_sweep.py` | SNI fragmentation timing sweep (21 ms gaps tested, all fail) |
| `ech_probe.py` | ECH/Encrypted ClientHello behavior probe |
| `protocol_bypass_analysis.py` | VLESS vs SS protocol comparison analysis |
| `comprehensive_live_test.py` | Comprehensive SNI/protocol/DNS testing (8 phases) |
| `live_subscription_test.py` | Subscription endpoint tests (abcd vs b.janex.ir) |
| `live_sni_test.py` | Live SNI testing on Cloudflare IPs |
| `big5_dpi_methods_v2.py` | Big-4 platform multi-layer filtering analysis |
| `big5_dpi_methods.py` | Alternative version (duplicate) |
| `sni_variants4.py` | SNI label-count variant matrix (fixed version) |
| `doh_resolve.py` | DoH resolution via IP-literal Google/Cloudflare |
| `doh_sweep.py` | DoH resolver reachability sweep |
| `dpi_probe.py` | Basic DPI probe script |
| `dpi_suite.sh` | Shell wrapper for DPI test suite |
| `tls_fragment.py` | TLS ClientHello fragmentation test |
| `dropshape.py` | TCP RST vs silent drop shape analysis |
| `make_v2rayng_config.sh` | Generate V2RayNG config from subscription |
| `name_matrix.sh` | Generate SNI label count matrix |
| `doh_retry.py` | DoH resolution with retry logic |
| `cross_isp_battery.py` | Cross-ISP battery of DPI tests |

## Key Findings

### Filter Mechanisms (3 modes)
1. **SNI RST Injection**: TTL=191, source IP spoofed to server. ~200ms after SNI in ClientHello. Affects big-4 at genuine IPs, pages.dev.
2. **SNI Silent Drop**: Handshake completes, post-handshake client→server data silently dropped. No RST. Server FIN after 15s. Affects workers.dev subdomains (Oct 2 behavior).
3. **Probabilistic Drop** (Oct 9): ~10-20% silent drops on ALL SNI names, including allowed ones.

### Filter Evolution (Oct 2 → Oct 9)
- Oct 2: Deterministic SNI label-count blocking (2 labels: allowed, 3-4: blocked, 5+: forwarded)
- Oct 9: Probabilistic ~10-20% drop on all SNI names. Previously-blocked names now pass but with random drops.

### SNI Fragmentation
- NO bypass possible. Filter reassembles ClientHello before matching.
- Tested 21 gap values: 1ms, 5ms, 10ms, 25ms, 50ms, 75ms, 100ms, 150ms, 200ms, 250ms, 300ms, 400ms, 500ms, 600ms, 800ms, 1000ms, 1500ms, 2000ms, 3000ms, 5000ms
- All blocked SNIs fail identically regardless of fragmentation timing
- Existing measurement (Oct 2): 150ms, 600ms gaps also failed

### test-sub.example.workers.dev
- SNI passes filter 90% of time → HTTP 404 "error code: 1042" (Worker-level 404)
- 10% hit probabilistic drop → silent HANG
- Root cause: Application-level 404, not DPI blocking. Token/URL is expired/misconfigured.

### VLESS vs Shadowsocks (b.janex.ir subscription)
- VLESS: TLS+SNI=b.janex.ir → 90% passes, 10% silent drop
- SS: No TLS, no SNI → always works (filter has nothing to match)
- ECH parameter (ech=cloudflare-ech.com) in VLESS URL may trigger secondary blocking
- singbox config does NOT enable ECH — use singbox config, not raw VLESS URL
- WebSocket path /bk-ws → 101 Switching Protocols (reachable when SNI passes)

### Big-4 Platform Filtering
- DNS: All domains forged to 10.10.34.36 (sinkhole)
- DoH: All resolvers blocked (8.8.8.8, 1.1.1.1, 8.8.4.4, 1.0.0.1)
- SNI: RST injection (TTL=191) when SNI matches big-4 names
- UDP/443: Silently dropped (QUIC/HTTP3 blocked)
- UDP/853: Silently dropped (DoT blocked)

### Current Working Configs
- VLESS: 6 configs (ports 443, 2053, 2083, 2087, 2096, 8443) on 188.114.97.6
  - SNI=b.janex.ir, path=/bk-ws, fp=chrome, ALPN=http/1.1
  - ECH param in URL may cause issues — disable in client
- SS: 6 configs (same ports) with v2ray-plugin
  - chacha20-ietf-poly1305, no TLS, no SNI
  - Always works (no SNI to filter)

## Cached Data
- `/tmp/vless_sub.txt` — 6 VLESS share URLs
- `/tmp/singbox_sub.json` — Full singbox config (457 lines)
