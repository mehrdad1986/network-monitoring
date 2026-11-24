#!/usr/bin/env python3
"""
ads_ladder.py — SNI pass-rate ladder for the Irancell line (AS58224).

Measures the probability that a given SNI traverses the inline filter and
reaches Cloudflare. Single connections are NOT verdicts on this network: the
filter is probabilistic. Always use n >= 15.

Usage:  python3 ads_ladder.py [edge_ip]
"""
import socket, ssl, time, sys, statistics
from collections import Counter

EDGE = sys.argv[1] if len(sys.argv) > 1 else "188.114.97.7"
N = int(sys.argv[2]) if len(sys.argv) > 2 else 15


def verdict(sni, ip, port=443, timeout=7.0, path="/"):
    """Return (verdict_string, elapsed_seconds)."""
    s = socket.socket()
    s.settimeout(timeout)
    t0 = time.time()
    try:
        s.connect((ip, port))
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ctx.check_hostname = False  # Keep False for IP literal connection
        ctx.verify_mode = ssl.CERT_REQUIRED
        ctx.load_default_certs()
        ss = ctx.wrap_socket(s, server_hostname=sni)
        ss.sendall(
            f"GET {path} HTTP/1.1\r\nHost: {sni}\r\n"
            f"Connection: close\r\nUser-Agent: Mozilla/5.0\r\n\r\n".encode()
        )
        d = b""
        while len(d) < 3000:
            try:
                c = ss.recv(4096)
            except socket.timeout:
                break
            if not c:
                break
            d += c
            if b"\r\n\r\n" in d:
                break
        ss.close()
        if not d:
            return "BLOCKED-silent", time.time() - t0
        try:
            code = d.split(b" ")[1].decode()
        except Exception:
            code = "?"
        return f"SERVED-{code}", time.time() - t0
    except socket.timeout:
        return "BLOCKED-silent", time.time() - t0
    except ConnectionResetError:
        return "BLOCKED-RST", time.time() - t0
    except ssl.SSLError:
        return "TLS-alert", time.time() - t0
    except Exception as e:
        return f"ERR-{type(e).__name__}", time.time() - t0
    finally:
        try:
            s.close()
        except Exception:
            pass


def run(label, sni, ip, n=N):
    c, ts = Counter(), []
    for _ in range(n):
        v, dt = verdict(sni, ip)
        c[v] += 1
        ts.append(dt)
        time.sleep(0.2)
    ok = sum(x for k, x in c.items() if k.startswith("SERVED"))
    print(f"  {label:34s} pass {ok}/{n} ({100*ok//n:3d}%)  "
          + "  ".join(f"{k}={v}" for k, v in c.most_common())
          + f"  med={statistics.median(ts):.2f}s")
    sys.stdout.flush()
    return ok, n


if __name__ == "__main__":
    print(f"### SNI pass-rate ladder  edge={EDGE}  n={N} ###")
    print("### 'TLS-alert' on 5+ labels = Cloudflare answering: filter FORWARDED it")
    print("### 'BLOCKED-silent'       = filter dropped the flow\n")
    for nm in ["workers.dev", "a.workers.dev", "a.b.workers.dev",
               "a.b.c.workers.dev", "a.b.c.d.workers.dev"]:
        run(nm, nm, EDGE)
    print()
    print("--- controls (must be 100%) ---")
    run("cloudflare.com", "cloudflare.com", "104.16.132.229")
    run("challenges.cloudflare.com", "challenges.cloudflare.com", "104.16.132.229")
    print()
    print("--- pages.dev (expect 0%, RST) ---")
    run("pages.dev", "pages.dev", EDGE)
    run("nonexistent *.pages.dev", "zzz-not-real-9271.pages.dev", EDGE)