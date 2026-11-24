#!/usr/bin/env python3
"""
Simple RST injection - capture handshake then inject.
Uses global state dict to avoid scoping issues.
"""
from scapy.all import conf
from pathlib import Path
from scapy.all import sniff, IP, TCP, send
import sys
import time
import subprocess
import os

INTERFACE = (os.environ.get("DPI_INTERFACE") or str(conf.iface))
TARGET_PORT = 443

# Global state - use module-level variables
g = {
    'captured': False,
    'server_ip': None,
    'server_port': None,
    'client_ip': None,
    'client_port': None,
    'server_next_seq': None,
    'client_next_ack': None,
}

def packet_cb(pkt):
    if not pkt.haslayer(IP) or not pkt.haslayer(TCP):
        return
    ip = pkt[IP]
    tcp = pkt[TCP]
    if tcp.dport != TARGET_PORT and tcp.sport != TARGET_PORT:
        return
    if g['captured']:
        return
    
    src_ip, dst_ip = ip.src, ip.dst
    src_port, dst_port = tcp.sport, tcp.dport
    
    # Server -> Client with data
    if src_port == TARGET_PORT and dst_port != TARGET_PORT:
        if tcp.flags & 0x10 and len(tcp.payload) > 0:
            g['server_ip'] = src_ip
            g['server_port'] = src_port
            g['client_ip'] = dst_ip
            g['client_port'] = dst_port
            g['server_next_seq'] = tcp.seq + len(tcp.payload)
            g['client_next_ack'] = tcp.ack
            g['captured'] = True
            print(f"[HS] Server->{dst_ip}:{dst_port} seq={tcp.seq} len={len(tcp.payload)} ack={tcp.ack}", flush=True)

def run_test():
    global injection_done
    
    # Start sniffing
    print("[*] Starting sniffer...", flush=True)
    sniff_thread = __import__('threading').Thread(
        target=lambda: sniff(
            iface=INTERFACE,
            filter=f"tcp port {TARGET_PORT}",
            prn=packet_cb,
            store=False,
            timeout=25
        ),
        daemon=True
    )
    sniff_thread.start()
    time.sleep(1)
    
    # Start xray
    print("[*] Starting xray config 3...", flush=True)
    xray_proc = subprocess.Popen(
        ["timeout", "30", "xray", "run", "-c", os.environ.get("DPI_XRAY_CONFIG", str(Path(__file__).resolve().parent / "xray_config.json"))],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    
    time.sleep(3)
    
    # Wait for handshake capture
    print("[*] Waiting for handshake capture...", flush=True)
    wait_start = time.time()
    while not g['captured'] and time.time() - wait_start < 20:
        time.sleep(0.1)
    
    if not g['captured']:
        print("[!] No handshake captured", flush=True)
    else:
        print(f"[*] Handshake captured. Injecting...", flush=True)
        
        sip = g['server_ip']
        sport = g['server_port']
        cip = g['client_ip']
        cport = g['client_port']
        sseq = g['server_next_seq']
        cack = g['client_next_ack']
        
        # Inject multiple strategies
        strategies = [
            (sip, sport, cip, cport, sseq, cack, "R", "VALID_RST_S2C"),
            (sip, sport, cip, cport, sseq + 1, cack, "R", "INVALID_RST_S2C_1"),
            (cip, cport, sip, sport, cack, sseq, "R", "RST_C2S"),
            (sip, sport, cip, cport, sseq, cack, "FA", "FIN_S2C"),
            (cip, cport, sip, sport, cack, sseq, "FA", "FIN_C2S"),
        ]
        
        for src_ip, src_port, dst_ip, dst_port, seq, ack, flags, label in strategies:
            try:
                pkt = IP(src=src_ip, dst=dst_ip) / TCP(
                    sport=src_port, dport=dst_port,
                    flags=flags, seq=seq, ack=ack, window=65535
                )
                send(pkt, verbose=False)
                print(f"[INJ] {flags} {src_ip}:{src_port} -> {dst_ip}:{dst_port} seq={seq} ack={ack} [{label}]", flush=True)
                time.sleep(0.05)
            except Exception as e:
                print(f"[!] Inject {label} failed: {e}", flush=True)
    
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

if __name__ == "__main__":
    run_test()
