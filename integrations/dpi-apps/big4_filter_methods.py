#!/usr/bin/env python3
"""Enumerate every blocking method used against facebook/instagram/youtube/x.com.

Ground truth for "is this IP genuine": the TLS certificate must validate for the
hostname. Nothing is inferred from hardcoded address ranges.
"""
import socket
import ssl
import sys
import time

CANDIDATES = {
    "facebook.com": [
        "157.240.199.35", "157.240.192.35", "157.240.1.35", "157.240.199.53",
        "69.171.235.12", "69.171.224.12", "69.171.250.18", "31.13.80.36",
        "31.13.87.36", "185.60.216.34", "179.60.192.36", "102.132.96.36",
        "163.70.128.35", "129.134.0.36",
    ],
    "instagram.com": [
        "157.240.199.35", "157.240.1.35", "69.171.235.12", "31.13.80.36",
        "185.60.216.34", "179.60.192.36", "102.132.96.36", "163.70.128.35",
    ],
    "youtube.com": [
        "142.250.185.78", "142.250.72.78", "142.251.32.78", "172.217.14.142",
        "172.217.0.14", "216.58.212.142", "142.250.191.78", "172.217.164.142",
    ],
    "x.com": [
        "104.244.40.33", "104.244.42.33", "104.244.41.33", "104.244.43.33",
        "192.133.76.133", "192.133.77.133", "17.253.144.10", "104.244.40.1",
    ],
}

TLS_PORTS = [443]
HTTP_PORTS = [80, 8080, 8443]


def tls_probe(ip, sni, verify=True, port=443, timeout=9):
    """Return (verdict, detail). verdict in GENUINE/UNVERIFIED/FILTERED/ERR."""
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    if verify:
        ctx.check_hostname = True
        ctx.verify_mode = ssl.CERT_REQUIRED
        ctx.load_default_certs()
    else:
        ctx.check_hostname = False  # Keep False for IP literal connection
        ctx.verify_mode = ssl.CERT_REQUIRED
        ctx.load_default_certs()
    try:
        raw = socket.create_connection((ip, port), timeout=timeout)
    except socket.timeout:
        return "TCP-TIMEOUT", "no connect"
    except OSError as e:
        return "TCP-FAIL", "%s %s" % (type(e).__name__, e.strerror or "")
    t0 = time.time()
    try:
        s = ctx.wrap_socket(raw, server_hostname=sni)
        hs = int((time.time() - t0) * 1000)
        cert = s.getpeercert()
        names = [v for k, v in (cert or {}).get("subjectAltName", ()) if k == "DNS"]
        s.close()
        verdict = "GENUINE" if verify else "TLS-OK"
        return verdict, "%dms tls=%s cn=%s san=%s" % (
            hs, s.version(), (cert or {}).get("subject", (("", ""),))[0][1],
            ",".join(names[:3]))
    except ssl.SSLCertVerificationError as e:
        raw.close()
        return "UNVERIFIED", "cert mismatch: %s" % str(e)[:70]
    except ssl.SSLError as e:
        raw.close()
        return "FILTERED", "SSLError %s" % str(e)[:70]
    except (socket.timeout, ConnectionResetError, ConnectionAbortedError) as e:
        raw.close()
        return "FILTERED", "%s after %dms" % (type(e).__name__, int((time.time() - t0) * 1000))
    except OSError as e:
        raw.close()
        return "FILTERED", "OSError %s" % str(e)[:60]


def http_probe(ip, host, port=80, timeout=9):
    try:
        raw = socket.create_connection((ip, port), timeout=timeout)
    except socket.timeout:
        return "TCP-TIMEOUT", ""
    except OSError as e:
        return "TCP-FAIL", "%s %s" % (type(e).__name__, e.strerror or "")
    t0 = time.time()
    try:
        raw.sendall(("GET / HTTP/1.1\r\nHost: %s\r\nConnection: close\r\n\r\n" % host).encode())
        raw.settimeout(timeout)
        buf = b""
        while b"\r\n\r\n" not in buf and len(buf) < 1024:
            c = raw.recv(1024)
            if not c:
                break
            buf += c
        el = int((time.time() - t0) * 1000)
        if not buf:
            return "SILENT", "0 bytes in %dms" % el
        return "HTTP", "%s (%dB %dms)" % (buf.split(b"\r\n", 1)[0].decode("latin1"), len(buf), el)
    except (socket.timeout, ConnectionResetError, ConnectionAbortedError, OSError) as e:
        return "FILTERED", "%s after %dms" % (type(e).__name__, int((time.time() - t0) * 1000))
    finally:
        raw.close()


def main():
    genuine = {}
    for dom, ips in CANDIDATES.items():
        print("=" * 100)
        print("TLS/443 with SNI=%s   (cert must validate for the name to count as genuine)" % dom)
        print("=" * 100)
        for ip in ips:
            v, d = tls_probe(ip, dom)
            print("  %-16s %-11s %s" % (ip, v, d))
            if v == "GENUINE":
                genuine.setdefault(dom, ip)
        print()

    print("=" * 100)
    print("ISOLATION: at a GENUINE IP, vary SNI  ->  separates IP-based from SNI-based filtering")
    print("=" * 100)
    for dom, ip in genuine.items():
        print("  target %s @ %s" % (dom, ip))
        for label, sni in [("same domain", dom),
                           ("control cloudflare.com", "cloudflare.com"),
                           ("control workers.dev apex", "workers.dev"),
                           ("known-blocked workers.dev sub", "a.workers.dev")]:
            v, d = tls_probe(ip, sni, verify=(sni == dom))
            print("     %-32s %-11s %s" % (label, v, d))
        print()

    print("=" * 100)
    print("PLAIN HTTP (no TLS, no SNI available) at the genuine IP  ->  is it DNS-only filtering?")
    print("=" * 100)
    for dom, ip in genuine.items():
        for port in HTTP_PORTS:
            v, d = http_probe(ip, dom, port)
            print("  %-16s :%-5d %-11s %s" % (dom, port, v, d))
        print()

    print("=" * 100)
    print("POISONED SINKHOLES: what do the forged answers actually do?")
    print("=" * 100)
    for ip in ["10.10.34.36"]:
        for port in [80, 443, 8080, 8443]:
            v, d = http_probe(ip, "facebook.com", port, timeout=6)
            print("  %-12s :%-5d %-11s %s" % (ip, port, v, d))
        v, d = tls_probe(ip, "facebook.com", verify=False, port=443, timeout=6)
        print("  %-12s :443  TLS %-11s %s" % (ip, v, d))
    return 0


if __name__ == "__main__":
    sys.exit(main())
