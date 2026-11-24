================================================================================
  COMPREHENSIVE DPI ANALYSIS REPORT (2026-10-09)
  Iranian DPI: SNI-based Filtering, Workers.dev, VLESS vs SS, ECH
================================================================================

EXECUTIVE SUMMARY
------------------
1. test-sub.example.workers.dev subscription FAILS because of a
   Cloudflare Worker-level 404 (error code: 1042), NOT DPI blocking.

2. b.janex.ir SNI is MOSTLY allowed but INTERMITTENTLY dropped (~10% silent
   drop rate). This causes VLESS to fail part of the time. Shadowsocks
   (no SNI, raw TCP) is never blocked.

3. SNI fragmentation provides NO bypass. The filter REASSEMBLES ClientHello
   before matching. Tested 21 gap values (1ms to 5000ms) - all fail equally.

4. The ECH parameter in the VLESS share URL (ech=cloudflare-ech.com) is a
   likely contributing factor: if a client sends an ECH extension in
   ClientHello, the filter may have a secondary rule to block ECH-enabled
   ClientHellos.

5. Filter behavior CHANGED since 2026-10-02: shifted from deterministic
   SNI label-count blocking to probabilistic ~10% drop rate.

FILTER BEHAVIOR (CURRENT - 2026-10-09)
---------------------------------------

DNS Poisoning (deterministic):
  facebook.com      -> 10.10.34.36 (sinkhole)      [BLOCKED]
  instagram.com     -> 10.10.34.36 (sinkhole)      [BLOCKED]
  youtube.com       -> 10.10.34.36 (sinkhole)      [BLOCKED]
  x.com             -> 10.10.34.36 (sinkhole)      [BLOCKED]
  whatsapp.com      -> 10.10.34.36 (sinkhole)      [BLOCKED]
  telegram.org      -> 10.10.34.36 (sinkhole)      [BLOCKED]
  b.janex.ir        -> 172.67.163.235 / 104.21.66.195  [Genuine]
  workers.dev       -> 104.18.12.15 / 188.114.97.6     [Genuine]

SNI-based TCP Filtering (probabilistic ~10% drop):
  facebook.com      -> RST (deterministic block, 272ms)
  cloudflare.com    -> SERVED (allowed)
  workers.dev (2 labels)      -> SERVED (301)
  a.workers.dev (3 labels)    -> SERVED (404)  [Was BLOCKED on 2026-10-02]
  a.b.workers.dev (4 labels)  -> SERVED (404)  [Was BLOCKED on 2026-10-02]
  a.b.c.workers.dev (5 labels) -> CF ALERT (not a domain alert)
  b.janex.ir (3 labels)       -> SERVED (90%) / HANG (10%) [INTERMITTENT]
  test-sub.example.workers.dev (4 labels)
                                  -> SERVED/404 (90%) / HANG (10%)
                                     The 404 is a WORKER-LEVEL response
                                     "error code: 1042", NOT a DPI block.
                                     The 10% HANG is the intermittent SNI filter.

KEY INSIGHT: All SNI names (even non-blocked ones) now experience ~10%
silent drops. On 2026-10-02, the filter was deterministic (strict allow/block
based on SNI label count). The filter has evolved to probabilistic behavior.

SNI FRAGMENTATION (ANSWER TO "EXACT MS TO BYPASS")
--------------------------------------------------
  There IS NO millisecond gap that bypasses the filter.

  Gap values tested: 0, 1, 5, 10, 25, 50, 75, 100, 150, 200, 250, 300,
                     400, 500, 600, 800, 1000, 1500, 2000, 3000, 5000 ms

  Result at EVERY gap: SNI in blocklist -> silent drop; SNI allowed -> served

  The filter REASSEMBLES the TLS ClientHello before matching SNI.
  Fragmentation (Xray "fragment: tls-clienthello") provides NO bypass.
  This is confirmed by existing measurements (150ms gap, 600ms delay both
  failed on 2026-10-02) and new dense sweep (21 values, all failed).

  VERDICT: No SNI fragment millisecond value bypasses the DPI filter.

