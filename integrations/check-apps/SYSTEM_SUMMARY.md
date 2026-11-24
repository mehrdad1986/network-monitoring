# Complete Website & DoH Checking System - Summary

## 📦 Your Complete System (3 Apps)

### 1. check_doh.py
**Purpose**: Test DoH servers for accessibility
- Input: `DOH_MAX_PUBLIC_ENDPOINTS.txt` (738 DoH servers)
- Output:
  - `doh_results.csv` - All results with latency
  - `doh_results.txt` - Ranked accessible servers

### 2. check_websites.py
**Purpose**: Check websites with DNS comparison
- Input: 
  - `world_top_2000_with_rank_and_country.csv`
  - `world_next_2000_by_country.csv`
- Features:
  - Compares System DNS vs Google DNS (8.8.8.8) vs DoH server
  - Detects DNS poisoning (10.x.x.x or wrong IPs)
  - Measures latency for accessible sites
  - Real-time status display
- Output:
  - `website_check_results.csv` - All results with IPs
  - `filtered_websites_report.txt` - DPI filtering report
  - `fastest_100_websites.txt` - **NEW! Top 100 fastest sites with latency**
  - `filtered_with_wrong_ips.txt` - **NEW! Filtered sites with wrong IPs from 8.8.8.8**

### 3. master_checker.py
**Purpose**: Orchestrate everything automatically
- Runs check_doh.py
- Double-checks top 20 DoH servers
- Selects best 3 DoH servers
- Runs website checks with all 3 DoH servers in parallel
- Generates master comparison report

## 🎯 New Features Added

### ✅ Fastest 100 Websites Report
Shows the 100 websites with best ping latency:
```
RANK | LATENCY (ms) | DOMAIN | COUNTRY
  1. |      45.23 ms | example.com [United States] (IP: 93.184.216.34)
  2. |      67.89 ms | fast-site.com [Germany] (IP: 185.199.108.153)
  ...
```

Includes statistics:
- Fastest website
- Slowest in top 100
- Average latency

### ✅ Filtered Websites with Wrong IPs Report
Shows ALL filtered websites with DNS details:
```
Domain: blocked-site.com
  Filter Reason: Connection timeout (possible DPI blocking)
  System DNS IP: 10.10.34.34
  Google DNS (8.8.8.8) IP: 10.10.34.34  ⚠ WRONG IP!
  DoH Server IP: 142.250.185.46
  ⚠ DNS MISMATCH: System DNS: 10.10.34.34 vs DoH: 142.250.185.46
  Country: United States
  Rank: 234
```

Groups by:
- DNS resolution failures
- Private IPs (10.x.x.x) from 8.8.8.8
- DNS mismatches

## 📊 Output Files from Master Run

After running `python3 master_checker.py`, you'll have:

### DoH Results:
1. `doh_results.csv` - All 738 DoH servers tested
2. `doh_results.txt` - Ranked list
3. `verified_doh_servers.json` - Double-checked top 20

### Website Results (×3, one per DoH server):
**For each of the 3 best DoH servers:**
4. `website_check_results_doh1.csv`
5. `filtered_websites_report_doh1.txt`
6. `fastest_100_websites_doh1.txt` - **NEW!**
7. `filtered_with_wrong_ips_doh1.txt` - **NEW! Shows 8.8.8.8 wrong IPs**

(Same for doh2 and doh3)

### Master Reports:
13. `master_report.txt` - Complete comparison across all 3 DoH servers

**Total: 13 output files with comprehensive analysis!**

## 🚀 Usage Examples

### Quick Test (Recommended First)
```bash
# Test with 50 websites to verify everything works
python3 master_checker.py --limit 50
```

### Full Run
```bash
# Check all 4000 websites with top 3 DoH servers
python3 master_checker.py

# Takes ~45-60 minutes
```

### Custom Options
```bash
# Use top 5 DoH servers instead of 3
python3 master_checker.py --doh-count 5

# Verify more DoH servers
python3 master_checker.py --verify-count 30

# Skip DoH check if already done
python3 master_checker.py --skip-doh-check
```

