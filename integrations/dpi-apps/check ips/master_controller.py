#!/usr/bin/env python3
"""
Master DPI Test Controller & Report Generator

Controls all cloud provider DPI tests and generates comprehensive reports.
Provides interactive menu, parallel execution, and detailed analysis.
"""
import subprocess
import sys
import time
import os
import json
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

# Test configurations
TESTS = [
    {
        "id": "aws",
        "name": "AWS (Amazon Web Services)",
        "script": "aws_test.py",
        "description": "Test AWS IP ranges for DPI filtering",
        "expected_ips": 50,
        "priority": 1
    },
    {
        "id": "gcp",
        "name": "Google Cloud Platform",
        "script": "gcp_test.py",
        "description": "Test GCP IP ranges for DPI filtering",
        "expected_ips": 50,
        "priority": 2
    },
    {
        "id": "digitalocean",
        "name": "DigitalOcean",
        "script": "digitalocean_test.py",
        "description": "Test DigitalOcean IP ranges for DPI filtering",
        "expected_ips": 50,
        "priority": 3
    },
    {
        "id": "hetzner",
        "name": "Hetzner",
        "script": "hetzner_test.py",
        "description": "Test Hetzner IP ranges for DPI filtering",
        "expected_ips": 50,
        "priority": 4
    }
]

WORKING_DIR = os.path.dirname(os.path.abspath(__file__))


def clear_screen():
    """Clear terminal screen."""
    os.system('cls' if os.name == 'nt' else 'clear')


def print_header(title):
    """Print formatted header."""
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")


def print_banner():
    """Print application banner."""
    clear_screen()
    print(f"""
{'='*80}
   ____  ____  ___   _____         _     ____             _             _
  |  _ \\|  _ \\|_ _| |_   _|__  ___| |_  / ___|___  _ __ | |_ _ __ ___ | |
  | | | | |_) || |    | |/ _ \\/ __| __|| |   / _ \\| '_ \\| __| '__/ _ \\| |
  | |_| |  __/ | |    | |  __/\\__ \\ |_ | |__| (_) | | | | |_| | | (_) | |
  |____/|_|   |___|   |_|\\___||___/\\__| \\____\\___/|_| |_|\\__|_|  \\___/|_|

  Master Controller for Cloud Provider DPI Analysis
  Version 1.0 | Date: {datetime.now().strftime('%Y-%m-%d')}
{'='*80}
""")


def check_test_files():
    """Check if all test scripts exist."""
    missing = []
    for test in TESTS:
        script_path = os.path.join(WORKING_DIR, test['script'])
        if not os.path.exists(script_path):
            missing.append(test['script'])

    if missing:
        print(f"⚠️  Warning: Missing test scripts:")
        for script in missing:
            print(f"   - {script}")
        return False
    return True


