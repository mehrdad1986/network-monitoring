#!/usr/bin/env python3
"""
IPv4 DNS Server Checker with Latency Ranking.

Checks all IPv4 DNS servers from MISP dataset, measures latency,
and ranks them by response time (fastest first).
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import socket
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from direct_network import add_network_argument, require_direct_network


DEFAULT_INPUT = "the MISP IPv4 DNS dataset.json"
DEFAULT_CSV = "ipv4_dns_results.csv"
DEFAULT_REPORT = "ipv4_dns_ranked.txt"
TEST_DOMAIN = "example.com"


# ---------- Terminal setup ----------

USE_COLOR = sys.stdout.isatty() and "NO_COLOR" not in os.environ

if USE_COLOR and os.name == "nt":
    os.system("")

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except AttributeError:
    pass


def paint(text: str, color_code: str) -> str:
    return f"\033[{color_code}m{text}\033[0m" if USE_COLOR else text


GREEN_CHECK = paint("✓", "92")
RED_CROSS = paint("✗", "91")
GREEN_TEXT = "92"
RED_TEXT = "91"
YELLOW_TEXT = "93"

_print_lock = threading.Lock()


def log(message: str = "") -> None:
    """Print from worker threads without interleaving lines."""
    with _print_lock:
        print(message, flush=True)


# ---------- Data model ----------

@dataclass(frozen=True)
class DNSCheckResult:
    dns_ip: str
    accessible: bool
    latency_ms: float | None
    resolved_ip: str
    error: str
    checked_at: str


# ---------- Input ----------

def load_dns_servers(json_path: Path) -> list[str]:
    """
    Load DNS server IPs from MISP JSON dataset.
    """
    try:
        with json_path.open("r", encoding="utf-8") as f:
            data = json.load(f)

        dns_list = data.get("list", [])

        # Remove duplicates while preserving order
        seen = set()
        unique_dns = []
        for dns_ip in dns_list:
            if dns_ip not in seen:
                seen.add(dns_ip)
                unique_dns.append(dns_ip)

        return unique_dns

    except Exception as e:
        log(f"Error loading JSON: {e}")
        return []


# ---------- DNS Checking ----------

def check_dns_server(dns_ip: str, timeout: float = 3.0, test_domain: str = TEST_DOMAIN) -> DNSCheckResult:
    """
    Check if a DNS server is accessible by querying it.
    Measures latency and returns result.
    """
    checked_at = datetime.now().isoformat(timespec="seconds")

    try:
        # Configure resolver to use this specific DNS server

        # Create a custom resolver for this DNS server
        import dns.resolver
        resolver = dns.resolver.Resolver(configure=False)
        resolver.nameservers = [dns_ip]
        resolver.timeout = timeout
        resolver.lifetime = timeout

        # Measure latency
        start = time.perf_counter()
        answers = resolver.resolve(test_domain, 'A')
        latency = round((time.perf_counter() - start) * 1000, 2)

        # Get resolved IP
        resolved_ip = str(answers[0]) if answers else ""


        log(f"{GREEN_CHECK} {dns_ip}  {paint('ACCESSIBLE', GREEN_TEXT)}  {latency:.2f} ms → {resolved_ip}")

        return DNSCheckResult(
            dns_ip=dns_ip,
            accessible=True,
            latency_ms=latency,
            resolved_ip=resolved_ip,
            error="",
            checked_at=checked_at
        )

    except dns.resolver.Timeout:
        log(f"{RED_CROSS} {dns_ip}  {paint('TIMEOUT', RED_TEXT)}")
        return DNSCheckResult(
            dns_ip=dns_ip,
            accessible=False,
            latency_ms=None,
            resolved_ip="",
            error="Timeout",
            checked_at=checked_at
        )

    except dns.resolver.NoNameservers:
        log(f"{RED_CROSS} {dns_ip}  {paint('NO RESPONSE', RED_TEXT)}")
        return DNSCheckResult(
            dns_ip=dns_ip,
            accessible=False,
            latency_ms=None,
            resolved_ip="",
            error="No response from nameserver",
            checked_at=checked_at
        )

    except Exception as e:
        error_msg = f"{type(e).__name__}"
        log(f"{RED_CROSS} {dns_ip}  {paint('FAILED', RED_TEXT)}  {error_msg}")
        return DNSCheckResult(
            dns_ip=dns_ip,
            accessible=False,
            latency_ms=None,
            resolved_ip="",
            error=error_msg,
            checked_at=checked_at
        )


# ---------- Reporting ----------

def write_csv_atomic(path: Path, results: list[DNSCheckResult]) -> None:
    """Write all results to CSV file."""
    tmp = path.with_name(path.name + ".tmp")

    with tmp.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow([
            "rank", "dns_ip", "accessible", "latency_ms",
            "resolved_ip", "error", "checked_at"
        ])

        # Sort by latency (accessible first, then by latency)
        accessible = [r for r in results if r.accessible]
        inaccessible = [r for r in results if not r.accessible]

        accessible.sort(key=lambda x: x.latency_ms)

        # Write accessible servers with rank
        for rank, r in enumerate(accessible, start=1):
            writer.writerow([
                rank,
                r.dns_ip,
                "yes",
                f"{r.latency_ms:.2f}",
                r.resolved_ip,
                "",
                r.checked_at
            ])

        # Write inaccessible servers without rank
        for r in inaccessible:
            writer.writerow([
                "",
                r.dns_ip,
                "no",
                "",
                "",
                r.error,
                r.checked_at
            ])

    os.replace(tmp, path)


def build_ranked_report(results: list[DNSCheckResult]) -> str:
    """
    Build report of accessible DNS servers ranked by latency.
    """
    accessible = [r for r in results if r.accessible]
    accessible.sort(key=lambda x: x.latency_ms)

    lines = [
        "=" * 80,
        "ACCESSIBLE IPv4 DNS SERVERS — LOWEST LATENCY FIRST",
        "=" * 80,
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "",
        f"Total DNS servers checked: {len(results)}",
        f"Accessible: {len(accessible)} ({len(accessible)/len(results)*100:.1f}%)",
        f"Inaccessible: {len(results) - len(accessible)} ({(len(results) - len(accessible))/len(results)*100:.1f}%)",
        "",
        "=" * 80,
        ""
    ]

    if accessible:
        lines.append(f"{'RANK':<6} | {'LATENCY (ms)':<12} | {'DNS SERVER IP':<20} | {'RESOLVED IP':<20}")
        lines.append("-" * 80)

        for rank, r in enumerate(accessible, start=1):
            lines.append(
                f"{rank:<6} | {r.latency_ms:>10.2f} ms | {r.dns_ip:<20} | {r.resolved_ip:<20}"
            )

        # Statistics
        if len(accessible) > 0:
            avg_latency = sum(r.latency_ms for r in accessible) / len(accessible)
            min_latency = accessible[0].latency_ms
            max_latency = accessible[-1].latency_ms

            lines.append("")
            lines.append("=" * 80)
            lines.append("STATISTICS")
            lines.append("=" * 80)
            lines.append(f"Fastest DNS server: {accessible[0].dns_ip} ({min_latency:.2f} ms)")
            lines.append(f"Slowest DNS server: {accessible[-1].dns_ip} ({max_latency:.2f} ms)")
            lines.append(f"Average latency: {avg_latency:.2f} ms")
            lines.append(f"Median latency: {accessible[len(accessible)//2].latency_ms:.2f} ms")
    else:
        lines.append("No accessible DNS servers found.")

    lines.append("")
    return "\n".join(lines)


def write_text_atomic(path: Path, content: str) -> None:
    """Write text report atomically."""
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    os.replace(tmp, path)


# ---------- Main ----------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check IPv4 DNS servers and rank them by latency."
    )
    parser.add_argument(
        "input", nargs="?", default=DEFAULT_INPUT,
        help=f"JSON file with DNS servers (default: {DEFAULT_INPUT})"
    )
    parser.add_argument(
        "--timeout", type=float, default=3.0,
        help="DNS query timeout in seconds (default: 3)"
    )
    parser.add_argument(
        "--workers", type=int, default=50,
        help="simultaneous checks (default: 50)"
    )
    parser.add_argument(
        "--csv", default=DEFAULT_CSV,
        help=f"CSV output file (default: {DEFAULT_CSV})"
    )
    parser.add_argument(
        "--report", default=DEFAULT_REPORT,
        help=f"ranked text report (default: {DEFAULT_REPORT})"
    )
    parser.add_argument(
        "--limit", type=int, default=None,
        help="limit number of DNS servers to check (for testing)"
    )
    parser.add_argument(
        "--test-domain", default=TEST_DOMAIN,
        help=f"domain to resolve for testing (default: {TEST_DOMAIN})"
    )
    add_network_argument(parser)
    args = parser.parse_args()
    require_direct_network(args.interface)

    if args.timeout <= 0:
        parser.error("--timeout must be greater than zero")
    if args.workers < 1:
        parser.error("--workers must be at least 1")

    # Load DNS servers
    input_path = Path(args.input)
    if not input_path.is_file():
        # Try in Downloads folder
        downloads = Path.home() / "Downloads" / args.input
        if downloads.is_file():
            input_path = downloads
        else:
            print(f"Error: Cannot find {args.input}", file=sys.stderr)
            return 1

    log(f"Loading DNS servers from {input_path.name}...")
    dns_servers = load_dns_servers(input_path)

    if not dns_servers:
        print("No DNS servers found in input file.", file=sys.stderr)
        return 1

    log(f"Loaded {len(dns_servers)} unique DNS servers")

    # Apply limit if specified
    if args.limit:
        dns_servers = dns_servers[:args.limit]
        log(f"Limited to {len(dns_servers)} servers for testing")

    log(f"\nChecking {len(dns_servers)} IPv4 DNS servers...\n")

    # Check all DNS servers
    results: list[DNSCheckResult | None] = [None] * len(dns_servers)

    start_time = time.time()

    with ThreadPoolExecutor(max_workers=min(args.workers, len(dns_servers))) as pool:
        futures = {
            pool.submit(check_dns_server, dns_ip, args.timeout, args.test_domain): index
            for index, dns_ip in enumerate(dns_servers)
        }

        for future in as_completed(futures):
            results[futures[future]] = future.result()

    final: list[DNSCheckResult] = [r for r in results if r is not None]
    elapsed_time = time.time() - start_time

    # Generate summary
    accessible_count = sum(1 for r in final if r.accessible)
    inaccessible_count = len(final) - accessible_count

    log("\n" + "=" * 80)
    log("CHECK COMPLETE")
    log("=" * 80)
    log(f"Total checked: {len(final)}")
    log(f"{paint('Accessible:', GREEN_TEXT)} {accessible_count} ({accessible_count/len(final)*100:.1f}%)")
    log(f"{paint('Inaccessible:', RED_TEXT)} {inaccessible_count} ({inaccessible_count/len(final)*100:.1f}%)")
    log(f"Time elapsed: {elapsed_time:.1f} seconds")
    log("")

    # Save results
    csv_path = Path(args.csv)
    report_path = Path(args.report)

    try:
        write_csv_atomic(csv_path, final)
        log(f"CSV saved: {csv_path.resolve()}")

        report = build_ranked_report(final)
        write_text_atomic(report_path, report)
        log(f"Report saved: {report_path.resolve()}")
        log("")

        # Show top 10
        if accessible_count > 0:
            accessible = [r for r in final if r.accessible]
            accessible.sort(key=lambda x: x.latency_ms)

            log(paint("Top 10 Fastest DNS Servers:", f"{GREEN_TEXT};1"))
            for i, r in enumerate(accessible[:10], 1):
                log(f"  {i:2d}. {r.latency_ms:>7.2f} ms | {r.dns_ip}")

    except OSError as e:
        print(f"Cannot save results: {e}", file=sys.stderr)
        return 1

    return 0 if accessible_count > 0 else 2


if __name__ == "__main__":
    sys.exit(main())
