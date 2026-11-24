# DPI Testing & Monitoring Suite
## Complete Collection of Network Censorship Testing Tools

**Location:** `D:\kilo`  
**Created:** 2026-10-09  
**Based on:** Comprehensive DPI investigation reports (MCI AS197207, Rightel AS57218)

---

## 🎯 Quick Start - Most Useful Tools

### 1. **SNI Filter Scanner** (`sni_filter_scanner.py`)
**Check if ANY domain/SNI is blocked in real-time**
```bash
cd D:\kilo
python sni_filter_scanner.py

# Or test specific domains:
python sni_filter_scanner.py test.workers.dev github.com example.com

# Test label count variations:
python sni_filter_scanner.py --labels workers.dev

# Batch test from file:
python sni_filter_scanner.py --batch example_sni_list.txt
```

### 2. **DoH Mass Tester** (`doh_mass_tester.py`)
**Test all 260+ DoH servers from your list**
```bash
cd "D:\dns finder"
python doh_mass_tester.py

# Results show working servers ranked by speed
```

### 3. **Site Blocker Scanner** (`site_blocker_scanner.py`)
**Test top 100 international sites for censorship**
```bash
cd D:\kilo
python site_blocker_scanner.py

# Shows DNS poisoning, SNI blocking, accessibility
```

### 4. **Cloudflare Port & Protocol Scanner** (`cloudflare_port_protocol_scanner.py`)
**Test which ports/protocols are filtered**
```bash
cd D:\kilo
python cloudflare_port_protocol_scanner.py

# Tests HTTP, HTTPS, UDP, DNS ports with different SNIs
```

---

## 📊 Complete Tool List

### Daily Monitoring Suite

| Tool | Description | Usage |
|------|-------------|-------|
| **`daily_orchestrator.py`** | Master scheduler - runs all tests daily | `python daily_orchestrator.py` |
| **`dns_poisoning_detector.py`** | Detects DNS poisoning & sinkhole addresses | Automatic via orchestrator |
| **`sni_filter_tester.py`** | Tests workers.dev blocking patterns | Automatic via orchestrator |
| **`encrypted_dns_monitor.py`** | Tests DoH/DoT availability | Automatic via orchestrator |
| **`multi_isp_comparison.py`** | Compares MCI vs Rightel filtering | Automatic via orchestrator |
| **`sni_spoofing_tester.py`** | Tests evasion techniques | Automatic via orchestrator |

### Interactive Tools

| Tool | Description | Key Features |
|------|-------------|--------------|
| **`sni_filter_scanner.py`** ⭐ | Real-time SNI filter tester | Interactive mode, batch testing, label count testing |
| **`site_blocker_scanner.py`** | Top 100 sites censorship scan | DNS poisoning, SNI blocking, accessibility |
| **`cloudflare_port_protocol_scanner.py`** 🆕 | Port & protocol filter test | Tests all CF ports, identifies filtering patterns |
| **`doh_mass_tester.py`** | DoH server mass tester | Tests 260+ DoH URLs, finds working servers |

### Scheduling & Setup

| File | Description |
|------|-------------|
| **`setup_scheduler.bat`** | Windows Task Scheduler setup |
| **`setup_cron.sh`** | Linux/Unix cron setup |
| **`README.md`** | Complete documentation |

---

## 🔧 Installation & Setup

### Prerequisites
```bash
# Python 3.7+ required
python --version

# Install dependencies
pip install dnspython
```

### Setup Daily Automatic Testing

#### Windows:
```batch
# Run as Administrator
cd D:\kilo
setup_scheduler.bat

# Tests will run daily at 3:00 AM
```

#### Linux/Unix:
```bash
cd /d/kilo
chmod +x setup_cron.sh
./setup_cron.sh

# Tests will run daily at 3:00 AM
```

---

## 📈 Test Results & Reports

