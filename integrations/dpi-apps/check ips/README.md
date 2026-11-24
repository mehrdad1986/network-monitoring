# Cloud Provider IP Accessibility & DPI Detection Tests

Educational tools for understanding network filtering and Deep Packet Inspection (DPI) methods applied to cloud provider IP ranges.

## Overview

This suite tests IP accessibility across major cloud providers:
- **AWS** (Amazon Web Services) - Fetches live IP ranges
- **Google Cloud Platform** (GCP)
- **DigitalOcean**
- **Hetzner**

Each test performs comprehensive multi-layer analysis:
1. **ICMP Ping** - Basic reachability
2. **TCP Port Scanning** - Tests 20 VPN-relevant ports:
   - HTTPS: 443, 8443, 2053, 2083, 2087, 2096
   - HTTP/Proxy: 80, 8000, 8080, 8880, 3128, 3129
   - SSH: 22, 2222
   - SOCKS/Proxy: 1080, 9050 (Tor)
   - VPN: 1194, 1443 (OpenVPN), 51820 (WireGuard)
   - Testing: 5201 (iPerf3)
3. **UDP Port Scanning** - Tests 7 VPN protocol ports:
   - WireGuard: 51820
   - OpenVPN: 1194, 1197
   - IKEv2: 500, 4500
   - L2TP: 1701
   - IAX2: 4569
4. **DNS over HTTPS** - Detects DNS poisoning/sinkhole
5. **TLS/SNI Probing** - Deep Packet Inspection detection with different SNI values
6. **HTTP Plain Text** - Port 80 accessibility

## DPI Detection Methods

The tests identify these filtering techniques:
- **DNS Forgery** - Sinkhole IPs (10.10.34.34/35/36)
- **IP Null Routing** - Complete IP blackholing
- **TCP RST Injection** - Active connection termination
- **Silent Drop** - Passive packet dropping
- **SNI-based Filtering** - TLS SNI inspection and blocking
- **HTTP RST Injection** - Plain HTTP blocking
- **UDP Port Filtering** - VPN protocol blocking

## Usage

### Run Individual Tests

```bash
# Test AWS IPs
python aws_test.py

# Test Google Cloud IPs
python gcp_test.py

# Test DigitalOcean IPs
python digitalocean_test.py

# Test Hetzner IPs
python hetzner_test.py
```

### Run All Tests

```bash
python run_all_tests.py
```

This will run all 4 test suites sequentially and provide a comprehensive summary.

## Test Parameters

Each test samples **50 IPs** from the provider's IP ranges:
- **TCP ports tested**: 20 ports per IP (400 TCP tests total per provider)
- **UDP ports tested**: 7 ports per IP (350 UDP tests total per provider)
- **Concurrent workers**: 20 threads
- **TCP timeout**: 3.0 seconds
- **UDP timeout**: 2.0 seconds
- **Total test duration**: ~5-12 minutes per provider (depending on blocking)

## Output

Each test provides:
1. **Real-time per-IP analysis** - Detailed layer-by-layer results
2. **Summary table** - Quick overview of all tested IPs
3. **DPI method statistics** - Frequency of each filtering technique
4. **Final results** - Accessibility percentage

### Example Output

```
IP               Ping   443        TLS-SNI         HTTP         UDP    Classification
--------------------------------------------------------------------------------
54.123.45.67     ✓      CONNECT    TLS_OK          HTTP_OK      YES    TCP_443_OK | TLS_HANDSHAKE_OK
52.98.76.54      ✗      TIMEOUT    HANG            TIMEOUT      NO     TCP_TIMEOUT_443 | SNI_SILENT_DROP

DPI METHOD STATISTICS:
  SNI_based_silent_drop      : 12 IPs (40.0%)
  TCP_RST_injection          :  8 IPs (26.7%)
  not_blocked_at_TLS_layer   : 10 IPs (33.3%)

FINAL RESULTS: 10/30 accessible (33.3%), 20 blocked (66.7%)
```

## Requirements

- Python 3.7+
- Standard library only (no external dependencies)
- Administrator/root privileges recommended for ICMP ping

## Network Impact

- Tests are **read-only** and non-invasive
- Low bandwidth usage (~1-2 KB per IP)
- Respectful timeouts to avoid triggering rate limits
- No actual VPN connections established

## Educational Purpose

These tools are designed for:
- Understanding censorship mechanisms
- Network security research
- VPN accessibility analysis
- Academic study of DPI techniques

## Legal Notice

Use these tools only:
- On networks you own or have permission to test
- In compliance with local laws and regulations
- For educational and research purposes
- Without causing harm or disruption

## Exit Codes

- `0` - All IPs accessible
- `1` - Configuration/runtime error
- `2` - Some IPs blocked (normal in filtered environments)

## Notes

- AWS test fetches live IP ranges from Amazon's public JSON
- Other providers use hardcoded CIDR ranges (accurate as of 2024)
- Results depend on your network location and ISP filtering policies
- False positives possible if IPs have no active services

## Support

For issues or questions about these educational tools, please consult network security resources and documentation on DPI techniques.
