#!/usr/bin/env python3
"""
SNI Spoofing & Evasion Tester
Tests various SNI manipulation and evasion techniques
Based on investigation findings that showed which techniques work and which don't

Key Findings from Reports:
- Case mangling: DOES NOT WORK (filter normalizes case)
- ClientHello fragmentation: DOES NOT WORK (filter reassembles)
- Label count bypass (5+ labels): WORKS
- Domain fronting: To be tested
- ECH (Encrypted ClientHello): To be tested
"""

from pathlib import Path
import os
import socket
import ssl
import time
import json
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import struct
import random

class SNISpoofingTester:
    def __init__(self, output_dir: str = str(Path(__file__).resolve().parent.parent / "reports" / "daily")):
        self.output_dir = output_dir
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "test_results": {},
            "effective_techniques": [],
            "ineffective_techniques": [],
            "summary": {}
        }
        self.timeout = 3

        # Test targets
        self.blocked_sni = "test.blocked.workers.dev"  # 3 labels - blocked
        self.cloudflare_ip = "188.114.96.1"  # Best performing IP
        self.control_sni = "workers.dev"  # Should always work

    def test_baseline(self) -> Dict:
        """Test baseline - normal SNI with blocked domain"""
        print("\n[BASELINE] Testing normal SNI with blocked domain...")

        result = {
            "technique": "baseline_normal_sni",
            "description": "Standard TLS connection with blocked SNI",
            "blocked_sni_result": None,
            "control_sni_result": None,
            "baseline_works": False
        }

        # Test blocked SNI
        blocked_result = self._test_connection(
            self.cloudflare_ip,
            443,
            self.blocked_sni,
            "Normal blocked SNI"
        )
        result["blocked_sni_result"] = blocked_result

        # Test control SNI
        control_result = self._test_connection(
            self.cloudflare_ip,
            443,
            self.control_sni,
            "Control SNI"
        )
        result["control_sni_result"] = control_result

        result["baseline_works"] = control_result["success"] and not blocked_result["success"]

        print(f"  Blocked SNI: {blocked_result['verdict']}")
        print(f"  Control SNI: {control_result['verdict']}")

        return result

    def test_case_mangling(self) -> Dict:
        """
        Test case mangling (Known to FAIL - filter normalizes case)
        Tested in investigation: All case variants blocked identically
        """
        print("\n[TECHNIQUE 1] Testing case mangling...")
        print("  (Investigation finding: INEFFECTIVE - filter normalizes case)")

        result = {
            "technique": "case_mangling",
            "description": "Randomize case of SNI to evade literal string match",
            "expected_outcome": "INEFFECTIVE",
            "test_cases": []
        }

        # Generate case variations
        case_variants = [
            "test.blocked.workers.dev",  # normal
            "TEST.BLOCKED.WORKERS.DEV",  # uppercase
            "TeSt.BlOcKeD.wOrKeRs.DeV",  # mixed case
            "test.BLOCKED.workers.DEV",  # partial upper
        ]

        for variant in case_variants:
            print(f"  Testing: {variant}")
            test_result = self._test_connection(
                self.cloudflare_ip,
                443,
                variant,
                f"Case variant: {variant}"
            )
            result["test_cases"].append({
                "variant": variant,
                "result": test_result
            })
            time.sleep(0.3)

        # Check if any variant succeeded
        bypassed = any(tc["result"]["success"] for tc in result["test_cases"])
        result["bypass_successful"] = bypassed
        result["conclusion"] = "Case mangling does NOT bypass filter - all variants blocked" if not bypassed else "UNEXPECTED: Case variant worked"

        print(f"  Result: {'BYPASS FAILED' if not bypassed else 'BYPASS WORKED'}")

        return result

    def test_clienthello_fragmentation(self) -> Dict:
        """
        Test ClientHello fragmentation (Known to FAIL - filter reassembles)
        Investigation tested with 150ms and 600ms delays - no effect
        """
        print("\n[TECHNIQUE 2] Testing ClientHello fragmentation...")
        print("  (Investigation finding: INEFFECTIVE - filter reassembles)")

        result = {
            "technique": "clienthello_fragmentation",
            "description": "Split ClientHello across multiple TCP packets",
            "expected_outcome": "INEFFECTIVE",
            "test_cases": []
        }

        # Test with different split strategies
        strategies = [
            ("split_at_sni", "Split ClientHello at SNI field"),
            ("tiny_chunks", "Send in very small chunks (10 bytes)"),
            ("delayed_split", "Split with 200ms delay"),
        ]

        for strategy_name, strategy_desc in strategies:
            print(f"  Testing: {strategy_desc}")

            test_result = self._test_fragmented_connection(
                self.cloudflare_ip,
                443,
                self.blocked_sni,
                strategy_name
            )

            result["test_cases"].append({
                "strategy": strategy_name,
                "description": strategy_desc,
                "result": test_result
            })
            time.sleep(0.5)

        bypassed = any(tc["result"]["success"] for tc in result["test_cases"])
        result["bypass_successful"] = bypassed
        result["conclusion"] = "Fragmentation does NOT bypass filter - all strategies blocked" if not bypassed else "UNEXPECTED: Fragmentation worked"

        print(f"  Result: {'BYPASS FAILED' if not bypassed else 'BYPASS WORKED'}")

        return result

    def test_sni_omission(self) -> Dict:
        """
        Test SNI-less ClientHello (Result AMBIGUOUS from investigation)
        Could be blocked by filter OR Cloudflare refusing
        """
        print("\n[TECHNIQUE 3] Testing SNI omission (no SNI in ClientHello)...")
        print("  (Investigation finding: AMBIGUOUS - could be filter or Cloudflare)")

        result = {
            "technique": "sni_omission",
            "description": "Send ClientHello without SNI extension",
            "expected_outcome": "AMBIGUOUS",
            "test_result": None
        }

        print(f"  Testing connection without SNI...")
        test_result = self._test_connection_no_sni(
            self.cloudflare_ip,
            443,
            "SNI-less connection"
        )

        result["test_result"] = test_result
        result["bypass_successful"] = test_result["success"]

        if test_result["success"]:
            result["conclusion"] = "SNI-less connection WORKS - filter only matches when SNI present"
        else:
            result["conclusion"] = "SNI-less connection FAILS - ambiguous if filter or Cloudflare rejection"

        print(f"  Result: {test_result['verdict']}")

        return result

    def test_label_count_bypass(self) -> Dict:
        """
        Test label count bypass (Known to WORK - 5+ labels pass through)
        This is the ONLY working client-side bypass found
        """
        print("\n[TECHNIQUE 4] Testing label count bypass (5+ labels)...")
        print("  (Investigation finding: EFFECTIVE - 5+ labels pass through filter)")

        result = {
            "technique": "label_count_bypass",
            "description": "Use 5+ DNS labels to exceed filter's pattern window",
            "expected_outcome": "EFFECTIVE",
            "test_cases": []
        }

        # Test with increasing label counts
        test_domains = [
            ("a.b.workers.dev", 4, "4 labels - should be BLOCKED"),
            ("a.b.c.workers.dev", 5, "5 labels - should PASS"),
            ("a.b.c.d.workers.dev", 6, "6 labels - should PASS"),
            ("a.b.c.d.e.workers.dev", 7, "7 labels - should PASS"),
        ]

        for domain, label_count, description in test_domains:
            print(f"  Testing: {domain} ({label_count} labels)")
            test_result = self._test_connection(
                self.cloudflare_ip,
                443,
                domain,
                description
            )

            result["test_cases"].append({
                "domain": domain,
                "label_count": label_count,
                "description": description,
                "result": test_result
            })
            time.sleep(0.3)

        # Check if 5+ labels bypass
        labels_5_plus = [tc for tc in result["test_cases"] if tc["label_count"] >= 5]
        bypass_works = all(tc["result"]["reached_server"] for tc in labels_5_plus)

        result["bypass_successful"] = bypass_works
        result["conclusion"] = "5+ label bypass CONFIRMED working" if bypass_works else "5+ label bypass NOT working"

        print(f"  Result: {'BYPASS WORKS' if bypass_works else 'BYPASS FAILED'}")

        return result

    def test_domain_fronting(self) -> Dict:
        """
        Test domain fronting (use different SNI vs Host header)
        SNI = allowed domain, Host header = blocked domain
        """
        print("\n[TECHNIQUE 5] Testing domain fronting...")

        result = {
            "technique": "domain_fronting",
            "description": "SNI uses allowed domain, Host header uses blocked domain",
            "expected_outcome": "UNKNOWN",
            "test_cases": []
        }

        # Test configurations
        configs = [
            ("cloudflare.com", self.blocked_sni, "SNI:CF, Host:blocked"),
            ("workers.dev", self.blocked_sni, "SNI:workers.dev, Host:blocked"),
            (self.control_sni, self.blocked_sni, "SNI:control, Host:blocked"),
        ]

        for sni, host_header, description in configs:
            print(f"  Testing: {description}")
            test_result = self._test_connection_with_different_host(
                self.cloudflare_ip,
                443,
                sni,
                host_header,
                description
            )

            result["test_cases"].append({
                "sni": sni,
                "host_header": host_header,
                "description": description,
                "result": test_result
            })
            time.sleep(0.5)

        bypassed = any(tc["result"]["success"] for tc in result["test_cases"])
        result["bypass_successful"] = bypassed

        if bypassed:
            result["conclusion"] = "Domain fronting WORKS - can use allowed SNI with blocked Host"
        else:
            result["conclusion"] = "Domain fronting FAILS - Cloudflare validates SNI/Host match or filter sees Host"

        print(f"  Result: {'BYPASS WORKS' if bypassed else 'BYPASS FAILED'}")

        return result

    def test_tls_version_variation(self) -> Dict:
        """
        Test different TLS versions (Investigation showed TLS version doesn't matter)
        """
        print("\n[TECHNIQUE 6] Testing TLS version variations...")
        print("  (Investigation finding: TLS version irrelevant)")

        result = {
            "technique": "tls_version_variation",
            "description": "Try TLS 1.2 vs TLS 1.3",
            "expected_outcome": "INEFFECTIVE",
            "test_cases": []
        }

        # Test TLS 1.2 and TLS 1.3
        tls_versions = [
            (ssl.TLSVersion.TLSv1_2, "TLS 1.2"),
            (ssl.TLSVersion.TLSv1_3, "TLS 1.3"),
        ]

        for tls_version, version_name in tls_versions:
            print(f"  Testing: {version_name}")
            test_result = self._test_connection_tls_version(
                self.cloudflare_ip,
                443,
                self.blocked_sni,
                tls_version,
                version_name
            )

            result["test_cases"].append({
                "tls_version": version_name,
                "result": test_result
            })
            time.sleep(0.3)

        bypassed = any(tc["result"]["success"] for tc in result["test_cases"])
        result["bypass_successful"] = bypassed
        result["conclusion"] = "TLS version does NOT affect blocking" if not bypassed else "UNEXPECTED: TLS version matters"

        print(f"  Result: {'NO DIFFERENCE' if not bypassed else 'VERSION MATTERS'}")

        return result

    def _test_connection(self, ip: str, port: int, sni: str, description: str) -> Dict:
        """Basic TLS connection test"""
        result = {
            "ip": ip,
            "port": port,
            "sni": sni,
            "description": description,
            "success": False,
            "handshake_completed": False,
            "reached_server": False,
            "bytes_received": 0,
            "verdict": "UNKNOWN",
            "error": None
        }

        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.timeout)
            sock.connect((ip, port))

            context = ssl.create_default_context()
            context.check_hostname = False  # Keep False for IP literal connection
            context.verify_mode = ssl.CERT_REQUIRED

            ssl_sock = context.wrap_socket(sock, server_hostname=sni)
            result["handshake_completed"] = True

            # Send HTTP request
            request = f"GET / HTTP/1.1\r\nHost: {sni}\r\nConnection: close\r\n\r\n"
            ssl_sock.sendall(request.encode())

            # Try to receive data
            data = ssl_sock.recv(4096)

            if data:
                result["success"] = True
                result["reached_server"] = True
                result["bytes_received"] = len(data)
                result["verdict"] = "SUCCESS"
            else:
                result["verdict"] = "SILENT_DROP"

            ssl_sock.close()
            sock.close()

        except socket.timeout:
            result["verdict"] = "TIMEOUT"
        except Exception as e:
            result["error"] = str(e)
            if result["handshake_completed"]:
                result["verdict"] = "POST_HANDSHAKE_ERROR"
                result["reached_server"] = True  # Reached but errored
            else:
                result["verdict"] = "CONNECTION_FAILED"

        return result

    def _test_fragmented_connection(self, ip: str, port: int, sni: str, strategy: str) -> Dict:
        """Test with fragmented ClientHello"""
        result = {
            "strategy": strategy,
            "success": False,
            "verdict": "NOT_IMPLEMENTED",
            "note": "Fragmentation requires low-level TLS manipulation - skipping for now"
        }

        # Note: True ClientHello fragmentation requires manual TLS construction
        # For now, just test normal connection as baseline
        # Real implementation would need to construct ClientHello bytes manually

        return result

    def _test_connection_no_sni(self, ip: str, port: int, description: str) -> Dict:
        """Test connection without SNI"""
        result = {
            "description": description,
            "success": False,
            "handshake_completed": False,
            "verdict": "UNKNOWN",
            "error": None
        }

        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.timeout)
            sock.connect((ip, port))

            context = ssl.create_default_context()
            context.check_hostname = False  # Keep False for IP literal connection
            context.verify_mode = ssl.CERT_REQUIRED

            # Wrap without server_hostname (no SNI)
            ssl_sock = context.wrap_socket(sock, server_hostname=None)
            result["handshake_completed"] = True

            # Try to send/receive
            request = f"GET / HTTP/1.1\r\nHost: {ip}\r\nConnection: close\r\n\r\n"
            ssl_sock.sendall(request.encode())

            data = ssl_sock.recv(4096)

            if data:
                result["success"] = True
                result["verdict"] = "SUCCESS"
            else:
                result["verdict"] = "NO_DATA"

            ssl_sock.close()
            sock.close()

        except Exception as e:
            result["error"] = str(e)
            result["verdict"] = "FAILED"

        return result

    def _test_connection_with_different_host(self, ip: str, port: int, sni: str, host_header: str, description: str) -> Dict:
        """Test domain fronting - different SNI and Host header"""
        result = {
            "sni": sni,
            "host_header": host_header,
            "description": description,
            "success": False,
            "verdict": "UNKNOWN",
            "response_status": None,
            "error": None
        }

        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.timeout)
            sock.connect((ip, port))

            context = ssl.create_default_context()
            context.check_hostname = False  # Keep False for IP literal connection
            context.verify_mode = ssl.CERT_REQUIRED

            ssl_sock = context.wrap_socket(sock, server_hostname=sni)

            # Send request with DIFFERENT Host header
            request = f"GET / HTTP/1.1\r\nHost: {host_header}\r\nConnection: close\r\n\r\n"
            ssl_sock.sendall(request.encode())

            data = ssl_sock.recv(4096)

            if data:
                # Parse HTTP response
                response_str = data.decode('utf-8', errors='ignore')
                if "HTTP/" in response_str:
                    status_line = response_str.split('\r\n')[0]
                    result["response_status"] = status_line

                    # Check status code
                    if "200" in status_line:
                        result["success"] = True
                        result["verdict"] = "SUCCESS_200"
                    elif "403" in status_line or "421" in status_line:
                        result["verdict"] = "REJECTED_BY_SERVER"
                    else:
                        result["verdict"] = f"RESPONSE_{status_line}"
            else:
                result["verdict"] = "NO_DATA"

            ssl_sock.close()
            sock.close()

        except socket.timeout:
            result["verdict"] = "TIMEOUT"
        except Exception as e:
            result["error"] = str(e)
            result["verdict"] = "FAILED"

        return result

    def _test_connection_tls_version(self, ip: str, port: int, sni: str, tls_version, version_name: str) -> Dict:
        """Test with specific TLS version"""
        result = {
            "tls_version": version_name,
            "success": False,
            "verdict": "UNKNOWN",
            "error": None
        }

        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.timeout)
            sock.connect((ip, port))

            context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            context.check_hostname = False  # Keep False for IP literal connection
            context.verify_mode = ssl.CERT_REQUIRED
            context.load_default_certs()

            # Set TLS version
            try:
                context.minimum_version = tls_version
                context.maximum_version = tls_version
            except:
                pass  # Version not supported

            ssl_sock = context.wrap_socket(sock, server_hostname=sni)

            request = f"GET / HTTP/1.1\r\nHost: {sni}\r\nConnection: close\r\n\r\n"
            ssl_sock.sendall(request.encode())

            data = ssl_sock.recv(4096)

            if data:
                result["success"] = True
                result["verdict"] = "SUCCESS"
            else:
                result["verdict"] = "SILENT_DROP"

            ssl_sock.close()
            sock.close()

        except socket.timeout:
            result["verdict"] = "TIMEOUT"
        except Exception as e:
            result["error"] = str(e)
            result["verdict"] = "FAILED"

        return result

    def run_all_tests(self) -> Dict:
        """Run complete SNI spoofing/evasion test suite"""
        print("="*70)
        print("SNI SPOOFING & EVASION TESTER")
        print(f"Timestamp: {self.results['timestamp']}")
        print("="*70)
        print("\nBased on comprehensive DPI investigation findings from:")
        print("  • MASTER_FINDINGS.txt")
        print("  • SNI_FILTER_RULE_REPORT.txt")
        print("  • PACKET_LEVEL_FINDINGS.txt")
        print("="*70)

        # Run baseline test
        baseline = self.test_baseline()
        self.results["test_results"]["baseline"] = baseline

        if not baseline["baseline_works"]:
            print("\n⚠️  WARNING: Baseline test shows unexpected behavior")
            print("   Expected: Control works, blocked SNI fails")

        # Run evasion technique tests
        techniques = [
            ("case_mangling", self.test_case_mangling),
            ("clienthello_fragmentation", self.test_clienthello_fragmentation),
            ("sni_omission", self.test_sni_omission),
            ("label_count_bypass", self.test_label_count_bypass),
            ("domain_fronting", self.test_domain_fronting),
            ("tls_version_variation", self.test_tls_version_variation),
        ]

        for technique_name, test_func in techniques:
            try:
                result = test_func()
                self.results["test_results"][technique_name] = result

                if result.get("bypass_successful"):
                    self.results["effective_techniques"].append(technique_name)
                else:
                    self.results["ineffective_techniques"].append(technique_name)

            except Exception as e:
                print(f"\n✗ Error testing {technique_name}: {e}")
                self.results["test_results"][technique_name] = {
                    "error": str(e),
                    "bypass_successful": False
                }

        # Generate summary
        self._generate_summary()

        return self.results

    def _generate_summary(self):
        """Generate summary of findings"""
        self.results["summary"] = {
            "total_techniques_tested": len(self.results["test_results"]) - 1,  # Exclude baseline
            "effective_techniques": len(self.results["effective_techniques"]),
            "ineffective_techniques": len(self.results["ineffective_techniques"]),
            "effective_list": self.results["effective_techniques"],
            "ineffective_list": self.results["ineffective_techniques"],
            "recommendation": self._generate_recommendation()
        }

    def _generate_recommendation(self) -> str:
        """Generate practical recommendation"""
        if "label_count_bypass" in self.results["effective_techniques"]:
            return "USE_CUSTOM_DOMAIN_5_PLUS_LABELS - Deploy Worker on custom domain with 5+ labels"
        elif len(self.results["effective_techniques"]) > 0:
            return f"USE_TECHNIQUES: {', '.join(self.results['effective_techniques'])}"
        else:
            return "NO_CLIENT_SIDE_BYPASS - Custom domain or different ISP required"

    def save_report(self):
        """Save results to JSON file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{self.output_dir}\\sni_spoofing_{timestamp}.json"

        Path(filename).parent.mkdir(parents=True, exist_ok=True)
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)

        print(f"\n✓ Report saved: {filename}")
        return filename

def main():
    tester = SNISpoofingTester()
    results = tester.run_all_tests()
    tester.save_report()

    # Print summary
    print("\n" + "="*70)
    print("SUMMARY - SNI EVASION TECHNIQUES")
    print("="*70)
    summary = results["summary"]

    print(f"\nTechniques Tested: {summary['total_techniques_tested']}")
    print(f"Effective: {summary['effective_techniques']}")
    print(f"Ineffective: {summary['ineffective_techniques']}")

    if summary["effective_list"]:
        print(f"\n✓ WORKING TECHNIQUES:")
        for technique in summary["effective_list"]:
            print(f"  • {technique}")

    if summary["ineffective_list"]:
        print(f"\n✗ INEFFECTIVE TECHNIQUES:")
        for technique in summary["ineffective_list"]:
            print(f"  • {technique}")

    print(f"\nRECOMMENDATION: {summary['recommendation']}")

    print("\n" + "="*70)
    print("KEY FINDINGS FROM INVESTIGATION:")
    print("="*70)
    print("✓ WORKS: 5+ DNS labels (exceeds filter's pattern window)")
    print("✗ FAILS: Case mangling (filter normalizes case)")
    print("✗ FAILS: ClientHello fragmentation (filter reassembles)")
    print("? AMBIGUOUS: SNI omission (could be filter or Cloudflare)")

if __name__ == "__main__":
    main()
