#!/usr/bin/env python3
"""
DNS-over-HTTPS (DoH) endpoint checker.

Reads DoH URLs (one per line), sends a real DNS query to each one using the
RFC 8484 GET method, measures latency, and writes:
  * doh_results.csv - every endpoint with its status and latency
  * doh_results.txt - accessible endpoints ranked fastest first
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from direct_network import add_network_argument, require_direct_network

from statistics import median

from doh_client import exchange_doh, error_text, DEFAULT_PROBE_DOMAINS
from live_terminal import append_live, start_live_terminal


DEFAULT_INPUT = "DOH_MAX_PUBLIC_ENDPOINTS.txt"
DEFAULT_CSV = "doh_results.csv"
DEFAULT_TXT = "doh_results.txt"


# ---------- Terminal setup ----------

USE_COLOR = sys.stdout.isatty() and "NO_COLOR" not in os.environ

if USE_COLOR and os.name == "nt":
    os.system("")  # enables ANSI escape codes in Windows terminals

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except AttributeError:  # Python < 3.7 or non-standard stdout
    pass


def paint(text: str, color_code: str) -> str:
    return f"\033[{color_code}m{text}\033[0m" if USE_COLOR else text


BLUE_TICK = paint("✓", "94")
GREEN_TEXT = "92"
RED_CROSS = paint("✗", "91")

_print_lock = threading.Lock()


def log(message: str = "") -> None:
    """Print from worker threads without interleaving lines."""
    with _print_lock:
        print(message, flush=True)


# ---------- Data model ----------

@dataclass(frozen=True)
class CheckResult:
    url: str
    accessible: bool
    latency_ms: float | None
    dns_rcode: str
    error: str
    checked_at: str
    successful_attempts: int = 0
    attempts: int = 1
    probe_domains: str = ""
    domain_results: str = "{}"


# ---------- Input ----------

def resolve_input(name: str) -> Path:
    """Use the path as given, or fall back to the folder containing this script."""
    path = Path(name)
    if path.is_file():
        return path
    if not path.is_absolute():
        alternative = Path(__file__).resolve().parent / path
        if alternative.is_file():
            return alternative
    return path


def load_endpoints(path: Path) -> list[str]:
    """Return unique, non-empty, non-comment lines in file order."""
    text = path.read_text(encoding="utf-8-sig")
    seen: set[str] = set()
    urls: list[str] = []

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or line in seen:
            continue
        seen.add(line)
        urls.append(line)

    return urls


# ---------- Checking ----------

def check_endpoint(url: str, timeout: float, domain: str,
                   attempts: int = len(DEFAULT_PROBE_DOMAINS), min_successes: int = 1) -> CheckResult:
    checked_at = datetime.now().isoformat(timespec="seconds")
    latencies = []
    errors = []
    domain_results = {}
    domains = tuple(part.strip() for part in domain.split(",") if part.strip())
    if not domains:
        domains = DEFAULT_PROBE_DOMAINS
    for attempt in range(attempts):
        probe_domain = domains[attempt % len(domains)]
        try:
            reply = exchange_doh(url, probe_domain, timeout)
            latencies.append(reply.latency_ms)
            domain_results[probe_domain] = {
                "rcode": reply.rcode,
                "ips": list(reply.addresses),
                "error": "",
            }
        except Exception as exc:
            domain_results[probe_domain] = {
                "rcode": getattr(exc, "rcode", ""),
                "ips": [],
                "error": error_text(exc),
            }
            errors.append(f"{probe_domain} attempt {attempt + 1}: {error_text(exc)}")

    accessible = len(latencies) >= min_successes
    latency = round(median(latencies), 2) if latencies else None
    error = "; ".join(errors)
    rcode = "; ".join(f"{name}={item['rcode']}" for name, item in domain_results.items())
    status = "RESPONDED" if accessible else "NO RESPONSE"
    result = CheckResult(url, accessible, latency, rcode, error, checked_at,
                         len(latencies), attempts, ",".join(domains),
                         json.dumps(domain_results, sort_keys=True))

    return result


def format_endpoint_block(result: CheckResult, endpoint_index: int = 0,
                          endpoint_total: int = 0) -> str:
    """Format one complete, readable result block for the live printer."""
    heading = f"[{endpoint_index}/{endpoint_total}] " if endpoint_total else ""
    icon = BLUE_TICK if result.accessible else RED_CROSS
    lines = [f"{icon} {heading}{result.successful_attempts}/{result.attempts} DNS replies | {result.url}"]
    domain_results = json.loads(result.domain_results)
    for probe_domain in result.probe_domains.split(","):
        item = domain_results.get(probe_domain)
        if item is None:
            detail = "not queried"
        elif item["ips"]:
            detail = f"{item['rcode']} | IP: {', '.join(item['ips'])}"
        elif item["error"]:
            detail = f"NO REPLY | {item['error']}"
        else:
            detail = f"{item['rcode']} | no A-record IP"
        lines.append(f"  {probe_domain:<20} {detail}")
    lines.append(
        f"  Median latency: {result.latency_ms:.2f} ms | "
        f"{'RESPONDED' if result.accessible else 'NO RESPONSE'}"
        if result.latency_ms is not None else
        f"  {'RESPONDED' if result.accessible else 'NO RESPONSE'}"
    )
    lines.append("-" * 80)
    return "\n".join(lines)


def choose_display_delay(requested: float | None) -> float:
    """Prompt for a readable live-output pace unless the user set one explicitly."""
    if requested is not None:
        return requested
    if not sys.stdin.isatty():
        return 1.5

    while True:
        try:
            answer = input("Slow the live display so you can read each server? [Y/n]: ").strip().lower()
        except EOFError:
            return 1.5
        if answer in ("n", "no"):
            return 0.0
        if answer not in ("", "y", "yes"):
            print("Please answer yes or no.")
            continue
        try:
            raw_delay = input("Seconds between server results [1.5] (0 for no pause): ").strip()
        except EOFError:
            return 1.5
        if not raw_delay:
            return 1.5
        try:
            delay = float(raw_delay)
        except ValueError:
            print("Enter a number of seconds, such as 1.5.")
            continue
        if delay >= 0:
            return delay
        print("Delay must be zero or greater.")


# ---------- Reporting ----------

def ranked(results: list[CheckResult]) -> list[CheckResult]:
    """Accessible endpoints, lowest latency first."""
    return sorted(
        (r for r in results if r.accessible),
        key=lambda r: r.latency_ms,
    )


def build_report(results: list[CheckResult], mark: str = "") -> str:
    accessible = ranked(results)
    prefix = f"{mark} " if mark else ""

    lines = [
        "DOH ENDPOINTS THAT REPLIED — LOWEST MEDIAN LATENCY FIRST",
        "=" * 80,
        "",
    ]

    if accessible:
        for rank, r in enumerate(accessible, start=1):
            lines.append(
                f"{prefix}{rank:>3}. {r.latency_ms:>10.2f} ms | {r.url} "
                f"({r.successful_attempts}/{r.attempts} DNS replies) "
                f"{r.domain_results}"
            )
    else:
        lines.append("No accessible DoH endpoints found.")

    lines += ["", f"Replied: {len(accessible)} / {len(results)} checked"]
    return "\n".join(lines) + "\n"


def write_text_atomic(path: Path, content: str) -> None:
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    os.replace(tmp, path)


def write_csv_atomic(path: Path, results: list[CheckResult]) -> None:
    accessible = ranked(results)
    inaccessible = [r for r in results if not r.accessible]
    tmp = path.with_name(path.name + ".tmp")

    with tmp.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow([
            "rank", "latency_ms", "accessible", "url",
            "dns_rcode", "error", "checked_at", "successful_attempts", "attempts",
            "probe_domains", "domain_results",
        ])
        for rank, r in enumerate(accessible, start=1):
            writer.writerow([
                rank, f"{r.latency_ms:.2f}", "yes", r.url,
                r.dns_rcode, r.error, r.checked_at, r.successful_attempts, r.attempts,
                r.probe_domains, r.domain_results,
            ])
        for r in inaccessible:
            writer.writerow([
                "", f"{r.latency_ms:.2f}" if r.latency_ms is not None else "", "no", r.url,
                r.dns_rcode, r.error, r.checked_at, r.successful_attempts, r.attempts,
                r.probe_domains, r.domain_results,
            ])

    os.replace(tmp, path)


# ---------- Main ----------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check DNS-over-HTTPS endpoints and rank them by latency."
    )
    parser.add_argument(
        "input", nargs="?", default=DEFAULT_INPUT,
        help=f"file with one DoH URL per line (default: {DEFAULT_INPUT})",
    )
    parser.add_argument(
        "--timeout", type=float, default=5.0,
        help="connect/read timeout in seconds (default: 5)",
    )
    parser.add_argument(
        "--workers", type=int, default=10,
        help="simultaneous checks (default: 10)",
    )
    parser.add_argument(
        "--display-delay", type=float, default=None,
        help="set seconds between live result blocks; otherwise ask at startup",
    )
    parser.add_argument(
        "--domain", default=",".join(DEFAULT_PROBE_DOMAINS),
        help="comma-separated domains to query (default: six social and control domains)",
    )
    parser.add_argument(
        "--csv", default=DEFAULT_CSV,
        help=f"CSV output with all endpoints (default: {DEFAULT_CSV})",
    )
    parser.add_argument(
        "--txt", default=DEFAULT_TXT,
        help=f"ranked text report (default: {DEFAULT_TXT})",
    )
    parser.add_argument("--attempts", type=int, default=len(DEFAULT_PROBE_DOMAINS),
                        help="queries per endpoint (default: 6)")
    parser.add_argument("--min-successes", type=int, default=None,
                        help="valid DNS replies required (default: 1; endpoint is reachable if it replies)")
    add_network_argument(parser)
    args = parser.parse_args()
    if args.min_successes is None:
        args.min_successes = 1
    if args.attempts < 1 or not 1 <= args.min_successes <= args.attempts:
        parser.error("require 1 <= --min-successes <= --attempts")

    if args.timeout <= 0:
        parser.error("--timeout must be greater than zero")
    if args.workers < 1:
        parser.error("--workers must be at least 1")
    if args.display_delay is not None and args.display_delay < 0:
        parser.error("--display-delay must be zero or greater")

    input_path = resolve_input(args.input)
    try:
        urls = load_endpoints(input_path)
    except (OSError, UnicodeDecodeError) as exc:
        print(f"Cannot read {input_path}: {exc}", file=sys.stderr)
        return 1

    if not urls:
        print("No URLs found in the input file.", file=sys.stderr)
        return 1

    args.display_delay = choose_display_delay(args.display_delay)
    require_direct_network(args.interface)

    live_path = start_live_terminal(
        "DoH checker — live endpoint groups",
        [
            f"Resolving: {args.domain}",
            "Groups: valid DNS replies | no valid DNS replies",
            "Each endpoint block includes the domain IPs and DNS response codes.",
            "ACCESSIBLE DOH SERVERS SO FAR (updated as checks finish):",
            "(none yet)",
            "-" * 80,
        ],
    )
    if live_path:
        log(f"DoH endpoint groups are also open in a new terminal: {live_path}")
    else:
        log("Separate terminal unavailable; DoH groups will remain in this terminal.")

    log(f"Checking {len(urls)} DoH endpoints for: {args.domain}. "
        f"An endpoint counts as accessible after {args.min_successes} valid DNS reply/replies; "
        "TLS is verified and proxies are disabled.\n")

    # Keep results in input-file order.
    results: list[CheckResult | None] = [None] * len(urls)
    group_counts = {"valid DNS replies": 0, "no valid DNS replies": 0}

    with ThreadPoolExecutor(max_workers=min(args.workers, len(urls))) as pool:
        futures = {
            pool.submit(check_endpoint, url, args.timeout, args.domain,
                        args.attempts, args.min_successes): index
            for index, url in enumerate(urls)
        }
        for completed, future in enumerate(as_completed(futures), start=1):
            index = futures[future]
            result = future.result()
            results[index] = result
            block = format_endpoint_block(result, completed, len(urls))
            log(block)
            group = "valid DNS replies" if result.accessible else "no valid DNS replies"
            group_counts[group] += 1
            progress_line = (
                f"ACCESSIBLE [{result.successful_attempts}/{result.attempts}] | {result.url}"
                if result.accessible else
                f"NO VALID DNS REPLY [{result.successful_attempts}/{result.attempts}] | {result.url}"
            )
            append_live(
                live_path,
                progress_line,
                block,
                f"DoH groups so far: replied={group_counts['valid DNS replies']} | "
                f"no valid reply={group_counts['no valid DNS replies']}",
                "",
            )
            if completed < len(urls) and args.display_delay:
                time.sleep(args.display_delay)

    final: list[CheckResult] = [r for r in results if r is not None]
    append_live(
        live_path,
        "DOH SCAN COMPLETE",
        f"Endpoints that replied: {group_counts['valid DNS replies']}",
        f"Endpoints with no valid reply: {group_counts['no valid DNS replies']}",
    )

    log("\n" + "=" * 80)
    log(build_report(final, mark=BLUE_TICK))

    csv_path = Path(args.csv)
    txt_path = Path(args.txt)
    try:
        write_csv_atomic(csv_path, final)
        write_text_atomic(txt_path, build_report(final))
    except OSError as exc:
        print(f"Cannot save results: {exc}", file=sys.stderr)
        return 1

    log(f"CSV saved:  {csv_path.resolve()}")
    log(f"Text saved: {txt_path.resolve()}")

    # Exit code 0 if at least one endpoint works, 2 otherwise.
    return 0 if any(r.accessible for r in final) else 2


if __name__ == "__main__":
    sys.exit(main())
