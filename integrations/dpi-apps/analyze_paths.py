#!/usr/bin/env python3
"""Count saved traceroutes containing Az-IX hops, excluding known sinkhole destinations."""
import ipaddress
from result_data import addresses, arguments


def is_private(ip):
    return not ipaddress.IPv4Address(ip).is_global


def get_paths(base_dir):
    from pathlib import Path
    paths = []
    for file in sorted(Path(base_dir).rglob('*.txt')):
        if file.name in {'start.txt', 'end.txt'}:
            continue
        ips = list(addresses(file.read_text(errors='replace')))
        if len(ips) > 1:
            paths.append(ips[1:])
    return paths


def main():
    args = arguments(__doc__)
    paths = [p for p in get_paths(args.data_dir) if p and not p[-1].startswith('10.10.34.')]
    count = sum(any(ip.startswith(('85.132.90.', '85.132.91.')) for ip in p) for p in paths)
    print(f'{count}/{len(paths)} saved paths contain Az-IX addresses (sinkholes excluded)')
    print('Input assumption: each file contains one traceroute, with its destination address in the header.')


if __name__ == '__main__':
    main()
