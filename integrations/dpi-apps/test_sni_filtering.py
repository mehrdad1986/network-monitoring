#!/usr/bin/env python3
"""
DPI Investigation - SNI Filtering Matrix Test
Tests whether the DPI filters based on SNI (Server Name Indication) in TLS handshakes.
"""
import socket
import ssl
import time

def send_tls_client_hello(sni, ip, port=443, timeout=5):
    """Test TLS connection with specific SNI to a specific IP"""
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    try:
        sock = socket.create_connection((ip, port), timeout=timeout)
        sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        start = time.time()
        try:
            ssock = context.wrap_socket(sock, server_hostname=sni)
            elapsed = time.time() - start
            result = f'OK ({elapsed:.2f}s, TLS={ssock.version()})'
            ssock.close()
            return result
        except ssl.SSLError as e:
            elapsed = time.time() - start
            return f'SSL_ERR ({elapsed:.2f}s): {e}'
        except Exception as e:
            elapsed = time.time() - start
            return f'ERR ({elapsed:.2f}s): {e}'
    except socket.timeout:
        return 'TIMEOUT (blocked at TCP)'
    except ConnectionRefusedError:
        return 'REFUSED'
    except Exception as e:
        return f'CONN_ERR: {e}'

# Test SNI filtering with various patterns
ip_cf = '104.18.12.15'       # workers.dev IP
ip_1 = '104.16.133.229'     # 1.1.1.1 IP
ip_vc = '216.198.79.131'    # Vercel IP

tests = [
    ('cloudflare.com', ip_1, 443, 'CF SNI -> 1.1.1.1 IP'),
    ('workers.dev', ip_cf, 443, 'workers.dev SNI -> workers IP'),
    ('example.workers.dev', ip_cf, 443, 'worker subdomain SNI'),
    ('TEST.workers.dev', ip_cf, 443, 'case-mangled worker SNI'),
    ('google.com', ip_1, 443, 'google.com SNI -> CF IP'),
    ('aparatcom.vercel.app', ip_vc, 443, 'vercel.app SNI -> Vercel IP'),
    ('loginpersonel.janex.ir', ip_1, 443, 'janex.ir SNI -> CF IP'),
    ('random-proxy.workers.dev', ip_cf, 443, 'random worker SNI'),
    ('normal.com', ip_1, 443, 'plain domain SNI to CF'),
    ('cloudflare.com', '188.114.96.3', 443, 'CF SNI -> Cloudflare worker IP'),
]

print("=" * 70)
print("DPI SNI FILTERING MATRIX TEST")
print("=" * 70)

for sni, ip, port, desc in tests:
    result = send_tls_client_hello(sni, ip, port)
    print(f'  {desc:45s} SNI={sni:35s} => {result}')
