#!/usr/bin/env python3
"""
ads_battery.py — full VPN-design battery for the Irancell line (AS58224).

Sections: DNS forgery, DoT, DoH by IP vs by name, big-four SNI blocking with
innocent-SNI controls, port matrix, and the DNS interceptor hop position.

Always unset proxy env vars first -- a dead SOCKS proxy will corrupt results:
  unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy

Usage:  python3 ads_battery.py [section]
        sections: dns dot doh big4 ports hop   (default: all)
"""
import socket, ssl, struct, sys, time, statistics
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

N = 10


# ---------------------------------------------------------------- DNS forgery
def _q(name, qtype=1, qid=0x1234):
    hdr = struct.pack("!HHHHHH", qid, 0x0100, 1, 0, 0, 0)
    qn = b"".join(bytes([len(p)]) + p.encode() for p in name.split(".")) + b"\x00"
    return hdr + qn + struct.pack("!HH", qtype, qtype)


def _parse_a(r):
    if len(r) < 12:
        return "short"
    an = struct.unpack("!H", r[6:8])[0]
    if an == 0:
        return f"NO-ANSWER(rcode={r[3]&0xf})"
    i = 12
    while r[i] != 0:
        i += r[i] + 1
    i += 5
    out = []
    try:
        for _ in range(an):
            if r[i] & 0xC0 == 0xC0:
                i += 2
            else:
                while r[i] != 0:
                    i += r[i] + 1
                i += 1
            typ, cls, ttl, rl = struct.unpack("!HHIH", r[i:i+10])
            i += 10
            rd = r[i:i+rl]
            i += rl
            if typ == 1 and rl == 4:
                out.append(socket.inet_ntoa(rd))
    except Exception:
        out.append("parse-err")
    return ",".join(out)


def udp(resolver, name, port=53, timeout=4):
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(timeout)
    try:
        s.sendto(_q(name), (resolver, port))
        d, _ = s.recvfrom(4096)
        return _parse_a(d)
    except socket.timeout:
        return "TIMEOUT"
    except Exception as e:
        return f"ERR {type(e).__name__}"
    finally:
        s.close()


def sec_dns():
    res = ["8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1", "9.9.9.9",
           "94.140.14.14", "185.222.222.222", "223.5.5.5", "1.12.12.12",
           "208.67.222.222"]
    names = ["youtube.com", "facebook.com", "instagram.com", "x.com",
             "telegram.org", "twitter.com", "pages.dev", "trycloudflare.com",
             "dns.google", "cloudflare-dns.com", "workers.dev", "cloudflare.com"]
    print("### DNS FORGERY MATRIX ###")
    print("FORGED = 10.10.34.36 sinkhole injection\n")
    for n in names:
        with ThreadPoolExecutor(20) as ex:
            out = list(ex.map(lambda r: udp(r, n), res))
        flagged = "  <-- NOT poisoned" if not any("10.10.34.36" in o for o in out) else ""
        print(f"  {n:22s} " + " ".join(f"{x[:15]:>15s}" for x in out) + flagged)
        sys.stdout.flush()


# ----------------------------------------------------------------------- DoT
def sec_dot():
    print("### DoT/853 ###")
    for r in ["8.8.8.8", "1.1.1.1", "9.9.9.9", "94.140.14.14",
              "185.222.222.222", "223.5.5.5", "1.12.12.12"]:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False  # Keep False for IP literal connection
        ctx.verify_mode = ssl.CERT_REQUIRED
        try:
            with socket.create_connection((r, 853), timeout=5) as raw:
                with ctx.wrap_socket(raw, server_hostname="dns.google") as s:
                    s.sendall(_q("cloudflare.com"))
                    print(f"  {r:16s} :853 -> TLS OK, {len(s.recv(4096))}B")
        except socket.timeout:
            print(f"  {r:16s} :853 -> TIMEOUT")
        except Exception as e:
            print(f"  {r:16s} :853 -> {type(e).__name__}")
        sys.stdout.flush()


# ------------------------------------------------------------- SNI verdicts
def verdict(sni, ip, port=443, timeout=7.0, path="/"):
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
        ss.sendall(f"GET {path} HTTP/1.1\r\nHost: {sni}\r\n"
                   f"Connection: close\r\nUser-Agent: Mozilla/5.0\r\n\r\n".encode())
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


def run(label, sni, ip, n=N, port=443):
    c, ts = Counter(), []
    for _ in range(n):
        v, dt = verdict(sni, ip, port=port)
        c[v] += 1
        ts.append(dt)
        time.sleep(0.2)
    ok = sum(x for k, x in c.items() if k.startswith("SERVED"))
    print(f"  {label:38s} pass {ok}/{n}  "
          + "  ".join(f"{k}={v}" for k, v in c.most_common()))
    sys.stdout.flush()


def sec_big4():
    print("### BIG FOUR at true addresses (SNI blocking) ###")
    run("youtube.com  @142.251.127.91", "youtube.com", "142.251.127.91")
    run("facebook.com @157.240.0.35", "facebook.com", "157.240.0.35")
    run("x.com       @162.159.140.229", "x.com", "162.159.140.229")
    run("instagram   @157.240.0.174", "instagram.com", "157.240.0.174")
    print("--- controls: same IPs, innocent SNI (must be 100%) ---")
    run("CTRL cloudflare.com @youtube-IP", "cloudflare.com", "142.251.127.91")
    run("CTRL cloudflare.com @facebook-IP", "cloudflare.com", "157.240.0.35")


def sec_ports():
    G = "test-sub.example.workers.dev"
    print("### PORT MATRIX (blocked 4-label SNI) ###")
    for p in [443, 2053, 2083, 2087, 2096, 8443]:
        run(f"SNI=blocked port {p}", G, "188.114.97.7", n=8, port=p)
    print("--- control ---")
    run("SNI=workers.dev port 8443", "workers.dev", "188.114.97.7", n=8, port=8443)


# ------------------------------------------- interceptor hop position (TTL)
def sec_hop():
    print("### DNS INTERCEPTOR HOP POSITION ###")
    print("Lower IP_TTL until forged replies stop. Last forging TTL = interceptor hop.")
    print("(Irancell measured: forges at TTL>=8, silent at TTL<=7 -> hop 8)\n")
    for ttl in range(20, 0, -1):
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(2.0)
        try:
            s.setsockopt(socket.IPPROTO_IP, socket.IP_TTL, ttl)
            s.sendto(_q("youtube.com"), ("8.8.8.8", 53))
            d, _ = s.recvfrom(4096)
            print(f"  IP_TTL={ttl:2d} -> REPLY {_parse_a(d)}")
        except socket.timeout:
            print(f"  IP_TTL={ttl:2d} -> (no reply: died upstream of interceptor)")
        except Exception as e:
            print(f"  IP_TTL={ttl:2d} -> err {e}")
        finally:
            s.close()
        sys.stdout.flush()


SECTIONS = {"dns": sec_dns, "dot": sec_dot, "big4": sec_big4,
            "ports": sec_ports, "hop": sec_hop}

if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    if which == "all":
        for fn in SECTIONS.values():
            fn()
            print()
    else:
        SECTIONS[which]()
    print("\nDoH by IP literal (run separately, needs curl):")
    print("  for ip in 8.8.8.8 8.8.4.4 9.9.9.9 1.1.1.1; do \\")
    print("    printf '%s -> ' $ip; \\")
    print("    curl -sS -m 10 -o /dev/null -w '%{http_code}\\n' \\")
    print("      \"https://$ip/dns-query\"; done")