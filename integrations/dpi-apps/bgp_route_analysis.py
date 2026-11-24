#!/usr/bin/env python3
"""
DPI Investigation - BGP/Border Route Analysis
Maps all routes from local network to international internet.
Traces 10 famous DNS servers + 100 popular websites to identify border routers.
"""
from pathlib import Path
import subprocess
import re
import json
import socket
from concurrent.futures import ThreadPoolExecutor, as_completed

# Famous DNS servers
FAMOUS_DNS = [
    ("Cloudflare", "1.1.1.1"),
    ("Google Primary", "8.8.8.8"),
    ("Google Secondary", "8.8.4.4"),
    ("Quad9 Primary", "9.9.9.9"),
    ("Quad9 Secondary", "149.112.112.112"),
    ("OpenDNS Primary", "208.67.222.222"),
    ("OpenDNS Secondary", "208.67.220.220"),
    ("Level3/Lumen", "64.6.64.6"),
    ("Cloudflare Secondary", "104.16.0.1"),
    ("Quad9 TLS", "9.9.9.9"),
]

# Top 100 most visited websites (Alexa top sites)
TOP_WEBSITES = [
    "google.com", "youtube.com", "facebook.com", "twitter.com", "instagram.com",
    "baidu.com", "google.co.uk", "reddit.com", "linkedin.com", "twitter.com",
    "microsoft.com", "google.de", "yahoo.com", "bing.com", "github.com",
    "google.jp", "amazon.com", "amazon.co.uk", "wikipedia.org", "zoom.us",
    "google.fr", "taobao.com", "paypal.com", "twitch.tv", "google.it",
    "translate.google.com", "ebay.com", "google.es", "duckduckgo.com", "reddit.com",
    "google.ru", " pinterest.com", "google.com.br", "t.co", "msn.com",
    "google.com.mx", "doc.google.com", "aliexpress.com", "google.ca", "whatsapp.com",
    "google.com.tr", "drive.google.com", "mail.google.com", "google.com.au", "google.com.mx",
    "google.nl", "google.pl", "google.com.ar", "google.co.kr", "google.com.ua",
    "adobe.com", "wordpress.com", "amazon.de", "google.co.in", "netflix.com",
    "tiktok.com", "stackoverflow.com", "imgur.com", "google.com.ph", "google.com.ng",
    "bbc.co.uk", "cnn.com", "google.com.pk", "github.com", "duckduckgo.com",
    "nytimes.com", "google.ca", "google.com.sg", "wikipedia.org", "google.com.mx",
    "google.com.br", "ebay.co.uk", "linkedin.com", "google.com.au", "zoom.us",
    "amazon.in", "aliexpress.com", "dailymail.co.uk", "google.com.tr", "netflix.com",
    "tiktok.com", "github.io", "msftncsi.com", "apple.com", "medium.com",
    "google.com.sa", "google.com.eg", "google.com.pk", "google.co.id", "google.com.my",
    "google.com.ph", "google.com.vn", "google.com.th", "google.com.my", "shopee.com.my",
    "go.jp", "rakuten.co.jp", "yahoo.co.jp", "amazon.co.jp", "zozo.jp",
    "google.com.co", "google.com.pe", "google.cl", "mercadolibre.com.mx", "mlb.com",
    "bankofamerica.com", "chase.com", "wells fargo", "paypal.com", "chase.com",
    "wellsfargo.com", "bankofamerica.com", "paypal.com", "revolut.com", "wise.com",
    "binance.com", "coinbase.com", "kraken.com", "ftx.com", "huobi.com",
    "google.com.eg", "google.com.sa", "google.ae", "emirates.com", "dubizzle.com",
]

def parse_traceroute(target):
    """Run traceroute and parse hops"""
    try:
        # Use TCP traceroute for better reliability
        result = subprocess.run(
            ["traceroute", "-n", "-w", "1", "-q", "1", "-m", "25", "-T", "-p", "443", target],
            capture_output=True, text=True, timeout=30
        )
        hops = []
        for line in result.stdout.split('\n'):
            line = line.strip()
            if not line or 'traceroute' in line:
                continue
            # Parse hop: " 7  10.21.251.158  123.456 ms"
            parts = line.split()
            if len(parts) >= 2:
                try:
                    hop_num = int(parts[0])
                except:
                    continue
                hop_ip = parts[1]
                if hop_ip != '*':
                    hops.append({"hop": hop_num, "ip": hop_ip})
        return hops
    except Exception as e:
        return [{"error": str(e)}]

