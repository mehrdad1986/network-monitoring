#!/usr/bin/env python3
"""Extract observed Az-IX IPv4 addresses from saved traceroute text files."""
from collections import Counter
import ipaddress
from result_data import addresses, arguments


def main():
    args = arguments(__doc__, 'ALL_AZIX_IPS.txt')
    found = Counter(ip for path in args.files for ip in addresses(path.read_text(errors='replace'))
                    if ip.startswith(('85.132.90.', '85.132.91.')))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text('# Observed Az-IX addresses\n' + ''.join(f'{ip}\n' for ip in sorted(found, key=ipaddress.IPv4Address)))
    print(f'Wrote {len(found)} addresses to {args.output}')


if __name__ == '__main__':
    main()
