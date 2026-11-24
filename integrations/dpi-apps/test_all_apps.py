#!/usr/bin/env python3
"""
Application Testing Suite
Tests all created applications to ensure they work correctly
Identifies and reports issues
"""

import subprocess
import sys
import os
from datetime import datetime

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    RESET = '\033[0m'

def test_app(app_name, test_command, expected_keywords=None, timeout=10):
    """Test an application and check for errors"""
    print(f"\n{Colors.CYAN}Testing: {app_name}{Colors.RESET}")
    print(f"Command: {test_command}")

    try:
        result = subprocess.run(
            test_command,
            shell=False,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=os.path.dirname(os.path.abspath(__file__))
        )

        # Check for errors
        if result.returncode != 0:
            print(f"{Colors.RED}✗ FAILED - Exit code: {result.returncode}{Colors.RESET}")
            if result.stderr:
                print(f"Error: {result.stderr[:500]}")
            return False

        # Check for expected keywords
        if expected_keywords:
            output = result.stdout + result.stderr
            for keyword in expected_keywords:
                if keyword.lower() in output.lower():
                    print(f"{Colors.GREEN}✓ PASSED - Found '{keyword}'{Colors.RESET}")
                    return True

            print(f"{Colors.YELLOW}⚠ WARNING - Expected keywords not found{Colors.RESET}")
            return False

        print(f"{Colors.GREEN}✓ PASSED{Colors.RESET}")
        return True

    except subprocess.TimeoutExpired:
        print(f"{Colors.YELLOW}⚠ TIMEOUT (may need user input){Colors.RESET}")
        return None
    except Exception as e:
        print(f"{Colors.RED}✗ ERROR: {e}{Colors.RESET}")
        return False

def main():
    print(f"""
{Colors.BOLD}{Colors.CYAN}╔═══════════════════════════════════════════════════════════════════╗
║           APPLICATION TESTING SUITE                               ║
║        Testing all created DPI monitoring tools                   ║
╚═══════════════════════════════════════════════════════════════════╝{Colors.RESET}

Testing Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
    """)

    tests = [
        {
            "name": "SNI Filter Scanner",
            "command": [sys.executable, "sni_filter_scanner.py", "--help"],
            "keywords": ["usage", "sni"]
        },
        {
            "name": "Site Blocker Scanner (Import Test)",
            "command": [sys.executable, "-c", "import site_blocker_scanner; print('OK')"],
            "keywords": ["OK"]
        },
        {
            "name": "DNS Poisoning Detector (Import Test)",
            "command": [sys.executable, "-c", "import dns_poisoning_detector; print('OK')"],
            "keywords": ["OK"]
        },
        {
            "name": "Encrypted DNS Monitor (Import Test)",
            "command": [sys.executable, "-c", "import encrypted_dns_monitor; print('OK')"],
            "keywords": ["OK"]
        },
        {
            "name": "SNI Spoofing Tester (Import Test)",
            "command": [sys.executable, "-c", "import sni_spoofing_tester; print('OK')"],
            "keywords": ["OK"]
        }
    ]

    results = {
        "passed": 0,
        "failed": 0,
        "warnings": 0
    }

    for test in tests:
        result = test_app(test["name"], test["command"], test.get("keywords"))

        if result is True:
            results["passed"] += 1
        elif result is False:
            results["failed"] += 1
        else:
            results["warnings"] += 1

    # Print summary
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*70}")
    print("SUMMARY")
    print(f"{'='*70}{Colors.RESET}\n")

    print(f"{Colors.GREEN}Passed:   {results['passed']}{Colors.RESET}")
    print(f"{Colors.RED}Failed:   {results['failed']}{Colors.RESET}")
    print(f"{Colors.YELLOW}Warnings: {results['warnings']}{Colors.RESET}")

    if results["failed"] > 0 or results["warnings"] > 0:
        print(f"\n{Colors.RED}Some tests failed. Please review errors above.{Colors.RESET}")
        return 1
    else:
        print(f"\n{Colors.GREEN}All tests passed!{Colors.RESET}")
        return 0

if __name__ == "__main__":
    sys.exit(main())
