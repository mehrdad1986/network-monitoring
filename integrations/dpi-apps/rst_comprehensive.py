#!/usr/bin/env python3
"""
Comprehensive Packet Injection Test - Try every kind of injection.
Theory: Injecting RST/FIN packets at the right time might confuse DPI
and allow proxy traffic to pass.
"""
from scapy.all import conf
from pathlib import Path
import os
from scapy.all import sniff, IP, TCP, send
import sys
import time
import threading
import subprocess

INTERFACE = (os.environ.get("DPI_INTERFACE") or str(conf.iface))
TARGET_PORT = 443
events = []
lock = threading.Lock()

def inject_packet(src_ip, src_port, dst_ip, dst_port, seq, ack, flags, label, window=65535):
    try:
        pkt = IP(src=src_ip, dst=dst_ip) / TCP(
            sport=src_port, dport=dst_port,
            flags=flags, seq=seq, ack=ack, window=window
        )
        send(pkt, verbose=False)
        with lock:
            events.append(f"{time.time():.6f} {flags} {src_ip}:{src_port}->{dst_ip}:{dst_port} seq={seq} ack={ack} [{label}]")
            print(f"[INJ] {flags} {src_ip}:{src_port} -> {dst_ip}:{dst_port} seq={seq} ack={ack} [{label}]", flush=True)
    except Exception as e:
        print(f"[!] Inject error: {e}", flush=True)

def inject_rst(src_ip, src_port, dst_ip, dst_port, seq, ack, label, flags="R"):
    return inject_packet(src_ip, src_port, dst_ip, dst_port, seq, ack, flags, label)

class HandshakeDetector:
    def __init__(self):
        self.done = False
        self.lock = threading.Lock()
        self.server_info = None
    
    def callback(self, pkt):
        if not pkt.haslayer(IP) or not pkt.haslayer(TCP):
            return
        ip = pkt[IP]
        tcp = pkt[TCP]
        if tcp.dport != TARGET_PORT and tcp.sport != TARGET_PORT:
            return
        with self.lock:
            if self.done:
                return
            src_ip, dst_ip = ip.src, ip.dst
            src_port, dst_port = tcp.sport, tcp.dport
            
            # Detect Server->Client with data (ServerHello or post-handshake)
            if src_port == TARGET_PORT and dst_port != TARGET_PORT:
                if tcp.flags & 0x10 and len(tcp.payload) > 0:
                    self.done = True
                    self.server_info = {
                        'src_ip': src_ip, 'src_port': src_port,
                        'dst_ip': dst_ip, 'dst_port': dst_port,
                        'seq': tcp.seq, 'ack': tcp.ack,
                        'payload_len': len(tcp.payload)
                    }
                    print(f"[HS] {time.time():.6f} Server->Client data: seq={tcp.seq} len={len(tcp.payload)} ack={tcp.ack}", flush=True)
                    
                    # Inject multiple packet types immediately
                    server_next_seq = tcp.seq + len(tcp.payload)
                    client_next_ack = tcp.ack
                    
                    print(f"[INJ] Injecting packet batch at {time.time():.6f}", flush=True)
                    
                    # Strategy 1: Valid RST server->client
                    inject_rst(src_ip, src_port, dst_ip, dst_port, server_next_seq, client_next_ack, "VALID_RST_S2C")
                    time.sleep(0.01)
                    
                    # Strategy 2: Invalid RST from server (seq+1)
                    inject_rst(src_ip, src_port, dst_ip, dst_port, server_next_seq + 1, client_next_ack, "INVALID_RST_S2C_+1")
                    time.sleep(0.01)
                    
                    # Strategy 3: RST from client to server
                    inject_rst(dst_ip, dst_port, src_ip, src_port, client_next_ack, server_next_seq, "RST_C2S")
                    time.sleep(0.01)
                    
                    # Strategy 4: FIN from server to client
                    inject_rst(src_ip, src_port, dst_ip, dst_port, server_next_seq, client_next_ack, "FIN_S2C", flags="FA")
                    time.sleep(0.01)
                    
                    # Strategy 5: FIN from client to server
                    inject_rst(dst_ip, dst_port, src_ip, src_port, client_next_ack, server_next_seq, "FIN_C2S", flags="FA")
                    
                    print(f"[INJ] Batch complete", flush=True)

def run_test():
    det = HandshakeDetector()
    
    # Start sniffing first
    print("[*] Starting packet sniffer...", flush=True)
    sniff_thread = threading.Thread(
        target=lambda: sniff(iface=INTERFACE, filter=f"tcp port {TARGET_PORT}",
                            prn=det.callback, store=False, timeout=30),
        daemon=True
    )
    sniff_thread.start()
    time.sleep(1)
    
    # Start xray
    print("[*] Starting xray config 3...", flush=True)
    xray_proc = subprocess.Popen(
        ["timeout", "35", "xray", "run", "-c", os.environ.get("DPI_XRAY_CONFIG", str(Path(__file__).resolve().parent / "xray_config.json"))],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    
    time.sleep(3)
    
    # Test connectivity
    print("[*] Testing proxy connectivity...", flush=True)
    curl_proc = subprocess.Popen(
        ["curl", "-s", "--socks5", "127.0.0.1:1081", "--connect-timeout", "15",
         "http://httpbin.org/ip"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    try:
        stdout, stderr = curl_proc.communicate(timeout=20)
        print(f"[CURL] RC={curl_proc.returncode}", flush=True)
        if stdout.strip():
            print(f"[CURL] Output: {stdout.strip()[:200]}", flush=True)
    except subprocess.TimeoutExpired:
        curl_proc.kill()
        print("[CURL] Timeout", flush=True)
    
    sniff_thread.join(timeout=5)
    xray_proc.terminate()
    try:
        xray_proc.wait(timeout=3)
    except:
        xray_proc.kill()
    
    print("\n" + "="*60)
    print("INJECTION EVENTS:")
    for e in events:
        print(f"  {e}")
    print(f"Total: {len(events)} injections")
    print("="*60)

if __name__ == "__main__":
    run_test()
