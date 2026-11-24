#!/usr/bin/env python3
"""
DoH Mass Tester
Tests all DoH URLs from a list to find which ones work on your network
Based on DPI investigation findings: DoH by hostname usually blocked, IP literals may work
"""

from pathlib import Path
import urllib.request
import urllib.error
import socket
import ssl
import time
import json
import sys
from datetime import datetime
from typing import Dict, List, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
import struct

# ANSI colors
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    RESET = '\033[0m'

class DoHMassTester:
    def __init__(self, doh_list_file: str = str(Path(__file__).resolve().parent / "doh-list.txt")):
        self.doh_list_file = doh_list_file
        self.timeout = 5
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "total_tested": 0,
            "working": [],
            "blocked": [],
            "errors": [],
            "by_verdict": {}
        }

    def load_doh_urls(self) -> List[str]:
        """Load DoH URLs from file, skip comments and empty lines"""
        urls = []

        try:
            with open(self.doh_list_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()

                    # Skip comments, empty lines, and non-URL lines
                    if not line or line.startswith('#') or line.startswith('!'):
                        continue

                    # Must start with https://
                    if line.startswith('https://'):
                        urls.append(line)

        except FileNotFoundError:
            print(f"{Colors.RED}Error: File not found: {self.doh_list_file}{Colors.RESET}")
            sys.exit(1)
        except Exception as e:
            print(f"{Colors.RED}Error reading file: {e}{Colors.RESET}")
            sys.exit(1)

        return urls

    def create_dns_query(self, domain: str = "example.com") -> bytes:
        """Create DNS query for testing"""
        query = b'\x00\x00'  # Transaction ID
        query += b'\x01\x00'  # Flags: standard query
        query += b'\x00\x01'  # Questions: 1
        query += b'\x00\x00'  # Answer RRs
        query += b'\x00\x00'  # Authority RRs
        query += b'\x00\x00'  # Additional RRs

        # Question section
        for part in domain.split('.'):
            query += bytes([len(part)]) + part.encode()
        query += b'\x00'
        query += b'\x00\x01'  # Type A
        query += b'\x00\x01'  # Class IN

        return query

    def test_doh_url(self, url: str) -> Dict:
        """Test single DoH URL"""
        result = {
            "url": url,
            "domain": self._extract_domain(url),
            "success": False,
            "response_time_ms": 0,
            "status_code": 0,
            "verdict": "UNKNOWN",
            "error": None,
            "dns_answers": 0
        }

        start_time = time.time()

        try:
            # Create DNS query
            dns_query = self.create_dns_query("cloudflare.com")

            # Create request
            req = urllib.request.Request(
                url,
                data=dns_query,
                headers={
                    'Content-Type': 'application/dns-message',
                    'Accept': 'application/dns-message',
                    'User-Agent': 'DoH-Tester/1.0'
                },
                method='POST'
            )

            # SSL context that accepts all certificates (for testing)
            ctx = ssl.create_default_context()
            ctx.check_hostname = False  # Keep False for IP literal connection
            ctx.verify_mode = ssl.CERT_REQUIRED

            # Make request
            response = urllib.request.urlopen(req, timeout=self.timeout, context=ctx)

            response_time = time.time()
            result["response_time_ms"] = int((response_time - start_time) * 1000)
            result["status_code"] = response.getcode()

            # Check if we got valid DNS response
            if response.getcode() == 200:
                dns_response = response.read()

                # Parse DNS response to check if valid
                if len(dns_response) >= 12:
                    # Extract answer count from DNS header
                    answer_count = struct.unpack('!H', dns_response[6:8])[0]
                    result["dns_answers"] = answer_count

                    if answer_count > 0:
                        result["success"] = True
                        result["verdict"] = "WORKING"
                    else:
                        result["verdict"] = "NO_ANSWERS"
                else:
                    result["verdict"] = "INVALID_RESPONSE"
            else:
                result["verdict"] = f"HTTP_{response.getcode()}"

        except urllib.error.HTTPError as e:
            result["status_code"] = e.code
            result["verdict"] = f"HTTP_{e.code}"
            result["error"] = str(e.reason)[:100]

        except urllib.error.URLError as e:
            error_str = str(e.reason).lower()

            if "timeout" in error_str or "timed out" in error_str:
                result["verdict"] = "TIMEOUT_BLOCKED"
            elif "reset" in error_str or "connection reset" in error_str:
                result["verdict"] = "TCP_RESET"
            elif "refused" in error_str:
                result["verdict"] = "CONNECTION_REFUSED"
            elif "certificate" in error_str or "ssl" in error_str:
                result["verdict"] = "SSL_ERROR"
            else:
                result["verdict"] = "NETWORK_ERROR"

            result["error"] = str(e.reason)[:100]

        except socket.timeout:
            result["verdict"] = "TIMEOUT_BLOCKED"
            result["error"] = "Connection timeout"

        except Exception as e:
            result["verdict"] = "ERROR"
            result["error"] = str(e)[:100]

        finally:
            if result["response_time_ms"] == 0:
                result["response_time_ms"] = int((time.time() - start_time) * 1000)

        return result

    def _extract_domain(self, url: str) -> str:
        """Extract domain from URL"""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            return parsed.netloc
        except:
            return url

    def test_all_sequential(self, urls: List[str]) -> List[Dict]:
        """Test all URLs sequentially (slower but more controlled)"""
        results = []
        total = len(urls)

        print(f"\n{Colors.CYAN}Testing {total} DoH servers sequentially...{Colors.RESET}\n")

        for i, url in enumerate(urls, 1):
            print(f"[{i}/{total}] Testing: {url[:60]}... ", end='', flush=True)

            result = self.test_doh_url(url)
            results.append(result)

            # Print result
            if result["success"]:
                print(f"{Colors.GREEN}✓ WORKING ({result['response_time_ms']}ms){Colors.RESET}")
            elif result["verdict"] == "TIMEOUT_BLOCKED":
                print(f"{Colors.RED}✗ TIMEOUT{Colors.RESET}")
            elif result["verdict"] == "TCP_RESET":
                print(f"{Colors.RED}✗ RESET{Colors.RESET}")
            else:
                print(f"{Colors.YELLOW}⚠ {result['verdict']}{Colors.RESET}")

            # Small delay between tests
            time.sleep(0.2)

        return results

    def test_all_parallel(self, urls: List[str], max_workers: int = 10) -> List[Dict]:
        """Test all URLs in parallel (faster but less controlled)"""
        results = []
        total = len(urls)
        completed = 0

        print(f"\n{Colors.CYAN}Testing {total} DoH servers in parallel ({max_workers} workers)...{Colors.RESET}\n")

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all tasks
            future_to_url = {executor.submit(self.test_doh_url, url): url for url in urls}

            # Process as they complete
            for future in as_completed(future_to_url):
                url = future_to_url[future]
                completed += 1

                try:
                    result = future.result()
                    results.append(result)

                    # Print progress
                    if result["success"]:
                        print(f"[{completed}/{total}] {Colors.GREEN}✓{Colors.RESET} {url[:50]}")
                    elif completed % 10 == 0:
                        print(f"[{completed}/{total}] Progress...")

                except Exception as e:
                    print(f"[{completed}/{total}] {Colors.RED}✗{Colors.RESET} {url[:50]} - Error: {e}")

        return results

    def analyze_results(self, results: List[Dict]):
        """Analyze and categorize results"""
        self.results["total_tested"] = len(results)

        # Categorize by verdict
        verdict_counts = {}

        for result in results:
            verdict = result["verdict"]

            if verdict not in verdict_counts:
                verdict_counts[verdict] = 0
            verdict_counts[verdict] += 1

            # Categorize
            if result["success"]:
                self.results["working"].append(result)
            elif verdict in ["TIMEOUT_BLOCKED", "TCP_RESET", "CONNECTION_REFUSED"]:
                self.results["blocked"].append(result)
            else:
                self.results["errors"].append(result)

        self.results["by_verdict"] = verdict_counts

        # Sort working by response time
        self.results["working"].sort(key=lambda x: x["response_time_ms"])

    def print_summary(self):
        """Print comprehensive summary"""
        print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*70}")
        print("                    SUMMARY")
        print(f"{'='*70}{Colors.RESET}\n")

        total = self.results["total_tested"]
        working = len(self.results["working"])
        blocked = len(self.results["blocked"])
        errors = len(self.results["errors"])

        print(f"Total Tested:  {Colors.BOLD}{total}{Colors.RESET}")
        print(f"{Colors.GREEN}Working:       {working} ({working*100//total if total else 0}%){Colors.RESET}")
        print(f"{Colors.RED}Blocked:       {blocked} ({blocked*100//total if total else 0}%){Colors.RESET}")
        print(f"{Colors.YELLOW}Errors:        {errors} ({errors*100//total if total else 0}%){Colors.RESET}")

        # Show verdict breakdown
        print(f"\n{Colors.CYAN}Breakdown by Verdict:{Colors.RESET}\n")
        for verdict, count in sorted(self.results["by_verdict"].items(), key=lambda x: -x[1]):
            pct = count * 100 // total if total else 0
            print(f"  {verdict:25} {count:4} ({pct}%)")

        # Show top 10 working servers
        if self.results["working"]:
            print(f"\n{Colors.GREEN}{Colors.BOLD}TOP 10 FASTEST WORKING SERVERS:{Colors.RESET}\n")
            for i, result in enumerate(self.results["working"][:10], 1):
                print(f"  {i}. {result['url']}")
                print(f"     {Colors.GREEN}✓{Colors.RESET} {result['response_time_ms']}ms, {result['dns_answers']} answers\n")

    def save_results(self, output_file: str = None):
        """Save results to JSON file"""
        if not output_file:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = str(Path(__file__).resolve().parent / "reports" / f"doh_test_results_{timestamp}.json")

        # Prepare data for JSON
        output_data = {
            "timestamp": self.results["timestamp"],
            "summary": {
                "total_tested": self.results["total_tested"],
                "working_count": len(self.results["working"]),
                "blocked_count": len(self.results["blocked"]),
                "error_count": len(self.results["errors"]),
                "by_verdict": self.results["by_verdict"]
            },
            "working_servers": self.results["working"],
            "blocked_servers": [{"url": r["url"], "verdict": r["verdict"]} for r in self.results["blocked"]],
            "errors": [{"url": r["url"], "verdict": r["verdict"], "error": r["error"]} for r in self.results["errors"]]
        }

        Path(output_file).parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)

        print(f"\n{Colors.GREEN}✓ Results saved to: {output_file}{Colors.RESET}")

        # Also save simple working list
        working_list_file = output_file.replace('.json', '_working_only.txt')
        with open(working_list_file, 'w', encoding='utf-8') as f:
            f.write(f"# Working DoH Servers - Tested {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"# Total: {len(self.results['working'])} working out of {self.results['total_tested']} tested\n\n")
            for result in self.results["working"]:
                f.write(f"{result['url']}  # {result['response_time_ms']}ms\n")

        print(f"{Colors.GREEN}✓ Working servers list: {working_list_file}{Colors.RESET}")

def main():
    print(f"""
{Colors.BOLD}{Colors.CYAN}╔═══════════════════════════════════════════════════════════════════╗
║                  DoH MASS TESTER                                  ║
║          Test all DoH servers from doh-list.txt                   ║
╚═══════════════════════════════════════════════════════════════════╝{Colors.RESET}
    """)

    # Check command line arguments
    mode = "parallel"
    if len(sys.argv) > 1:
        if sys.argv[1] == "--sequential":
            mode = "sequential"
        elif sys.argv[1] == "--help":
            print("Usage: python doh_mass_tester.py [--sequential|--parallel]")
            print("\n  --sequential  : Test one by one (slower, more controlled)")
            print("  --parallel    : Test in parallel (faster, default)")
            return

    tester = DoHMassTester()

    # Load URLs
    print(f"{Colors.CYAN}Loading DoH URLs from: {tester.doh_list_file}{Colors.RESET}")
    urls = tester.load_doh_urls()
    print(f"{Colors.GREEN}✓ Loaded {len(urls)} DoH URLs{Colors.RESET}\n")

    if not urls:
        print(f"{Colors.RED}No DoH URLs found in file!{Colors.RESET}")
        return

    # Ask user for confirmation
    print(f"{Colors.YELLOW}About to test {len(urls)} DoH servers.{Colors.RESET}")
    print(f"Mode: {Colors.BOLD}{mode.upper()}{Colors.RESET}")

    if mode == "sequential":
        print(f"Estimated time: ~{len(urls) * 5 // 60} minutes")
    else:
        print(f"Estimated time: ~{len(urls) // 10 // 60} minutes (10 parallel)")

    response = "y" if "--yes" in sys.argv else input(f"\n{Colors.BOLD}Continue? (y/n): {Colors.RESET}").lower().strip()

    if response != 'y':
        print(f"\n{Colors.CYAN}Cancelled.{Colors.RESET}")
        return

    # Test all URLs
    start_time = time.time()

    if mode == "sequential":
        results = tester.test_all_sequential(urls)
    else:
        results = tester.test_all_parallel(urls, max_workers=10)

    duration = time.time() - start_time

    # Analyze results
    tester.analyze_results(results)

    # Print summary
    tester.print_summary()

    print(f"\n{Colors.CYAN}Total time: {duration:.1f} seconds{Colors.RESET}")

    # Save results
    tester.save_results()

    # Show recommendation
    if tester.results["working"]:
        print(f"\n{Colors.GREEN}{Colors.BOLD}RECOMMENDATION:{Colors.RESET}")
        print(f"Configure your system to use one of the {len(tester.results['working'])} working DoH servers above.")
        print(f"Fastest server: {tester.results['working'][0]['url']}")
    else:
        print(f"\n{Colors.RED}{Colors.BOLD}WARNING:{Colors.RESET}")
        print(f"No working DoH servers found!")
        print(f"Your ISP appears to block DoH by hostname.")
        print(f"Try DoH by IP literal: https://8.8.8.8/dns-query or https://1.1.1.1/dns-query")

if __name__ == "__main__":
    main()
