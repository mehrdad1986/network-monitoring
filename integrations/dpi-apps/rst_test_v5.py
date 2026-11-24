#!/usr/bin/env python3
"""
RST Injection Test v5 - Fixed packet parsing.
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
injection_events = []
lock = threading.Lock()

def inject_rst(src_ip, src_port, dst_ip, dst_port, seq, ack, label):
    try:
        rst = IP(src=src_ip, dst=dst_ip) / TCP(
            sport=src_port, dport=dst_port,
            flags="R", seq=seq, ack=ack, window=65535
        )
        send(rst, verbose=False)
        with lock:
            injection_events.append(f"{time.time():.6f} RST {src_ip}:{src_port}->{dst_ip}:{dst_port} seq={seq} ack={ack} [{label}]")
            print(f"[RST] {src_ip}:{src_port} -> {dst_ip}:{dst_port} seq={seq} ack={ack} [{label}]", flush=True)
    except Exception as e:
        print(f"[!] Inject error: {e}", flush=True)

class Detector:
    def __init__(self):
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
            print(f"[PKT] {src_ip}:{src_port} -> {dst_ip}:{dst_port} flags={tcp.flags.str} payload={len(tcp.payload)}", flush=True)
            
            # Server -> Client: src_port=443
            if src_port == TARGET_PORT and dst_port != TARGET_PORT:
                if tcp.flags & 0x10 and tcp.payload:
                    print(f"[HS] ServerHello! seq={tcp.seq} len={len(tcp.payload)} ack={tcp.ack}", flush=True)
                    seq = tcp.seq + len(tcp.payload)
                    ack = tcp.ack
                    
                    # Inject valid RST from server to client
                    print(f"[INJ] Valid RST server->client...", flush=True)
                    inject_rst(src_ip, src_port, dst_ip, dst_port, seq, ack, "VALID_RST_S2C")
                    time.sleep(0.03)
                    
                    # Inject invalid RST from server to client
                    print(f"[INJ] Invalid RST server->client (seq+1)...", flush=True)
                    inject_rst(src_ip, src_port, dst_ip, dst_port, seq + 1, ack, "INVALID_RST_S2C_+1")
                    
                    self.injected = True

def run_test():
    det = Detector()
    
    sniff_thread = threading.Thread(
        target=lambda: sniff(iface=INTERFACE, filter=f"tcp port {TARGET_PORT}",
                            prn=det.callback, store=False, timeout=25),
        daemon=True
    )
    sniff_thread.start()
    time.sleep(1)
    
    print("[*] Starting xray config 3...", flush=True)
    xray_proc = subprocess.Popen(
        ["timeout", "30", "xray", "run", "-c", os.environ.get("DPI_XRAY_CONFIG", str(Path(__file__).resolve().parent / "xray_config.json"))],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    
    time.sleep(2)
    
    print("[*] Testing connectivity...", flush=True)
    curl_proc = subprocess.Popen(
        ["curl", "-s", "--socks5", "127.0.0.1:1081", "--connect-timeout", "12",
         "http://httpbin.org/ip"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    try:
        stdout, stderr = curl_proc.communicate(timeout=18)
        print(f"[CURL] RC={curl_proc.returncode}", flush=True)
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
    
    print(f"\n[EVENTS] {len(injection_events)} RST injections")
    for e in injection_events:
        print(f"  {e}")

if __name__ == "__main__":
    run_test()
