#!/usr/bin/env python3
"""Cross-ISP comparison battery.

Same measurements as the MCI investigation, so the two networks can be compared
row by row. Everything is classified by POSITIVE CONTROL wherever a control is
possible, because "no data" is ambiguous on its own.
"""
import socket
import ssl
import struct
import base64
import subprocess
import sys
import time

CLOUDFLARE_EDGE = "188.114.96.3"
VLESS_SERVER = "104.21.28.168"
BLOCKED_WORKER = "test-sub.example.workers.dev"
VLESS_SNI = "LoXBhBOHuKwgVX51H35nv6bEFNHa4a.neTFREedoM-PROJeCT.wORKErs.DEv"


def banner(t):
    print("\n" + "=" * 96)
    print(t)
    print("=" * 96)


def dns(name, server="1.1.1.1", qtype="A"):
    try:
        out = subprocess.run(["dig", "+short", "+time=3", "+tries=1", name, qtype, "@" + server],
                             capture_output=True, text=True, timeout=8).stdout.strip()
    except Exception as e:
        return "dig-failed:%s" % type(e).__name__
    return out.replace("\n", ",") if out else "(no answer)"


def tls_classify(ip, sni, port=443, timeout=9, do_http=True):
    """SERVED / BLOCKED / REACHED-CF / RESET / TLS-ERR, by positive control."""
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False  # Keep False for IP literal connection
    ctx.verify_mode = ssl.CERT_REQUIRED
    ctx.load_default_certs()
    ctx.set_alpn_protocols(["http/1.1"])
    try:
        raw = socket.create_connection((ip, port), timeout=timeout)
        raw.settimeout(timeout)
    except socket.timeout:
        return "TCP-TIMEOUT", "no connect %ds" % timeout
    except OSError as e:
        return "TCP-FAIL", "%s %s" % (type(e).__name__, e.strerror or "")
    try:
        s = ctx.wrap_socket(raw, server_hostname=sni)
    except ssl.SSLError as e:
        return ("REACHED-CF", "tls alert") if "HANDSHAKE" in str(e).upper() else ("TLS-ERR", str(e)[:40])
    except (socket.timeout, ConnectionResetError) as e:
        return "RESET", "%s in handshake" % type(e).__name__
    except OSError as e:
        return "DROP", type(e).__name__
    if not do_http:
        s.close()
        return "HANDSHAKE-OK", "no data test"
    try:
        s.sendall(("GET / HTTP/1.1\r\nHost: %s\r\nConnection: close\r\n\r\n" % sni).encode())
        buf = b""
        while b"\r\n\r\n" not in buf and len(buf) < 512:
            try:
                c = s.recv(4096)
            except socket.timeout:
                break
            if not c:
                break
            buf += c
        if buf.startswith(b"HTTP/"):
            return "SERVED", buf.split(b"\r\n", 1)[0].decode("latin1")
        if buf[:1] in (b"\x17", b"\x16"):
            return "SERVED", "alpn frame %dB" % len(buf)
        return ("BLOCKED", "0 app bytes") if not buf else ("SERVED", "payload")
    except socket.timeout:
        return "BLOCKED", "0 bytes, timeout"
    except (ConnectionResetError, OSError) as e:
        return "DROP", type(e).__name__
    finally:
        s.close()


def dot(ip, port=853, timeout=6):
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False  # Keep False for IP literal connection
    ctx.verify_mode = ssl.CERT_REQUIRED
    ctx.load_default_certs()
    try:
        raw = socket.create_connection((ip, port), timeout=timeout)
        raw.settimeout(timeout)
    except socket.timeout:
        return "TIMEOUT"
    except OSError as e:
        return "FAIL:%s" % type(e).__name__
    try:
        s = ctx.wrap_socket(raw, server_hostname=ip)
        q = b"\x03www\x07example\x03com\x00"
        msg = struct.pack(">HHHHHH", 0x2222, 0x0100, 1, 0, 0, 0) + q + struct.pack(">HH", 1, 1)
        s.sendall(struct.pack(">H", len(msg)) + msg)
        h = s.recv(2)
        return "ANSWER" if len(h) == 2 else "NO-REPLY"
    except socket.timeout:
        return "TIMEOUT"
    except Exception as e:
        return "FAIL:%s" % type(e).__name__
    finally:
        try:
            s.close()
        except Exception:
            pass