### Report Locations
- **Daily reports:** `D:\kilo\reports\daily\`
- **Archive (30+ days):** `D:\kilo\reports\archive\`
- **DoH results:** `D:\dns finder\doh_test_results_*.json`

### Report Types
```
dns_poisoning_YYYYMMDD_HHMMSS.json
sni_filter_YYYYMMDD_HHMMSS.json
encrypted_dns_YYYYMMDD_HHMMSS.json
isp_comparison_YYYYMMDD_HHMMSS.json
sni_spoofing_YYYYMMDD_HHMMSS.json
site_blocker_scan_YYYYMMDD_HHMMSS.json
port_protocol_scan_YYYYMMDD_HHMMSS.json
consolidated_YYYYMMDD_HHMMSS.json
```

---

## 🎨 Understanding Test Results

### Color Coding (Terminal)
- **✓ GREEN** = Passed / Working / Accessible
- **✗ RED** = Blocked / Filtered / Failed
- **⊗ RED** = DNS Poisoned (sinkhole)
- **→ BLUE** = Reached server (may have error, but not blocked)
- **⚠ YELLOW** = Warning / Partial / Unknown

### Verdict Types

#### DNS Verdicts
- `CLEAN` - DNS resolves to legitimate IP
- `SINKHOLE` - DNS poisoned to 10.10.34.34/35/36
- `ERROR` - Resolution failed

#### Connection Verdicts
- `WORKING` / `ACCESSIBLE` - Connection successful, data received
- `TIMEOUT` - Connection timeout (likely filtered)
- `SILENT_DROP` - Handshake completed, but no application data (DPI filter)
- `TCP_RESET` - Connection reset by peer (active blocking)
- `SSL_ERROR` - TLS/SSL error

#### SNI Filter Verdicts
- `PASSED` - SNI not filtered
- `BLOCKED` - SNI filtered (timeout or silent drop)
- `REACHED` - Reached Cloudflare (got error, but not blocked upstream)

---

## 🔍 Key Findings from Investigation

### DNS Poisoning
- **Sinkhole IPs:** 10.10.34.34, .35, .36
- **ISP Fingerprint:** Last octet identifies ISP (.36 = MCI, .35 = Rightel)
- **TTL Signature:** 417-420 seconds indicates forged responses
- **Targets:** Facebook, Instagram, YouTube, X/Twitter, pages.dev, DoH resolver names

### SNI Filtering (workers.dev)
- **Blocked range:** 3-4 label domains (e.g., test.workers.dev, a.b.workers.dev)
- **Pass-through:** 5+ labels (e.g., a.b.c.workers.dev)
- **ISP-specific:** MCI blocks, Rightel does NOT block
- **Mechanism:** Silent drop post-handshake (NOT TCP reset)
- **Port-independent:** All TLS ports (443, 2053, 2083, 2087, 2096, 8443) filtered identically

### Encrypted DNS
- **DoH by hostname:** 100% blocked (TCP reset or timeout)
- **DoH by IP literal:** WORKS (only method that works)
  - `https://8.8.8.8/dns-query` works on MCI
  - `https://1.1.1.1/dns-query` works on Rightel
- **DoT port 853:** 100% blocked everywhere
- **Dual-upstream required:** Configure both 8.8.8.8 AND 1.1.1.1

### Evasion Techniques
- **✓ WORKS:** 5+ DNS labels (custom domain deployment)
- **✗ FAILS:** Case mangling (filter normalizes case)
- **✗ FAILS:** ClientHello fragmentation (filter reassembles)
- **✗ FAILS:** Port rotation (all TLS ports filtered identically)
- **? AMBIGUOUS:** SNI omission (could be filter or Cloudflare)

---

## 🚀 Common Usage Scenarios

### Scenario 1: Check if a specific domain is blocked
```bash
cd D:\kilo
python sni_filter_scanner.py
# Then type: example.com
```

### Scenario 2: Find working DoH servers
```bash
cd "D:\dns finder"
python doh_mass_tester.py
# Results saved with working servers list
```

### Scenario 3: Test all Cloudflare ports
```bash
cd D:\kilo
python cloudflare_port_protocol_scanner.py
# Shows which ports work, which are filtered
```

### Scenario 4: Run complete daily suite
```bash
cd D:\kilo
python daily_orchestrator.py
# Runs all tests, generates consolidated report
```

