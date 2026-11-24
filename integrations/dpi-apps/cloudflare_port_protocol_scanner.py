#!/usr/bin/env python3
"""
Cloudflare Port & Protocol Scanner
Tests all ports and protocols with Cloudflare domains to identify which are filtered
Based on DPI investigation: Port 80 works, all TLS ports filtered identically on MCI
"""

from pathlib import Path
import os
import socket
import ssl
import time
import json
import sys
from datetime import datetime
from typing import Dict, List, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

# ANSI colors
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'
    BOLD = '\033[1m'
    RESET = '\033[0m'

class CloudflarePortProtocolScanner:
    def __init__(self):
        # Cloudflare IPs from investigation
        self.cloudflare_ips = [
            "188.114.96.1",   # Best performer: 187ms, 0% loss
            "188.114.96.3",
            "188.114.97.3",
            "104.21.28.168",
            "172.67.141.125"
        ]

        # Test domains
        self.test_domains = {
            "control": "cloudflare.com",           # Should work
            "blocked_3label": "test.workers.dev",  # 3 labels - blocked on MCI
            "workers_apex": "workers.dev",         # Should work
            "blocked_4label": "a.b.workers.dev"    # 4 labels - blocked on MCI
        }

        # Ports to test
        self.ports_to_test = {
            # HTTP
            "http": [80, 8080, 8008, 8000, 3000],

            # HTTPS/TLS
            "https": [443, 8443, 2053, 2083, 2087, 2096],

            # Alternative HTTPS
            "https_alt": [2052, 2082, 2086, 2095],

            # HTTP/3 QUIC (UDP)
            "http3": [443, 8443],

            # DNS
            "dns": [53],          # Plain DNS
            "dns_tls": [853],     # DNS over TLS
            "dns_https": [443],   # DNS over HTTPS (same as HTTPS)

            # Other protocols
            "proxy": [1080, 3128, 8118],  # SOCKS/HTTP proxy
            "ssh": [22],
            "ftp": [21],
        }

        self.timeout = 3
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "test_matrix": [],
            "port_summary": {},
            "protocol_summary": {},
            "filtering_patterns": []
        }

    def test_tcp_port(self, ip: str, port: int, test_name: str = "") -> Dict:
        """Test TCP port connectivity"""
        result = {
            "ip": ip,
            "port": port,
            "protocol": "tcp",
            "test_name": test_name,
            "reachable": False,
            "response_time_ms": 0,
            "verdict": "UNKNOWN"
        }

        start_time = time.time()

        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.timeout)
            sock.connect((ip, port))

            response_time = time.time()
            result["response_time_ms"] = int((response_time - start_time) * 1000)
            result["reachable"] = True
            result["verdict"] = "OPEN"

            sock.close()

        except socket.timeout:
            result["verdict"] = "TIMEOUT"
        except ConnectionRefusedError:
            result["verdict"] = "REFUSED"
        except Exception as e:
            result["verdict"] = "FILTERED"
            result["error"] = str(e)[:50]
        finally:
            if result["response_time_ms"] == 0:
                result["response_time_ms"] = int((time.time() - start_time) * 1000)

        return result

    def test_http_port(self, ip: str, port: int, sni: str = None) -> Dict:
        """Test HTTP (plaintext) connection"""
        result = {
            "ip": ip,
            "port": port,
            "protocol": "http",
            "sni": sni or "N/A",
            "success": False,
            "status_code": 0,
            "bytes_received": 0,
            "response_time_ms": 0,
            "verdict": "UNKNOWN"
        }

        start_time = time.time()

        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.timeout)
            sock.connect((ip, port))

            # Send HTTP request (no TLS)
            host = sni or ip
            request = f"GET / HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n"
            sock.sendall(request.encode())

            # Receive response
            data = sock.recv(4096)

            response_time = time.time()
            result["response_time_ms"] = int((response_time - start_time) * 1000)

            if data:
                result["success"] = True
                result["bytes_received"] = len(data)
                result["verdict"] = "WORKING"

                # Extract status code
                try:
                    response_str = data.decode('utf-8', errors='ignore')
                    if "HTTP/" in response_str:
                        status_line = response_str.split('\r\n')[0]
                        if " " in status_line:
                            parts = status_line.split(' ')
                            if len(parts) >= 2:
                                result["status_code"] = int(parts[1])
                except:
                    pass
            else:
                result["verdict"] = "NO_DATA"

            sock.close()

        except socket.timeout:
            result["verdict"] = "TIMEOUT"
        except ConnectionRefusedError:
            result["verdict"] = "REFUSED"
        except Exception as e:
            result["verdict"] = "ERROR"
            result["error"] = str(e)[:50]
        finally:
            if result["response_time_ms"] == 0:
                result["response_time_ms"] = int((time.time() - start_time) * 1000)

        return result

    def test_https_port(self, ip: str, port: int, sni: str) -> Dict:
        """Test HTTPS (TLS) connection with specific SNI"""
        result = {
            "ip": ip,
            "port": port,
            "protocol": "https",
            "sni": sni,
            "success": False,
            "handshake_completed": False,
            "data_received": False,
            "bytes_received": 0,
            "response_time_ms": 0,
            "verdict": "UNKNOWN"
        }

        start_time = time.time()
        sock = None
        ssl_sock = None

        try:
            # TCP connection
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.timeout)
            sock.connect((ip, port))

            # TLS handshake
            context = ssl.create_default_context()
            context.check_hostname = False  # Keep False for IP literal connection
            context.verify_mode = ssl.CERT_REQUIRED

            ssl_sock = context.wrap_socket(sock, server_hostname=sni)

            handshake_time = time.time()
            result["handshake_completed"] = True
            result["response_time_ms"] = int((handshake_time - start_time) * 1000)

            # Send HTTP request over TLS
            request = f"GET / HTTP/1.1\r\nHost: {sni}\r\nConnection: close\r\n\r\n"
            ssl_sock.sendall(request.encode())

            # Try to receive data
            data = ssl_sock.recv(4096)

            if data:
                result["success"] = True
                result["data_received"] = True
                result["bytes_received"] = len(data)
                result["verdict"] = "WORKING"
            else:
                # Handshake ok but no data = DPI silent drop
                result["verdict"] = "SILENT_DROP"

            ssl_sock.close()
            sock.close()

        except socket.timeout:
            result["verdict"] = "TIMEOUT"
        except ConnectionResetError:
            result["verdict"] = "TCP_RESET"
        except ssl.SSLError as e:
            if result["handshake_completed"]:
                result["verdict"] = "POST_HANDSHAKE_SSL_ERROR"
            else:
                result["verdict"] = "SSL_HANDSHAKE_FAILED"
            result["error"] = str(e)[:50]
        except Exception as e:
            result["verdict"] = "ERROR"
            result["error"] = str(e)[:50]
        finally:
            if ssl_sock:
                try:
                    ssl_sock.close()
                except:
                    pass
            if sock:
                try:
                    sock.close()
                except:
                    pass

            if result["response_time_ms"] == 0:
                result["response_time_ms"] = int((time.time() - start_time) * 1000)

        return result

    def test_udp_port(self, ip: str, port: int) -> Dict:
        """Test UDP port (for HTTP/3 QUIC)"""
        result = {
            "ip": ip,
            "port": port,
            "protocol": "udp",
            "reachable": False,
            "verdict": "UNKNOWN"
        }

        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(self.timeout)

            # Send dummy data
            sock.sendto(b"\x00" * 32, (ip, port))

            # Try to receive (may timeout if filtered)
            try:
                data, addr = sock.recvfrom(1024)
                result["reachable"] = True
                result["verdict"] = "OPEN"
            except socket.timeout:
                result["verdict"] = "TIMEOUT_OR_FILTERED"

            sock.close()

        except Exception as e:
            result["verdict"] = "ERROR"
            result["error"] = str(e)[:50]

        return result

    def run_comprehensive_scan(self):
        """Run comprehensive port and protocol scan"""
        print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*70}")
        print("        CLOUDFLARE PORT & PROTOCOL SCANNER")
        print(f"{'='*70}{Colors.RESET}\n")

        print(f"Testing Cloudflare IPs: {', '.join(self.cloudflare_ips[:3])}")
        print(f"Test domains: {list(self.test_domains.values())}")
        print()

        # Use primary IP for testing
        primary_ip = self.cloudflare_ips[0]

        # Test 1: HTTP ports (plaintext, no SNI)
        print(f"\n{Colors.CYAN}{'─'*70}")
        print("TEST 1: HTTP Ports (Plaintext - No TLS/SNI)")
        print(f"{'─'*70}{Colors.RESET}")

        for port in self.ports_to_test["http"]:
            print(f"  Port {port:5d} ... ", end='', flush=True)
            result = self.test_http_port(primary_ip, port, "cloudflare.com")
            self.results["test_matrix"].append(result)

            if result["verdict"] == "WORKING":
                print(f"{Colors.GREEN}✓ WORKING ({result['status_code']}, {result['response_time_ms']}ms){Colors.RESET}")
            elif result["verdict"] == "REFUSED":
                print(f"{Colors.YELLOW}○ REFUSED (port closed){Colors.RESET}")
            else:
                print(f"{Colors.RED}✗ {result['verdict']}{Colors.RESET}")

            time.sleep(0.1)

        # Test 2: HTTPS ports with control SNI (should work)
        print(f"\n{Colors.CYAN}{'─'*70}")
        print(f"TEST 2: HTTPS Ports with CONTROL SNI: {self.test_domains['control']}")
        print(f"{'─'*70}{Colors.RESET}")

        for port in self.ports_to_test["https"]:
            print(f"  Port {port:5d} ... ", end='', flush=True)
            result = self.test_https_port(primary_ip, port, self.test_domains["control"])
            self.results["test_matrix"].append(result)

            if result["verdict"] == "WORKING":
                print(f"{Colors.GREEN}✓ WORKING ({result['response_time_ms']}ms){Colors.RESET}")
            elif result["verdict"] == "SILENT_DROP":
                print(f"{Colors.RED}✗ SILENT DROP (handshake ok, no data){Colors.RESET}")
            elif result["verdict"] == "TIMEOUT":
                print(f"{Colors.RED}✗ TIMEOUT{Colors.RESET}")
            else:
                print(f"{Colors.YELLOW}⚠ {result['verdict']}{Colors.RESET}")

            time.sleep(0.1)

        # Test 3: HTTPS ports with BLOCKED SNI (3 labels)
        print(f"\n{Colors.CYAN}{'─'*70}")
        print(f"TEST 3: HTTPS Ports with BLOCKED SNI: {self.test_domains['blocked_3label']}")
        print(f"{'─'*70}{Colors.RESET}")

        for port in self.ports_to_test["https"]:
            print(f"  Port {port:5d} ... ", end='', flush=True)
            result = self.test_https_port(primary_ip, port, self.test_domains["blocked_3label"])
            self.results["test_matrix"].append(result)

            if result["verdict"] == "WORKING":
                print(f"{Colors.GREEN}✓ WORKING (bypassed filter!){Colors.RESET}")
            elif result["verdict"] == "SILENT_DROP":
                print(f"{Colors.RED}✗ SILENT DROP (DPI filtered){Colors.RESET}")
            elif result["verdict"] == "TIMEOUT":
                print(f"{Colors.RED}✗ TIMEOUT (filtered){Colors.RESET}")
            else:
                print(f"{Colors.YELLOW}⚠ {result['verdict']}{Colors.RESET}")

            time.sleep(0.1)

        # Test 4: Alternative HTTPS ports
        print(f"\n{Colors.CYAN}{'─'*70}")
        print(f"TEST 4: Alternative HTTPS Ports with BLOCKED SNI")
        print(f"{'─'*70}{Colors.RESET}")

        for port in self.ports_to_test["https_alt"]:
            print(f"  Port {port:5d} ... ", end='', flush=True)
            result = self.test_https_port(primary_ip, port, self.test_domains["blocked_3label"])
            self.results["test_matrix"].append(result)

            if result["verdict"] == "WORKING":
                print(f"{Colors.GREEN}✓ WORKING{Colors.RESET}")
            elif result["verdict"] in ["SILENT_DROP", "TIMEOUT"]:
                print(f"{Colors.RED}✗ FILTERED{Colors.RESET}")
            else:
                print(f"{Colors.YELLOW}⚠ {result['verdict']}{Colors.RESET}")

            time.sleep(0.1)

        # Test 5: UDP ports (HTTP/3 QUIC)
        print(f"\n{Colors.CYAN}{'─'*70}")
        print(f"TEST 5: UDP Ports (HTTP/3 QUIC)")
        print(f"{'─'*70}{Colors.RESET}")

        for port in self.ports_to_test["http3"]:
            print(f"  UDP {port:5d} ... ", end='', flush=True)
            result = self.test_udp_port(primary_ip, port)
            result["test_type"] = "http3_quic"
            self.results["test_matrix"].append(result)

            if result["verdict"] == "OPEN":
                print(f"{Colors.GREEN}✓ OPEN{Colors.RESET}")
            else:
                print(f"{Colors.RED}✗ {result['verdict']}{Colors.RESET}")

            time.sleep(0.1)

        # Test 6: DNS ports
        print(f"\n{Colors.CYAN}{'─'*70}")
        print(f"TEST 6: DNS Ports")
        print(f"{'─'*70}{Colors.RESET}")

        # Plain DNS
        print(f"  TCP 53 (DNS) ... ", end='', flush=True)
        result = self.test_tcp_port(primary_ip, 53, "plain_dns")
        self.results["test_matrix"].append(result)
        print(f"{Colors.GREEN if result['reachable'] else Colors.RED}{result['verdict']}{Colors.RESET}")

        # DNS over TLS
        print(f"  TCP 853 (DoT) ... ", end='', flush=True)
        result = self.test_tcp_port(primary_ip, 853, "dns_over_tls")
        self.results["test_matrix"].append(result)
        print(f"{Colors.GREEN if result['reachable'] else Colors.RED}{result['verdict']}{Colors.RESET}")

    def analyze_patterns(self):
        """Analyze filtering patterns"""
        print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*70}")
        print("                    FILTERING ANALYSIS")
        print(f"{'='*70}{Colors.RESET}\n")

        patterns = []

        # Check if HTTP (plaintext) works
        http_results = [r for r in self.results["test_matrix"] if r.get("protocol") == "http"]
        http_working = [r for r in http_results if r.get("verdict") == "WORKING"]

        if http_working:
            patterns.append({
                "pattern": "HTTP_PLAINTEXT_ALLOWED",
                "description": "HTTP plaintext (port 80) works without TLS/SNI",
                "significance": "DPI filter only inspects TLS SNI, not HTTP traffic"
            })
            print(f"{Colors.GREEN}✓ Pattern: HTTP plaintext ALLOWED{Colors.RESET}")
            print(f"   Port 80 works without SNI inspection\n")

        # Check if all HTTPS ports filtered identically
        https_control = [r for r in self.results["test_matrix"]
                        if r.get("protocol") == "https" and r.get("sni") == self.test_domains["control"]]
        https_blocked = [r for r in self.results["test_matrix"]
                        if r.get("protocol") == "https" and r.get("sni") == self.test_domains["blocked_3label"]]

        control_working = [r for r in https_control if r.get("verdict") == "WORKING"]
        blocked_filtered = [r for r in https_blocked if r.get("verdict") in ["SILENT_DROP", "TIMEOUT"]]

        if len(blocked_filtered) == len(https_blocked) and len(https_blocked) > 0:
            patterns.append({
                "pattern": "ALL_HTTPS_PORTS_FILTERED_IDENTICALLY",
                "description": "All HTTPS ports filtered the same way with blocked SNI",
                "significance": "DPI inspects SNI on all TLS ports, not just 443"
            })
            print(f"{Colors.RED}✗ Pattern: ALL HTTPS ports filtered identically{Colors.RESET}")
            print(f"   DPI inspects TLS/SNI on ALL ports: {[r['port'] for r in https_blocked]}\n")

        # Check for port-based bypass
        if len(control_working) > 0 and len(blocked_filtered) < len(https_blocked):
            bypass_ports = [r["port"] for r in https_blocked if r.get("verdict") == "WORKING"]
            if bypass_ports:
                patterns.append({
                    "pattern": "PORT_BASED_BYPASS",
                    "description": f"Some ports bypass filtering: {bypass_ports}",
                    "significance": "Can use alternate ports to bypass SNI filter"
                })
                print(f"{Colors.GREEN}✓ Pattern: PORT-BASED BYPASS FOUND{Colors.RESET}")
                print(f"   Ports that bypass filter: {bypass_ports}\n")

        # Check filtering mechanism
        silent_drop = [r for r in https_blocked if r.get("verdict") == "SILENT_DROP"]
        tcp_reset = [r for r in https_blocked if r.get("verdict") == "TCP_RESET"]

        if len(silent_drop) > len(tcp_reset):
            patterns.append({
                "pattern": "SILENT_DROP_MECHANISM",
                "description": "Filter allows handshake, then silently drops packets",
                "significance": "Passive DPI - handshake completes, application data dropped"
            })
            print(f"{Colors.YELLOW}⚠ Filter Mechanism: SILENT DROP{Colors.RESET}")
            print(f"   Handshake completes, then application data blocked\n")
        elif len(tcp_reset) > 0:
            patterns.append({
                "pattern": "TCP_RESET_MECHANISM",
                "description": "Filter sends TCP RST packets",
                "significance": "Active DPI - connection torn down with RST"
            })
            print(f"{Colors.YELLOW}⚠ Filter Mechanism: TCP RESET{Colors.RESET}")
            print(f"   Active injection of RST packets\n")

        self.results["filtering_patterns"] = patterns

        # Generate recommendations
        print(f"{Colors.BOLD}RECOMMENDATIONS:{Colors.RESET}\n")

        if http_working:
            print(f"{Colors.YELLOW}1. HTTP plaintext works - but exposes traffic{Colors.RESET}")
            print(f"   Not recommended for production\n")

        if len(blocked_filtered) == len(https_blocked):
            print(f"{Colors.YELLOW}2. All HTTPS ports filtered identically{Colors.RESET}")
            print(f"   Port rotation will NOT bypass filter\n")

        print(f"{Colors.GREEN}3. Use 5+ label domain bypass{Colors.RESET}")
        print(f"   Deploy on custom domain: a.b.c.d.yourdomain.com\n")

    def save_results(self, output_file: str = None):
        """Save detailed results"""
        if not output_file:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = str(Path(__file__).resolve().parent / "reports" / "daily" / f"port_protocol_scan_{timestamp}.json")

        Path(output_file).parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)

        print(f"\n{Colors.GREEN}✓ Results saved to: {output_file}{Colors.RESET}")

