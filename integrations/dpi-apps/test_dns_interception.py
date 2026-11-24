#!/usr/bin/env python3
"""
DPI Investigation - DNS Interception & DoH Bypass Test
Tests whether DNS queries are intercepted and if DoH can bypass the interception.
"""
import socket
import urllib.request
import json

def test_local_dns(domain):
    """Test DNS resolution via system resolver (may be intercepted)"""
    try:
        ips = socket.getaddrinfo(domain, 443, socket.AF_INET, socket.SOCK_STREAM)
        return list(set([r[4][0] for r in ips]))
    except Exception as e:
        return f'Error: {e}'

def test_doh(dns_url, domain):
    """Test DNS-over-HTTPS (encrypted DNS)"""
    try:
        url = f"{dns_url}?name={domain}&type=A"
        req = urllib.request.Request(url, headers={'accept': 'application/dns-json'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
            answers = [a['data'] for a in data.get('Answer', []) if a.get('type') == 1]
            return answers
    except Exception as e:
        return f'Error: {e}'

def is_private_ip(ip):
    """Check if IP is in private/reserved range"""
    if not ip or not isinstance(ip, str):
        return False
    parts = ip.split('.')
    if len(parts) != 4:
        return False
    first = int(parts[0])
    # 10.x.x.x (private), 100.64.x.x (CGNAT), 172.16-31.x.x (private), 192.168.x.x (private)
    if first == 10:
        return True
    if first == 100 and int(parts[1]) == 64:
        return True
    if first == 172 and 16 <= int(parts[1]) <= 31:
        return True
    if first == 192:
        return True
    if first == 127:
        return True
    return False

# Test domains
test_domains = [
    'pages.dev',
    'willow-finch-70ad-8012f7a2.pages.dev',
    'workers.dev',
    'test-worker.example.workers.dev',
    'cloudflare.com',
    'aparatcom.vercel.app',
    'vercel.app',
    'netlify.app',
    'example.com',
    'github.com',
    'google.com',
    'facebook.com',
    'youtube.com',
    't.me',
]

print("=" * 80)
print("DNS INTERCEPTION & DOH BYPASS TEST")
print("=" * 80)
print(f"{'Domain':40s} {'Local DNS':20s} {'DoH (1.1.1.1)':20s} {'Status'}")
print("-" * 80)

doh_endpoints = [
    ('1.1.1.1', 'https://1.1.1.1/dns-query'),
    ('Google', 'https://8.8.8.8/dns-query'),
    ('Cloudflare', 'https://dns.cloudflare.com/dns-query'),
]

for domain in test_domains:
    local = test_local_dns(domain)
    doh_result = test_doh('https://1.1.1.1/dns-query', domain)
    
    local_str = local if isinstance(local, str) else ','.join(local[:2])
    doh_str = ','.join(doh_result) if isinstance(doh_result, list) else str(doh_result)
    
    # Determine if blocked
    blocked = False
    if isinstance(local, list) and any(is_private_ip(ip) for ip in local):
        blocked = True
    if isinstance(doh_result, list) and len(doh_result) > 0 and not any(is_private_ip(ip) for ip in doh_result):
        # DoH returned real IPs => DNS interception confirmed
        pass
    
    status = 'BLOCKED (DNS interception)' if blocked else 'ALLOWED'
    print(f"{domain:40s} {local_str:20s} {doh_str:20s} {status}")

print("\n" + "=" * 80)
print("ANALYSIS:")
print("=" * 80)
print("""
1. If 'Local DNS' shows private IPs (10.x.x.x, 192.168.x.x) but 'DoH' shows real IPs:
   => DNS INTERCEPTION CONFIRMED
   
2. If 'Local DNS' matches 'DoH' for all domains:
   => No DNS interception (blocking is at different layer)

3. If DNS returns correct IPs but port 443 still fails:
   => SNI or TLS fingerprint filtering is active

4. DoH bypass method: Use https://dns.google or https://1.1.1.1/dns-query in DNS settings
""")
