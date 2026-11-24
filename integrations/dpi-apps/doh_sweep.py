#!/usr/bin/env python3
"""Exhaustive DoH/DoT reachability probe.

For each candidate we pin an explicit IP (local DNS is poisoned) and report what
actually happened. A pass requires a real DNS JSON answer, not merely HTTP 200.

Also tests the interesting bypass class: a NON-FILTERED SNI (cloudflare.com,
workers.dev) carrying a DoH Host header, to see whether the filter keys on SNI.
"""
import dns.message
import base64
import json
import socket
import ssl
import struct
import sys
import time

QNAME = "example.com"


def b64url_dns(name, qtype=1):
    q = b"".join(bytes([len(p)]) + p.encode() for p in name.split(".")) + b"\x00"
    return base64.urlsafe_b64encode(struct.pack(">HHH", 0x1234, 0x0100, 1)
                                     + q + struct.pack(">HH", qtype, 1)).decode().rstrip("=")


def tls_http_get(ip, sni, host_header, path, port=443, timeout=8, no_sni=False):
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = True
    ctx.verify_mode = ssl.CERT_REQUIRED
    ctx.load_default_certs()  # Load system CA certificates for verification
    t0 = time.time()
    try:
        raw = socket.create_connection((ip, port), timeout=timeout)
    except socket.timeout:
        return "TCP-TIMEOUT", "no connect in %ds" % timeout, 0
    except OSError as e:
        return "TCP-FAIL", "%s %s" % (type(e).__name__, e.strerror or ""), 0
    try:
        raw.settimeout(timeout)
        s = ctx.wrap_socket(raw, server_hostname=None if no_sni else sni)
    except ssl.SSLCertVerificationError as e:
        raw.close()
        return "CERT-FAIL", str(e)[:60], 0
    except ssl.SSLError as e:
        raw.close()
        return "FILTERED", "SSLError %s" % str(e)[:60], 0
    except (socket.timeout, ConnectionResetError) as e:
        raw.close()
        return "FILTERED", "%s" % type(e).__name__, 0
    hs = int((time.time() - t0) * 1000)
    try:
        req = ("GET %s HTTP/1.1\r\nHost: %s\r\nAccept: application/dns-message\r\n"
               "User-Agent: doh-probe\r\nConnection: close\r\n\r\n" % (path, host_header))
        s.sendall(req.encode())
        buf = b""
        while b"\r\n\r\n" not in buf and len(buf) < 512:
            c = s.recv(4096)
            if not c:
                break
            buf += c
        head, _, rest = buf.partition(b"\r\n\r\n")
        clen = 0
        for line in head.split(b"\r\n")[1:]:
            if line.lower().startswith(b"content-length:"):
                clen = int(line.split(b":")[1].strip() or 0)
        body = rest
        while len(body) < clen:
            c = s.recv(4096)
            if not c:
                break
            body += c
        status = head.split(b"\r\n")[0].decode("latin1")
        return "OK", status, body
    except (socket.timeout, ConnectionResetError, OSError) as e:
        return "FILTERED", "%s" % type(e).__name__, 0
    finally:
        try:
            s.close()
        except Exception:
            pass


def check_json(body):
    try:
        j = {"Answer": [{"type": rrset.rdtype, "data": record.to_text()} for rrset in dns.message.from_wire(body).answer for record in rrset]}
    except Exception:
        return None
    if "Answer" in j and j["Answer"]:
        return j
    return None


def dot_probe(ip, port=853, sni=None, timeout=6):
    """Minimal DoT: TLS then a query for QNAME A."""
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False  # Keep False for IP literal connection
    ctx.verify_mode = ssl.CERT_REQUIRED
    ctx.load_default_certs()
    try:
        raw = socket.create_connection((ip, port), timeout=timeout)
    except socket.timeout:
        return "TCP-TIMEOUT", ""
    except OSError as e:
        return "TCP-FAIL", "%s %s" % (type(e).__name__, e.strerror or "")
    try:
        raw.settimeout(timeout)
        s = ctx.wrap_socket(raw, server_hostname=sni or ip)
        q = b"".join(bytes([len(p)]) + p.encode() for p in QNAME.split(".")) + b"\x00"
        msg = struct.pack(">HHHHHH", 0x2222, 0x0100, 1, 0, 0, 0) + q + struct.pack(">HH", 1, 1)
        s.sendall(struct.pack(">H", len(msg)) + msg)
        hdr = s.recv(2)
        if len(hdr) < 2:
            return "NO-REPLY", ""
        ln = struct.unpack(">H", hdr)[0]
        data = s.recv(ln)
        return "ANSWER", "%d bytes, rcode=%d" % (len(data), data[3] & 0xF)
    except socket.timeout:
        return "TIMEOUT", "no answer in %ds" % timeout
    except (ConnectionResetError, OSError, ssl.SSLError) as e:
        return "FILTERED", type(e).__name__
    finally:
        try:
            s.close()
        except Exception:
            pass


