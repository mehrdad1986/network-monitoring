#!/bin/bash
# =============================================================================
#  dpi_suite.sh — layer-by-layer DPI attribution for the workers.dev blackhole
#  Run AFTER the socks proxy has been removed from the system.
#  Nothing here modifies state; it only reads.
#
#  Usage:  sudo -E ./dpi_suite.sh            (sudo for the capture phase)
#          IFACE=$(ip -o -4 route get 1.1.1.1 | awk '{print $5}') ./dpi_suite.sh
# =============================================================================
set -u
IFACE="${IFACE:-$(ip -o -4 route get 1.1.1.1 2>/dev/null | awk '{print $5}')}"
BLOCKED="test-sub.example.workers.dev"
CONTROL="workers.dev"
TOKEN="bb506594761e1d1040a2dbb8981c001b"
OUT=/tmp/kilo/dpi
mkdir -p "$OUT"
hr(){ printf '\n=== %s\n' "$*"; }
run(){ printf '  %s' "$*"; }

# --- PHASE 0 ---------------------------------------------------------------
hr "PHASE 0  environment sanity"
env | grep -iE 'proxy' && echo "  !! proxy vars still set — abort" || echo "  no proxy env vars: good"
ip -o -4 addr show "$IFACE" 2>/dev/null | awk '{print "  local IPv4: "$4}'
ip -o -6 addr show scope global 2>/dev/null | head -1 | awk '{print "  local IPv6: "$4" (empty = no v6 path)"}'

# --- PHASE 1  is the line healthy at all ------------------------------------
hr "PHASE 1  baseline control plane (what definitely works)"
for u in https://cloudflare.com https://workers.dev https://www.google.com https://api.ipify.org; do
  run "$u -> "
  curl -sS -m 12 -o /dev/null -w 'code=%{http_code} ip=%{remote_ip} ttfb=%{time_starttransfer}s\n' "$u" 2>&1 | tail -1
done
printf '  egress IP: '; curl -sS -m 10 https://api.ipify.org; echo

# --- PHASE 2  DNS layer -----------------------------------------------------
hr "PHASE 2  DNS — is resolution filtered?"
for h in "$BLOCKED" "$CONTROL" zzz-not-real-9271.workers.dev; do
  run "system resolver $h -> "
  getent ahostsv4 "$h" | awk '{printf "%s ", $1}' | head -c 60; echo
done
for r in 1.1.1.1 8.8.8.8 9.9.9.9; do
  run "dig @$r $BLOCKED -> "
  dig +short +time=3 +tries=1 @"$r" "$BLOCKED" 2>/dev/null | tr '\n' ' ' | head -c 70; echo
done

# --- PHASE 3  L4 — IP, port, ICMP -------------------------------------------
hr "PHASE 3  L4 — which IPs and ports are reachable"
IPS=$(getent ahostsv4 "$BLOCKED" | awk '{print $1}' | sort -u)
for ip in $IPS; do
  for p in 443 2053 8443; do
    run "TCP $ip:$p -> "
    timeout 6 bash -c "cat </dev/null >/dev/tcp/$ip/$p" 2>/dev/null && echo "OPEN" || echo "no answer"
  done
  run "ICMP $ip -> "; ping -c 2 -W 2 "$ip" 2>/dev/null | tail -2 | tr '\n' ' '; echo
done

# --- PHASE 4  who is in the path --------------------------------------------
hr "PHASE 4  hop-by-hop, TCP SYN based (shows which router range this ISP uses)"
for ip in $IPS; do
  echo "  --- traceroute -T -p 443 $ip"
  traceroute -T -p 443 -n -q 1 -w 1 -m 20 "$ip" 2>&1 | head -22 | sed 's/^/    /'
done

