#!/bin/bash
# Quick Test Script for Simple Checker (Single DoH)

echo "==========================================="
echo "Simple Checker - Single DoH Server Version"
echo "==========================================="
echo ""
echo "This will test with 20 websites (~2 minutes)"
echo ""

# Check Python version
python3 --version

echo ""
echo "Required: pip3 install requests dnspython"
echo ""

read -p "Press Enter to start test..."

echo ""
echo "Running simple_checker.py with --limit 20..."
echo ""

python3 simple_checker.py --limit 20 --verify-count 10

echo ""
echo "==========================================="
echo "Test complete!"
echo "==========================================="
echo ""
echo "Output files:"
echo "  - verified_doh_servers.json"
echo "  - website_check_results.csv"
echo "  - fastest_100_websites.txt (top 20 in this test)"
echo "  - filtered_with_wrong_ips.txt (8.8.8.8 analysis)"
echo "  - filtered_websites_report.txt"
echo "  - simple_checker_report.txt (summary)"
echo ""
echo "For full run: python3 simple_checker.py"
echo ""
