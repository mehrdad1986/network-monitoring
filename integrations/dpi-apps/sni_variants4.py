#!/usr/bin/env python3
"""Correct SNI/TLS-variant tester for the *.workers.dev filter.

v4 fixes two measurement bugs in v2/v3:
  1. Verdict now DECRYPTS the response via SSLObject.read(); earlier versions
     searched raw socket bytes for b"HTTP/", which never matches because TLS 1.3
     application data is still ciphertext on the wire. Every allowed host was
     therefore mislabelled BLOCKED.
  2. Reads until the decrypted body is complete, not just the first chunk.
"""
import socket
import ssl
import sys
import time

IP = "188.114.96.3"
BLOCKED = "test-sub.example.workers.dev"
ALLOWED = "workers.dev"
TIMEOUT = 9.0


def _pending(bio):
    p = bio.pending
    return p() if callable(p) else p


def _drain(sock, bio):
    """Flush everything queued for the wire. Returns bytes sent."""
    sent = 0
    while _pending(bio):
        chunk = bio.read()
        if not chunk:
            break
        sock.sendall(chunk)
        sent += len(chunk)
    return sent


def probe(name, tls13_only=False, path="/healthz"):
    """Connect to IP with SNI=name. Returns (verdict, note)."""
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False  # Keep False for IP literal connection
    ctx.verify_mode = ssl.CERT_REQUIRED
    ctx.load_default_certs()
    if tls13_only:
        ctx.minimum_version = ssl.TLSVersion.TLSv1_3
        ctx.maximum_version = ssl.TLSVersion.TLSv1_3
    else:
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2

    inc, out = ssl.MemoryBIO(), ssl.MemoryBIO()
    obj = ctx.wrap_bio(inc, out, server_hostname=name)
    sock = socket.create_connection((IP, 443), timeout=TIMEOUT)
    t0 = time.time()
    try:
        try:
            obj.do_handshake()
        except ssl.SSLWantReadError:
            pass
        _drain(sock, out)
        done = False
        while not done:
            try:
                obj.do_handshake()
                done = True
            except ssl.SSLWantReadError:
                data = sock.recv(8192)
                if not data:
                    return ("NO-CERT", "server closed during handshake")
                inc.write(data)
            except ssl.SSLWantWriteError:
                _drain(sock, out)
        hs_ms = int((time.time() - t0) * 1000)
        _drain(sock, out)

        obj.write(("GET %s HTTP/1.1\r\nHost: %s\r\nConnection: close\r\n\r\n"
                   % (path, name)).encode())
        _drain(sock, out)

        sock.settimeout(6.0)
        plain = b""
        while b"\r\n\r\n" not in plain and len(plain) < 8192:
            try:
                raw = sock.recv(8192)
            except socket.timeout:
                break
            if not raw:
                break
            inc.write(raw)
            try:
                plain += obj.read(8192)
            except (ssl.SSLWantReadError, ssl.SSLWantWriteError):
                pass
        if plain.startswith(b"HTTP/"):
            line = plain.split(b"\r\n", 1)[0].decode("latin1")
            return ("ALLOWED", "%s (%dB, hs %dms)" % (line, len(plain), hs_ms))
        if not plain:
            return ("BLOCKED", "0 response bytes (hs %dms)" % hs_ms)
        return ("ERROR", "non-HTTP payload %r" % plain[:40])
    except Exception as exc:
        return ("ERROR", "%s: %s" % (type(exc).__name__, exc))
    finally:
        sock.close()


def show(label, name, **kw):
    v, note = probe(name, **kw)
    print("  %-24s %-10s %s" % (label, v, note))
    return v


print("=" * 118)
print("SNI/TLS VARIANT MATRIX   target=%s   ip=%s" % (IP, IP))
print("=" * 118)
print("A. TLS VERSION  (both legs use workers.dev names, so both must behave the same)")
show("blocked  TLS1.3-only", BLOCKED, tls13_only=True)
show("control  TLS1.3-only", ALLOWED, tls13_only=True)
show("blocked  TLS1.2-capable", BLOCKED, tls13_only=False)
show("control  TLS1.2-capable", ALLOWED, tls13_only=False)

print()
print("B. SNI STRING VARIANTS  (control uses the same string shape with a benign label)")
for label, name in [
    ("exact lower case", BLOCKED),
    ("UPPERCASE", BLOCKED.upper()),
    ("trailing dot", BLOCKED + "."),
    ("sub-sub prefix", "x." + BLOCKED),
]:
    v1, n1 = probe(name)
    v2, n2 = probe(name.replace(BLOCKED, ALLOWED) if BLOCKED in name else name)
    print("  %-24s name: %-10s %-38s | control: %-10s %s"
          % (label, v1, n1, v2, n2))

print()
print("C. STATEFULNESS  5 sequential connections to the blocked name")
for i in range(1, 6):
    v, note = probe(BLOCKED)
    print("  attempt %d: %-10s %s" % (i, v, note))

print()
print("=" * 118)
sys.exit(0)
