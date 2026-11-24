#!/usr/bin/env python3
"""
Website Accessibility Checker with optional DoH comparison.

Checks websites from world_top_2000 and world_next_2000 lists, measures latency,
records DNS filtering evidence and access failures separately.
"""

from __future__ import annotations

import argparse
import csv
import ipaddress
from collections import Counter
from http import HTTPStatus
import os
import socket
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from direct_network import add_network_argument, require_direct_network, website_addresses
from urllib.parse import urlparse

import dns.resolver
import requests
from requests.exceptions import RequestException

from doh_client import query_doh, verify_doh_endpoint
from live_terminal import append_live, start_live_terminal


DEFAULT_TOP_INPUT = "world_top_2000_with_rank_and_country.csv"
DEFAULT_NEXT_INPUT = "world_next_2000_by_country.csv"
DEFAULT_CSV = "website_check_results.csv"
DEFAULT_REPORT = "filtered_websites_report.txt"
DEFAULT_FASTEST_REPORT = "fastest_100_websites.txt"
DEFAULT_FILTERED_DETAILED = "filtered_websites_with_wrong_ips.txt"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
IPV4_DNS = "8.8.8.8"
GOOGLE_DOH = "https://dns.google/dns-query"  # Alternative DoH server
CLOUDFLARE_DOH = "https://cloudflare-dns.com/dns-query"  # Public hostname (use --cloudflare-ip for 162.159.36.1)
DNS_MESSAGE_MIME = "application/dns-message"


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


GREEN_CHECK = paint("✓", "92")
RED_CROSS = paint("✗", "91")
YELLOW_WARN = paint("⚠", "93")
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
class WebsiteCheckResult:
    domain: str
    url: str
    accessible: bool
    filtered: bool
    latency_ms: float | None
    ip_address: str
    ipv4_dns_ip: str
    doh_ip: str
    dns_mismatch: bool
    dns_mismatch_details: str
    status_code: int | None
    response_category: str
    status_chain: str
    filter_reason: str
    error: str
    checked_at: str
    rank: str
    country: str


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


