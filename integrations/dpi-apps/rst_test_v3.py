#!/usr/bin/env python3
"""
RST Injection Test v3 - Fixed direction detection.
Server->Client: src_port=443, dst_port=client_ephemeral
Client->Server: src_port=client_ephemeral, dst_port=443
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
results = []

class RSTInjector:
    def __init__(self):
        self.injected = False
        self.lock = threading.Lock()
        self.server_ip = None
        self.client_ip = None
        self.client_port = None
        self.server_next_seq = None
        self.client_next_ack = None
    
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
            
            # Detect ServerHello from SERVER to CLIENT
            # Server sends FROM port 443 TO client's ephemeral port
            if src_port == TARGET_PORT and dst_port != TARGET_PORT:
                if tcp.flags & 0x10 and tcp.payload:  # ACK with data (ServerHello)
                    self.server_ip = src_ip
                    self.client_ip = dst_ip
                    self.client_port = dst_port
                    payload_len = len(tcp.payload)
                    self.server_next_seq = tcp.seq + payload_len
                    self.client_next_ack = tcp.ack
                    
                    print(f"[HS] ServerHello at {time.time():.6f}", flush=True)
                    print(f"    Server {src_ip}:{src_port} -> Client {dst_ip}:{dst_port}", flush=True)
                    print(f"    Server next seq: {self.server_next_seq}, Client ack: {self.client_next_ack}", flush=True)
                    
                    # Strategy 1: VALID RST from server to client
                    # seq = server's next expected seq, ack = client's next expected ack
                    # This WILL reset the real connection too
                    print(f"[STRAT1] VALID RST from server...", flush=True)
                    self._inject(self.server_ip, TARGET_PORT, self.client_ip, self.client_port,
                                 self.server_next_seq, self.client_next_ack, "VALID")
                    
                    time.sleep(0.03)
                    
                    # Strategy 2: INVALID RST from server (seq off)
                    # Real TCP ignores, DPI might accept
                    print(f"[STRAT2] INVALID RST from server (seq+500)...", flush=True)
                    self._inject(self.server_ip, TARGET_PORT, self.client_ip, self.client_port,
                                 self.server_next_seq + 500, self.client_next_ack, "INVALID")
                    
                    self.injected = True
                    print(f"[DONE] RST injection attempted", flush=True)
    
    def _inject(self, src_ip, src_port, dst_ip, dst_port, seq, ack, label):
        try:
            rst = IP(src=src_ip, dst=dst_ip) / TCP(
                sport=src_port, dport=dst_port,
                flags="R", seq=seq, ack=ack, window=65535
            )
            send(rst, verbose=False)
            print(f"[RST] {src_ip}:{src_port} -> {dst_ip}:{dst_port} seq={seq} ack={ack} [{label}]", flush=True)
        except Exception as e:
            print(f"[!] Inject failed: {e}", flush=True)

def run_test():
    injector = RSTInjector()
    
    # Start sniffing
    sniff_thread = threading.Thread(
        target=lambda: sniff(
            iface=INTERFACE,
            filter=f"tcp port {TARGET_PORT}",
            prn=injector.callback,
            store=False,
            timeout=25
        ),
        daemon=True
    )
    sniff_thread.start()
    
    # Start xray
    print("[*] Starting xray config 3...", flush=True)
    xray_proc = subprocess.Popen(
        ["timeout", "30", "xray", "run", "-c", os.environ.get("DPI_XRAY_CONFIG", str(Path(__file__).resolve().parent / "xray_config.json"))],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    
    time.sleep(3)
    
    # Test connectivity
    print("[*] Testing proxy connectivity...", flush=True)
    curl_proc = subprocess.Popen(
        ["curl", "-s", "--socks5", "127.0.0.1:1081", "--connect-timeout", "12",
         "http://httpbin.org/ip"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    
    try:
        stdout, stderr = curl_proc.communicate(timeout=18)
        rc = curl_proc.returncode
        print(f"[CURL] RC={rc}", flush=True)
        if stdout.strip():
            print(f"[CURL] Output: {stdout.strip()[:150]}", flush=True)
    except subprocess.TimeoutExpired:
        curl_proc.kill()
        print("[CURL] Timeout", flush=True)
    
    sniff_thread.join(timeout=5)
    xray_proc.terminate()
    try:
        xray_proc.wait(timeout=3)
    except:
        xray_proc.kill()
    
    print("\n" + "="*50)
    print("RST INJECTION TEST COMPLETE")
    print("="*50)

if __name__ == "__main__":
    run_test()
