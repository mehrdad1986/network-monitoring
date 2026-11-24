#!/usr/bin/env python3
"""
Daily DPI Test Suite Orchestrator
Runs all monitoring tests daily and generates consolidated reports
Includes scheduling, historical comparison, and alerting
"""

import os
import sys
import json
import time
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List

# Add test directory to path
APP_ROOT = Path(__file__).resolve().parent.parent
TEST_DIR = APP_ROOT / "daily_tests"
REPORT_DIR = APP_ROOT / "reports" / "daily"
ARCHIVE_DIR = APP_ROOT / "reports" / "archive"
REPORT_PREFIXES = {
    "dns_poisoning_detector.py": "dns_poisoning",
    "sni_filter_tester.py": "sni_filter",
    "encrypted_dns_monitor.py": "encrypted_dns",
    "multi_isp_comparison.py": "isp_comparison",
    "sni_spoofing_tester.py": "sni_spoofing",
}

class DailyTestOrchestrator:
    def __init__(self):
        self.timestamp = datetime.now()
        self.results = {
            "timestamp": self.timestamp.isoformat(),
            "test_suite_version": "1.0.0",
            "tests_run": [],
            "tests_failed": [],
            "consolidated_findings": {},
            "alerts": [],
            "historical_comparison": {}
        }

    def run_test(self, test_name: str, script_name: str) -> Dict:
        """Run individual test script and capture results"""
        print(f"\n{'='*70}")
        print(f"Running: {test_name}")
        print(f"{'='*70}")

        test_result = {
            "name": test_name,
            "script": script_name,
            "start_time": datetime.now().isoformat(),
            "success": False,
            "duration_seconds": 0,
            "output_file": None,
            "error": None
        }

        REPORT_DIR.mkdir(parents=True, exist_ok=True)
        ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
        prefix = REPORT_PREFIXES.get(script_name, Path(script_name).stem)
        previous_reports = {p: p.stat().st_mtime_ns for p in REPORT_DIR.glob(f"{prefix}_*.json")}
        start = time.time()

        try:
            # Run test script
            script_path = TEST_DIR / script_name
            result = subprocess.run(
                [sys.executable, str(script_path)],
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout
                cwd=str(TEST_DIR)
            )

            duration = time.time() - start
            test_result["duration_seconds"] = round(duration, 2)

            if result.returncode == 0:
                test_result["success"] = True
                print(f"✓ {test_name} completed successfully ({duration:.1f}s)")

                # Capture output
                if result.stdout:
                    print(result.stdout[-500:])  # Print last 500 chars

                # Find generated report file
                report_files = list(REPORT_DIR.glob(f"{REPORT_PREFIXES.get(script_name, Path(script_name).stem)}_*.json"))
                report_files = [p for p in report_files if p.stat().st_mtime_ns != previous_reports.get(p)]
                if report_files:
                    # Get most recent file
                    latest_report = max(report_files, key=os.path.getmtime)
                    test_result["output_file"] = str(latest_report)
                else:
                    test_result["success"] = False
                    test_result["error"] = "Child exited successfully but produced no new report"
            else:
                test_result["success"] = False
                test_result["error"] = result.stderr
                print(f"✗ {test_name} failed: {result.stderr[:200]}")

        except subprocess.TimeoutExpired:
            test_result["error"] = "Test timeout after 5 minutes"
            print(f"✗ {test_name} timed out")

        except Exception as e:
            test_result["error"] = str(e)
            print(f"✗ {test_name} error: {str(e)}")

        return test_result

    def run_all_tests(self) -> Dict:
        """Run complete daily test suite"""
        print("="*70)
        print("DPI DAILY TEST SUITE")
        print(f"Timestamp: {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*70)

        # Define test suite
        tests = [
            ("DNS Poisoning Detection", "dns_poisoning_detector.py"),
            ("SNI Filter Testing", "sni_filter_tester.py"),
            ("Encrypted DNS Monitoring", "encrypted_dns_monitor.py"),
            ("Multi-ISP Comparison", "multi_isp_comparison.py"),
        ]

        # Run each test
        for test_name, script_name in tests:
            result = self.run_test(test_name, script_name)
            self.results["tests_run"].append(result)

            if not result["success"]:
                self.results["tests_failed"].append(test_name)

        return self.results

    def consolidate_findings(self):
        """Consolidate findings from all test reports"""
        print(f"\n{'='*70}")
        print("CONSOLIDATING FINDINGS")
        print(f"{'='*70}")

        consolidated = {
            "censorship_active": None,
            "dns_poisoning_active": None,
            "sni_filtering_active": None,
            "encrypted_dns_available": None,
            "working_resolvers": [],
            "detected_isp": "UNKNOWN",
            "censorship_layers": 0
        }

        # Load and analyze each report
        for test in self.results["tests_run"]:
            if not test["success"] or not test["output_file"]:
                continue

            try:
                with open(test["output_file"], 'r', encoding='utf-8') as f:
                    data = json.load(f)

                # DNS Poisoning results
                if "dns_poisoning" in test["script"]:
                    summary = data.get("summary", {})
                    consolidated["dns_poisoning_active"] = summary.get("censorship_active")
                    if summary.get("censorship_active"):
                        consolidated["censorship_layers"] += 1

                # SNI Filter results
                elif "sni_filter" in test["script"]:
                    summary = data.get("summary", {})
                    consolidated["sni_filtering_active"] = summary.get("filter_active")
                    if summary.get("filter_active"):
                        consolidated["censorship_layers"] += 1

                # Encrypted DNS results
                elif "encrypted_dns" in test["script"]:
                    summary = data.get("summary", {})
                    consolidated["encrypted_dns_available"] = summary.get("encrypted_dns_available")
                    consolidated["working_resolvers"] = data.get("working_resolvers", [])

                # ISP Comparison results
                elif "isp_comparison" in test["script"]:
                    summary = data.get("summary", {})
                    consolidated["detected_isp"] = summary.get("detected_isp", "UNKNOWN")

            except Exception as e:
                print(f"⚠ Could not load {test['output_file']}: {e}")

        # Overall censorship status
        consolidated["censorship_active"] = (
            True if True in (consolidated["dns_poisoning_active"], consolidated["sni_filtering_active"])
            else False if all(v is False for v in (consolidated["dns_poisoning_active"], consolidated["sni_filtering_active"])) else None
        )

        self.results["consolidated_findings"] = consolidated

        # Print consolidated findings
        print(f"\nCensorship Active: {'UNKNOWN' if consolidated['censorship_active'] is None else 'YES' if consolidated['censorship_active'] else 'NO'}")
        print(f"Censorship Layers: {consolidated['censorship_layers']}")
        print(f"DNS Poisoning: {'UNKNOWN' if consolidated['dns_poisoning_active'] is None else 'ACTIVE' if consolidated['dns_poisoning_active'] else 'INACTIVE'}")
        print(f"SNI Filtering: {'UNKNOWN' if consolidated['sni_filtering_active'] is None else 'ACTIVE' if consolidated['sni_filtering_active'] else 'INACTIVE'}")
        print(f"Encrypted DNS: {'UNKNOWN' if consolidated['encrypted_dns_available'] is None else 'AVAILABLE' if consolidated['encrypted_dns_available'] else 'UNAVAILABLE'}")
        print(f"Detected ISP: {consolidated['detected_isp']}")

        return consolidated

    def generate_alerts(self):
        """Generate alerts for significant changes"""
        alerts = []

        findings = self.results["consolidated_findings"]

        # Alert: No working encrypted DNS
        if not findings.get("encrypted_dns_available"):
            alerts.append({
                "severity": "HIGH",
                "type": "NO_ENCRYPTED_DNS",
                "message": "No encrypted DNS resolvers available - DNS queries exposed to poisoning"
            })

        # Alert: Multiple censorship layers
        if findings.get("censorship_layers", 0) >= 2:
            alerts.append({
                "severity": "HIGH",
                "type": "MULTI_LAYER_CENSORSHIP",
                "message": f"{findings['censorship_layers']} censorship layers active"
            })

        # Alert: Test failures
        if self.results["tests_failed"]:
            alerts.append({
                "severity": "MEDIUM",
                "type": "TEST_FAILURES",
                "message": f"{len(self.results['tests_failed'])} tests failed: {', '.join(self.results['tests_failed'])}"
            })

        self.results["alerts"] = alerts

        if alerts:
            print(f"\n{'='*70}")
            print("ALERTS")
            print(f"{'='*70}")
            for alert in alerts:
                print(f"[{alert['severity']}] {alert['type']}: {alert['message']}")

        return alerts

    def compare_with_previous(self):
        """Compare with previous day's results"""
        print(f"\n{'='*70}")
        print("HISTORICAL COMPARISON")
        print(f"{'='*70}")

        # Find previous consolidated report
        previous_reports = sorted(REPORT_DIR.glob("consolidated_*.json"))

        if len(previous_reports) < 2:
            print("No previous data for comparison")
            return

        try:
            # Load previous report (second to last)
            with open(previous_reports[-2], 'r', encoding='utf-8') as f:
                previous = json.load(f)

            current = self.results["consolidated_findings"]
            prev_findings = previous.get("consolidated_findings", {})

            comparison = {
                "previous_date": previous.get("timestamp"),
                "changes_detected": []
            }

            # Compare key metrics
            if current.get("dns_poisoning_active") != prev_findings.get("dns_poisoning_active"):
                comparison["changes_detected"].append({
                    "metric": "DNS Poisoning",
                    "previous": prev_findings.get("dns_poisoning_active"),
                    "current": current.get("dns_poisoning_active")
                })

            if current.get("sni_filtering_active") != prev_findings.get("sni_filtering_active"):
                comparison["changes_detected"].append({
                    "metric": "SNI Filtering",
                    "previous": prev_findings.get("sni_filtering_active"),
                    "current": current.get("sni_filtering_active")
                })

            if current.get("encrypted_dns_available") != prev_findings.get("encrypted_dns_available"):
                comparison["changes_detected"].append({
                    "metric": "Encrypted DNS",
                    "previous": prev_findings.get("encrypted_dns_available"),
                    "current": current.get("encrypted_dns_available")
                })

            self.results["historical_comparison"] = comparison

            if comparison["changes_detected"]:
                print("⚠ Changes detected from previous run:")
                for change in comparison["changes_detected"]:
                    print(f"  • {change['metric']}: {change['previous']} → {change['current']}")
            else:
                print("✓ No significant changes from previous run")

        except Exception as e:
            print(f"Could not compare with previous: {e}")

    def save_consolidated_report(self):
        """Save consolidated report"""
        timestamp_str = self.timestamp.strftime("%Y%m%d_%H%M%S")
        filename = REPORT_DIR / f"consolidated_{timestamp_str}.json"

        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)

        print(f"\n✓ Consolidated report saved: {filename}")
        return filename

    def archive_old_reports(self, days_to_keep: int = 30):
        """Archive reports older than specified days"""
        ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
        cutoff = datetime.now() - timedelta(days=days_to_keep)

        archived_count = 0
        for report_file in REPORT_DIR.glob("*.json"):
            if report_file.stat().st_mtime < cutoff.timestamp():
                archive_path = ARCHIVE_DIR / report_file.name
                report_file.rename(archive_path)
                archived_count += 1

        if archived_count > 0:
            print(f"Archived {archived_count} old reports")

