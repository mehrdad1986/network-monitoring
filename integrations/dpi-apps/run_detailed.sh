#!/bin/bash
ISP="$1"
OUTDIR="results_detailed/${ISP}_detailed_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$OUTDIR"

echo "Detailed trace for $ISP -> $OUTDIR"
echo "$(date)" > "$OUTDIR/start.txt"

# DNS servers
while IFS= read -r dns; do
  [[ "$dns" =~ ^#.*$ || -z "$dns" ]] && continue
  fname=$(echo "$dns" | tr -cd '[:alnum:]._-' | sed 's/\./_/g')
  traceroute -4 -n -q1 -w2 -m 20 "$dns" > "$OUTDIR/tr_dns_${fname}.txt" 2>&1 &
done < "data/websites/dns_ips.txt"
wait

# Cloud IPs (resolved)
while IFS= read -r ip; do
  [[ -z "$ip" ]] && continue
  fname=$(echo "$ip" | tr -cd '[:alnum:]._-')
  traceroute -4 -n -q1 -w2 -m 20 "$ip" > "$OUTDIR/tr_cloud_${fname}.txt" 2>&1 &
done < "data/cloud_ips/resolved_cloud_ips.txt"
wait

# Websites (top 486)
count=0
while IFS= read -r site; do
  [[ "$site" =~ ^#.*$ || -z "$site" ]] && continue
  count=$((count+1))
  fname=$(echo "$site" | tr -cd '[:alnum:]._-' | sed 's/\./_/g')
  traceroute -4 -n -q1 -w2 -m 20 "$site" > "$OUTDIR/tr_web_${fname}.txt" 2>&1 &
  if [ $((count % 40)) -eq 0 ]; then
    wait
  fi
done < "data/websites/expanded_websites.txt"
wait

echo "$(date)" > "$OUTDIR/end.txt"
echo "Done: $(ls $OUTDIR/*.txt 2>/dev/null | wc -l) files"
