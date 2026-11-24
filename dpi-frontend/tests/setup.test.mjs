import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { launchArguments, launchFields } from '../src/launch-config.js';
import { observedRoutes, prepareSavedData } from '../scripts/saved-data.mjs';

test('app forms produce positional and flag arguments without a shell', () => {
  assert.deepEqual(launchArguments('dropshape.py', { host: 'example.com', ip: '192.0.2.1' }), ['example.com', '192.0.2.1']);
  assert.deepEqual(launchArguments('fake_rst.py', { src_ip: '192.0.2.1', src_port: '1', dst_ip: '192.0.2.2', dst_port: '65535', seq: '0' }), ['192.0.2.1', '1', '192.0.2.2', '65535', '0']);
  assert.deepEqual(launchArguments('extract_azix.py', { 'data-dir': '/saved traces', output: '/reports/output.txt' }), ['--data-dir', '/saved traces', '--output', '/reports/output.txt']);
  assert.equal(launchArguments('analyze_paths.py', {}), undefined);
  assert.equal(launchFields('unknown.py'), null);
  assert.ok(launchFields('make_xray.py').some(field => field.kind === 'uuid' && field.required));
});

test('forms reject absent targets and invalid connection boundaries', () => {
  assert.throws(() => launchArguments('dropshape.py', {}), /required/);
  assert.throws(() => launchArguments('dropshape.py', { host: 'example.com', ip: '999.1.1.1' }), /IPv4/);
  const input = { src_ip: '192.0.2.1', src_port: '65536', dst_ip: '192.0.2.2', dst_port: '443', seq: '0' };
  assert.throws(() => launchArguments('spoof_rst.py', input), /out of range/);
  assert.throws(() => launchArguments('spoof_rst.py', { ...input, src_port: '80', seq: '4294967296' }), /out of range/);
  assert.throws(() => launchArguments('make_xray.py', { host: 'example.com', uuid: 'invalid' }), /UUID/);
});

test('saved route importer accepts observed IPv4 hops and rejects inferred/malformed records', () => {
  const data = { dns_servers: { routes: { '192.0.2.1': [{ hop: 1, ip: '85.132.90.153' }, { error: 'timeout' }, { hop: 2, ip: '999.1.1.1' }], 'not-an-ip': [{ ip: '192.0.2.2' }] } }, websites: { routes: { 'example.com': { ip: null, hops: [{ ip: '192.0.2.2' }] } } } };
  assert.deepEqual(observedRoutes(data), [{ target: '192.0.2.1', hops: [{ hop: 1, ip: '85.132.90.153' }] }]);
  assert.deepEqual(observedRoutes({}), []);
});

test('derived data keeps provenance and uses a new directory when source changes', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'dpi-data-'));
  const backend = resolve(root, 'backend');
  await mkdir(backend);
  const source = resolve(backend, 'bgp_route_analysis.json');
  await writeFile(source, JSON.stringify({ dns_servers: { routes: { '192.0.2.1': [{ hop: 1, ip: '85.132.90.153' }] } } }));
  const first = await prepareSavedData(backend, resolve(root, 'storage'));
  assert.equal(first.observations, 1);
  const files = (await readdir(first.directory)).filter(name => name.endsWith('.txt'));
  assert.equal(files.length, 1);
  assert.match(await readFile(resolve(first.directory, files[0]), 'utf8'), /^Saved traceroute to 192\.0\.2\.1\n1 85\.132\.90\.153\n$/);
  assert.equal(JSON.parse(await readFile(resolve(first.directory, 'provenance.json'))).source, source);
  await writeFile(source, JSON.stringify({ dns_servers: { routes: { '192.0.2.2': [{ hop: 1, ip: '85.132.91.153' }] } } }));
  const second = await prepareSavedData(backend, resolve(root, 'storage'));
  assert.notEqual(second.directory, first.directory);
});
