#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Quick DoH Tester - Simple version that ACTUALLY tests if DoH works
Tests DoH by hostname (expected: blocked) and DoH by IP (expected: may work)
"""

import urllib.request
import urllib.error
import socket
import ssl
import time
import sys

def test_doh(url, name):
    """Test a single DoH server"""
    print(f"\nTesting: {name}")
    print(f"URL: {url}")

    try:
        # Create a simple DNS query for example.com (A record)
        # DNS query structure: ID(2) + Flags(2) + QDCOUNT(2) + ANCOUNT(2) + NSCOUNT(2) + ARCOUNT(2) + Question
        dns_query = b'\x12\x34\x01\x00\x00\x01\x00\x00\x00\x00\x00\x00\x07example\x03com\x00\x00\x01\x00\x01'

        req = urllib.request.Request(
            url,
            data=dns_query,
            headers={
                'Content-Type': 'application/dns-message',
                'Accept': 'application/dns-message'
            },
            method='POST'
        )

        # ENABLE SSL verification to detect MITM/poisoning
        ctx = ssl.create_default_context()
        # For IP literal URLs (like https://8.8.8.8), we need to handle the hostname check
        if any(url.startswith(f'https://{ip}') for ip in ['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1', '9.9.9.9']):
            # IP literals need special handling - verify cert but not hostname
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_REQUIRED

        start = time.time()
        response = urllib.request.urlopen(req, timeout=5, context=ctx)
        elapsed = int((time.time() - start) * 1000)

        if response.getcode() == 200:
            data = response.read()

            # Validate this is actually a DNS response
            if len(data) < 12:
                print(f"  [FAIL] Response too short ({len(data)} bytes) - not a valid DNS response")
                return False

            # Check DNS response header (first 12 bytes)
            # ID should match our query (0x1234), and QR bit should be set (response)
            response_id = (data[0] << 8) | data[1]
            flags = (data[2] << 8) | data[3]
            qr_bit = (flags >> 15) & 1  # Query/Response bit

            if response_id != 0x1234:
                print(f"  [FAIL] DNS response ID mismatch (expected 0x1234, got 0x{response_id:04x})")
                return False

            if qr_bit != 1:
                print(f"  [FAIL] Not a DNS response (QR bit not set)")
                return False

            print(f"  [SUCCESS] Working - {elapsed}ms, {len(data)} bytes, valid DNS response")
            return True
        else:
            print(f"  [FAIL] HTTP {response.getcode()}")
            return False

    except urllib.error.URLError as e:
        error = str(e.reason)
        if 'timed out' in error.lower() or 'timeout' in error.lower():
            print(f"  [BLOCKED] Timeout - likely filtered")
        elif 'reset' in error.lower():
            print(f"  [BLOCKED] Connection reset - actively blocked")
        else:
            print(f"  [ERROR] {error[:100]}")
        return False

    except socket.timeout:
        print(f"  [BLOCKED] Timeout")
        return False

    except Exception as e:
        print(f"  [ERROR] {str(e)[:100]}")
        return False

def main():
    print("="*70)
    print("DoH Quick Tester - Testing if DoH actually works")
    print("="*70)

    tests = [
        # DoH by hostname (expected: BLOCKED in Iran)
        ("https://dns.google/dns-query", "Google DoH by hostname"),
        ("https://cloudflare-dns.com/dns-query", "Cloudflare DoH by hostname"),
        ("https://dns.quad9.net/dns-query", "Quad9 DoH by hostname"),

        # DoH by IP literal (expected: may work)
        ("https://8.8.8.8/dns-query", "Google 8.8.8.8 by IP (MCI)"),
        ("https://8.8.4.4/dns-query", "Google 8.8.4.4 by IP (MCI)"),
        ("https://1.1.1.1/dns-query", "Cloudflare 1.1.1.1 by IP (Rightel)"),
    ]

    working = 0
    blocked = 0

    for url, name in tests:
        if test_doh(url, name):
            working += 1
        else:
            blocked += 1
        time.sleep(0.5)

    print("\n" + "="*70)
    print(f"RESULTS: {working} working, {blocked} blocked/error")
    print("="*70)

    if working == 0:
        print("\nWARNING: No DoH servers working!")
        print("All DoH by hostname are blocked (expected)")
        print("DoH by IP also blocked - check network")
    elif working < 3:
        print(f"\n{working} DoH servers working (likely IP literals only)")
        print("This matches expected behavior on filtered networks")

if __name__ == "__main__":
    main()
