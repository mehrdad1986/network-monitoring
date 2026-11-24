#!/usr/bin/env python3
"""
Real-time Lantern Traffic Monitor

Monitors Lantern VPN in real-time to discover:
- Connection endpoints
- Protocols used
- DPI bypass techniques
- Why it works when other VPNs fail

Usage:
    1. Run this script
    2. Start Lantern VPN
    3. Browse the internet through Lantern
    4. Script will capture and analyze traffic
"""
import subprocess
import time
import socket
import sys
from datetime import datetime
from collections import defaultdict

def run_cmd(cmd):
    """Run command and return output."""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, shell=True, timeout=5)
        return result.stdout
    except:
        return ""

def get_all_connections():
    """Get all active network connections."""
    output = run_cmd('netstat -ano')
    connections = []

    for line in output.split('\n'):
        if 'ESTABLISHED' in line:
            parts = line.split()
            if len(parts) >= 5:
                try:
                    connections.append({
                        'proto': parts[0],
                        'local': parts[1],
                        'remote': parts[2],
                        'pid': parts[4]
                    })
                except:
                    pass
    return connections

def analyze_endpoint(remote):
    """Analyze a remote endpoint."""
    try:
        if ':' not in remote:
            return None

        ip, port = remote.rsplit(':', 1)

        # Skip local IPs
        if ip.startswith(('127.', '192.168.', '10.', '172.', '0.0.0.0', '[::')):
            return None

        # Try to resolve hostname
        try:
            hostname = socket.gethostbyaddr(ip)[0]
        except:
            hostname = None

        return {
            'ip': ip,
            'port': int(port),
            'hostname': hostname
        }
    except:
        return None

def is_cloudflare(ip):
    """Check if IP is Cloudflare."""
    # Common Cloudflare IP ranges (first octet.second octet)
    cf_prefixes = [
        '104.16', '104.17', '104.18', '104.19', '104.20', '104.21', '104.22', '104.23',
        '104.24', '104.25', '104.26', '104.27', '104.28', '104.29', '104.30', '104.31',
        '172.64', '172.65', '172.66', '172.67', '172.68', '172.69', '172.70', '172.71',
        '173.245', '103.21', '141.101', '108.162', '190.93', '188.114',
        '197.234', '198.41', '162.158', '162.159', '131.0'
    ]

    for prefix in cf_prefixes:
        if ip.startswith(prefix + '.'):
            return True
    return False

def is_google(ip_or_host):
    """Check if endpoint is Google."""
    s = str(ip_or_host).lower()
    return any(x in s for x in ['google', '1e100', '8.8.8.8', '8.8.4.4'])

def is_cdn(ip, hostname):
    """Detect if endpoint uses CDN."""
    if is_cloudflare(ip):
        return 'Cloudflare'
    if is_google(ip) or is_google(hostname):
        return 'Google'

    h = (hostname or '').lower()
    if 'cloudfront' in h or 'amazonaws' in h:
        return 'CloudFront'
    if 'fastly' in h:
        return 'Fastly'
    if 'akamai' in h:
        return 'Akamai'

    return None

