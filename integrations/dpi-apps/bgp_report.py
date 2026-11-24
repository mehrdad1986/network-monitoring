#!/usr/bin/env python3
"""
BGP Route Analysis - From JSON data to comprehensive report
"""
from pathlib import Path
import json
from collections import OrderedDict

# Load the route data
with open(Path(__file__).resolve().parent / "bgp_route_analysis.json") as f:
    data = json.load(f)

# Known AS numbers for IPs
AS_LOOKUP = {
    "80.81.194.180": "AS13335 (Cloudflare/DE-CIX Frankfurt peering)",
    "162.158.84.135": "AS13335 (Cloudflare edge)",
    "162.158.84.21": "AS13335 (Cloudflare edge)",
    "91.93.169.33": "AS6453 (Tata/Tellcom - Turkish ISP backbone)",
    "217.131.59.45": "AS6453 (Superonline/Tellcom)",
    "72.14.214.52": "AS15169 (Google)",
    "62.115.123.36": "AS174 (Cogent Communications)",
    "62.115.137.202": "AS174 (Cogent)",
    "62.115.141.153": "AS174 (Cogent)",
    "62.115.141.149": "AS174 (Cogent)",
    "62.115.182.189": "AS174 (Cogent)",
    "62.115.140.105": "AS174 (Cogent)",
    "213.248.93.33": "AS174 (Cogent)",
    "213.198.77.156": "AS174 (Cogent - Level3)",
    "129.250.5.35": "AS2914 (NTT Communications)",
    "129.250.2.5": "AS2914 (NTT)",
    "142.251.244.71": "AS15169 (Google)",
    "142.250.214.197": "AS15169 (Google)",
    "151.101.192.84": "AS54113 (Fastly)",
    "80.81.195.54": "AS13335 (Cloudflare/DE-CIX)",
    "193.251.150.199": "AS5412 (Turkcell Superonline)",
    "193.251.252.234": "AS5412 (Superonline)",
    "104.17.185.205": "AS13335 (Cloudflare)",
    "168.253.144.10": "AS14618 (Amazon)",
    "151.101.3.1": "AS54113 (Fastly)",
    "104.16.0.1": "AS13335 (Cloudflare)",
    "170.114.52.2": "AS13335 (Cloudflare - Zoom)",
    "147.243.105.206": "AS15133 (MCI)",
    "147.243.105.247": "AS15133 (MCI)",
    "204.79.197.220": "AS8075 (Microsoft/Bing)",
    "162.159.152.4": "AS13335 (Cloudflare)",
    "162.159.140.233": "AS13335 (Cloudflare)",
    "198.252.206.1": "AS63518 (Fastly)",
    "133.237.182.225": "AS17676 (Yahoo/Japan)",
    "151.101.65.164": "AS54113 (Fastly - NYTimes)",
    "45.60.240.176": "AS13335 (Cloudflare)",
    "213.13.145.6": "AS15133 (MCI)",
}

# Collect all hops
hop_appearances = {}

for target_type, targets in [("dns", data["dns_servers"]["routes"]), ("website", data["websites"]["routes"])]:
    for target, route_data in targets.items():
        if target_type == "dns":
            hops_list = route_data
        else:
            hops_list = route_data.get("hops", []) if isinstance(route_data, dict) else route_data
        for hop in hops_list:
            if isinstance(hop, dict) and "error" in hop:
                continue
            if not isinstance(hop, dict) or "ip" not in hop:
                continue
            ip = hop["ip"]
            if ip not in hop_appearances:
                hop_appearances[ip] = {"hops": {}, "targets": [], "type": "dns" if target_type == "dns" else "web"}
            hop_appearances[ip]["hops"][hop["hop"]] = hop["hop"]
            if target not in hop_appearances[ip]["targets"]:
                hop_appearances[ip]["targets"].append(target)

# Print the complete route map
print("=" * 80)
print("BGP/BORDER ROUTE ANALYSIS - COMPLETE MAP")
print("=" * 80)

# Step 1: All routes
print("\n[1] COMPLETE ROUTE MAPS (10 DNS servers + 50 websites)")
print("-" * 80)

for target, hops in data["dns_servers"]["routes"].items():
    print(f"\n  DNS: {target}")
    for hop in hops:
        if "error" not in hop:
            asn = AS_LOOKUP.get(hop["ip"], "")
            print(f"    Hop {hop['hop']:2d}: {hop['ip']:20s} {asn}")

