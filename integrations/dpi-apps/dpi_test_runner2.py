#!/usr/bin/env python3
"""
DPI/SNI Test Harness v2 (Educational)
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
RESULT = os.path.join(BASE, "dpi_results2.json")

INSTRUCTIONS = """\
[GOAL] Find SNI filtering behavior.
[TESTS]
1. tcp connect
2. tls with real SNI
3. tls with fake SNI (example.com)
4. tls with no SNI but skip hostname check? (try both)

Look for: tcp OK + real SNI fails (RST/timeout) + fake SNI succeeds -> SNI filter.
"""

def load_targets(limit=20):
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
        print('ERR', e)
    return targets

def tcp_connect(host, port, timeout=5):
    start = time.time()
    try:
        s = socket.create_connection((host,port), timeout=timeout)
        s.close()
        return {'status':'OK','ms':round((time.time()-start)*1000,1)}
    except Exception as e:
        return {'status':'ERR','err':type(e).__name__,'ms':round((time.time()-start)*1000,1)}

def tls_test(host, port, sni=None, timeout=6):
    start = time.time()
    try:
        if sni is None:
            ctx = ssl._create_unverified_context()
            with socket.create_connection((host,port), timeout=timeout) as s:
                ss = ctx.wrap_socket(s)
                ver = ss.version()
                ss.close()
                return {'status':'OK','tls':ver,'ms':round((time.time()-start)*1000,1)}
        else:
            ctx = ssl.create_default_context()
            with socket.create_connection((host,port), timeout=timeout) as s:
                ss = ctx.wrap_socket(s, server_hostname=sni)
                ver = ss.version()
                ss.close()
                return {'status':'OK','tls':ver,'ms':round((time.time()-start)*1000,1)}
    except Exception as e:
        return {'status':'ERR','err':type(e).__name__,'ms':round((time.time()-start)*1000,1),'msg':str(e)[:80]}

if __name__ == '__main__':
    print(INSTRUCTIONS)
    targets = load_targets()
    res = []
    for h,p in targets:
        r = {
            't': f'{h}:{p}',
            'tcp': tcp_connect(h,p),
            'sni_real': tls_test(h,p,sni=h),
            'sni_fake': tls_test(h,p,sni='example.com'),
            'sni_none': tls_test(h,p,sni=None),
        }
        res.append(r)
        print(json.dumps(r))
    with open(RESULT,'w') as f:
        json.dump({'results':res}, f, indent=2)
    print('SAVED', RESULT)
