#!/usr/bin/env python3
"""Test actual subscription endpoints + deep SNI/SNI-IP correlation analysis."""
import dns.message
import socket, ssl, time, http.client, urllib.request, base64, struct, json

SINKHOLE = {"10.10.34.36", "10.10.34.35", "10.10.34.34"}

def tls_get(ip, sni, path="/", port=443, timeout=12, no_sni=False):
    """Full TLS handshake + HTTP GET, return full response details."""
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False  # Keep False for IP literal connection
    ctx.verify_mode = ssl.CERT_REQUIRED
    ctx.load_default_certs()
    ctx.set_alpn_protocols(["http/1.1"])
    t0 = time.time()
    try:
        raw = socket.create_connection((ip, port), timeout=timeout)
        raw.settimeout(timeout)
        shn = None if no_sni else sni
        s = ctx.wrap_socket(raw, server_hostname=shn)
        hs_ms = int((time.time()-t0)*1000)
        s.sendall(("GET %s HTTP/1.1\r\nHost: %s\r\nConnection: close\r\n\r\n" % (path, sni)).encode())
        buf = b""
        while b"\r\n\r\n" not in buf and len(buf) < 4096:
            c = s.recv(4096)
            if not c: break
            buf += c
        s.close()
        total = int((time.time()-t0)*1000)
        head, _, body = buf.partition(b"\r\n\r\n")
        status = head.split(b"\r\n")[0].decode("latin1", errors="replace")
        return ("SERVED", "%s | hs=%dms total=%dms | body=%dB" % (status, hs_ms, total, len(body)), body)
    except socket.timeout:
        return ("HANG", "silent drop after %dms" % int((time.time()-t0)*1000), b"")
    except ConnectionResetError:
        return ("RST", "TCP RST during handshake", b"")
    except ssl.SSLError as e:
        msg = str(e)[:60]
        if "handshake_failure" in msg.lower():
            return ("CF_ALERT", "Cloudflare reached, no cert for SNI", b"")
        return ("TLS_ERR", msg, b"")
    except OSError as e:
        return ("TCP_FAIL", "%s: %s" % (type(e).__name__, str(e)[:50]), b"")

def tcp_check(ip, port, timeout=6):
    t0 = time.time()
    try:
        raw = socket.create_connection((ip, port), timeout=timeout)
        raw.close()
        return "OK", "%dms" % int((time.time()-t0)*1000)
    except socket.timeout:
        return "TIMEOUT", "%dms" % int((time.time()-t0)*1000)
    except ConnectionResetError:
        return "RST", "reset"
    except OSError as e:
        return "FAIL", str(e)[:50]

def doh_resolve(name):
    """Resolve via DoH IP-literal."""
    dns_wire = b"".join(bytes([len(p)]) + p.encode() for p in name.split(".")) + b"\x00"
    dns_msg = struct.pack(">HHHHHH", 0x1234, 0x0100, 1, 0, 0, 0) + dns_wire + struct.pack(">HH", 1, 1)
    b64 = base64.urlsafe_b64encode(dns_msg).decode().rstrip("=")
    path = "/dns-query?dns=" + b64
    for ip in ("8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1"):
        conn = None
        try:
            conn = http.client.HTTPSConnection(ip, 443, timeout=8)
            conn.connect()
            conn.request("GET", path, headers={"Host": ip, "Accept": "application/dns-message"})
            resp = conn.getresponse()
            if resp.status == 200:
                j = {"Answer": [{"type": rrset.rdtype, "data": record.to_text()} for rrset in dns.message.from_wire(resp.read()).answer for record in rrset]}
                ips = [a["data"] for a in j.get("Answer", []) if a.get("type") == 1]
                if ips:
                    conn.close()
                    return ips, ip
            conn.close()
        except Exception:
            continue
        finally:
            if conn is not None:
                conn.close()
    return [], "failed"

# ============================================================
print("=" * 90)
print("ACTUAL SUBSCRIPTION ENDPOINT TESTS")
print("=" * 90)
print()

# Test the failing workers.dev subscription
print("1. FAILING SUBSCRIPTION: test-sub.example.workers.dev")
print("-" * 90)
endpoints = [
    ("/sub/vless?token=oxzw5p4bvlvjepu1", "vless"),
    ("/sub/trojan?token=oxzw5p4bvlvjepu1", "trojan"),
    ("/sub/clash?token=oxzw5p4bvlvjepu1", "clash"),
]
failing_sni = "test-sub.example.workers.dev"

