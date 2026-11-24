#!/usr/bin/env python3
"""
RST/FIN Injection Test - Final version with proper scoping.
Tests multiple injection strategies to see if any bypasses DPI.
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

# Global state
captured = {}
lock = threading.Lock()
injection_done = False

def do_inject(src_ip, src_port, dst_ip, dst_port, seq, ack, flags, label):
    """Inject a single packet."""
    try:
        pkt = IP(src=src_ip, dst=dst_ip) / TCP(
            sport=src_port, dport=dst_port,
            flags=flags, seq=seq, ack=ack, window=65535
        )
        send(pkt, verbose=False)
        ts = f"{time.time():.6f}"
        print(f"[INJ {ts}] {flags} {src_ip}:{src_port} -> {dst_ip}:{dst_port} seq={seq} ack={ack} [{label}]", flush=True)
        return True
    except Exception as e:
        print(f"[!] Inject failed: {e}", flush=True)
        return False

def packet_cb(pkt):
    """Callback for sniffing - captures handshake info."""
    global injection_done
    if not pkt.haslayer(IP) or not pkt.haslayer(TCP):
        return
    ip = pkt[IP]
    tcp = pkt[TCP]
    if tcp.dport != TARGET_PORT and tcp.sport != TARGET_PORT:
        return
    with lock:
        if injection_done:
            return
        src_ip, dst_ip = ip.src, ip.dst
        src_port, dst_port = tcp.sport, tcp.dport
        
        # Server -> Client with data = ServerHello response
        if src_port == TARGET_PORT and dst_port != TARGET_PORT:
            if tcp.flags & 0x10 and len(tcp.payload) > 0:
                captured['server_ip'] = src_ip
                captured['server_port'] = src_port
                captured['client_ip'] = dst_ip
                captured['client_port'] = dst_port
                captured['server_seq'] = tcp.seq + len(tcp.payload)
                captured['client_ack'] = tcp.ack
                print(f"[HS {time.time():.6f}] Srv->{src_ip}:{src_port} -> Cli->{dst_ip}:{dst_port} seq={tcp.seq} len={len(tcp.payload)} ack={tcp.ack}", flush=True)
                injection_done = True

def run_injections():
    """Run all injection strategies."""
    global injection_done
    # Wait for handshake capture
    timeout = 20
    start = time.time()
    while not injection_done and time.time() - start < timeout:
        time.sleep(0.1)
    
    if not injection_done:
        print("[!] No handshake captured", flush=True)
        return
    
    sip = captured['server_ip']
    sport = captured['server_port']
    cip = captured['client_ip']
    cport = captured['client_port']
    sseq = captured['server_seq']
    cack = captured['client_ack']
    
    print(f"\n[INFO] Starting injection batch at {time.time():.6f}", flush=True)
    print(f"[INFO] Server: {sip}:{sport}, Client: {cip}:{cport}", flush=True)
    print(f"[INFO] Server next seq: {sseq}, Client ack: {cack}", flush=True)
    
    # Strategy 1: Valid RST server->client
    do_inject(sip, sport, cip, cport, sseq, cack, "R", "VALID_RST_S2C")
    time.sleep(0.05)
    
    # Strategy 2: Invalid RST server->client (seq+1)
    do_inject(sip, sport, cip, cport, sseq + 1, cack, "R", "INVALID_RST_S2C_1")
    time.sleep(0.05)
    
    # Strategy 3: RST client->server (spoofed)
    do_inject(cip, cport, sip, sport, cack, sseq, "R", "RST_C2S")
    time.sleep(0.05)
    
    # Strategy 4: FIN server->client
    do_inject(sip, sport, cip, cport, sseq, cack, "FA", "FIN_S2C")
    time.sleep(0.05)
    
    # Strategy 5: FIN client->server (spoofed)
    do_inject(cip, cport, sip, sport, cack, sseq, "FA", "FIN_C2S")
    time.sleep(0.05)
    
    # Strategy 6: Multiple rapid RSTs server->client
    for i in range(5):
        do_inject(sip, sport, cip, cport, sseq + i*100, cack, "R", f"RAPID_RST_{i}")
        time.sleep(0.01)
    
    print(f"[INFO] Injection batch complete at {time.time():.6f}", flush=True)

def run_test():
    global injection_done
    
    # Start sniffing
    print("[*] Starting packet sniffer...", flush=True)
    sniff_thread = threading.Thread(
        target=lambda: sniff(
            iface=INTERFACE,
            filter=f"tcp port {TARGET_PORT}",
            prn=packet_cb,
            store=False,
            timeout=30
        ),
        daemon=True
    )
    sniff_thread.start()
    time.sleep(1)
    
    # Start injection thread (will wait for handshake)
    inj_thread = threading.Thread(target=run_injections, daemon=True)
    inj_thread.start()
    
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
    inj_thread.join(timeout=5)
    xray_proc.terminate()
    try:
        xray_proc.wait(timeout=3)
    except:
        xray_proc.kill()
    
    print(f"\n[DONE] Injection done: {injection_done}", flush=True)

if __name__ == "__main__":
    run_test()
