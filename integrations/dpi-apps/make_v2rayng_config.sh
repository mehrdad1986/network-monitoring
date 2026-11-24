#!/usr/bin/env bash
# Build a v2rayNG / v2rayN config whose SNI is a 5-or-more-label hostname.
#
# Why this shape: the filter on this network blocks *.workers.dev style names
# that have 2 to 4 labels, and forwards names with 5 or more labels. A deep
# hostname on your own Cloudflare zone therefore passes, while keeping the
# existing VLESS + WebSocket + TLS + CDN design, UUID and path.
#
# Usage:  ./make_v2rayng_config.sh vpn.cdn.mydomain.com
set -euo pipefail

HOST="${1:-}"
if [[ -z "$HOST" ]]; then
  echo "usage: $0 <your-5-label-host>" >&2
  exit 1
fi

LABELS=$(awk -F. '{print NF}' <<<"$HOST")
if (( LABELS < 5 )); then
  echo "WARNING: '$HOST' has $LABELS labels. This network's filter was measured" >&2
  echo "         forwarding names with 5+ labels; 5 or more is the safe choice." >&2
fi

# Preserved from the working panel config; only the SNI/Host change.
UUID="38befcfd-b4f3-405c-89a7-19eeaf8d7105"
PORT="443"
PATH_V="/vl/Xu1qOzZTZNtI8Np5i7K8oW5X0fz?ed=2560"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${PATEN_OUTPUT_DIR:-${XDG_DOCUMENTS_DIR:-$HOME/Documents}}"
mkdir -p "$OUTPUT_DIR"
OUT="$OUTPUT_DIR/v2rayng-${HOST}.json"

cat > "$OUT" <<JSON
{
  "log": { "loglevel": "warning" },
  "dns": {
    "servers": [
      {
        "address": "https://1.1.1.1/dns-query",
        "skipFallback": true
      },
      {
        "address": "https://8.8.8.8/dns-query",
        "skipFallback": true
      }
    ],
    "queryStrategy": "UseIPv4"
  },
  "inbounds": [
    {
      "tag": "socks",
      "port": 10808,
      "listen": "127.0.0.1",
      "protocol": "socks",
      "settings": { "auth": "noauth", "udp": true },
      "sniffing": { "enabled": true, "destOverride": ["http", "tls", "quic"] }
    },
    {
      "tag": "http",
      "port": 10809,
      "listen": "127.0.0.1",
      "protocol": "http",
      "settings": { "auth": "noauth" }
    }
  ],
  "outbounds": [
    {
      "tag": "proxy",
      "protocol": "vless",
      "settings": {
        "vnext": [
          {
            "address": "${HOST}",
            "port": ${PORT},
            "users": [
              { "id": "${UUID}", "encryption": "none" }
            ]
          }
        ]
      },
      "streamSettings": {
        "network": "ws",
        "security": "tls",
        "tlsSettings": {
          "serverName": "${HOST}",
          "alpn": ["http/1.1"],
          "fingerprint": "chrome"
        },
        "wsSettings": {
          "path": "${PATH_V}",
          "headers": { "Host": "${HOST}" }
        }
      }
    },
    { "tag": "direct", "protocol": "direct" },
    { "tag": "block", "protocol": "blackhole" }
  ],
  "routing": {
    "domainStrategy": "IPIfNonMatch",
    "rules": [
      {
        "type": "field",
        "outboundTag": "block",
        "ip": ["10.10.34.0/24", "2001:4188:2:600::/64"]
      },
      {
        "type": "field",
        "outboundTag": "block",
        "network": "udp",
        "port": "443"
      },
      {
        "type": "field",
        "outboundTag": "direct",
        "network": "tcp,udp",
        "ip": [
          "127.0.0.0/8",
          "10.0.0.0/8",
          "172.16.0.0/12",
          "192.168.0.0/16",
          "169.254.0.0/16",
          "fe80::/10",
          "fc00::/7"
        ]
      }
    ]
  }
}
JSON

echo "wrote $OUT"
echo
echo "Import this share link into v2rayNG (Add from clipboard):"
echo
echo "vless://${UUID}@${HOST}:${PORT}?encryption=none&security=tls&type=ws&host=${HOST}&path=%2Fvl%2FXu1qOzZTZNtI8Np5i7K8oW5X0fz%3Fed%3D2560&sni=${HOST}&alpn=http%2F1.1&fp=chrome#${HOST}"
echo
echo "Pre-flight check that the filter forwards this name:"
if [[ -f "$SCRIPT_DIR/sni_preflight.py" ]]; then
  echo "  python3 '$SCRIPT_DIR/sni_preflight.py' '${HOST}'"
else
  echo "  Optional preflight script not found beside this app: sni_preflight.py"
fi