def run_single_test(test, show_output=False):
    """Run a single DPI test."""
    script_path = os.path.join(WORKING_DIR, test['script'])
    output_file = os.path.join(WORKING_DIR, f"{test['id']}_results.txt")

    start_time = time.time()

    try:
        print(f"\n[{test['id'].upper()}] Starting test: {test['name']}")
        print(f"  Script: {test['script']}")
        print(f"  Expected IPs: {test['expected_ips']}")
        print(f"  Output: {test['id']}_results.txt")

        # Run test and capture output
        with open(output_file, 'w') as f:
            process = subprocess.Popen(
                [sys.executable, script_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                cwd=WORKING_DIR
            )

            for line in process.stdout:
                f.write(line)
                if show_output:
                    print(f"  {line.rstrip()}")

            process.wait()

        elapsed = time.time() - start_time
        exit_code = process.returncode

        result = {
            'test_id': test['id'],
            'name': test['name'],
            'script': test['script'],
            'output_file': output_file,
            'exit_code': exit_code,
            'duration': elapsed,
            'success': exit_code in (0, 2),  # 0 = all accessible, 2 = some blocked
            'timestamp': datetime.now().isoformat()
        }

        if result['success']:
            print(f"[{test['id'].upper()}] ✓ Completed in {elapsed:.1f}s")
        else:
            print(f"[{test['id'].upper()}] ✗ Failed with exit code {exit_code}")

        return result

    except Exception as e:
        elapsed = time.time() - start_time
        print(f"[{test['id'].upper()}] ✗ Error: {e}")

        return {
            'test_id': test['id'],
            'name': test['name'],
            'script': test['script'],
            'output_file': output_file,
            'exit_code': -1,
            'duration': elapsed,
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }


def run_parallel_tests(tests_to_run, max_workers=4):
    """Run multiple tests in parallel."""
    print_header("Running Tests in Parallel")
    print(f"Tests to run: {len(tests_to_run)}")
    print(f"Max parallel workers: {max_workers}\n")

    start_time = time.time()
    results = []

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_test = {executor.submit(run_single_test, test): test for test in tests_to_run}

        for future in as_completed(future_to_test):
            result = future.result()
            results.append(result)

    total_time = time.time() - start_time

    print(f"\n{'='*80}")
    print(f"All tests completed in {total_time:.1f}s")
    print(f"{'='*80}\n")

    return results, total_time


def run_sequential_tests(tests_to_run):
    """Run tests one after another."""
    print_header("Running Tests Sequentially")
    print(f"Tests to run: {len(tests_to_run)}\n")

    start_time = time.time()
    results = []

    for i, test in enumerate(tests_to_run, 1):
        print(f"\n[{i}/{len(tests_to_run)}] Running {test['name']}...")
        result = run_single_test(test, show_output=False)
        results.append(result)

    total_time = time.time() - start_time

    print(f"\n{'='*80}")
    print(f"All tests completed in {total_time:.1f}s")
    print(f"{'='*80}\n")

    return results, total_time


def parse_test_results(result_file):
    """Parse test results from output file."""
    if not os.path.exists(result_file):
        return None

    with open(result_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract key metrics
    import re

    provider_match = re.search(r'(.+?) IP Accessibility', content)
    provider = provider_match.group(1).strip() if provider_match else "Unknown"

    final_match = re.search(r'FINAL RESULTS: (\d+)/(\d+) accessible \(([\d.]+)%\), (\d+) blocked', content)

    if final_match:
        accessible = int(final_match.group(1))
        total = int(final_match.group(2))
        accessible_pct = float(final_match.group(3))
        blocked = int(final_match.group(4))
    else:
        return None

    # Extract DPI methods
    methods = {}
    method_section = re.search(r'DPI METHOD STATISTICS.*?\n(.*?)\n\n', content, re.DOTALL)
    if method_section:
        for line in method_section.group(1).split('\n'):
            if line.strip():
                match = re.search(r'(\w+(?:_\w+)*)\s*:\s*(\d+)\s+IPs\s+\(([\d.]+)%\)', line)
                if match:
                    method_name = match.group(1)
                    ip_count = int(match.group(2))
                    percentage = float(match.group(3))
                    methods[method_name] = {'count': ip_count, 'percentage': percentage}

    return {
        'provider': provider,
        'total_ips': total,
        'accessible': accessible,
        'blocked': blocked,
        'accessible_pct': accessible_pct,
        'blocked_pct': 100 - accessible_pct,
        'dpi_methods': methods
    }


def generate_comprehensive_report(results, total_time):
    """Generate comprehensive HTML and text reports."""
    print_header("Generating Comprehensive Reports")

    # Parse all results
    parsed_results = []
    for result in results:
        if result['success']:
            parsed = parse_test_results(result['output_file'])
            if parsed:
                parsed['test_result'] = result
                parsed_results.append(parsed)

    # Calculate totals
    total_ips = sum(r['total_ips'] for r in parsed_results)
    total_accessible = sum(r['accessible'] for r in parsed_results)
    total_blocked = sum(r['blocked'] for r in parsed_results)

    # Generate text report
    report_text = generate_text_report(parsed_results, results, total_time,
                                       total_ips, total_accessible, total_blocked)

    # Generate JSON report
    report_json = generate_json_report(parsed_results, results, total_time)

    # Generate HTML report
    report_html = generate_html_report(parsed_results, results, total_time,
                                       total_ips, total_accessible, total_blocked)

    # Save reports
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    text_file = os.path.join(WORKING_DIR, f"DPI_Report_{timestamp}.txt")
    json_file = os.path.join(WORKING_DIR, f"DPI_Report_{timestamp}.json")
    html_file = os.path.join(WORKING_DIR, f"DPI_Report_{timestamp}.html")

    with open(text_file, 'w', encoding='utf-8') as f:
        f.write(report_text)

    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(report_json, f, indent=2)

    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(report_html)

    print(f"✓ Text report: {text_file}")
    print(f"✓ JSON report: {json_file}")
    print(f"✓ HTML report: {html_file}")

    return text_file, json_file, html_file


def generate_text_report(parsed_results, results, total_time, total_ips, total_accessible, total_blocked):
    """Generate detailed text report."""
    report = []
    report.append("="*80)
    report.append("  COMPREHENSIVE DPI ANALYSIS REPORT")
    report.append(f"  Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append("="*80)
    report.append("")

    # Executive Summary
    report.append("EXECUTIVE SUMMARY")
    report.append("-"*80)
    report.append(f"Total IPs Tested: {total_ips}")
    report.append(f"Accessible IPs: {total_accessible} ({(total_accessible/total_ips*100):.1f}%)")
    report.append(f"Blocked IPs: {total_blocked} ({(total_blocked/total_ips*100):.1f}%)")
    report.append(f"Total Test Duration: {total_time/60:.1f} minutes")
    report.append(f"Tests Completed: {len([r for r in results if r['success']])}/{len(results)}")
    report.append("")

    # Provider Summary Table
    report.append("PROVIDER SUMMARY")
    report.append("-"*80)
    report.append(f"{'Provider':<20} {'IPs':<8} {'Accessible':<12} {'Blocked':<10} {'Rate':<10} {'Status'}")
    report.append("-"*80)

    for r in sorted(parsed_results, key=lambda x: x['accessible_pct'], reverse=True):
        status = "🟢 GOOD" if r['accessible_pct'] >= 70 else "🟡 MODERATE" if r['accessible_pct'] >= 30 else "🔴 SEVERE"
        report.append(f"{r['provider']:<20} {r['total_ips']:<8} {r['accessible']:<12} {r['blocked']:<10} {r['accessible_pct']:>5.1f}%    {status}")

    report.append("")

    # DPI Methods Aggregated
    report.append("DPI METHODS DETECTED")
    report.append("-"*80)

    all_methods = {}
    for r in parsed_results:
        for method, data in r['dpi_methods'].items():
            if method not in all_methods:
                all_methods[method] = 0
            all_methods[method] += data['count']

    for method, count in sorted(all_methods.items(), key=lambda x: x[1], reverse=True):
        pct = (count / total_ips) * 100
        bar = "█" * int(pct / 2) + "░" * (50 - int(pct / 2))
        report.append(f"{method.replace('_', ' ').title():<30} {count:>3} IPs ({pct:>5.1f}%) {bar}")

    report.append("")

    # Provider Details
    report.append("DETAILED PROVIDER ANALYSIS")
    report.append("="*80)

    for r in parsed_results:
        report.append("")
        report.append(f"Provider: {r['provider']}")
        report.append("-"*80)
        report.append(f"Total IPs Tested: {r['total_ips']}")
        report.append(f"Accessible: {r['accessible']} ({r['accessible_pct']:.1f}%)")
        report.append(f"Blocked: {r['blocked']} ({r['blocked_pct']:.1f}%)")
        report.append(f"Test Duration: {r['test_result']['duration']:.1f}s")
        report.append("")
        report.append("DPI Methods:")
        for method, data in r['dpi_methods'].items():
            report.append(f"  - {method.replace('_', ' ').title()}: {data['count']} IPs ({data['percentage']:.1f}%)")
        report.append("")

    # Recommendations
    report.append("="*80)
    report.append("RECOMMENDATIONS")
    report.append("="*80)
    report.append("")
    report.append("Based on the comprehensive DPI analysis:")
    report.append("")
    report.append("✅ WORKS:")
    report.append("  - UDP-based VPN protocols (WireGuard, OpenVPN UDP, IKEv2)")
    report.append("  - DNS tunneling (dnstt, iodine)")
    report.append("  - Domain fronting with CDN")
    report.append("")
    report.append("❌ BLOCKED:")
    report.append("  - Direct TLS/HTTPS to filtered IPs")
    report.append("  - Plain HTTP tunneling")

    # Find best and worst providers
    best = max(parsed_results, key=lambda x: x['accessible_pct'])
    worst = min(parsed_results, key=lambda x: x['accessible_pct'])

    report.append("")
    report.append(f"✓ Best Provider: {best['provider']} ({best['accessible_pct']:.1f}% accessible)")
    report.append(f"✗ Worst Provider: {worst['provider']} ({worst['accessible_pct']:.1f}% accessible)")
    report.append("")
    report.append("="*80)

    return "\n".join(report)


def generate_json_report(parsed_results, results, total_time):
    """Generate JSON report for programmatic access."""
    return {
        'metadata': {
            'generated': datetime.now().isoformat(),
            'total_duration_seconds': total_time,
            'version': '1.0'
        },
        'summary': {
            'total_ips': sum(r['total_ips'] for r in parsed_results),
            'total_accessible': sum(r['accessible'] for r in parsed_results),
            'total_blocked': sum(r['blocked'] for r in parsed_results),
            'tests_run': len(results),
            'tests_successful': len([r for r in results if r['success']])
        },
        'providers': parsed_results,
        'test_execution': results
    }


def generate_html_report(parsed_results, results, total_time, total_ips, total_accessible, total_blocked):
    """Generate HTML report with charts and styling."""
    html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>DPI Analysis Report - {datetime.now().strftime('%Y-%m-%d')}</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }}
        .header h1 {{ margin: 0; font-size: 2.5em; }}
        .header p {{ margin: 10px 0 0 0; opacity: 0.9; }}
        .summary-cards {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }}
        .card {{
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        .card h3 {{ margin: 0 0 10px 0; color: #666; font-size: 0.9em; }}
        .card .value {{ font-size: 2.5em; font-weight: bold; margin: 10px 0; }}
        .card .sub {{ color: #999; font-size: 0.9em; }}
        .provider-table {{
            background: white;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
        }}
        th, td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }}
        th {{
            background: #f8f9fa;
            font-weight: 600;
            color: #666;
        }}
        .status-good {{ color: #28a745; font-weight: bold; }}
        .status-moderate {{ color: #ffc107; font-weight: bold; }}
        .status-severe {{ color: #dc3545; font-weight: bold; }}
        .progress-bar {{
            width: 100%;
            height: 20px;
            background: #eee;
            border-radius: 10px;
            overflow: hidden;
            margin: 5px 0;
        }}
        .progress-fill {{
            height: 100%;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            transition: width 0.3s;
        }}
        .method-list {{
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        .method-item {{
            margin: 15px 0;
        }}
        .method-item h4 {{ margin: 0 0 5px 0; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 DPI Analysis Report</h1>
        <p>Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Duration: {total_time/60:.1f} minutes</p>
    </div>

    <div class="summary-cards">
        <div class="card">
            <h3>TOTAL IPs TESTED</h3>
            <div class="value">{total_ips}</div>
            <div class="sub">Across 4 providers</div>
        </div>
        <div class="card">
            <h3>ACCESSIBLE</h3>
            <div class="value" style="color: #28a745;">{total_accessible}</div>
            <div class="sub">{(total_accessible/total_ips*100):.1f}% success rate</div>
        </div>
        <div class="card">
            <h3>BLOCKED</h3>
            <div class="value" style="color: #dc3545;">{total_blocked}</div>
            <div class="sub">{(total_blocked/total_ips*100):.1f}% blocked</div>
        </div>
        <div class="card">
            <h3>TESTS RUN</h3>
            <div class="value">{len([r for r in results if r['success']])}/{len(results)}</div>
            <div class="sub">Successful/Total</div>
        </div>
    </div>

    <div class="provider-table">
        <h2>Provider Summary</h2>
        <table>
            <thead>
                <tr>
                    <th>Provider</th>
                    <th>IPs Tested</th>
                    <th>Accessible</th>
                    <th>Blocked</th>
                    <th>Success Rate</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
"""

    for r in sorted(parsed_results, key=lambda x: x['accessible_pct'], reverse=True):
        status_class = "status-good" if r['accessible_pct'] >= 70 else "status-moderate" if r['accessible_pct'] >= 30 else "status-severe"
        status_text = "🟢 GOOD" if r['accessible_pct'] >= 70 else "🟡 MODERATE" if r['accessible_pct'] >= 30 else "🔴 SEVERE"

        html += f"""
                <tr>
                    <td><strong>{r['provider']}</strong></td>
                    <td>{r['total_ips']}</td>
                    <td>{r['accessible']}</td>
                    <td>{r['blocked']}</td>
                    <td>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: {r['accessible_pct']}%;"></div>
                        </div>
                        {r['accessible_pct']:.1f}%
                    </td>
                    <td class="{status_class}">{status_text}</td>
                </tr>
"""

    html += """
            </tbody>
        </table>
    </div>

    <div class="method-list">
        <h2>DPI Methods Detected</h2>
"""

    all_methods = {}
    for r in parsed_results:
        for method, data in r['dpi_methods'].items():
            if method not in all_methods:
                all_methods[method] = 0
            all_methods[method] += data['count']

    for method, count in sorted(all_methods.items(), key=lambda x: x[1], reverse=True):
        pct = (count / total_ips) * 100
        html += f"""
        <div class="method-item">
            <h4>{method.replace('_', ' ').title()}</h4>
            <div class="progress-bar">
                <div class="progress-fill" style="width: {pct}%;"></div>
            </div>
            <div class="sub">{count} IPs ({pct:.1f}%)</div>
        </div>
"""

    html += """
    </div>
</body>
</html>
"""

    return html


def show_main_menu():
    """Display main menu and get user choice."""
    print_banner()

    print("  MAIN MENU")
    print("  " + "-"*76)
    print()
    print("  1. Run All Tests (Parallel) - Recommended")
    print("  2. Run All Tests (Sequential)")
    print("  3. Run Individual Test")
    print("  4. View Previous Reports")
    print("  5. Generate Report from Existing Results")
    print("  6. Check System Status")
    print("  0. Exit")
    print()
    print("  " + "-"*76)

    while True:
        choice = input("\n  Select option [0-6]: ").strip()
        if choice in ['0', '1', '2', '3', '4', '5', '6']:
            return choice
        print("  ⚠️  Invalid choice, please try again.")


def run_all_tests_menu():
    """Run all tests with user configuration."""
    print_header("Run All DPI Tests")

    print("Configuration:")
    print("  - 4 cloud providers (AWS, GCP, DigitalOcean, Hetzner)")
    print("  - ~50 IPs per provider")
    print("  - 20 TCP + 7 UDP ports per IP")
    print("  - Estimated time: 10-20 minutes")
    print()

    mode = input("Run in [P]arallel or [S]equential mode? [P/s]: ").strip().lower()
    parallel = mode != 's'

    print()
    confirm = input("Start tests now? [Y/n]: ").strip().lower()
    if confirm == 'n':
        print("Tests cancelled.")
        return

    # Run tests
    if parallel:
        results, total_time = run_parallel_tests(TESTS, max_workers=4)
    else:
        results, total_time = run_sequential_tests(TESTS)

    # Generate reports
    print()
    generate = input("Generate comprehensive reports? [Y/n]: ").strip().lower()
    if generate != 'n':
        text_file, json_file, html_file = generate_comprehensive_report(results, total_time)

        print()
        print("✓ All reports generated successfully!")
        print()
        print("You can:")
        print(f"  - Read text report: {os.path.basename(text_file)}")
        print(f"  - View HTML report: {os.path.basename(html_file)} (open in browser)")
        print(f"  - Parse JSON report: {os.path.basename(json_file)}")

    print()
    input("Press Enter to return to menu...")


def run_individual_test_menu():
    """Run a single test."""
    print_header("Run Individual Test")

    for i, test in enumerate(TESTS, 1):
        print(f"  {i}. {test['name']}")
        print(f"     {test['description']}")
        print()

    choice = input(f"Select test [1-{len(TESTS)}] or [0] to cancel: ").strip()

    if choice == '0':
        return

    try:
        idx = int(choice) - 1
        if 0 <= idx < len(TESTS):
            test = TESTS[idx]
            result = run_single_test(test, show_output=True)

            print()
            input("Press Enter to return to menu...")
        else:
            print("Invalid selection.")
    except ValueError:
        print("Invalid input.")


def view_previous_reports():
    """List and view previous reports."""
    print_header("Previous Reports")

    # Find all report files
    txt_reports = [f for f in os.listdir(WORKING_DIR) if f.startswith('DPI_Report_') and f.endswith('.txt')]
    html_reports = [f for f in os.listdir(WORKING_DIR) if f.startswith('DPI_Report_') and f.endswith('.html')]

    if not txt_reports and not html_reports:
        print("No previous reports found.")
        print()
        input("Press Enter to return to menu...")
        return

    print("Available reports:")
    print()

    all_reports = sorted(txt_reports + html_reports, reverse=True)

    for i, report in enumerate(all_reports[:10], 1):  # Show last 10
        size = os.path.getsize(os.path.join(WORKING_DIR, report))
        print(f"  {i}. {report} ({size/1024:.1f} KB)")

    print()
    print("  0. Return to menu")
    print()

    choice = input(f"Select report to open [1-{min(10, len(all_reports))}] or [0]: ").strip()

    if choice == '0':
        return

    try:
        idx = int(choice) - 1
        if 0 <= idx < len(all_reports):
            report_path = os.path.join(WORKING_DIR, all_reports[idx])

            if report_path.endswith('.html'):
                import webbrowser
                webbrowser.open(f'file://{report_path}')
                print(f"\nOpened {all_reports[idx]} in browser.")
            else:
                with open(report_path, 'r', encoding='utf-8') as f:
                    print(f.read())

            print()
            input("Press Enter to return to menu...")
    except ValueError:
        print("Invalid input.")


def check_system_status():
    """Check system status and test file availability."""
    print_header("System Status")

    print("Test Scripts:")
    for test in TESTS:
        script_path = os.path.join(WORKING_DIR, test['script'])
        exists = os.path.exists(script_path)
        status = "✓" if exists else "✗"
        print(f"  {status} {test['script']}")

    print()
    print("Recent Test Results:")
    result_files = [f"{t['id']}_results.txt" for t in TESTS]
    for f in result_files:
        path = os.path.join(WORKING_DIR, f)
        if os.path.exists(path):
            size = os.path.getsize(path)
            mtime = datetime.fromtimestamp(os.path.getmtime(path))
            print(f"  ✓ {f} ({size/1024:.1f} KB, modified: {mtime.strftime('%Y-%m-%d %H:%M')})")
        else:
            print(f"  ✗ {f} (not found)")

    print()
    print(f"Working Directory: {WORKING_DIR}")
    print(f"Python Version: {sys.version.split()[0]}")

    print()
    input("Press Enter to return to menu...")


def main():
    """Main application loop."""
    # Check if test files exist
    if not check_test_files():
        print("\n⚠️  Some test scripts are missing!")
        print("Please ensure all test scripts are in the same directory.")
        input("\nPress Enter to exit...")
        return

    while True:
        choice = show_main_menu()

        if choice == '0':
            clear_screen()
            print("\nThank you for using DPI Test Controller!")
            print("Stay safe online.\n")
            break
        elif choice == '1' or choice == '2':
            run_all_tests_menu()
        elif choice == '3':
            run_individual_test_menu()
        elif choice == '4':
            view_previous_reports()
        elif choice == '5':
            # Generate report from existing results
            results = []
            for test in TESTS:
                output_file = os.path.join(WORKING_DIR, f"{test['id']}_results.txt")
                if os.path.exists(output_file):
                    results.append({
                        'test_id': test['id'],
                        'name': test['name'],
                        'script': test['script'],
                        'output_file': output_file,
                        'exit_code': 0,
                        'duration': 0,
                        'success': True,
                        'timestamp': datetime.now().isoformat()
                    })

            if results:
                generate_comprehensive_report(results, 0)
                print()
                input("Press Enter to return to menu...")
            else:
                print("\nNo existing results found.")
                input("Press Enter to return to menu...")
        elif choice == '6':
            check_system_status()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        clear_screen()
        print("\n\nInterrupted by user. Exiting...\n")
        sys.exit(130)
    except Exception as e:
        print(f"\n\n[!] Fatal Error: {e}")
        import traceback
        traceback.print_exc()
        input("\nPress Enter to exit...")
        sys.exit(1)