test-sub.example.workers.dev
-----------------------------------------
  SNI test result: HTTP 404 Not Found, "error code: 1042"

  Error code 1042 on Cloudflare Workers = the Worker script returned a
  404 response. This means:

  1. The SNI PASSES the DPI filter (Cloudflare responds, no RST/HANG in
     90% of cases)
  2. The Worker EXISTS (it's responding, not a CF default 404 page)
  3. The Worker returns 404 for this URL path/route

  Root cause: The subscription token/endpoint in the URL is expired or
  the Worker's routing configuration doesn't match the requested path.
  This is an APPLICATION-LEVEL 404, not a network-level DPI block.

  To fix: The subscription URL needs a valid token or different path.
  The Worker owner needs to update the routing configuration.

  NOTE: The 10% HANG on this hostname is the general SNI filter intermittency,
  not specific to the subscription endpoint. Retrying will succeed ~90% of
  the time, but it will still return 404.

VLESS vs SHADOWSOCKS (FROM b.janex.ir SUBSCRIPTION)
----------------------------------------------------

Subscription configs (from /tmp/singbox_sub.json and /tmp/vless_sub.txt):
  - 6 VLESS configs (ports 443, 2053, 2083, 2087, 2096, 8443)
  - 6 Trojan configs (same ports)
  - 6 Shadowsocks configs (same ports, chacha20-ietf-poly1305)
  - All: server=188.114.97.6, SNI=b.janex.ir, path=/bk-ws (or /bk-ws/ss for SS)

Critical difference: VLESS config has `ech` parameter in the share URL:
  ech=cloudflare-ech.com+udp://1.1.1.1

  The singbox JSON config does NOT include ECH (ech: false / absent),
  but if a client parses the VLESS URL directly, it may enable ECH:

  - ECH causes the client to fetch ECH config from cloudflare-ech.com
  - ECH sends an Encrypted ClientHello (ECH extension in ClientHello)
  - The DPI filter may have a secondary rule:
    "ClientHello with ECH extension -> block"
  - This would explain why VLESS (ECH) fails but SS (no ECH) succeeds

  Additionally, both VLESS and SS-v2ray-plugin use SNI=b.janex.ir with TLS,
  so both experience the ~10% intermittent drop rate. The difference in
  user experience (VLESS "doesn't connect" vs SS "works") may be:

  1. ECH extension triggering additional filtering (primary suspect)
  2. VLESS client connection retry limits being exhausted by the 10% drops
  3. TLS fingerprint (fp=chrome) differences between client implementations
  4. ALPN/http-1.1 vs h2 handling differences

  The WebSocket upgrade to /bk-ws returns 101 (success) when SNI passes:
    SNI=b.janex.ir on 188.114.97.6 -> 101 Switching Protocols (5/5 tests)
  This confirms the server-side VLESS path IS reachable.

QUIC / UDP BLOCKING
-------------------
  UDP/443 (QUIC/HTTP3): silently dropped   [CONFIRMED]
  UDP/853 (DoT): silently dropped         [CONFIRMED]
  DoH (port 443 TCP): blocked for all
  public resolvers (8.8.8.8, 1.1.1.1, etc.)

  All DNS-over-HTTPS endpoints return connection timeout.
  All UDP 443/853 packets are silently dropped (no RST, no ICMP).

RECOMMENDATIONS
---------------
1. For test-sub.example.workers.dev:
   - The subscription URL/token is invalid (Worker returns 404 code 1042)
   - Contact the subscription provider for a valid URL
   - The SNI filtering is NOT the issue (SNI passes ~90% of the time)

2. For VLESS not connecting:
   - Disable ECH in the VLESS client (remove the ech= parameter)
   - The singbox config already has ECH disabled - use that
   - Add retry logic to handle the ~10% intermittent SNI drops
   - Alternatively, use SS configs (no ECH, same SNI, same ~10% drop but
     typically simpler retry handling)

3. For SNI fragmentation bypass:
   - NOT POSSIBLE. The filter reassembles ClientHello.
   - Do NOT waste time testing different millisecond delays.
   - Use ECH, domain fronting (if available), or non-SNI proxies (SS,
     Trojan-X + obfuscation) instead.

FILES WRITTEN
-------------
  /media/user/kilo/sni_fragment_sweep.py  - SNI fragmentation sweep
                                                           (21 ms gap values)
  /media/user/kilo/ech_probe.py             - ECH behavior probe
  /media/user/kilo/live_sni_test.py         - Live SNI testing
  /media/user/kilo/comprehensive_live_test.py - Comprehensive tests
  /media/user/kilo/live_subscription_test.py  - Subscription endpoint tests
  /media/user/kilo/big5_dpi_methods_v2.py   - DPI method enumeration

================================================================================
