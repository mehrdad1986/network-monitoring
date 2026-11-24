"""TLS MemoryBIO probe with fragmented ClientHello and decrypted HTTP response checks."""
import socket
import ssl
import time


def probe_tls(ip, sni, gap_ms=0, timeout=10, mode='fragment', host_header=None):
    start = time.monotonic()
    raw = None
    elapsed = lambda: int((time.monotonic() - start) * 1000)
    deadline = start + timeout
    try:
        context = ssl.create_default_context()
        context.check_hostname = False
        context.set_alpn_protocols(['http/1.1'])
        incoming, outgoing = ssl.MemoryBIO(), ssl.MemoryBIO()
        tls = context.wrap_bio(incoming, outgoing, server_hostname=sni)
        try:
            tls.do_handshake()
        except ssl.SSLWantReadError:
            pass
        hello = outgoing.read()
        raw = socket.create_connection((ip, 443), timeout=timeout) if isinstance(ip, str) else socket.create_connection(ip, timeout=timeout)

        def check_time():
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise socket.timeout('Probe deadline exceeded')
            raw.settimeout(remaining)

        def flush():
            while outgoing.pending:
                check_time()
                raw.sendall(outgoing.read())

        def receive():
            check_time()
            chunk = raw.recv(16384)
            if not chunk:
                incoming.write_eof()
                raise EOFError('Peer closed connection')
            incoming.write(chunk)

        check_time()
        raw.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        if mode == 'garbage':
            raw.sendall(b'\x00' * 64)
            time.sleep(min(gap_ms / 1000, max(0, deadline - time.monotonic())))
            check_time()
            raw.sendall(hello)
        elif gap_ms > 0:
            split = max(1, len(hello) // 2)
            raw.sendall(hello[:split])
            time.sleep(min(gap_ms / 1000, max(0, deadline - time.monotonic())))
            check_time()
            raw.sendall(hello[split:])
        else:
            raw.sendall(hello)
        while True:
            try:
                tls.do_handshake()
                flush()
                break
            except ssl.SSLWantReadError:
                flush()
                receive()
            except ssl.SSLWantWriteError:
                flush()
        request = (f'GET / HTTP/1.1\r\nHost: {host_header or sni}\r\nConnection: close\r\n\r\n').encode()
        tls.write(request)
        flush()
        body = b''
        while b'\r\n\r\n' not in body and len(body) < 8192:
            try:
                chunk = tls.read(4096)
                if not chunk:
                    break
                body += chunk
            except ssl.SSLWantReadError:
                flush()
                receive()
            except ssl.SSLWantWriteError:
                flush()
        if body.startswith(b'HTTP/'):
            return 'RESPONSE', body.split(b'\r\n')[0].decode('latin1')[:100], elapsed()
        return 'EMPTY', 'No decrypted HTTP response', elapsed()
    except socket.timeout:
        return 'HANG', 'Timed out; filtering, routing and server failure need controls', elapsed()
    except ConnectionResetError:
        return 'RST', 'Connection reset; source of reset not established', elapsed()
    except ssl.SSLError as exc:
        return 'TLS_FAIL', str(exc)[:100], elapsed()
    except (OSError, EOFError) as exc:
        return 'TCP_FAIL', f'{type(exc).__name__}: {exc}'[:100], elapsed()
    finally:
        if raw is not None:
            raw.close()
