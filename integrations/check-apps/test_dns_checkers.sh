#!/bin/bash
# Quick Test - DNS Checker Apps

echo "========================================"
echo "DNS Server Checker - Quick Test"
echo "========================================"
echo ""
echo "Testing with 50 servers from each dataset"
echo ""

# IPv4 DNS Test
echo "1. Testing IPv4 DNS Servers..."
echo "----------------------------------------"
python3 check_ipv4_dns.py --limit 50 --workers 20

echo ""
echo ""

# IPv6 DNS Test
echo "2. Testing IPv6 DNS Servers..."
echo "----------------------------------------"
python3 check_ipv6_dns.py --limit 50 --workers 20

echo ""
echo "========================================"
echo "Quick test complete!"
echo "========================================"
echo ""
echo "Output files:"
echo "  IPv4:"
echo "    - ipv4_dns_results.csv"
echo "    - ipv4_dns_ranked.txt"
echo ""
echo "  IPv6:"
echo "    - ipv6_dns_results.csv"
echo "    - ipv6_dns_ranked.txt"
echo ""
echo "For full run:"
echo "  python3 check_ipv4_dns.py  (62,795 servers)"
echo "  python3 check_ipv6_dns.py  (373 servers)"
echo ""
