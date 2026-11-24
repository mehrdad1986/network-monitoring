#!/usr/bin/env python3
"""
SNI Filter Tester
Tests workers.dev SNI-based blocking with label-count variations
Measures TLS handshake completion vs application data delivery
Based on findings: 2-4 labels blocked, 5+ labels pass through
"""

from pathlib import Path
import os
import ssl
import socket
import time
import json
from datetime import datetime
from typing import Dict, List, Tuple, Optional

# Test configurations from investigation
CLOUDFLARE_IPS = [
    "188.114.96.1",  # Best performer: 187ms, 0% loss
    "188.114.96.3",
    "188.114.97.3",
    "104.21.28.168"
]

# SNI test matrix (label count variations)
SNI_TEST_MATRIX = [
    # Control - should PASS
    ("workers.dev", 2, "CONTROL_APEX"),
    ("cloudflare.com", 2, "CONTROL_CF"),

    # Blocked range (3-4 labels)
    ("a.workers.dev", 3, "BLOCKED_EXPECTED"),
    ("a.b.workers.dev", 4, "BLOCKED_EXPECTED"),
    ("test.subdomain.workers.dev", 4, "BLOCKED_EXPECTED"),

    # Pass-through range (5+ labels)
    ("a.b.c.workers.dev", 5, "PASSTHROUGH_EXPECTED"),
    ("a.b.c.d.workers.dev", 6, "PASSTHROUGH_EXPECTED"),
    ("a.b.c.d.e.workers.dev", 7, "PASSTHROUGH_EXPECTED"),

    # Real workers (if exists, will be blocked)
    ("test-deployment-9999.workers.dev", 3, "REAL_WORKER_TEST"),
]

# Alternate TLS ports
TLS_PORTS = [443, 2053, 2083, 2087, 2096, 8443]

