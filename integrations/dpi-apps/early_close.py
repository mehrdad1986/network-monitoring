import socket
import ssl
import time
import sys

host = sys.argv[1] if len(sys.argv) > 1 else 'speedtest.net'
port = int(sys.argv[2]) if len(sys.argv) > 2 else 443
context = ssl.create_default_context()
context.check_hostname = False
context.verify_mode = ssl.CERT_NONE
# try with chrome-like settings via SSLContext - but limited
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(10)
s.connect((host, port))
ss = context.wrap_socket(s, server_hostname='speedtest.net')
time.sleep(0.01)  # close very quickly after handshake
ss.close()
