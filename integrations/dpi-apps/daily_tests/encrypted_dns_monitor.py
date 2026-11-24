#!/usr/bin/env python3
"""
Encrypted DNS Monitor
Tests DoH/DoT availability across multiple resolvers
Tests both hostname-based and IP-literal addressing
Based on findings: DoH by IP literal works, DoH by hostname blocked
"""

from pathlib import Path
import os
import socket
import ssl
import time
import json
import struct
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import urllib.request
import urllib.error

# DoH resolvers to test (by hostname - expected to be blocked)
DOH_RESOLVERS_BY_NAME = [
    ("Google DNS", "https://dns.google/dns-query"),
    ("Cloudflare DNS", "https://cloudflare-dns.com/dns-query"),
    ("Cloudflare 1.1.1.1", "https://one.one.one.one/dns-query"),
    ("Quad9", "https://dns.quad9.net/dns-query"),
    ("AdGuard", "https://dns.adguard-dns.com/dns-query"),
]

# DoH resolvers by IP literal (expected to work on one ISP, blocked on another)
DOH_RESOLVERS_BY_IP = [
    ("Google 8.8.8.8", "https://8.8.8.8/dns-query", "MCI"),
    ("Google 8.8.4.4", "https://8.8.4.4/dns-query", "MCI"),
    ("Cloudflare 1.1.1.1", "https://1.1.1.1/dns-query", "Rightel"),
    ("Cloudflare 1.0.0.1", "https://1.0.0.1/dns-query", "Neither"),
]

# DoT resolvers (port 853 - expected to be blocked)
DOT_RESOLVERS = [
    ("Cloudflare", "1.1.1.1", 853),
    ("Google", "8.8.8.8", 853),
    ("Quad9", "9.9.9.9", 853),
    ("AdGuard", "94.140.14.14", 853),
]

