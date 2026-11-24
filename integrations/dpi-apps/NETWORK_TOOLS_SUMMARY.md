# Complete Network Toolkit for Heavy Filtering / Internet Blackout

## ✅ Installed & Working

### System Tools (Pre-installed)
| Tool | Version | Purpose |
|------|---------|---------|
| nmap | 7.94 | Network scanning, service detection |
| tcpdump | 4.99.4 | Packet capture |
| tshark | 4.2.2 | Deep protocol analysis (Wireshark CLI) |
| ss/ip/iptables/nft | latest | Network config, firewall |
| netcat | 1.226 | Network swiss army knife |
| openssh-client | 9.6p1 | SSH, tunneling, SOCKS proxy |
| openvpn | 2.6.19 | VPN client |
| dig/host/nslookup | BIND 9.18 | DNS queries |
| whois | 5.5.22 | Domain/IP lookup |
| v2rayn | 7.25.4 | V2Ray GUI client |

### Python DPI Research Toolkits
| Tool | Version | Purpose |
|------|---------|---------|
| scapy | 2.8.0 | Packet crafting, sniffing, protocol analysis |
| dpkt | 1.9.8 | Fast packet parsing/creation |
| pyshark | 0.6 | Wireshark/tshark Python wrapper |

### Downloaded Static Binaries (in `~/.local/bin/nettools/`)
| Tool | Version | Protocol/Use Case |
|------|---------|-------------------|
| **v2ray** | 5.x | VMess, VLESS, Shadowsocks, Trojan |
| **xray** | 26.3.27 | VLESS, VMess, Trojan, Shadowsocks, WireGuard |
| **sing-box** | 1.14.3 | Universal proxy (all protocols) |
| **trojan** | 1.16.0 | Trojan-GFW (TLS over HTTPS mimicry) |
| **naiveproxy** | 154.x | Chrome-based HTTPS proxy (Caddy) |
| **hysteria** | 2.x | QUIC-based, obfuscated, high-latency tolerant |
| **dnscrypt-proxy** | 2.1.18 | Encrypted DNS (DoH, DoT, DNSCrypt) |

### Quick Start Commands
```bash
# Add to PATH (already in .bashrc)
export PATH="$HOME/.local/bin/nettools:$PATH"

# Test all tools
~/nettools/test_all.sh

# DNS over HTTPS test
dnscrypt-proxy -resolve google.com

# Proxy test
curl -x socks5://127.0.0.1:1080 https://api.ipify.org
curl -x http://127.0.0.1:8080 https://api.ipify.org

# Packet capture
tcpdump -i any -w capture.pcap
tshark -r capture.pcap

# Python DPI
python3 -c "from scapy.all import *; sniff(count=5, prn=lambda x: x.summary())"
```

## ❌ Missing (Require `sudo apt install`)
```bash
sudo apt update && sudo apt install -y \
  tor obfs4proxy wireguard-tools shadowsocks-libev \
  stunnel4 socat iftop nethogs bmon vnstat darkstat \
  iperf3 mtr-tiny dnscrypt-proxy
```

## 🔧 Configuration Files Needed
Each proxy tool needs a config file. Examples:
- `v2ray`/`xray`/`sing-box`: JSON config with inbounds/outbounds
- `trojan`: JSON config with local_port, remote_addr, password
- `naiveproxy`: JSON config with listen, remote, key
- `hysteria`: YAML config with auth, tls, quic settings
- `dnscrypt-proxy`: TOML config with server_names, listen_addresses

## 📁 Directory Structure
```
"$HOME/.local/bin/nettools/"
├── v2ray, geoip.dat, geosite.dat
├── xray, geoip.dat, geosite.dat
├── sing-box
├── trojan
├── naive
├── hysteria
├── dnscrypt-proxy, example-*.toml
└── test_all.sh
```

## 🌐 Protocols Supported
- **VLESS/VMess** (V2Ray, Xray, sing-box)
- **Trojan-GFW** (Trojan, Xray, sing-box)
- **Shadowsocks** (all tools)
- **Hysteria2/QUIC** (Hysteria, sing-box)
- **NaiveProxy** (HTTPS/HTTP/2, Chrome fingerprint)
- **WireGuard** (Xray, sing-box - needs kernel module)
- **DNS encryption**: DoH, DoT, DNSCrypt (dnscrypt-proxy)
- **Obfuscation**: TLS, WebSocket, gRPC, HTTP/2, QUIC

## 🛡️ For Maximum Censorship Resistance
1. **Use TLS-based protocols** (Trojan, VLESS+TLS, NaiveProxy)
2. **Enable obfuscation** (WebSocket, gRPC, HTTP/2)
3. **Use encrypted DNS** (dnscrypt-proxy + DoH)
4. **Rotate protocols** (sing-box supports all)
5. **Monitor with DPI tools** (scapy, tshark, tcpdump)
