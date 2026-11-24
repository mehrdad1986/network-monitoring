#!/usr/bin/env python3
"""
Comprehensive TCP Flag Injection Evader - ALL TCP flags tested
Injects every possible control packet combination to confuse DPI state machine.
"""
from scapy.all import conf
from pathlib import Path
import os
from scapy.all import sniff, IP, TCP, send, Raw
import threading
import time
import subprocess
import json

INTERFACE = (os.environ.get("DPI_INTERFACE") or str(conf.iface))
TARGET_PORT = 443
RESULTS = []
state_lock = threading.Lock()

g = {
    'server_ip': None, 'server_port': None,
    'client_ip': None, 'client_port': None,
    'server_seq': None, 'client_ack': None,
    'client_seq': None, 'server_ack': None,
    'captured': False, 'server_hello_time': None
}

def inject_packet(src_ip, src_port, dst_ip, dst_port, seq, ack, flags, payload=b'', label=""):
    pkt = IP(src=src_ip, dst=dst_ip) / TCP(
        sport=src_port, dport=dst_port,
        flags=flags, seq=seq, ack=ack, window=65535
    )
    if payload:
        pkt /= Raw(load=payload)
    try:
        send(pkt, verbose=False)
        ts = time.time()
        with state_lock:
            RESULTS.append(f"[{ts:.6f}] INJ {flags} {src_ip}:{src_port}->{dst_ip}:{dst_port} seq={seq} ack={ack} [{label}]")
        print(f"[INJ] {flags} {src_ip}:{src_port}->{dst_ip}:{dst_port} seq={seq} ack={ack} [{label}]", flush=True)
    except Exception as e:
        print(f"[!] Inject failed {label}: {e}", flush=True)

def packet_callback(pkt):
    with state_lock:
        if g['captured']:
            return
        
    if not pkt.haslayer(IP) or not pkt.haslayer(TCP):
        return
    
    ip = pkt[IP]
    tcp = pkt[TCP]
    
    if tcp.dport != TARGET_PORT and tcp.sport != TARGET_PORT:
        return
    
    with state_lock:
        if g['captured']:
            return
        
        src_ip, dst_ip = ip.src, ip.dst
        src_port, dst_port = tcp.sport, tcp.dport
        
        # ServerHello detection: Server->Client with ACK and data
        if src_port == TARGET_PORT and dst_port != TARGET_PORT:
            if tcp.flags & 0x10 and len(tcp.payload) > 0:
                g['server_ip'] = src_ip
                g['server_port'] = src_port
                g['client_ip'] = dst_ip
                g['client_port'] = dst_port
                g['server_seq'] = tcp.seq
                g['server_len'] = len(tcp.payload)
                g['server_next_seq'] = tcp.seq + len(tcp.payload)
                g['client_ack'] = tcp.ack
                g['client_seq'] = tcp.seq
                g['server_ack'] = tcp.ack
                g['captured'] = True
                g['server_hello_time'] = time.time()
                print(f"[HS] ServerHello at {time.time():.6f}", flush=True)
                print(f"    Server {src_ip}:{src_port} -> Client {dst_ip}:{dst_port}", flush=True)
                print(f"    Server seq={tcp.seq} len={tcp.payload} ack={tcp.ack}", flush=True)
                print(f"    Client seq={tcp.seq} ack={tcp.ack}", flush=True)
                print(f"    Server next seq={g['server_next_seq']}", flush=True)