def main():
    print(f"""
{Colors.BOLD}{Colors.CYAN}╔═══════════════════════════════════════════════════════════════════╗
║          CLOUDFLARE PORT & PROTOCOL SCANNER                       ║
║     Tests which ports and protocols are filtered by DPI           ║
╚═══════════════════════════════════════════════════════════════════╝{Colors.RESET}

{Colors.YELLOW}This tool will test:{Colors.RESET}
  • HTTP ports (80, 8080, etc.) - plaintext
  • HTTPS ports (443, 8443, 2053, 2083, 2087, 2096, etc.)
  • UDP ports (HTTP/3 QUIC)
  • DNS ports (53, 853)

{Colors.YELLOW}Test matrix:{Colors.RESET}
  • Control SNI (cloudflare.com) - should work
  • Blocked SNI (test.workers.dev) - 3 labels, blocked on MCI
  • Port-by-port comparison to identify filtering patterns

{Colors.YELLOW}Based on investigation findings:{Colors.RESET}
  • Port 80 (HTTP) works without SNI
  • All HTTPS ports (443, 2053, 2083, 2087, 2096, 8443) filtered identically
  • Filter inspects TLS SNI, not port number

    """)

    response = "y" if "--yes" in sys.argv else input(f"{Colors.BOLD}Start scan? (y/n): {Colors.RESET}").lower().strip()

    if response != 'y':
        print(f"\n{Colors.CYAN}Cancelled.{Colors.RESET}")
        return

    scanner = CloudflarePortProtocolScanner()

    # Run comprehensive scan
    start_time = time.time()
    scanner.run_comprehensive_scan()

    # Analyze patterns
    scanner.analyze_patterns()

    duration = time.time() - start_time
    print(f"\n{Colors.CYAN}Scan completed in {duration:.1f} seconds{Colors.RESET}")

    # Save results
    scanner.save_results()

if __name__ == "__main__":
    main()
