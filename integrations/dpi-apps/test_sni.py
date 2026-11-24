#!/usr/bin/env python3
from pathlib import Path
import ssl
import socket
import re
import sys
import time

def get_hosts():
    hosts = []
    try:
        with open(Path(__file__).resolve().parent / "subs" / "all_links.txt") as f:
            for line in f:
                l = line.strip()
                m = re.search(r'@([^:]+):(\d+)', l)
                if m:
                    hosts.append((m.group(1), int(m.group(2))))
    except:
        pass
    # dedup
    seen = set()
    res = []
    for h,p in hosts:
        if (h,p) not in seen:
            seen.add((h,p)); res.append((h,p))
    return res

def test_tls_sni(host, port, timeout=5):
    ctx = ssl.create_default_context()
    try:
        start = time.time()
        with socket.create_connection((host,port), timeout=timeout) as s:
            with ctx.wrap_socket(s, server_hostname=host) as ss:
                elapsed = (time.time()-start)*1000
                return ('OK', ss.version(), elapsed)
    except Exception as e:
        elapsed = (time.time()-start)*1000 if 'start' in locals() else timeout*1000
        return ('ERR', type(e).__name__, elapsed, str(e))

if __name__ == '__main__':
    hosts = get_hosts()[:15]
    for h,p in hosts:
        res = test_tls_sni(h,p)
        print(h,p,res)
