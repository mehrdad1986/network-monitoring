#!/usr/bin/env python3
"""
DPI/SNI Test Harness (Educational)
Gives a local agent step-by-step instructions embedded, and runs structured tests.
"""
import os
import sys
import re
import ssl
import socket
import time
import json

BASE = os.path.dirname(os.path.abspath(__file__))
SUBS = os.path.join(BASE, "subs", "all_links.txt")
RESULT = os.path.join(BASE, "dpi_results.json")

INSTRUCTIONS = """\
[GOAL]
Determine if SNI-based DPI is present and how it behaves on this network.

[STEPS]
1. Load targets from subs/all_links.txt (extract host:port)
2. Baseline: TCP connect (no TLS) - see if port reachable
3. TLS with SNI (server_hostname=host) - see if handshake completes or RST/timeout
4. TLS without SNI (server_hostname=None) - sometimes bypasses naive SNI filters
5. TLS with fake SNI (e.g. example.com) - see middlebox behavior
6. Try different ports for same IPs
7. Record: RST/timeout/OK, timing, TLS version if any
8. Look for patterns: which (host,port) fail only with correct SNI?

[INTERPRETATION]
- Plain connect OK + SNI handshake RST -> likely SNI inspection
- Both fail with timeout -> possible drop/filtering or routing issue
- SNI None/fake works when real SNI fails -> strong indicator of SNI filtering
- Works with real SNI -> less likely blocked by SNI

[CAUTION]
Educational/network diagnosis only. Do not use for evading restrictions.
"""

def load_targets(limit=30):
    targets = []
    try:
        with open(SUBS) as f:
            for line in f:
                m = re.search(r'@([^:]+):(\d+)', line.strip())
                if m:
                    h,p = m.group(1), int(m.group(2))
                    if (h,p) not in targets:
                        targets.append((h,p))
                        if len(targets) >= limit:
                            break
    except Exception as e:
        print('ERR loading:', e)
    return targets

def tcp_connect(host, port, timeout=5):
    start = time.time()
    try:
        s = socket.create_connection((host,port), timeout=timeout)
        s.close()
        return {'status':'OK','time_ms': round((time.time()-start)*1000,1)}
    except Exception as e:
        return {'status':'ERR','err':type(e).__name__,'time_ms': round((time.time()-start)*1000,1)}

def tls_test(host, port, sni=None, timeout=6):
    ctx = ssl.create_default_context()
    if sni is None:
        ctx.check_hostname = False
    start = time.time()
    try:
        with socket.create_connection((host,port), timeout=timeout) as s:
            if sni:
                ss = ctx.wrap_socket(s, server_hostname=sni)
            else:
                ss = ctx.wrap_socket(s)
            ver = ss.version()
            ss.close()
            return {'status':'OK','tls':ver,'time_ms': round((time.time()-start)*1000,1)}
    except Exception as e:
        return {'status':'ERR','err':type(e).__name__,'time_ms': round((time.time()-start)*1000,1),'msg':str(e)[:60]}

if __name__ == '__main__':
    print(INSTRUCTIONS)
    targets = load_targets()
    results = []
    for h,p in targets:
        r = {
            'target': f'{h}:{p}',
            'tcp': tcp_connect(h,p),
            'tls_real_sni': tls_test(h,p,sni=h),
            'tls_no_sni': tls_test(h,p,sni=None),
            'tls_fake_sni': tls_test(h,p,sni='example.com'),
        }
        results.append(r)
        # brief print
        print(json.dumps(r, ensure_ascii=False))
    with open(RESULT,'w') as f:
        json.dump({'ts':time.time(),'results':results}, f, indent=2)
    print('Saved:', RESULT)
