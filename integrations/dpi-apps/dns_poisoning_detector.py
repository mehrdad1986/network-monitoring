#!/usr/bin/env python3
"""
DNS Poisoning Detector
Monitors DNS responses for censorship indicators based on DPI investigation findings
Detects sinkhole addresses, forged TTLs, and DNS manipulation patterns
"""

from pathlib import Path
import os
import dns.resolver
import dns.query
import dns.message
import socket
import time
import json
from datetime import datetime
from typing import Dict, List, Tuple

# Known sinkhole addresses from investigation
SINKHOLE_IPV4 = ["10.10.34.34", "10.10.34.35", "10.10.34.36"]
SINKHOLE_IPV6_PREFIX = "2001:4188:2:600:10:10:34:"

# Targets known to be DNS poisoned
CENSORED_DOMAINS = [
    "facebook.com",
    "instagram.com",
    "youtube.com",
    "x.com",
    "pages.dev",
    "trycloudflare.com"
]

# DoH resolver hostnames (blocked)
DOH_RESOLVER_NAMES = [
    "dns.google",
    "cloudflare-dns.com",
    "one.one.one.one",
    "dns.quad9.net",
    "dns.adguard-dns.com",
    "dns.alidns.com",
    "doh.pub",
    "dns.sb",
    "dns.mullvad.net"
]

# Control domains (should NOT be poisoned)
CONTROL_DOMAINS = [
    "workers.dev",
    "cloudflare.com",
    "go.dev",
    "rust-lang.org"
]

# DNS servers to test
DNS_SERVERS = [
    ("System Default", None),
    ("Google", "8.8.8.8"),
    ("Cloudflare", "1.1.1.1"),
    ("Quad9", "9.9.9.9")
]