### Run Individual Apps
```bash
# Just check DoH servers
python3 check_doh.py

# Just check websites with specific DoH
python3 check_websites.py --doh https://dns.google/dns-query --limit 100

# Use Cloudflare IP DoH
python3 check_websites.py --cloudflare-ip --limit 100
```

## 🔍 What You'll Discover

### DNS Poisoning Detection
Compare IPs from:
- Your system DNS
- Google DNS (8.8.8.8)
- DoH server

If they differ → DNS manipulation detected!

### DPI Filtering Methods
The system detects:
1. **DNS Poisoning**: Wrong IPs (especially 10.x.x.x)
2. **IP Blocking**: Connection refused/timeout
3. **SSL/TLS Interference**: HTTPS blocked but HTTP works
4. **Connection Reset**: TCP actively terminated

### Performance Analysis
- See which websites are fastest from your location
- Compare latencies across 4000 websites
- Identify best websites for testing connectivity

### Wrong IP Report (8.8.8.8)
Special focus on Google DNS (8.8.8.8) because:
- It's the most popular public DNS
- Shows if your ISP manipulates even Google DNS
- Private IPs (10.x.x.x) indicate clear DNS poisoning

## 📈 Expected Results

### From your location, you might see:
- **Accessible**: 85-95% of websites
- **Filtered**: 5-15% of websites
- **DNS Mismatches**: 0-20% (depends on ISP filtering)
- **Fastest websites**: Usually CDN-backed sites (Cloudflare, Google, etc.)

### Report Highlights:
1. Top 100 fastest websites (typically 50-500ms range)
2. List of filtered websites grouped by country
3. DNS poisoning evidence (10.x IPs from 8.8.8.8)
4. Comparison showing if different DoH servers detect different blocks

## ⏱️ Execution Time

| Task | Time | Total Sites |
|------|------|-------------|
| DoH check | 2-5 min | 738 servers |
| DoH verification | 1-2 min | 20 servers |
| Website check (×3) | 15-20 min each | 4000 each |
| **Total Full Run** | **45-65 min** | **12,000 checks** |

With `--limit 50`: ~5 minutes total

## 🎁 Key Innovations

1. **Triple DNS Comparison**: System + Google + DoH = catches all manipulation
2. **Double DoH Verification**: Ensures DoH servers actually work
3. **Parallel Multi-DoH**: Runs 3 website checks simultaneously
4. **Latency Tracking**: Best 100 websites by ping time
5. **8.8.8.8 Focus**: Special report on Google DNS manipulation
6. **Comprehensive Reports**: 4 reports per DoH server

## 📝 Sample Output

```
STEP 1: Running check_doh.py...
✓ Found 97 accessible DoH servers

STEP 2: Double-checking top 20 DoH servers...
✓ 18 DoH servers verified and working

STEP 3: Saving verified DoH servers...
✓ Saved to verified_doh_servers.json

STEP 4: Selecting best 3 DoH servers...
  1. https://dns.google/dns-query (Latency: 45.23 ms)
  2. https://cloudflare-dns.com/dns-query (Latency: 52.11 ms)
  3. https://dns.quad9.net/dns-query (Latency: 58.67 ms)

STEP 5: Checking 4000 websites with 3 DoH servers...
[1/3] DoH: https://dns.google/dns-query
  Results: 3567 accessible, 433 filtered, 89 DNS mismatches

[2/3] DoH: https://cloudflare-dns.com/dns-query
  Results: 3582 accessible, 418 filtered, 76 DNS mismatches

[3/3] DoH: https://dns.quad9.net/dns-query
  Results: 3559 accessible, 441 filtered, 92 DNS mismatches

STEP 6: Master report generated!

✓ All reports saved!
✓ Top 3 fastest websites:
  1. example.com - 45.23 ms
  2. google.com - 52.11 ms
  3. cloudflare.com - 58.67 ms
```

Ready to run! 🚀
