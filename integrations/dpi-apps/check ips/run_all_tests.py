#!/usr/bin/env python3
"""
Master DPI Test Controller - Command Line Version

Quick command-line interface for running all tests and generating reports.
Use this for automation and scripting.
"""
import subprocess
import sys
import os
import time
from datetime import datetime

WORKING_DIR = os.path.dirname(os.path.abspath(__file__))

TESTS = [
    {"id": "aws", "name": "AWS", "script": "aws_test.py"},
    {"id": "gcp", "name": "Google Cloud", "script": "gcp_test.py"},
    {"id": "digitalocean", "name": "DigitalOcean", "script": "digitalocean_test.py"},
    {"id": "hetzner", "name": "Hetzner", "script": "hetzner_test.py"}
]


def print_banner():
    print(f"""
{'='*80}
  DPI Test Controller - Quick Run
  Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
{'='*80}
""")


def run_all_tests_cli():
    """Run all tests with output to files."""
    print_banner()

    print(f"[*] Starting all DPI tests...")
    print(f"[*] Tests: {', '.join(t['name'] for t in TESTS)}")
    print(f"[*] Working directory: {WORKING_DIR}")
    print(f"[*] Mode: Parallel execution")
    print()

    start_time = time.time()
    results = []

    # Run all tests in parallel using subprocess
    processes = []
    for test in TESTS:
        script_path = os.path.join(WORKING_DIR, test['script'])
        output_file = os.path.join(WORKING_DIR, f"{test['id']}_results.txt")

        print(f"[{test['id'].upper()}] Starting {test['name']}...")

        with open(output_file, 'w') as out:
            proc = subprocess.Popen(
                [sys.executable, script_path],
                stdout=out,
                stderr=subprocess.STDOUT,
                cwd=WORKING_DIR
            )
            processes.append((test, proc, output_file, time.time()))

    # Wait for all to complete
    print()
    print(f"[*] All tests started. Waiting for completion...")
    print()

    for test, proc, output_file, start in processes:
        proc.wait()
        elapsed = time.time() - start

        if proc.returncode == 0:
            print(f"[{test['id'].upper()}] ✓ Completed in {elapsed:.1f}s")
        else:
            print(f"[{test['id'].upper()}] ✗ Failed (exit code {proc.returncode})")

        results.append({
            'test': test,
            'exit_code': proc.returncode,
            'duration': elapsed,
            'output_file': output_file
        })

    total_time = time.time() - start_time

    print()
    print(f"{'='*80}")
    print(f"All tests completed in {total_time:.1f}s ({total_time/60:.1f} minutes)")
    print(f"{'='*80}")
    print()

    # Generate quick summary
    print("QUICK SUMMARY:")
    print("-"*80)

    for result in results:
        test = result['test']
        success = result['exit_code'] in (0, 2)
        status = "✓ SUCCESS" if success else "✗ FAILED"
        print(f"{test['name']:<20} {status:<12} {result['duration']:>6.1f}s  {os.path.basename(result['output_file'])}")

    print("-"*80)
    successful = sum(1 for r in results if r['exit_code'] in (0, 2))
    print(f"Tests passed: {successful}/{len(results)}")
    print()

    # Run summary generator
    print("[*] Generating comprehensive report...")
    try:
        subprocess.run(
            [sys.executable, os.path.join(WORKING_DIR, "generate_summary.py")],
            cwd=WORKING_DIR,
            timeout=30
        )
    except Exception as e:
        print(f"[!] Could not generate summary: {e}")

    print()
    print("=" * 80)
    print("AVAILABLE OUTPUT FILES:")
    print("=" * 80)

    for result in results:
        print(f"  - {os.path.basename(result['output_file'])}")

    print(f"  - DPI_ANALYSIS_REPORT.md (comprehensive analysis)")

    # List any generated reports
    report_files = [f for f in os.listdir(WORKING_DIR) if f.startswith('DPI_Report_')]
    if report_files:
        latest = sorted(report_files)[-1]
        print(f"  - {latest} (latest report)")

    print()
    print("=" * 80)
    print("Done! Check the output files above for detailed results.")
    print("=" * 80)
    print()


def main():
    """Main entry point."""
    if len(sys.argv) > 1 and sys.argv[1] in ['-h', '--help', 'help']:
        print("""
DPI Test Controller - Command Line Interface

Usage:
    python run_all_tests.py           # Run all tests and generate reports

This will:
  1. Run all 4 cloud provider DPI tests in parallel
  2. Save results to individual text files
  3. Generate comprehensive summary report
  4. Display quick summary on console

Output files:
  - aws_results.txt
  - gcp_results.txt
  - digitalocean_results.txt
  - hetzner_results.txt
  - DPI_ANALYSIS_REPORT.md (detailed analysis)

Time: Approximately 10-15 minutes total
""")
        return 0

    try:
        run_all_tests_cli()
        return 0
    except KeyboardInterrupt:
        print("\n\n[!] Interrupted by user (Ctrl+C)")
        return 130
    except Exception as e:
        print(f"\n[!] Error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
