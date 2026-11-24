#!/usr/bin/env python3
"""
DPI Investigation - Comprehensive Protocol & Evasion Test
Tests VLESS, Shadowsocks, Trojan detection and evasion techniques.
"""
import socket
import ssl
import struct
import time
import os

def tls_connect(ip, port, sni=None, alpn=None, timeout=5):
    """Test TLS connection with specific SNI/ALPN"""
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    
    if alpn:
        context.set_alpn_protocols(alpn)
    
    try:
        sock = socket.create_connection((ip, port), timeout=timeout)
        sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        start = time.time()
        try:
            ssock = context.wrap_socket(sock, server_hostname=sni)
            elapsed = time.time() - start
            cipher = ssock.cipher()
            alpn_proto = ssock.selected_alpn_protocol()
            result = f'OK ({elapsed:.2f}s, TLS={ssock.version()}, cipher={cipher[0] if cipher else "N/A"}, ALPN={alpn_proto or "none"})'
            ssock.close()
            return result
        except ssl.SSLError as e:
            elapsed = time.time() - start
            return f'SSL_ERR ({elapsed:.2f}s): {str(e)[:80]}'
        except Exception as e:
            elapsed = time.time() - start
            return f'ERR ({elapsed:.2f}s): {str(e)[:80]}'
    except socket.timeout:
        return 'TIMEOUT (TCP blocked)'
    except ConnectionRefusedError:
        return 'REFUSED'
    except Exception as e:
        return f'CONN_ERR: {str(e)[:80]}'

def raw_connect(ip, port, payload=None, timeout=3):
    """Raw TCP connection test with optional payload"""
    try:
        s = socket.create_connection((ip, port), timeout=timeout)
        if payload:
            s.send(payload)
        s.settimeout(timeout)
        try:
            data = s.recv(1024)
            return f'RESPONSE ({len(data)}b): {data[:80]}'
        except socket.timeout:
            return 'TIMEOUT (no response)'
        s.close()
    except socket.timeout:
        return 'TCP_TIMEOUT (blocked)'
    except ConnectionRefusedError:
        return 'REFUSED'
    except Exception as e:
        return f'ERROR: {str(e)[:60]}'

# IPs
IP_CF_DNS = '1.1.1.1'           # Cloudflare DNS
IP_CF_CDN = '104.16.133.229'    # Cloudflare CDN
IP_CF_WORKER = '104.18.12.15'   # workers.dev IP
IP_CF_WORKER2 = '188.114.99.0'  # Worker-specific IP
IP_VERCEL = '216.198.79.131'    # Vercel

print("=" * 70)
print("PROTOCOL DETECTION TEST")
print("=" * 70)

# Test 1: TLS with different ALPN values
print("\n[1] ALPN Protocol Negotiation Test:")
alpn_tests = [
    (IP_CF_CDN, 'cloudflare.com', ['h2', 'http/1.1'], 'Both h2+http/1.1'),
    (IP_CF_CDN, 'cloudflare.com', ['http/1.1'], 'HTTP/1.1 only'),
    (IP_CF_CDN, 'cloudflare.com', ['h2'], 'HTTP/2 only'),
    (IP_CF_CDN, 'cloudflare.com', ['h3'], 'HTTP/3 only'),
    (IP_CF_CDN, 'cloudflare.com', [None], 'No ALPN'),
    (IP_VERCEL, 'aparatcom.vercel.app', ['h2', 'http/1.1'], 'Vercel h2+http/1.1'),
    (IP_VERCEL, 'aparatcom.vercel.app', ['http/1.1'], 'Vercel http/1.1 only'),
    (IP_VERCEL, 'aparatcom.vercel.app', ['h2'], 'Vercel h2 only'),
]

for ip, sni, alpn, desc in alpn_tests:
    result = tls_connect(ip, 443, sni, alpn if None not in alpn else None)
    print(f"  {desc:35s} => {result}")

# Test 2: Non-TLS protocol probes
print("\n[2] Raw Protocol Probes (port 443):")
probes = [
    (b'\x99', 'VLESS/XTLS protocol byte'),
    (os.urandom(64), 'Shadowsocks encrypted data (random)'),
    (b'\x00\x00\x00', 'Null bytes (SSH-like)'),
    (b'GET / HTTP/1.1\r\nHost: google.com\r\n\r\n', 'Trojan (HTTP over TLS port)'),
    (b'CONNECT www.google.com:443 HTTP/1.1\r\nHost: www.google.com:443\r\n\r\n', 'HTTP CONNECT proxy'),
    (b'\x16\x03\x01\x00\x00', 'Partial TLS ClientHello'),
]

for payload, desc in probes:
    result = raw_connect(IP_CF_CDN, 443, payload)
    print(f"  {desc:40s} => {result[:70]}")

# Test 3: SNI with case variations to CORRECT worker IP
print("\n[3] SNI Case Mangling to Worker IP:")
worker_sni_original = 'test-worker.example.workers.dev'
worker_snis = [
    worker_sni_original,
    'WU07FI71Q26AJ1-UGZSS.medo-HOSSSEINIAN86.WORKERS.DEV',
    'test-worker.example.workers.dev',
    'wU07fI71Q26Aj1-uGZSS.medo-hOSSEIaNIAn86.WorKERs.DEv',
    'WORkers.DEV',  # Simplified pattern
    'WORKERS.DEV',
]

for sni in worker_snis:
    # Try connecting to worker IP with this SNI
    result = tls_connect(IP_CF_WORKER, 443, sni)
    print(f"  SNI={sni[:45]} => {result}")

# Test 4: Port scanning on Vercel
print("\n[4] Vercel Port Filtering:")
for port in [80, 443, 8443, 8080, 22, 53, 4443, 8888, 7000, 9000, 1080]:
    try:
        s = socket.create_connection((IP_VERCEL, port), timeout=2)
        s.close()
        print(f"  Vercel port {port:5d}: OPEN")
    except:
        print(f"  Vercel port {port:5d}: FILTERED/CLOSED")

# Test 5: Port scanning on Cloudflare
print("\n[5] Cloudflare Port Filtering:")
for port in [80, 443, 8443, 8080, 22, 53, 4443, 8888, 7000, 9000, 1080]:
    try:
        s = socket.create_connection((IP_CF_DNS, port), timeout=2)
        s.close()
        print(f"  Cloudflare port {port:5d}: OPEN")
    except:
        print(f"  Cloudflare port {port:5d}: FILTERED/CLOSED")

print("\n" + "=" * 70)
print("ANALYSIS SUMMARY:")
print("=" * 70)
print("""
1. DNS BLOCKING (Primary method):
   - pages.dev, netlify.app, social media -> DNS returns 10.10.34.35 (private)
   - DoH bypass: https://1.1.1.1/dns-query or https://8.8.8.8/dns-query

2. SNI FILTERING (Secondary method):
   - Test by connecting with different SNI to real IPs
   - Case mangling may or may not bypass (depends on SNI matching)

3. TLS FINGERPRINT (JA3-based):
   - Cloudflare: TLS_AES_256_GCM_SHA384, TLS 1.3
   - Vercel: TLS_AES_128_GCM_SHA384, TLS 1.3
   - Browser fingerprint (fp=chrome) may be needed for some services

4. PORT FILTERING:
   - Cloudflare: 80, 443, 8443, 8080 open; others filtered
   - Vercel: 80, 443 open; all other ports filtered
""")