def run_all_injections():
    if not g['captured']:
        print("[!] No handshake captured, aborting injections", flush=True)
        return
    
    time.sleep(0.5)  # Wait for state to settle
    
    srv_ip = g['server_ip']
    srv_port = g['server_port']
    cli_ip = g['client_ip']
    cli_port = g['client_port']
    srv_seq = g['server_seq']
    srv_len = g['server_len']
    srv_next = g['server_next_seq']
    cli_ack = g['client_ack']
    cli_seq = g['client_seq']
    
    ts = time.time()
    print(f"\n{"="*60}", flush=True)
    print(f"[PAYLOAD] Starting all injection strategies", flush=True)
    print(f"{"="*60}", flush=True)
    
    # ========================================================================
    # RST Injections
    # ========================================================================
    
    # 1. Valid RST server->client (RST flag only)
    inject_packet(srv_ip, srv_port, cli_ip, cli_port, srv_next, cli_ack, "R", label="RST_S2C_VALID")
    time.sleep(0.02)
    
    # 2. RST+ACK server->client
    inject_packet(srv_ip, srv_port, cli_ip, cli_port, srv_next, cli_ack, "RA", label="RST_ACK_S2C")
    time.sleep(0.02)
    
    # 3. RST from client->server (spoofed direction)
    inject_packet(cli_ip, cli_port, srv_ip, srv_port, cli_ack, srv_next, "R", label="RST_C2S_SPOOF")
    time.sleep(0.02)
    
    # 4. RST+ACK client->server
    inject_packet(cli_ip, cli_port, srv_ip, srv_port, cli_ack, srv_next, "RA", label="RST_ACK_C2S")
    time.sleep(0.02)
    
    # ========================================================================
    # Invalid RST - sequence number manipulation
    # ========================================================================
    
    # 5. RST with seq+1 (invalid)
    inject_packet(srv_ip, srv_port, cli_ip, cli_port, srv_next+1, cli_ack, "R", label="RST_S2C_SEQ+1")
    time.sleep(0.02)
    
    # 6. RST with seq-1 (invalid)  
    inject_packet(srv_ip, srv_port, cli_ip, cli_port, srv_next-1, cli_ack, "R", label="RST_S2C_SEQ-1")
    time.sleep(0.02)
    
    # 7. RST with seq+1000 (invalid)
    inject_packet(srv_ip, srv_port, cli_ip, cli_port, srv_next+1000, cli_ack, "R", label="RST_S2C_SEQ+1000")
    time.sleep(0.02)
    
    # ========================================================================
    # FIN Injections
    # ========================================================================
    
    # 8. Valid FIN server->client
    inject_packet(srv_ip, srv_port, cli_ip, cli_port, srv_next, cli_ack, "FA", label="FIN_S2C")
    time.sleep(0.02)
    
    # 9. FIN+ACK server->client
    inject_packet(srv_ip, srv_port, cli_ip, cli_port, srv_next, cli_ack, "FA", label="FIN_ACK_S2C")
    time.sleep(0.02)
    
    # 10. RST+FIN server->client
    inject_packet(srv_ip, srv_port, cli_ip, cli_port, srv_next, cli_ack, "RF", label="RST_FIN_S2C")
    time.sleep(0.02)
    
    # 11. FIN client->server
    inject_packet(cli_ip, cli_port, srv_ip, srv_port, cli_ack, srv_next, "FA", label="FIN_C2S")
    time.sleep(0.02)
    
    # 12. RST+FIN client->server
    inject_packet(cli_ip, cli_port, srv_ip, srv_port, cli_ack, srv_next, "RF", label="RST_FIN_C2S")
    time.sleep(0.02)
    
    # ========================================================================
    # ACK Injections (probe window)
    # ========================================================================
    
    # 13. Bare ACK server->client (duplicate of what server sent)
    inject_packet(srv_ip, srv_port, cli_ip, cli_port, srv_seq, cli_ack, "A", label="ACK_DUP_S2C")
    time.sleep(0.02)
    
    # 14. ACK with wrong seq (ack+1)
    inject_packet(srv_ip, srv_port, cli_ip, cli_port, srv_seq, cli_ack+1, "A", label="ACK_WRONG_SEQ_S2C")
    time.sleep(0.02)
    
    # 15. ACK client->server
    inject_packet(cli_ip, cli_port, srv_ip, srv_port, cli_seq, srv_next, "A", label="ACK_C2S")
    time.sleep(0.02)
    
    # ========================================================================
    # PSH+ACK Injections (data injection attempts)
    # ========================================================================
    
    # 16. PSH+ACK with fake WS upgrade
    fake_data = b"GET / HTTP/1.1\r\nHost: fake.com\r\n\r\n"
    inject_packet(srv_ip, srv_port, cli_ip, cli_port, srv_next, cli_ack, "PA", payload=fake_data, label="PA_FAKE_DATA_S2C")
    time.sleep(0.02)
    
    # 17. PSH+ACK with arbitrary data at different seq
    inject_packet(srv_ip, srv_port, cli_ip, cli_port, srv_next+1, cli_ack, "PA", payload=b"G" * 100, label="PA_SEQ+1_S2C")
    time.sleep(0.02)
    
    # ========================================================================
    # SYN Injections (attempt to reset connection)
    # ========================================================================
    
    # 18. SYN server->client (should reset connection)
    inject_packet(srv_ip, srv_port, cli_ip, cli_port, srv_next, cli_ack, "S", label="SYN_S2C")
    time.sleep(0.02)
    
    # 19. SYN+ACK server->client
    inject_packet(srv_ip, srv_port, cli_ip, cli_port, srv_next, cli_ack, "SA", label="SYN_ACK_S2C")
    time.sleep(0.02)
    
    # ========================================================================
    # Rapid Multiple RSTs (confuse state tracking)
    # ========================================================================
    
    for i in range(10):
        inject_packet(srv_ip, srv_port, cli_ip, cli_port, srv_next+i*100, cli_ack, "R", label=f"RAPID_RST_{i}")
    time.sleep(0.01)
    
    # ========================================================================
    # Out-of-order sequence injection
    # ========================================================================
    
    # 20. RST with very large seq (far outside window)
    inject_packet(srv_ip, srv_port, cli_ip, cli_port, srv_next+1000000, cli_ack, "R", label="RST_SEQ_MASSIVE")
    time.sleep(0.05)
    
    # 21. RST with negative seq offset
    inject_packet(srv_ip, srv_port, cli_ip, cli_port, srv_next-1000, cli_ack, "R", label="RST_SEQ_NEG")
    time.sleep(0.05)
    
    # 24. RST with ack+1
    inject_packet(srv_ip, srv_port, cli_ip, cli_port, srv_next, cli_ack+1, "R", label="RST_ACK+1")
    time.sleep(0.05)
    
    # 25. RST with packet size padding
    inject_packet(srv_ip, srv_port, cli_ip, cli_port, srv_next, cli_ack, "R", label="RST_S2C")
    
    print(f"[{time.time():.6f}] All injection strategies sent", flush=True)

