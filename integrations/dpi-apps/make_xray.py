#!/usr/bin/env python3
"""Generate a VLESS WebSocket/TLS Xray config from explicit connection parameters."""
import argparse
import json
import os
from pathlib import Path
from uuid import UUID


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', required=True)
    parser.add_argument('--uuid', required=True, type=UUID)
    parser.add_argument('--ws-path', default='/')
    parser.add_argument('--port', type=int, default=443)
    parser.add_argument('--socks-port', type=int, default=1081)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().with_name('xray_config.generated.json'))
    args = parser.parse_args()
    if not all(1 <= p <= 65535 for p in (args.port, args.socks_port)) or not args.ws_path.startswith('/'):
        parser.error('ports must be 1–65535 and --ws-path must begin with /')
    config = {'log': {'loglevel': 'warning'},
              'inbounds': [{'tag': 'socks', 'protocol': 'socks', 'listen': '127.0.0.1',
                            'port': args.socks_port, 'settings': {'udp': True}}],
              'outbounds': [{'tag': 'proxy', 'protocol': 'vless',
                             'settings': {'vnext': [{'address': args.host, 'port': args.port,
                                                     'users': [{'id': str(args.uuid), 'encryption': 'none'}]}]},
                             'streamSettings': {'network': 'ws', 'security': 'tls',
                                                'tlsSettings': {'serverName': args.host, 'allowInsecure': False,
                                                                'fingerprint': 'chrome'},
                                                'wsSettings': {'path': args.ws_path, 'headers': {'Host': args.host}}}}]}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    try:
        fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        parser.error(f'Refusing to overwrite existing config: {args.output}')
    with os.fdopen(fd, 'w', encoding='utf-8') as out:
        json.dump(config, out, indent=2)
    print(f'Config written to {args.output}')


if __name__ == '__main__':
    main()
