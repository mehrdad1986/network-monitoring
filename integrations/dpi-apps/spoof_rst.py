#!/usr/bin/env python3
"""Send one TCP RST for an explicitly specified test connection."""
import argparse
import ipaddress


def send_rst(src_ip, src_port, dst_ip, dst_port, seq):
    from scapy.all import IP, TCP, send
    pkt = IP(src=src_ip, dst=dst_ip) / TCP(sport=src_port, dport=dst_port, flags='R', seq=seq)
    send(pkt, verbose=False)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('src_ip', type=ipaddress.IPv4Address)
    parser.add_argument('src_port', type=int)
    parser.add_argument('dst_ip', type=ipaddress.IPv4Address)
    parser.add_argument('dst_port', type=int)
    parser.add_argument('seq', type=int)
    args = parser.parse_args()
    if not all(1 <= p <= 65535 for p in (args.src_port, args.dst_port)) or not 0 <= args.seq <= 0xffffffff:
        parser.error('ports must be 1–65535 and seq must be an unsigned 32-bit integer')
    send_rst(str(args.src_ip), args.src_port, str(args.dst_ip), args.dst_port, args.seq)
    print('Sent one RST packet')


if __name__ == '__main__':
    main()
