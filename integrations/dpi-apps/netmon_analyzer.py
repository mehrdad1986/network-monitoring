#!/usr/bin/env python3
import sys
import re
import os
import glob
from collections import defaultdict, Counter

def is_private(ip):
    import ipaddress
    try:
        return not ipaddress.IPv4Address(ip).is_global
    except ipaddress.AddressValueError:
        return True


def extract_ips_from_file(filepath):
    ips = []
    try:
        with open(filepath, 'r', errors='replace') as f:
            for line in f:
                # Find all IPs in line
                for m in re.finditer(r'(\d+\.\d+\.\d+\.\d+)', line):
                    ips.append(m.group(1))
    except Exception as e:
        pass
    return ips

def get_azix_ips(path_list):
    azix = set()
    for ip in path_list:
        if ip.startswith('85.132.90.') or ip.startswith('85.132.91.'):
            azix.add(ip)
    return azix

def categorize_ip(ip):
    if ip.startswith('85.132.90.') or ip.startswith('85.132.91.'):
        return 'Az-IX Baku (AS29049)'
    elif ip.startswith('193.251.') or ip.startswith('80.81.19'):
        return 'DE-CIX Frankfurt (AS5511)'
    elif ip.startswith('62.115.') or ip.startswith('213.248.'):
        return 'Twelve99 (AS1299)'
    elif ip.startswith('129.250.') or ip.startswith('129.251.'):
        return 'NTT GIN (AS2914)'
    elif ip.startswith('154.25.') or ip.startswith('154.54.') or ip.startswith('154.55.') or ip.startswith('38.142.'):
        return 'Cogent (AS174)'
    elif ip.startswith('184.104.') or ip.startswith('184.105.') or ip.startswith('216.66.'):
        return 'HE.net (AS6939)'
    elif ip.startswith('217.131.59.'):
        return 'Turkcell (AS6822)'
    elif ip.startswith('1.1.1.') or ip.startswith('162.158.') or (ip.startswith('104.16') and not is_private(ip)) or ip.startswith('104.17') or ip.startswith('104.18') or ip.startswith('104.21') or ip.startswith('104.44') or ip.startswith('107.162') or ip.startswith('172.64') or ip.startswith('173.245'):
        return 'Cloudflare (AS13335)'
    elif ip.startswith('216.239.') or ip.startswith('142.250.') or ip.startswith('142.251.') or ip.startswith('72.14.') or ip.startswith('17.253.') or ip.startswith('17.1.168'):
        return 'Google (AS15169)'
    elif ip.startswith('74.6.') or ip.startswith('98.138.') or ip.startswith('209.191.') or ip.startswith('68.180.'):
        return 'Yahoo (AS10310)'
    elif ip.startswith('98.82.') or ip.startswith('98.87.') or ip.startswith('91.200.'):
        return 'AWS (AS16509)'
    elif ip.startswith('51.10.') or ip.startswith('150.171.'):
        return 'Microsoft (AS8075)'
    elif ip.startswith('151.101.'):
        return 'Fastly (AS54113)'
    elif ip.startswith('208.67.') or ip.startswith('8.26.'):
        return 'OpenDNS/Cisco (AS36696)'
    elif ip in ['9.9.9.9', '149.112.121.10', '156.155.156.156']:
        return 'Quad9 (AS16552)'
    elif ip.startswith('185.228.') or ip.startswith('185.222.'):
        return 'SafeDNS (AS24013)'
    elif ip in ['4.2.2.1', '4.2.2.2'] or ip.startswith('216.115.'):
        return 'Level3/Lumen (AS3356)'
    elif ip.startswith('221.183.') or ip.startswith('223.118.') or ip.startswith('202.97.') or ip.startswith('111.63.') or ip.startswith('112.54.') or ip.startswith('4.68.127.'):
        return 'China Telecom (AS4837/9808)'
    elif is_private(ip):
        return 'Private/Internal'
    else:
        return 'Other/CDN/Direct'


def main():
    from collections import Counter
    from result_data import arguments, addresses
    args = arguments("Summarize addresses using historical prefix heuristics (not live ASN lookups)")
    counts = Counter(categorize_ip(ip) for file in args.files for ip in addresses(file.read_text(errors='replace')))
    print("Historical prefix heuristics; verify actual ASN ownership separately.")
    for category, count in counts.most_common():
        print(f"{category}: {count}")


if __name__ == '__main__':
    main()
