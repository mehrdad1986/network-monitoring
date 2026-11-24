#!/usr/bin/env python3
"""AWS IP accessibility test with VPN port scanning and DPI method detection.

Educational tool for understanding network filtering and DPI methods.
Tests all VPN-relevant ports and classifies DPI filtering method per IP.
"""
import dns.message
import ipaddress
import platform
import socket
import ssl
import subprocess
import sys
import time
import struct
import base64
import json
import http.client
import urllib.request
import re
from concurrent.futures import ThreadPoolExecutor

PROVIDER = "AWS"
RANGES_URL = "https://ip-ranges.amazonaws.com/ip-ranges.json"
FALLBACK_CIDRS = [
    "3.0.0.0/8",
    "13.32.0.0/12",
    "13.248.118.0/24",
    "15.177.0.0/16",
    "18.32.0.0/12",
    "23.20.0.0/14",
    "52.0.0.0/8",
    "54.0.0.0/8",
    "99.77.0.0/16",
    "107.20.0.0/14",
]

VPN_PORTS_TCP = [
    (443, "HTTPS/Trojan"),
    (8443, "HTTPS-alt"),
    (2053, "Cloudflare-alt"),
    (2083, "cPanel-SSL"),
    (2087, "WHM-SSL"),
    (2096, "cPanel-WebMail"),
    (8080, "HTTP-Proxy"),
    (8880, "HTTP-Proxy-alt"),
    (3128, "Squid-Proxy"),
    (3129, "Squid-alt"),
    (80, "HTTP"),
    (8000, "HTTP-alt"),
    (22, "SSH"),
    (2222, "SSH-alt"),
    (1080, "SOCKS5"),
    (9050, "Tor-SOCKS"),
    (1194, "OpenVPN-TCP"),
    (1443, "OpenVPN-alt"),
    (51820, "WireGuard-TCP"),
    (5201, "iPerf3"),
]

VPN_PORTS_UDP = [
    (51820, "WireGuard"),
    (1194, "OpenVPN"),
    (1197, "OpenVPN-alt"),
    (500, "IKEv2"),
    (4500, "IKEv2-NAT"),
    (1701, "L2TP"),
    (4569, "IAX2"),
]

CONNECT_TIMEOUT = 3.0
UDP_TIMEOUT = 2.0
MAX_IPS = 50
MAX_WORKERS = 20

SINKHOLE_IPS = {"10.10.34.36", "10.10.34.35", "10.10.34.34"}

CIDR_RE = re.compile(r"\b(\d{1,3}(?:\.\d{1,3}){3}/\d{1,2})\b")


