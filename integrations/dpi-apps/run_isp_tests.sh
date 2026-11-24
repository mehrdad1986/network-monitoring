#!/bin/bash
#
# ISP Traceroute Analysis Suite
# Tests 30 DNS servers + 200 websites with IPv4 and IPv6 traceroutes + DNS resolution
#
# Usage:  ./run_isp_tests.sh <ISP_NAME>
# Example: ./run_isp_tests.sh MCI
#          ./run_isp_tests.sh Irancell
#          ./run_isp_tests.sh Rightel
#

ISP_NAME="${1:-$(hostname)}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
RESULTS_DIR="${NETMON_RESULTS_DIR:-$PROJECT_ROOT/results}"
OUTDIR="$RESULTS_DIR/${ISP_NAME}_${TIMESTAMP}"
mkdir -p "$OUTDIR"

echo "========================================"
echo "ISP Analysis: $ISP_NAME"
echo "Started: $(date)"
echo "Output dir: $OUTDIR"
echo "========================================"

# ---- Capture network info ----
echo "--- Network Info ---" > "$OUTDIR/network_info.txt"
echo "Run timestamp: $TIMESTAMP" >> "$OUTDIR/network_info.txt"
echo "ISP name: $ISP_NAME" >> "$OUTDIR/network_info.txt"
echo "Hostname: $(hostname)" >> "$OUTDIR/network_info.txt"
echo "" >> "$OUTDIR/network_info.txt"
echo "=== IP address ===" >> "$OUTDIR/network_info.txt"
ip -4 addr show 2>/dev/null | grep inet >> "$OUTDIR/network_info.txt" || ifconfig 2>/dev/null | grep inet >> "$OUTDIR/network_info.txt"
echo "" >> "$OUTDIR/network_info.txt"
echo "=== Route/NAT ===" >> "$OUTDIR/network_info.txt"
ip route 2>/dev/null >> "$OUTDIR/network_info.txt" || netstat -rn 2>/dev/null >> "$OUTDIR/network_info.txt"
echo "" >> "$OUTDIR/network_info.txt"
echo "=== DNS config ===" >> "$OUTDIR/network_info.txt"
cat /etc/resolv.conf 2>/dev/null >> "$OUTDIR/network_info.txt"
echo "" >> "$OUTDIR/network_info.txt"
echo "=== Default route gateway ===" >> "$OUTDIR/network_info.txt"
ip route 2>/dev/null | grep default >> "$OUTDIR/network_info.txt"

# ---- DNS server list (30 servers) ----
DNS_SERVERS=(
1.1.1.1
8.8.8.8
9.9.9.9
4.2.2.2
4.2.2.1
208.67.222.222
208.67.220.220
8.26.56.26
8.26.56.10
149.112.121.10
156.155.156.156
185.228.168.9
185.228.168.168
185.228.226.226
185.222.222.222
193.251.150.199
193.251.255.220
193.251.254.254
62.115.136.122
129.250.35.35
129.250.2.5
217.131.59.45
72.14.214.52
142.250.110.26
142.250.202.54
172.217.14.206
209.191.68.1
192.168.1.1
10.10.34.36
)

# ---- Websites list (200 websites) ----
WEBSITES=(
google.com
youtube.com
facebook.com
twitter.com
instagram.com
reddit.com
amazon.com
netflix.com
linkedin.com
baidu.com
yahoo.com
apple.com
microsoft.com
ebay.com
wikipedia.org
github.com
stackoverflow.com
instagram.com
tiktok.com
pinterest.com
xvideos.com
xnxx.com
xhamster.com
amazon.co.uk
amazon.de
amazon.co.jp
ebay.co.uk
bbc.co.uk
bbc.com
cnn.com
nytimes.com
washingtonpost.com
reuters.com
aljazeera.com
bing.com
duckduckgo.com
paypal.com
medium.com
wordpress.com
t.me
telegram.org
discord.com
whatsapp.com
weibo.com
qq.com
tencent.com
taobao.com
baidu.com
jd.com
aliexpress.com
adobe.com
salesforce.com
oracle.com
ibm.com
intel.com
amd.com
nvidia.com
samsung.com
sony.com
panasonic.com
toyota.com
toyota.com.tr
bmw.com
mercedes-benz.com
siemens.com
bosch.com
corporate.unilever.com
shell.com
bp.com
total.com
en.atlassian.com
docker.com
kubernetes.io
jenkins.io
ubuntu.com
debian.org
archlinux.org
gentoo.org
fedora.org
opensuse.org
reddit.com
hulu.com
hbo.com
disney.com
fox.com
cbs.com
nbc.com
abc.com
cnn.com
espn.com
nfl.com
nhl.com
mlb.com
fifa.com
uefa.com
fifa.com
rbc.com
cbr.com
google.com.br
google.co.in
google.co.uk
google.de
google.fr
google.it
google.es
google.co.jp
google.com.hk
google.ca
google.com.au
google.com.mx
mail.google.com
drive.google.com
maps.google.com
docs.google.com
photos.google.com
calendar.google.com
play.google.com
store.google.com
support.google.com
myaccount.google.com
photos1.webmd.com
webmd.com
webmd.ca
healthline.com
mayoclinic.org
cdc.gov
who.int
un.org
worldbank.org
imf.org
oecd.org
wto.org
epa.gov
nih.gov
nasa.gov
science.org
nature.com
sciencemag.org
cell.com
acs.org
ieee.org
acm.org
springer.com
elsevier.com
sciencedirect.com
wiley.com
tandfonline.com
jamanetwork.com
bmj.com
thelancet.com
ncbi.nlm.nih.gov
pubmed.ncbi.nlm.nih.gov
arxiv.org
ieee.org
acm.org
springer.com
elsevier.com
nature.com
science.org
sciencedirect.com
jamanetwork.com
thelancet.com
cell.com
nature.com
)

