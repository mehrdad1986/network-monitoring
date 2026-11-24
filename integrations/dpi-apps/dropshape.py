import socket, ssl, time, sys
import argparse

def main(argv=None):
    parser = argparse.ArgumentParser(description="Measure TLS connection lifetime without application data")
    parser.add_argument("host", help="TLS SNI hostname")
    parser.add_argument("ip", help="destination IP address")
    args = parser.parse_args(argv)
    return probe(args.host, args.ip)

def probe(host, ip):
    ctx=ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_REQUIRED; ctx.load_default_certs()
    inc,out=ssl.MemoryBIO(),ssl.MemoryBIO()
    obj=ctx.wrap_bio(inc,out,server_hostname=host)
    s=socket.create_connection((ip,443),timeout=10); t0=time.time()
    try:
        obj.do_handshake()
    except ssl.SSLWantReadError: pass
    s.sendall(out.read())
    done=False
    while not done:
        try:
            obj.do_handshake(); done=True
        except ssl.SSLWantReadError:
            data = s.recv(8192)
            if not data:
                raise ConnectionError("Peer closed during TLS handshake")
            inc.write(data)
        except ssl.SSLWantWriteError:
            s.sendall(out.read())
    while out.pending: s.sendall(out.read())
    print(f"  handshake COMPLETED at t={time.time()-t0:.3f}s  (no app data sent yet)")
    print("  idling 30s WITHOUT sending application data...")
    s.settimeout(30)
    try:
        d=s.recv(4096)
        if d==b"": print(f"  -> server/middlebox CLOSED at t={time.time()-t0:.3f}s")
        else: print(f"  -> got {len(d)} bytes at t={time.time()-t0:.3f}s")
    except socket.timeout:
        print("  -> STILL ALIVE after 30s idle")
        print("     => the filter does NOT use a timer. It discards traffic only")
        print("        after the client sends application data on a blacklisted flow.")
    finally: s.close()

if __name__ == "__main__":
    main()
