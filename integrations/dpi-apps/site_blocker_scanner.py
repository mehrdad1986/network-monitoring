#!/usr/bin/env python3
"""
International Site Blocker Scanner
Fetches top 100 most visited international websites and tests which are blocked/filtered
Tests DNS poisoning, SNI blocking, and connection accessibility
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

# Top 100 most visited international websites (Based on Alexa/SimilarWeb rankings)
TOP_SITES = [
    # Search & Tech Giants
    "google.com", "youtube.com", "facebook.com", "twitter.com", "instagram.com",
    "whatsapp.com", "tiktok.com", "snapchat.com", "linkedin.com", "reddit.com",
    "wikipedia.org", "amazon.com", "netflix.com", "zoom.us", "microsoft.com",

    # Social & Media
    "pinterest.com", "telegram.org", "discord.com", "twitch.tv", "tumblr.com",
    "vk.com", "ok.ru", "weibo.com", "qq.com", "wechat.com",

    # News & Content
    "bbc.com", "cnn.com", "nytimes.com", "theguardian.com", "reuters.com",
    "bloomberg.com", "forbes.com", "wsj.com", "aljazeera.com", "dw.com",

    # Entertainment & Gaming
    "spotify.com", "soundcloud.com", "vimeo.com", "dailymotion.com", "pornhub.com",
    "xvideos.com", "xnxx.com", "twitch.tv", "roblox.com", "minecraft.net",

    # E-commerce & Shopping
    "ebay.com", "aliexpress.com", "alibaba.com", "walmart.com", "ikea.com",
    "apple.com", "bestbuy.com", "target.com", "etsy.com", "shopify.com",

    # Cloud & Services
    "dropbox.com", "github.com", "gitlab.com", "bitbucket.org", "stackoverflow.com",
    "medium.com", "wordpress.com", "blogger.com", "paypal.com", "stripe.com",

    # VPN & Privacy
    "protonvpn.com", "nordvpn.com", "expressvpn.com", "torproject.org", "signal.org",

    # Messaging & Communication
    "slack.com", "skype.com", "viber.com", "telegram.org", "line.me",

    # Education & Knowledge
    "coursera.org", "udemy.com", "khanacademy.org", "edx.org", "duolingo.com",

    # Streaming & Video
    "hulu.com", "disneyplus.com", "hbo.com", "primevideo.com", "crunchyroll.com",

    # News & Regional
    "bbc.co.uk", "thesun.co.uk", "dailymail.co.uk", "lemonde.fr", "spiegel.de",

    # Other Popular
    "imdb.com", "yelp.com", "tripadvisor.com", "booking.com", "airbnb.com",
    "indeed.com", "weather.com", "craigslist.org", "quora.com", "archive.org"
]

class SiteBlockerScanner:
    def __init__(self):
        self.timeout = 5
        self.cloudflare_ips = ["188.114.96.1", "188.114.96.3"]
        self.sinkhole_ips = ["10.10.34.34", "10.10.34.35", "10.10.34.36"]
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "total_tested": 0,
            "accessible": [],
            "blocked": [],
            "dns_poisoned": [],
            "sni_blocked": [],
            "connection_issues": [],
            "summary": {}
        }

    def resolve_domain(self, domain: str) -> Tuple[str, str]:
        """
        Resolve domain and check for DNS poisoning
        Returns (ip, status) where status is 'clean', 'sinkhole', or 'error'
        """
        try:
            ip = socket.gethostbyname(domain)

            # Check if it's a sinkhole address
            if ip in self.sinkhole_ips or ip.startswith("10.10.34."):
                return ip, "sinkhole"

            return ip, "clean"

        except socket.gaierror:
            return None, "error"
        except Exception as e:
            return None, "error"

    def test_http_connection(self, domain: str, ip: str = None) -> Dict:
        """Test HTTP/HTTPS connection to domain"""
        result = {
            "protocol": "https",
            "success": False,
            "status_code": 0,
            "response_time_ms": 0,
            "verdict": "UNKNOWN"
        }

        if not ip:
            ip, dns_status = self.resolve_domain(domain)
            if dns_status == "sinkhole":
                result["verdict"] = "DNS_POISONED"
                return result

        start_time = time.time()

        try:
            # Try HTTPS connection
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.timeout)

            # Try to resolve IP if not provided
            if not ip:
                ip = socket.gethostbyname(domain)

            sock.connect((ip, 443))

            # TLS handshake
            context = ssl.create_default_context()
            context.verify_mode = ssl.CERT_REQUIRED

            ssl_sock = context.wrap_socket(sock, server_hostname=domain)

            # Send simple HTTP request
            request = f"GET / HTTP/1.1\r\nHost: {domain}\r\nConnection: close\r\n\r\n"
            ssl_sock.sendall(request.encode())

            # Try to receive data
            data = ssl_sock.recv(4096)

            response_time = time.time()
            result["response_time_ms"] = int((response_time - start_time) * 1000)

            if data:
                result["success"] = True
                result["verdict"] = "ACCESSIBLE"

                # Try to extract status code
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
                result["verdict"] = "NO_DATA_RECEIVED"

            ssl_sock.close()
            sock.close()

        except socket.timeout:
            result["verdict"] = "TIMEOUT"
        except ConnectionResetError:
            result["verdict"] = "CONNECTION_RESET"
        except ssl.SSLError as e:
            error_str = str(e).lower()
            if "certificate" in error_str or "handshake" in error_str:
                result["verdict"] = "SSL_ERROR"
            else:
                result["verdict"] = "SSL_BLOCKED"
        except socket.gaierror:
            result["verdict"] = "DNS_RESOLUTION_FAILED"
        except Exception as e:
            result["verdict"] = "CONNECTION_FAILED"
            result["error"] = str(e)[:100]

        finally:
            if result["response_time_ms"] == 0:
                result["response_time_ms"] = int((time.time() - start_time) * 1000)

        return result

    def test_site(self, domain: str) -> Dict:
        """Complete test of a single site"""
        result = {
            "domain": domain,
            "timestamp": datetime.now().isoformat(),
            "dns_ip": None,
            "dns_status": "unknown",
            "connection_result": {},
            "final_verdict": "UNKNOWN",
            "reason": ""
        }

        # Step 1: DNS resolution
        ip, dns_status = self.resolve_domain(domain)
        result["dns_ip"] = ip
        result["dns_status"] = dns_status

        if dns_status == "sinkhole":
            result["final_verdict"] = "DNS_POISONED"
            result["reason"] = f"DNS resolves to sinkhole address: {ip}"
            return result

        if dns_status == "error":
            result["final_verdict"] = "DNS_ERROR"
            result["reason"] = "Failed to resolve domain"
            return result

        # Step 2: Connection test
        conn_result = self.test_http_connection(domain, ip)
        result["connection_result"] = conn_result

        # Determine final verdict
        if conn_result["verdict"] == "ACCESSIBLE":
            result["final_verdict"] = "ACCESSIBLE"
            result["reason"] = f"Successfully connected ({conn_result['response_time_ms']}ms)"
        elif conn_result["verdict"] in ["TIMEOUT", "CONNECTION_RESET", "SSL_BLOCKED"]:
            result["final_verdict"] = "BLOCKED"
            result["reason"] = f"Connection blocked: {conn_result['verdict']}"
        else:
            result["final_verdict"] = "ERROR"
            result["reason"] = f"Connection issue: {conn_result['verdict']}"

        return result

    def test_all_sites_parallel(self, sites: List[str], max_workers: int = 15) -> List[Dict]:
        """Test all sites in parallel"""
        results = []
        total = len(sites)
        completed = 0

        print(f"\n{Colors.CYAN}Testing {total} international websites...{Colors.RESET}\n")

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_site = {executor.submit(self.test_site, site): site for site in sites}

            for future in as_completed(future_to_site):
                site = future_to_site[future]
                completed += 1

                try:
                    result = future.result()
                    results.append(result)

                    # Print progress
                    verdict = result["final_verdict"]
                    if verdict == "ACCESSIBLE":
                        symbol = f"{Colors.GREEN}✓{Colors.RESET}"
                    elif verdict == "DNS_POISONED":
                        symbol = f"{Colors.RED}⊗{Colors.RESET}"
                    elif verdict == "BLOCKED":
                        symbol = f"{Colors.RED}✗{Colors.RESET}"
                    else:
                        symbol = f"{Colors.YELLOW}⚠{Colors.RESET}"

                    print(f"[{completed:3d}/{total}] {symbol} {site:30} {verdict}")

                except Exception as e:
                    print(f"[{completed:3d}/{total}] {Colors.RED}✗{Colors.RESET} {site:30} ERROR: {e}")

        return results

    def analyze_results(self, results: List[Dict]):
        """Analyze and categorize results"""
        self.results["total_tested"] = len(results)

        for result in results:
            verdict = result["final_verdict"]

            if verdict == "ACCESSIBLE":
                self.results["accessible"].append(result)
            elif verdict == "DNS_POISONED":
                self.results["dns_poisoned"].append(result)
            elif verdict == "BLOCKED":
                self.results["blocked"].append(result)
            else:
                self.results["connection_issues"].append(result)

        # Generate summary
        total = self.results["total_tested"]
        self.results["summary"] = {
            "total": total,
            "accessible": len(self.results["accessible"]),
            "accessible_pct": len(self.results["accessible"]) * 100 // total if total else 0,
            "dns_poisoned": len(self.results["dns_poisoned"]),
            "dns_poisoned_pct": len(self.results["dns_poisoned"]) * 100 // total if total else 0,
            "blocked": len(self.results["blocked"]),
            "blocked_pct": len(self.results["blocked"]) * 100 // total if total else 0,
            "errors": len(self.results["connection_issues"]),
            "total_censored": len(self.results["dns_poisoned"]) + len(self.results["blocked"])
        }

    def print_summary(self):
        """Print comprehensive summary"""
        print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*70}")
        print("                    CENSORSHIP REPORT")
        print(f"{'='*70}{Colors.RESET}\n")

        summary = self.results["summary"]

        print(f"Total Sites Tested: {Colors.BOLD}{summary['total']}{Colors.RESET}\n")

        print(f"{Colors.GREEN}✓ Accessible:      {summary['accessible']:3d} ({summary['accessible_pct']:3d}%){Colors.RESET}")
        print(f"{Colors.RED}⊗ DNS Poisoned:    {summary['dns_poisoned']:3d} ({summary['dns_poisoned_pct']:3d}%){Colors.RESET}")
        print(f"{Colors.RED}✗ Blocked (SNI):   {summary['blocked']:3d} ({summary['blocked_pct']:3d}%){Colors.RESET}")
        print(f"{Colors.YELLOW}⚠ Errors:          {summary['errors']:3d}{Colors.RESET}")

        print(f"\n{Colors.RED}{Colors.BOLD}TOTAL CENSORED: {summary['total_censored']} sites ({summary['total_censored']*100//summary['total'] if summary['total'] else 0}%){Colors.RESET}\n")

        # Show blocked categories
        if self.results["dns_poisoned"]:
            print(f"{Colors.RED}{Colors.BOLD}DNS POISONED SITES:{Colors.RESET}")
            for result in self.results["dns_poisoned"][:20]:
                print(f"  ⊗ {result['domain']:30} → {result['dns_ip']}")
            if len(self.results["dns_poisoned"]) > 20:
                print(f"  ... and {len(self.results['dns_poisoned']) - 20} more")
            print()

        if self.results["blocked"]:
            print(f"{Colors.RED}{Colors.BOLD}SNI/CONNECTION BLOCKED SITES:{Colors.RESET}")
            for result in self.results["blocked"][:20]:
                print(f"  ✗ {result['domain']:30} ({result['reason']})")
            if len(self.results["blocked"]) > 20:
                print(f"  ... and {len(self.results['blocked']) - 20} more")
            print()

    def save_results(self, output_file: str = None):
        """Save results to JSON file"""
        if not output_file:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = str(Path(__file__).resolve().parent / "reports" / "daily" / f"site_blocker_scan_{timestamp}.json")

        Path(output_file).parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)

        print(f"{Colors.GREEN}✓ Results saved to: {output_file}{Colors.RESET}")

        # Save blocked list
        blocked_file = output_file.replace('.json', '_blocked.txt')
        with open(blocked_file, 'w', encoding='utf-8') as f:
            f.write(f"# Blocked/Censored Sites - Tested {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

            if self.results["dns_poisoned"]:
                f.write("# DNS POISONED\n")
                for result in self.results["dns_poisoned"]:
                    f.write(f"{result['domain']}  # {result['dns_ip']}\n")
                f.write("\n")

            if self.results["blocked"]:
                f.write("# SNI/CONNECTION BLOCKED\n")
                for result in self.results["blocked"]:
                    f.write(f"{result['domain']}  # {result['reason']}\n")

        print(f"{Colors.GREEN}✓ Blocked sites list: {blocked_file}{Colors.RESET}")

def main():
    print(f"""
{Colors.BOLD}{Colors.CYAN}╔═══════════════════════════════════════════════════════════════════╗
║           INTERNATIONAL SITE BLOCKER SCANNER                      ║
║        Tests Top 100 International Sites for Censorship           ║
╚═══════════════════════════════════════════════════════════════════╝{Colors.RESET}

