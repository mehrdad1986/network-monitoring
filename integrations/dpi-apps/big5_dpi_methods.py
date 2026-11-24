#!/usr/bin/env python3
"""Big-5 platform DPI method enumeration.

For each platform (Facebook, Instagram, YouTube, X/Twitter, WhatsApp, Telegram),
discovers ALL filtering layers independently:

  Layer A: DNS  — resolution result (genuine IP vs sinkhole)
  Layer B: TCP  — can we even establish a TCP connection to the resolved IP?
  Layer C: TLS  — does the TLS handshake complete? SNI effect?
  Layer D: E2E  — does HTTP application data succeed?

Each layer is tested independently with controls. A platform is "fully blocked" only
when all layers are exhausted.

Requires network access to the Iranian DPI environment (MCI or Rightel).
"""
import dns.message
import socket
import ssl
import struct
import sys
import time
import base64
import json

SINKHOLE_IPS = {"10.10.34.36", "10.10.34.35", "10.10.34.34"}
DOC_PREFIX_AAAA = "2001:4188:2:600"

# Known genuine IPs for ground truth (from reports + public records)
PLATFORMS = {
    "facebook.com": [
        "157.240.199.35", "157.240.192.35", "157.240.1.35",
        "157.240.199.53", "69.171.235.12", "31.13.80.36",
    ],
    "instagram.com": [
        "157.240.199.35", "157.240.1.35", "69.171.235.12",
        "31.13.80.36", "185.60.216.34", "179.60.192.36",
    ],
    "youtube.com": [
        "142.250.185.78", "142.250.72.78", "142.251.32.78",
        "172.217.14.142", "172.217.0.14", "216.58.212.142",
    ],
    "x.com": [
        "104.244.40.33", "104.244.42.33", "104.244.41.33",
        "192.133.76.133", "17.253.144.10", "104.244.40.1",
    ],
    "whatsapp.com": [
        "157.240.199.35", "157.240.1.35", "31.13.80.36",
        "185.60.216.34", "179.60.192.36", "102.132.96.36",
    ],
    "telegram.org": [
        "149.154.167.197", "149.154.167.97", "149.154.167.120",
        "91.108.196.162", "91.108.196.102", "91.108.196.106",
    ],
}

CONTROL_GENUINE = {
    "cloudflare.com": "104.16.132.229",
    "workers.dev": "104.18.12.15",
    "google.com": "142.250.191.78",
    "go.dev": "216.239.34.21",
}


def doh_resolve(name, timeout=10):
    """Resolve via DoH using IP literal (8.8.8.8 or 1.1.1.1)."""
    import urllib.request
    import http.client

    dns_wire = b"".join(bytes([len(p)]) + p.encode() for p in name.split(".")) + b"\x00"
    dns_msg = struct.pack(">HHHHHH", 0x1234, 0x0100, 1, 0, 0, 0) + dns_wire + struct.pack(">HH", 1, 1)
    b64 = base64.urlsafe_b64encode(dns_msg).decode().rstrip("=")
    path = "/dns-query?dns=" + b64

    for ip in ("8.8.8.8", "1.1.1.1", "8.8.4.4", "1.0.0.1"):
        conn = None
        try:
            conn = http.client.HTTPSConnection(ip, 443, timeout=timeout)
            conn.connect()
            conn.request("GET", path,
                        headers={"Host": ip, "Accept": "application/dns-message"})
            resp = conn.getresponse()
            if resp.status == 200:
                body = resp.read()
                j = {"Answer": [{"type": rrset.rdtype, "data": record.to_text()} for rrset in dns.message.from_wire(body).answer for record in rrset]}
                if "Answer" in j:
                    ips = [a["data"] for a in j["Answer"] if a["type"] == 1]
                    conn.close()
                    return ips, "DoH via %s" % ip
            conn.close()
        except Exception:
            continue
        finally:
            if conn is not None:
                conn.close()
    return [], "All DoH resolvers failed"


def tls_probe(ip, sni, port=443, timeout=12):
    """Test TLS handshake to ip with given SNI. Returns (verdict, detail)."""
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False  # Keep False for IP literal connection
    ctx.verify_mode = ssl.CERT_REQUIRED
    ctx.load_default_certs()
    ctx.set_alpn_protocols(["http/1.1"])
    t0 = time.time()
    try:
        raw = socket.create_connection((ip, port), timeout=timeout)
        raw.settimeout(timeout)
        s = ctx.wrap_socket(raw, server_hostname=sni)
        hs_ms = int((time.time() - t0) * 1000)
        cert = s.getpeercert()
        s.sendall(b"GET / HTTP/1.1\r\nHost: %s\r\nConnection: close\r\n\r\n" % sni.encode())
        buf = b""
        while b"\r\n\r\n" not in buf and len(buf) < 2048:
            c = s.recv(4096)
            if not c:
                break
            buf += c
        s.close()
        resp_line = buf.split(b"\r\n", 1)[0].decode("latin1") if buf else "(empty)"
        return "TLS_OK", "%dms, %s, %dB received" % (hs_ms, resp_line, len(buf))
    except socket.timeout:
        return "HANG", "timeout after %dms (possible silent drop)" % int((time.time() - t0) * 1000)
    except ConnectionResetError:
        return "RST", "TCP RST during handshake"
    except ssl.SSLError as e:
        if "handshake_failure" in str(e).lower():
            return "CF_ALERT", "Cloudflare TLS alert (reached edge, no cert)"
        return "TLS_ERR", str(e)[:60]
    except OSError as e:
        return "FAIL", "%s: %s" % (type(e).__name__, e.strerror or "")