echo ""
echo "=== Running DNS server trace tests ==="
for i in "${!DNS_SERVERS[@]}"; do
    SERVER="${DNS_SERVERS[$i]}"
    echo "Testing DNS $SERVER..."
    echo "=== Traceroute (IPv4) to $SERVER ===" > /dev/stderr
    traceroute -4 -n -q3 -w1 "$SERVER" > "$OUTDIR/tr_dns_v4_${i}_${SERVER}.txt" 2>&1
    echo "=== Traceroute (IPv6) to $SERVER ===" > /dev/stderr
    traceroute -6 -n -q3 -w1 "$SERVER" > "$OUTDIR/tr_dns_v6_${i}_${SERVER}.txt" 2>&1
done
echo "DNS trace tests complete."

echo ""
echo "=== Running website trace tests ==="
for i in "${!WEBSITES[@]}"; do
    SITE="${WEBSITES[$i]}"
    echo "Testing website $SITE..."
    echo "=== Traceroute (IPv4) to $SITE ==="
    traceroute -4 -n -q3 -w1 "$SITE" > "$OUTDIR/tr_web_v4_${i}_${SITE}.txt" 2>&1
    echo "=== Traceroute (IPv6) to $SITE ==="
    traceroute -6 -n -q3 -w1 "$SITE" > "$OUTDIR/tr_web_v6_${i}_${SITE}.txt" 2>&1
done
echo "Website trace tests complete."

echo ""
echo "=== Running DNS resolution tests ==="
{
echo "=== DNS Resolution Tests ==="
echo "Timestamp: $TIMESTAMP"
echo ""
for i in "${!DNS_SERVERS[@]}"; do
    SERVER="${DNS_SERVERS[$i]}"
    echo "--- DNS server: $SERVER ---"
    echo "google.com:"
    dig +short @"$SERVER" google.com 2>/dev/null || nslookup google.com "$SERVER" 2>/dev/null || echo "FAILED"
    echo "facebook.com:"
    dig +short @"$SERVER" facebook.com 2>/dev/null || nslookup facebook.com "$SERVER" 2>/dev/null || echo "FAILED"
    echo "youtube.com:"
    dig +short @"$SERVER" youtube.com 2>/dev/null || nslookup youtube.com "$SERVER" 2>/dev/null || echo "FAILED"
    echo "wikipedia.org:"
    dig +short @"$SERVER" wikipedia.org 2>/dev/null || nslookup wikipedia.org "$SERVER" 2>/dev/null || echo "FAILED"
    echo ""
done
} > "$OUTDIR/dns_resolution.txt" 2>&1

echo "DNS resolution tests complete."

echo ""
echo "=== Running website DNS resolution ==="
{
echo "=== Website DNS Resolution ==="
echo "Timestamp: $TIMESTAMP"
echo ""
for i in "${!WEBSITES[@]}"; do
    SITE="${WEBSITES[$i]}"
    echo "--- $SITE ---"
    dig +short "$SITE" 2>/dev/null || nslookup "$SITE" 2>/dev/null || echo "FAILED"
done
} > "$OUTDIR/websites_dns.txt" 2>&1

echo "All tests complete."
echo "Finished: $(date)"
echo ""
echo "Output directory: $OUTDIR"
echo ""
echo "To tar for easy transfer:"
echo "  tar -czf ${ISP_NAME}_${TIMESTAMP}.tar.gz -C '$RESULTS_DIR' '${ISP_NAME}_${TIMESTAMP}/'"