def load_domains_from_csv(path: Path) -> list[tuple[str, str, str]]:
    """
    Load domains from CSV file.
    Returns list of (domain, rank, country) tuples.
    """
    domains: list[tuple[str, str, str]] = []

    with path.open("r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Try different possible column names
            domain = row.get("domain") or row.get("Domain") or row.get("website")
            rank = row.get("rank") or row.get("Rank") or ""
            country = (
                row.get("country_or_origin")
                or row.get("country")
                or row.get("Country")
                or "Unknown"
            )

            if domain:
                domain = domain.strip().lower()
                # Remove protocol if present
                if "://" in domain:
                    domain = domain.split("://", 1)[1]
                # Remove path if present
                domain = domain.split("/", 1)[0]
                # Remove port if present
                domain = domain.split(":", 1)[0]

                if domain:
                    domains.append((domain, str(rank), str(country)))

    return domains


def load_domains_from_txt(path: Path) -> list[tuple[str, str, str]]:
    """
    Load domains from TXT file (one per line).
    Returns list of (domain, rank, country) tuples.
    """
    text = path.read_text(encoding="utf-8-sig")
    domains: list[tuple[str, str, str]] = []

    for line_num, raw_line in enumerate(text.splitlines(), start=1):
        line = raw_line.strip().lower()
        if not line or line.startswith("#"):
            continue

        # Remove protocol if present
        if "://" in line:
            line = line.split("://", 1)[1]
        # Remove path if present
        line = line.split("/", 1)[0]
        # Remove port if present
        line = line.split(":", 1)[0]

        if line:
            domains.append((line, str(line_num), "Unknown"))

    return domains


# ---------- Checking ----------

def is_private_or_reserved_ip(ip_str: str) -> tuple[bool, str]:
    """Flag non-public answers for public website targets, including all 10/8."""
    for value in ip_str.split(","):
        value = value.strip()
        if not value:
            continue
        try:
            ip = ipaddress.ip_address(value)
        except ValueError:
            continue
        if ip.version == 4 and ip in ipaddress.ip_network("10.0.0.0/8"):
            return True, f"DNS filtering: 10.x.x.x answer ({value})"
        if not ip.is_global:
            return True, f"DNS filtering: non-public answer ({value})"
    return False, ""


def resolve_via_ipv4_dns(domain: str, timeout: float = 3.0) -> str:
    """
    Resolve domain using IPv4 DNS (8.8.8.8).
    Returns IP address or empty string on failure.
    """
    try:
        resolver = dns.resolver.Resolver(configure=False)
        resolver.nameservers = [IPV4_DNS]
        resolver.timeout = timeout
        resolver.lifetime = timeout

        answers = resolver.resolve(domain, 'A')
        if answers:
            return ",".join(dict.fromkeys(str(answer) for answer in answers))
    except Exception:
        pass
    return ""


def resolve_via_doh(doh_url: str, domain: str, timeout: float = 3.0) -> str:
    """
    Resolve domain using DoH (DNS-over-HTTPS).
    Returns IP address or empty string on failure.
    """
    try:
        return ",".join(query_doh(doh_url, domain, timeout, public_only=False).addresses)
    except Exception:
        return ""


def resolve_domain(domain: str, timeout: float = 3.0) -> tuple[str, bool, str]:
    """
    Resolve domain to IP address using direct bootstrap DNS.
    Returns (ip_address, is_filtered, filter_reason).
    """
    try:
        records = socket.getaddrinfo(domain, 443, socket.AF_INET, socket.SOCK_STREAM)
        ip_address = ",".join(dict.fromkeys(record[4][0] for record in records))
        is_filtered, reason = is_private_or_reserved_ip(ip_address)
        return ip_address, is_filtered, reason
    except socket.gaierror as e:
        return "", False, f"DNS resolution failed: {e}"
    except socket.timeout:
        return "", False, "DNS resolution timeout"
    except Exception as e:
        return "", False, f"DNS error: {type(e).__name__}"


def http_status_phrase(status_code: int) -> str:
    try:
        return HTTPStatus(status_code).phrase
    except ValueError:
        return "Unknown Status"


def http_status_description(status_code: int) -> str:
    phrase = http_status_phrase(status_code)
    if status_code < 300:
        return f"ACCESSIBLE — HTTP {status_code} {phrase}"
    if status_code < 400:
        return f"REDIRECT — HTTP {status_code} {phrase}"
    if status_code == 401:
        return f"LOGIN REQUIRED — HTTP {status_code} {phrase}; server responded"
    if status_code == 403:
        return f"FORBIDDEN — HTTP {status_code} {phrase}; reason unknown, server responded"
    if status_code == 451:
        return ("LEGAL RESTRICTION — HTTP 451 Unavailable For Legal Reasons; "
                "possible sanctions or local law, not confirmation of sanctions")
    if status_code == 429:
        return f"RATE LIMITED — HTTP {status_code} {phrase}; server responded"
    if status_code < 500:
        return f"HTTP CLIENT ERROR — {status_code} {phrase}; server responded"
    return f"HTTP SERVER ERROR — {status_code} {phrase}; server responded"


def website_status_group(result: WebsiteCheckResult) -> str:
    if result.filtered:
        return "FILTERED BY DNS"
    if result.status_code == 451:
        return "LEGAL RESTRICTION (451; possible sanctions)"
    if result.status_code == 403:
        return "FORBIDDEN (403; cause unknown)"
    if result.status_code == 401:
        return "LOGIN REQUIRED (401)"
    if result.accessible:
        return "ACCESSIBLE"
    if result.status_code is not None:
        return f"OTHER HTTP RESPONSE ({result.status_code})"
    return "INACCESSIBLE (no HTTP response)"


def compare_dns_results(
    domain: str,
    system_ip: str,
    ipv4_ip: str,
    doh_ip: str
) -> tuple[bool, str]:
    """
    Compare DNS results from different sources.
    Returns (is_mismatch, details).
    """
    details_parts = []

    # Differences are informational; public CDNs legitimately return different IPs.
    if ipv4_ip and doh_ip and set(ipv4_ip.split(",")) != set(doh_ip.split(",")):
        details_parts.append(
            f"IPv4 DNS: {ipv4_ip} vs DoH: {doh_ip}"
        )

    # Compare direct bootstrap DNS with IPv4 DNS
    if system_ip and ipv4_ip and set(system_ip.split(",")) != set(ipv4_ip.split(",")):
        details_parts.append(
            f"Direct bootstrap DNS: {system_ip} vs IPv4 DNS: {ipv4_ip}"
        )

    # Compare direct bootstrap DNS with DoH
    if system_ip and doh_ip and set(system_ip.split(",")) != set(doh_ip.split(",")):
        details_parts.append(
            f"Direct bootstrap DNS: {system_ip} vs DoH: {doh_ip}"
        )

    if details_parts:
        return True, " | ".join(details_parts)

    return False, ""


def check_website(
    domain: str, rank: str, country: str, timeout: float,
    doh_server: str = "", follow_redirects: bool = True,
) -> WebsiteCheckResult:
    """Measure access independently of DoH; keep DNS evidence separate from errors."""
    log(f"Checking: {domain} ...")
    checked_at = datetime.now().isoformat(timespec="seconds")
    ip_address, primary_filtered, dns_error = resolve_domain(domain, timeout)
    ipv4_ip = resolve_via_ipv4_dns(domain, timeout)
    doh_ip = resolve_via_doh(doh_server, domain, timeout) if doh_server else ""
    mismatch, mismatch_details = compare_dns_results(domain, ip_address, ipv4_ip, doh_ip)
    evidence = []
    for source, addresses in (("Direct DNS", ip_address), (f"IPv4 DNS {IPV4_DNS}", ipv4_ip), ("DoH", doh_ip)):
        suspicious, reason = is_private_or_reserved_ip(addresses)
        if suspicious:
            evidence.append(f"{source}: {reason}")

    def result(accessible=False, url=None, latency=None, status=None, error="", status_chain=""):
        response_category = http_status_description(status) if status is not None else (
            "DNS FILTERED" if primary_filtered else "NO HTTP RESPONSE"
        )
        outcome = WebsiteCheckResult(
            domain=domain, url=url or f"https://{domain}", accessible=accessible,
            filtered=bool(evidence), latency_ms=latency, ip_address=ip_address,
            ipv4_dns_ip=ipv4_ip, doh_ip=doh_ip, dns_mismatch=mismatch,
            dns_mismatch_details=mismatch_details, status_code=status,
            response_category=response_category, status_chain=status_chain,
            filter_reason=" | ".join(evidence), error=error,
            checked_at=checked_at, rank=rank, country=country,
        )
        log(f"{'✓' if accessible else '✗'} {domain}  "
            f"{response_category}"
            + (f" | HTTP chain: {status_chain}" if status_chain else "")
            + (f" | DNS FILTERING: {outcome.filter_reason}" if evidence
               else " | No DNS-filtering evidence")
            + (f"  {error}" if error else ""))
        return outcome

    # Do not connect to a private DNS replacement/block-page address.
    if primary_filtered:
        return result(error=dns_error)
    connection_ips = ip_address
    if not connection_ips:
        # A failed primary resolver need not prevent access via another source.
        for alternative in (ipv4_ip, doh_ip):
            if alternative and not is_private_or_reserved_ip(alternative)[0]:
                connection_ips = alternative
                break
    if not connection_ips:
        return result(error=dns_error or "No usable public IPv4 DNS answer")

    errors = []
    with website_addresses(domain, tuple(connection_ips.split(","))):
        for protocol in ("https", "http"):
            url = f"{protocol}://{domain}"
            started = time.perf_counter()
            try:
                with requests.Session() as session:
                    session.trust_env = False
                    with session.get(url, headers={"User-Agent": USER_AGENT}, timeout=timeout,
                                     allow_redirects=follow_redirects, verify=True) as response:
                        latency = round((time.perf_counter() - started) * 1000, 2)
                        responses = [*response.history, response]
                        status_chain = " -> ".join(
                            f"{item.status_code} {http_status_phrase(item.status_code)}"
                            for item in responses
                        )
                        return result(response.status_code < 400, url, latency,
                                      response.status_code,
                                      "",
                                      status_chain)
            except RequestException as exc:
                errors.append(f"{protocol}: {type(exc).__name__}: {exc}")
    # A timeout/reset/TLS error proves inaccessibility, not the cause of it.
    return result(error=" | ".join(errors))


# ---------- Reporting ----------

def write_csv_atomic(path: Path, results: list[WebsiteCheckResult]) -> None:
    """Write all results to CSV file."""
    tmp = path.with_name(path.name + ".tmp")

    with tmp.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow([
            "domain", "url", "rank", "country", "accessible", "filtered",
            "latency_ms", "system_ip", "ipv4_dns_ip", "doh_ip",
            "dns_mismatch", "dns_mismatch_details", "status_code",
            "response_category", "status_chain",
            "filter_reason", "error", "checked_at"
        ])

        for r in results:
            writer.writerow([
                r.domain,
                r.url,
                r.rank,
                r.country,
                "yes" if r.accessible else "no",
                "yes" if r.filtered else "no",
                f"{r.latency_ms:.2f}" if r.latency_ms is not None else "",
                r.ip_address,
                r.ipv4_dns_ip,
                r.doh_ip,
                "yes" if r.dns_mismatch else "no",
                r.dns_mismatch_details,
                r.status_code or "",
                r.response_category,
                r.status_chain,
                r.filter_reason,
                r.error,
                r.checked_at
            ])

    os.replace(tmp, path)


def observed_http_codes(result: WebsiteCheckResult) -> list[int]:
    codes = []
    for response in result.status_chain.split(" -> "):
        try:
            codes.append(int(response.split(maxsplit=1)[0]))
        except (ValueError, IndexError):
            continue
    if not codes and result.status_code is not None:
        codes.append(result.status_code)
    return codes


def build_filtered_report(results: list[WebsiteCheckResult]) -> str:
    accessible = sum(r.accessible for r in results)
    filtered = [r for r in results if r.filtered]
    status_counts = Counter(
        code for result in results for code in observed_http_codes(result)
    )
    responded = sum(status_counts.values())
    lines = [
        "WEBSITE ACCESSIBILITY AND DNS FILTERING REPORT", "=" * 80,
        f"Total websites checked: {len(results)}",
        f"Accessible: {accessible}", f"Inaccessible: {len(results) - accessible}",
        f"HTTP responses received (redirect hops included): {responded}",
        f"DNS filtering evidence: {len(filtered)}", "",
        "HTTP status counts:",
        *[f"  {code} {http_status_phrase(code)}: {count}"
          for code, count in sorted(status_counts.items())],
        f"  HTTP 451 legal restriction responses: {status_counts.get(451, 0)}",
        f"  HTTP 403 forbidden responses (cause unknown): {status_counts.get(403, 0)}",
        "",
        "HTTP 451 means unavailable for legal reasons; this can involve sanctions or local law,",
        "but the status code alone does not confirm a sanction. HTTP 403 also has many causes.",
        "",
        "10.x.x.x/non-public DNS answers are flagged for public website targets.",
        "Public-IP differences alone can be normal CDN/geographic differences.",
        "Timeouts, TLS errors and HTTP errors do not by themselves prove filtering.", "",
    ]
    for r in results:
        lines += [f"{r.domain}: {r.response_category}",
                  f"  HTTP status: {r.status_code if r.status_code is not None else '[no response]'}",
                  f"  HTTP redirects/status chain: {r.status_chain or '[none]'}",
                  f"  DNS filtering status: {'FILTERING EVIDENCE' if r.filtered else 'no DNS-filtering evidence'}",
                  f"  Direct DNS: {r.ip_address or '[failed]'}",
                  f"  IPv4 DNS ({IPV4_DNS}): {r.ipv4_dns_ip or '[failed]'}",
                  f"  DoH: {r.doh_ip or '[unavailable/not queried]'}"]
        if r.filter_reason:
            lines.append(f"  DNS filtering evidence: {r.filter_reason}")
        if r.dns_mismatch:
            lines.append(f"  DNS difference (informational): {r.dns_mismatch_details}")
        if r.error:
            lines.append(f"  Access error: {r.error}")
        lines.append("")
    return "\n".join(lines) + "\n"


def build_fastest_100_report(results: list[WebsiteCheckResult]) -> str:
    """
    Build report of 100 fastest accessible websites.
    """
    # Get accessible sites with latency
    accessible_with_latency = [
        r for r in results
        if r.accessible and r.latency_ms is not None
    ]

    # Sort by latency (fastest first)
    accessible_with_latency.sort(key=lambda x: x.latency_ms)

    # Take top 100
    fastest_100 = accessible_with_latency[:100]

    lines = [
        "=" * 80,
        "TOP 100 FASTEST WEBSITES - HTTP RESPONSE LATENCY",
        "=" * 80,
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "",
        f"Total accessible websites checked: {len(accessible_with_latency)}",
        f"Showing fastest: {len(fastest_100)}",
        "",
        "=" * 80,
        "RANK | LATENCY (ms) | DOMAIN | COUNTRY",
        "=" * 80,
        ""
    ]

    for rank, r in enumerate(fastest_100, 1):
        country_info = f" [{r.country}]" if r.country != "Unknown" else ""
        ip_info = f" (IP: {r.ip_address})" if r.ip_address else ""
        lines.append(
            f"{rank:3d}. | {r.latency_ms:>10.2f} ms | {r.domain}{country_info}{ip_info}"
        )

    # Statistics
    if fastest_100:
        avg_latency = sum(r.latency_ms for r in fastest_100) / len(fastest_100)
        min_latency = fastest_100[0].latency_ms
        max_latency = fastest_100[-1].latency_ms

        lines.append("")
        lines.append("=" * 80)
        lines.append("STATISTICS")
        lines.append("=" * 80)
        lines.append(f"Fastest website: {fastest_100[0].domain} ({min_latency:.2f} ms)")
        lines.append(f"Slowest in top 100: {fastest_100[-1].domain} ({max_latency:.2f} ms)")
        lines.append(f"Average latency (top 100): {avg_latency:.2f} ms")

    lines.append("")
    return "\n".join(lines)


def build_filtered_with_wrong_ips_report(results: list[WebsiteCheckResult]) -> str:
    return build_filtered_report([result for result in results if result.filtered])


def write_text_atomic(path: Path, content: str) -> None:
    """Write text report atomically."""
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    os.replace(tmp, path)


# ---------- Main ----------

def main() -> int:
    global IPV4_DNS
    parser = argparse.ArgumentParser(
        description="Check website accessibility with optional DoH and DNS filtering evidence."
    )
    parser.add_argument(
        "--top", default=DEFAULT_TOP_INPUT,
        help=f"CSV file with top 2000 websites (default: {DEFAULT_TOP_INPUT})"
    )
    parser.add_argument(
        "--next", default=DEFAULT_NEXT_INPUT,
        help=f"CSV file with next 2000 websites (default: {DEFAULT_NEXT_INPUT})"
    )
    parser.add_argument(
        "--timeout", type=float, default=10.0,
        help="connect/read timeout in seconds (default: 10)"
    )
    parser.add_argument(
        "--workers", type=int, default=20,
        help="simultaneous checks (default: 20)"
    )
    parser.add_argument(
        "--progress-every", type=int, default=25,
        help="print completed/total progress every N websites (default: 25)"
    )
    parser.add_argument(
        "--csv", default=DEFAULT_CSV,
        help=f"CSV output with all results (default: {DEFAULT_CSV})"
    )
    parser.add_argument(
        "--report", default=DEFAULT_REPORT,
        help=f"filtered websites report (default: {DEFAULT_REPORT})"
    )
    parser.add_argument(
        "--fastest-report", default=DEFAULT_FASTEST_REPORT,
        help=f"fastest 100 websites report (default: {DEFAULT_FASTEST_REPORT})"
    )
    parser.add_argument(
        "--filtered-details", default=DEFAULT_FILTERED_DETAILED,
        help=f"filtered websites with wrong IPs report (default: {DEFAULT_FILTERED_DETAILED})"
    )
    parser.add_argument(
        "--limit", type=int, default=None,
        help="limit number of websites to check (for testing)"
    )
    parser.add_argument(
        "--doh", default="",
        help="optional DoH server URL; website checking works without it"
    )
    parser.add_argument(
        "--cloudflare-ip", action="store_true",
        help="Use Cloudflare IP DoH (https://162.159.36.1/dns-query) instead of hostname"
    )
    parser.add_argument("--no-doh", action="store_true", help="check websites using IPv4 DNS only")
    parser.add_argument("--dns-server", default=IPV4_DNS, help="IPv4 DNS comparison server (default: 8.8.8.8)")
    add_network_argument(parser)
    args = parser.parse_args()
    try:
        if ipaddress.ip_address(args.dns_server).version != 4:
            raise ValueError("IPv4 address required")
    except ValueError:
        parser.error("--dns-server must be an IPv4 address")
    if args.timeout <= 0:
        parser.error("--timeout must be greater than zero")
    if args.workers < 1:
        parser.error("--workers must be at least 1")
    if args.progress_every < 1:
        parser.error("--progress-every must be at least 1")
    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be at least 1")
    IPV4_DNS = args.dns_server
    require_direct_network(args.interface)

    # Use Cloudflare IP if requested
    doh_server = args.doh
    if args.cloudflare_ip:
        doh_server = "https://162.159.36.1/dns-query"
        log(f"Using Cloudflare IP DoH: {doh_server}\n")

    if args.no_doh:
        doh_server = ""
    if doh_server:
        working, _, error = verify_doh_endpoint(doh_server, timeout=args.timeout)
        if not working:
            log(f"DoH unavailable ({error}); continuing with IPv4 DNS only.")
            doh_server = ""
    if not doh_server:
        log("Website mode: direct IPv4 DNS; DoH is optional and disabled for this run.")


    # Load domains
    all_domains: list[tuple[str, str, str]] = []

    # Load top 2000
    top_path = resolve_input(args.top)
    if top_path.is_file():
        try:
            if top_path.suffix.lower() == ".csv":
                domains = load_domains_from_csv(top_path)
            else:
                domains = load_domains_from_txt(top_path)
            all_domains.extend(domains)
            log(f"Loaded {len(domains)} domains from {top_path.name}")
        except Exception as e:
            print(f"Warning: Cannot read {top_path}: {e}", file=sys.stderr)

    # Load next 2000
    next_path = resolve_input(args.next)
    if next_path.is_file():
        try:
            if next_path.suffix.lower() == ".csv":
                domains = load_domains_from_csv(next_path)
            else:
                domains = load_domains_from_txt(next_path)
            all_domains.extend(domains)
            log(f"Loaded {len(domains)} domains from {next_path.name}")
        except Exception as e:
            print(f"Warning: Cannot read {next_path}: {e}", file=sys.stderr)

    if not all_domains:
        print("No domains found in input files.", file=sys.stderr)
        return 1

    # Remove duplicates while preserving order
    seen = set()
    unique_domains = []
    for domain, rank, country in all_domains:
        if domain not in seen:
            seen.add(domain)
            unique_domains.append((domain, rank, country))

    # Apply limit if specified
    if args.limit:
        unique_domains = unique_domains[:args.limit]

    total_websites = len(unique_domains)
    log(f"\nChecking {total_websites} unique websites...\n")
    log(f"Progress: 0/{total_websites} websites completed (0.0%)")
    live_path = start_live_terminal(
        "Live website status groups",
        [
            f"Checking {total_websites} websites; updates are appended live.",
            "Groups: DNS filtered | legal restriction (451) | forbidden (403) | login required (401) | accessible | other",
            "HTTP 451 is a legal-restriction indicator, not proof of sanctions.",
        ],
    )
    group_counts: Counter[str] = Counter()
    if live_path:
        log(f"Live status groups are also open in a new terminal: {live_path}")
        append_live(live_path, f"Starting website scan: 0/{total_websites}")
    else:
        log("Separate terminal unavailable; live status groups will remain in this terminal.")

    # Check all websites
    results: list[WebsiteCheckResult | None] = [None] * len(unique_domains)

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(
                check_website,
                domain,
                rank,
                country,
                args.timeout,
                doh_server
            ): index
            for index, (domain, rank, country) in enumerate(unique_domains)
        }

        for completed, future in enumerate(as_completed(futures), start=1):
            result = future.result()
            results[futures[future]] = result
            group = website_status_group(result)
            group_counts[group] += 1
            http_status = (
                f"HTTP {result.status_code} {http_status_phrase(result.status_code)}"
                if result.status_code is not None else "no HTTP response"
            )
            append_live(
                live_path,
                f"{completed}/{total_websites} | {group} | {result.domain} | {http_status}",
                f"  DNS filtering evidence: {'yes' if result.filtered else 'no'}",
                "  Current groups: " + " | ".join(
                    f"{name}: {count}" for name, count in sorted(group_counts.items())
                ),
                "",
            )
            if completed % args.progress_every == 0 or completed == total_websites:
                percent = completed / total_websites * 100
                log(f"Progress: {completed}/{total_websites} websites completed "
                    f"({percent:.1f}%)")

    final: list[WebsiteCheckResult] = [r for r in results if r is not None]
    append_live(
        live_path,
        "WEBSITE SCAN COMPLETE",
        f"Total: {total_websites}",
        *[f"{name}: {count}" for name, count in sorted(group_counts.items())],
        "HTTP 451 responses indicate legal restriction only; sanctions are not confirmed.",
    )

    # Generate summary
    accessible_count = sum(1 for r in final if r.accessible)
    filtered_count = sum(1 for r in final if r.filtered)

    log("\n" + "=" * 80)
    log("CHECK COMPLETE")
    log("=" * 80)
    log(f"Total checked: {len(final)}")
    log(f"{paint('Accessible:', GREEN_TEXT)} {accessible_count} "
        f"({accessible_count/len(final)*100:.1f}%)")
    log(f"{paint('DNS filtering evidence:', RED_TEXT)} {filtered_count} "
        f"({filtered_count/len(final)*100:.1f}%)")
    status_counts = Counter(
        code for result in final for code in observed_http_codes(result)
    )
    log("HTTP responses: " + ", ".join(
        f"{code} {http_status_phrase(code)}: {count}"
        for code, count in sorted(status_counts.items())
    ))
    log(f"HTTP 451 legal restriction indicators: {status_counts.get(451, 0)} "
        "(not proof of sanctions)")
    log("")

    # Save results
    csv_path = Path(args.csv)
    report_path = Path(args.report)
    fastest_path = Path(args.fastest_report)
    filtered_details_path = Path(args.filtered_details)

    try:
        # Save main CSV
        write_csv_atomic(csv_path, final)
        log(f"CSV saved: {csv_path.resolve()}")

        # Save filtered websites report
        report = build_filtered_report(final)
        write_text_atomic(report_path, report)
        log(f"Filtered report saved: {report_path.resolve()}")

        # Save fastest 100 websites report
        fastest_report = build_fastest_100_report(final)
        write_text_atomic(fastest_path, fastest_report)
        log(f"Fastest 100 report saved: {fastest_path.resolve()}")

        # Save filtered websites with wrong IPs report
        filtered_details = build_filtered_with_wrong_ips_report(final)
        write_text_atomic(filtered_details_path, filtered_details)
        log(f"Filtered details (wrong IPs) report saved: {filtered_details_path.resolve()}")
        log("")

        # Print summary of filtered sites
        if filtered_count > 0:
            log(paint(
                f"⚠ DNS filtering evidence found for {filtered_count} websites.",
                YELLOW_TEXT
            ))
            log(f"See detailed reports:")
            log(f"  - {report_path.name}")
            log(f"  - {filtered_details_path.name} (DNS filtering evidence)")
        else:
            log(paint("No non-public DNS answers detected; see access results for failures.", GREEN_TEXT))

        # Print fastest websites info
        accessible_with_latency = [r for r in final if r.accessible and r.latency_ms]
        if accessible_with_latency:
            log("")
            log(paint(f"✓ Fastest 100 websites report saved: {fastest_path.name}", GREEN_TEXT))
            fastest_3 = sorted(accessible_with_latency, key=lambda x: x.latency_ms)[:3]
            log(f"Top 3 fastest websites:")
            for i, r in enumerate(fastest_3, 1):
                log(f"  {i}. {r.domain} - {r.latency_ms:.2f} ms")

    except OSError as e:
        print(f"Cannot save results: {e}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
