#!/usr/bin/env python3
"""DNS Tunnel Client Test Script

Tests MasterDNS VPN and dnstt-server connectivity with comprehensive diagnostics.
Server: 185.204.171.218
Domain: example.com
"""
import socket
import struct
import time
import sys
import random
import base64
from datetime import datetime

SERVER_IP = "185.204.171.218"
DNS_PORT = 53
DNSTT_PORT = 5300
TUNNEL_DOMAIN = "example.com"
TIMEOUT = 10


def encode_dns_name(domain):
    """Encode domain name in DNS format."""
    parts = domain.split('.')
    encoded = b''
    for part in parts:
        encoded += bytes([len(part)]) + part.encode('ascii')
    encoded += b'\x00'
    return encoded


def create_dns_query(domain, qtype=1):
    """Create a DNS query packet."""
    transaction_id = random.randint(0x0000, 0xFFFF)
    flags = 0x0100  # Standard query, recursion desired
    questions = 1
    answer_rrs = 0
    authority_rrs = 0
    additional_rrs = 0

    header = struct.pack('>HHHHHH', transaction_id, flags, questions,
                         answer_rrs, authority_rrs, additional_rrs)

    qname = encode_dns_name(domain)
    question = qname + struct.pack('>HH', qtype, 1)  # IN class

    return header + question, transaction_id


def send_dns_query(query, server, port, use_tcp=False):
    """Send DNS query and return response time and data."""
    start = time.time()
    try:
        if use_tcp:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(TIMEOUT)
            sock.connect((server, port))
            sock.sendall(struct.pack('>H', len(query)) + query)

            length_data = sock.recv(2)
            if len(length_data) < 2:
                sock.close()
                return None, 0, "Incomplete TCP response"

            response_length = struct.unpack('>H', length_data)[0]
            response = b''
            while len(response) < response_length:
                chunk = sock.recv(response_length - len(response))
                if not chunk:
                    break
                response += chunk
            sock.close()
        else:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(TIMEOUT)
            sock.sendto(query, (server, port))
            response, addr = sock.recvfrom(4096)
            sock.close()

        rtt = (time.time() - start) * 1000
        return response, rtt, None

    except socket.timeout:
        return None, 0, "Timeout"
    except ConnectionRefusedError:
        return None, 0, "Connection refused"
    except Exception as e:
        return None, 0, str(e)


def parse_dns_response(response):
    """Parse DNS response headers."""
    if not response or len(response) < 12:
        return None

    tid, flags, qdcount, ancount, nscount, arcount = struct.unpack('>HHHHHH', response[:12])

    rcode = flags & 0x000F
    rcodes = {0: "NOERROR", 1: "FORMERR", 2: "SERVFAIL", 3: "NXDOMAIN",
              4: "NOTIMP", 5: "REFUSED"}

    return {
        'tid': tid,
        'is_response': (flags >> 15) & 1,
        'authoritative': (flags >> 10) & 1,
        'truncated': (flags >> 9) & 1,
        'recursion_desired': (flags >> 8) & 1,
        'recursion_available': (flags >> 7) & 1,
        'rcode': rcode,
        'rcode_name': rcodes.get(rcode, f"UNKNOWN({rcode})"),
        'questions': qdcount,
        'answers': ancount,
        'authority': nscount,
        'additional': arcount
    }


def create_tunnel_query(subdomain_data, domain):
    """Create DNS tunnel query with encoded data in subdomain."""
    # Encode data as subdomain labels
    encoded = base64.b32encode(subdomain_data).decode('ascii').lower().rstrip('=')

    # Split into DNS labels (max 63 chars each)
    labels = []
    while encoded:
        labels.append(encoded[:63])
        encoded = encoded[63:]

    tunnel_domain = '.'.join(labels) + '.' + domain if labels else domain
    return create_dns_query(tunnel_domain, qtype=16)  # TXT record


def test_basic_connectivity():
    """Test basic DNS connectivity."""
    print(f"[1] Testing Basic DNS Connectivity")
    print(f"    Server: {SERVER_IP}:{DNS_PORT}")

    # Test TCP connection
    print(f"\n    TCP Connection Test:")
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(3)
        start = time.time()
        sock.connect((SERVER_IP, DNS_PORT))
        rtt = (time.time() - start) * 1000
        sock.close()
        print(f"      ✓ TCP port 53: OPEN ({rtt:.0f}ms)")
    except Exception as e:
        print(f"      ✗ TCP port 53: FAILED ({e})")
        return False

    # Test UDP (simple echo)
    print(f"\n    UDP Connection Test:")
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(3)
        test_data = b"\x00\x01\x01\x00\x00\x01\x00\x00\x00\x00\x00\x00"
        start = time.time()
        sock.sendto(test_data, (SERVER_IP, DNS_PORT))
        response, addr = sock.recvfrom(1024)
        rtt = (time.time() - start) * 1000
        sock.close()
        print(f"      ✓ UDP port 53: RESPONDING ({rtt:.0f}ms, {len(response)} bytes)")
    except socket.timeout:
        print(f"      ⚠ UDP port 53: NO RESPONSE (may be filtered)")
    except Exception as e:
        print(f"      ✗ UDP port 53: FAILED ({e})")

    return True


