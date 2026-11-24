"""Execute one catalogued Python app and emit a bounded JSON report."""
import importlib.util
import ast
import codecs
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import threading
import time

sys.dont_write_bytecode = True


def emit(kind, data):
    print(json.dumps({'type': kind, 'data': data}, ensure_ascii=False), flush=True)


def scrub(text):
    text = re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]', '', text)
    text = re.sub(r'-----BEGIN [^-]*PRIVATE KEY-----.*?(?:-----END [^-]*PRIVATE KEY-----|$)',
                  '[REDACTED PRIVATE KEY]', text, flags=re.S)
    text = re.sub(r'(?i)(bearer\s+)[^\s"\']+', r'\1[REDACTED]', text)
    text = re.sub(r'(?i)((?:password|passwd|api[_-]?key|access[_-]?token|secret)\s*[=:]\s*)[^\s,;]+',
                  r'\1[REDACTED]', text)
    return re.sub(r'(\w+://)[^\s/@]+:[^\s/@]+@', r'\1[REDACTED]@', text)


def execute(request):
    root = Path(request['backend']).resolve()
    if request.get('pythonPath'):
        sys.path.insert(0, request['pythonPath'])
    if request.get('dataDir'):
        os.environ['NETMON_DATA_DIR'] = request['dataDir']
    sys.path.insert(0, str(root))
    spec = importlib.util.spec_from_file_location('dpi_mother_app', root / 'mother_app.py')
    mother = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mother)
    if request.get('mode') == 'readiness':
        rows = []
        for item in mother.load_catalog():
            reasons = mother.preflight(item)
            try:
                tree = ast.parse((root / item['file']).read_text(encoding='utf-8'))
            except (SyntaxError, OSError) as exc:
                print(f'App source inspection failed: {type(exc).__name__}', file=sys.stderr)
                reasons.append(f'Source cannot be inspected ({type(exc).__name__})')
                tree = ast.Module(body=[], type_ignores=[])
            arguments = []
            for node in ast.walk(tree):
                if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == 'add_argument':
                    names = [value.value for value in node.args if isinstance(value, ast.Constant) and isinstance(value.value, str)]
                    if names:
                        required = any(not value.startswith('-') for value in names) or any(k.arg == 'required' and isinstance(k.value, ast.Constant) and k.value.value is True for k in node.keywords)
                        arguments.append({'names': names, 'required': required})
            interactive = any(isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == 'input' for n in ast.walk(tree))
            rows.append({'file': item['file'], 'ready': not reasons, 'reasons': reasons, 'interactive': interactive, 'arguments': arguments})
        return {'apps': rows, 'ready': sum(row['ready'] for row in rows), 'total': len(rows), 'data_dir': os.environ.get('NETMON_DATA_DIR', str(root / 'data'))}
    app = next((dict(item) for item in mother.load_catalog() if item['file'] == request['file']), None)
    if app is None:
        return {'status': 'failed', 'reasons': ['Application is no longer in the backend catalog']}
    if 'args' in request:
        app['args'] = request['args']
    problems = mother.preflight(app)
    if problems:
        return {'status': 'unavailable', 'reasons': problems, 'stdout': '', 'stderr': ''}
    arguments = [value.replace('${APP_ROOT}', str(root)) for value in app.get('args', [])]
    env = dict(os.environ, PYTHONUNBUFFERED='1', PYTHONIOENCODING='utf-8', PYTHONDONTWRITEBYTECODE='1')
    env['PYTHONPATH'] = os.pathsep.join(filter(None, [str(root), request.get('pythonPath'), env.get('PYTHONPATH', '')]))
    output = {'stdout': '', 'stderr': ''}
    truncated = {'stdout': False, 'stderr': False}
    output_lock = threading.Lock()
    finished = threading.Event()

    def snapshot():
        with output_lock:
            return {'stdout': scrub(output['stdout']), 'stderr': scrub(output['stderr']), 'output_truncated': dict(truncated)}

    def drain(stream, key):
        try:
            decoder = codecs.getincrementaldecoder('utf-8')(errors='replace')
            while True:
                chunk = stream.read1(4096)
                if not chunk:
                    break
                with output_lock:
                    output[key] += decoder.decode(chunk)
                    if len(output[key]) > 32768:
                        truncated[key] = True
                        output[key] = output[key][-32768:]
        except OSError:
            print('Output reader closed during cleanup', file=sys.stderr)

    started = time.monotonic()
    proc = None
    status = 'failed'
    threads = []
    try:
        proc = subprocess.Popen([sys.executable, '-u', str(root / app['file']), *arguments],
                                cwd=(root / app['file']).parent, env=env,
                                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                start_new_session=True)
        for key, stream in [('stdout', proc.stdout), ('stderr', proc.stderr)]:
            thread = threading.Thread(target=drain, args=(stream, key), daemon=True)
            thread.start()
            threads.append(thread)

        def reply():
            try:
                for line in sys.stdin:
                    command = json.loads(line)
                    proc.stdin.write((command['text'] + '\n').encode('utf-8'))
                    proc.stdin.flush()
            except (BrokenPipeError, OSError, ValueError, KeyError):
                print('Interactive input pipe closed', file=sys.stderr)

        def progress():
            previous = None
            while not finished.wait(0.2):
                current = snapshot()
                if current != previous:
                    emit('progress', current)
                    previous = current

        threading.Thread(target=reply, daemon=True).start()
        reporter = threading.Thread(target=progress, daemon=True)
        reporter.start()
        try:
            proc.wait(timeout=request['timeout'])
            status = 'completed' if proc.returncode == 0 else 'failed'
        except subprocess.TimeoutExpired:
            status = 'timeout'
        except KeyboardInterrupt:
            status = 'cancelled'
    finally:
        if proc is not None:
            mother.stop_group(proc)
        for thread in threads:
            thread.join(timeout=2)
        finished.set()
        if 'reporter' in locals():
            reporter.join(timeout=1)
    return {'status': status, 'exit_code': proc.returncode,
            'duration_seconds': round(time.monotonic() - started, 3),
            **snapshot()}


def interrupted(signum, frame):
    raise KeyboardInterrupt


signal.signal(signal.SIGTERM, interrupted)
try:
    request = json.loads(sys.stdin.readline())
    result = execute(request)
except KeyboardInterrupt:
    result = {'status': 'cancelled'}
except Exception as exc:
    print(f'DPI worker failed: {type(exc).__name__}', file=sys.stderr)
    result = {'status': 'failed', 'reasons': [f'Worker error: {type(exc).__name__}']}
emit('result', result)
