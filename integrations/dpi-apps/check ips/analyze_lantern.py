#!/usr/bin/env python3
"""
Lantern VPN Traffic Analyzer

Analyzes active Lantern VPN connections to identify:
- Server endpoints (IPs and domains)
- Protocols being used
- Ports in use
- Connection patterns
- Why it bypasses DPI when other VPNs fail
"""
import subprocess
import socket
import time
import re
import sys
from datetime import datetime
from collections import defaultdict

def run_command(cmd):
    """Run command and return output."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            shell=True,
            timeout=10
        )
        return result.stdout, result.returncode
    except Exception as e:
        return str(e), 1


def get_lantern_processes():
    """Find Lantern processes."""
    print("[*] Searching for Lantern processes...")

    cmd = 'tasklist /FI "IMAGENAME eq lantern*" /FO CSV'
    output, code = run_command(cmd)

    processes = []
    for line in output.split('\n'):
        if 'lantern' in line.lower() and '.exe' in line.lower():
            parts = line.strip('"').split('","')
            if len(parts) >= 2:
                processes.append({
                    'name': parts[0],
                    'pid': parts[1]
                })

    return processes


def get_network_connections():
    """Get all network connections."""
    print("[*] Analyzing network connections...")

    # Get TCP connections
    cmd = 'netstat -ano'
    output, code = run_command(cmd)

    connections = []
    for line in output.split('\n'):
        if 'ESTABLISHED' in line or 'LISTEN' in line:
            parts = line.split()
            if len(parts) >= 5:
                try:
                    proto = parts[0]
                    local = parts[1]
                    remote = parts[2]
                    state = parts[3]
                    pid = parts[4] if len(parts) > 4 else "0"

                    connections.append({
                        'protocol': proto,
                        'local': local,
                        'remote': remote,
                        'state': state,
                        'pid': pid
                    })
                except:
                    pass

    return connections


def filter_lantern_connections(connections, lantern_pids):
    """Filter connections belonging to Lantern."""
    pid_set = set(p['pid'] for p in lantern_pids)

    lantern_conns = []
    for conn in connections:
        if conn['pid'] in pid_set:
            lantern_conns.append(conn)

    return lantern_conns


def resolve_ip(ip):
    """Try to resolve IP to hostname."""
    try:
        hostname = socket.gethostbyaddr(ip)[0]
        return hostname
    except:
        return None


def analyze_endpoint(ip_port):
    """Analyze an endpoint."""
    try:
        if ':' not in ip_port:
            return None

        ip, port = ip_port.rsplit(':', 1)

        # Check if it's a local IP
        if ip.startswith('127.') or ip.startswith('192.168.') or ip.startswith('10.') or ip == '0.0.0.0':
            return None

        hostname = resolve_ip(ip)

        return {
            'ip': ip,
            'port': int(port),
            'hostname': hostname
        }
    except:
        return None


def check_cloudflare(ip):
    """Check if IP belongs to Cloudflare."""
    cloudflare_ranges = [
        '104.16.0.0/12',
        '172.64.0.0/13',
        '173.245.48.0/20',
        '103.21.244.0/22',
        '141.101.64.0/18',
        '108.162.192.0/18',
        '190.93.240.0/20',
        '188.114.96.0/20',
        '197.234.240.0/22',
        '198.41.128.0/17',
        '162.158.0.0/15',
        '104.16.0.0/13',
        '104.24.0.0/14',
        '131.0.72.0/22'
    ]

    import ipaddress
    try:
        ip_obj = ipaddress.ip_address(ip)
        for cidr in cloudflare_ranges:
            if ip_obj in ipaddress.ip_network(cidr):
                return True
    except:
        pass
    return False


def check_cdn_provider(ip, hostname):
    """Check if endpoint uses CDN."""
    cdn_indicators = {
        'cloudflare': ['cloudflare', 'cf-', '1.1.1.1', '1.0.0.1'],
        'cloudfront': ['cloudfront', 'amazonaws'],
        'fastly': ['fastly'],
        'akamai': ['akamai', 'akam'],
        'google': ['google', '8.8.8.8', '8.8.4.4', '1e100.net'],
    }

    if check_cloudflare(ip):
        return 'cloudflare'

    hostname_lower = (hostname or '').lower()
    for provider, indicators in cdn_indicators.items():
        for indicator in indicators:
            if indicator in hostname_lower or indicator in ip:
                return provider

    return None


def get_lantern_config():
    """Try to find Lantern configuration files."""
    print("[*] Searching for Lantern configuration...")

    import os

    # Common Lantern config locations
    config_paths = [
        os.path.expanduser('~\\AppData\\Roaming\\Lantern'),
        os.path.expanduser('~\\AppData\\Local\\Lantern'),
        os.path.expanduser('~\\.lantern'),
        'C:\\Program Files\\Lantern',
        'C:\\Program Files (x86)\\Lantern',
    ]

    found_configs = []
    for path in config_paths:
        if os.path.exists(path):
            print(f"  ✓ Found: {path}")
            found_configs.append(path)

            # List files
            try:
                for root, dirs, files in os.walk(path):
                    for file in files:
                        if any(ext in file.lower() for ext in ['.yaml', '.yml', '.json', '.conf', '.txt', '.log']):
                            filepath = os.path.join(root, file)
                            size = os.path.getsize(filepath)
                            print(f"    - {file} ({size} bytes)")
            except Exception as e:
                print(f"    Error listing: {e}")

    return found_configs


def check_tls_characteristics(ip, port):
    """Check TLS/SSL characteristics of connection."""
    print(f"[*] Checking TLS on {ip}:{port}...")

    import ssl

    try:
        # Try to connect and get SSL info
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE

        with socket.create_connection((ip, port), timeout=5) as sock:
            with context.wrap_socket(sock, server_hostname=None) as ssock:
                cert = ssock.getpeercert_bin()
                cipher = ssock.cipher()
                version = ssock.version()

                return {
                    'cipher': cipher,
                    'version': version,
                    'cert_present': cert is not None
                }
    except Exception as e:
        return {'error': str(e)}


def analyze_lantern():
    """Main analysis function."""
    print("="*80)
    print("  LANTERN VPN TRAFFIC ANALYZER")
    print(f"  Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)
    print()

    # Find Lantern processes
    processes = get_lantern_processes()

    if not processes:
        print("✗ Lantern process not found!")
        print()
        print("Please ensure Lantern is running and try again.")
        return

    print(f"✓ Found {len(processes)} Lantern process(es):")
    for p in processes:
        print(f"  - {p['name']} (PID: {p['pid']})")
    print()

    # Get all network connections
    all_connections = get_network_connections()
    print(f"✓ Total network connections: {len(all_connections)}")

    # Filter Lantern connections
    lantern_conns = filter_lantern_connections(all_connections, processes)
    print(f"✓ Lantern connections: {len(lantern_conns)}")
    print()

    if not lantern_conns:
        print("⚠ No active Lantern connections found.")
        print("  Lantern might be starting up or not yet connected.")
        return

    # Analyze endpoints
    print("="*80)
    print("LANTERN CONNECTION ANALYSIS")
    print("="*80)
    print()

    endpoints = defaultdict(list)

    for conn in lantern_conns:
        endpoint = analyze_endpoint(conn['remote'])
        if endpoint:
            key = f"{endpoint['ip']}:{endpoint['port']}"
            endpoints[key].append({
                'endpoint': endpoint,
                'protocol': conn['protocol'],
                'state': conn['state']
            })

    if not endpoints:
        print("ℹ All connections are local (127.0.0.1, 192.168.x.x)")
        print("  This means Lantern uses a local proxy that connects elsewhere.")
        print()

        # Show local endpoints
        print("Local proxy endpoints:")
        for conn in lantern_conns:
            if conn['state'] == 'LISTEN':
                print(f"  {conn['protocol']:5s} {conn['local']:25s} {conn['state']}")
        print()
        print("Recommendation: Use Wireshark or TCPView to see actual external connections")
        return

    print(f"Found {len(endpoints)} unique external endpoint(s):")
    print()

    # Analyze each endpoint
    cdn_count = 0
    port_443_count = 0
    port_80_count = 0
    other_ports = set()

    for endpoint_key, conns in endpoints.items():
        endpoint = conns[0]['endpoint']
        ip = endpoint['ip']
        port = endpoint['port']
        hostname = endpoint['hostname']

        print(f"Endpoint: {ip}:{port}")
        if hostname:
            print(f"  Hostname: {hostname}")

        # Check CDN
        cdn = check_cdn_provider(ip, hostname)
        if cdn:
            print(f"  CDN Provider: {cdn.upper()} ✓")
            cdn_count += 1

        # Port analysis
        if port == 443:
            port_443_count += 1
            print(f"  Port: 443 (HTTPS) ✓")
        elif port == 80:
            port_80_count += 1
            print(f"  Port: 80 (HTTP)")
        else:
            other_ports.add(port)
            print(f"  Port: {port} (Custom)")

        # Protocol
        protocols = set(c['protocol'] for c in conns)
        print(f"  Protocol(s): {', '.join(protocols)}")

        # Connection count
        print(f"  Connections: {len(conns)}")

        print()

    # Summary
    print("="*80)
    print("WHY LANTERN WORKS (DPI Bypass Analysis)")
    print("="*80)
    print()

    reasons = []

    if cdn_count > 0:
        reasons.append(f"✓ Uses CDN (Domain Fronting)")
        print("1. DOMAIN FRONTING / CDN USAGE")
        print("   Lantern routes traffic through CDN providers (Cloudflare, etc.)")
        print("   - DPI sees connection to legitimate CDN")
        print("   - Real destination hidden inside encrypted TLS")
        print("   - CDN IPs are not blocked (too many false positives)")
        print()

    if port_443_count > 0:
        reasons.append(f"✓ Uses HTTPS (Port 443)")
        print("2. HTTPS ON PORT 443")
        print("   - Standard HTTPS traffic looks normal")
        print("   - Blocking port 443 breaks too many legitimate sites")
        print("   - DPI cannot inspect encrypted payload")
        print()

    if len(endpoints) > 1:
        reasons.append(f"✓ Multiple endpoints ({len(endpoints)} servers)")
        print("3. DISTRIBUTED INFRASTRUCTURE")
        print(f"   - Uses {len(endpoints)} different server endpoint(s)")
        print("   - Harder to block all servers")
        print("   - Can failover if one is blocked")
        print()

    # Compare with your VPS
    print("="*80)
    print("COMPARISON: LANTERN vs YOUR VPS")
    print("="*80)
    print()

    print("LANTERN:")
    if cdn_count > 0:
        print("  ✓ CDN/Domain Fronting - Hides real destination")
    print("  ✓ Port 443 (HTTPS) - Standard encrypted traffic")
    print("  ✓ Distributed servers - Multiple endpoints")
    print("  ✓ Professional infrastructure - Optimized for censorship bypass")
    print()

    print("YOUR VPS:")
    print("  ✗ Direct IP connection - Easy to identify and block")
    print("  ✗ Known VPS provider IPs - Flagged as VPN infrastructure")
    print("  ✗ SNI filtering - TLS handshake inspected")
    print("  ? Single server - One point of failure")
    print()

    print("="*80)
    print("RECOMMENDATIONS TO MAKE YOUR VPS WORK LIKE LANTERN")
    print("="*80)
    print()

    print("1. USE CLOUDFLARE TUNNEL (Easiest)")
    print("   - Sign up for Cloudflare")
    print("   - Install cloudflared on your VPS")
    print("   - Traffic goes through Cloudflare's IPs")
    print("   - Command: cloudflared tunnel create")
    print()

    print("2. DOMAIN FRONTING")
    print("   - Get a domain")
    print("   - Use Cloudflare/other CDN")
    print("   - Configure SNI to show allowed domain")
    print("   - Real traffic encrypted inside")
    print()

    print("3. USE YOUR DNS TUNNEL (Already Have This!)")
    print("   - Your dnstt-server works perfectly")
    print("   - Uses UDP port 53 (DNS)")
    print("   - Bypasses SNI filtering")
    print("   - Already tested and working")
    print()

    print("4. WEBSOCKET over CDN")
    print("   - Use WebSocket protocol")
    print("   - Route through Cloudflare")
    print("   - Looks like normal HTTPS traffic")
    print("   - Tools: V2Ray, Xray, Trojan-Go")
    print()

    # Config search
    print()
    config_paths = get_lantern_config()

    if config_paths:
        print()
        print("ℹ To see exact Lantern configuration:")
        print("  Check the files listed above")
        print("  Look for: servers, domains, protocols")

    print()
    print("="*80)
    print()

    # Save report
    report_file = f"lantern_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"

    with open(report_file, 'w') as f:
        f.write(f"Lantern VPN Analysis Report\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"\n")
        f.write(f"Processes Found: {len(processes)}\n")
        f.write(f"Active Connections: {len(lantern_conns)}\n")
        f.write(f"External Endpoints: {len(endpoints)}\n")
        f.write(f"\n")
        f.write(f"Endpoints:\n")
        for endpoint_key in endpoints:
            f.write(f"  - {endpoint_key}\n")
        f.write(f"\n")
        f.write(f"Why Lantern Works:\n")
        for reason in reasons:
            f.write(f"  {reason}\n")

    print(f"✓ Report saved: {report_file}")
    print()


if __name__ == "__main__":
    try:
        analyze_lantern()
    except KeyboardInterrupt:
        print("\n\n[!] Interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n[!] Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