def main():
    print("""
    ╔═══════════════════════════════════════════════════════════════════╗
    ║              DPI DAILY MONITORING TEST SUITE                      ║
    ║        Deep Packet Inspection & Censorship Detection              ║
    ║                                                                   ║
    ║  Based on comprehensive investigation of Iranian network          ║
    ║  censorship infrastructure (MCI AS197207, Rightel AS57218)        ║
    ╚═══════════════════════════════════════════════════════════════════╝
    """)

    orchestrator = DailyTestOrchestrator()

    # Run all tests
    orchestrator.run_all_tests()

    # Consolidate findings
    orchestrator.consolidate_findings()

    # Generate alerts
    orchestrator.generate_alerts()

    # Compare with previous
    orchestrator.compare_with_previous()

    # Save consolidated report
    orchestrator.save_consolidated_report()

    # Archive old reports
    orchestrator.archive_old_reports(days_to_keep=30)

    # Print final summary
    print(f"\n{'='*70}")
    print("TEST SUITE COMPLETE")
    print(f"{'='*70}")
    successful = len([t for t in orchestrator.results["tests_run"] if t["success"]])
    total = len(orchestrator.results["tests_run"])
    print(f"Tests: {successful}/{total} successful")
    print(f"Alerts: {len(orchestrator.results['alerts'])}")
    print(f"Duration: {sum(t['duration_seconds'] for t in orchestrator.results['tests_run']):.1f}s")

    return 0 if successful == total else 1

if __name__ == "__main__":
    sys.exit(main())
