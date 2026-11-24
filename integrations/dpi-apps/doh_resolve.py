#!/usr/bin/env python3
"""Resolve arbitrary names using the ONE DoH path that survives this network's
filter: HTTPS to 8.8.8.8 with SNI=8.8.8.8 (cert CN=dns.google, IP SAN 8.8.8.8).
Every resolver *hostname* is RST-blocked, so an IP literal is mandatory.
"""
import base64
import json
import socket
import ssl
import struct
import sys

# Each ISP blocks a different resolver: MCI allows Google, Rightel allows
# Cloudflare. Try all four and use whichever answers.
RESOLVERS = [("1.1.1.1", "1.1.1.1"), ("8.8.8.8", "8.8.8.8"),
             ("1.0.0.1", "1.0.0.1"), ("8.8.4.4", "8.8.4.4")]


def wire(name, qtype=1):
    q = b"".join(bytes([len(p)]) + p.encode() for p in name.split(".")) + b"\x00"
    return struct.pack(">HHHHHH", 0x1234, 0x0100, 1, 0, 0, 0) + q + struct.pack(">HH", qtype, 1)


def doh(name, qtype=1, timeout=10):
    dns64 = base64.urlsafe_b64encode(wire(name, qtype)).decode().rstrip("=")
    path = "/dns-query?dns=" + dns64
    for ip, sni in RESOLVERS:
        try:
            raw = socket.create_connection((ip, 443), timeout=timeout)
            ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            ctx.check_hostname = True
            ctx.verify_mode = ssl.CERT_REQUIRED
            ctx.load_default_certs()
            # This box's Python default CA path (/usr/lib/ssl/cert.pem) does not
            # exist, so its trust store is empty and every verify fails with
            # code 20. Load the real system bundle explicitly.
            for ca in ("/etc/ssl/certs/ca-certificates.crt", "/etc/pki/tls/certs/ca-bundle.crt"):
                try:
                    ctx.load_verify_locations(cafile=ca)
                    break
                except OSError:
                    continue
            raw.settimeout(timeout)
            s = ctx.wrap_socket(raw, server_hostname=sni)
            s.sendall(("GET %s HTTP/1.1\r\nHost: %s\r\nAccept: application/dns-message\r\n"
                       "Connection: close\r\n\r\n" % (path, sni)).encode())
            buf = b""
            while b"\r\n\r\n" not in buf:
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
            s.close()
            return parse(body)
        except Exception as e:
            last = "%s: %s" % (type(e).__name__, str(e)[:60])
    return "ERR " + last


def parse(body):
    if not body or len(body) < 12:
        return "empty/invalid body"
    rcode = body[3] & 0xF
    qd, an = struct.unpack(">HH", body[4:8])
    off = 12
    for _ in range(qd):
        while body[off] != 0:
            off += body[off] + 1
        off += 5
    out = []
    for _ in range(an):
        if off >= len(body):
            break
        if body[off] & 0xC0 == 0xC0:
            off += 2
        else:
            while body[off] != 0:
                off += body[off] + 1
            off += 1
        rtype, rcls, ttl, rdlen = struct.unpack(">HHIH", body[off:off + 10])
        off += 10
        rdata = body[off:off + rdlen]
        off += rdlen
        if rtype == 1 and rdlen == 4:
            out.append(".".join(str(b) for b in rdata))
        elif rtype == 28 and rdlen == 16:
            out.append(":".join("%02x%02x" % (rdata[i], rdata[i + 1]) for i in range(0, 16, 2)))
        elif rtype == 5:
            out.append("CNAME")
        elif rtype == 15:
            out.append("MX")
        elif rtype == 2:
            out.append("NS")
        else:
            out.append("type%d" % rtype)
    if rcode == 3:
        return "NXDOMAIN"
    return ", ".join(out) if out else "no answer (rcode=%d)" % rcode


if __name__ == "__main__":
    for n in sys.argv[1:]:
        print("  %-52s -> %s" % (n, doh(n)))
