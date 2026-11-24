#!/usr/bin/env python3
"""
Simple Website Checker with an optional user-selected DoH server.
DoH is never scanned automatically; the user supplies one URL or chooses DNS only.
"""

from __future__ import annotations

import json
import os
import csv
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

from direct_network import add_network_argument, require_direct_network
from live_terminal import child_environment, start_live_terminal



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

from doh_client import verify_doh_endpoint


def choose_doh_url(supplied_url: str = "", no_doh: bool = False, input_fn=None) -> str:
    """Ask whether to use DoH; request a URL only when the answer is yes."""
    if supplied_url and no_doh:
        raise ValueError("--doh and --no-doh cannot be used together")
    if no_doh:
        return ""
    if supplied_url:
        return supplied_url.strip()

    ask = input_fn or input
    while True:
        try:
            answer = ask("Do you want to check websites using DoH too? [y/N]: ").strip().lower()
        except EOFError:
            print_info("No interactive input; continuing with IPv4 DNS only.")
            return ""
        if answer in ("y", "yes"):
            try:
                return ask("Enter the DoH URL: ").strip()
            except EOFError:
                print_info("No DoH URL entered; continuing with IPv4 DNS only.")
                return ""
        if answer in ("", "n", "no"):
            return ""
        print_warning("Please answer yes or no.")


# ---------- Step 3: Save verified DoH servers ----------

def save_verified_doh_servers(verified_doh: list[dict]) -> Path:
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

    print_success(f"Saved {len(verified_doh)} verified DoH servers")

    return output_file


# ---------- Step 5: Check websites ----------

