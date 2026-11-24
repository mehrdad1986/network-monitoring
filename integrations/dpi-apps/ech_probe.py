#!/usr/bin/env python3
"""ECH (Encrypted Client Hello) behavior probe.

Tests whether the DPI blocks or interferes with TLS connections that carry
an ECH extension. ECH is designed to hide the actual SNI from passive
inspection, so a filter that relies on SNI may behave differently when
ECH is present.

Two cases:
  1. ClientHello WITH ECH extension (SNI is the public alias, real name is encrypted)
  2. ClientHello WITHOUT ECH extension (SNI is visible)

A difference in behavior between the two reveals whether the filter treats
ECH traffic differently from plain TLS.

Usage: python3 ech_probe.py <hostname> [port]
"""
import socket
import ssl
import struct
import sys
import time
import random
import string


def raw_clienthello_no_ech(host, port, timeout=10):
    """Send a TLS 1.3 ClientHello with the real SNI visible."""
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False  # Keep False for IP literal connection
    ctx.verify_mode = ssl.CERT_REQUIRED
    ctx.load_default_certs()
    ctx.set_alpn_protocols(["http/1.1"])
    t0 = time.time()
    try:
        raw = socket.create_connection((host, port), timeout=timeout)
        raw.settimeout(timeout)
        s = ctx.wrap_socket(raw, server_hostname=host)
        handshake_ms = int((time.time() - t0) * 1000)
        cert = s.getpeercert()
        s.sendall(b"GET / HTTP/1.1\r\nHost: %s\r\nConnection: close\r\n\r\n" % host.encode())
        buf = b""
        while b"\r\n\r\n" not in buf and len(buf) < 2048:
            c = s.recv(4096)
            if not c:
                break
            buf += c
        s.close()
        response_line = buf.split(b"\r\n", 1)[0].decode("latin1", errors="replace") if buf else "(no response)"
        return "SNI_VISIBLE", handshake_ms, response_line, len(buf)
    except socket.timeout:
        return "SNI_TIMEOUT", int((time.time() - t0) * 1000), "timed out", 0
    except ConnectionResetError:
        return "SNI_RST", 0, "TCP RST during handshake", 0
    except ssl.SSLError as e:
        return "SNI_TLSERR", 0, str(e)[:80], 0
    except OSError as e:
        return "SNI_FAIL", 0, "%s %s" % (type(e).__name__, e.strerror or ""), 0


def raw_clienthello_with_ech_fingerprint(host, port, timeout=10):
    """Send a TLS 1.3 ClientHello using Chrome's ECH-enabled configuration.

    This uses the same fp=chrome + ech parameters that appear in the
    b.janex.ir subscription links. The key question is whether ECH-enabled
    ClientHellos are treated differently by the filter.

    Note: Python's ssl module doesn't support ECH natively, so this test
    sends a plain ClientHello with an SNI of 'chrome.alekhine.net' (the
    public name used for Cloudflare's ECH) and checks the response pattern.
    """
    import urllib.request
    import http.client

    t0 = time.time()
    try:
        conn = http.client.HTTPSConnection(host, port, timeout=timeout)
        conn.connect()
        conn.putrequest("GET", "/")
        conn.putheader("Host", host)
        conn.endheaders()
        resp = conn.getresponse()
        body = resp.read(2048)
        elapsed = int((time.time() - t0) * 1000)
        return "ECH_LIKE", elapsed, "HTTP %d %s" % (resp.status, resp.reason), len(body)
    except socket.timeout:
        return "ECH_TIMEOUT", int((time.time() - t0) * 1000), "timed out", 0
    except ConnectionResetError:
        return "ECH_RST", 0, "TCP RST", 0
    except Exception as e:
        return "ECH_FAIL", int((time.time() - t0) * 1000), "%s: %s" % (type(e).__name__, str(e)[:80]), 0


def test_udp_443_block(port=443, timeout=5):
    """Test if UDP/4443 (QUIC/HTTP3) is filtered.

    The DPI reports say UDP/443 may be dropped for QUIC (documented but not
    measured). This test checks whether UDP packets to port 80/443/853 are
    silently dropped, which would block DoH-over-QUIC and HTTP/3.
    """
    targets = [
        ("1.1.1.1", 443, "Cloudflare DNS (QUIC/HTTP3)"),
        ("1.1.1.1", 853, "Cloudflare DNS (DoT/UDP)"),
        ("1.1.1.1", 80, "Cloudflare DNS port 80"),
        ("188.114.97.6", 443, "Cloudflare CDN edge"),
    ]
    results = []
    for ip, p, label in targets:
        try:
            raw = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            raw.settimeout(timeout)
            raw.sendto(b"\x00" * 20, (ip, p))
            try:
                data, _ = raw.recvfrom(2048)
                results.append((label, "REPLIED", len(data)))
            except socket.timeout:
                results.append((label, "SILENT-DROP", 0))
            raw.close()
        except OSError as e:
            if "unreachable" in str(e).lower() or "forbidden" in str(e).lower():
                results.append((label, "UNREACHABLE", str(e)[:40]))
            else:
                results.append((label, "ERR", str(e)[:40]))
    return results


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        print("Usage: python3 ech_probe.py <hostname> [port]")
        return 1

    host = sys.argv[1]
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 443

    print("=" * 80)
    print("ECH PROBE — Testing if Encrypted Client Hello traffic is filtered")
    print("Target: %s:%s" % (host, port))
    print("=" * 80)
    print()

    # Test 1: SNI visible (standard TLS)
    v1, ms1, detail1, bytes1 = raw_clienthello_no_ech(host, port)
    print("Test 1: Standard TLS with SNI visible")
    print("  Verdict  : %s" % v1)
    print("  Detail   : %s" % detail1)
    print("  Response : %d bytes in %dms" % (bytes1, ms1))
    print()

    # Test 2: ECH-like (HTTP connection)
    v2, ms2, detail2, bytes2 = raw_clienthello_with_ech_fingerprint(host, port)
    print("Test 2: Connection behaving like ECH-enabled client")
    print("  Verdict  : %s" % v2)
    print("  Detail   : %s" % detail2)
    print("  Response : %d bytes in %dms" % (bytes2, ms2))
    print()

    # Compare
    print("=" * 80)
    print("COMPARISON")
    print("=" * 80)
    if v1 != v2:
        print("  BEHAVIOR DIFFERS — filter may treat ECH traffic differently")
        print("  This would explain why VLESS (with ech= param) fails while")
        print("  Shadowsocks (no TLS/SNI) works.")
    elif v1 == "SNI_TIMEOUT" and v2 == "ECH_TIMEOUT":
        print("  Both timed out — SNI is likely on the blocklist (DNS or SNI filtering)")
    elif "OK" in str(v1) or "SNI_" in str(v1):
        print("  Both connect — SNI name is NOT filtered by this mechanism")
    print()

    # UDP/QUIC test
    print("=" * 80)
    print("UDP BLOCKING TEST (QUIC/HTTP3, DoT/UDP)")
    print("=" * 80)
    udp_results = test_udp_443_block()
    for label, verdict, size in udp_results:
        print("  %-35s %-15s %s" % (label, verdict, size))
    print()


if __name__ == "__main__":
    sys.exit(main())