class SNIFilterTester:
    def __init__(self, output_dir: str = str(Path(__file__).resolve().parent.parent / "reports" / "daily")):
        self.output_dir = output_dir
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "test_matrix_results": [],
            "port_analysis": [],
            "timing_analysis": [],
            "summary": {}
        }
        self.timeout = 2.5  # Fast-fail as recommended

    def create_tls_context(self, sni_hostname: Optional[str] = None) -> ssl.SSLContext:
        """Create TLS context with optional SNI"""
        context = ssl.create_default_context()
        context.check_hostname = False  # Keep False for IP literal connection
        context.verify_mode = ssl.CERT_REQUIRED  # For testing only
        return context

    def test_sni_blocking(self, ip: str, port: int, sni: str, expected_behavior: str) -> Dict:
        """
        Test single SNI against DPI filter
        Returns detailed metrics about handshake and application data
        """
        result = {
            "sni": sni,
            "label_count": sni.count('.') + 1,
            "ip": ip,
            "port": port,
            "expected_behavior": expected_behavior,
            "handshake_completed": False,
            "application_data_received": False,
            "bytes_received": 0,
            "handshake_time_ms": 0,
            "total_time_ms": 0,
            "verdict": "UNKNOWN",
            "error": None
        }

        start_time = time.time()
        sock = None
        ssl_sock = None

        try:
            # Create TCP connection
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.timeout)
            sock.connect((ip, port))

            # TLS handshake with SNI
            context = self.create_tls_context()
            ssl_sock = context.wrap_socket(sock, server_hostname=sni)

            handshake_time = time.time()
            result["handshake_completed"] = True
            result["handshake_time_ms"] = int((handshake_time - start_time) * 1000)

            # Try to send HTTP request and receive data
            request = f"GET / HTTP/1.1\r\nHost: {sni}\r\nConnection: close\r\n\r\n"
            ssl_sock.sendall(request.encode())

            # Try to receive application data
            data = ssl_sock.recv(4096)

            if data:
                result["application_data_received"] = True
                result["bytes_received"] = len(data)
                result["verdict"] = "SERVED"
            else:
                result["verdict"] = "SILENT_DROP"

            total_time = time.time()
            result["total_time_ms"] = int((total_time - start_time) * 1000)

        except socket.timeout:
            result["verdict"] = "TIMEOUT"
            result["error"] = "Connection timeout (DPI silent drop suspected)"

        except ssl.SSLError as e:
            result["error"] = f"SSL error: {str(e)}"
            if result["handshake_completed"]:
                result["verdict"] = "TLS_ERROR_POST_HANDSHAKE"
            else:
                result["verdict"] = "TLS_HANDSHAKE_FAILED"

        except ConnectionResetError:
            result["verdict"] = "TCP_RESET"
            result["error"] = "Connection reset by peer (active blocking)"

        except Exception as e:
            result["verdict"] = "ERROR"
            result["error"] = str(e)

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

        # Determine if behavior matches expectations
        result["matches_expectation"] = self._check_expectation(result, expected_behavior)

        return result

    def _check_expectation(self, result: Dict, expected: str) -> bool:
        """Check if result matches expected behavior"""
        if expected == "CONTROL_APEX" or expected == "CONTROL_CF":
            # Control should be served
            return result["verdict"] == "SERVED"
        elif expected == "BLOCKED_EXPECTED":
            # Should be blocked (timeout or silent drop)
            return result["verdict"] in ["TIMEOUT", "SILENT_DROP"]
        elif expected == "PASSTHROUGH_EXPECTED":
            # Should reach Cloudflare (may get 404 or TLS alert, but not timeout)
            return result["verdict"] == "SERVED"
        else:
            return True

    def test_port_independence(self, ip: str, sni: str) -> List[Dict]:
        """Test if blocking is port-independent across TLS ports"""
        results = []

        for port in TLS_PORTS:
            result = self.test_sni_blocking(ip, port, sni, "PORT_TEST")
            results.append(result)
            time.sleep(0.5)  # Small delay between tests

        return results

    def run_full_sni_matrix(self, ip: str = None) -> List[Dict]:
        """Run complete SNI label-count matrix test"""
        if not ip:
            ip = CLOUDFLARE_IPS[0]  # Use best performer

        print(f"Testing SNI filter matrix on {ip}:443...")
        results = []

        for sni, label_count, expected in SNI_TEST_MATRIX:
            print(f"  Testing: {sni} ({label_count} labels, expect: {expected})")
            result = self.test_sni_blocking(ip, 443, sni, expected)

            verdict_symbol = "✓" if result["matches_expectation"] else "✗"
            print(f"    {verdict_symbol} {result['verdict']} - {result['bytes_received']} bytes")

            results.append(result)
            time.sleep(0.3)  # Small delay

        return results

    def run_all_tests(self) -> Dict:
        """Run complete SNI filter test suite"""
        print("SNI Filter Tester - Starting tests...")
        print(f"Timestamp: {self.results['timestamp']}\n")

        # Main SNI matrix test
        print("="*70)
        print("TEST 1: SNI Label-Count Matrix")
        print("="*70)
        matrix_results = self.run_full_sni_matrix()
        self.results["test_matrix_results"] = matrix_results

        # Port independence test on blocked SNI
        print("\n" + "="*70)
        print("TEST 2: Port Independence (blocked SNI)")
        print("="*70)
        print("Testing if blocking applies to all TLS ports...")
        port_results = self.test_port_independence(CLOUDFLARE_IPS[0], "test.blocked.workers.dev")
        self.results["port_analysis"] = port_results

        blocked_ports = sum(1 for r in port_results if r["verdict"] in ["TIMEOUT", "SILENT_DROP"])
        print(f"  → {blocked_ports}/{len(TLS_PORTS)} ports blocked")

        # Analyze results
        self._generate_summary()

        return self.results

    def _generate_summary(self):
        """Generate summary statistics"""
        matrix = self.results["test_matrix_results"]

        # Count by expected behavior
        controls = [r for r in matrix if "CONTROL" in r["expected_behavior"]]
        blocked_range = [r for r in matrix if r["expected_behavior"] == "BLOCKED_EXPECTED"]
        passthrough_range = [r for r in matrix if r["expected_behavior"] == "PASSTHROUGH_EXPECTED"]

        self.results["summary"] = {
            "total_tests": len(matrix),
            "controls_passed": sum(1 for r in controls if r["matches_expectation"]),
            "controls_total": len(controls),
            "blocked_range_tests": len(blocked_range),
            "blocked_correctly": sum(1 for r in blocked_range if r["matches_expectation"]),
            "passthrough_tests": len(passthrough_range),
            "passthrough_correctly": sum(1 for r in passthrough_range if r["matches_expectation"]),
            "measurement_valid": any(r["verdict"] == "SERVED" for r in controls),
            "filter_active": (sum(1 for r in blocked_range if r["verdict"] in ["TIMEOUT", "SILENT_DROP"]) > 0) if any(r["verdict"] == "SERVED" for r in controls) else None,
            "filter_type": self._detect_filter_type(blocked_range)
        }

    def _detect_filter_type(self, blocked_results: List[Dict]) -> str:
        """Detect filter mechanism type"""
        if not blocked_results:
            return "NONE"

        verdicts = [r["verdict"] for r in blocked_results]

        if all(v == "TCP_RESET" for v in verdicts):
            return "TCP_RST_INJECTION"
        elif all(v in ["TIMEOUT", "SILENT_DROP"] for v in verdicts):
            return "SILENT_DROP_POST_HANDSHAKE"
        elif all(v == "TLS_HANDSHAKE_FAILED" for v in verdicts):
            return "TLS_HANDSHAKE_BLOCK"
        else:
            return "MIXED"

    def save_report(self):
        """Save results to JSON file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{self.output_dir}\\sni_filter_{timestamp}.json"

        Path(filename).parent.mkdir(parents=True, exist_ok=True)
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)

        print(f"\n✓ Report saved: {filename}")
        return filename

def main():
    tester = SNIFilterTester()
    results = tester.run_all_tests()
    tester.save_report()

    # Print summary
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    summary = results["summary"]
    print(f"Filter Active: {'INCONCLUSIVE' if summary['filter_active'] is None else 'YES' if summary['filter_active'] else 'NO'}")
    print(f"Filter Type: {summary['filter_type']}")
    print(f"Controls: {summary['controls_passed']}/{summary['controls_total']} passed")
    print(f"Blocked Range (3-4 labels): {summary['blocked_correctly']}/{summary['blocked_range_tests']} blocked")
    print(f"Passthrough Range (5+ labels): {summary['passthrough_correctly']}/{summary['passthrough_tests']} passed")

if __name__ == "__main__":
    main()
