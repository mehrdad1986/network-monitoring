#!/usr/bin/env python3
"""
dpi_probe.py — characterise the filtering hop without root or raw sockets.

Uses only ordinary TCP/UDP sockets and DNS queries, so it needs no privileges.
Raw-socket tools (scapy sniff/send, tcpdump) are unavailable here; dumpcap is the
one capture tool that works, via its file capability.

Sections
  1  DNS layer   — who answers, from where, with what TTL/flags, UDP vs TCP vs DoT
  2  Hop map     — TTL-limited connects, no raw socket needed
  3  Drop shape  — does the filter wait for application data, or time out?
  4  MTU         — path MTU to the edge
"""
import socket, struct, sys, time

BLK = "test-sub.example.workers.dev"
OK  = "cloudflare.com"


def hdr(t):
    print("\n" + "=" * 72)
    print(t)
    print("=" * 72)


# ---------------------------------------------------------------- 1. DNS ----
def dns_section():
    import dns.message, dns.query, dns.flags, dns.rdatatype
    hdr("1. DNS LAYER — who answers, from where, with what TTL")

    names = [BLK, OK, "youtube.com", "pages.dev", "workers.dev",
             "nonexistent-9182qzx.example.com"]
    for n in names:
        for proto in ("udp", "tcp"):
            try:
                q = dns.message.make_query(n, "A")
                if proto == "udp":
                    r = dns.query.udp(q, "127.0.0.53", timeout=4)
                else:
                    r = dns.query.tcp(q, "127.0.0.53", timeout=4)
                answers = [rr.to_text() for rr in r.answer]
                src = f"{r.id:x}"
                rc = dns.flags.to_text(r.flags)
                print(f"  {n:38s} {proto}  rcode={rc:12s} answers={answers}")
            except Exception as e:
                print(f"  {n:38s} {proto}  ERROR {type(e).__name__}: {e}")

    # DoT: does TCP/853 to 1.1.1.1 escape the UDP/53 hijack?
    for target, label in [("1.1.1.1", "Cloudflare"), ("8.8.8.8", "Google")]:
        try:
            q = dns.message.make_query("youtube.com", "A")
            r = dns.query.tls(q, target, timeout=6, port=853)
            print(f"  DoT {label:10s} tcp/853 youtube.com -> "
                  f"{[rr.to_text() for rr in r.answer]}")
        except Exception as e:
            print(f"  DoT {label:10s} tcp/853 -> ERROR {type(e).__name__}: {e}")

    # TTL reflection check (the GFW-style behaviour cited in the 2025 study)
    try:
        q = dns.message.make_query("youtube.com", "A")
        r = dns.query.udp(q, "127.0.0.53", timeout=4)
        ttl = r.answer[0].ttl if r.answer else None
        print(f"  answer TTL for youtube.com: {ttl}  "
              f"(a very low value indicates forged injection)")
    except Exception as e:
        print(f"  TTL check failed: {e}")


# ---------------------------------------------------------------- 2. hops ---
def hop_section(target_ip, label):
    hdr(f"2. HOP MAP toward {label} ({target_ip}) — TTL-limited connects")
    prev = None
    for ttl in range(1, 18):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(1.2)
        try:
            s.setsockopt(socket.IPPROTO_IP, socket.IP_TTL, ttl)
            t0 = time.time()
            s.connect((target_ip, 443))
            ms = (time.time() - t0) * 1000
            print(f"  ttl={ttl:2d}  connected in {ms:7.1f} ms")
            s.close()
            return
        except socket.timeout:
            print(f"  ttl={ttl:2d}  no reply (expired or dropped)")
        except OSError as e:
            print(f"  ttl={ttl:2d}  {type(e).__name__}: {e}")
        finally:
            s.close()
        prev = ttl


# ------------------------------------------------------------ 3. drop -------
def drop_section(host, ip):
    hdr("3. DROP SHAPE — TLS handshake, then IDLE (no application data sent)")
    import ssl
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False  # Keep False for IP literal connection
    ctx.verify_mode = ssl.CERT_REQUIRED
    ctx.load_default_certs()
    inc, out = ssl.MemoryBIO(), ssl.MemoryBIO()
    obj = ctx.wrap_bio(inc, out, server_hostname=host)
    s = socket.create_connection((ip, 443), timeout=10)
    t0 = time.time()
    try:
        try:
            obj.do_handshake()
        except ssl.SSLWantReadError:
            pass
        s.sendall(out.read())
        while not obj.finished:
            try:
                obj.do_handshake()
            except ssl.SSLWantReadError:
                inc.write(s.recv(8192))
        while out.pending:
            s.sendall(out.read())
        print(f"  handshake COMPLETED at t={time.time()-t0:.3f}s")
        print("  now idling 25s WITHOUT sending any application data...")
        s.settimeout(25)
        try:
            data = s.recv(4096)
            if data == b"":
                print(f"  server closed the connection at t={time.time()-t0:.3f}s")
            else:
                print(f"  unexpected {len(data)} bytes at t={time.time()-t0:.3f}s")
        except socket.timeout:
            print("  still alive after 25s idle  ->  the filter does NOT time out;")
            print("  it discards traffic only after the client sends application data.")
    except Exception as e:
        print(f"  ERROR {type(e).__name__}: {e}")
    finally:
        s.close()


# ---------------------------------------------------------------- 4. MTU ----
def mtu_section(ip):
    hdr("4. PATH MTU toward the Cloudflare edge")
    for size in (1472, 1460, 1400, 1300, 1200):
        cmd = f"ping -c1 -W2 -M do -s {size} {ip}"
        rc = os.system(cmd + " >/dev/null 2>&1")
        print(f"  payload={size:5d}  {'OK' if rc == 0 else 'lost/blocked'}")
    os.system("ping -c1 -M do -s 1472 188.114.97.3 2>&1 | tail -3 | sed 's/^/  /'")


import os
if __name__ == "__main__":
    dns_section()
    try:
        hop_section("188.114.96.3", "Cloudflare edge (blocked SNI target)")
    except Exception as e:
        print("  hop map failed:", e)
    try:
        drop_section(BLK, "188.114.96.3")
    except Exception as e:
        print("  drop shape failed:", e)
    mtu_section("188.114.96.3")