def resolve_domain(domain):
    """Resolve domain to IP"""
    try:
        ips = socket.getaddrinfo(domain, None, socket.AF_INET)
        return list(set([ip[4][0] for ip in ips]))
    except:
        return []

def main():
    print("=" * 80)
    print("BGP/BORDER ROUTE ANALYSIS")
    print("Analyzing routes from local network to international internet")
    print("=" * 80)
    
    # Step 1: Traceroute to famous DNS servers
    print("\n[1] Traceroute to Famous DNS Servers:")
    print("-" * 80)
    
    dns_results = {}
    for name, ip in FAMOUS_DNS:
        print(f"\n--- {name} ({ip}) ---")
        hops = parse_traceroute(ip)
        dns_results[ip] = hops
        for hop in hops:
            if "error" not in hop:
                print(f"  Hop {hop['hop']:2d}: {hop['ip']}")
    
    # Step 2: Find common border hops
    print("\n\n[2] Border Router / Exit Point Analysis:")
    print("-" * 80)
    
    # Collect all hops from all traceroutes
    all_hops = {}
    for target, hops in dns_results.items():
        for hop in hops:
            if "error" not in hop:
                hop_num = hop["hop"]
                hop_ip = hop["ip"]
                if hop_ip not in all_hops:
                    all_hops[hop_ip] = {"count": 0, "targets": []}
                all_hops[hop_ip]["count"] += 1
                all_hops[hop_ip]["targets"].append(target)
    
    # Identify border routers (appear in multiple routes, transition from internal to external)
    border_candidates = []
    for ip, data in sorted(all_hops.items(), key=lambda x: x[1]["count"], reverse=True):
        # Private IP ranges (RFC 1918)
        is_private = ip.startswith('10.') or ip.startswith('192.168.') or ip.startswith('172.')
        if data["count"] >= 3:  # Appears in at least 3 routes
            border_candidates.append({
                "ip": ip,
                "count": data["count"],
                "private": is_private
            })
    
    print("\nBorder/Transit IPs (appearing in ≥3 routes):")
    for b in border_candidates:
        label = "PRIVATE (internal)" if b["private"] else "PUBLIC (border/exit)"
        print(f"  {b['ip']:20s} appears in {b['count']:3d} routes → {label}")
    
    # Step 3: Resolve and trace popular websites
    print("\n\n[3] Traceroute to Top Websites (sample of 50):")
    print("-" * 80)
    
    website_results = {}
    # Get unique domains
    domains = list(set(d.strip() for d in TOP_WEBSITES if d.strip()))[:50]
    
    def trace_website(domain):
        ips = resolve_domain(domain)
        if ips:
            hops = parse_traceroute(ips[0])
            return (domain, ips[0], hops)
        return (domain, None, [{"error": "DNS resolution failed"}])
    
    # Use thread pool for faster execution
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(trace_website, d): d for d in domains}
        for future in as_completed(futures, timeout=120):
            try:
                domain, ip, hops = future.result()
                website_results[domain] = {"ip": ip, "hops": hops}
                last_ips = [h.get("ip", "?") for h in hops[-3:] if "error" not in h]
                print(f"  {domain:30s} → {ip or 'DNS FAILED':16s} → {last_ips}")
            except Exception as e:
                print(f"  {future.result()}: TIMEOUT")
    
    # Step 4: Save all results
    print("\n\n[4] Saving results...")
    all_data = {
        "dns_servers": {"targets": FAMOUS_DNS, "routes": dns_results},
        "websites": {"domains": domains, "routes": website_results},
        "border_ips": border_candidates,
    }
    
    with open(Path(__file__).resolve().parent / "bgp_route_analysis.json", "w") as f:
        json.dump(all_data, f, indent=2, default=str)
    
    with open(Path(__file__).resolve().parent / "bgp_route_analysis.json", "w") as f:
        json.dump(all_data, f, indent=2, default=str)
    
    print(f"Results saved to ~/Desktop/new/bgp_route_analysis.json")

if __name__ == "__main__":
    main()
