#!/usr/bin/env python3
"""
Master Website Checker with DoH Verification.

This orchestrator:
1. Runs check_doh.py to find accessible DoH servers
2. Double-checks the top DoH results to verify they're working
3. Selects the best 3 DoH servers (lowest latency)
4. Runs website checks with selected DoH servers, or IPv4 DNS only
5. Prints comprehensive report of both DoH and website results
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from live_terminal import append_live, child_environment, start_live_terminal

from direct_network import add_network_argument, require_direct_network
from typing import Any

import csv


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


GREEN = "92"
RED = "91"
YELLOW = "93"
BLUE = "94"
CYAN = "96"
BOLD = "1"


def print_header(text: str) -> None:
    print("\n" + "=" * 80)
    print(paint(text.center(80), f"{BOLD};{CYAN}"))
    print("=" * 80 + "\n")


def print_section(text: str) -> None:
    print("\n" + paint(f"▶ {text}", f"{BOLD};{BLUE}"))
    print("-" * 80)


def print_success(text: str) -> None:
    print(paint(f"✓ {text}", GREEN))


def print_error(text: str) -> None:
    print(paint(f"✗ {text}", RED))


def print_warning(text: str) -> None:
    print(paint(f"⚠ {text}", YELLOW))


def print_info(text: str) -> None:
    print(f"  {text}")


# ---------- DoH Verification ----------

from doh_client import verify_doh_endpoint, DEFAULT_PROBE_DOMAINS


# ---------- Step 1: Run check_doh.py ----------

def run_check_doh() -> tuple[bool, list[dict[str, Any]]]:
    """
    Run check_doh.py and return the accessible DoH servers.
    Returns (success, list_of_doh_results).
    """
    print_section("STEP 1: Running check_doh.py to find accessible DoH servers")

    script_dir = Path(__file__).parent
    check_doh_script = script_dir / "check_doh.py"

    if not check_doh_script.exists():
        print_error(f"check_doh.py not found at {check_doh_script}")
        return False, []

    try:
        # Run check_doh.py with LIVE output streaming
        print_info("Starting DoH server checks (all unique endpoints in input file)...\n")

        process = subprocess.Popen(
            [sys.executable, str(check_doh_script)],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,  # Line buffered for real-time output
            cwd=str(script_dir)
        )

        # Stream output in real-time - show EVERY DoH being checked!
        for line in process.stdout:
            print(line, end='', flush=True)

        process.wait()

        print_info(f"\ncheck_doh.py exit code: {process.returncode}")

        if process.returncode != 0:
            print_error("DoH scan failed; refusing to use old CSV results")
            return False, []

        # Parse the CSV results
        csv_file = script_dir / "doh_results.csv"
        if not csv_file.exists():
            print_error("doh_results.csv not found")
            return False, []

        doh_results = []
        with csv_file.open("r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("accessible", "").lower() == "yes":
                    doh_results.append({
                        "url": row["url"],
                        "rank": int(row.get("rank", 0)),
                        "latency_ms": float(row.get("latency_ms", 0)),
                        "dns_rcode": row.get("dns_rcode", ""),
                        "probe_domains": row.get("probe_domains", ""),
                        "domain_results": row.get("domain_results", "{}"),
                    })

        # Sort by latency
        doh_results.sort(key=lambda x: x["latency_ms"])

        print_success(f"Found {len(doh_results)} accessible DoH servers from check_doh.py")

        # Show top 10
        if doh_results:
            print_info("\nTop 10 fastest DoH servers:")
            for i, doh in enumerate(doh_results[:10], 1):
                print_info(f"  {i}. {doh['latency_ms']:.2f} ms | {doh['url']}")

        return True, doh_results

    except Exception as e:
        print_error(f"Failed to run check_doh.py: {e}")
        return False, []


# ---------- Step 2: Double-check DoH results ----------

def double_check_doh_servers(doh_results: list[dict[str, Any]], max_to_check: int = 20) -> list[dict[str, Any]]:
    """
    Double-check the top DoH servers to verify they're actually working.
    Returns verified list with updated latencies.
    """
    label = "all candidate" if max_to_check == 0 else f"top {max_to_check}"
    print_section(f"STEP 2: Double-checking {label} DoH servers")

    verified_results = []
    to_check = doh_results if max_to_check == 0 else doh_results[:max_to_check]

    for i, doh in enumerate(to_check, 1):
        url = doh["url"]
        print_info(f"[{i}/{len(to_check)}] Verifying {url} ...")

        # Try 2 times to be sure
        attempts = []
        errors = []
        domains = tuple(doh.get("probe_domains", "").split(","))
        domains = tuple(d.strip() for d in domains if d.strip()) or DEFAULT_PROBE_DOMAINS
        for attempt, domain in enumerate(domains):
            is_working, latency, error = verify_doh_endpoint(
                url, timeout=5.0, domain=domain)
            if is_working:
                attempts.append(latency)
            else:
                errors.append(f"{domain}: {error}")

        if attempts:
            avg_latency = sum(attempts) / len(attempts)
            verified_results.append({
                "url": url,
                "rank": doh["rank"],
                "original_latency_ms": doh["latency_ms"],
                "verified_latency_ms": avg_latency,
                "verification_attempts": len(attempts)
            })
            print_success(f"  ✓ Verified! Latency: {avg_latency:.2f} ms (was {doh['latency_ms']:.2f} ms)")
        else:
            print_warning(f"  ✗ Failed verification ({len(attempts)}/{len(domains)} DNS replies): "
                          + "; ".join(errors))

    # Sort by verified latency
    verified_results.sort(key=lambda x: x["verified_latency_ms"])

    print_success(f"\n{len(verified_results)} DoH servers verified and working")

    return verified_results


# ---------- Step 3: Save verified DoH servers ----------

def save_verified_doh_servers(verified_doh: list[dict[str, Any]]) -> Path:
    """
    Save verified DoH servers to a file.
    """
    print_section("STEP 3: Saving verified DoH servers")

    output_file = Path(__file__).parent / "verified_doh_servers.json"

    data = {
        "generated_at": datetime.now().isoformat(),
        "total_verified": len(verified_doh),
        "servers": verified_doh
    }

    with output_file.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print_success(f"Saved {len(verified_doh)} verified DoH servers to {output_file.name}")

    return output_file


# ---------- Step 4: Select best 3 DoH servers ----------

def select_best_doh_servers(verified_doh: list[dict[str, Any]], count: int = 3) -> list[str]:
    """
    Select the best N DoH servers (lowest latency).
    """
    print_section(f"STEP 4: Selecting best {count} DoH servers")

    best_servers = verified_doh[:count]

    print_info(f"Selected top {len(best_servers)} DoH servers:\n")
    for i, server in enumerate(best_servers, 1):
        print_info(
            f"  {i}. {paint(server['url'], BOLD)}\n"
            f"     Latency: {server['verified_latency_ms']:.2f} ms"
        )

    return [server["url"] for server in best_servers]


# ---------- Step 5: Check websites with multiple DoH servers ----------

def check_websites_with_doh(doh_urls: list[str], limit: int | None = None, dns_server: str = "8.8.8.8") -> dict[str, Any]:
    """
    Run website checker with each DoH server.
    Returns dictionary with results from all DoH servers.
    """
    print_section(f"STEP 5: Checking websites with {len(doh_urls)} DoH servers")

    script_dir = Path(__file__).parent
    check_websites_script = script_dir / "check_websites.py"

    if not check_websites_script.exists():
        print_error(f"check_websites.py not found at {check_websites_script}")
        return {}

    all_results = {}
    live_path = start_live_terminal(
        "Master checker — live website groups",
        ["Live website results from each selected DNS source appear here."],
    )
    if live_path:
        print_info(f"Live website groups are also open in a new terminal: {live_path}")

    for i, doh_url in enumerate(doh_urls or [""], 1):
        if live_path:
            append_live(live_path, "", f"DNS run {i}/{len(doh_urls) or 1}: {doh_url or 'IPv4 DNS only'}")
        print_info(f"\n[{i}/{len(doh_urls) or 1}] DNS mode: {doh_url or 'IPv4 DNS only'}")
        print_info("-" * 60)

        try:
            # Prepare command
            cmd = [
                sys.executable,
                str(check_websites_script),
                "--doh", doh_url,
                "--dns-server", dns_server,
                "--csv", f"website_check_results_doh{i}.csv",
                "--report", f"filtered_websites_report_doh{i}.txt",
                "--fastest-report", f"fastest_100_websites_doh{i}.txt",
                "--filtered-details", f"filtered_with_wrong_ips_doh{i}.txt",
                "--workers", "30",
                "--timeout", "10"
            ]

            if limit:
                cmd.extend(["--limit", str(limit)])

            # Run the website checker with LIVE output streaming
            start_time = time.time()

            # Use Popen for real-time output
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,  # Line buffered for real-time output
                cwd=str(script_dir),
                env=child_environment(live_path),
            )

            # Stream output in real-time as websites are being checked
            for line in process.stdout:
                print(line, end='', flush=True)

            process.wait()
            elapsed_time = time.time() - start_time

            print_info(f"\nCompleted in {elapsed_time:.1f} seconds")
            print_info(f"Exit code: {process.returncode}")
            if process.returncode != 0:
                print_error("Website check failed; refusing old CSV results")
                continue

            # Parse results
            csv_file = script_dir / f"website_check_results_doh{i}.csv"
            if csv_file.exists():
                with csv_file.open("r", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    results = list(reader)

                accessible = sum(1 for r in results if r.get("accessible") == "yes")
                filtered = sum(1 for r in results if r.get("filtered") == "yes")
                dns_mismatch = sum(1 for r in results if r.get("dns_mismatch") == "yes")

                all_results[doh_url or "IPv4 DNS only"] = {
                    "total": len(results),
                    "accessible": accessible,
                    "filtered": filtered,
                    "dns_mismatch": dns_mismatch,
                    "elapsed_time": elapsed_time,
                    "csv_file": str(csv_file),
                    "report_file": str(script_dir / f"filtered_websites_report_doh{i}.txt"),
                    "fastest_report": str(script_dir / f"fastest_100_websites_doh{i}.txt"),
                    "filtered_details": str(script_dir / f"filtered_with_wrong_ips_doh{i}.txt")
                }

                print_success(
                    f"Results: {accessible} accessible, {filtered} filtered, "
                    f"{dns_mismatch} DNS mismatches"
                )

        except Exception as e:
            print_error(f"Failed to check websites with {doh_url}: {e}")

    return all_results


# ---------- Step 6: Generate master report ----------

def generate_master_report(
    verified_doh: list[dict[str, Any]],
    best_doh: list[str],
    website_results: dict[str, Any]
) -> None:
    """
    Generate and print comprehensive master report.
    """
    print_header("MASTER REPORT - DOH & WEBSITE CHECK RESULTS")

    # DoH Report
    print(paint("━" * 80, CYAN))
    print(paint("  DOH SERVER VERIFICATION RESULTS", f"{BOLD};{CYAN}"))
    print(paint("━" * 80, CYAN))
    print()

    print(f"Total DoH servers verified: {paint(str(len(verified_doh)), f'{BOLD};{GREEN}')}")
    print(f"Best DoH servers selected: {paint(str(len(best_doh)), f'{BOLD};{GREEN}')}")
    print()

    print(paint("Top 10 Fastest DoH Servers:", BOLD))
    for i, doh in enumerate(verified_doh[:10], 1):
        marker = paint("★", YELLOW) if doh["url"] in best_doh else " "
        print(f"  {marker} {i:2d}. {doh['verified_latency_ms']:7.2f} ms  |  {doh['url']}")
    print()

    # Website Check Report
    print(paint("━" * 80, CYAN))
    print(paint("  WEBSITE CHECK RESULTS (BY DOH SERVER)", f"{BOLD};{CYAN}"))
    print(paint("━" * 80, CYAN))
    print()

    if not website_results:
        print_warning("No website check results available")
        return

    for i, (doh_url, results) in enumerate(website_results.items(), 1):
        print(f"\n{paint(f'DoH Server #{i}:', BOLD)} {doh_url}")
        print(f"  Total websites checked: {results['total']}")
        print(f"  {paint('✓', GREEN)} Accessible: {results['accessible']} "
              f"({results['accessible']/results['total']*100:.1f}%)")
        print(f"  {paint('✗', RED)} Filtered: {results['filtered']} "
              f"({results['filtered']/results['total']*100:.1f}%)")
        print(f"  {paint('⚠', YELLOW)} DNS Mismatches: {results['dns_mismatch']} "
              f"({results['dns_mismatch']/results['total']*100:.1f}%)")
        print(f"  Time elapsed: {results['elapsed_time']:.1f} seconds")
        print(f"  CSV: {Path(results['csv_file']).name}")
        print(f"  Reports:")
        print(f"    - Filtered sites: {Path(results['report_file']).name}")
        print(f"    - Fastest 100: {Path(results['fastest_report']).name}")
        print(f"    - Wrong IPs: {Path(results['filtered_details']).name}")

    # Comparison
    if len(website_results) > 1:
        print(f"\n{paint('━' * 80, CYAN)}")
        print(paint("  COMPARISON ACROSS DOH SERVERS", f"{BOLD};{CYAN}"))
        print(paint("━" * 80, CYAN))
        print()

        print(f"{'DoH Server':<50} {'Accessible':<12} {'Filtered':<12} {'DNS Diff':<12}")
        print("-" * 86)

        for doh_url, results in website_results.items():
            short_url = doh_url[:47] + "..." if len(doh_url) > 50 else doh_url
            print(
                f"{short_url:<50} "
                f"{results['accessible']:<12} "
                f"{results['filtered']:<12} "
                f"{results['dns_mismatch']:<12}"
            )

    # Save master report
    report_file = Path(__file__).parent / "master_report.txt"
    with report_file.open("w", encoding="utf-8") as f:
        f.write("=" * 80 + "\n")
        f.write("MASTER REPORT - DOH & WEBSITE CHECK RESULTS\n")
        f.write("=" * 80 + "\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

        f.write("DOH VERIFICATION RESULTS\n")
        f.write("-" * 80 + "\n")
        f.write(f"Total verified: {len(verified_doh)}\n")
        f.write(f"Best selected: {len(best_doh)}\n\n")

        f.write("Top 10 Fastest DoH Servers:\n")
        for i, doh in enumerate(verified_doh[:10], 1):
            marker = "★" if doh["url"] in best_doh else " "
            f.write(f"  {marker} {i:2d}. {doh['verified_latency_ms']:7.2f} ms  |  {doh['url']}\n")

        f.write("\n\nWEBSITE CHECK RESULTS\n")
        f.write("-" * 80 + "\n\n")

        for i, (doh_url, results) in enumerate(website_results.items(), 1):
            f.write(f"DoH Server #{i}: {doh_url}\n")
            f.write(f"  Total: {results['total']}\n")
            f.write(f"  Accessible: {results['accessible']} ({results['accessible']/results['total']*100:.1f}%)\n")
            f.write(f"  Filtered: {results['filtered']} ({results['filtered']/results['total']*100:.1f}%)\n")
            f.write(f"  DNS Mismatches: {results['dns_mismatch']} ({results['dns_mismatch']/results['total']*100:.1f}%)\n")
            f.write(f"  Time: {results['elapsed_time']:.1f}s\n")
            f.write(f"  CSV: {Path(results['csv_file']).name}\n")
            f.write(f"  Reports:\n")
            f.write(f"    - Filtered sites: {Path(results['report_file']).name}\n")
            f.write(f"    - Fastest 100: {Path(results['fastest_report']).name}\n")
            f.write(f"    - Wrong IPs (8.8.8.8): {Path(results['filtered_details']).name}\n\n")

    print(f"\n{paint('━' * 80, CYAN)}")
    print_success(f"Master report saved to: {report_file.name}")
    print(paint("━" * 80, CYAN))


# ---------- Main ----------

def main() -> int:
    print_header("MASTER WEBSITE CHECKER WITH DOH VERIFICATION")

    start_time = time.time()

    # Parse arguments
    import argparse
    parser = argparse.ArgumentParser(
        description="Master orchestrator for DoH verification and website checking"
    )
    parser.add_argument(
        "--skip-doh-check", action="store_true",
        help="Skip DoH checking and use existing results"
    )
    parser.add_argument(
        "--doh-count", type=int, default=3,
        help="Number of best DoH servers to use (default: 3)"
    )
    parser.add_argument(
        "--limit", type=int, default=None,
        help="Limit websites to check (for testing)"
    )
    parser.add_argument(
        "--verify-count", type=int, default=20,
        help="Number of top DoH servers to verify; 0 means all (default: 20)"
    )
    parser.add_argument("--no-doh", action="store_true", help="skip DoH scanning and check websites with IPv4 DNS")
    parser.add_argument("--dns-server", default="8.8.8.8", help="IPv4 DNS comparison server")
    add_network_argument(parser)
    args = parser.parse_args()
    if args.doh_count < 1:
        parser.error("--doh-count must be at least 1")
    if args.verify_count < 0:
        parser.error("--verify-count must be at least 0")
    require_direct_network(args.interface)

    doh_results = []
    if not args.no_doh:
        if not args.skip_doh_check:
            _, doh_results = run_check_doh()
        else:
            csv_file = Path(__file__).parent / "doh_results.csv"
            try:
                with csv_file.open(encoding="utf-8") as handle:
                    for row in csv.DictReader(handle):
                        if row.get("accessible", "").lower() == "yes":
                            doh_results.append({
                                "url": row["url"], "rank": int(row["rank"]),
                                "latency_ms": float(row["latency_ms"]),
                            })
                doh_results.sort(key=lambda row: row["latency_ms"])
            except (OSError, ValueError, KeyError) as exc:
                print_warning(f"Cannot load saved DoH results: {exc}")
                doh_results = []
    verified_doh = (double_check_doh_servers(doh_results, args.verify_count)
                    if doh_results else [])
    save_verified_doh_servers(verified_doh)
    if not verified_doh:
        print_warning("No verified DoH server; continuing website checks with direct IPv4 DNS.")
    best_doh = select_best_doh_servers(verified_doh, count=args.doh_count) if verified_doh else []

    # Step 5: Check websites with selected DoH servers
    website_results = check_websites_with_doh(best_doh, limit=args.limit, dns_server=args.dns_server)

    # Step 6: Generate master report
    generate_master_report(verified_doh, best_doh, website_results)

    elapsed_time = time.time() - start_time
    print_header(f"TOTAL EXECUTION TIME: {elapsed_time:.1f} SECONDS")

    return 0 if website_results else 1


if __name__ == "__main__":
    sys.exit(main())