for target, info in data["websites"]["routes"].items():
    ip = info["ip"] or "DNS FAILED"
    print(f"\n  WEB: {target:30s} → {ip}")
    for hop in info["hops"]:
        if "error" not in hop:
            asn = AS_LOOKUP.get(hop["ip"], "")
            print(f"    Hop {hop['hop']:2d}: {hop['ip']:20s} {asn}")

# Step 2: Border/Transit IPs
print("\n\n[2] ALL BORDER/TRANSIT IPs (Check Points)")
print("-" * 80)
border_ips = []
for ip, data_ip in sorted(hop_appearances.items(), key=lambda x: len(x[1]["targets"]), reverse=True):
    count = len(data_ip["targets"])
    is_private = ip.startswith('10.') or ip.startswith('192.168.') or ip.startswith('172.')
    as_info = AS_LOOKUP.get(ip, "Unknown ASN")
    if count >= 3:
        border_ips.append({"ip": ip, "count": count, "private": is_private, "asn": as_info})
        category = "LOCAL" if is_private else "BORDER/TRANSIT"
        print(f"  {ip:20s}  appears in {count:2d} routes → {category:15s} {as_info}")

# Step 3: International Gateways
print("\n\n[3] INTERNATIONAL GATEWAY POINTS (Exit to Global Internet)")
print("-" * 80)
international_gateways = [
    "80.81.194.180",   # DE-CIX Frankfurt
    "91.93.169.33",    # Tata/Tellcom
    "85.132.90.153",   # Turkcell/Iletisim
    "217.131.59.45",   # Superonline
    "62.115.137.202",  # Cogent
]
for gw in international_gateways:
    asn = AS_LOOKUP.get(gw, "Unknown")
    print(f"  {gw:20s}  {asn}")

print(f"\nTotal international gateway points: {len(international_gateways)}")

# Step 4: AS Numbers
print("\n\n[4] BGP AS NUMBERS (Autonomous Systems)")
print("-" * 80)
as_numbers = {}
for ip, data_ip in hop_appearances.items():
    as_info = AS_LOOKUP.get(ip, "")
    if "AS" in as_info:
        asn = as_info.split()[0]
        if asn not in as_numbers:
            as_numbers[asn] = {"name": as_info, "ips": []}
        as_numbers[asn]["ips"].append(ip)

for asn, info in sorted(as_numbers.items()):
    print(f"  {asn:10s} {info['name'][len(asn)+1:][:40]:40s} IPs: {info['ips'][:3]}")

# Step 5: Route types
print("\n\n[5] ROUTING PATHS SUMMARY")
print("-" * 80)
print("""
Path 1 - Cloudflare services (1.1.1.1, cloudflare.com):
  Local: 192.168.0.1 → 10.21.251.158 → 10.21.0.10
  Gateway: 80.81.194.180 (DE-CIX Frankfurt, AS13335)
  Edge: 162.158.84.x (Cloudflare Frankfurt PoP)
  Total hops: 11
  
Path 2 - Google services (8.8.8.8, google.com):
  Local: 192.168.0.1 → 10.21.251.x → 10.21.0.10 → 10.21.41.21
  Gateway: 217.131.59.45 (Superonline/Tellcom AS6453)
  Transit: 72.14.214.x (Google AS15169)
  Total hops: 17

Path 3 - Quad9/OpenDNS (9.9.9.9, 208.67.220.220):
  Local: 192.168.0.1 → 10.21.251.x → 85.132.90.153
  Transit: 213.x.x.x → 62.115.x.x (Cogent AS174)
  Total hops: 16

Path 4 - Vercel/AWS (vercel.app, bankofamerica.com):
  Local: 192.168.0.1 → 10.21.251.x → 91.93.169.33
  Transit: 10.40.x.x (AWS backbone AS16509)
  Total hops: 12-15

Path 5 - Fastly/Cloudflare (github.io, paypal.com, pinterest.com):
  Local: 192.168.0.1 → 10.21.x.x → 80.81.195.54 (DE-CIX)
  Edge: 151.x.x.x (Fastly AS54113) or 162.159.x.x (Cloudflare)
""")

# Step 6: DNS poisoning summary
print("[6] DNS POISONING DETECTION")
print("-" * 80)
poisoned = []
for domain, info in data["websites"]["routes"].items():
    if info["ip"] == "10.10.34.35" or info["ip"] == "10.10.34.34":
        poisoned.append(f"{domain} → {info['ip']}")

for p in poisoned:
    print(f"  POISONED: {p}")

print(f"\n  Total poisoned domains: {len(poisoned)}")
print(f"  Sinkhole IP: 10.10.34.35 (and 10.10.34.34)")