#!/usr/bin/env bash
# name_matrix.sh — which names are blocked by the DPI, and which part of them.
#
# METHOD (this is the part that matters):
#   A name is only declared "blocked by DPI" if BOTH hold:
#     (1) the name serves NORMALLY over its own real IP from this line   -> DPI allows it
#     (2) the SAME name, forced onto a Cloudflare edge that demonstrably
#         serves it, produces the workers.dev signature: TLS ServerHello +
#         certificate arrive, then nothing                             -> DPI drops it
#
#   If the certificate for that name never arrives on that edge, the silence
#   is Cloudflare not serving the name there, NOT censorship. That mistake is
#   what produced the earlier false claim about *.cloudflare.net.

unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy FTP_PROXY
EDGE_A=188.114.97.3      # edge that provably serves *.workers.dev
EDGE_B=104.16.132.229    # generic Cloudflare anycast edge
REQ='GET / HTTP/1.1\r\nHost: %s\r\nConnection: close\r\n\r\n'

probe(){  # $1=name $2=ip  -> prints: certCN | http first line | silent
  local name="$1" ip="$2" out cert http
  out=$( { printf "$REQ" "$name"; sleep 6; } | timeout 9 openssl s_client -connect "$ip:443" -servername "$name" -quiet 2>/dev/null )
  cert=$(printf '%s' "$out" | grep -m1 -oE 'subject=[^ ]*|CN *= *[A-Za-z0-9._-]+' | head -1)
  [ -z "$cert" ] && cert=$(printf '%s' "$out" | grep -m1 -q 'Verify return code:1' && echo "cert-ok-unknown-cn")
  http=$(printf '%s' "$out" | grep -m1 -oE '^HTTP/1\.[01] [0-9]{3}' )
  printf '%s' "$cert" | tr -d '\n'
  printf '  ||  %s\n' "${http:-SILENT}"
}

printf '%-46s %-34s %s\n' "NAME" "EDGE A 188.114.97.3" "EDGE B 104.16.132.229"
printf '%.0s-' {1..120}; echo
for n in \
  "workers.dev" \
  "test-sub.example.workers.dev" \
  "onicic.wearethewegods.workers.dev" \
  "a.b.workers.dev" \
  "zzz-not-real-9271.workers.dev" \
  "pages.dev" \
  "xyz-not-real.pages.dev" \
  "trycloudflare.com" \
  "cloudflare.net" \
  "cloudflare.com" \
  "zzz-not-real-9271.cloudflare.com" \
  "pages.github.com" \
  "go.dev"
do
  printf '%-46s %-34s %s\n' "$n" "$(probe "$n" $EDGE_A | cut -c1-33)" "$(probe "$n" $EDGE_B | cut -c1-33)"
done

echo
echo "=== TEST 2: the same names over PLAIN HTTP port 80 on edge A (no TLS, so no SNI)"
for n in "workers.dev" "test-sub.example.workers.dev" "a.b.workers.dev" "pages.dev" "cloudflare.com"; do
  printf '  %-48s ' "$n"
  curl -sS --http1.1 -m 10 -o /dev/null -w 'code=%{http_code} bytes=%{size_download}\n' \
     --resolve "$n:80:$EDGE_A" "http://$n/" 2>&1 | tail -1
done

echo
echo "=== TEST 3: the same names on their OWN real IP from this line (DPI verdict per name)"
for n in "workers.dev" "test-sub.example.workers.dev" "pages.dev" "cloudflare.net" "cloudflare.com" "go.dev" "pages.github.com"; do
  printf '  %-48s ' "$n"
  curl -sS --http1.1 -m 12 -o /dev/null -w 'code=%{http_code} ip=%{remote_ip}\n' "https://$n/" 2>&1 | tail -1
done