def test_standard_dns():
    """Test standard DNS resolution."""
    print(f"\n[2] Testing Standard DNS Queries (External Domains)")

    test_domains = [
        ("google.com", "Test recursive resolution"),
        ("cloudflare.com", "Test CDN domain"),
        ("github.com", "Test popular service"),
    ]

    results = []
    for domain, desc in test_domains:
        print(f"\n    {domain} ({desc}):")

        query, tid = create_dns_query(domain, qtype=1)

        # UDP test
        response, rtt, error = send_dns_query(query, SERVER_IP, DNS_PORT, use_tcp=False)
        if error:
            print(f"      UDP: ✗ {error}")
            results.append(False)
        else:
            parsed = parse_dns_response(response)
            if parsed and parsed['rcode'] == 0:
                print(f"      UDP: ✓ {parsed['rcode_name']} ({rtt:.0f}ms) - {parsed['answers']} answers")
                results.append(True)
            else:
                status = parsed['rcode_name'] if parsed else "Invalid"
                print(f"      UDP: ✗ {status}")
                results.append(False)

    success_rate = (sum(results) / len(results)) * 100 if results else 0
    print(f"\n    Success Rate: {sum(results)}/{len(results)} ({success_rate:.0f}%)")
    return success_rate > 50


def test_tunnel_domain():
    """Test tunnel domain queries."""
    print(f"\n[3] Testing Tunnel Domain: {TUNNEL_DOMAIN}")

    query_types = [
        (1, "A", "IPv4 address"),
        (16, "TXT", "Text records"),
        (255, "ANY", "All records"),
    ]

    for qtype, name, desc in query_types:
        print(f"\n    Query type {name} ({desc}):")

        query, tid = create_dns_query(TUNNEL_DOMAIN, qtype=qtype)

        # Test UDP
        response, rtt, error = send_dns_query(query, SERVER_IP, DNS_PORT, use_tcp=False)
        if error:
            print(f"      UDP: ✗ {error}")
        else:
            parsed = parse_dns_response(response)
            if parsed:
                # NXDOMAIN is expected for tunnel domain in standard queries
                symbol = "⚠" if parsed['rcode'] == 3 else ("✓" if parsed['rcode'] == 0 else "✗")
                print(f"      UDP: {symbol} {parsed['rcode_name']} ({rtt:.0f}ms)")
                if parsed['rcode'] == 3:
                    print(f"           (NXDOMAIN is normal for tunnel domain - it's not a real DNS zone)")
            else:
                print(f"      UDP: ✗ Invalid response")

        # Test TCP
        response, rtt, error = send_dns_query(query, SERVER_IP, DNS_PORT, use_tcp=True)
        if error:
            print(f"      TCP: ✗ {error}")
        else:
            parsed = parse_dns_response(response)
            if parsed:
                symbol = "⚠" if parsed['rcode'] == 3 else ("✓" if parsed['rcode'] == 0 else "✗")
                print(f"      TCP: {symbol} {parsed['rcode_name']} ({rtt:.0f}ms)")


def test_tunnel_queries():
    """Test DNS tunnel data encoding."""
    print(f"\n[4] Testing DNS Tunnel Encoded Queries")
    print(f"    (Testing if server recognizes tunnel traffic)\n")

    # Test various encoded payloads
    test_payloads = [
        b"\x00\x01\x02\x03",  # Simple test data
        b"HELLO_TUNNEL",       # ASCII data
        b"\xff" * 16,          # Binary data
    ]

    for i, payload in enumerate(test_payloads, 1):
        print(f"    Test {i}: {len(payload)}-byte payload")

        query, tid = create_tunnel_query(payload, TUNNEL_DOMAIN)
        response, rtt, error = send_dns_query(query, SERVER_IP, DNS_PORT, use_tcp=False)

        if error:
            print(f"      ✗ {error}")
        else:
            parsed = parse_dns_response(response)
            if parsed:
                print(f"      ✓ Server responded: {parsed['rcode_name']} ({rtt:.0f}ms)")
                print(f"        Response size: {len(response)} bytes")
            else:
                print(f"      ✗ Invalid response")