{Colors.YELLOW}This tool will test:{Colors.RESET}
  • DNS poisoning (sinkhole detection)
  • SNI-based blocking
  • Connection accessibility

{Colors.YELLOW}Sites tested:{Colors.RESET} Top 100 international websites including:
  • Social media (Facebook, Twitter, Instagram, TikTok, etc.)
  • News sites (BBC, CNN, NYTimes, etc.)
  • Streaming (YouTube, Netflix, Spotify, etc.)
  • VPN services (NordVPN, ProtonVPN, etc.)
  • And more...

    """)

    # Ask for confirmation
    response = "y" if "--yes" in sys.argv else input(f"{Colors.BOLD}Start scanning? (y/n): {Colors.RESET}").lower().strip()

    if response != 'y':
        print(f"\n{Colors.CYAN}Cancelled.{Colors.RESET}")
        return

    scanner = SiteBlockerScanner()

    # Test all sites
    start_time = time.time()
    results = scanner.test_all_sites_parallel(TOP_SITES, max_workers=15)
    duration = time.time() - start_time

    # Analyze
    scanner.analyze_results(results)

    # Print summary
    scanner.print_summary()

    print(f"\n{Colors.CYAN}Scan completed in {duration:.1f} seconds{Colors.RESET}\n")

    # Save results
    scanner.save_results()

    # Show recommendation
    summary = scanner.results["summary"]
    censored_pct = summary["total_censored"] * 100 // summary["total"] if summary["total"] else 0

    if censored_pct > 50:
        print(f"\n{Colors.RED}{Colors.BOLD}HIGH CENSORSHIP DETECTED:{Colors.RESET}")
        print(f"{censored_pct}% of tested sites are blocked or censored.")
        print(f"Consider using VPN or proxy services.")
    elif censored_pct > 20:
        print(f"\n{Colors.YELLOW}{Colors.BOLD}MODERATE CENSORSHIP DETECTED:{Colors.RESET}")
        print(f"{censored_pct}% of tested sites are blocked or censored.")
    else:
        print(f"\n{Colors.GREEN}{Colors.BOLD}LOW CENSORSHIP:{Colors.RESET}")
        print(f"Only {censored_pct}% of tested sites are blocked.")

if __name__ == "__main__":
    main()
