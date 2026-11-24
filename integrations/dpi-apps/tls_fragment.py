#!/usr/bin/env python3
"""Compare TLS ClientHello transmission modes using decrypted HTTP responses."""
import argparse
from tls_bio_probe import probe_tls


def probe(host, port, mode, host_hdr=None, timeout=12.0):
    gaps = {'single': 0, 'fragment': 150, 'garbage': 150, 'delay': 600}
    if mode not in gaps:
        raise ValueError(f'Unknown mode: {mode}')
    verdict, detail, elapsed = probe_tls((host, port), host, gaps[mode], timeout, mode, host_hdr)
    print(f'{mode:9s} {verdict:10s} {elapsed}ms {detail}')
    return verdict, detail, elapsed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('host', nargs='?', default='test-sub.example.workers.dev')
    parser.add_argument('port', nargs='?', type=int, default=443)
    parser.add_argument('host_header', nargs='?', default=None)
    parser.add_argument('--timeout', type=float, default=12)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535 or args.timeout <= 0:
        parser.error('invalid port or timeout')
    for mode in ('single', 'fragment', 'garbage', 'delay'):
        probe(args.host, args.port, mode, args.host_header, args.timeout)


if __name__ == '__main__':
    main()
