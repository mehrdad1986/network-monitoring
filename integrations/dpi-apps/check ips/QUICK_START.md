# DPI Testing Suite - Quick Start Guide

## Overview

This directory contains a comprehensive Deep Packet Inspection (DPI) testing suite for analyzing cloud provider IP accessibility.

## Quick Start

### Option 1: Run Everything (Recommended)
```bash
python run_all_tests.py
```
This will:
- Test 200 IPs across 4 providers (AWS, GCP, DigitalOcean, Hetzner)
- Run tests in parallel (10-15 minutes)
- Generate comprehensive reports
- Create summary analysis

### Option 2: Interactive Menu
```bash
python master_controller.py
```
Features:
- Interactive menu system
- Run individual tests
- View previous reports
- System status checks
- Generate reports from existing data

### Option 3: Individual Tests
```bash
# Test specific provider
python aws_test.py
python gcp_test.py
python digitalocean_test.py
python hetzner_test.py
```

## Test Scripts

### Cloud Provider Tests (50 IPs each)
- `aws_test.py` - Amazon Web Services
- `gcp_test.py` - Google Cloud Platform  
- `digitalocean_test.py` - DigitalOcean
- `hetzner_test.py` - Hetzner

Each test checks:
- **20 TCP ports**: 443, 8443, 2053, 2083, 2087, 2096, 8080, 8880, 3128, 3129, 80, 8000, 22, 2222, 1080, 9050, 1194, 1443, 51820, 5201
- **7 UDP ports**: 51820, 1194, 1197, 500, 4500, 1701, 4569
- **ICMP ping**
- **TLS/SNI inspection**
- **DNS over HTTPS**
- **HTTP accessibility**

### Control Scripts
- `run_all_tests.py` - **Quick CLI runner** (non-interactive)
- `master_controller.py` - **Interactive GUI** (menu-driven)
- `generate_summary.py` - Generate summary from existing results

### Analysis Tools
- `test_dns_server.py` - Test your DNS tunnel server
- `test_dns_tunnel_client.py` - Client connection testing
- `monitor_dns_tunnel.py` - Real-time tunnel monitoring

## Output Files

### Test Results
- `aws_results.txt` - Raw AWS test output
- `gcp_results.txt` - Raw GCP test output
- `digitalocean_results.txt` - Raw DigitalOcean output
- `hetzner_results.txt` - Raw Hetzner output

### Reports
- `DPI_ANALYSIS_REPORT.md` - **Comprehensive analysis** (recommended reading)
- `DPI_Report_YYYYMMDD_HHMMSS.txt` - Text report with timestamp
- `DPI_Report_YYYYMMDD_HHMMSS.html` - HTML report (open in browser)
- `DPI_Report_YYYYMMDD_HHMMSS.json` - JSON data for parsing

## What Gets Tested

### 6-Layer Analysis per IP:

1. **ICMP Ping** - Basic reachability
2. **TCP Port Scan** - 20 VPN/proxy ports
3. **UDP Port Scan** - 7 VPN protocol ports  
4. **DNS over HTTPS** - DNS poisoning check
5. **TLS/SNI Probing** - Deep packet inspection detection
6. **HTTP Plain Text** - Port 80 accessibility

### DPI Methods Detected:

- **IP Null Routing** - Complete blackholing
- **SNI-Based Silent Drop** - TLS inspection
- **TCP RST Injection** - Active blocking
- **DNS Forgery** - DNS sinkhole detection
- **HTTP RST Injection** - HTTP blocking
- **UDP Port Filtering** - VPN protocol blocking

## Usage Examples

### Run All Tests and View Summary
```bash
python run_all_tests.py
python generate_summary.py
```

### Test Single Provider
```bash
python hetzner_test.py > hetzner_custom_results.txt
```

### Generate Report from Existing Results
```bash
# After tests have run once
python master_controller.py
# Select option 5: "Generate Report from Existing Results"
```

### Monitor Your DNS Tunnel
```bash
# Quick snapshot
python monitor_dns_tunnel.py --snapshot

# Real-time monitoring (5s refresh)
python monitor_dns_tunnel.py --monitor 5
```

### Test DNS Server
```bash
python test_dns_server.py
python test_dns_tunnel_client.py
```

## Test Parameters

- **Total IPs**: 200 (50 per provider)
- **TCP Ports**: 20 per IP = 4,000 TCP tests
- **UDP Ports**: 7 per IP = 1,400 UDP tests
- **Total Tests**: 5,400+ individual connection attempts
- **Concurrent Workers**: 20 threads per provider
- **Timeouts**: TCP 3s, UDP 2s
- **Duration**: 10-15 minutes for all providers (parallel)

## Requirements

- Python 3.7+
- Standard library only (no external dependencies)
- Administrator/root recommended for ICMP ping
- Internet connection

## Key Findings from Tests

Based on recent comprehensive testing:

| Provider | Accessibility | Primary DPI Method |
|----------|---------------|-------------------|
| AWS | 0% | IP Blackholing (100%) |
| Google Cloud | 100% | SNI Silent Drop |
| DigitalOcean | 69% | Mixed (31% IP block, 69% SNI) |
| Hetzner | 54% | Mixed (46% IP block, 54% SNI) |

### What Works:
✅ UDP-based VPN protocols (WireGuard, OpenVPN UDP, IKEv2)  
✅ DNS tunneling (your dnstt-server)  
✅ Domain fronting/CDN  

### What's Blocked:
❌ Direct TLS/HTTPS to filtered IPs  
❌ AWS direct connections (100% blocked)  
❌ Plain HTTP tunneling  

## Recommendations

1. **Use UDP protocols** - Not filtered on any accessible IPs
2. **Host on Google Cloud** - Best accessibility (100%)
3. **Avoid AWS** - Heavily blackholed
4. **Your DNS tunnel is perfect** - UDP port 53 bypasses all filtering
5. **Add WireGuard** as backup - UDP 51820 accessible

## File Sizes

Typical output sizes:
- Individual test results: 25-90 KB each
- HTML reports: 10-20 KB
- Text reports: 15-30 KB
- JSON reports: 5-10 KB

## Troubleshooting

**Tests fail to start:**
```bash
python master_controller.py
# Select option 6: "Check System Status"
```

**Missing dependencies:**
All scripts use Python standard library only.

**Permission errors:**
Run with admin/sudo for ICMP ping tests.

**Timeout issues:**
Increase timeout values in test scripts if on slow connection.

## Educational Purpose

These tools are designed for:
- Understanding censorship mechanisms
- Network security research
- VPN accessibility analysis  
- Academic study of DPI techniques

Use responsibly and only on networks you own or have permission to test.

## Support

For issues with the test suite:
- Check `master_controller.py` option 6 (System Status)
- Review output files for error messages
- Ensure all test scripts are in same directory

## License

Educational use only. See individual script headers for details.