DOH = [
    # label, ip, sni, host header
    ("cloudflare-dns.com", "104.16.248.249", "cloudflare-dns.com", "cloudflare-dns.com"),
    ("cloudflare-dns.com", "104.16.249.249", "cloudflare-dns.com", "cloudflare-dns.com"),
    ("1.1.1.1 (IP-SAN SNI)", "1.1.1.1", "1.1.1.1", "1.1.1.1"),
    ("1.0.0.1 (IP-SAN SNI)", "1.0.0.1", "1.0.0.1", "1.0.0.1"),
    ("dns.google", "8.8.8.8", "dns.google", "dns.google"),
    ("8.8.8.8 (IP-SAN SNI)", "8.8.8.8", "8.8.8.8", "8.8.8.8"),
    ("dns.google", "8.8.4.4", "dns.google", "dns.google"),
    ("dns.quad9.net", "9.9.9.9", "dns.quad9.net", "dns.quad9.net"),
    ("9.9.9.9 (IP-SAN SNI)", "9.9.9.9", "9.9.9.9", "9.9.9.9"),
    ("dns.quad9.net", "149.112.112.112", "dns.quad9.net", "dns.quad9.net"),
    ("adguard", "94.140.14.14", "dns.adguard-dns.com", "dns.adguard-dns.com"),
    ("adguard", "94.140.15.15", "dns.adguard-dns.com", "dns.adguard-dns.com"),
    ("alidns", "223.5.5.5", "dns.alidns.com", "dns.alidns.com"),
    ("doh.pub (dnspod)", "1.12.12.12", "doh.pub", "doh.pub"),
    ("doh.pub (dnspod)", "120.53.53.53", "doh.pub", "doh.pub"),
    ("dns.sb", "185.222.222.222", "dns.sb", "dns.sb"),
    ("mullvad", "194.242.2.2", "dns.mullvad.net", "dns.mullvad.net"),
    ("BYPASS: SNI=cloudflare.com", "104.16.248.249", "cloudflare.com", "cloudflare-dns.com"),
    ("BYPASS: SNI=workers.dev", "188.114.96.3", "workers.dev", "cloudflare-dns.com"),
    ("BYPASS: SNI=facebook.com", "157.240.199.35", "facebook.com", "cloudflare-dns.com"),
    ("no-SNI at 1.1.1.1", "1.1.1.1", None, "1.1.1.1"),
]

DOT = [
    ("1.1.1.1:853", "1.1.1.1"), ("8.8.8.8:853", "8.8.8.8"),
    ("9.9.9.9:853", "9.9.9.9"), ("94.140.14.14:853", "94.140.14.14"),
    ("185.222.222.222:853", "185.222.222.222"), ("1.12.12.12:853", "1.12.12.12"),
    ("223.5.5.5:853", "223.5.5.5"),
]


def main():
    path = "/dns-query?dns=" + b64url_dns(QNAME)
    print("=" * 104)
    print("DoH ENDPOINTS  (query=%s A, certificate must validate, answer must be real JSON)" % QNAME)
    print("=" * 104)
    winners = []
    for label, ip, sni, host in DOH:
        v, info, body = tls_http_get(ip, sni, host, path, no_sni=(sni is None))
        j = check_json(body) if body else None
        if j:
            ans = ";".join(str(a.get("data")) for a in j["Answer"])[:46]
            print("  %-26s %-15s PASS   %s | %s" % (label, ip, info, ans))
            winners.append((label, ip, host))
        else:
            print("  %-26s %-15s %-12s %s" % (label, ip, v, info))
        sys.stdout.flush()

    print()
    print("=" * 104)
    print("DoT ENDPOINTS (port 853)")
    print("=" * 104)
    for label, ip in DOT:
        v, d = dot_probe(ip)
        print("  %-26s %-12s %s" % (label, v, d))
        sys.stdout.flush()

    print()
    print("SUMMARY: %d DoH endpoint(s) returned a real answer" % len(winners))
    for w in winners:
        print("   %s  ip=%s  host=%s" % w)
    return 0


if __name__ == "__main__":
    sys.exit(main())