# DNS
try:
    ip = socket.gethostbyname(failing_sni)
    print("DNS: %s -> %s [%s]" % (failing_sni, ip, "SINKHOLE" if ip in SINKHOLE else "genuine"))
except Exception as e:
    print("DNS: FAIL - %s" % e)
    ip = "188.114.96.3"  # fallback

# DoH resolution
ips, resolver = doh_resolve(failing_sni)
if ips:
    print("DoH: %s -> %s (via %s)" % (failing_sni, ips[0], resolver))
else:
    print("DoH: ALL RESOLVERS FAILED")

# TCP tests on all Cloudflare IPs
print("\nTCP connectivity to Cloudflare IPs:")
cloudflare_ips = ["188.114.97.6", "188.114.96.3", "188.114.96.1", "104.21.28.168", "104.21.66.195"]
for cip in cloudflare_ips:
    v, d = tcp_check(cip, 443)
    print("  %s:443 -> %s (%s)" % (cip, v, d))

# TLS tests with actual subscription paths
print("\nTLS SNI=same name, actual subscription paths:")
for path, label in endpoints:
    for cip in ["188.114.97.6", "188.114.96.3"]:
        v, d, body = tls_get(cip, failing_sni, path)
        body_preview = body[:100].decode("utf-8", errors="replace") if body else "(empty)"
        print("  %s @ %s -> %s: %s | body: %s" % (label, cip, v, d, body_preview[:80]))
print()

# Test b.janex.ir subscription (same structure)
print("2. B.JANEX.IR SUBSCRIPTION (same token structure)")
print("-" * 90)
bjanex_sni = "b.janex.ir"
bjanex_paths = [
    "/sub/vless?token=2gdbdhrpw3ldfrwu",
    "/sub/singbox?token=2gdbdhrpw3ldfrwu",
]
for path in bjanex_paths:
    for cip in ["188.114.97.6", "188.114.96.3"]:
        v, d, body = tls_get(cip, bjanex_sni, path)
        print("  %s @ %s SNI=%s -> %s: %s" % (path[:40], cip, bjanex_sni, v, d[:80] if isinstance(d, str) else d))
        if body:
            print("    body preview: %s" % body[:100].decode("utf-8", errors="replace"))
print()

# SNI-IP correlation: test b.janex.ir SNI on each Cloudflare IP
print("3. SNI-IP CORRELATION: b.janex.ir SNI on all Cloudflare IPs")
print("-" * 90)
for cip in cloudflare_ips:
    v, d, _ = tls_get(cip, bjanex_sni, "/")
    print("  %s SNI=b.janex.ir -> %s: %s" % (cip, v, d))
print()

# SNI-IP correlation: abcd workers.dev on each Cloudflare IP
print("4. SNI-IP CORRELATION: test-sub.example.workers.dev SNI")
print("-" * 90)
for cip in cloudflare_ips:
    v, d, _ = tls_get(cip, failing_sni, "/")
    print("  %s SNI=abcd...workers.dev -> %s: %s" % (cip, v, d))
print()

# Test workers.dev label variants on 188.114.97.6 specifically
print("5. WORKERS.DEV LABEL SQUARE on 188.114.97.6")
print("-" * 90)
for sni in ["workers.dev", "a.workers.dev", "a.b.workers.dev", "test-sub.example.workers.dev",
            "b.janex.ir", "cloudflare.com", "google.com"]:
    v, d, _ = tls_get("188.114.97.6", sni, "/")
    labels = len(sni.split("."))
    print("  %-50s (%d labels) -> %s: %s" % (sni, labels, v, d))
print()

# Test ECH: does the filter block ClientHello with ECH extension?
print("6. ECH TESTING: ClientHello with ECH-like patterns")
print("-" * 90)
# Test SNI-less ClientHello on b.janex.ir IP
ip = socket.gethostbyname("b.janex.ir")
v, d, _ = tls_get(ip, "b.janex.ir", "/", no_sni=True)
print("  No SNI on b.janex.ir IP -> %s: %s" % (v, d))

