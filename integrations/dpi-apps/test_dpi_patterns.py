#!/usr/bin/env python3
import socket
import ssl
import time

# test different ClientHello patterns? simple baseline
def test_plain_connect(host, port, timeout=5):
    start = time.time()
    try:
        s = socket.create_connection((host, port), timeout=timeout)
        s.close()
        return ('OK', (time.time()-start)*1000)
    except Exception as e:
        return ('ERR', e)

# test with SNI
def test_sni(host, port, timeout=5):
    ctx = ssl.create_default_context()
    start = time.time()
    try:
        with socket.create_connection((host,port), timeout=timeout) as s:
            with ctx.wrap_socket(s, server_hostname=host) as ss:
                return ('OK', ss.version(), (time.time()-start)*1000)
    except Exception as e:
        return ('ERR', type(e).__name__, (time.time()-start)*1000)

if __name__ == '__main__':
    # test against known CDN endpoints from subs
    targets = [('speedtest.net',443), ('104.17.216.114',2083), ('162.159.38.7',2087)]
    for h,p in targets:
        print('plain', h,p, test_plain_connect(h,p))
        print('sni', h,p, test_sni(h,p))
