#!/usr/bin/env python3
"""Pre-flight check: will this hostname survive the filter?

Resolves the name with the only working DoH path on this network
(https://8.8.8.8/dns-query) and then classifies the TLS result:

  SERVED   - a real HTTP response came back; the filter let it through
  BLOCKED  - handshake completed, then zero application bytes (the filter)
  REACHED  - Cloudflare itself answered with a TLS alert (name reached the edge)
  RESET    - TCP RST during the handshake (the filter's harder mode)
  NXDOMAIN - the name does not resolve; fix DNS before judging the filter

Usage: python3 sni_preflight.py vpn.cdn.mydomain.com [more.host ...]
"""
from pathlib import Path
import socket
import ssl
import struct
import base64
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from doh_resolve import doh  # noqa: E402


def classify(host, ip, port=443, timeout=10):
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False  # Keep False for IP literal connection
    ctx.verify_mode = ssl.CERT_REQUIRED
    ctx.load_default_certs()
    ctx.set_alpn_protocols(["http/1.1"])
    try:
        raw = socket.create_connection((ip, port), timeout=timeout)
        raw.settimeout(timeout)
    except socket.timeout:
        return "TCP-TIMEOUT", "no connection in %ds" % timeout
    except OSError as e:
        return "TCP-FAIL", "%s %s" % (type(e).__name__, e.strerror or "")
    try:
        s = ctx.wrap_socket(raw, server_hostname=host)
    except ssl.SSLError as e:
        msg = str(e).upper()
        if "HANDSHAKE_FAILURE" in msg:
            return "REACHED", "Cloudflare answered: no cert/route for this name"
        return "TLS-ERR", str(e)[:60]
    except (socket.timeout, ConnectionResetError) as e:
        return "RESET", "%s during handshake" % type(e).__name__
    try:
        s.sendall(("GET / HTTP/1.1\r\nHost: %s\r\nConnection: close\r\n\r\n" % host).encode())
        buf = b""
        while b"\r\n\r\n" not in buf and len(buf) < 1024:
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
            return "SERVED", "non-HTTP (alpn/h2) response, %dB" % len(buf)
        if not buf:
            return "BLOCKED", "handshake ok, then 0 application bytes"
        return "SERVED", "payload %r" % buf[:40]
    except (socket.timeout, ConnectionResetError) as e:
        return "BLOCKED", "%s, 0 bytes" % type(e).__name__
    finally:
        s.close()


def main():
    hosts = sys.argv[1:]
    if not hosts:
        print(__doc__)
        return 1
    worst = 0
    for h in hosts:
        labels = len(h.split("."))
        ips = doh(h)
        print("%s  (%d labels)" % (h, labels))
        if not ips or ips.startswith("ERR") or ips.startswith("NXDOMAIN") or "no answer" in ips:
            print("   DNS      : %s   <-- cannot judge the filter yet" % ips)
            worst = 1
            continue
        ip = ips.split(",")[0].strip()
        print("   DNS      : %s -> %s" % (h, ip))
        v, d = classify(h, ip)
        print("   VERDICT  : %s (%s)" % (v, d))
        if v == "SERVED":
            print("   OK: this name is forwarded. Safe to use as SNI/Host.")
        elif v == "REACHED":
            print("   Reached the edge. Add the name in Cloudflare, then re-test.")
        else:
            print("   NOT USABLE as-is.")
            worst = 1
        print()
    return worst


if __name__ == "__main__":
    sys.exit(main())
