#!/usr/bin/env python3
"""Vultr IP accessibility test with VPN port scanning and DPI method detection.

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
from concurrent.futures import ThreadPoolExecutor

PROVIDER = "Vultr"
CIDRS = [
    "45.32.0.0/16",
    "45.63.0.0/16",
    "45.76.0.0/16",
    "45.77.0.0/16",
    "66.42.0.0/16",
    "66.228.0.0/16",
    "104.156.0.0/16",
    "104.200.0.0/15",
    "104.236.0.0/16",
    "107.191.0.0/16",
    "108.61.0.0/16",
    "139.180.0.0/16",
    "144.202.0.0/16",
    "149.28.0.0/16",
    "149.56.0.0/16",
    "155.138.0.0/16",
    "167.172.0.0/16",
    "173.199.0.0/16",
    "178.128.0.0/16",
    "192.241.0.0/16",
    "198.13.0.0/16",
    "198.27.0.0/16",
    "199.247.0.0/16",
    "202.182.0.0/16",
    "206.189.0.0/16",
    "207.148.0.0/16",
    "207.246.0.0/16",
    "208.167.0.0/16",
    "209.126.0.0/16",
    "209.250.0.0/16",
    "216.128.0.0/16",
    "216.189.0.0/16",
    "216.238.0.0/16",
    "216.245.0.0/16",
    "217.199.0.0/16",
]

VPN_PORTS_TCP = [
    (443, "HTTPS/Trojan"),
    (8443, "HTTPS-alt"),
    (8080, "HTTP-Proxy"),
    (3128, "HTTP-Proxy"),
    (80, "HTTP"),
    (22, "SSH"),
    (1080, "SOCKS"),
    (1194, "OpenVPN-TCP"),
    (51820, "WireGuard-TCP"),
]

VPN_PORTS_UDP = [
    (51820, "WireGuard"),
    (1194, "OpenVPN"),
    (500, "IKEv2"),
    (4500, "IKEv2-NAT"),
    (1701, "L2TP"),
    (50, "ESP"),
]

CONNECT_TIMEOUT = 3.0
UDP_TIMEOUT = 2.0
MAX_IPS = 35
MAX_WORKERS = 15

SINKHOLE_IPS = {"10.10.34.36", "10.10.34.35", "10.10.34.34"}


def load_networks():
    return [ipaddress.ip_network(c) for c in CIDRS]


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
    except OSError as exc:
        return "FAIL", str(exc)[:50]


def udp_probe(ip, port):
    start = time.monotonic()
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(UDP_TIMEOUT)
        sock.sendto(b"\x00", (ip, port))
        sock.recvfrom(1024)
        sock.close()
        return "RESPONSE", f"{(time.monotonic() - start) * 1000:.0f}ms"
    except socket.timeout:
        return "OPEN|FILTERED", "no response (open|filtered)"
    except ConnectionResetError:
        return "CLOSED", "ICMP port unreachable"
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
    ctx.verify_mode = ssl.CERT_REQUIRED
    ctx.load_default_certs()
    ctx.set_alpn_protocols(["http/1.1"])
    t0 = time.time()
    try:
        raw = socket.create_connection((ip, port), timeout=timeout)
        raw.settimeout(timeout)
        s = ctx.wrap_socket(raw, server_hostname=sni)
        hs_ms = int((time.time() - t0) * 1000)
        cert = s.getpeercert()
        s.sendall(f"GET / HTTP/1.1\r\nHost: {sni}\r\nConnection: close\r\n\r\n".encode())
        buf = b""
        while b"\r\n\r\n" not in buf and len(buf) < 2048:
            c = s.recv(4096)
            if not c:
                break
            buf += c
        s.close()
        resp = buf.split(b"\r\n")[0].decode("latin1", errors="replace")[:80] if buf else "(empty)"
        return "TLS_OK", f"{resp} | hs={hs_ms}ms | {len(buf)}B", hs_ms
    except socket.timeout:
        return "HANG", f"silent drop after {int((time.time()-t0)*1000)}ms", int((time.time()-t0)*1000)
    except ConnectionResetError:
        return "RST", "TCP RST during handshake", int((time.time()-t0)*1000)
    except ssl.SSLError as e:
        msg = str(e)[:80]
        if "handshake_failure" in msg.lower():
            return "CF_ALERT", "Cloudflare reached, no cert", int((time.time()-t0)*1000)
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
        return "TIMEOUT", f"no response in {int((time.time()-t0)*1000)}ms", int((time.time()-t0)*1000)
    except ConnectionResetError:
        return "RST", "reset", 0
    except OSError as e:
        return "FAIL", str(e)[:50], int((time.time()-t0)*1000)


def doh_resolve(name, timeout=8):
    dns_wire = b"".join(bytes([len(p)]) + p.encode() for p in name.split(".")) + b"\x00"
    dns_msg = struct.pack(">HHHHHH", 0x1234, 0x0100, 1, 0, 0, 0) + dns_wire + struct.pack(">HH", 1, 1)
    b64 = base64.urlsafe_b64encode(dns_msg).decode().rstrip("=")
    path = "/dns-query?dns=" + b64
    for ip in ("8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1"):
        conn = None
        try:
            conn = http.client.HTTPSConnection(ip, 443, timeout=timeout)
            conn.connect()
            conn.request("GET", path, headers={"Host": ip, "Accept": "application/dns-message"})
            resp = conn.getresponse()
            if resp.status == 200:
                j = {"Answer": [{"type": rrset.rdtype, "data": record.to_text()} for rrset in dns.message.from_wire(resp.read()).answer for record in rrset]}
                ips = [a["data"] for a in j.get("Answer", []) if a.get("type") == 1]
                if ips:
                    conn.close()
                    return ips, ip
            conn.close()
        except Exception:
            continue
        finally:
            if conn is not None:
                conn.close()
    return [], "failed"


def classify_dpi(ip, tcp_results, udp_results, tls_result, http_result, ping_result, doh_ips):
    classification = []
    methods = []
    
    tcp_443 = next((r for p, r in tcp_results if p == 443), None)
    tcp_80 = next((r for p, r in tcp_results if p == 80), None)
    
    if ip in SINKHOLE_IPS:
        classification.append("SINKHOLE_IP")
        methods.append("DNS_forgery")
        return " | ".join(classification), " | ".join(methods)
    
    if doh_ips and doh_ips[0] in SINKHOLE_IPS:
        classification.append("DOH_SINKHOLE")
        methods.append("DNS_forgery")
    
    if not ping_result and all(r[0] in ("TIMEOUT", "FAIL") for _, r in tcp_results):
        classification.append("IP_UNREACHABLE")
        methods.append("IP_block")
    
    if tcp_443 and tcp_443[0] == "RST":
        classification.append("TCP_RST_443")
        methods.append("TCP_RST")
    elif tcp_443 and tcp_443[0] == "TIMEOUT":
        classification.append("TCP_TIMEOUT_443")
        methods.append("IP_block_or_silent_drop")
    
    if tls_result[0] == "HANG":
        classification.append("SNI_SILENT_DROP")
        methods.append("SNI_silent_drop")
    elif tls_result[0] == "RST":
        classification.append("SNI_TCP_RST")
        methods.append("SNI_RST")
    elif tls_result[0] == "CF_ALERT":
        classification.append("REACHES_CLOUDFLARE")
        methods.append("SNI_mismatch")
    elif tls_result[0] == "TLS_OK":
        classification.append("TLS_HANDSHAKE_OK")
        methods.append("not_blocked_at_TLS")
    
    if http_result[0] == "HTTP_OK":
        classification.append("HTTP_REACHABLE")
    elif http_result[0] == "RST":
        classification.append("HTTP_RST")
        methods.append("HTTP_RST")
    
    udp_open = any(r[0] in ("RESPONSE", "OPEN|FILTERED") for _, r in udp_results)
    if udp_open:
        classification.append("UDP_REACHABLE")
    else:
        classification.append("UDP_BLOCKED")
    
    if not classification:
        classification.append("UNKNOWN")
    
    return " | ".join(classification), " | ".join(methods)


def test_ip(ip):
    results = {"ip": ip}
    
    print(f"\n{'='*60}")
    print(f"TESTING {ip}")
    print(f"{'='*60}")
    
    print("\n[Layer 1: Ping]")
    pong = ping(ip)
    print(f"  ICMP: {'OK' if pong else 'FAIL'}")
    results["ping"] = pong
    
    print("\n[Layer 2: TCP VPN Ports]")
    tcp_results = []
    for port, label in VPN_PORTS_TCP:
        status, detail = tcp_probe(ip, port)
        print(f"  TCP {port:5d} ({label:15s}): {status:10s} {detail}")
        tcp_results.append((port, (status, detail)))
    results["tcp"] = tcp_results
    
    print("\n[Layer 3: UDP VPN Ports]")
    udp_results = []
    for port, label in VPN_PORTS_UDP:
        status, detail = udp_probe(ip, port)
        print(f"  UDP {port:5d} ({label:15s}): {status:15s} {detail}")
        udp_results.append((port, (status, detail)))
    results["udp"] = udp_results
    
    print("\n[Layer 4: DoH Resolution]")
    doh_ips, resolver = doh_resolve("vultr.com")
    if doh_ips:
        print(f"  DoH via {resolver}: {doh_ips[0]}")
    else:
        print(f"  DoH: FAILED ({resolver})")
    results["doh"] = (doh_ips, resolver)
    
    print("\n[Layer 5: TLS SNI Probes]")
    tls_main = tls_probe(ip, "vultr.com")
    print(f"  SNI=vultr.com: {tls_main[0]} | {tls_main[1]}")
    
    tls_control = tls_probe(ip, "cloudflare.com")
    print(f"  SNI=cloudflare.com (control): {tls_control[0]} | {tls_control[1]}")
    
    tls_no_sni = tls_probe(ip, "")
    print(f"  SNI=(empty): {tls_no_sni[0]} | {tls_no_sni[1]}")
    results["tls"] = {"main": tls_main, "control": tls_control, "no_sni": tls_no_sni}
    
    print("\n[Layer 6: Plain HTTP]")
    http_main = http_probe(ip, "vultr.com", 80)
    print(f"  HTTP vultr.com: {http_main[0]} | {http_main[1]}")
    results["http"] = http_main
    
    classification, methods = classify_dpi(ip, tcp_results, udp_results, tls_main, http_main, pong, doh_ips)
    print(f"\n>>> CLASSIFICATION: {classification}")
    print(f">>> DPI METHOD: {methods}")
    results["classification"] = classification
    results["methods"] = methods
    
    return results


def main():
    print(f"=== {PROVIDER} VPN Port Accessibility & DPI Detection ===")
    networks = load_networks()
    print(f"networks embedded: {len(networks)}")
    ips = sample_ips(networks)
    if not ips:
        print("no IPs to test")
        return 1
    print(f"testing {len(ips)} sampled IPs\n")
    
    all_results = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        all_results = list(pool.map(test_ip, ips))
    
    print(f"\n{'='*80}")
    print("SUMMARY")
    print(f"{'='*80}")
    print(f"{'IP':<16} {'Ping':<6} {'TCP-443':<10} {'TLS-SNI':<12} {'HTTP':<10} {'UDP':<10} {'Classification'}")
    print("-" * 80)
    for r in all_results:
        tcp_443 = next((s for p, (s, _) in r["tcp"] if p == 443), "?")
        tls_sni = r["tls"]["main"][0]
        http_s = r["http"][0]
        udp_any = "Y" if any(s in ("RESPONSE", "OPEN|FILTERED") for _, (s, _) in r["udp"]) else "N"
        print(f"{r['ip']:<16} {'Y' if r['ping'] else 'N':<6} {tcp_443:<10} {tls_sni:<12} {http_s:<10} {udp_any:<10} {r['classification']}")
    
    method_counts = {}
    for r in all_results:
        for m in r["methods"].split(" | "):
            method_counts[m] = method_counts.get(m, 0) + 1
    
    print(f"\nDPI METHOD COUNTS:")
    for method, count in sorted(method_counts.items(), key=lambda x: -x[1]):
        print(f"  {method}: {count}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())