class EncryptedDNSMonitor:
    def __init__(self, output_dir: str = str(Path(__file__).resolve().parent.parent / "reports" / "daily")):
        self.output_dir = output_dir
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "doh_by_hostname": [],
            "doh_by_ip": [],
            "dot_status": [],
            "working_resolvers": [],
            "summary": {}
        }
        self.timeout = 5

    def create_dns_query(self, domain: str = "example.com") -> bytes:
        """Create a simple DNS query for testing"""
        # Simple DNS query for A record of example.com
        query = b'\x00\x00'  # Transaction ID
        query += b'\x01\x00'  # Flags: standard query
        query += b'\x00\x01'  # Questions: 1
        query += b'\x00\x00'  # Answer RRs: 0
        query += b'\x00\x00'  # Authority RRs: 0
        query += b'\x00\x00'  # Additional RRs: 0

        # Question section
        for part in domain.split('.'):
            query += bytes([len(part)]) + part.encode()
        query += b'\x00'  # End of QNAME
        query += b'\x00\x01'  # Type A
        query += b'\x00\x01'  # Class IN

        return query

    def test_doh_by_hostname(self, name: str, url: str) -> Dict:
        """Test DoH resolver by hostname (expected to be blocked)"""
        result = {
            "name": name,
            "url": url,
            "method": "hostname",
            "accessible": False,
            "response_time_ms": 0,
            "status_code": 0,
            "error": None,
            "verdict": "UNKNOWN"
        }

        start_time = time.time()

        try:
            # Create DNS query
            dns_query = self.create_dns_query("example.com")

            # Make DoH request
            req = urllib.request.Request(
                url,
                data=dns_query,
                headers={
                    'Content-Type': 'application/dns-message',
                    'Accept': 'application/dns-message'
                },
                method='POST'
            )

            response = urllib.request.urlopen(req, timeout=self.timeout)

            response_time = time.time()
            result["response_time_ms"] = int((response_time - start_time) * 1000)
            result["status_code"] = response.getcode()

            # If we got a response, it's accessible
            if response.getcode() == 200:
                result["accessible"] = True
                result["verdict"] = "ACCESSIBLE"
            else:
                result["verdict"] = "HTTP_ERROR"

        except urllib.error.URLError as e:
            result["error"] = str(e.reason)
            if "timeout" in str(e).lower():
                result["verdict"] = "TIMEOUT"
            elif "reset" in str(e).lower() or "connection reset" in str(e).lower():
                result["verdict"] = "TCP_RESET"
            else:
                result["verdict"] = "BLOCKED"

        except socket.timeout:
            result["verdict"] = "TIMEOUT"
            result["error"] = "Connection timeout"

        except Exception as e:
            result["error"] = str(e)
            result["verdict"] = "ERROR"

        return result

    def test_doh_by_ip(self, name: str, url: str, works_on_isp: str) -> Dict:
        """Test DoH resolver by IP literal"""
        result = {
            "name": name,
            "url": url,
            "method": "ip_literal",
            "expected_working_on": works_on_isp,
            "accessible": False,
            "response_time_ms": 0,
            "status_code": 0,
            "answers_received": 0,
            "error": None,
            "verdict": "UNKNOWN"
        }

        start_time = time.time()

        try:
            # Create DNS query
            dns_query = self.create_dns_query("cloudflare.com")

            # Create SSL context that accepts IP-based certificates
            ctx = ssl.create_default_context()

            # Make DoH request
            req = urllib.request.Request(
                url,
                data=dns_query,
                headers={
                    'Content-Type': 'application/dns-message',
                    'Accept': 'application/dns-message'
                },
                method='POST'
            )

            response = urllib.request.urlopen(req, timeout=self.timeout, context=ctx)

            response_time = time.time()
            result["response_time_ms"] = int((response_time - start_time) * 1000)
            result["status_code"] = response.getcode()

            if response.getcode() == 200:
                result["accessible"] = True
                result["verdict"] = "WORKING"

                # Try to parse DNS response
                try:
                    dns_response = response.read()
                    # Simple check: DNS response should have answers
                    if len(dns_response) > 12:  # Minimum DNS response size
                        # Extract answer count from DNS header
                        answer_count = struct.unpack('!H', dns_response[6:8])[0]
                        result["answers_received"] = answer_count
                except:
                    pass
            else:
                result["verdict"] = "HTTP_ERROR"

        except urllib.error.URLError as e:
            result["error"] = str(e.reason)
            if "timeout" in str(e).lower():
                result["verdict"] = "TIMEOUT_BLOCKED"
            elif "reset" in str(e).lower():
                result["verdict"] = "TCP_RESET"
            else:
                result["verdict"] = "BLOCKED"

        except socket.timeout:
            result["verdict"] = "TIMEOUT_BLOCKED"
            result["error"] = "Connection timeout"

        except Exception as e:
            result["error"] = str(e)
            result["verdict"] = "ERROR"

        return result

    def test_dot_resolver(self, name: str, ip: str, port: int) -> Dict:
        """Test DNS-over-TLS resolver (expected to be blocked on port 853)"""
        result = {
            "name": name,
            "ip": ip,
            "port": port,
            "accessible": False,
            "handshake_completed": False,
            "response_time_ms": 0,
            "error": None,
            "verdict": "UNKNOWN"
        }

        start_time = time.time()
        sock = None
        ssl_sock = None

        try:
            # Create TCP socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.timeout)
            sock.connect((ip, port))

            # Wrap with TLS
            context = ssl.create_default_context()
            ssl_sock = context.wrap_socket(sock, server_hostname=None)

            response_time = time.time()
            result["response_time_ms"] = int((response_time - start_time) * 1000)
            result["handshake_completed"] = True

            # Try to send a DNS query
            dns_query = self.create_dns_query("example.com")
            query_with_length = struct.pack('!H', len(dns_query)) + dns_query
            ssl_sock.sendall(query_with_length)

            # Try to receive response
            response = ssl_sock.recv(4096)
            if response:
                result["accessible"] = True
                result["verdict"] = "WORKING"

        except socket.timeout:
            result["verdict"] = "TIMEOUT_BLOCKED"
            result["error"] = "Connection timeout"

        except ConnectionRefusedError:
            result["verdict"] = "CONNECTION_REFUSED"
            result["error"] = "Connection refused"

        except Exception as e:
            result["error"] = str(e)
            if result["handshake_completed"]:
                result["verdict"] = "POST_HANDSHAKE_FAILURE"
            else:
                result["verdict"] = "BLOCKED"

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

        return result

    def run_all_tests(self) -> Dict:
        """Run complete encrypted DNS monitoring suite"""
        print("Encrypted DNS Monitor - Starting tests...")
        print(f"Timestamp: {self.results['timestamp']}\n")

        # Test DoH by hostname (expected to be blocked)
        print("="*70)
        print("TEST 1: DoH by Hostname (Expected: BLOCKED)")
        print("="*70)
        for name, url in DOH_RESOLVERS_BY_NAME:
            print(f"Testing: {name}")
            result = self.test_doh_by_hostname(name, url)
            print(f"  → {result['verdict']}")
            self.results["doh_by_hostname"].append(result)
            time.sleep(0.5)

        accessible_by_name = sum(1 for r in self.results["doh_by_hostname"] if r["accessible"])
        print(f"\nResult: {accessible_by_name}/{len(DOH_RESOLVERS_BY_NAME)} accessible by hostname")

        # Test DoH by IP literal (ISP-specific blocking)
        print("\n" + "="*70)
        print("TEST 2: DoH by IP Literal (ISP-Specific)")
        print("="*70)
        for name, url, isp in DOH_RESOLVERS_BY_IP:
            print(f"Testing: {name} (works on {isp})")
            result = self.test_doh_by_ip(name, url, isp)
            print(f"  → {result['verdict']} ({result['response_time_ms']}ms)")
            self.results["doh_by_ip"].append(result)

            if result["accessible"]:
                self.results["working_resolvers"].append({
                    "name": name,
                    "url": url,
                    "method": "doh_ip_literal"
                })

            time.sleep(0.5)

        working_by_ip = sum(1 for r in self.results["doh_by_ip"] if r["accessible"])
        print(f"\nResult: {working_by_ip}/{len(DOH_RESOLVERS_BY_IP)} accessible by IP literal")

        # Test DoT (expected to be blocked)
        print("\n" + "="*70)
        print("TEST 3: DNS-over-TLS Port 853 (Expected: BLOCKED)")
        print("="*70)
        for name, ip, port in DOT_RESOLVERS:
            print(f"Testing: {name} ({ip}:{port})")
            result = self.test_dot_resolver(name, ip, port)
            print(f"  → {result['verdict']}")
            self.results["dot_status"].append(result)
            time.sleep(0.5)

        working_dot = sum(1 for r in self.results["dot_status"] if r["accessible"])
        print(f"\nResult: {working_dot}/{len(DOT_RESOLVERS)} DoT resolvers accessible")

        # Generate summary
        self._generate_summary()

        return self.results

    def _generate_summary(self):
        """Generate summary statistics"""
        self.results["summary"] = {
            "doh_by_hostname_tested": len(DOH_RESOLVERS_BY_NAME),
            "doh_by_hostname_accessible": sum(1 for r in self.results["doh_by_hostname"] if r["accessible"]),
            "doh_by_hostname_blocked": sum(1 for r in self.results["doh_by_hostname"] if not r["accessible"]),
            "doh_by_ip_tested": len(DOH_RESOLVERS_BY_IP),
            "doh_by_ip_accessible": sum(1 for r in self.results["doh_by_ip"] if r["accessible"]),
            "dot_tested": len(DOT_RESOLVERS),
            "dot_accessible": sum(1 for r in self.results["dot_status"] if r["accessible"]),
            "total_working_resolvers": len(self.results["working_resolvers"]),
            "encrypted_dns_available": len(self.results["working_resolvers"]) > 0,
            "recommendation": self._generate_recommendation()
        }

    def _generate_recommendation(self) -> str:
        """Generate configuration recommendation based on results"""
        working = self.results["working_resolvers"]

        if not working:
            return "NO_ENCRYPTED_DNS_AVAILABLE - Use system DNS with caution"
        elif len(working) == 1:
            return f"SINGLE_RESOLVER_AVAILABLE - Configure: {working[0]['url']}"
        else:
            urls = [w['url'] for w in working]
            return f"MULTI_RESOLVER_AVAILABLE - Configure failover: {', '.join(urls)}"

    def save_report(self):
        """Save results to JSON file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{self.output_dir}\\encrypted_dns_{timestamp}.json"

        Path(filename).parent.mkdir(parents=True, exist_ok=True)
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)

        print(f"\n✓ Report saved: {filename}")
        return filename

def main():
    monitor = EncryptedDNSMonitor()
    results = monitor.run_all_tests()
    monitor.save_report()

    # Print summary
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    summary = results["summary"]
    print(f"DoH by Hostname: {summary['doh_by_hostname_accessible']}/{summary['doh_by_hostname_tested']} accessible")
    print(f"DoH by IP Literal: {summary['doh_by_ip_accessible']}/{summary['doh_by_ip_tested']} accessible")
    print(f"DoT Port 853: {summary['dot_accessible']}/{summary['dot_tested']} accessible")
    print(f"\nWorking Resolvers: {summary['total_working_resolvers']}")

    if results["working_resolvers"]:
        print("\nAvailable encrypted DNS:")
        for resolver in results["working_resolvers"]:
            print(f"  • {resolver['name']}: {resolver['url']}")

    print(f"\nRecommendation: {summary['recommendation']}")

if __name__ == "__main__":
    main()
