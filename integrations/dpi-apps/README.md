# DPI Daily Monitoring Test Suite

Automated testing suite for Deep Packet Inspection (DPI) and network censorship monitoring, based on comprehensive investigation of Iranian network infrastructure (MCI AS197207, Rightel AS57218).

## Overview

This suite replicates the tests from the original DPI investigation reports to monitor:
- DNS poisoning and sinkhole detection
- SNI-based filtering (workers.dev blocking)
- Encrypted DNS availability (DoH/DoT)
- ISP-specific vs national-level censorship
- SNI evasion technique effectiveness

## Components

### 1. DNS Poisoning Detector (`dns_poisoning_detector.py`)
Monitors DNS responses for censorship indicators:
- Detects sinkhole addresses (10.10.34.34/35/36)
- Tests known censored domains (Facebook, Instagram, YouTube, X/Twitter)
- Checks DoH resolver hostname poisoning
- Validates control domains

**Key Findings:**
- Sinkhole IP fingerprinting: .36 = MCI, .35 = Rightel
- High TTL signature (417-420s) indicates forged responses
- Case randomization ineffective (filter normalizes)

### 2. SNI Filter Tester (`sni_filter_tester.py`)
Tests workers.dev SNI-based blocking with label-count variations:
- Tests 2-7 label variations (e.g., `a.b.workers.dev`)
- Measures TLS handshake completion vs application data delivery
- Tests port independence (443, 2053, 2083, 2087, 2096, 8443)

