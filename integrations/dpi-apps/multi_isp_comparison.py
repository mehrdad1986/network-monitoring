#!/usr/bin/env python3
"""
Multi-ISP Comparison Tool
Compares filtering behavior across different ISPs
Detects ISP-specific vs national-level censorship
Based on findings: MCI blocks workers.dev, Rightel does not
"""

from pathlib import Path
import os
import json
import socket
import ssl
import time
from datetime import datetime
from typing import Dict, List, Optional
import subprocess

class MultiISPComparison:
    def __init__(self, output_dir: str = str(Path(__file__).resolve().parent / "reports" / "daily")):
        self.output_dir = output_dir
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "current_isp": {},
            "workers_dev_status": {},
            "national_censorship": {},
            "isp_specific_censorship": {},
            "sinkhole_fingerprint": None,
            "summary": {}
        }
        self.timeout = 3

    def detect_current_isp(self) -> Dict:
        """Detect current ISP from public IP and routing"""
        isp_info = {
            "public_ip": None,
            "asn": None,
            "isp_name": "UNKNOWN",
            "likely_isp": "UNKNOWN"
        }

        try:
            # Get public IP (multiple services for reliability)
            services = [
                "https://api.ipify.org",
                "https://ifconfig.me/ip",
                "https://icanhazip.com"
            ]

            for service in services:
                try:
                    import urllib.request
                    req = urllib.request.Request(service, headers={'User-Agent': 'curl/7.68.0'})
                    response = urllib.request.urlopen(req, timeout=5)
                    public_ip = response.read().decode().strip()
                    if public_ip:
                        isp_info["public_ip"] = public_ip
                        break
                except:
                    continue

            # Detect ISP from IP range (based on investigation findings)
            if isp_info["public_ip"]:
                ip = isp_info["public_ip"]

                # MCI: 188.210.x.x range
                if ip.startswith("188.210."):
                    isp_info["likely_isp"] = "MCI"
                    isp_info["asn"] = "AS197207"
                    isp_info["isp_name"] = "Mobile Communication Company of Iran PLC (MCCI)"

                # Rightel: 37.137.x.x range
                elif ip.startswith("37.137."):
                    isp_info["likely_isp"] = "Rightel"
                    isp_info["asn"] = "AS57218"
                    isp_info["isp_name"] = "Rightel Communication Service Company PJS"

        except Exception as e:
            isp_info["error"] = str(e)

        return isp_info

    def test_workers_dev_blocking(self) -> Dict:
        """Test if workers.dev is blocked (ISP-specific on MCI)"""
        test_cases = [
            ("workers.dev", 2, "apex"),
            ("a.workers.dev", 3, "3-label"),
            ("a.b.workers.dev", 4, "4-label"),
            ("a.b.c.workers.dev", 5, "5-label"),
        ]

        results = {
            "tested": [],
            "blocked_count": 0,
            "total_tests": len(test_cases),
            "filter_active": False,
            "filter_pattern": "NONE"
        }

        cloudflare_ip = "188.114.96.1"

        for sni, label_count, test_type in test_cases:
            test_result = {
                "sni": sni,
                "label_count": label_count,
                "type": test_type,
                "blocked": False,
                "verdict": "UNKNOWN"
            }

            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(self.timeout)
                sock.connect((cloudflare_ip, 443))

                context = ssl.create_default_context()
                context.check_hostname = False  # Keep False for IP literal connection
                context.verify_mode = ssl.CERT_REQUIRED

                ssl_sock = context.wrap_socket(sock, server_hostname=sni)

                # Send HTTP request
                request = f"GET / HTTP/1.1\r\nHost: {sni}\r\nConnection: close\r\n\r\n"
                ssl_sock.sendall(request.encode())

                # Try to receive data
                data = ssl_sock.recv(4096)

                if data:
                    test_result["verdict"] = "SERVED"
                    test_result["blocked"] = False
                else:
                    test_result["verdict"] = "SILENT_DROP"
                    test_result["blocked"] = True

                ssl_sock.close()
                sock.close()

            except socket.timeout:
                test_result["verdict"] = "TIMEOUT"
                test_result["blocked"] = True

            except Exception as e:
                test_result["verdict"] = "ERROR"
                test_result["error"] = str(e)

            results["tested"].append(test_result)

            if test_result["blocked"]:
                results["blocked_count"] += 1

            time.sleep(0.5)

        # Determine filter pattern
        if results["blocked_count"] == 0:
            results["filter_pattern"] = "NONE_NO_BLOCKING"
            results["filter_active"] = False
        elif results["blocked_count"] == len(test_cases):
            results["filter_pattern"] = "ALL_BLOCKED"
            results["filter_active"] = True
        else:
            # Check for label-count pattern (3-4 labels blocked)
            blocked_labels = [r["label_count"] for r in results["tested"] if r["blocked"]]
            if 3 in blocked_labels and 4 in blocked_labels and 5 not in blocked_labels:
                results["filter_pattern"] = "LABEL_COUNT_3_4_BLOCKED"
                results["filter_active"] = True
            else:
                results["filter_pattern"] = "PARTIAL_UNKNOWN"
                results["filter_active"] = True

        return results

    def test_national_censorship(self) -> Dict:
        """Test censorship that applies across all ISPs"""
        national_targets = [
            "facebook.com",
            "instagram.com",
            "youtube.com",
            "x.com"
        ]

        results = {
            "dns_poisoning": [],
            "sinkhole_ips": set(),
            "all_poisoned": False
        }

        for domain in national_targets:
            try:
                # Query DNS
                import socket
                ip = socket.gethostbyname(domain)

                is_sinkhole = ip.startswith("10.10.34.")

                results["dns_poisoning"].append({
                    "domain": domain,
                    "resolved_ip": ip,
                    "is_sinkhole": is_sinkhole
                })

                if is_sinkhole:
                    results["sinkhole_ips"].add(ip)

            except Exception as e:
                results["dns_poisoning"].append({
                    "domain": domain,
                    "error": str(e)
                })

        # Check if all are poisoned
        poisoned_count = sum(1 for r in results["dns_poisoning"] if r.get("is_sinkhole", False))
        results["all_poisoned"] = poisoned_count == len(national_targets)
        results["poisoned_count"] = poisoned_count
        results["sinkhole_ips"] = list(results["sinkhole_ips"])

        return results

    def detect_sinkhole_fingerprint(self, sinkhole_ips: List[str]) -> Optional[str]:
        """
        Detect ISP fingerprint from sinkhole last octet
        MCI: 10.10.34.36
        Rightel: 10.10.34.35
        """
        if not sinkhole_ips:
            return None

        for ip in sinkhole_ips:
            if ip == "10.10.34.36":
                return "MCI_FINGERPRINT"
            elif ip == "10.10.34.35":
                return "RIGHTEL_FINGERPRINT"
            elif ip == "10.10.34.34":
                return "UNKNOWN_ISP_FINGERPRINT"

        return "CUSTOM_SINKHOLE"

    def compare_with_historical_data(self) -> Dict:
        """Compare current results with historical investigation findings"""
        comparison = {
            "matches_mci_profile": False,
            "matches_rightel_profile": False,
            "confidence": "LOW"
        }

        # MCI profile: workers.dev blocked, sinkhole .36
        if (self.results["workers_dev_status"].get("filter_active") and
            self.results["sinkhole_fingerprint"] == "MCI_FINGERPRINT"):
            comparison["matches_mci_profile"] = True
            comparison["confidence"] = "HIGH"

        # Rightel profile: workers.dev NOT blocked, sinkhole .35
        if (not self.results["workers_dev_status"].get("filter_active") and
            self.results["sinkhole_fingerprint"] == "RIGHTEL_FINGERPRINT"):
            comparison["matches_rightel_profile"] = True
            comparison["confidence"] = "HIGH"

        return comparison

    def run_all_tests(self) -> Dict:
        """Run complete ISP comparison suite"""
        print("Multi-ISP Comparison Tool - Starting tests...")
        print(f"Timestamp: {self.results['timestamp']}\n")

        # Detect current ISP
        print("="*70)
        print("ISP DETECTION")
        print("="*70)
        isp_info = self.detect_current_isp()
        self.results["current_isp"] = isp_info
        print(f"Public IP: {isp_info.get('public_ip', 'UNKNOWN')}")
        print(f"Detected ISP: {isp_info.get('likely_isp', 'UNKNOWN')}")
        print(f"ASN: {isp_info.get('asn', 'UNKNOWN')}")

        # Test workers.dev blocking (ISP-specific)
        print("\n" + "="*70)
        print("ISP-SPECIFIC: workers.dev Blocking Test")
        print("="*70)
        workers_status = self.test_workers_dev_blocking()
        self.results["workers_dev_status"] = workers_status
        print(f"Filter Active: {'YES' if workers_status['filter_active'] else 'NO'}")
        print(f"Filter Pattern: {workers_status['filter_pattern']}")
        print(f"Blocked: {workers_status['blocked_count']}/{workers_status['total_tests']}")

        # Test national censorship
        print("\n" + "="*70)
        print("NATIONAL-LEVEL: DNS Poisoning Test")
        print("="*70)
        national_status = self.test_national_censorship()
        self.results["national_censorship"] = national_status
        print(f"Poisoned domains: {national_status['poisoned_count']}/{len(national_status['dns_poisoning'])}")

        if national_status["sinkhole_ips"]:
            print(f"Sinkhole IPs detected: {', '.join(national_status['sinkhole_ips'])}")
            fingerprint = self.detect_sinkhole_fingerprint(national_status["sinkhole_ips"])
            self.results["sinkhole_fingerprint"] = fingerprint
            print(f"ISP Fingerprint: {fingerprint}")

        # Compare with historical data
        print("\n" + "="*70)
        print("PROFILE MATCHING")
        print("="*70)
        comparison = self.compare_with_historical_data()
        self.results["profile_match"] = comparison

        if comparison["matches_mci_profile"]:
            print("✓ Matches MCI profile (workers.dev blocked, sinkhole .36)")
        elif comparison["matches_rightel_profile"]:
            print("✓ Matches Rightel profile (workers.dev open, sinkhole .35)")
        else:
            print("⚠ Does not match known ISP profiles")

        print(f"Confidence: {comparison['confidence']}")

        # Generate summary
        self._generate_summary()

        return self.results

    def _generate_summary(self):
        """Generate summary statistics"""
        self.results["summary"] = {
            "detected_isp": self.results["current_isp"].get("likely_isp", "UNKNOWN"),
            "workers_dev_blocked": self.results["workers_dev_status"].get("filter_active", False),
            "national_censorship_active": self.results["national_censorship"].get("all_poisoned", False),
            "sinkhole_fingerprint": self.results.get("sinkhole_fingerprint", "NONE"),
            "profile_match": self.results.get("profile_match", {}).get("confidence", "LOW"),
            "censorship_layers": self._count_censorship_layers()
        }

    def _count_censorship_layers(self) -> int:
        """Count how many censorship layers are active"""
        layers = 0

        # DNS poisoning layer
        if self.results["national_censorship"].get("all_poisoned"):
            layers += 1

        # SNI filtering layer
        if self.results["workers_dev_status"].get("filter_active"):
            layers += 1

        return layers

    def save_report(self):
        """Save results to JSON file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = os.path.join(self.output_dir, f"isp_comparison_{timestamp}.json")

        Path(filename).parent.mkdir(parents=True, exist_ok=True)
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)

        print(f"\n✓ Report saved: {filename}")
        return filename

def main():
    comparison = MultiISPComparison()
    results = comparison.run_all_tests()
    comparison.save_report()

    # Print summary
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    summary = results["summary"]
    print(f"Detected ISP: {summary['detected_isp']}")
    print(f"workers.dev Blocked: {'YES' if summary['workers_dev_blocked'] else 'NO'}")
    print(f"National Censorship: {'ACTIVE' if summary['national_censorship_active'] else 'INACTIVE'}")
    print(f"Sinkhole Fingerprint: {summary['sinkhole_fingerprint']}")
    print(f"Profile Match: {summary['profile_match']}")
    print(f"Censorship Layers: {summary['censorship_layers']}")

if __name__ == "__main__":
    main()