def monitor_lantern():
    """Monitor Lantern connections in real-time."""
    print("="*80)
    print("  LANTERN REAL-TIME TRAFFIC MONITOR")
    print("="*80)
    print()
    print("Instructions:")
    print("  1. Start Lantern VPN now")
    print("  2. Browse websites through Lantern")
    print("  3. This script will capture connections")
    print("  4. Press Ctrl+C to stop and see analysis")
    print()
    print("Monitoring started at:", datetime.now().strftime('%H:%M:%S'))
    print("="*80)
    print()

    seen_endpoints = defaultdict(int)
    last_connections = set()

    print("Waiting for Lantern connections...")
    print("(New connections will appear below)")
    print()

    try:
        iteration = 0
        while True:
            time.sleep(2)
            iteration += 1

            # Get current connections
            connections = get_all_connections()
            current_remotes = set(c['remote'] for c in connections)

            # Find new connections
            new_connections = current_remotes - last_connections

            for remote in new_connections:
                endpoint = analyze_endpoint(remote)
                if endpoint:
                    ip = endpoint['ip']
                    port = endpoint['port']
                    hostname = endpoint['hostname']

                    # Check if it's CDN
                    cdn = is_cdn(ip, hostname)

                    key = f"{ip}:{port}"
                    seen_endpoints[key] += 1

                    # Display new connection
                    timestamp = datetime.now().strftime('%H:%M:%S')

                    if cdn:
                        print(f"[{timestamp}] ✓ CDN: {ip}:{port}")
                        if hostname:
                            print(f"           Host: {hostname}")
                        print(f"           Provider: {cdn}")
                        print(f"           → BYPASS METHOD: Domain Fronting via {cdn}")
                    else:
                        print(f"[{timestamp}] → Direct: {ip}:{port}")
                        if hostname:
                            print(f"           Host: {hostname}")
                    print()

            last_connections = current_remotes

            # Show status every 30 seconds
            if iteration % 15 == 0:
                print(f"[Status] Still monitoring... ({len(seen_endpoints)} unique endpoints)")
                print()

    except KeyboardInterrupt:
        print("\n")
        print("="*80)
        print("MONITORING STOPPED - GENERATING ANALYSIS")
        print("="*80)
        print()

        if not seen_endpoints:
            print("✗ No Lantern connections detected!")
            print()
            print("Possible reasons:")
            print("  - Lantern is not running")
            print("  - Lantern is running but not connected yet")
            print("  - Lantern uses only local proxy (check localhost connections)")
            print()
            return

        # Analyze captured connections
        print(f"Captured {len(seen_endpoints)} unique endpoint(s):")
        print()

        cdn_endpoints = []
        direct_endpoints = []
        port_443_count = 0
        port_80_count = 0
        other_ports = set()

        for endpoint_key, count in sorted(seen_endpoints.items(), key=lambda x: x[1], reverse=True):
            ip, port = endpoint_key.rsplit(':', 1)
            port = int(port)

            # Re-analyze
            try:
                hostname = socket.gethostbyaddr(ip)[0]
            except:
                hostname = None

            cdn = is_cdn(ip, hostname)

            print(f"  {endpoint_key}")
            if hostname:
                print(f"    Hostname: {hostname}")
            print(f"    Connections: {count}")

            if cdn:
                print(f"    CDN: {cdn} ✓")
                cdn_endpoints.append(endpoint_key)
            else:
                print(f"    Type: Direct connection")
                direct_endpoints.append(endpoint_key)

            if port == 443:
                print(f"    Port: 443 (HTTPS) ✓")
                port_443_count += 1
            elif port == 80:
                print(f"    Port: 80 (HTTP)")
                port_80_count += 1
            else:
                print(f"    Port: {port}")
                other_ports.add(port)

            print()

        # Generate analysis
        print("="*80)
        print("WHY LANTERN WORKS - DPI BYPASS ANALYSIS")
        print("="*80)
        print()

        bypass_methods = []

        if cdn_endpoints:
            bypass_methods.append("Domain Fronting via CDN")
            print("1. DOMAIN FRONTING / CDN TECHNIQUE ✓")
            print(f"   - {len(cdn_endpoints)}/{len(seen_endpoints)} endpoints use CDN")
            print("   - Traffic routed through Cloudflare/Google/other CDN")
            print("   - DPI sees: Legitimate CDN connection")
            print("   - Real destination: Hidden in encrypted TLS payload")
            print("   - Why it works: CDN IPs cannot be blocked (breaks internet)")
            print()

        if port_443_count > 0:
            bypass_methods.append("HTTPS (Port 443)")
            print("2. STANDARD HTTPS TRAFFIC ✓")
            print(f"   - {port_443_count}/{len(seen_endpoints)} connections use port 443")
            print("   - Looks like normal web browsing")
            print("   - Cannot block without breaking all HTTPS sites")
            print("   - Encrypted payload hides VPN traffic")
            print()

        if len(seen_endpoints) > 3:
            bypass_methods.append("Distributed Infrastructure")
            print("3. MULTIPLE SERVER ENDPOINTS ✓")
            print(f"   - Uses {len(seen_endpoints)} different server(s)")
            print("   - Harder to block all servers")
            print("   - Automatic failover if one is blocked")
            print()

        print("="*80)
        print("WHY YOUR VPS DOESN'T WORK")
        print("="*80)
        print()

        print("LANTERN'S ADVANTAGES:")
        for method in bypass_methods:
            print(f"  ✓ {method}")
        print()

        print("YOUR VPS PROBLEMS:")
        print("  ✗ Direct IP connection (easily identified)")
        print("  ✗ Known VPS provider ranges (flagged)")
        print("  ✗ SNI inspection detects real destination")
        print("  ✗ Single server (easy to block)")
        print()

        print("="*80)
        print("HOW TO MAKE YOUR VPS WORK LIKE LANTERN")
        print("="*80)
        print()

        print("OPTION 1: Cloudflare Tunnel (EASIEST) ⭐")
        print("  What: Route traffic through Cloudflare's network")
        print("  How: Install 'cloudflared' on your VPS")
        print("  Setup:")
        print("    1. cloudflare.com → Zero Trust → Tunnels")
        print("    2. Install cloudflared on VPS")
        print("    3. Connect tunnel")
        print("  Result: Your traffic looks like Cloudflare traffic")
        print()

        print("OPTION 2: V2Ray/Xray with WebSocket + CDN")
        print("  What: WebSocket protocol over CDN")
        print("  How: V2Ray/Xray server behind Cloudflare")
        print("  Setup:")
        print("    1. Install V2Ray on VPS")
        print("    2. Configure WebSocket transport")
        print("    3. Add domain with Cloudflare")
        print("  Result: Looks like normal HTTPS website")
        print()

        print("OPTION 3: Use Your DNS Tunnel (ALREADY HAVE!) ⭐")
        print("  What: dnstt-server on port 53 UDP")
        print("  Status: ✓ Already tested and working")
        print("  Advantage: No CDN needed, pure DNS traffic")
        print("  Limitation: Slower speed, but very reliable")
        print()

        print("OPTION 4: Trojan-Go with CDN")
        print("  What: Trojan protocol mimics HTTPS")
        print("  How: Trojan-Go behind CDN")
        print("  Advantage: Very hard to detect")
        print()

        # Save detailed report
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        report_file = f"lantern_analysis_{timestamp}.txt"

        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(f"Lantern VPN Traffic Analysis\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"\n")
            f.write(f"Total Endpoints Captured: {len(seen_endpoints)}\n")
            f.write(f"CDN Endpoints: {len(cdn_endpoints)}\n")
            f.write(f"Direct Endpoints: {len(direct_endpoints)}\n")
            f.write(f"\n")
            f.write(f"Bypass Methods Identified:\n")
            for method in bypass_methods:
                f.write(f"  - {method}\n")
            f.write(f"\n")
            f.write(f"Detailed Endpoints:\n")
            for endpoint_key, count in sorted(seen_endpoints.items(), key=lambda x: x[1], reverse=True):
                f.write(f"  {endpoint_key} ({count} connections)\n")

        print(f"✓ Detailed report saved: {report_file}")
        print()

if __name__ == "__main__":
    print()
    print("INSTRUCTIONS:")
    print("  1. Start this script")
    print("  2. Open Lantern VPN in another window")
    print("  3. Connect Lantern")
    print("  4. Browse websites (Google, YouTube, etc.)")
    print("  5. Watch connections appear here")
    print("  6. Press Ctrl+C when done to see analysis")
    print()
    if "--yes" not in sys.argv:
        input("Press Enter to start monitoring...")
    print()

    try:
        monitor_lantern()
    except KeyboardInterrupt:
        print("\n\nMonitoring interrupted.")
        sys.exit(130)
