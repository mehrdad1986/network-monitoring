#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simple SNI Tester - Works on Windows, no Unicode issues
Tests if an SNI/domain is blocked by trying to connect
"""

import socket
import ssl
import time
import sys

def test_sni(domain, ip="188.114.96.1", port=443):
    """Test if SNI is blocked"""
    print(f"\nTesting: {domain}")
    print(f"  Connecting to: {ip}:{port}")

    sock = None
    ssl_sock = None

    try:
        # TCP connection
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(3)

        start = time.time()
        sock.connect((ip, port))

        # TLS handshake with SNI
        context = ssl.create_default_context()
        context.check_hostname = False  # Keep False for IP literal connection
        context.verify_mode = ssl.CERT_REQUIRED

        ssl_sock = context.wrap_socket(sock, server_hostname=domain)
        handshake_time = int((time.time() - start) * 1000)

        # Try to get data
        request = f"GET / HTTP/1.1\r\nHost: {domain}\r\nConnection: close\r\n\r\n"
        ssl_sock.sendall(request.encode())

        data = ssl_sock.recv(4096)
        total_time = int((time.time() - start) * 1000)

        if data:
            print(f"  [PASS] Working - {total_time}ms, {len(data)} bytes received")
            return "WORKING"
        else:
            print(f"  [BLOCKED] Handshake OK but no data - DPI silent drop")
            return "SILENT_DROP"

    except socket.timeout:
        print(f"  [BLOCKED] Timeout - connection filtered")
        return "TIMEOUT"

    except ConnectionResetError:
        print(f"  [BLOCKED] Connection reset - actively blocked")
        return "RESET"

    except ssl.SSLError as e:
        print(f"  [ERROR] SSL error: {str(e)[:80]}")
        return "SSL_ERROR"

    except Exception as e:
        print(f"  [ERROR] {str(e)[:80]}")
        return "ERROR"

    finally:
        if ssl_sock:
            try:
                ssl_sock.close()
            except:
                pass
        if sock:
            try:
                sock.close()
            except:
                pass

def main():
    print("="*70)
    print("Simple SNI Tester - No Unicode, Windows Compatible")
    print("="*70)

    if len(sys.argv) > 1:
        # Test provided domains
        domains = sys.argv[1:]
    else:
        # Default test set
        domains = [
            "cloudflare.com",      # Should work
            "workers.dev",         # Should work (apex)
            "test.workers.dev",    # 3 labels - blocked on MCI
            "a.b.workers.dev",     # 4 labels - blocked on MCI
            "a.b.c.workers.dev",   # 5 labels - should pass through
        ]

    results = {}
    for domain in domains:
        results[domain] = test_sni(domain)
        time.sleep(0.3)

    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)

    working = sum(1 for v in results.values() if v == "WORKING")
    blocked = sum(1 for v in results.values() if v in ["TIMEOUT", "SILENT_DROP", "RESET"])

    print(f"Working: {working}/{len(results)}")
    print(f"Blocked: {blocked}/{len(results)}")

    if blocked > 0:
        print("\nBlocked domains:")
        for domain, verdict in results.items():
            if verdict in ["TIMEOUT", "SILENT_DROP", "RESET"]:
                print(f"  - {domain}: {verdict}")

if __name__ == "__main__":
    main()
