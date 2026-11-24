import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { createApp } from '../scripts/serve.mjs';

async function fixture(python = 'python3') {
  const root = await mkdtemp(resolve(tmpdir(), 'dpi-execution-'));
  const backend = resolve(root, 'backend');
  const storage = resolve(root, 'runs');
  await mkdir(backend);
  // Stand-in implements the inspected backend contract; never runs network probes.
  await writeFile(resolve(backend, 'mother_app.py'), `import json, os, signal, subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parent
def load_catalog():
    return json.loads((ROOT / 'apps_catalog.json').read_text())['apps']
def preflight(app):
    return ['Missing input: fixture.json'] if app['file'] == 'unavailable.py' else []
def stop_group(proc):
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
    proc.wait()
`);
  const scripts = {
    'success.py': 'import json, sys\nprint(json.dumps(sys.argv[1:]))\n',
    'failure.py': 'import sys\nprint("expected fixture error", file=sys.stderr)\nsys.exit(7)\n',
    'sleep.py': 'import time\nprint("started", flush=True)\ntime.sleep(30)\n',
    'unavailable.py': 'raise RuntimeError("must not execute")\n',
    'large.py': 'print("A" * 100000)\n',
    'interactive.py': 'name = input("Enter your name: ")\nprint("Hello " + name, flush=True)\n',
    'arguments.py': 'import argparse\np = argparse.ArgumentParser()\np.add_argument("host")\np.add_argument("--port", required=True)\n',
  };
  for (const [name, content] of Object.entries(scripts)) await writeFile(resolve(backend, name), content);
  await writeFile(resolve(backend, 'apps_catalog.json'), JSON.stringify({ version: 1, apps: Object.keys(scripts).map(file => ({ file, description: file, kind: 'network probe', args: ['default'], runner: file === 'success.py' })) }));
  const app = await createApp({ backend, storage, python });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const call = async (path, method = 'GET', body, extra = {}) => {
    const response = await fetch(`${base}/api/${path}`, { method, headers: { 'Content-Type': 'application/json', 'X-DPI-Request': '1', ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json(), headers: response.headers };
  };
  const finish = async id => {
    for (let n = 0; n < 150; n++) {
      const result = await call(`runs/${id}`);
      if (!['running', 'cancelling'].includes(result.data.run.status)) { await delay(30); return result.data.run; }
      await delay(30);
    }
    throw new Error('Run did not finish');
  };
  const close = async () => { await app.jobs.shutdown(); app.server.closeAllConnections(); await new Promise(resolveDone => app.server.close(resolveDone)); };
  return { ...app, call, finish, close, base, backend, storage };
}

test('real worker executes exact app and preserves literal args; report persists and downloads', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.call('health')).data.ready, true);
    const args = ['literal ; $(echo nope)', 'with spaces', '日本語 example'];
    const created = await f.call('runs', 'POST', { file: 'success.py', args, timeout: 5 });
    assert.equal(created.status, 202);
    const run = await f.finish(created.data.run.id);
    assert.equal(run.file, 'success.py');
    assert.equal(run.status, 'completed');
    assert.equal(run.exit_code, 0);
    assert.deepEqual(JSON.parse(run.stdout), args);
    const download = await f.call(`runs/${run.id}/report`);
    assert.match(download.headers.get('content-disposition'), /attachment/);
    assert.equal(download.data.run.id, run.id);
    assert.equal(JSON.parse(await readFile(resolve(f.storage, `${run.id}.json`))).status, 'completed');
    const restarted = await createApp({ backend: f.backend, storage: f.storage, python: 'python3' });
    assert.equal(restarted.jobs.get(run.id).status, 'completed');
  } finally { await f.close(); }
});

test('failed exit, preflight reasons and bounded output are accurately reported', async () => {
  const f = await fixture();
  try {
    const failed = await f.call('runs', 'POST', { file: 'failure.py' });
    const result = await f.finish(failed.data.run.id);
    assert.equal(result.status, 'failed');
    assert.equal(result.exit_code, 7);
    assert.match(result.stderr, /expected fixture error/);
    const missing = await f.call('runs', 'POST', { file: 'unavailable.py' });
    const unavailable = await f.finish(missing.data.run.id);
    assert.equal(unavailable.status, 'unavailable');
    assert.match(unavailable.reasons[0], /Missing input/);
    const large = await f.call('runs', 'POST', { file: 'large.py' });
    const output = await f.finish(large.data.run.id);
    assert.equal(output.stdout.length, 32768);
    assert.equal(output.output_truncated.stdout, true);
  } finally { await f.close(); }
});

test('timeout, cancellation and one-active-job limit', async () => {
  const f = await fixture();
  try {
    const timed = await f.call('runs', 'POST', { file: 'sleep.py', timeout: 1 });
    assert.equal((await f.call('runs', 'POST', { file: 'success.py' })).status, 409);
    const timeout = await f.finish(timed.data.run.id);
    assert.equal(timeout.status, 'timeout');
    assert.match(timeout.stdout, /started/);
    const running = await f.call('runs', 'POST', { file: 'sleep.py', timeout: 30 });
    await delay(150);
    assert.equal((await f.call(`runs/${running.data.run.id}`, 'DELETE')).status, 200);
    assert.equal((await f.finish(running.data.run.id)).status, 'cancelled');
  } finally { await f.close(); }
});

