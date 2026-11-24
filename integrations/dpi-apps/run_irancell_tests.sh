#!/bin/bash
# Irancell re-analysis — same targets as the MCI run
# Run this ON your Irancell connection (phone/Mac/VPN exit node).
# Output: traceroute_dns.txt and traceroute_websites.txt in the net mon folder

OUTDIR="$(cd "$(dirname "$0")" && pwd)"
cd "$OUTDIR" || exit 1

echo "=== Irancell test started: $(date -u) ==="
echo "Local IP:"
ip route 2>/dev/null | head -3 || ifconfig 2>/dev/null | grep -E 'inet ' | head -3
echo "DNS servers in use:"
resolvectl status 2>/dev/null | grep -iE 'DNS' | head -5 || cat /etc/resolv.conf | grep nameserver
echo

# ------------------------------------------------------------------
# Part 1: DNS servers (30 targets)
# ------------------------------------------------------------------
DNS_SERVERS=(
  1.1.1.1 8.8.8.8 9.9.9.9 208.67.222.222 208.67.220.220
  4.2.2.2 4.2.2.4 8.26.56.26 8.26.56.10 185.222.222.222
  185.228.168.168 185.228.168.9 185.228.226.226 195.46.39.39
  195.46.39.1 156.155.156.156 149.112.121.10 78.18.89.1
  78.18.89.101 146.114.22.2 66.114.36.2 74.82.241.12
  129.250.35.35 193.251.154.203 193.251.133.3 193.251.150.199
  193.251.133.28 193.251.255.220 2001:4860:4860::8888
  2606:4700:4700::1111 2620:fe::fe 2001:470::1 2001:4860:4860::1
  2606:1a40::1
)

{
  echo "=== Traceroute to DNS Servers (Irancell) ==="
  echo "# Generated: $(date -u)"
  for ip in "${DNS_SERVERS[@]}"; do
    echo
    echo "traceroute to $ip, 30 hops max, 60 byte packets"
    traceroute -n -m 30 -w 2 "$ip" 2>&1 || echo "connect: Network is unreachable"
  done
} > traceroute_dns.txt 2>&1

echo "DNS traceroutes saved ($(wc -l < traceroute_dns.txt) lines)"

# ------------------------------------------------------------------
# Part 2: Websites (60 targets)
# ------------------------------------------------------------------
WEBSITES=(
  google.com youtube.com facebook.com wikipedia.org reddit.com
  amazon.com netflix.com linkedin.com baidu.com yahoo.com apple.com
  microsoft.com ebay.com gmail.com pinterest.com xvideos.com
  google.co.uk google.co.in google.com.hk google.com.br google.de
  google.fr google.it google.es google.co.jp
)

{
  echo "=== Traceroute to Top Websites (Irancell) ==="
  echo "# Generated: $(date -u)"
  for site in "${WEBSITES[@]}"; do
    ip=$(dig +short A "$site" 2>/dev/null | head -1)
    [ -z "$ip" ] && ip=$(dig +short AAAA "$site" 2>/dev/null | head -1)
    [ -z "$ip" ] && ip="UNRESOLVED"
    echo
    echo "traceroute to $site ($ip), 30 hops max, 60 byte packets"
    if [ "$ip" = "UNRESOLVED" ]; then
      echo "DNS resolution failed for $site"
    else
      traceroute -n -m 30 -w 2 "$ip" 2>&1 || echo "connect: Network is unreachable"
    fi
  done
} > traceroute_websites.txt 2>&1

echo "Website traceroutes saved ($(wc -l < traceroute_websites.txt) lines)"

# ------------------------------------------------------------------
# Part 3: DNS resolution check (which sites escape vs get hijacked)
# ------------------------------------------------------------------
{
  echo "=== DNS Resolution Check (Irancell) ==="
  echo "# Generated: $(date -u)"
  for site in "${WEBSITES[@]}"; do
    a=$(dig +short A "$site" 2>/dev/null | head -1)
    aaaa=$(dig +short AAAA "$site" 2>/dev/null | head -1)
    printf "%-20s A=%-18s AAAA=%s\n" "$site" "${a:-NONE}" "${aaaa:-NONE}"
  done
} > dns_resolution.txt 2>&1

echo "DNS resolution saved ($(wc -l < dns_resolution.txt) lines)"
echo
echo "=== DONE: $(date -u) ==="
echo "Files written to $OUTDIR:"
ls -la traceroute_dns.txt traceroute_websites.txt dns_resolution.txt