class DNSPoisoningDetector:
    def __init__(self, output_dir: str = str(Path(__file__).resolve().parent / "reports" / "daily")):
        self.output_dir = output_dir
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "poisoned_domains": [],
            "clean_domains": [],
            "doh_resolver_status": [],
            "ttl_anomalies": [],
            "summary": {}
        }

    def query_dns(self, domain: str, server: str = None, rdtype: str = "A") -> Tuple[List[str], int]:
        """Query DNS and return answers with TTL"""
        try:
            resolver = dns.resolver.Resolver()
            if server:
                resolver.nameservers = [server]

            answer = resolver.resolve(domain, rdtype)
            addresses = [str(rdata) for rdata in answer]
            ttl = answer.rrset.ttl if answer.rrset else 0

            return addresses, ttl
        except dns.resolver.NXDOMAIN:
            return [], -1
        except dns.resolver.NoAnswer:
            return [], -2
        except Exception as e:
            return [], -99

    def is_sinkhole(self, ip: str) -> bool:
        """Check if IP is a known sinkhole address"""
        if ip in SINKHOLE_IPV4:
            return True
        if ip.startswith(SINKHOLE_IPV6_PREFIX):
            return True
        return False

    def check_domain_poisoning(self, domain: str) -> Dict:
        """Check if domain is DNS poisoned across multiple resolvers"""
        result = {
            "domain": domain,
            "poisoned": False,
            "sinkhole_ip": None,
            "consistent_across_resolvers": True,
            "ttl_signature": None,
            "resolver_results": []
        }

        resolver_answers = {}

        for resolver_name, resolver_ip in DNS_SERVERS:
            addresses, ttl = self.query_dns(domain, resolver_ip, "A")

            resolver_result = {
                "resolver": resolver_name,
                "addresses": addresses,
                "ttl": ttl,
                "is_sinkhole": any(self.is_sinkhole(addr) for addr in addresses)
            }

            result["resolver_results"].append(resolver_result)
            resolver_answers[resolver_name] = set(addresses)

            # Check for sinkhole
            if resolver_result["is_sinkhole"]:
                result["poisoned"] = True
                result["sinkhole_ip"] = addresses[0] if addresses else None

                # Check TTL signature (forged responses have high TTL ~417-420)
                if 400 <= ttl <= 430:
                    result["ttl_signature"] = "HIGH_TTL_FORGERY"

        # Check if all resolvers return same poisoned answer
        if len(set(tuple(sorted(s)) for s in resolver_answers.values())) == 1:
            result["consistent_across_resolvers"] = True
        else:
            result["consistent_across_resolvers"] = False

        observed = any(r["addresses"] and r["ttl"] >= 0 for r in result["resolver_results"])
        result["status"] = "POISONED" if result["poisoned"] else "CLEAN" if observed else "INCONCLUSIVE"
        if not observed:
            result["poisoned"] = None
            result["consistent_across_resolvers"] = None
        return result

    def test_doh_resolver_hostnames(self) -> List[Dict]:
        """Test if DoH resolver hostnames are DNS poisoned"""
        results = []

        for hostname in DOH_RESOLVER_NAMES:
            result = self.check_domain_poisoning(hostname)
            results.append(result)

        return results

    def test_censored_domains(self) -> List[Dict]:
        """Test known censored domains"""
        results = []

        for domain in CENSORED_DOMAINS:
            result = self.check_domain_poisoning(domain)
            results.append(result)

        return results

    def test_control_domains(self) -> List[Dict]:
        """Test control domains that should NOT be poisoned"""
        results = []

        for domain in CONTROL_DOMAINS:
            result = self.check_domain_poisoning(domain)
            if result["poisoned"]:
                result["ALERT"] = "CONTROL_DOMAIN_POISONED"
            results.append(result)

        return results

    def run_all_tests(self) -> Dict:
        """Run complete DNS poisoning detection suite"""
        print("DNS Poisoning Detector - Starting tests...")
        print(f"Timestamp: {self.results['timestamp']}\n")

        # Test censored domains
        print("Testing known censored domains...")
        censored_results = self.test_censored_domains()
        self.results["censored_domains"] = censored_results

        poisoned_count = sum(1 for r in censored_results if r["poisoned"])
        print(f"  → {poisoned_count}/{len(CENSORED_DOMAINS)} domains poisoned")

        # Test DoH resolver hostnames
        print("\nTesting DoH resolver hostnames...")
        doh_results = self.test_doh_resolver_hostnames()
        self.results["doh_resolver_status"] = doh_results

        doh_poisoned = sum(1 for r in doh_results if r["poisoned"])
        print(f"  → {doh_poisoned}/{len(DOH_RESOLVER_NAMES)} resolvers poisoned")

        # Test control domains
        print("\nTesting control domains...")
        control_results = self.test_control_domains()
        self.results["control_domains"] = control_results

        control_poisoned = sum(1 for r in control_results if r["poisoned"])
        if control_poisoned > 0:
            print(f"  ⚠️  ALERT: {control_poisoned} control domains poisoned!")
        elif all(r.get("status") == "CLEAN" for r in control_results):
            print(f"  ✓ All control domains clean")
        else:
            print("  Control DNS observations incomplete; clean status is not established")

        # Generate summary
        self.results["summary"] = {
            "total_censored_domains_tested": len(CENSORED_DOMAINS),
            "censored_domains_poisoned": poisoned_count,
            "doh_resolvers_tested": len(DOH_RESOLVER_NAMES),
            "doh_resolvers_poisoned": doh_poisoned,
            "control_domains_tested": len(CONTROL_DOMAINS),
            "control_domains_poisoned": control_poisoned,
            "measurement_valid": all(r.get("status") != "INCONCLUSIVE" for r in censored_results + doh_results + control_results),
            "censorship_active": True if poisoned_count > 0 or doh_poisoned > 0 else (False if all(r.get("status") == "CLEAN" for r in censored_results + doh_results) else None)
        }

        return self.results

    def save_report(self):
        """Save results to JSON file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = os.path.join(self.output_dir, f"dns_poisoning_{timestamp}.json")

        Path(filename).parent.mkdir(parents=True, exist_ok=True)
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)

        print(f"\n✓ Report saved: {filename}")
        return filename

def main():
    detector = DNSPoisoningDetector()
    results = detector.run_all_tests()
    detector.save_report()

    # Print summary
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    summary = results["summary"]
    print(f"Censorship Active: {'YES' if summary['censorship_active'] else 'NO'}")
    print(f"Poisoned Domains: {summary['censored_domains_poisoned']}/{summary['total_censored_domains_tested']}")
    print(f"Poisoned DoH Resolvers: {summary['doh_resolvers_poisoned']}/{summary['doh_resolvers_tested']}")

    if summary["control_domains_poisoned"] > 0:
        print(f"\n⚠️  ALERT: {summary['control_domains_poisoned']} control domains compromised!")

if __name__ == "__main__":
    main()