test('reject unknown apps, traversal, bad args, timeouts, forged origins and oversized requests', async () => {
  const f = await fixture();
  try {
    for (const file of ['unknown.py', '../success.py', '/tmp/success.py']) assert.equal((await f.call('runs', 'POST', { file })).status, 404);
    for (const body of [{file:'success.py',timeout:0}, {file:'success.py',timeout:3601}, {file:'success.py',args:'x'}, {file:'success.py',args:[1]}, {file:'success.py',extra:true}]) assert.equal((await f.call('runs','POST',body)).status,400);
    assert.equal((await f.call('runs','POST',{file:'success.py'},{ Origin:'https://hostile.example' })).status,403);
    assert.equal((await f.call('runs','POST',{file:'success.py'},{ 'X-DPI-Request':'' })).status,403);
    // fetch/undici replaces Host; use raw HTTP to exercise DNS-rebinding defense.
    const forgedHost = await new Promise((resolveStatus, reject) => {
      const req = httpRequest(`${f.base}/api/apps`, { headers: { Host: 'hostile.example' } }, response => {
        response.resume(); resolveStatus(response.statusCode);
      });
      req.on('error', reject); req.end();
    });
    assert.equal(forgedHost, 403);
    assert.equal((await f.call('runs','POST',{file:'success.py',args:['x'.repeat(20000)]})).status,413);
    assert.equal((await f.call('runs/00000000-0000-0000-0000-000000000000')).status,404);
    assert.equal((await fetch(`${f.base}/scripts/worker.py`)).status,404);
  } finally { await f.close(); }
});

test('missing interpreter fails truthfully without marking a run complete', async () => {
  const f = await fixture('/nonexistent/dpi-python');
  try {
    assert.equal((await f.call('health')).status, 503);
    const accepted = await f.call('runs', 'POST', { file: 'success.py' });
    assert.equal(accepted.status, 202);
    const run = await f.finish(accepted.data.run.id);
    assert.equal(run.status, 'failed');
    assert.match(run.reasons[0], /Unable to start Python worker/);
  } finally { await f.close(); }
});

test('interactive apps publish prompt output before completion and accept browser replies', async () => {
  const f = await fixture();
  try {
    const accepted = await f.call('runs', 'POST', { file: 'interactive.py', timeout: 10 });
    const id = accepted.data.run.id;
    let live;
    for (let n = 0; n < 40; n++) {
      live = (await f.call(`runs/${id}`)).data.run;
      if (live.stdout.includes('Enter your name:')) break;
      await delay(40);
    }
    assert.equal(live.status, 'running');
    assert.match(live.stdout, /Enter your name:/);
    for (const body of [{ text: 'a\nb' }, { text: 1 }, { text: 'x'.repeat(4097) }, { text: 'ok', extra: true }]) {
      assert.equal((await f.call(`runs/${id}/inputs`, 'POST', body)).status, 400);
    }
    assert.equal((await f.call(`runs/${id}/inputs`, 'POST', { text: 'Alice' })).status, 200);
    const completed = await f.finish(id);
    assert.equal(completed.status, 'completed');
    assert.match(completed.stdout, /Hello Alice/);
    assert.equal((await f.call(`runs/${id}/inputs`, 'POST', { text: 'late' })).status, 409);
  } finally { await f.close(); }
});

test('readiness inspects every app without execution and exposes prompts/required arguments', async () => {
  const f = await fixture();
  try {
    const result = await f.call('readiness');
    assert.equal(result.status, 200);
    assert.equal(result.data.total, 7);
    assert.equal(result.data.apps.find(app => app.file === 'interactive.py').interactive, true);
    assert.equal(result.data.apps.find(app => app.file === 'unavailable.py').ready, false);
    const args = result.data.apps.find(app => app.file === 'arguments.py').arguments;
    assert.deepEqual(args, [{ names: ['host'], required: true }, { names: ['--port'], required: true }]);
    assert.equal((await f.call('runs')).data.runs.length, 0);
    const batch = await f.call('runs', 'POST', { file: 'success.py' });
    assert.equal(batch.data.run.timeout, 1800);
    assert.equal((await f.finish(batch.data.run.id)).status, 'completed');
    await writeFile(resolve(f.backend, 'large.py'), 'not valid Python @');
    const recheck = await f.call('readiness');
    assert.equal(recheck.status, 200);
    assert.equal(recheck.data.apps.find(app => app.file === 'large.py').ready, false);
  } finally { await f.close(); }
});

test('restart recovers interrupted metadata and ignores corrupt or mismatched reports', async () => {
  const f = await fixture();
  try {
    const id = '00000000-0000-0000-0000-000000000001';
    await writeFile(resolve(f.storage, `${id}.json`), JSON.stringify({ id, file: 'sleep.py', status: 'running', started_at: new Date().toISOString() }));
    await writeFile(resolve(f.storage, '00000000-0000-0000-0000-000000000002.json'), '{broken');
    await writeFile(resolve(f.storage, '00000000-0000-0000-0000-000000000003.json'), JSON.stringify({ id: '../../escape', status: 'running' }));
    const restarted = await createApp({ backend: f.backend, storage: f.storage, python: 'python3' });
    assert.equal(restarted.jobs.get(id).status, 'interrupted');
    assert.equal(restarted.jobs.list().length, 1);
    await writeFile(resolve(f.backend, 'apps_catalog.json'), '{broken');
    assert.equal((await f.call('apps')).status, 503);
    assert.equal((await f.call('runs', 'POST', { file: 'success.py' })).status, 503);
  } finally { await f.close(); }
});