def fetch_aws_ranges():
    """Fetch live AWS IP ranges."""
    try:
        req = urllib.request.Request(RANGES_URL, headers={"User-Agent": "aws-dpi-test/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            cidrs = [p["ip_prefix"] for p in data.get("prefixes", []) if "ip_prefix" in p]
            return cidrs[:200] if cidrs else FALLBACK_CIDRS  # Limit to 200 networks
    except Exception as exc:
        print(f"[!] Failed to fetch live AWS ranges: {exc}")
        return FALLBACK_CIDRS


def load_networks():
    cidrs = fetch_aws_ranges()
    return [ipaddress.ip_network(c) for c in cidrs]


def first_host(net):
    if net.num_addresses <= 2:
        return net.network_address
    return net.network_address + 1


def sample_ips(networks, limit=MAX_IPS):
    if not networks:
        return []
    step = max(1, len(networks) // limit)
    return [str(first_host(net)) for net in networks[::step][:limit]]


def tcp_probe(ip, port):
    start = time.monotonic()
    try:
        with socket.create_connection((ip, port), timeout=CONNECT_TIMEOUT):
            return "CONNECT", f"{(time.monotonic() - start) * 1000:.0f}ms"
    except socket.timeout:
        return "TIMEOUT", "timeout"
    except ConnectionResetError:
        return "RST", "reset"
    except ConnectionRefusedError:
        return "REFUSED", "refused"
    except OSError as exc:
        return "FAIL", str(exc)[:50]


def udp_probe(ip, port):
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(UDP_TIMEOUT)
        sock.sendto(b"\x00" * 8, (ip, port))
        try:
            sock.recvfrom(1024)
            sock.close()
            return "RESPONSE", "got response"
        except socket.timeout:
            sock.close()
            return "OPEN|FILTERED", "no response"
    except ConnectionResetError:
        return "CLOSED", "ICMP unreachable"
    except OSError as exc:
        return "FAIL", str(exc)[:50]


def ping(ip):
    if platform.system().lower() == "windows":
        cmd = ["ping", "-n", "1", "-w", "2000", ip]
    else:
        cmd = ["ping", "-c", "1", "-W", "2", ip]
    try:
        return subprocess.run(cmd, capture_output=True, timeout=8).returncode == 0
    except Exception:
        return False


def tls_probe(ip, sni, port=443, timeout=10):
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    ctx.set_alpn_protocols(["http/1.1"])
    t0 = time.time()
    try:
        raw = socket.create_connection((ip, port), timeout=timeout)
        raw.settimeout(timeout)
        s = ctx.wrap_socket(raw, server_hostname=sni if sni else None)
        hs_ms = int((time.time() - t0) * 1000)
        s.sendall(f"GET / HTTP/1.1\r\nHost: {sni or ip}\r\nConnection: close\r\n\r\n".encode())
        buf = b""
        while b"\r\n\r\n" not in buf and len(buf) < 2048:
            c = s.recv(4096)
            if not c:
                break
            buf += c
        s.close()
        resp = buf.split(b"\r\n")[0].decode("latin1", errors="replace")[:80] if buf else "(empty)"
        return "TLS_OK", f"{resp} | hs={hs_ms}ms", hs_ms
    except socket.timeout:
        return "HANG", f"silent drop after {int((time.time()-t0)*1000)}ms", int((time.time()-t0)*1000)
    except ConnectionResetError:
        return "RST", "TCP RST during handshake", int((time.time()-t0)*1000)
    except ssl.SSLError as e:
        msg = str(e)[:80]
        return "TLS_ERR", msg, int((time.time()-t0)*1000)
    except OSError as e:
        return "TCP_FAIL", str(e)[:60], int((time.time()-t0)*1000)


def http_probe(ip, host, port=80, timeout=6):
    t0 = time.time()
    try:
        raw = socket.create_connection((ip, port), timeout=timeout)
        raw.settimeout(timeout)
        raw.sendall(f"GET / HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n".encode())
        buf = b""
        while b"\r\n\r\n" not in buf and len(buf) < 1024:
            c = raw.recv(4096)
            if not c:
                break
            buf += c
        raw.close()
        resp = buf.split(b"\r\n")[0].decode("latin1", errors="replace")[:60] if buf else "(empty)"
        return "HTTP_OK", f"{resp} ({len(buf)}B)", int((time.time()-t0)*1000)
    except socket.timeout:
        return "TIMEOUT", f"no response", int((time.time()-t0)*1000)
    except ConnectionResetError:
        return "RST", "reset", 0
    except OSError as e:
        return "FAIL", str(e)[:50], int((time.time()-t0)*1000)


def doh_resolve(name, timeout=8):
    """DNS over HTTPS to detect DNS poisoning."""
    dns_wire = b"".join(bytes([len(p)]) + p.encode() for p in name.split(".")) + b"\x00"
    dns_msg = struct.pack(">HHHHHH", 0x1234, 0x0100, 1, 0, 0, 0) + dns_wire + struct.pack(">HH", 1, 1)
    b64 = base64.urlsafe_b64encode(dns_msg).decode().rstrip("=")
    path = "/dns-query?dns=" + b64
    for resolver_ip in ("8.8.8.8", "1.1.1.1", "1.0.0.1"):
        conn = None
        try:
            conn = http.client.HTTPSConnection(resolver_ip, 443, timeout=timeout)
            conn.connect()
            conn.request("GET", path, headers={"Host": resolver_ip, "Accept": "application/dns-message"})
            resp = conn.getresponse()
            if resp.status == 200:
                j = {"Answer": [{"type": rrset.rdtype, "data": record.to_text()} for rrset in dns.message.from_wire(resp.read()).answer for record in rrset]}
                ips = [a["data"] for a in j.get("Answer", []) if a.get("type") == 1]
                if ips:
                    conn.close()
                    return ips, resolver_ip
            conn.close()
        except Exception:
            continue
        finally:
            if conn is not None:
                conn.close()
    return [], "failed"


def classify_dpi(ip, tcp_results, udp_results, tls_result, http_result, ping_result, doh_ips):
    """Classify the type of DPI/filtering being applied."""
    classification = []
    methods = []

    tcp_443 = next((r for p, r in tcp_results if p == 443), None)
    tcp_80 = next((r for p, r in tcp_results if p == 80), None)

    # Check for DNS sinkhole
    if ip in SINKHOLE_IPS:
        classification.append("SINKHOLE_IP")
        methods.append("DNS_forgery")
        return " | ".join(classification), " | ".join(methods)

    if doh_ips and doh_ips[0] in SINKHOLE_IPS:
        classification.append("DOH_SINKHOLE")
        methods.append("DNS_forgery")

    # Check if IP is completely unreachable
    if not ping_result and all(r[0] in ("TIMEOUT", "FAIL") for _, r in tcp_results):
        classification.append("IP_BLACKHOLE")
        methods.append("IP_null_route")
        return " | ".join(classification), " | ".join(methods)

    # Check TCP port 443 status
    if tcp_443:
        if tcp_443[0] == "RST":
            classification.append("TCP_RST_443")
            methods.append("TCP_RST_injection")
        elif tcp_443[0] == "TIMEOUT":
            classification.append("TCP_TIMEOUT_443")
            methods.append("silent_drop")
        elif tcp_443[0] == "CONNECT":
            classification.append("TCP_443_OK")

    # Check TLS/SNI filtering
    if tls_result[0] == "HANG":
        classification.append("SNI_SILENT_DROP")
        methods.append("SNI_based_silent_drop")
    elif tls_result[0] == "RST":
        classification.append("SNI_TCP_RST")
        methods.append("SNI_based_RST")
    elif tls_result[0] == "TLS_OK":
        classification.append("TLS_HANDSHAKE_OK")
        methods.append("not_blocked_at_TLS_layer")

    # Check HTTP status
    if http_result[0] == "HTTP_OK":
        classification.append("HTTP_REACHABLE")
    elif http_result[0] == "RST":
        classification.append("HTTP_RST")
        methods.append("HTTP_RST_injection")
    elif http_result[0] == "TIMEOUT":
        classification.append("HTTP_TIMEOUT")

    # Check UDP accessibility
    udp_open = any(r[0] in ("RESPONSE", "OPEN|FILTERED") for _, r in udp_results)
    if udp_open:
        classification.append("UDP_REACHABLE")
    else:
        all_closed = all(r[0] == "CLOSED" for _, r in udp_results)
        if all_closed:
            classification.append("UDP_BLOCKED")
            methods.append("UDP_port_filtering")

    if not classification:
        classification.append("UNKNOWN")

    return " | ".join(classification), " | ".join(methods) if methods else "no_filtering_detected"


def test_ip(ip):
    """Comprehensive test of a single IP."""
    results = {"ip": ip}

    print(f"\n{'='*70}")
    print(f"TESTING {ip}")
    print(f"{'='*70}")

    # Layer 1: ICMP
    print("\n[Layer 1: ICMP Ping]")
    pong = ping(ip)
    print(f"  ICMP: {'✓ OK' if pong else '✗ FAIL'}")
    results["ping"] = pong

    # Layer 2: TCP ports
    print("\n[Layer 2: TCP VPN Ports]")
    tcp_results = []
    for port, label in VPN_PORTS_TCP:
        status, detail = tcp_probe(ip, port)
        symbol = "✓" if status == "CONNECT" else "✗"
        print(f"  {symbol} TCP {port:5d} ({label:15s}): {status:10s} {detail}")
        tcp_results.append((port, (status, detail)))
    results["tcp"] = tcp_results

    # Layer 3: UDP ports
    print("\n[Layer 3: UDP VPN Ports]")
    udp_results = []
    for port, label in VPN_PORTS_UDP:
        status, detail = udp_probe(ip, port)
        symbol = "?" if "FILTERED" in status else ("✓" if status == "RESPONSE" else "✗")
        print(f"  {symbol} UDP {port:5d} ({label:15s}): {status:15s} {detail}")
        udp_results.append((port, (status, detail)))
    results["udp"] = udp_results

    # Layer 4: DoH DNS check
    print("\n[Layer 4: DoH DNS Resolution Check]")
    doh_ips, resolver = doh_resolve("aws.amazon.com")
    if doh_ips:
        print(f"  ✓ DoH via {resolver}: {doh_ips[0]}")
    else:
        print(f"  ✗ DoH: FAILED ({resolver})")
    results["doh"] = (doh_ips, resolver)

    # Layer 5: TLS/SNI probing
    print("\n[Layer 5: TLS/SNI Deep Packet Inspection Test]")
    tls_main = tls_probe(ip, "aws.amazon.com")
    print(f"  SNI=aws.amazon.com: {tls_main[0]:12s} | {tls_main[1]}")

    tls_control = tls_probe(ip, "cloudflare.com")
    print(f"  SNI=cloudflare.com:  {tls_control[0]:12s} | {tls_control[1]}")

    tls_no_sni = tls_probe(ip, "")
    print(f"  SNI=(empty):         {tls_no_sni[0]:12s} | {tls_no_sni[1]}")
    results["tls"] = {"main": tls_main, "control": tls_control, "no_sni": tls_no_sni}

    # Layer 6: Plain HTTP
    print("\n[Layer 6: Plain HTTP Request]")
    http_main = http_probe(ip, "aws.amazon.com", 80)
    print(f"  HTTP aws.amazon.com: {http_main[0]:12s} | {http_main[1]}")
    results["http"] = http_main

    # Classification
    classification, methods = classify_dpi(ip, tcp_results, udp_results, tls_main, http_main, pong, doh_ips)
    print(f"\n>>> CLASSIFICATION: {classification}")
    print(f">>> DPI METHODS:    {methods}")
    results["classification"] = classification
    results["methods"] = methods

    return results


def main():
    print(f"{'='*80}")
    print(f"  {PROVIDER} IP Accessibility & DPI Detection Test")
    print(f"  Educational tool for network filtering analysis")
    print(f"{'='*80}")

    networks = load_networks()
    print(f"\n[*] Networks loaded: {len(networks)}")

    ips = sample_ips(networks, MAX_IPS)
    if not ips:
        print("[!] No IPs to test")
        return 1

    print(f"[*] Testing {len(ips)} sampled IPs across AWS infrastructure")
    print(f"[*] Testing TCP ports: {', '.join(str(p) for p, _ in VPN_PORTS_TCP)}")
    print(f"[*] Testing UDP ports: {', '.join(str(p) for p, _ in VPN_PORTS_UDP)}")

    all_results = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        all_results = list(pool.map(test_ip, ips))

    # Summary table
    print(f"\n{'='*80}")
    print("SUMMARY TABLE")
    print(f"{'='*80}")
    print(f"{'IP':<16} {'Ping':<6} {'443':<10} {'TLS-SNI':<15} {'HTTP':<12} {'UDP':<6} {'Classification'}")
    print("-" * 80)

    for r in all_results:
        tcp_443 = next((s for p, (s, _) in r["tcp"] if p == 443), "?")
        tls_sni = r["tls"]["main"][0]
        http_s = r["http"][0]
        udp_any = "YES" if any(s in ("RESPONSE", "OPEN|FILTERED") for _, (s, _) in r["udp"]) else "NO"
        ping_symbol = "✓" if r["ping"] else "✗"

        print(f"{r['ip']:<16} {ping_symbol:<6} {tcp_443:<10} {tls_sni:<15} {http_s:<12} {udp_any:<6} {r['classification']}")

    # DPI method statistics
    print(f"\n{'='*80}")
    print("DPI METHOD STATISTICS")
    print(f"{'='*80}")

    method_counts = {}
    for r in all_results:
        for m in r["methods"].split(" | "):
            method_counts[m] = method_counts.get(m, 0) + 1

    for method, count in sorted(method_counts.items(), key=lambda x: -x[1]):
        pct = (count / len(all_results)) * 100
        print(f"  {method:30s}: {count:3d} IPs ({pct:5.1f}%)")

    # Final statistics
    accessible = sum(1 for r in all_results if "OK" in r["classification"] or "REACHABLE" in r["classification"])
    blocked = len(all_results) - accessible

    print(f"\n{'='*80}")
    print(f"FINAL RESULTS: {accessible}/{len(all_results)} accessible ({(accessible/len(all_results)*100):.1f}%), {blocked} blocked ({(blocked/len(all_results)*100):.1f}%)")
    print(f"{'='*80}\n")

    return 0 if accessible > 0 else 2


if __name__ == "__main__":
    sys.exit(main())
