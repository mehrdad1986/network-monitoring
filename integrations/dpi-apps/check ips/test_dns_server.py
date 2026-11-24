#!/usr/bin/env python3
"""DNS Server Testing Tool

Tests DNS server functionality with comprehensive queries and diagnostics.
"""
import socket
import struct
import time
import sys
from datetime import datetime

DNS_SERVER = "185.204.171.218"
DNS_PORT = 53
TEST_DOMAIN = "example.com"
TIMEOUT = 5


def dns_query(domain, qtype=1, server=DNS_SERVER, port=DNS_PORT, use_tcp=False):
    """
    Send DNS query and return response.

    qtype: 1=A, 2=NS, 5=CNAME, 6=SOA, 15=MX, 16=TXT, 28=AAAA, 255=ANY
    """
    # Build DNS query packet
    transaction_id = 0x1234
    flags = 0x0100  # Standard query with recursion desired
    questions = 1
    answer_rrs = 0
    authority_rrs = 0
    additional_rrs = 0

    # DNS header
    header = struct.pack('>HHHHHH', transaction_id, flags, questions,
                         answer_rrs, authority_rrs, additional_rrs)

    # Question section
    qname = b''
    for part in domain.split('.'):
        qname += bytes([len(part)]) + part.encode('ascii')
    qname += b'\x00'

    question = qname + struct.pack('>HH', qtype, 1)  # qtype, qclass (IN)

    query = header + question

    try:
        if use_tcp:
            # TCP query
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(TIMEOUT)
            sock.connect((server, port))
            # TCP length prefix
            sock.sendall(struct.pack('>H', len(query)) + query)

            # Read length
            length_data = sock.recv(2)
            if len(length_data) < 2:
                sock.close()
                return None, "Incomplete TCP response"

            response_length = struct.unpack('>H', length_data)[0]
            response = b''
            while len(response) < response_length:
                chunk = sock.recv(response_length - len(response))
                if not chunk:
                    break
                response += chunk
            sock.close()
        else:
            # UDP query
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(TIMEOUT)
            sock.sendto(query, (server, port))
            response, addr = sock.recvfrom(4096)
            sock.close()

        return response, None

    except socket.timeout:
        return None, "Timeout - no response from DNS server"
    except ConnectionRefusedError:
        return None, "Connection refused - DNS server not listening"
    except OSError as e:
        return None, f"Network error: {e}"


def parse_dns_response(response):
    """Parse DNS response packet and extract basic info."""
    if not response or len(response) < 12:
        return None

    # Parse header
    tid, flags, qdcount, ancount, nscount, arcount = struct.unpack('>HHHHHH', response[:12])

    rcode = flags & 0x000F
    response_codes = {
        0: "NOERROR",
        1: "FORMERR",
        2: "SERVFAIL",
        3: "NXDOMAIN",
        4: "NOTIMP",
        5: "REFUSED"
    }

    return {
        'transaction_id': tid,
        'flags': flags,
        'is_response': (flags >> 15) & 1,
        'opcode': (flags >> 11) & 0xF,
        'authoritative': (flags >> 10) & 1,
        'truncated': (flags >> 9) & 1,
        'recursion_desired': (flags >> 8) & 1,
        'recursion_available': (flags >> 7) & 1,
        'rcode': rcode,
        'rcode_name': response_codes.get(rcode, f"UNKNOWN({rcode})"),
        'question_count': qdcount,
        'answer_count': ancount,
        'authority_count': nscount,
        'additional_count': arcount
    }


def test_connectivity():
    """Test basic network connectivity to DNS server."""
    print(f"[1] Testing TCP connectivity to {DNS_SERVER}:53")
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(3)
        start = time.time()
        sock.connect((DNS_SERVER, DNS_PORT))
        rtt = (time.time() - start) * 1000
        sock.close()
        print(f"    ✓ TCP connection successful ({rtt:.0f}ms)")
        return True
    except socket.timeout:
        print(f"    ✗ TCP connection timeout")
        return False
    except ConnectionRefusedError:
        print(f"    ✗ TCP connection refused")
        return False
    except OSError as e:
        print(f"    ✗ TCP connection failed: {e}")
        return False


