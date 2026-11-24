#!/usr/bin/env python3
"""
RST Injection Evasion Script - Test if injecting fake RST packets can confuse DPI
and allow proxy traffic to pass through.

THEORY: DPI is stateful and tracks connections. If we inject a spoofed RST
that the DPI accepts (making it think the connection is dead), the DPI may
stop inspecting that connection. Meanwhile, the real client-server connection
continues if the RST has an invalid sequence number that real endpoints ignore.

WARNING: This is experimental. Valid RST packets will reset real connections.
"""
from scapy.all import conf
from pathlib import Path
import os
from scapy.all import sniff, IP, TCP, send, conf
import sys
import time
import threading
import signal

# Configuration
TARGET_PORT = 443
INTERFACE = (os.environ.get("DPI_INTERFACE") or str(conf.iface))
RST_INJECTED = False
RST_LOCK = threading.Lock()

# Store handshake state
handshake_state = {}  # key: (client_ip, client_port, server_ip) -> dict

def get_tcp_window(pkt):
    """Get TCP window size from packet."""
    if pkt.haslayer(TCP):
        return pkt[TCP].window
    return 65535

def inject_rst(src_ip, src_port, dst_ip, dst_port, seq, ack, window=65535):
    """Inject a spoofed RST packet."""
    try:
        rst_pkt = IP(src=src_ip, dst=dst_ip) / TCP(
            sport=src_port, dport=dst_port,
            flags="R", seq=seq, ack=ack, window=window
        )
        send(rst_pkt, verbose=False)
        return True
    except Exception as e:
        print(f"[!] RST injection failed: {e}", flush=True)
        return False

def packet_callback(pkt):
    """Process each captured packet."""
    global RST_INJECTED
    
    if not pkt.haslayer(IP) or not pkt.haslayer(TCP):
        return
    
    ip = pkt[IP]
    tcp = pkt[TCP]
    
    # Only care about port 443 connections
    if tcp.dport != TARGET_PORT and tcp.sport != TARGET_PORT:
        return
    
    src_ip, dst_ip = ip.src, ip.dst
    src_port, dst_port = tcp.sport, tcp.dport
    
    # We want to inject RST FROM server TO client after TLS handshake
    # Detect ServerHello (response from server:443 to client)
    if tcp.dport != TARGET_PORT:  # This is server -> client
        server_ip, server_port = src_ip, src_port
        client_ip, client_port = dst_ip, dst_port
        
        key = (client_ip, client_port, server_ip)
        
        # Check if this looks like a ServerHello response
        # After TLS handshake, server sends data to client
        if tcp.flags & 0x10:  # ACK flag set
            if tcp.payload and len(tcp.payload) > 0:
                # Server sent data after handshake - this could be ServerHello + encrypted data
                seq = tcp.seq
                ack = tcp.ack
                payload_len = len(tcp.payload)
                
                # The server's next sequence number after this packet
                server_next_seq = seq + payload_len
                
                with RST_LOCK:
                    if not RST_INJECTED and key not in handshake_state.get('injected', set()):
                        # Inject RST from server to client
                        # Use seq = server_next_seq (valid RST seq)
                        # This WILL reset the real connection too!
                        # Alternative: use seq = server_next_seq + 1 (invalid, real client ignores)
                        # But DPI might accept it if it's less strict
                        
                        print(f"[+] Injecting RST from {server_ip}:{server_port} to {client_ip}:{client_port}", flush=True)
                        print(f"    seq={server_next_seq}, ack={ack}", flush=True)
                        
                        # Try injecting RST with the EXACT next seq (will reset real conn)
                        # And also try with offset seq (real client ignores)
                        inject_rst(server_ip, server_port, client_ip, client_port, 
                                  server_next_seq, ack)
                        
                        if key not in handshake_state:
                            handshake_state[key] = set()
                        handshake_state[key].add('injected')
                        RST_INJECTED = True
                        
                        print(f"[+] RST injected at {time.time():.6f}", flush=True)

def start_sniffing(duration=30):
    """Start sniffing for TLS handshake and inject RST."""
    print(f"[*] Starting RST injection sniffer on {INTERFACE}", flush=True)
    print(f"[*] Filter: tcp port {TARGET_PORT}", flush=True)
    
    try:
        sniff(
            iface=INTERFACE,
            filter=f"tcp port {TARGET_PORT}",
            prn=packet_callback,
            store=False,
            timeout=duration
        )
    except KeyboardInterrupt:
        pass
    except Exception as e:
        print(f"[!] Sniffing error: {e}", flush=True)
    
    print(f"[*] Sniffing done. RST injected: {RST_INJECTED}", flush=True)

if __name__ == "__main__":
    duration = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    start_sniffing(duration)
