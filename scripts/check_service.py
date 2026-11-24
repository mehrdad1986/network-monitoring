#!/usr/bin/env python3
"""Loopback bridge for the user's check apps. No shell or elevated privileges."""
import csv
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import ipaddress
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import tempfile
import threading
from urllib.parse import urlsplit, parse_qs

SOURCE = Path(os.environ.get('NETMON_CHECK_APPS', Path(__file__).resolve().parents[1] / 'integrations' / 'check-apps'))
GROUPS = {'doh': 'doh', 'dns': 'dns', 'websites': 'websites',
          'filtered-websites': 'websites', 'sanctioned-websites': 'websites', 'routes': 'routes'}
FILES = {'doh': 'doh_results.csv', 'dns': 'ipv4_dns_results.csv',
         'websites': 'website_check_results.csv', 'routes': 'route_results.csv'}
DEFAULT_LIMITS = {'doh': 814, 'dns': 62780, 'websites': 4000,
                  'filtered-websites': 4000, 'sanctioned-websites': 4000,
                  'routes': 20}
MAX_LIMIT = 100000
JOB_TIMEOUT_SECONDS = 6 * 60 * 60
JOBS = {}
LOCK = threading.RLock()


def matches(category, row):
    if category == 'filtered-websites':
        return row.get('filtered', '').lower() == 'yes'
    if category == 'sanctioned-websites':
        return row.get('status_code') == '451'
    if category == 'routes':
        return True
    return row.get('accessible', '').lower() == 'yes'


def validate(category, body):
    if category not in GROUPS or not isinstance(body, dict):
        raise ValueError('Unknown check or invalid request')
    limit = body.get('limit', DEFAULT_LIMITS[category])
    if type(limit) is not int or not 1 <= limit <= MAX_LIMIT:
        raise ValueError(f'Run size must be an integer from 1 to {MAX_LIMIT}')
    target = body.get('target', '1.1.1.1')
    if not isinstance(target, str) or len(target) > 253:
        raise ValueError('Invalid route target')
    if category == 'routes':
        try:
            ipaddress.ip_address(target)
        except ValueError:
            if not re.fullmatch(r'(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?', target):
                raise ValueError('Enter one IP address or hostname')
    return limit, target


def command(group, limit, target, output):
    base = [sys.executable, '-u', str(SOURCE / {
        'doh': 'check_doh.py', 'dns': 'check_ipv4_dns.py',
        'websites': 'check_websites.py', 'routes': 'route_analyzer.py'}[group])]
    base += ['--csv', str(output / FILES[group])]
    if group == 'doh':
        # Limit the input rather than changing the original endpoint list.
        endpoints = [line for line in (SOURCE / 'DOH_MAX_PUBLIC_ENDPOINTS.txt').read_text().splitlines()
                     if line.strip() and not line.lstrip().startswith('#')]
        selection = output / 'endpoints.txt'
        selection.write_text('\n'.join(dict.fromkeys(endpoints[:limit])))
        base += [str(selection), '--display-delay', '0', '--txt', str(output / 'doh_results.txt')]
    elif group == 'dns':
        base += [str(SOURCE / 'the MISP IPv4 DNS dataset.json'), '--limit', str(limit),
                 '--report', str(output / 'dns_report.txt')]
    elif group == 'websites':
        base += ['--no-doh', '--limit', str(limit), '--progress-every', '1',
                 '--top', str(SOURCE / 'world_top_2000_with_rank_and_country.csv'),
                 '--next', str(SOURCE / 'world_next_2000_by_country.csv'),
                 '--report', str(output / 'filtered_report.txt'),
                 '--fastest-report', str(output / 'fastest.txt'),
                 '--filtered-details', str(output / 'filtered_details.txt')]
    else:
        base += ['--target', target, '--max-hops', '20', '--report', str(output / 'route_analysis.txt')]
    return base


def read_report(path, category, page=1, per_page=30):
    result = {'rows': [], 'columns': [], 'total': 0, 'page': page, 'updated_at': None}
    if not path.is_file():
        return result
    result['updated_at'] = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()
    with path.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        result['columns'] = reader.fieldnames or []
        for row in reader:
            if matches(category, row):
                if (page - 1) * per_page <= result['total'] < page * per_page:
                    result['rows'].append(row)
                result['total'] += 1
    return result


