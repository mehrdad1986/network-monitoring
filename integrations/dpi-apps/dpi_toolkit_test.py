#!/usr/bin/env python3
"""Test script for installed DPI toolkits"""

# Test Scapy
try:
    from scapy.all import *
    print("✓ Scapy 2.8.0 - Packet crafting/sniffing/analysis")
    print("  Example: Ether()/IP()/TCP()")
except Exception as e:
    print(f"✗ Scapy: {e}")

# Test dpkt
try:
    import dpkt
    print("✓ dpkt 1.9.8 - Fast packet parsing")
    print("  Example: dpkt.ethernet.Ethernet(raw_packet)")
except Exception as e:
    print(f"✗ dpkt: {e}")

# Test pyshark
try:
    import pyshark
    print("✓ pyshark 0.6 - Wireshark/tshark Python wrapper")
    print("  Example: pyshark.FileCapture('file.pcap')")
except Exception as e:
    print(f"✗ pyshark: {e}")

# Test tshark (system)
import subprocess
try:
    result = subprocess.run(['tshark', '-v'], capture_output=True, text=True)
    if result.returncode == 0:
        print("✓ tshark (Wireshark CLI) - Protocol analysis")
        print("  Version:", result.stdout.split('\n')[0])
except Exception as e:
    print(f"✗ tshark: {e}")

# Test libpcap
try:
    import ctypes
    libpcap = ctypes.CDLL('libpcap.so.0.8')
    print("✓ libpcap 1.10.4 - System packet capture library")
except Exception as e:
    print(f"✗ libpcap: {e}")

print("\n--- Additional DPI Toolkits Available ---")
print("""
C/C++ Libraries (need sudo apt install):
  - libndpi-dev          : nDPI - Open source DPI library
  - libnetfilter-queue-dev: Kernel packet queue
  - libprotoident-dev    : Lightweight protocol ID
  - zeek-dev             : Zeek (Bro) network analysis
  - suricata             : IDS/IPS with DPI

Go (if installed):
  - github.com/google/gopacket

Rust (if installed):
  - pnet, libpnet

Python (additional):
  - pip install netfilterqueue  (needs libnetfilter-queue-dev)
  - pip install pcapy          (needs libpcap-dev)
  - pip install scapy-http2    (HTTP/2 support)
""")
