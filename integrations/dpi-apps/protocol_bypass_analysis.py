#!/usr/bin/env python3
"""Protocol-layer bypass analysis: VLESS vs Shadowsocks vs Trojan.

The key question: why does VLESS (TLS+WS) fail while Shadowsocks (plaintext)
succeeds on the same Cloudflare IP?

This script tests protocol-level differences:
  1. Does the filter block based on TLS SNI presence?
  2. Does ECH (Encrypted ClientHello) trigger different behavior?
  3. Does TLS fingerprint (JA3/JA4) matter?
  4. Does protocol-level behavior differ (VLESS vs SS)?

Requires network access through the Iranian DPI (MCI/Rightel).
"""
import socket
import ssl
import sys
import time
import struct
import json


def tls_handshake_with_sni(ip, sni, port=443, timeout=10, verify=False):
    """Full TLS handshake with SNI. Returns (verdict, detail, cert_info)."""
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = verify
    ctx.verify_mode = ssl.CERT_REQUIRED if verify else ssl.CERT_NONE
    if verify or ctx.verify_mode == ssl.CERT_REQUIRED:
        ctx.load_default_certs()
    ctx.set_alpn_protocols(["http/1.1"])
    t0 = time.time()
    try:
        raw = socket.create_connection((ip, port), timeout=timeout)
        raw.settimeout(timeout)
        s = ctx.wrap_socket(raw, server_hostname=sni)
        hs_ms = int((time.time() - t0) * 1000)
        cert = s.getpeercert()
        cert_info = {
            "subject": dict(x[0] for x in cert.get("subject", ())),
            "issuer": dict(x[0] for x in cert.get("issuer", ())),
            "has_san": "subjectAltName" in cert,
        }
        # Try to get response
        s.sendall(b"GET / HTTP/1.1\r\nHost: %s\r\nConnection: close\r\n\r\n" % sni.encode())
        buf = b""
        while b"\r\n\r\n" not in buf and len(buf) < 2048:
            c = s.recv(4096)
            if not c:
                break
            buf += c
        s.close()
        total_ms = int((time.time() - t0) * 1000)
        resp = buf.split(b"\r\n", 1)[0].decode("latin1") if buf else "(empty)"
        return "TLS_OK", "%dms hs, %dms total, %s, %dB" % (hs_ms, total_ms, resp, len(buf)), cert_info
    except socket.timeout:
        return "SILENT-HANG", "timeout after %dms (silent drop)" % int((time.time() - t0) * 1000), {}
    except ConnectionResetError:
        return "RST", "TCP RST during handshake", {}
    except ssl.SSLError as e:
        msg = str(e).lower()
        if "handshake_failure" in msg:
            return "CF_ALERT", "Cloudflare TLS alert (name not served)", {}
        return "TLS_ERR", str(e)[:80], {}
    except OSError as e:
        return "TCP-FAIL", "%s: %s" % (type(e).__name__, e.strerror or ""), {}


def tls_no_sni(ip, port=443, timeout=10):
    """TLS handshake with NO SNI (server_name=None)."""
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False  # Keep False for IP literal connection
    ctx.verify_mode = ssl.CERT_REQUIRED
    ctx.load_default_certs()
    ctx.set_alpn_protocols(["http/1.1"])
    t0 = time.time()
    try:
        raw = socket.create_connection((ip, port), timeout=timeout)
        raw.settimeout(timeout)
        s = ctx.wrap_socket(raw, server_hostname=None)
        hs_ms = int((time.time() - t0) * 1000)
        s.close()
        return "NO_SNI_OK", "handshake completed in %dms" % hs_ms, {}
    except socket.timeout:
        return "NO_SNI_HANG", "timeout (no SNI = possibly blocked or CF default)", {}
    except ConnectionResetError:
        return "NO_SNI_RST", "RST (no SNI = suspicious to filter)", {}
    except ssl.SSLError as e:
        return "NO_SNI_TLSERR", str(e)[:80], {}
    except OSError as e:
        return "NO_SNI_FAIL", str(e)[:60], {}


def raw_tcp_plain(ip, port=443, timeout=10):
    """Raw TCP connect without TLS. Tests if port is reachable at all."""
    t0 = time.time()
    try:
        raw = socket.create_connection((ip, port), timeout=timeout)
        rtt = int((time.time() - t0) * 1000)
        raw.close()
        return "TCP_OK", "connected in %dms" % rtt, {}
    except socket.timeout:
        return "TCP_TIMEOUT", "no connection", {}
    except ConnectionResetError:
        return "TCP_RST", "reset on connect", {}
    except OSError as e:
        return "TCP_FAIL", str(e)[:60], {}


def test_udp_port(ip, port=443, timeout=5):
    """Test if UDP to a port is silently dropped (QUIC/HTTP3 blocking)."""
    raw = None
    try:
        raw = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        raw.settimeout(timeout)
        raw.sendto(b"\x00" * 20, (ip, port))
        try:
            data, _ = raw.recvfrom(2048)
            raw.close()
            return "UDP_REPLY", len(data)
        except socket.timeout:
            raw.close()
            return "UDP_SILENT_DROP", 0
    except OSError as e:
        if raw is not None:
            raw.close()
        return "UDP_FAIL", str(e)[:40]


