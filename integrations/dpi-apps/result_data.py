"""Shared input handling for the saved traceroute analysis utilities."""
import argparse
import ipaddress
import os
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
IP_PATTERN = re.compile(r'(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])')


def addresses(text):
    for match in IP_PATTERN.finditer(text):
        try:
            yield str(ipaddress.IPv4Address(match.group()))
        except ipaddress.AddressValueError:
            continue


def arguments(description, output_name=None):
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument('--data-dir', type=Path, default=Path(os.environ.get('NETMON_DATA_DIR', ROOT / 'data')),
                        help='folder containing saved traceroute .txt files (or NETMON_DATA_DIR)')
    if output_name:
        parser.add_argument('--output', type=Path, default=ROOT / 'reports' / output_name)
    args = parser.parse_args()
    if not args.data_dir.is_dir():
        parser.error(f'Data directory does not exist: {args.data_dir}; supply --data-dir')
    args.files = sorted(p for p in args.data_dir.rglob('*.txt') if p.name not in {'start.txt', 'end.txt'}
                        and p.resolve() != getattr(args, 'output', Path('/nonexistent')).resolve())
    if not args.files:
        parser.error(f'No saved traceroute .txt files found in {args.data_dir}')
    return args