### Scenario 5: Check international site censorship
```bash
cd D:\kilo
python site_blocker_scanner.py
# Tests top 100 sites, shows DNS poisoning & SNI blocking
```

---

## 🛠️ Troubleshooting

### Tests timing out
- Check network connectivity
- Verify Cloudflare IPs are reachable: `ping 188.114.96.1`
- Increase timeout in scripts (default: 2.5-5s)

### Permission errors
- **Windows:** Run Task Scheduler setup as Administrator
- **Linux:** Ensure user has crontab permissions

### Missing reports
- Check `D:\kilo\reports\daily\` exists
- Verify disk space available
- Check orchestrator logs

### DNS resolution fails
- System DNS may be poisoned
- Tests use hardcoded IPs to bypass this
- Verify IPs in scripts are current

---

## 📚 Investigation Reports

Located in: `D:\kilo\reports\`

### Primary Reports
- `COMPREHENSIVE_DPI_INTELLIGENCE_REPORT.txt` - Complete investigation
- `MASTER_FINDINGS.txt` - Consolidated findings
- `SNI_FILTER_RULE_REPORT.txt` - Label-count analysis
- `ISP_COMPARISON.txt` - MCI vs Rightel comparison
- `DPI_EVIDENCE_REPORT.txt` - Empirical measurements
- `PACKET_LEVEL_FINDINGS.txt` - Packet capture analysis

---

## 🎯 Recommendations

### For MCI Users (workers.dev blocked)
1. **Deploy on custom domain with 5+ labels**
   - Example: `a.b.c.d.yourdomain.com`
   - Use Cloudflare DNS proxying

2. **Configure dual-upstream DoH**
   - Primary: `https://8.8.8.8/dns-query`
   - Fallback: `https://1.1.1.1/dns-query`
   - Use IP literal addressing (NOT hostnames)

3. **Block sinkhole ranges in routing**
   - `10.10.34.0/24`
   - `2001:4188:2:600::/64`

4. **Fast-fail timeout: 2.0-2.5 seconds**

5. **NO ClientHello fragmentation** (proven ineffective)

6. **NO case mangling** (proven ineffective)

### For Rightel Users
- workers.dev works unchanged
- Still configure dual-upstream DoH (1.1.1.1 primary)

---

## 📞 Support & Documentation

- **Tool Documentation:** See individual `--help` flags
- **Investigation Reports:** `D:\kilo\reports\`
- **Test History:** `D:\kilo\reports\daily\`
- **GitHub Issues:** (if applicable)

---

## 📝 Notes

- **Network:** Based on MCI (AS197207) and Rightel (AS57218) testing
- **Date:** Investigation conducted 2026-10-02
- **Updates:** Tools updated 2026-10-09
- **Purpose:** Network transparency, censorship research, defensive security

**Use responsibly for network analysis and research purposes.**

---

## 🗂️ File Structure

```
D:\kilo\
├── daily_orchestrator.py              # Master scheduler
├── dns_poisoning_detector.py          # DNS poisoning detection
├── sni_filter_tester.py               # SNI filter testing
├── encrypted_dns_monitor.py           # DoH/DoT monitoring
├── multi_isp_comparison.py            # ISP comparison
├── sni_spoofing_tester.py             # Evasion techniques
├── sni_filter_scanner.py              # ⭐ Interactive SNI tester
├── site_blocker_scanner.py            # Top 100 sites scanner
├── cloudflare_port_protocol_scanner.py # 🆕 Port/protocol tester
├── setup_scheduler.bat                # Windows scheduler
├── setup_cron.sh                      # Linux/Unix cron
├── example_sni_list.txt               # Example test list
├── README.md                          # This file
└── reports\
    ├── daily\                         # Daily test results
    └── archive\                       # 30+ day archive

D:\dns finder\
├── doh_mass_tester.py                 # DoH URL mass tester
├── doh-list.txt                       # 260+ DoH URLs
└── all.txt                            # IP addresses
```

---

**Last Updated:** 2026-10-09  
**Version:** 1.0  
**Total Tools:** 10 applications
