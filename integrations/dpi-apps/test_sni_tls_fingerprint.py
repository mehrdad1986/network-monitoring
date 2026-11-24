#!/usr/bin/env python3
"""
DPI Investigation - SNI and TLS Fingerprint Detection Test
Tests whether the DPI filters based on SNI strings and TLS client fingerprints (JA3).
"""
import socket
import ssl
import time

# TLS ClientHello payloads for different clients (JA3 mimicry testing)
# These are raw TLS ClientHello messages for different client fingerprints

def tls_handshake(ip, port, sni=None, alpn=None, timeout=5, cipher_list=None, 
                  tls_version='TLSv1.3', curve_list=None):
    """Attempt a TLS handshake with specific parameters"""
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    
    versions = {'TLSv1.2': ssl.TLSVersion.TLSv1_2, 'TLSv1.3': ssl.TLSVersion.TLSv1_3}
    if tls_version not in versions:
        return f'CONFIG_ERR: unsupported TLS version: {tls_version}'
    context.minimum_version = context.maximum_version = versions[tls_version]
    if curve_list:
        try:
            context.set_ecdh_curve(curve_list)
        except (ValueError, ssl.SSLError) as exc:
            return f'CONFIG_ERR: {exc}'
    if cipher_list:
        if tls_version == 'TLSv1.3':
            return 'UNSUPPORTED: Python set_ciphers cannot select TLS 1.3 ciphers'
        try:
            context.set_ciphers(cipher_list)
        except ssl.SSLError as exc:
            return f'CONFIG_ERR: {exc}' 
    
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
            result = f'OK ({elapsed:.2f}s, TLS={ssock.version()}, cipher={cipher[0] if cipher else "N/A"})'
            ssock.close()
            return result
        except ssl.SSLError as e:
            elapsed = time.time() - start
            return f'SSL_ERR ({elapsed:.2f}s): {e}'
        except Exception as e:
            elapsed = time.time() - start
            return f'ERR ({elapsed:.2f}s): {e}'
    except socket.timeout:
        return 'TIMEOUT (TCP blocked)'
    except ConnectionRefusedError:
        return 'REFUSED'
    except Exception as e:
        return f'CONN_ERR: {e}'

def main():
    # Test SNI patterns
    print("=" * 70)
    print("SNI PATTERN FILTERING TEST")
    print("(Connecting to real IPs with various SNI patterns)")
    print("=" * 70)

    ip_cf_worker = '188.114.99.0'  # Worker IP (resolves for workers.dev subdomains)
    ip_cf_cdn = '104.16.133.229'   # Cloudflare 1.1.1.1 IP
    ip_vercel = '216.198.79.131'   # Vercel IP

    sni_tests = [
        # (sni, ip, desc)
        ('cloudflare.com', ip_cf_cdn, 'Standard domain (control)'),
        ('workers.dev', ip_cf_cdn, 'workers.dev root domain'),
        ('something.workers.dev', ip_cf_cdn, 'Worker subdomain pattern'),
        ('myproxy.workers.dev', ip_cf_cdn, 'Proxy-like worker subdomain'),
        ('proxy.example.com', ip_cf_cdn, 'Generic proxy-looking domain'),
        ('speedtest.net', ip_cf_cdn, 'Clean domain (control)'),
        ('www.google.com', ip_cf_cdn, 'Google domain'),
        ('github.com', ip_cf_cdn, 'GitHub domain'),
    ]

    for sni, ip, desc in sni_tests:
        result = tls_handshake(ip, 443, sni)
        print(f"  SNI={sni:40s} => {result}  [{desc}]")

    print("\n" + "=" * 70)
    print("SNI CASE MANGLING TEST")
    print("(Test if case variation bypasses SNI string matching)")
    print("=" * 70)

    base_sni = 'test-worker.example.workers.dev'
    variants = [
        base_sni,                                    # Original
        'WU07FI71Q26AJ1-UGZSS.medo-HOSSSEINIAN86.WORKERS.DEV',  # All upper
        'test-worker.example.workers.dev',  # Mixed case
        'wU07fI71Q26Aj1-uGZSS.medo-hOSSEIaNIAn86.WorKERs.DeV',  # Random case (from config)
    ]

    for sni in variants:
        result = tls_handshake(ip_cf_cdn, 443, sni)
        print(f"  SNI={sni[:50]:50s} => {result}")

    print("\n" + "=" * 70)
    print("TLS VERSION & CIPHER TEST")
    print("=" * 70)

    for version in ['TLSv1.3', 'TLSv1.2']:
        ciphers = [None] if version == 'TLSv1.3' else ['ECDHE-RSA-AES256-GCM-SHA384', 'ECDHE-RSA-AES128-GCM-SHA256', 'ECDHE-RSA-CHACHA20-POLY1305', 'ECDHE-RSA-AES128-SHA']
        for cipher in ciphers:
            result = tls_handshake('104.16.133.229', 443, 'cloudflare.com',
                                   tls_version=version, cipher_list=cipher)
            print(f"  Version={version:8s} Cipher={str(cipher):38s} => {result}")

    print("\n" + "=" * 70)
    print("ALPN NEGOTIATION TEST")
    print("=" * 70)

    for alpn in [['h2', 'http/1.1'], ['http/1.1'], ['h2'], ['http/1.1', 'h2']]:
        print(f"  ALPN={alpn} => ", end='')
        try:
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            context.set_alpn_protocols(alpn)
            sock = socket.create_connection(('104.16.133.229', 443), timeout=5)
            ssock = context.wrap_socket(sock, server_hostname='cloudflare.com')
            negotiated = ssock.getpeercert()
            print(f'OK (TLS={ssock.version()}, ALPN={ssock.selected_alpn_protocol()})')
            ssock.close()
        except Exception as e:
            print(f'FAILED: {str(e)[:50]}')

    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print("""
    If SNI string matching is active:
    - Original worker SNI might be blocked (000)
    - Case-mangled SNI might bypass (OK)
    - Clean domains like cloudflare.com/google.com should always work

    If TLS fingerprint matching is active:
    - Python ssl default fingerprint might be blocked
    - Chrome-like cipher suites might be allowed
    - TLS 1.3 might behave differently than TLS 1.2

    If both are active:
    - Only proper browser-mimicking configurations with case-mangled SNI work
    - This matches what the raw configs use (fp=chrome, case-mangled SNI, http/1.1 ALPN)
    """)


if __name__ == "__main__":
    main()
