#!/usr/bin/env python3
"""
RST Injection Test v2 - Properly timed RST injection during TLS handshake.
Tests multiple injection strategies:
1. Valid RST from server to client (will reset real connection too)
2. Invalid RST from server to client (seq off by 1, real client ignores)
3. RST from client to server
"""
from scapy.all import conf
from pathlib import Path
from scapy.all import sniff, IP, TCP, send, conf
import sys
import time
import threading
import subprocess
import os

INTERFACE = (os.environ.get("DPI_INTERFACE") or str(conf.iface))
TARGET_PORT = 443
results = []

def inject_rst(src_ip, src_port, dst_ip, dst_port, seq, ack, label=""):
    """Inject a spoofed RST packet."""
    try:
        rst_pkt = IP(src=src_ip, dst=dst_ip) / TCP(
            sport=src_port, dport=dst_port,
            flags="R", seq=seq, ack=ack, window=65535
        )
        send(rst_pkt, verbose=False)
        results.append(f"[{time.time():.6f}] RST injected: {src_ip}:{src_port} -> {dst_ip}:{dst_port} seq={seq} ack={ack} {label}")
        print(f"[RST] {src_ip}:{src_port} -> {dst_ip}:{dst_port} seq={seq} ack={ack} {label}", flush=True)
        return True
    except Exception as e:
        print(f"[!] RST injection failed: {e}", flush=True)
        return False

class RSTInjector:
    def __init__(self):
        self.handshake_complete = False
        self.server_seq = None
        self.client_ack = None
        self.client_ip = None
        self.client_port = None
        self.server_ip = None
        self.injected = False
        self.lock = threading.Lock()
    
    def callback(self, pkt):
        if not pkt.haslayer(IP) or not pkt.haslayer(TCP):
            return
        
        ip = pkt[IP]
        tcp = pkt[TCP]
        
        if tcp.dport != TARGET_PORT and tcp.sport != TARGET_PORT:
            return
        
        with self.lock:
            if self.injected:
                return
            
            src_ip, dst_ip = ip.src, ip.dst
            src_port, dst_port = tcp.sport, tcp.dport
            
            # Detect ServerHello from server to client
            if dst_port == TARGET_PORT and src_port != TARGET_PORT:
                # Server -> Client
                if tcp.flags & 0x10 and tcp.payload:  # ACK with data
                    self.server_ip = src_ip
                    self.client_ip = dst_ip
                    self.client_port = dst_port
                    self.server_seq = tcp.seq + len(tcp.payload)  # Server's next seq
                    self.client_ack = tcp.ack  # Client's next ack
                    self.handshake_complete = True
                    
                    print(f"[HS] ServerHello detected at {time.time():.6f}", flush=True)
                    print(f"    Server seq next: {self.server_seq}, Client ack: {self.client_ack}", flush=True)
                    
                    # Strategy 1: Inject VALID RST from server to client
                    # This WILL reset the real connection
                    print(f"[STRAT1] Injecting VALID RST from server...", flush=True)
                    inject_rst(self.server_ip, TARGET_PORT, self.client_ip, self.client_port,
                              self.server_seq, self.client_ack, label="VALID_RST_S2C")
                    
                    time.sleep(0.05)  # Small delay
                    
                    # Strategy 2: Inject INVALID RST from server to client (seq off by 1000)
                    # Real client should ignore, DPI might accept
                    print(f"[STRAT2] Injecting INVALID RST from server (seq+1000)...", flush=True)
                    inject_rst(self.server_ip, TARGET_PORT, self.client_ip, self.client_port,
                              self.server_seq + 1000, self.client_ack, label="INVALID_RST_S2C")
                    
                    self.injected = True
                    print(f"[DONE] RST injection strategies attempted", flush=True)

def run_test():
    """Run xray + RST injector + connectivity test."""
    injector = RSTInjector()
    
    # Start sniffing in background thread
    sniff_thread = threading.Thread(
        target=lambda: sniff(
            iface=INTERFACE,
            filter=f"tcp port {TARGET_PORT}",
            prn=injector.callback,
            store=False,
            timeout=20
        ),
        daemon=True
    )
    sniff_thread.start()
    
    # Start xray
    print("[*] Starting xray with config 3...", flush=True)
    xray_proc = subprocess.Popen(
        ["timeout", "25", "xray", "run", "-c", os.environ.get("DPI_XRAY_CONFIG", str(Path(__file__).resolve().parent / "xray_config.json"))],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    
    time.sleep(3)  # Let xray start
    
    # Try to connect through proxy
    print("[*] Testing connectivity through proxy...", flush=True)
    curl_proc = subprocess.Popen(
        ["curl", "-s", "--socks5", "127.0.0.1:1081", "--connect-timeout", "10",
         "http://httpbin.org/ip"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    
    try:
        stdout, stderr = curl_proc.communicate(timeout=15)
        rc = curl_proc.returncode
        results.append(f"[CURL] RC={rc}, stdout={stdout.strip()[:100]}")
        print(f"[CURL] RC={rc}", flush=True)
        if stdout.strip():
            print(f"[CURL] Output: {stdout.strip()[:200]}", flush=True)
    except subprocess.TimeoutExpired:
        curl_proc.kill()
        results.append("[CURL] Timeout")
        print("[CURL] Timeout", flush=True)
    
    # Wait for sniffing to finish
    sniff_thread.join(timeout=5)
    
    # Kill xray
    xray_proc.terminate()
    try:
        xray_proc.wait(timeout=3)
    except:
        xray_proc.kill()
    
    # Print all results
    print("\n" + "="*60)
    print("RST INJECTION TEST RESULTS")
    print("="*60)
    for r in results:
        print(r)
    print("="*60)

if __name__ == "__main__":
    run_test()
