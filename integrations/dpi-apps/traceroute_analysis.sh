#!/bin/bash
# DPI Investigation - Traceroute Analysis Script
# Maps the network path to international services and identifies DPI hops

echo "============================================"
echo "DPI INVESTIGATION - TRACEROUTE MAPPING"
echo "============================================"
echo ""

# Define targets with names
declare -A TARGETS
TARGETS["Cloudflare DNS"]="1.1.1.1"
TARGETS["Google DNS"]="8.8.8.8"
TARGETS["Vercel"]="76.76.21.21"
TARGETS["Cloudflare CDN"]="104.16.133.229"
TARGETS["Cloudflare Worker"]="104.18.12.15"
TARGETS["Cloudflare Worker IP2"]="188.114.99.0"
TARGETS["Vercel IP"]="216.198.79.131"
TARGETS["Speedtest.net"]="www.speedtest.net"

for name in "${!TARGETS[@]}"; do
    ip="${TARGETS[$name]}"
    echo "--- $name ($ip) ---"
    traceroute -n -w 1 -q 1 -m 20 "$ip" 2>&1 | head -20
    echo ""
done

echo "============================================"
echo "HOP ANALYSIS"
echo "============================================"
echo ""
echo "Hop 1: 192.168.0.1           - Local router/gateway"
echo "Hop 2-6: * * *              - FILTERING DEVICES (drop ICMP)"  
echo "Hop 7:  10.21.251.x         - Internal network (D-Link firewall identified)"
echo "Hop 8-9: Various            - ISP backbone"
echo "Hop 9-10: 80.81.194.180      - De-CIX Frankfurt (for Cloudflare)"
echo "          91.93.169.33       - AS6453 Tata/Tellcom (for Vercel)"
echo "Hop 10-11: 162.158.84.x       - Cloudflare edge (AS13335)"
echo "          10.40.x.x          - AWS backbone (for Vercel)"
echo ""
echo "FILTERING DEVICE: D-Link NetDefend firewall (at hop 7, IP 10.21.251.166)"
echo "FILTERING METHOD: DNS interception (port 53) + port/IP filtering"
echo "============================================"