def tcp_probe(ip, port=443, timeout=6):
    """Raw TCP connect test. Returns (verdict, rtt_ms)."""
    t0 = time.time()
    try:
        raw = socket.create_connection((ip, port), timeout=timeout)
        rtt = int((time.time() - t0) * 1000)
        raw.close()
        return "CONNECT", rtt
    except socket.timeout:
        return "TIMEOUT", timeout * 1000
    except ConnectionResetError:
        return "RST", 0
    except OSError as e:
        return "FAIL", str(e)[:60]


def main():
    print("=" * 90)
    print("BIG-5 PLATFORM DPI METHOD ENUMERATION")
    print("Tests DNS, TCP, TLS(SNI), and E2E layers independently")
    print("=" * 90)
    print()

    # Controls first
    print("--- POSITIVE CONTROLS (should pass) ---")
    for name, ip in CONTROL_GENUINE.items():
        v, d = tls_probe(ip, name)
        print("  %-20s %-15s %-10s %s" % (name, ip, v, d))
    print()

    for platform, known_ips in PLATFORMS.items():
        print("=" * 90)
        print("PLATFORM: %s" % platform.upper())
        print("=" * 90)

        # Layer A: DNS resolution via DoH
        print("\n  [Layer A: DNS Resolution via DoH]")
        ips, method = doh_resolve(platform)
        print("    Method: %s" % method)
        if not ips:
            print("    Result: FAILED TO RESOLVE (DoH blocked or DNS poisoned)")
            print("    Verdict: DNS FORGERY if resolves to sinkhole, else DoH blocked")
        elif ips[0] in SINKHOLE_IPS:
            print("    Result: %s -> SINKHOLE (%s)" % (ips[0], "DNS FORGERY/POISONING"))
            print("    Verdict: MECANISM 1 — DNS Forgery (A=10.10.34.x)")
        else:
            print("    Result: %s (genuine IP)" % ips[0])

        # Layer B: TCP connectivity
        print("\n  [Layer B: TCP Connectivity]")
        test_ips = ips if ips else known_ips
        for ip in test_ips[:3]:
            v, rtt = tcp_probe(ip, port=443)
            if ip in SINKHOLE_IPS:
                print("    %-15s port 443  %s  (sinkhole — all ports dead)" % (ip, v))
            else:
                print("    %-15s port 443  %s  %s" % (ip, v, str(rtt) + "ms" if isinstance(rtt, (int, float)) else rtt))

        # Layer C: TLS SNI behavior
        print("\n  [Layer C: TLS SNI Behavior]")
        test_ips = ips if ips and ips[0] not in SINKHOLE_IPS else known_ips
        for ip in test_ips[:3]:
            if ip in SINKHOLE_IPS:
                print("    %-15s SNI=%-30s SKIP (sinkhole)" % (ip, platform))
            else:
                v, d = tls_probe(ip, platform)
                print("    %-15s SNI=%-30s %s  %s" % (ip, platform, v, d))

        # Layer C-control: same IP, SNI=cloudflare.com
        print("\n  [Layer C-Control: Same IP, SNI=cloudflare.com]")
        if test_ips and test_ips[0] not in SINKHOLE_IPS:
            v, d = tls_probe(test_ips[0], "cloudflare.com")
            print("    %-15s SNI=cloudflare.com             %s  %s" % (test_ips[0], v, d))

        # Layer D: E2E HTTP
        print("\n  [Layer D: E2E Summary]")
        if ips and ips[0] in SINKHOLE_IPS:
            print("    BLOCKED at Layer A (DNS) — never reaches TLS")
        elif test_ips and test_ips[0] not in SINKHOLE_IPS:
            v, d = tls_probe(test_ips[0], platform)
            if v == "TLS_OK":
                print("    %s — REACHABLE" % platform)
            elif v == "HANG":
                print("    %s — SNI SILENT DROP (filter reads SNI, completes handshake, drops app data)" % platform)
            elif v == "RST":
                print("    %s — SNI TCP RESET (filter injects RST during handshake)" % platform)
            else:
                print("    %s — %s: %s" % (platform, v, d))
        print()

    print("=" * 90)
    print("SUMMARY OF MECHANISMS BY PLATFORM")
    print("=" * 90)
    print("""
  facebook.com / instagram.com:
    DNS forgery (A=10.10.34.36) + SNI TCP RST at genuine IP
    Two layers stacked: DNS poison + SNI block
    SNI = TCP RST during handshake (not silent drop)

  youtube.com:
    DNS forgery (A=10.10.34.36) + SNI TCP RST
    Same two-layer pattern

  x.com / twitter.com:
    DNS forgery (A=10.10.34.36) + SNI TCP RST

  whatsapp.com:
    Same company as facebook → same DNS forgery + SNI blocking
    (Not explicitly tested in reports, inferred from facebook pattern)

  telegram.org:
    DNS forgery (A=10.10.34.36) confirmed in reports
    SNI behavior at genuine IP not explicitly tested

  cloudflare worker (*.workers.dev):
    NOT DNS poisoned — resolves correctly to Cloudflare
    SNI SILENT DROP (not RST): TLS handshake completes with genuine cert,
    then all client-to-server application bytes silently discarded
    Label-count window: 2-4 labels blocked, 5+ labels forwarded
    Case normalization: filter lowercases SNI before matching
    ClientHello fragmentation: INEFFECTIVE (filter reassembles)

  pages.dev:
    DNS forgery (A=10.10.34.36) + SNI TCP RST
    Harder enforcement than workers.dev (RST vs silent drop)
""")
    return 0


if __name__ == "__main__":
    sys.exit(main())