def test_dnstt_port():
    """Test dnstt-server on port 5300."""
    print(f"\n[5] Testing dnstt-server Port: {SERVER_IP}:{DNSTT_PORT}")

    query, tid = create_dns_query(TUNNEL_DOMAIN, qtype=16)

    print(f"\n    UDP Query to port {DNSTT_PORT}:")
    response, rtt, error = send_dns_query(query, SERVER_IP, DNSTT_PORT, use_tcp=False)

    if error:
        print(f"      ✗ {error}")
        print(f"      Note: dnstt-server port may be firewalled from external access")
    else:
        parsed = parse_dns_response(response)
        if parsed:
            print(f"      ✓ Server responded: {parsed['rcode_name']} ({rtt:.0f}ms)")
            print(f"        Response size: {len(response)} bytes")
        else:
            print(f"      ✗ Invalid response")


def test_performance():
    """Test query performance."""
    print(f"\n[6] Performance Testing")
    print(f"    Running 20 queries to measure stability...\n")

    rtts = []
    errors = 0

    for i in range(20):
        query, tid = create_dns_query("google.com", qtype=1)
        response, rtt, error = send_dns_query(query, SERVER_IP, DNS_PORT, use_tcp=False)

        if error:
            print(f"      Query {i+1:2d}: ✗ {error}")
            errors += 1
        else:
            rtts.append(rtt)
            print(f"      Query {i+1:2d}: ✓ {rtt:.0f}ms")

        time.sleep(0.1)  # Small delay between queries

    if rtts:
        print(f"\n    Statistics:")
        print(f"      Average RTT: {sum(rtts)/len(rtts):.0f}ms")
        print(f"      Min RTT: {min(rtts):.0f}ms")
        print(f"      Max RTT: {max(rtts):.0f}ms")
        print(f"      Jitter: {max(rtts) - min(rtts):.0f}ms")
        print(f"      Success Rate: {len(rtts)}/20 ({len(rtts)*5}%)")
        print(f"      Packet Loss: {errors}/20 ({errors*5}%)")


def check_server_logs():
    """Provide instructions for checking server logs."""
    print(f"\n[7] Server-Side Verification")
    print(f"    To verify tunnel activity on the server, SSH in and run:\n")
    print(f"      # Check MasterDNS VPN logs")
    print(f"      journalctl -u masterdnsvpn -n 50 --no-pager\n")
    print(f"      # Check dnstt-server logs (real-time)")
    print(f"      journalctl -u dnstt-server -f\n")
    print(f"      # Check active connections")
    print(f"      ss -tunap | grep -E ':(53|5300|1080)'\n")
    print(f"      # Monitor DNS traffic")
    print(f"      tcpdump -i any -n port 53 -c 20\n")


def main():
    print(f"{'='*80}")
    print(f"  DNS Tunnel Client Connection Test")
    print(f"  Server: {SERVER_IP}")
    print(f"  Domain: {TUNNEL_DOMAIN}")
    print(f"  Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*80}\n")

    # Run all tests
    tests_passed = 0
    total_tests = 6

    if test_basic_connectivity():
        tests_passed += 1

    if test_standard_dns():
        tests_passed += 1

    test_tunnel_domain()
    tests_passed += 1  # Informational test

    test_tunnel_queries()
    tests_passed += 1  # Informational test

    test_dnstt_port()
    tests_passed += 1  # Informational test

    test_performance()
    tests_passed += 1  # Informational test

    # Summary
    print(f"\n{'='*80}")
    print(f"TEST SUMMARY")
    print(f"{'='*80}\n")

    if tests_passed < total_tests:
        print(f"DNS connectivity checks failed ({tests_passed}/{total_tests} checks completed).")
        print("Tunnel readiness has not been established.")
        return 1
    print("Basic connectivity and standard DNS queries succeeded.")
    print("Tunnel-specific output above is informational; verify a real client connection separately.")

    print(f"\nNext Steps:")
    print(f"  1. Configure MasterDNS VPN client with:")
    print(f"     - Server: {SERVER_IP}")
    print(f"     - Port: 53")
    print(f"     - Domain: {TUNNEL_DOMAIN}")
    print(f"     - Encryption Key: (from server's encrypt_key.txt)")
    print(f"\n  2. Or configure dnstt client with:")
    print(f"     - DoH server: https://cloudflare-dns.com/dns-query")
    print(f"     - Domain: {TUNNEL_DOMAIN}")
    print(f"     - Public key: (derived from server key)")

    check_server_logs()

    print(f"{'='*80}\n")

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\n[!] Test interrupted by user")
        sys.exit(130)