def doh_by_ip(ip, sni, timeout=8):
    """Query example.com over DoH at an IP literal; validate a real DNS answer."""
    dnsmsg = struct.pack(">HHHHHH", 0x1234, 0x0100, 1, 0, 0, 0) + \
        b"\x07example\x03com\x00" + struct.pack(">HH", 1, 1)
    b64 = base64.urlsafe_b64encode(dnsmsg).decode().rstrip("=")
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False  # Keep False for IP literal connection
    ctx.verify_mode = ssl.CERT_REQUIRED
    ctx.load_default_certs()
    try:
        raw = socket.create_connection((ip, 443), timeout=timeout)
        raw.settimeout(timeout)
    except socket.timeout:
        return "TIMEOUT", "no connect %ds" % timeout
    except OSError as e:
        return "FAIL", "%s" % type(e).__name__
    try:
        s = ctx.wrap_socket(raw, server_hostname=sni)
    except Exception as e:
        raw.close()
        return "FILTERED", "%s: %s" % (type(e).__name__, str(e)[:34])
    try:
        s.sendall(("GET /dns-query?dns=%s HTTP/1.1\r\nHost: %s\r\n"
                   "Accept: application/dns-message\r\nConnection: close\r\n\r\n"
                   % (b64, sni)).encode())
        buf = b""
        while b"\r\n\r\n" not in buf and len(buf) < 512:
            c = s.recv(4096)
            if not c:
                break
            buf += c
        head, _, rest = buf.partition(b"\r\n\r\n")
        clen = 0
        for l in head.split(b"\r\n")[1:]:
            if l.lower().startswith(b"content-length:"):
                clen = int(l.split(b":")[1] or 0)
        body = rest
        while len(body) < clen:
            c = s.recv(4096)
            if not c:
                break
            body += c
        status = head.split(b"\r\n")[0].decode("latin1")
        # validate: parse the answer count and first A record
        if len(body) >= 12:
            an = struct.unpack(">H", body[6:8])[0]
            return ("WORKS" if an > 0 else "HTTP-OK-NOANS"), "%s answers=%d" % (status, an)
        return "HTTP", status
    except socket.timeout:
        return "TIMEOUT", "no response"
    except Exception as e:
        return "FAIL", type(e).__name__
    finally:
        try:
            s.close()
        except Exception:
            pass


def main():
    banner("1. DNS POISONING OF THE HEAVILY CENSORED SITES")
    for d in ["facebook.com", "instagram.com", "youtube.com", "x.com",
              "workers.dev", "cloudflare.com"]:
        print("  %-16s A@1.1.1.1=%-18s A@8.8.8.8=%-18s AAAA=%s"
              % (d, dns(d, "1.1.1.1"), dns(d, "8.8.8.8"), dns(d, "1.1.1.1", "AAAA")))

    banner("2. ENCRYPTED DNS — DoT/853")
    for ip in ["1.1.1.1", "8.8.8.8", "9.9.9.9", "94.140.14.14", "185.222.222.222"]:
        print("  %-18s :853  %s" % (ip, dot(ip)))

    banner("3. ENCRYPTED DNS — DoH by NAME (expect RST if filtered)")
    for ip, host in [("104.16.248.249", "cloudflare-dns.com"), ("8.8.8.8", "dns.google"),
                     ("9.9.9.9", "dns.quad9.net"), ("94.140.14.14", "dns.adguard-dns.com"),
                     ("185.222.222.222", "dns.sb"), ("1.12.12.12", "doh.pub")]:
        v, d = tls_classify(ip, host, do_http=False)
        print("  %-22s @%-15s %-12s %s" % (host, ip, v, d))

    banner("4. ENCRYPTED DNS — DoH by IP LITERAL (the MCI bypass)")
    for ip, sni in [("8.8.8.8", "8.8.8.8"), ("8.8.4.4", "8.8.4.4"),
                    ("1.1.1.1", "1.1.1.1"), ("1.0.0.1", "1.0.0.1"),
                    ("9.9.9.9", "9.9.9.9")]:
        v, d = doh_by_ip(ip, sni)
        print("  https://%-12s/dns-query  %-14s %s" % (ip, v, d))

    banner("5. SNI NAME MATRIX at Cloudflare edge %s" % CLOUDFLARE_EDGE)
    for label, sni in [("workers.dev apex (2 lbl)", "workers.dev"),
                       ("a.workers.dev (3 lbl)", "a.workers.dev"),
                       ("a.b.workers.dev (4 lbl)", "a.b.workers.dev"),
                       ("a.b.c.workers.dev (5 lbl)", "a.b.c.workers.dev"),
                       ("a.b.c.d.workers.dev (6 lbl)", "a.b.c.d.workers.dev"),
                       ("real blocked worker", BLOCKED_WORKER),
                       ("cloudflare.com", "cloudflare.com"),
                       ("challenges.cloudflare.com", "challenges.cloudflare.com"),
                       ("pages.dev", "pages.dev"),
                       ("www.pages.dev", "www.pages.dev")]:
        v, d = tls_classify(CLOUDFLARE_EDGE, sni)
        print("  %-30s %-12s %s" % (label, v, d))

    banner("6. THE USER'S VLESS FRONT at %s" % VLESS_SERVER)
    for label, sni in [("their SNI as-written", VLESS_SNI),
                       ("their SNI lowercased", VLESS_SNI.lower()),
                       ("their WS Host", "loxbhbohukwgvx51h35nv6befnha4a.netfreedom-project.workers.dev"),
                       ("control cloudflare.com", "cloudflare.com")]:
        v, d = tls_classify(VLESS_SERVER, sni)
        print("  %-30s %-12s %s" % (label, v, d))

    banner("7. plain HTTP port 80 to the blocked worker (no SNI exists in HTTP/1.1 TLS-less)")
    try:
        s = socket.create_connection((CLOUDFLARE_EDGE, 80), timeout=8)
        s.sendall(("GET /healthz HTTP/1.1\r\nHost: %s\r\nConnection: close\r\n\r\n"
                   % BLOCKED_WORKER).encode())
        s.settimeout(8)
        buf = b""
        while b"\r\n\r\n" not in buf and len(buf) < 256:
            c = s.recv(1024)
            if not c:
                break
            buf += c
        print("  %s" % (buf.split(b"\r\n")[0].decode("latin1") if buf else "0 bytes (silent)"))
        s.close()
    except Exception as e:
        print("  failed: %s" % type(e).__name__)
    return 0


if __name__ == "__main__":
    sys.exit(main())