def local_request(host, origin):
    def local(value):
        try:
            name = urlsplit('http://' + value).hostname
            return name == 'localhost' or ipaddress.ip_address(name).is_loopback
        except (ValueError, TypeError):
            return False
    if not local(host):
        return False
    if origin:
        try:
            parsed = urlsplit(origin)
            return parsed.scheme in ('http', 'https') and local(parsed.netloc)
        except ValueError:
            return False
    return True


def stop(job, state):
    with LOCK:
        if job['state'] != 'running':
            return
        job['state'] = state
        job['log'] += '\n' + state + '\n'
        try:
            os.killpg(job['process'].pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        def force_stop():
            if job['process'].poll() is None:
                try:
                    os.killpg(job['process'].pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
        fallback = threading.Timer(3, force_stop)
        fallback.daemon = True
        fallback.start()


def collect(job):
    timer = threading.Timer(JOB_TIMEOUT_SECONDS, stop, args=(job, 'timed out'))
    timer.daemon = True
    timer.start()
    try:
        while True:
            chunk = job['process'].stdout.read(1024)
            if not chunk:
                break
            with LOCK:
                job['log'] = (job['log'] + chunk.decode('utf-8', errors='replace'))[-24000:]
        code = job['process'].wait()
        with LOCK:
            if job['state'] == 'running':
                job['state'] = 'completed' if code == 0 else 'failed'
            job['exit_code'] = code
    finally:
        timer.cancel()


class Handler(BaseHTTPRequestHandler):
    # Public loopback development endpoint, protected against remote browser origins.
    def send_json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def dispatch(self):
        if not local_request(self.headers.get('Host', ''), self.headers.get('Origin')):
            return self.send_json(403, {'error': 'Local requests only'})
        parsed = urlsplit(self.path)
        category = parsed.path.removeprefix('/api/checks/')
        if not parsed.path.startswith('/api/checks/') or category not in GROUPS:
            return self.send_json(404, {'error': 'Unknown check'})
        group = GROUPS[category]
        with LOCK:
            job = JOBS.get(group)
            if self.command == 'GET':
                try:
                    page = int(parse_qs(parsed.query).get('page', ['1'])[0])
                    if not 1 <= page <= 100000:
                        raise ValueError()
                except ValueError:
                    return self.send_json(400, {'error': 'Invalid page'})
                path = job['output'] / FILES[group] if job else SOURCE / FILES[group]
                try:
                    report = read_report(path, category, page)
                except (OSError, csv.Error, UnicodeError) as error:
                    print(f'Report read failed ({category}): {type(error).__name__}', file=sys.stderr)
                    return self.send_json(500, {'error': 'Could not read checker report'})
                return self.send_json(200, dict(report, state=job['state'] if job else 'saved report',
                    log=job['log'] if job else '', source=path.name, historical=job is None,
                    started_at=job['started_at'] if job else None))
            if self.command == 'DELETE':
                if job:
                    stop(job, 'cancelled')
                return self.send_json(200, {'state': job['state'] if job else 'idle'})
            if any(item['process'].poll() is None for item in JOBS.values()):
                return self.send_json(409, {'error': 'A scan is already running. Stop it before starting another.'})
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 2048:
                    raise ValueError('Invalid request size')
                limit, target = validate(category, json.loads(self.rfile.read(length)))
            except (ValueError, UnicodeError) as error:
                return self.send_json(400, {'error': str(error)})
            output = Path(tempfile.mkdtemp(prefix='netmon-check-'))
            try:
                args = command(group, limit, target, output)
                env = dict(os.environ, NO_COLOR='1', PYTHONDONTWRITEBYTECODE='1',
                           DISPLAY='', WAYLAND_DISPLAY='')
                process = subprocess.Popen(args, cwd=output, env=env, stdin=subprocess.DEVNULL,
                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, start_new_session=True, bufsize=0)
            except OSError as error:
                print(f'Checker start failed: {type(error).__name__}', file=sys.stderr)
                return self.send_json(503, {'error': 'Checker unavailable; verify source apps and Python installation'})
            job = {'state': 'running', 'process': process, 'output': output, 'log': '',
                   'started_at': datetime.now(timezone.utc).isoformat()}
            JOBS[group] = job
            threading.Thread(target=collect, args=(job,), daemon=True).start()
            return self.send_json(202, {'state': 'running'})

    do_GET = dispatch
    do_POST = dispatch
    do_DELETE = dispatch


if __name__ == '__main__':
    print('NetMon check bridge: http://127.0.0.1:3200', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 3200), Handler).serve_forever()