# Test with different ALPN
for alpn in ["http/1.1", "h2"]:
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False  # Keep False for IP literal connection
    ctx.verify_mode = ssl.CERT_REQUIRED
    ctx.load_default_certs()
    ctx.set_alpn_protocols([alpn])
    try:
        raw = socket.create_connection((ip, 443), timeout=10)
        raw.settimeout(10)
        s = ctx.wrap_socket(raw, server_hostname="b.janex.ir")
        s.sendall(b"GET / HTTP/1.1\r\nHost: b.janex.ir\r\nConnection: close\r\n\r\n")
        buf = b""
        while b"\r\n\r\n" not in buf and len(buf) < 2048:
            c = s.recv(4096)
            if not c: break
            buf += c
        s.close()
        resp = buf.split(b"\r\n")[0].decode("latin1", errors="replace")[:60] if buf else "(empty)"
        print("  SNI=b.janex.ir ALPN=%-10s -> SERVED: %s (%db)" % (alpn, resp, len(buf)))
    except socket.timeout:
        print("  SNI=b.janex.ir ALPN=%-10s -> HANG (silent drop)" % alpn)
    except ConnectionResetError:
        print("  SNI=b.janex.ir ALPN=%-10s -> RST" % alpn)
    except ssl.SSLError as e:
        print("  SNI=b.janex.ir ALPN=%-10s -> TLS_ERR: %s" % (alpn, str(e)[:50]))
    except Exception as e:
        print("  SNI=b.janex.ir ALPN=%-10s -> FAIL: %s" % (alpn, str(e)[:50]))
print()

# Big-4 SNI tests on b.janex.ir IP
print("7. BIG-4 SNI TEST on b.janex.ir IP (%s)" % ip)
print("-" * 90)
for sni in ["b.janex.ir", "facebook.com", "instagram.com", "youtube.com", "x.com",
            "whatsapp.com", "telegram.org", "cloudflare.com", "workers.dev", "google.com"]:
    v, d = tls_get(ip, sni, "/")
    print("  SNI=%-25s -> %s: %s" % (sni, v, d))
print()

# Port tests
print("8. PORT BEHAVIOR on b.janex.ir IP")
print("-" * 90)
for port in [80, 443, 8443, 2053, 2083, 2087, 2096]:
    # HTTP (no TLS, no SNI)
    try:
        raw = socket.create_connection((ip, port), timeout=6)
        raw.settimeout(6)
        raw.sendall(b"GET / HTTP/1.1\r\nHost: b.janex.ir\r\nConnection: close\r\n\r\n")
        buf = b""
        while b"\r\n\r\n" not in buf and len(buf) < 1024:
            c = raw.recv(4096)
            if not c: break
            buf += c
        raw.close()
        resp = buf.split(b"\r\n")[0].decode("latin1", errors="replace")[:50] if buf else "(empty)"
        print("  port %5d HTTP  -> SERVED: %s (%db)" % (port, resp, len(buf)))
    except Exception as e:
        v = type(e).__name__
        print("  port %5d HTTP  -> %s: %s" % (port, v, str(e)[:40]))

    # TLS with SNI
    v, d = tls_get(ip, "b.janex.ir", "/", port=port)
    print("  port %5d TLS   -> %s: %s" % (port, v, d))
print()

# QUIC/UDP test
print("9. QUIC/UDP BLOCKING (new finding)")
print("-" * 90)
for ip, port, label in [("1.1.1.1", 443, "Cloudflare DoH"),
                         ("188.114.97.6", 443, "Cloudflare CDN"),
                         ("1.1.1.1", 853, "DoT"),
                         ("8.8.8.8", 443, "Google DoH")]:
    try:
        raw = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        raw.settimeout(4)
        raw.sendto(b"\x00" * 20, (ip, port))
        try:
            data, _ = raw.recvfrom(2048)
            print("  %-25s UDP/%d -> REPLIED (%d bytes)" % (label, port, len(data)))
        except socket.timeout:
            print("  %-25s UDP/%d -> SILENT DROP (filtered)" % (label, port))
        raw.close()
    except OSError as e:
        print("  %-25s UDP/%d -> %s" % (label, port, str(e)[:40]))
print()

# TCP to sinkhole
print("10. SINKHOLE BEHAVIOR (10.10.34.36)")
print("-" * 90)
for port in [53, 80, 443, 8080, 22, 853]:
    v, d = tcp_check("10.10.34.36", port, timeout=4)
    print("  10.10.34.36:%-5d -> %s (%s)" % (port, v, d))
# UDP to sinkhole
try:
    raw = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    raw.settimeout(4)
    raw.sendto(b"\x00" * 16, ("10.10.34.36", 53))
    try:
        data, _ = raw.recvfrom(2048)
        print("  10.10.34.36:53 UDP -> REPLIED (%d bytes)" % len(data))
    except socket.timeout:
        print("  10.10.34.36:53 UDP -> SILENT DROP")
    raw.close()
except OSError as e:
    print("  10.10.34.36:53 UDP -> %s" % str(e)[:40])
