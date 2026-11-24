#!/usr/bin/env python3
"""Retry the DoH endpoints whose TLS handshake actually COMPLETED.

A reset means filtered. A completed handshake with a certificate mismatch only
means the SNI is not a filter keyword, so with verification off we may still
get a real DNS answer. Also tests plain-HTTP DoH and SNI-free connects.
"""
import dns.message
import base64
import json
import socket
import ssl
import struct
import sys
import time

Q = "example.com"


def wire(name, qtype=1):
    q = b"".join(bytes([len(p)]) + p.encode() for p in name.split(".")) + b"\x00"
    return struct.pack(">HHHHHH", 0x1234, 0x0100, 1, 0, 0, 0) + q + struct.pack(">HH", qtype, 1)


def probe(ip, sni, host, port=443, verify=False, timeout=14, no_sni=False, plain=False):
    if plain:
        try:
            s = socket.create_connection((ip, port), timeout=timeout)
        except Exception as e:
            return "TCP-FAIL", "%s" % type(e).__name__, b""
        t0 = time.time()
        try:
            s.settimeout(timeout)
            s.sendall(("GET /dns-query?dns=%s HTTP/1.1\r\nHost: %s\r\nAccept: application/dns-message\r\nConnection: close\r\n\r\n"
                       % (base64.urlsafe_b64encode(wire(Q)).decode().rstrip("="), host)).encode())
            buf = b""
            while b"\r\n\r\n" not in buf and len(buf) < 512:
                c = s.recv(4096)
                if not c:
                    break
                buf += c
            head, _, rest = buf.partition(b"\r\n\r\n")
            body = rest
            clen = 0
            for l in head.split(b"\r\n")[1:]:
                if l.lower().startswith(b"content-length:"):
                    clen = int(l.split(b":")[1] or 0)
            while len(body) < clen:
                c = s.recv(4096)
                if not c:
                    break
                body += c
            return "OK", head.split(b"\r\n")[0].decode("latin1") + " (%dms)" % int((time.time() - t0) * 1000), body
        except Exception as e:
            return "FAIL", "%s" % type(e).__name__, b""
        finally:
            s.close()

    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = verify
    ctx.verify_mode = ssl.CERT_REQUIRED if verify else ssl.CERT_NONE
    if verify:
        ctx.load_default_certs()
    try:
        raw = socket.create_connection((ip, port), timeout=timeout)
    except socket.timeout:
        return "TCP-TIMEOUT", "no connect %ds" % timeout, b""
    except OSError as e:
        return "TCP-FAIL", "%s %s" % (type(e).__name__, e.strerror or ""), b""
    t0 = time.time()
    certinfo = ""
    try:
        raw.settimeout(timeout)
        s = ctx.wrap_socket(raw, server_hostname=None if no_sni else sni)
        certinfo = "tls=%s" % s.version()
        if not verify:
            try:
                c = s.getpeercert()
                der = s.getpeercert(True)
                certinfo += " (verified-ok)" if c else " (unverified)"
            except Exception:
                certinfo += " (unverified)"
        hs = int((time.time() - t0) * 1000)
        s.sendall(("GET /dns-query?dns=%s HTTP/1.1\r\nHost: %s\r\nAccept: application/dns-message\r\nUser-Agent: p\r\nConnection: close\r\n\r\n"
                   % (base64.urlsafe_b64encode(wire(Q)).decode().rstrip("="), host)).encode())
        buf = b""
        while b"\r\n\r\n" not in buf and len(buf) < 512:
            c = s.recv(4096)
            if not c:
                break
            buf += c
        head, _, rest = buf.partition(b"\r\n\r\n")
        body = rest
        clen = 0
        for l in head.split(b"\r\n")[1:]:
            if l.lower().startswith(b"content-length:"):
                clen = int(l.split(b":")[1] or 0)
        while len(body) < clen:
            c = s.recv(4096)
            if not c:
                break
            body += c
        return "OK", "%s hs=%dms %s" % (head.split(b"\r\n")[0].decode("latin1"), hs, certinfo), body
    except ssl.SSLError as e:
        return "FILTERED", "SSLError %s" % str(e)[:50], b""
    except (socket.timeout, ConnectionResetError, OSError) as e:
        return "FILTERED", "%s after %dms" % (type(e).__name__, int((time.time() - t0) * 1000),), b""
    finally:
        try:
            s.close()
        except Exception:
            pass


CASES = [
    ("1.1.1.1  SNI=1.1.1.1",        "1.1.1.1",         "1.1.1.1",         "1.1.1.1",  {}),
    ("1.0.0.1  SNI=1.0.0.1",        "1.0.0.1",         "1.0.0.0",         "1.0.0.1",  {}),
    ("8.8.8.8  SNI=8.8.8.8",        "8.8.8.8",         "8.8.8.8",         "8.8.8.8",  {}),
    ("8.8.8.8  SNI=8.8.4.4",        "8.8.8.8",         "8.8.4.4",         "dns.google", {}),
    ("9.9.9.9  SNI=9.9.9.9",        "9.9.9.9",         "9.9.9.9",         "dns.quad9.net", {}),
    ("CF-ip    SNI=cloudflare.com", "104.16.248.249",  "cloudflare.com",  "cloudflare-dns.com", {}),
    ("CF-ip    SNI=cloudflare.com host 1.1.1.1", "104.16.248.249", "cloudflare.com", "1.1.1.1", {}),
    ("CF-ip    SNI=one.one.one.one","104.16.248.249",  "one.one.one.one","cloudflare-dns.com", {}),
    ("CF-wd    SNI=workers.dev",    "188.114.96.3",    "workers.dev",     "cloudflare-dns.com", {}),
    ("1.1.1.1  no SNI",             "1.1.1.1",         None,              "1.1.1.1",  {"no_sni": True}),
    ("8.8.8.8  no SNI",             "8.8.8.8",         None,              "dns.google", {"no_sni": True}),
    ("PLAIN HTTP 1.1.1.1:80",       "1.1.1.1",         None,              "1.1.1.1",  {"plain": True, "port": 80}),
    ("PLAIN HTTP 8.8.8.8:80",       "8.8.8.8",         None,              "dns.google", {"plain": True, "port": 80}),
    ("PLAIN HTTP 9.9.9.9:80",       "9.9.9.9",         None,              "dns.quad9.net", {"plain": True, "port": 80}),
    ("PLAIN HTTP 1.12.12.12:80",    "1.12.12.12",      None,              "doh.pub",  {"plain": True, "port": 80}),
]

for label, ip, sni, host, kw in CASES:
    v, info, body = probe(ip, sni, host, **kw)
    j = None
    if body:
        try:
            j = {"Answer": [{"type": rrset.rdtype, "data": record.to_text()} for rrset in dns.message.from_wire(body).answer for record in rrset]}
        except Exception:
            j = None
    if j and j.get("Answer"):
        ans = ";".join(str(a.get("data")) for a in j["Answer"])[:50]
        print("  %-42s %-10s PASS  %s | %s" % (label, v, info, ans))
    else:
        note = ""
        if body:
            note = "body=%r" % body[:60]
        print("  %-42s %-10s %s %s" % (label, v, info, note))
    sys.stdout.flush()
