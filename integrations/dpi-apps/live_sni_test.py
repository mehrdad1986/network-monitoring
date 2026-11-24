#!/usr/bin/env python3
import socket, ssl, time, sys

def tls_test(ip, sni, port=443, timeout=8):
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
        hs_ms = int((time.time()-t0)*1000)
        s.sendall(("GET / HTTP/1.1\r\nHost: %s\r\nConnection: close\r\n\r\n" % sni).encode())
        buf = b""
        while b"\r\n\r\n" not in buf and len(buf) < 2048:
            c = s.recv(4096)
            if not c: break
            buf += c
        s.close()
        total = int((time.time()-t0)*1000)
        resp = buf.split(b"\r\n")[0].decode("latin1",errors="replace")[:60] if buf else "(empty)"
        return "OK: %s | %db hs=%dms total=%dms" % (resp, len(buf), hs_ms, total)
    except socket.timeout:
        return "TIMEOUT: hung %dms" % int((time.time()-t0)*1000)
    except ConnectionResetError:
        return "RST: TCP RST during handshake"
    except ssl.SSLError as e:
        msg = str(e)[:60]
        if "handshake_failure" in msg.lower():
            return "CF_ALERT: reached CF, no cert for SNI"
        return "TLS_ERR: %s" % msg
    except OSError as e:
        return "TCP_FAIL: %s" % (str(e)[:50])

# Test b.janex.ir resolution
bjanex_ip = socket.gethostbyname("b.janex.ir")
print("b.janex.ir resolves to:", bjanex_ip)
print()

# Test on actual resolved IP
print("=== b.janex.ir on actual IP (%s) ===" % bjanex_ip)
result = tls_test(bjanex_ip, "b.janex.ir")
print("  SNI=b.janex.ir ->", result)
print()

# Test b.janex.ir on Cloudflare edge IPs
print("=== b.janex.ir on various Cloudflare IPs ===")
for ip in ["188.114.97.6", "188.114.96.3", "188.114.96.1", "104.21.28.168", "104.21.66.195", "172.67.163.235"]:
    result = tls_test(ip, "b.janex.ir")
    print("  %-20s SNI=b.janex.ir -> %s" % (ip, result))
print()

# Test various SNI on b.janex.ir's actual IP
print("=== Various SNI on b.janex.ir IP (%s) ===" % bjanex_ip)
for sni in ["b.janex.ir", "workers.dev", "cloudflare.com", "facebook.com", "instagram.com", "youtube.com", "x.com", "google.com"]:
    result = tls_test(bjanex_ip, sni)
    print("  SNI=%-30s -> %s" % (sni, result))
print()

# Test workers.dev label variants on 188.114.97.6
print("=== workers.dev label variants on 188.114.97.6 ===")
for sni in ["workers.dev", "a.workers.dev", "a.b.workers.dev", "a.b.c.workers.dev", "a.b.c.d.workers.dev", "a.b.c.d.e.workers.dev"]:
    result = tls_test("188.114.97.6", sni)
    labels = len(sni.split("."))
    print("  SNI=%-40s (%d labels) -> %s" % (sni, labels, result))
print()

# Test big-4 on their real IPs vs b.janex.ir IP
print("=== Big-4 platforms: real IPs vs controls ===")
big4 = {
    "facebook.com": ["157.240.199.35"],
    "youtube.com": ["142.250.185.78"],
    "instagram.com": ["157.240.199.35"],
    "x.com": ["104.244.40.33"],
}
for name, ips in big4.items():
    for ip in ips:
        v1 = tls_test(ip, name)
        v2 = tls_test(ip, "cloudflare.com")
        print("  %-20s SNI=%-20s -> %s" % (name, name, v1))
        print("  %-20s SNI=%-20s -> %s" % (name, "cloudflare.com", v2))

# Also test with no SNI
print()
print("=== No SNI (server_hostname=None) on b.janex.ir IP ===")
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
ctx.check_hostname = False  # Keep False for IP literal connection
ctx.verify_mode = ssl.CERT_REQUIRED
ctx.load_default_certs()
t0 = time.time()
try:
    raw = socket.create_connection((bjanex_ip, 443), timeout=8)
    raw.settimeout(8)
    s = ctx.wrap_socket(raw, server_hostname=None)
    hs = int((time.time()-t0)*1000)
    s.sendall(b"GET / HTTP/1.1\r\nHost: b.janex.ir\r\nConnection: close\r\n\r\n")
    buf = b""
    while b"\r\n\r\n" not in buf and len(buf) < 2048:
        c = s.recv(4096)
        if not c: break
        buf += c
    s.close()
    print("  NO SNI -> OK, %dB received" % len(buf))
except ConnectionResetError:
    print("  NO SNI -> RST")
except ssl.SSLError as e:
    print("  NO SNI -> TLS_ERR: %s" % str(e)[:60])
except socket.timeout:
    print("  NO SNI -> TIMEOUT")
except Exception as e:
    print("  NO SNI -> FAIL: %s" % str(e)[:60])