def test_dns_queries():
    """Test various DNS query types."""
    print(f"\n[2] Testing DNS queries for {TEST_DOMAIN}")

    query_types = [
        (1, "A", "IPv4 address"),
        (28, "AAAA", "IPv6 address"),
        (2, "NS", "Name servers"),
        (6, "SOA", "Start of Authority"),
        (15, "MX", "Mail exchange"),
        (16, "TXT", "Text records"),
        (255, "ANY", "All records"),
    ]

    results = []

    for qtype, name, desc in query_types:
        print(f"\n    Testing {name} record ({desc})...")

        # Try UDP first
        start = time.time()
        response, error = dns_query(TEST_DOMAIN, qtype, use_tcp=False)
        rtt_udp = (time.time() - start) * 1000

        if error:
            print(f"      UDP: ✗ {error}")
            results.append((name, "UDP", False, error))
        else:
            parsed = parse_dns_response(response)
            if parsed:
                status = "✓" if parsed['rcode'] == 0 else "✗"
                print(f"      UDP: {status} {parsed['rcode_name']} ({rtt_udp:.0f}ms) - "
                      f"{parsed['answer_count']} answers, {parsed['authority_count']} authority, "
                      f"{parsed['additional_count']} additional")
                results.append((name, "UDP", parsed['rcode'] == 0,
                              f"{parsed['rcode_name']}, {parsed['answer_count']} answers"))
            else:
                print(f"      UDP: ✗ Invalid response")
                results.append((name, "UDP", False, "Invalid response"))

        # Try TCP
        start = time.time()
        response, error = dns_query(TEST_DOMAIN, qtype, use_tcp=True)
        rtt_tcp = (time.time() - start) * 1000

        if error:
            print(f"      TCP: ✗ {error}")
            results.append((name, "TCP", False, error))
        else:
            parsed = parse_dns_response(response)
            if parsed:
                status = "✓" if parsed['rcode'] == 0 else "✗"
                print(f"      TCP: {status} {parsed['rcode_name']} ({rtt_tcp:.0f}ms) - "
                      f"{parsed['answer_count']} answers, {parsed['authority_count']} authority, "
                      f"{parsed['additional_count']} additional")
                results.append((name, "TCP", parsed['rcode'] == 0,
                              f"{parsed['rcode_name']}, {parsed['answer_count']} answers"))
            else:
                print(f"      TCP: ✗ Invalid response")
                results.append((name, "TCP", False, "Invalid response"))

    return results


def test_external_domains():
    """Test recursive queries for external domains."""
    print(f"\n[3] Testing recursive queries (external domains)")

    external_domains = [
        "google.com",
        "cloudflare.com",
        "github.com",
    ]

    for domain in external_domains:
        print(f"\n    Querying {domain}...")
        start = time.time()
        response, error = dns_query(domain, qtype=1, use_tcp=False)
        rtt = (time.time() - start) * 1000

        if error:
            print(f"      ✗ {error}")
        else:
            parsed = parse_dns_response(response)
            if parsed:
                status = "✓" if parsed['rcode'] == 0 else "✗"
                print(f"      {status} {parsed['rcode_name']} ({rtt:.0f}ms) - "
                      f"{parsed['answer_count']} answers")
                if parsed['recursion_available']:
                    print(f"      ✓ Recursion is available")
                else:
                    print(f"      ⚠ Recursion not available")
            else:
                print(f"      ✗ Invalid response")


def test_performance():
    """Test DNS server performance."""
    print(f"\n[4] Performance testing (10 queries)")

    rtts = []
    for i in range(10):
        start = time.time()
        response, error = dns_query(TEST_DOMAIN, qtype=1, use_tcp=False)
        rtt = (time.time() - start) * 1000

        if not error and response:
            rtts.append(rtt)
            print(f"    Query {i+1}: {rtt:.0f}ms")
        else:
            print(f"    Query {i+1}: FAILED ({error})")

    if rtts:
        print(f"\n    Average RTT: {sum(rtts)/len(rtts):.0f}ms")
        print(f"    Min RTT: {min(rtts):.0f}ms")
        print(f"    Max RTT: {max(rtts):.0f}ms")
        print(f"    Success rate: {len(rtts)}/10 ({len(rtts)*10}%)")


def main():
    print(f"{'='*80}")
    print(f"  DNS Server Testing Tool")
    print(f"  Target: {DNS_SERVER}:{DNS_PORT}")
    print(f"  Domain: {TEST_DOMAIN}")
    print(f"  Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*80}\n")

    # Test connectivity
    if not test_connectivity():
        print("\n[!] Cannot establish TCP connection to DNS server")
        print("[!] Please check:")
        print("    - DNS server is running")
        print("    - Firewall allows port 53 TCP/UDP")
        print("    - Server IP address is correct")
        return 1

    # Test DNS queries
    results = test_dns_queries()

    # Test external domains
    test_external_domains()

    # Performance test
    test_performance()

    # Summary
    print(f"\n{'='*80}")
    print("SUMMARY")
    print(f"{'='*80}")

    udp_success = sum(1 for r in results if r[1] == "UDP" and r[2])
    tcp_success = sum(1 for r in results if r[1] == "TCP" and r[2])
    total_udp = sum(1 for r in results if r[1] == "UDP")
    total_tcp = sum(1 for r in results if r[1] == "TCP")

    print(f"UDP queries successful: {udp_success}/{total_udp}")
    print(f"TCP queries successful: {tcp_success}/{total_tcp}")

    if udp_success > 0 or tcp_success > 0:
        print(f"\n✓ DNS server is responding and appears to be working!")
    else:
        print(f"\n✗ DNS server is not responding properly")
        print(f"\nCommon issues:")
        print(f"  - DNS service not running")
        print(f"  - Zone not configured for {TEST_DOMAIN}")
        print(f"  - Firewall blocking port 53")
        print(f"  - Wrong server IP address")

    print(f"{'='*80}\n")

    return 0 if (udp_success > 0 or tcp_success > 0) else 2


if __name__ == "__main__":
    sys.exit(main())