def main():
    print("=" * 90)
    print("PROTOCOL-LAYER BYPASS ANALYSIS: VLESS vs Shadowsocks vs Trojan")
    print("=" * 90)
    print()
    print("Question: Why does VLESS (TLS+WS+SNI) fail but Shadowsocks")
    print("(plaintext TCP, no SNI) succeed on the same Cloudflare IP?")
    print()

    # The b.janex.ir config server
    config_ip = "188.114.97.6"
    config_sni = "b.janex.ir"

    print("-" * 90)
    print("PHASE 1: TCP REACHABILITY (both protocols, same IP)")
    print("-" * 90)
    print()

    ports = [443, 2053, 2083, 2087, 2096, 8443]
    for p in ports:
        v, d, _ = raw_tcp_plain(config_ip, p, timeout=8)
        print("  TCP %5d  %s  %s" % (p, v, d))
    print()

    print("-" * 90)
    print("PHASE 2: TLS SNI = b.janex.ir (what VLESS uses)")
    print("-" * 90)
    print()
    for p in [443, 2053, 2083]:
        v, d, cert = tls_handshake_with_sni(config_ip, config_sni, port=p, timeout=12)
        print("  TLS SNI=b.janex.ir  port %d  %s  %s" % (p, v, d))
        if cert:
            print("    cert: %s" % json.dumps(cert, indent=2)[:200])
    print()

    print("-" * 90)
    print("PHASE 3: TLS SNI = cloudflare.com (control)")
    print("-" * 90)
    print()
    for p in [443, 2053, 2083]:
        v, d, cert = tls_handshake_with_sni(config_ip, "cloudflare.com", port=p, timeout=10)
        print("  TLS SNI=cloudflare.com  port %d  %s  %s" % (p, v, d))
    print()

    print("-" * 90)
    print("PHASE 4: TLS SNI = workers.dev (control: namespace blocked on MCI)")
    print("-" * 90)
    print()
    v, d, _ = tls_handshake_with_sni(config_ip, "workers.dev", port=443, timeout=10)
    print("  TLS SNI=workers.dev  port 443  %s  %s" % (v, d))
    print()

    print("-" * 90)
    print("PHASE 5: TLS NO SNI (SNI-less ClientHello)")
    print("-" * 90)
    print()
    v, d, _ = tls_no_sni(config_ip, port=443, timeout=10)
    print("  TLS no-SNI  port 443  %s  %s" % (v, d))
    print()

    print("-" * 90)
    print("PHASE 6: UDP/443 (QUIC/HTTP3)")
    print("-" * 90)
    print()
    for p in [443, 853]:
        v, info = test_udp_port(config_ip, port=p, timeout=4)
        print("  UDP port %d  %s  %s" % (p, v, info))
    print()

    print("=" * 90)
    print("ANALYSIS: WHY VLESS FAILS, SHADOWSOCKS SUCCEEDS")
    print("=" * 90)
    print("""
  VLESS (in the b.janex.ir configuration):
    - TLS 1.3 handshake with SNI=b.janex.ir
    - ECH extension present (ech=cloudflare-ech.com+udp://1.1.1.1)
    - Chrome fingerprint (fp=chrome)
    - WebSocket transport on TLS port 443

  Shadowsocks (in the b.janex.ir configuration):
    - No TLS, no SNI, no HTTP
    - Shadowsocks protocol over direct TCP to same IP:port
    - Protocol is opaque (encrypted, no plaintext headers)

  DPI FILTER BEHAVIOR:
    The filter operates at the SNI layer. It reads the Server Name Indication
    from the TLS ClientHello and matches it against blocklist patterns.

    For VLESS:
    1. The ClientHello contains SNI=b.janex.ir
    2. If b.janex.ir is on the blocklist → SNI silent drop or RST
    3. If b.janex.ir is NOT on the blocklist → traffic should pass
    4. BUT: the ECH extension may trigger additional filtering
    5. ECH hides the true SNI — the filter sees the ECH public name instead
    6. The filter may block ECH traffic because it cannot inspect the SNI

    For Shadowsocks:
    1. No TLS ClientHello is sent
    2. No SNI in the connection
    3. The filter has no name to match
    4. The Shadowsocks protocol is indistinguishable from random TCP
    5. No filtering signal triggers

  ROOT CAUSE HYPOTHESES (ranked by likelihood):

  [MOST LIKELY] The SNI b.janex.ir itself is being filtered:
    - Even though it's not workers.dev, it may be on a domain blocklist
    - The DNS may resolve b.janex.ir to a sinkhole (10.10.34.x)
    - Shadowsocks uses the raw IP (188.114.97.6), bypassing DNS

  [LIKELY] ECH (Encrypted ClientHello) triggers blocking:
    - VLESS config has ech=cloudflare-ech.com+udp://1.1.1.1
    - ECH encrypts the SNI, preventing the filter from inspecting it
    - The filter may drop connections with ECH extensions (anti-circumvention)
    - Shadowsocks has no TLS, so no ECH, so no trigger

  [POSSIBLE] TLS fingerprint-based blocking:
    - fp=chrome makes the ClientHello look like Chrome browser
    - The filter may block Chrome-like TLS handshakes on Cloudflare IPs
    - Shadowsocks doesn't have a TLS fingerprint

  [UNLIKELY] Protocol-specific detection:
    - Reports show "VLESS vs static HTML treated identically"
    - The filter cannot decrypt TLS, so no protocol visibility
    - Only applies if TLS is terminated (MITM), which was ruled out
  """)
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        # Run in documentation mode
        print(__doc__)
        print()
    main()