**Key Findings:**
- 3-4 labels: BLOCKED (silent drop post-handshake)
- 5+ labels: PASS (exceeds filter's pattern window)
- All TLS ports filtered identically

### 3. Encrypted DNS Monitor (`encrypted_dns_monitor.py`)
Tests DoH/DoT availability across multiple resolvers:
- DoH by hostname (expected: BLOCKED via TCP RST)
- DoH by IP literal (ISP-specific: 8.8.8.8 on MCI, 1.1.1.1 on Rightel)
- DoT port 853 (expected: 100% blocked)

**Key Findings:**
- DoH by name: 100% blocked
- DoH by IP literal: ONLY method that works
- ISP-specific blocking patterns require dual-upstream config

### 4. Multi-ISP Comparison (`multi_isp_comparison.py`)
Compares filtering behavior across ISPs:
- Auto-detects current ISP from public IP
- Tests workers.dev blocking (MCI: YES, Rightel: NO)
- Identifies national vs ISP-specific censorship
- Fingerprints ISP from sinkhole IP

**Key Findings:**
- workers.dev blocking is MCI-SPECIFIC, not national
- Sinkhole last octet fingerprints ISP
- National layer: DNS poisoning of major platforms

### 5. SNI Spoofing Tester (`sni_spoofing_tester.py`)
Tests SNI manipulation and evasion techniques:
- Case mangling (INEFFECTIVE - filter normalizes)
- ClientHello fragmentation (INEFFECTIVE - filter reassembles)
- Label count bypass (EFFECTIVE - 5+ labels work)
- Domain fronting (tests SNI/Host mismatch)
- TLS version variation (IRRELEVANT)
- SNI omission (AMBIGUOUS)

**Key Findings:**
- ONLY working technique: 5+ DNS labels
- All client-side obfuscation fails
- Recommendation: Custom domain deployment

### 6. Daily Orchestrator (`daily_orchestrator.py`)
Master scheduler that:
- Runs all tests sequentially
- Consolidates findings across reports
- Generates alerts for significant changes
- Compares with historical data
- Archives old reports (30 day retention)

## Installation

### Prerequisites
```bash
# Python 3.7+ required
python --version

# Install dependencies
pip install dnspython
```

### Setup Daily Scheduling

#### Windows (Task Scheduler)
```batch
# Run as Administrator
cd D:\kilo\daily_tests
setup_scheduler.bat
```

#### Linux/Unix (cron)
```bash
chmod +x setup_cron.sh
./setup_cron.sh
```

## Usage

### Manual Test Execution

Run individual tests:
```bash
cd D:\kilo\daily_tests

# DNS poisoning detection
python dns_poisoning_detector.py

# SNI filter testing
python sni_filter_tester.py

# Encrypted DNS monitoring
python encrypted_dns_monitor.py

# Multi-ISP comparison
python multi_isp_comparison.py

# SNI spoofing techniques
python sni_spoofing_tester.py
```

Run complete suite:
```bash
python daily_orchestrator.py
```

### Automated Daily Execution

Once scheduled (via `setup_scheduler.bat` or `setup_cron.sh`), tests run automatically at 3:00 AM daily.

### Viewing Reports

Reports are saved to `D:\kilo\reports\daily\` with timestamps:
```
dns_poisoning_20261009_030001.json
sni_filter_20261009_030045.json
encrypted_dns_20261009_030130.json
isp_comparison_20261009_030215.json
sni_spoofing_20261009_030300.json
consolidated_20261009_030400.json
```

Archived reports (30+ days old) are moved to `D:\kilo\reports\archive\`

## Report Structure

### Individual Test Reports
```json
{
  "timestamp": "2026-10-09T03:00:00",
  "test_specific_data": {},
  "summary": {
    "key_metrics": "...",
    "status": "..."
  }
}
```

### Consolidated Report
```json
{
  "timestamp": "2026-10-09T03:04:00",
  "tests_run": [...],
  "consolidated_findings": {
    "censorship_active": true,
    "dns_poisoning_active": true,
    "sni_filtering_active": true,
    "encrypted_dns_available": true,
    "working_resolvers": [...],
    "detected_isp": "MCI",
    "censorship_layers": 2
  },
  "alerts": [...],
  "historical_comparison": {...}
}
```

## Alert Types

- **HIGH: NO_ENCRYPTED_DNS** - No working DoH resolvers found
- **HIGH: MULTI_LAYER_CENSORSHIP** - Multiple censorship mechanisms active
- **MEDIUM: TEST_FAILURES** - One or more tests failed to complete
- **INFO: SIGNIFICANT_CHANGE** - Filtering behavior changed from previous day

## Based On

This suite is based on comprehensive DPI investigation reports:
- `MASTER_FINDINGS.txt` - Complete investigation record
- `COMPREHENSIVE_DPI_INTELLIGENCE_REPORT.txt` - Technical intelligence
- `SNI_FILTER_RULE_REPORT.txt` - Label-count pattern analysis
- `DPI_EVIDENCE_REPORT.txt` - Empirical measurements
- `ISP_COMPARISON.txt` - MCI vs Rightel comparison
- `PACKET_LEVEL_FINDINGS.txt` - Packet capture analysis

Investigation Period: 2026-10-02  
Networks Tested: MCI (AS197207), Rightel (AS57218)  
Methods: Empirical measurement, packet capture, comparative analysis

## Recommendations

Based on test results:

1. **If workers.dev is blocked (MCI):**
   - Deploy Worker on custom domain with 5+ DNS labels
   - Example: `a.b.c.d.yourdomain.com`
   - Use Cloudflare DNS proxying

2. **For encrypted DNS:**
   - Configure dual-upstream: `https://8.8.8.8/dns-query` AND `https://1.1.1.1/dns-query`
   - Use IP literal addressing (NOT hostnames)
   - Block sinkhole ranges in routing: `10.10.34.0/24`, `2001:4188:2:600::/64`

3. **Client configuration:**
   - Fast-fail timeout: 2.0-2.5 seconds
   - Multi-port redundancy: 443, 2053, 2083, 2087, 2096, 8443
   - NO ClientHello fragmentation (ineffective)
   - NO case mangling (ineffective)

## Troubleshooting

### Tests timing out
- Check network connectivity
- Verify Cloudflare IPs are reachable
- Increase timeout in test scripts (default: 2.5-5s)

### Permission errors
- Windows: Run Task Scheduler setup as Administrator
- Linux: Ensure user has crontab permissions

### Missing reports
- Check `D:\kilo\reports\daily\` exists
- Verify disk space available
- Check orchestrator logs

### DNS resolution fails
- System DNS may be poisoned
- Tests use hardcoded IPs to bypass this
- Verify IPs in test scripts are current

## License

Based on open network measurement research. Use for network analysis, research, and defensive security purposes only.

## Contact

For questions about the investigation methodology or findings, refer to the original reports in `D:\kilo\reports\`.

---

**Note:** These tests are designed for network transparency and censorship research. Results may vary based on network location, ISP, and time. Historical findings from MCI and Rightel networks in Iran, October 2026.


## Sequential mother application (October 23 audit)

See [MOTHER_APP_GUIDE.md](MOTHER_APP_GUIDE.md) for the controller, [APP_INVENTORY.md](APP_INVENTORY.md) for all 103 original apps, and [BACKEND_AUDIT.md](BACKEND_AUDIT.md) for verified fixes and validation limits. These current instructions supersede the legacy Windows and `kilo` paths above.

```bash
python3 mother_app.py --list
python3 mother_app.py --check
python3 mother_app.py --run --timeout 300
```
