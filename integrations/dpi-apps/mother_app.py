#!/usr/bin/env python3
"""Run the catalogued backend applications sequentially in isolated processes."""
import argparse
import ast
from collections import Counter
from datetime import datetime, timezone
import fnmatch
import importlib.util
import json
import math
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent
CATALOG = ROOT / 'apps_catalog.json'


def load_catalog(path=CATALOG):
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    apps = data['apps']
    seen = set()
    for app in apps:
        name = app['file']
        target = (ROOT / name).resolve()
        if name in seen or not target.is_relative_to(ROOT) or target.suffix != '.py':
            raise ValueError(f'Invalid or duplicate catalog entry: {name}')
        seen.add(name)
    return apps


def preflight(app):
    """Check code and declared requirements without importing application code."""
    problems = []
    path = ROOT / app['file']
    try:
        tree = ast.parse(path.read_text(encoding='utf-8'), filename=str(path))
        compile(tree, str(path), 'exec')
    except (OSError, SyntaxError, ValueError) as exc:
        return [f'{type(exc).__name__}: {exc}']
    modules = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules.update(alias.name.split('.')[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and not node.level:
            modules.add(node.module.split('.')[0])
    for module in sorted(modules):
        if module in sys.stdlib_module_names:
            continue
        if any((folder / f'{module}.py').exists() or (folder / module / '__init__.py').exists()
               for folder in (path.parent, ROOT)):
            continue
        try:
            found = importlib.util.find_spec(module)
        except (ImportError, ValueError):
            found = None
        if found is None:
            problems.append(f'Missing Python module: {module}')
    import shutil
    for binary in app.get('binaries', []):
        if shutil.which(binary) is None:
            problems.append(f'Missing executable: {binary}')
    for value in app.get('inputs', []):
        expanded = os.path.expandvars(value)
        if value == '$DPI_XRAY_CONFIG':
            expanded = os.environ.get('DPI_XRAY_CONFIG', str(ROOT / 'xray_config.json'))
        elif value == '$NETMON_DATA_DIR':
            expanded = os.environ.get('NETMON_DATA_DIR', str(ROOT / 'data'))
            arguments = app.get('args', [])
            if '--data-dir' in arguments:
                index = arguments.index('--data-dir')
                if index + 1 < len(arguments):
                    expanded = arguments[index + 1]
        input_path = Path(expanded)
        if not input_path.is_absolute():
            input_path = ROOT / input_path
        if not input_path.exists():
            problems.append(f'Missing input: {input_path}')
    if app.get('privileged') and hasattr(os, 'geteuid') and os.geteuid() != 0:
        capable = False
        try:
            status = Path('/proc/self/status').read_text()
            effective = next(line.split()[1] for line in status.splitlines() if line.startswith('CapEff:'))
            capable = bool(int(effective, 16) & (1 << 13))  # Linux CAP_NET_RAW
        except (OSError, StopIteration, ValueError):
            pass
        if not capable:
            problems.append('Packet capture/injection requires root or CAP_NET_RAW')
    interface = os.environ.get('DPI_INTERFACE')
    if app.get('privileged') and interface and hasattr(__import__('socket'), 'if_nameindex'):
        import socket
        if interface not in {name for _, name in socket.if_nameindex()}:
            problems.append(f'Unknown network interface: {interface}')
    if app.get('requires_args') and not app.get('args'):
        problems.append('Arguments required; supply args for this app in --config')
    if app.get('incomplete'):
        problems.append(app['incomplete'])
    return problems


def stop_group(proc):
    """Reap the child and terminate descendants, including after a leader exits."""
    if os.name == 'posix':
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            proc.wait(timeout=1)
        except subprocess.TimeoutExpired:
            pass
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    elif proc.poll() is None:
        subprocess.run(['taskkill', '/PID', str(proc.pid), '/T', '/F'],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    proc.wait()


def run_one(app, output, timeout):
    row = {'file': app['file'], 'status': 'running', 'started_at': datetime.now(timezone.utc).isoformat()}
    problems = preflight(app)
    if problems:
        return dict(row, status='unavailable', reasons=problems)
    arguments = [value.replace('${APP_ROOT}', str(ROOT)) for value in app.get('args', [])]
    command = [sys.executable, '-u', str(ROOT / app['file']), *arguments]
    row['command'] = command[:3]
    row['argument_count'] = len(command) - 3
    stem = app['file'].replace('/', '__').removesuffix('.py')
    start = time.monotonic()
    proc = None
    stdout_path, stderr_path = output / f'{stem}.stdout.log', output / f'{stem}.stderr.log'
    row.update(stdout=str(stdout_path), stderr=str(stderr_path))
    env = dict(os.environ, PYTHONUNBUFFERED='1', PYTHONIOENCODING='utf-8')
    env['PYTHONPATH'] = os.pathsep.join(filter(None, [str(ROOT), env.get('PYTHONPATH', '')]))
    try:
        with stdout_path.open('w', encoding='utf-8') as stdout, stderr_path.open('w', encoding='utf-8') as stderr:
            proc = subprocess.Popen(command, cwd=(ROOT / app['file']).parent, env=env,
                                    stdin=subprocess.DEVNULL, stdout=stdout, stderr=stderr,
                                    start_new_session=(os.name == 'posix'))
            try:
                proc.wait(timeout=app.get('timeout', timeout))
                row['exit_code'] = proc.returncode
                row['status'] = 'completed' if proc.returncode == 0 else 'failed'
            except subprocess.TimeoutExpired:
                row['status'] = 'timeout'
            except KeyboardInterrupt:
                row['status'] = 'interrupted'
            finally:
                stop_group(proc)
    except OSError as exc:
        row.update(status='failed', error=f'{type(exc).__name__}: {exc}')
    row['duration_seconds'] = round(time.monotonic() - start, 3)
    return row


def write_summary(path, report):
    report['counts'] = dict(Counter(row['status'] for row in report['results']))
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    tmp.replace(path)


def positive_number(value):
    number = float(value)
    if not math.isfinite(number) or number <= 0:
        raise argparse.ArgumentTypeError('must be a finite positive number')
    return number


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--list', action='store_true', help='list all original 103 applications')
    mode.add_argument('--check', action='store_true', help='check syntax, dependencies and inputs without running probes')
    mode.add_argument('--run', action='store_true', help='run sequentially (the default)')
    parser.add_argument('--only', action='append', metavar='GLOB', help='select relative paths; repeat to select more')
    parser.add_argument('--timeout', type=positive_number, default=300, help='seconds per app (default: 300)')
    parser.add_argument('--include-special', action='store_true', help='include monitors, certificate generator, and utilities')
    parser.add_argument('--config', type=Path, help='JSON object keyed by app path, with args/timeout/enabled overrides')
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'reports' / 'mother', help='parent folder for unique run directories')
    args = parser.parse_args(argv)
    try:
        apps = load_catalog()
        if args.config:
            overrides = json.loads(args.config.read_text(encoding='utf-8'))
            if not isinstance(overrides, dict) or set(overrides) - {a['file'] for a in apps}:
                raise ValueError('Config must map known application paths to overrides')
            for app in apps:
                override = overrides.get(app['file'], {})
                if not isinstance(override, dict) or set(override) - {'args', 'timeout', 'enabled'}:
                    raise ValueError(f'Invalid config fields for {app["file"]}')
                if 'args' in override and (not isinstance(override['args'], list) or not all(isinstance(x, str) for x in override['args'])):
                    raise ValueError('args must be a list of strings')
                if 'timeout' in override:
                    override['timeout'] = positive_number(override['timeout'])
                if 'enabled' in override and not isinstance(override['enabled'], bool):
                    raise ValueError('enabled must be true or false')
                app.update(override)
        if args.only:
            for pattern in args.only:
                if not any(fnmatch.fnmatchcase(a['file'], pattern) for a in apps):
                    raise ValueError(f'No application matches: {pattern}')
            apps = [a for a in apps if any(fnmatch.fnmatchcase(a['file'], p) for p in args.only)]
    except (OSError, ValueError, KeyError, TypeError, argparse.ArgumentTypeError) as exc:
        parser.error(str(exc))
    if args.list:
        for index, app in enumerate(apps, 1):
            print(f'{index:3}. {app["file"]} [{app["kind"]}] — {app["description"]}')
        print(f'\n{len(apps)} applications')
        return 0
    args.output_dir.mkdir(parents=True, exist_ok=True)
    import tempfile
    output = Path(tempfile.mkdtemp(prefix=datetime.now().strftime('%Y%m%d_%H%M%S_'), dir=args.output_dir))
    report = {'mode': 'check' if args.check else 'run', 'python': sys.executable,
              'started_at': datetime.now(timezone.utc).isoformat(), 'results': [],
              'note': 'completed means exit code 0, not that network access or censorship conclusions were validated'}
    summary = output / 'summary.json'
    interrupted = False
    for index, app in enumerate(apps, 1):
        if args.check:
            problems = preflight(app)
            row = {'file': app['file'], 'status': 'unavailable' if problems else 'ready', 'reasons': problems}
        elif app.get('runner'):
            row = {'file': app['file'], 'status': 'skipped', 'reason': 'Nested batch runner; its child apps are already catalogued'}
        elif app.get('enabled') is False:
            row = {'file': app['file'], 'status': 'skipped', 'reason': 'Disabled in config'}
        elif app.get('special') and not (args.include_special or args.only or app.get('enabled') is True):
            row = {'file': app['file'], 'status': 'skipped', 'reason': app['special']}
        else:
            print(f'[{index}/{len(apps)}] Running {app["file"]}', flush=True)
            try:
                row = run_one(app, output, args.timeout)
            except KeyboardInterrupt:
                row = {'file': app['file'], 'status': 'interrupted'}
        report['results'].append(row)
        write_summary(summary, report)
        print(f'[{index}/{len(apps)}] {row["status"]}: {app["file"]}', flush=True)
        for reason in row.get('reasons', []):
            print(f'  {reason}', flush=True)
        if row['status'] == 'interrupted':
            interrupted = True
            break
    report['finished_at'] = datetime.now(timezone.utc).isoformat()
    if interrupted:
        processed = {r['file'] for r in report['results']}
        report['results'].extend({'file': a['file'], 'status': 'not_run'} for a in apps if a['file'] not in processed)
    write_summary(summary, report)
    print(f'\nCounts: {report["counts"]}\nSummary: {summary}')
    if interrupted:
        return 130
    return 1 if any(r['status'] in {'failed', 'timeout', 'unavailable'} for r in report['results']) else 0


if __name__ == '__main__':
    sys.exit(main())
