#!/bin/bash
# Quick Test Script - Run this first to verify everything works

echo "=================================="
echo "Quick Test - Master Checker System"
echo "=================================="
echo ""
echo "This will test the system with 20 websites (fast ~2-3 minutes)"
echo ""

# Check Python version
python3 --version

echo ""
echo "Required Python packages:"
echo "  - requests"
echo "  - dnspython (dns.message, dns.resolver)"
echo ""
echo "To install: pip3 install requests dnspython"
echo ""

read -p "Press Enter to start quick test..."

echo ""
echo "Starting master_checker.py with --limit 20..."
echo ""

python3 master_checker.py --limit 20 --verify-count 10

echo ""
echo "=================================="
echo "Quick test complete!"
echo "=================================="
echo ""
echo "Check the output files:"
echo "  - verified_doh_servers.json"
echo "  - website_check_results_doh1.csv"
echo "  - fastest_100_websites_doh1.txt (top 20 in this test)"
echo "  - filtered_with_wrong_ips_doh1.txt (DNS 8.8.8.8 analysis)"
echo "  - master_report.txt"
echo ""
echo "If this works, run full check with:"
echo "  python3 master_checker.py"
echo ""
