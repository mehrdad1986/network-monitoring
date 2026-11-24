import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { filterApps, appName, categoryLabels } from '../src/catalog.js';
const { apps } = JSON.parse(await readFile(new URL('../apps-catalog.json', import.meta.url)));
test('catalog includes every app with a distinct path and a supported category', () => {
  assert.equal(apps.length, 103);
  assert.equal(new Set(apps.map(app => app.file)).size, apps.length);
  assert.ok(apps.every(app => categoryLabels[app.kind]));
  assert.equal(filterApps(apps, 'all', '').length, 103);
});
test('search matches paths case-insensitively and composes with categories', () => {
  const result = filterApps(apps, 'all', '  DAILY_TESTS/  ');
  assert.ok(result.length > 0);
  assert.ok(result.every(app => app.file.includes('daily_tests/')));
  const probes = filterApps(apps, 'network probe', 'dns');
  assert.ok(probes.length > 0);
  assert.ok(probes.every(app => app.kind === 'network probe'));
});
test('empty results and same-named scripts in different directories remain distinct', () => {
  assert.deepEqual(filterApps(apps, 'all', 'nonexistent-application-123'), []);
  assert.deepEqual(filterApps([], 'all', ''), []);
  const duplicates = apps.filter(app => app.file.endsWith('dns_poisoning_detector.py'));
  assert.ok(duplicates.length >= 2);
  assert.equal(appName(duplicates[0]), 'dns poisoning detector');
});
