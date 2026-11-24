#!/usr/bin/env python3
"""
SNI Filter Scanner
Interactive tool to test which SNIs are filtered and which are not
Provides real-time testing with clear visual feedback
"""

import socket
import ssl
import time
import sys
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from collections import defaultdict

# ANSI color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    RESET = '\033[0m'

class SNIFilterScanner:
    def __init__(self):
        self.cloudflare_ips = [
            "188.114.96.1",  # Best performer
            "188.114.96.3",
            "188.114.97.3",
            "104.21.28.168"
        ]
        self.timeout = 2.5
        self.test_history = []

    def print_header(self):
        """Print application header"""
        print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*70}")
        print("           SNI FILTER SCANNER - Real-Time Testing")
        print(f"{'='*70}{Colors.RESET}\n")
        print("Tests any SNI/hostname against DPI filter to determine if blocked\n")
        print(f"{Colors.GREEN}✓ PASSED{Colors.RESET}    = SNI is NOT filtered (connection successful)")
        print(f"{Colors.RED}✗ BLOCKED{Colors.RESET}   = SNI is filtered (timeout/silent drop)")
        print(f"{Colors.YELLOW}⚠ PARTIAL{Colors.RESET}  = Handshake ok, but no data (suspicious)")
        print(f"{Colors.BLUE}→ REACHED{Colors.RESET}   = Reached Cloudflare (may get error, but not blocked)")
        print(f"\n{Colors.CYAN}{'─'*70}{Colors.RESET}\n")

    def test_sni(self, sni: str, ip: str = None, port: int = 443, verbose: bool = True) -> Dict:
        """
        Test single SNI and return detailed results
        """
        if not ip:
            ip = self.cloudflare_ips[0]

        result = {
            "sni": sni,
            "ip": ip,
            "port": port,
            "timestamp": datetime.now().isoformat(),
            "label_count": sni.count('.') + 1,
            "success": False,
            "handshake_completed": False,
            "data_received": False,
            "bytes_received": 0,
            "response_time_ms": 0,
            "verdict": "UNKNOWN",
            "status": "BLOCKED",  # Default assumption
            "error": None
        }

        if verbose:
            print(f"Testing: {Colors.BOLD}{sni}{Colors.RESET} ({result['label_count']} labels) ... ", end='', flush=True)

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
            result["handshake_completed"] = True

            handshake_time = time.time()
            result["response_time_ms"] = int((handshake_time - start_time) * 1000)

            # Send HTTP request
            request = f"GET / HTTP/1.1\r\nHost: {sni}\r\nConnection: close\r\n\r\n"
            ssl_sock.sendall(request.encode())

            # Try to receive data
            data = ssl_sock.recv(4096)

            if data:
                result["data_received"] = True
                result["bytes_received"] = len(data)
                result["success"] = True
                result["verdict"] = "SERVED"
                result["status"] = "PASSED"

                # Parse HTTP status if available
                try:
                    response_str = data.decode('utf-8', errors='ignore')
                    if "HTTP/" in response_str:
                        status_line = response_str.split('\r\n')[0]
                        result["http_status"] = status_line
                except:
                    pass
            else:
                # Handshake completed but no data = suspicious (DPI silent drop)
                result["verdict"] = "SILENT_DROP"
                result["status"] = "BLOCKED"

            ssl_sock.close()
            sock.close()

        except socket.timeout:
            result["verdict"] = "TIMEOUT"
            result["status"] = "BLOCKED"
            result["error"] = "Connection timeout"

        except ssl.SSLError as e:
            error_str = str(e).lower()

            if result["handshake_completed"]:
                # Got past handshake but SSL error
                result["verdict"] = "POST_HANDSHAKE_SSL_ERROR"
                result["status"] = "REACHED"  # Reached server, but got error
            else:
                # SSL handshake failed
                result["verdict"] = "SSL_HANDSHAKE_FAILED"

                # Check if it's a legitimate server error (means it reached CF)
                if "handshake" in error_str or "certificate" in error_str or "alert" in error_str:
                    result["status"] = "REACHED"  # Reached Cloudflare
                else:
                    result["status"] = "BLOCKED"

            result["error"] = str(e)[:100]

        except ConnectionResetError:
            result["verdict"] = "TCP_RESET"
            result["status"] = "BLOCKED"
            result["error"] = "Connection reset by peer"

        except ConnectionRefusedError:
            result["verdict"] = "CONNECTION_REFUSED"
            result["status"] = "BLOCKED"
            result["error"] = "Connection refused"

        except Exception as e:
            result["verdict"] = "ERROR"
            result["status"] = "UNKNOWN"
            result["error"] = str(e)[:100]

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

        # Calculate total time
        total_time = time.time()
        if result["response_time_ms"] == 0:
            result["response_time_ms"] = int((total_time - start_time) * 1000)

        # Print result
        if verbose:
            self._print_result(result)

        return result

    def _print_result(self, result: Dict):
        """Print test result with color coding"""
        status = result["status"]
        verdict = result["verdict"]

        if status == "PASSED":
            color = Colors.GREEN
            symbol = "✓"
            status_text = f"PASSED ({result['bytes_received']} bytes, {result['response_time_ms']}ms)"
        elif status == "REACHED":
            color = Colors.BLUE
            symbol = "→"
            status_text = f"REACHED Cloudflare ({verdict})"
        elif status == "BLOCKED":
            color = Colors.RED
            symbol = "✗"
            status_text = f"BLOCKED ({verdict})"
        else:
            color = Colors.YELLOW
            symbol = "⚠"
            status_text = f"UNKNOWN ({verdict})"

        print(f"{color}{symbol} {status_text}{Colors.RESET}")

        # Print additional details if error
        if result.get("error") and result["status"] == "BLOCKED":
            print(f"   {Colors.RED}└─ {result['error']}{Colors.RESET}")

    def batch_test(self, sni_list: List[str]) -> List[Dict]:
        """Test multiple SNIs in batch"""
        results = []

        print(f"\n{Colors.CYAN}Testing {len(sni_list)} SNIs...{Colors.RESET}\n")

        for i, sni in enumerate(sni_list, 1):
            result = self.test_sni(sni, verbose=True)
            results.append(result)
            self.test_history.append(result)

            # Small delay between tests
            if i < len(sni_list):
                time.sleep(0.3)

        return results

    def test_label_count_range(self, base_domain: str = "workers.dev", max_labels: int = 7) -> List[Dict]:
        """Test label count variations from 2 to max_labels"""
        print(f"\n{Colors.CYAN}Testing label count variations for {base_domain}...{Colors.RESET}\n")

        test_domains = []

        # Generate domains with increasing label counts
        for label_count in range(2, max_labels + 1):
            if label_count == 2:
                domain = base_domain
            else:
                # Generate a.b.c...domain
                labels = '.'.join(['x'] * (label_count - 2))
                domain = f"{labels}.{base_domain}"

            test_domains.append(domain)

        return self.batch_test(test_domains)

    def interactive_mode(self):
        """Interactive mode - user enters SNIs to test"""
        self.print_header()

        print(f"{Colors.BOLD}Interactive Mode{Colors.RESET}")
        print("Enter SNI/hostname to test (or command):\n")
        print("Commands:")
        print("  'exit' or 'quit'    - Exit program")
        print("  'batch <file>'      - Test SNIs from file (one per line)")
        print("  'labels <domain>'   - Test label count variations (2-7 labels)")
        print("  'history'           - Show test history")
        print("  'summary'           - Show summary statistics")
        print("  'clear'             - Clear test history")
        print(f"\n{Colors.CYAN}{'─'*70}{Colors.RESET}\n")

        while True:
            try:
                user_input = input(f"{Colors.BOLD}SNI>{Colors.RESET} ").strip()

                if not user_input:
                    continue

                # Handle commands
                if user_input.lower() in ['exit', 'quit', 'q']:
                    print(f"\n{Colors.CYAN}Goodbye!{Colors.RESET}\n")
                    break

                elif user_input.lower().startswith('batch '):
                    filename = user_input[6:].strip()
                    self._batch_from_file(filename)

                elif user_input.lower().startswith('labels '):
                    domain = user_input[7:].strip() or "workers.dev"
                    self.test_label_count_range(domain)

                elif user_input.lower() == 'history':
                    self._show_history()

                elif user_input.lower() == 'summary':
                    self._show_summary()

                elif user_input.lower() == 'clear':
                    self.test_history.clear()
                    print(f"{Colors.YELLOW}History cleared{Colors.RESET}\n")

                else:
                    # Test the SNI
                    result = self.test_sni(user_input)
                    self.test_history.append(result)
                    print()

            except KeyboardInterrupt:
                print(f"\n\n{Colors.CYAN}Goodbye!{Colors.RESET}\n")
                break
            except Exception as e:
                print(f"{Colors.RED}Error: {e}{Colors.RESET}\n")

    def _batch_from_file(self, filename: str):
        """Load SNIs from file and test them"""
        try:
            with open(filename, 'r') as f:
                sni_list = [line.strip() for line in f if line.strip() and not line.startswith('#')]

            if sni_list:
                self.batch_test(sni_list)
            else:
                print(f"{Colors.YELLOW}No SNIs found in file{Colors.RESET}\n")

        except FileNotFoundError:
            print(f"{Colors.RED}File not found: {filename}{Colors.RESET}\n")
        except Exception as e:
            print(f"{Colors.RED}Error reading file: {e}{Colors.RESET}\n")

    def _show_history(self):
        """Show test history"""
        if not self.test_history:
            print(f"{Colors.YELLOW}No test history{Colors.RESET}\n")
            return

        print(f"\n{Colors.CYAN}{'─'*70}")
        print(f"TEST HISTORY ({len(self.test_history)} tests)")
        print(f"{'─'*70}{Colors.RESET}\n")

        for i, result in enumerate(self.test_history[-20:], 1):  # Show last 20
            status = result["status"]

            if status == "PASSED":
                color = Colors.GREEN
                symbol = "✓"
            elif status == "REACHED":
                color = Colors.BLUE
                symbol = "→"
            elif status == "BLOCKED":
                color = Colors.RED
                symbol = "✗"
            else:
                color = Colors.YELLOW
                symbol = "⚠"

            print(f"{color}{symbol}{Colors.RESET} {result['sni']:<40} {result['verdict']:<20} ({result['label_count']} labels)")

        if len(self.test_history) > 20:
            print(f"\n{Colors.CYAN}(Showing last 20 of {len(self.test_history)} tests){Colors.RESET}")

        print()

    def _show_summary(self):
        """Show summary statistics"""
        if not self.test_history:
            print(f"{Colors.YELLOW}No test history{Colors.RESET}\n")
            return

        # Calculate statistics
        total = len(self.test_history)
        passed = sum(1 for r in self.test_history if r["status"] == "PASSED")
        blocked = sum(1 for r in self.test_history if r["status"] == "BLOCKED")
        reached = sum(1 for r in self.test_history if r["status"] == "REACHED")

        # Group by label count
        by_labels = defaultdict(lambda: {"passed": 0, "blocked": 0, "reached": 0, "total": 0})

        for result in self.test_history:
            label_count = result["label_count"]
            status = result["status"]

            by_labels[label_count]["total"] += 1

            if status == "PASSED":
                by_labels[label_count]["passed"] += 1
            elif status == "BLOCKED":
                by_labels[label_count]["blocked"] += 1
            elif status == "REACHED":
                by_labels[label_count]["reached"] += 1

        # Print summary
        print(f"\n{Colors.CYAN}{'─'*70}")
        print(f"SUMMARY STATISTICS")
        print(f"{'─'*70}{Colors.RESET}\n")

        print(f"Total Tests: {Colors.BOLD}{total}{Colors.RESET}")
        print(f"{Colors.GREEN}Passed:      {passed} ({passed*100//total if total else 0}%){Colors.RESET}")
        print(f"{Colors.RED}Blocked:     {blocked} ({blocked*100//total if total else 0}%){Colors.RESET}")
        print(f"{Colors.BLUE}Reached:     {reached} ({reached*100//total if total else 0}%){Colors.RESET}")

        print(f"\n{Colors.CYAN}By Label Count:{Colors.RESET}\n")

        for label_count in sorted(by_labels.keys()):
            stats = by_labels[label_count]
            total_for_label = stats["total"]

            pass_pct = stats["passed"] * 100 // total_for_label if total_for_label else 0
            block_pct = stats["blocked"] * 100 // total_for_label if total_for_label else 0

            print(f"  {label_count} labels: {Colors.GREEN}{stats['passed']} pass{Colors.RESET}, "
                  f"{Colors.RED}{stats['blocked']} blocked{Colors.RESET}, "
                  f"{Colors.BLUE}{stats['reached']} reached{Colors.RESET} "
                  f"(total: {total_for_label})")

        print()

    def quick_test_mode(self, sni_list: List[str]):
        """Quick test mode - test list and exit"""
        self.print_header()
        results = self.batch_test(sni_list)

        # Print summary
        print(f"\n{Colors.CYAN}{'─'*70}{Colors.RESET}")

        passed = sum(1 for r in results if r["status"] == "PASSED")
        blocked = sum(1 for r in results if r["status"] == "BLOCKED")
        reached = sum(1 for r in results if r["status"] == "REACHED")

        print(f"\n{Colors.BOLD}Results:{Colors.RESET} "
              f"{Colors.GREEN}{passed} passed{Colors.RESET}, "
              f"{Colors.RED}{blocked} blocked{Colors.RESET}, "
              f"{Colors.BLUE}{reached} reached{Colors.RESET}\n")

def main():
    if any(arg in ("-h", "--help") for arg in sys.argv[1:]):
        print("Usage: python sni_filter_scanner.py [SNI ... | --labels [domain] | --batch file]")
        return
    scanner = SNIFilterScanner()

    # Check if SNIs provided via command line
    if len(sys.argv) > 1:
        if sys.argv[1] == '--labels':
            # Test label count variations
            domain = sys.argv[2] if len(sys.argv) > 2 else "workers.dev"
            scanner.print_header()
            scanner.test_label_count_range(domain)
        elif sys.argv[1] == '--batch':
            # Test from file
            if len(sys.argv) > 2:
                scanner.print_header()
                scanner._batch_from_file(sys.argv[2])
            else:
                print("Usage: python sni_filter_scanner.py --batch <filename>")
        else:
            # Test provided SNIs
            scanner.quick_test_mode(sys.argv[1:])
    else:
        # Interactive mode
        scanner.interactive_mode()

if __name__ == "__main__":
    main()