# --- PHASE 5  SNI vs Host vs IP  (the decisive experiment) ------------------
hr "PHASE 5  attribute the kill: SNI? Host? IP?"
IP=$(echo "$IPS" | head -1)
send(){  # $1=server ip  $2=sni  $3=host header  $4=label
  printf '  %-46s ' "$4"
  { printf 'GET /healthz HTTP/1.1\r\nHost: %s\r\nConnection: close\r\n\r\n' "$3"; sleep 7; } \
    | timeout 12 openssl s_client -connect "$1:443" -servername "$2" -quiet 2>/dev/null \
    | head -1 | cut -c1-60
  echo
}
send "$IP" workers.dev "$BLOCKED"        "SNI=apex        Host=blocked-sub   (CF should 403)"
send "$IP" "$BLOCKED" workers.dev          "SNI=blocked-sub Host=apex           "
send "$IP" cloudflare.com cloudflare.com  "SNI=cloudflare.com Host=cloudflare.com"
send "$IP" example.com   example.com      "SNI=example.com   Host=example.com"
send 1.1.1.1 "$BLOCKED" workers.dev        "SNI=blocked-sub via 1.1.1.1         "

hr "PHASE 6  request-level with the killed SNI (how does it die?)"
curl -sS -m 45 -o /dev/null -w '  curl code=%{http_code} ttfb=%{time_starttransfer}s total=%{time_total}s\n' \
     "https://$BLOCKED/healthz" 2>&1 | tail -2
curl -sS -m 20 -o /dev/null -w '  sub  code=%{http_code} bytes=%{size_download}\n' \
     "https://$BLOCKED/sub?token=$TOKEN" 2>&1 | tail -2

# --- PHASE 7  fingerprint vs content ----------------------------------------
hr "PHASE 7  is it the TLS fingerprint or the domain?"
python3 /tmp/kilo/tls_fragment.py "$BLOCKED" 443
python3 /tmp/kilo/tls_fragment.py cloudflare.com 443

# --- PHASE 8  other transports ----------------------------------------------
hr "PHASE 8  QUIC / UDP 443 and plain HTTP 80"
run "  UDP 443 probe -> "; timeout 6 openssl s_client -quic -connect "$BLOCKED:443" </dev/null >/dev/null 2>&1 && echo "ok" || echo "no QUIC reply"
run "  HTTP:80 to edge -> "; curl -sS -m 8 -o /dev/null -w 'code=%{http_code}\n' "http://$BLOCKED/" 2>&1 | tail -1

# --- PHASE 9  packet-level proof --------------------------------------------
hr "PHASE 9  packet capture (needs sudo)"
if [ "$(id -u)" = 0 ]; then
  timeout 40 tcpdump -i "$IFACE" -s 0 -w "$OUT/blocked.pcap" \
     "tcp port 443 and host $IP" >/dev/null 2>&1 &
  TCPD=$!
  sleep 2
  curl -sS -m 8 -o /dev/null "https://$BLOCKED/healthz" 2>/dev/null
  sleep 2
  kill -INT $TCPD 2>/dev/null; wait $TCPD 2>/dev/null

  timeout 40 tcpdump -i "$IFACE" -s 0 -w "$OUT/control.pcap" \
     "tcp port 443 and host $(getent ahostsv4 workers.dev | awk '{print $1}' | head -1)" >/dev/null 2>&1 &
  TCPD=$!
  sleep 2
  curl -sS -m 8 -o /dev/null https://workers.dev 2>/dev/null
  sleep 2
  kill -INT $TCPD 2>/dev/null; wait $TCPD 2>/dev/null

  echo "  ---- BLOCKED host: ClientHello SNI + fate of the flow"
  tshark -r "$OUT/blocked.pcap" -Y 'tls.handshake.type==1' \
     -T fields -e frame.number -e ip.src -e ip.dst -e tcp.flags.str -e tls.handshake.extensions_server_name 2>/dev/null | sed 's/^/    /'
  tshark -r "$OUT/blocked.pcap" -q -z conv,tcp 2>/dev/null | head -12 | sed 's/^/    /'
  tshark -r "$OUT/blocked.pcap" -Y 'tcp.flags.reset==1' -T fields -e frame.number -e ip.src -e ip.dst 2>/dev/null | sed 's/^/    RST /'
  echo "  ---- CONTROL host: same view"
  tshark -r "$OUT/control.pcap" -Y 'tls.handshake.type==1' \
     -T fields -e frame.number -e ip.src -e ip.dst -e tls.handshake.extensions_server_name 2>/dev/null | sed 's/^/    /'
  echo "  pcap files: $OUT/blocked.pcap $OUT/control.pcap   (open in Wireshark)"
else
  echo "  not root — re-run with sudo for the capture phase"
fi
echo
echo "done. artefacts in $OUT"