def check_websites_with_doh(doh_url: str, limit: int | None = None, dns_server: str = "8.8.8.8") -> dict:
    """
    Run website checker with the selected DoH server.
    """
    print_section("STEP 5: Checking website accessibility (DoH optional)")

    script_dir = Path(__file__).parent
    check_websites_script = script_dir / "check_websites.py"

    if not check_websites_script.exists():
        print_error(f"check_websites.py not found at {check_websites_script}")
        return {}

    live_path = start_live_terminal(
        "Simple checker — live website groups",
        ["Live website results will be grouped by DNS filtering, HTTP status, and access."],
    )
    if live_path:
        print_info(f"Live website groups are also open in a new terminal: {live_path}")

    print_info(f"\nDNS mode: {doh_url or 'IPv4 DNS only'}")
    print_info("-" * 60)

    try:
        cmd = [
            sys.executable,
            str(check_websites_script),
            "--doh", doh_url,
            "--dns-server", dns_server,
            "--csv", "website_check_results.csv",
            "--report", "filtered_websites_report.txt",
            "--fastest-report", "fastest_100_websites.txt",
            "--filtered-details", "filtered_with_wrong_ips.txt",
            "--workers", "30",
            "--timeout", "10"
        ]

        if limit:
            cmd.extend(["--limit", str(limit)])

        start_time = time.time()

        # Use Popen for real-time output streaming
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,  # Line buffered
            cwd=str(script_dir),
            env=child_environment(live_path),
        )

        # Print output in real-time as it comes
        for line in process.stdout:
            print(line, end='', flush=True)

        process.wait()
        elapsed_time = time.time() - start_time
        result = process

        print_info(f"\nCompleted in {elapsed_time:.1f} seconds")
        print_info(f"Exit code: {result.returncode}")
        if result.returncode != 0:
            print_error("Website check failed; refusing old CSV results")
            return {}

        # Parse results
        csv_file = script_dir / "website_check_results.csv"
        if csv_file.exists():
            with csv_file.open("r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                results = list(reader)

            accessible = sum(1 for r in results if r.get("accessible") == "yes")
            filtered = sum(1 for r in results if r.get("filtered") == "yes")
            dns_mismatch = sum(1 for r in results if r.get("dns_mismatch") == "yes")

            result_data = {
                "doh_url": doh_url or "IPv4 DNS only",
                "total": len(results),
                "accessible": accessible,
                "filtered": filtered,
                "dns_mismatch": dns_mismatch,
                "elapsed_time": elapsed_time,
                "csv_file": str(csv_file),
                "report_file": str(script_dir / "filtered_websites_report.txt"),
                "fastest_report": str(script_dir / "fastest_100_websites.txt"),
                "filtered_details": str(script_dir / "filtered_with_wrong_ips.txt")
            }

            print_success(
                f"\nResults: {accessible} accessible, {filtered} filtered, "
                f"{dns_mismatch} DNS mismatches"
            )

            return result_data

    except Exception as e:
        print_error(f"Failed to check websites: {e}")

    return {}


# ---------- Step 6: Generate final report ----------

def generate_final_report(verified_doh: list[dict], best_doh: str, website_results: dict) -> None:
    """
    Generate and print comprehensive final report.
    """
    print_header("FINAL REPORT - DOH & WEBSITE CHECK RESULTS")

    # DoH Report
    print(paint("━" * 80, CYAN))
    print(paint("  DOH SERVER VERIFICATION", f"{BOLD};{CYAN}"))
    print(paint("━" * 80, CYAN))
    print()

    print(f"Total DoH servers verified: {paint(str(len(verified_doh)), f'{BOLD};{GREEN}')}")
    print()

    print(paint("Top 10 Fastest DoH Servers:", BOLD))
    for i, doh in enumerate(verified_doh[:10], 1):
        marker = paint("★", YELLOW) if doh["url"] == best_doh else " "
        print(f"  {marker} {i:2d}. {doh['verified_latency_ms']:7.2f} ms  |  {doh['url']}")
    print()

    print(paint("Selected DoH Server:", f"{BOLD};{GREEN}"))
    print(f"  {best_doh or 'IPv4 DNS only'}")
    print()

    # Website Check Report
    if website_results:
        print(paint("━" * 80, CYAN))
        print(paint("  WEBSITE CHECK RESULTS", f"{BOLD};{CYAN}"))
        print(paint("━" * 80, CYAN))
        print()

        print(f"DoH Server Used: {website_results['doh_url']}")
        print(f"  Total websites checked: {website_results['total']}")
        print(f"  {paint('✓', GREEN)} Accessible: {website_results['accessible']} "
              f"({website_results['accessible']/website_results['total']*100:.1f}%)")
        print(f"  {paint('✗', RED)} Filtered: {website_results['filtered']} "
              f"({website_results['filtered']/website_results['total']*100:.1f}%)")
        print(f"  {paint('⚠', YELLOW)} DNS Mismatches: {website_results['dns_mismatch']} "
              f"({website_results['dns_mismatch']/website_results['total']*100:.1f}%)")
        print(f"  Time elapsed: {website_results['elapsed_time']:.1f} seconds")
        print()

        print(paint("Generated Reports:", BOLD))
        print(f"  • {Path(website_results['csv_file']).name}")
        print(f"  • {Path(website_results['report_file']).name}")
        print(f"  • {paint(Path(website_results['fastest_report']).name, GREEN)} "
              f"{paint('← Top 100 fastest websites', GREEN)}")
        print(f"  • {paint(Path(website_results['filtered_details']).name, RED)} "
              f"{paint('← Filtered with wrong 8.8.8.8 IPs', RED)}")

    # Save summary report
    report_file = Path(__file__).parent / "simple_checker_report.txt"
    with report_file.open("w", encoding="utf-8") as f:
        f.write("=" * 80 + "\n")
        f.write("SIMPLE WEBSITE CHECKER REPORT - SINGLE DOH SERVER\n")
        f.write("=" * 80 + "\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

        f.write("DOH VERIFICATION\n")
        f.write("-" * 80 + "\n")
        f.write(f"Total verified: {len(verified_doh)}\n")
        f.write(f"DNS mode: {best_doh or 'IPv4 DNS only'}\n\n")

        if verified_doh:
            f.write("Top 10 Fastest DoH Servers:\n")
            for i, doh in enumerate(verified_doh[:10], 1):
                marker = "★" if doh["url"] == best_doh else " "
                f.write(f"  {marker} {i:2d}. {doh['verified_latency_ms']:7.2f} ms  |  {doh['url']}\n")

        if website_results:
            f.write("\n\nWEBSITE CHECK RESULTS\n")
            f.write("-" * 80 + "\n")
            f.write(f"DoH Server: {website_results['doh_url']}\n")
            f.write(f"Total: {website_results['total']}\n")
            f.write(f"Accessible: {website_results['accessible']} ({website_results['accessible']/website_results['total']*100:.1f}%)\n")
            f.write(f"Filtered: {website_results['filtered']} ({website_results['filtered']/website_results['total']*100:.1f}%)\n")
            f.write(f"DNS Mismatches: {website_results['dns_mismatch']} ({website_results['dns_mismatch']/website_results['total']*100:.1f}%)\n")
            f.write(f"Time: {website_results['elapsed_time']:.1f}s\n\n")
            f.write("Generated Files:\n")
            f.write(f"  - {Path(website_results['csv_file']).name}\n")
            f.write(f"  - {Path(website_results['report_file']).name}\n")
            f.write(f"  - {Path(website_results['fastest_report']).name} (Top 100 fastest)\n")
            f.write(f"  - {Path(website_results['filtered_details']).name} (Wrong IPs from 8.8.8.8)\n")

    print(f"\n{paint('━' * 80, CYAN)}")
    print_success(f"Summary report saved to: {report_file.name}")
    print(paint("━" * 80, CYAN))


# ---------- Main ----------

def main() -> int:
    print_header("SIMPLE WEBSITE CHECKER - OPTIONAL DOH")

    start_time = time.time()

    import argparse
    parser = argparse.ArgumentParser(
        description="Check websites with optional user-selected DoH or IPv4 DNS"
    )
    parser.add_argument(
        "--limit", type=int, default=None,
        help="Limit websites to check (for testing)"
    )
    parser.add_argument("--doh", default="", help="DoH URL to use; skips the interactive prompt")
    parser.add_argument("--no-doh", action="store_true", help="skip the DoH prompt and use IPv4 DNS only")
    parser.add_argument("--dns-server", default="8.8.8.8", help="IPv4 DNS comparison server")
    add_network_argument(parser)
    args = parser.parse_args()
    require_direct_network(args.interface)
    try:
        doh_url = choose_doh_url(args.doh, args.no_doh)
    except ValueError as exc:
        parser.error(str(exc))

    verified_doh = []
    if doh_url:
        is_working, latency, error = verify_doh_endpoint(doh_url)
        if is_working:
            verified_doh.append({
                "url": doh_url,
                "rank": 1,
                "original_latency_ms": latency,
                "verified_latency_ms": latency,
                "verification_attempts": 1,
            })
        else:
            print_warning(f"DoH URL did not return a valid DNS reply ({error}); using IPv4 DNS only.")
            doh_url = ""
    save_verified_doh_servers(verified_doh)
    if not verified_doh:
        print_info("Checking websites with IPv4 DNS only.")
    else:
        print_success(f"Using your DoH server: {doh_url}")
    best_doh = doh_url

    # Step 5: Check websites
    website_results = check_websites_with_doh(best_doh, limit=args.limit, dns_server=args.dns_server)

    # Step 6: Generate final report
    generate_final_report(verified_doh, best_doh, website_results)

    elapsed_time = time.time() - start_time
    print_header(f"TOTAL EXECUTION TIME: {elapsed_time:.1f} SECONDS")

    return 0 if website_results else 1


if __name__ == "__main__":
    sys.exit(main())
