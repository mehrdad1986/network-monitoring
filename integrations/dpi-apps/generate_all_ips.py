#!/usr/bin/env python3
"""Extract and classify valid IPv4 addresses from saved traceroute text files."""
import ipaddress
from result_data import addresses, arguments


def is_private(ip):
    return not ipaddress.IPv4Address(ip).is_global


def main():
    args = arguments(__doc__, 'ALL_UNIQUE_IPS.txt')
    found = {ip for path in args.files for ip in addresses(path.read_text(errors='replace'))}
    public = sorted((ip for ip in found if not is_private(ip)), key=ipaddress.IPv4Address)
    private = sorted(found - set(public), key=ipaddress.IPv4Address)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(f'# Total: {len(found)}\n# Public: {len(public)}\n# Non-global: {len(private)}\n\n'
                           + '## Public IPs\n' + '\n'.join(public) + '\n\n## Non-global IPs\n' + '\n'.join(private) + '\n')
    print(f'Wrote {len(found)} addresses to {args.output}')


if __name__ == '__main__':
    main()