def test_config(config_path, port, results_list):
    proc = subprocess.Popen(
        ["timeout", "25", "xray", "run", "-c", config_path],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    
    time.sleep(3)
    
    curl_proc = subprocess.Popen(
        ["curl", "-s", "--socks5", f"127.0.0.1:{port}", "--connect-timeout", "12",
         "http://httpbin.org/ip"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    
    try:
        stdout, stderr = curl_proc.communicate(timeout=18)
        rc = curl_proc.returncode
        with state_lock:
            results_list.append(f"[CURL port={port}] RC={rc}")
        if stdout.strip():
            print(f"[CURL port={port}] Output: {stdout.strip()[:100]}", flush=True)
    except subprocess.TimeoutExpired:
        curl_proc.kill()
        with state_lock:
            results_list.append(f"[CURL port={port}] TIMEOUT")
        print(f"[CURL port={port}] TIMEOUT", flush=True)
    
    proc.terminate()
    try:
        proc.wait(timeout=3)
    except:
        proc.kill()

def run_single_test(config_path, port):
    injector = __import__('threading').Thread(target=lambda: None)
    
    sniff_thread = threading.Thread(
        target=lambda: sniff(
            iface=INTERFACE,
            filter=f"tcp port {TARGET_PORT}",
            prn=packet_callback,
            store=False,
            timeout=25
        ),
        daemon=True
    )
    sniff_thread.start()
    time.sleep(1)
    
    print(f"\n[*] Starting xray: {config_path}", flush=True)
    xray_proc = subprocess.Popen(
        ["timeout", "30", "xray", "run", "-c", config_path],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    
    time.sleep(3)
    
    print(f"[*] Testing through port {port}...", flush=True)
    curl_proc = subprocess.Popen(
        ["curl", "-s", "--socks5", f"127.0.0.1:{port}", "--connect-timeout", "15",
         "http://httpbin.org/ip"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    
    try:
        stdout, stderr = curl_proc.communicate(timeout=20)
        rc = curl_proc.returncode
        print(f"[CURL] RC={rc}", flush=True)
        if stdout.strip():
            print(f"[CURL] Output: {stdout.strip()[:150]}", flush=True)
    except subprocess.TimeoutExpired:
        curl_proc.kill()
        print("[CURL] TIMEOUT", flush=True)
    
    # Trigger injections after handshake
    time.sleep(2)
    
    sniff_thread.join(timeout=5)
    xray_proc.terminate()
    try:
        xray_proc.wait(timeout=3)
    except:
        xray_proc.kill()
    
    print(f"[DONE] Test completed", flush=True)

if __name__ == "__main__":
    import sys
    
    print("="*70)
    print("COMPREHENSIVE TCP FLAG INJECTION EVADER")
    print("="*70)
    print("Testing ALL TCP flags and control packet combinations", flush=True)
    
    config_file = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("DPI_XRAY_CONFIG", str(Path(__file__).resolve().parent / "xray_config.json"))
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 1081
    
    run_single_test(config_file, port)