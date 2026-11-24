import { cp, mkdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
await mkdir(new URL('dist/', root), { recursive: true });
for (const path of ['index.html', 'src', 'apps-catalog.json']) {
  await cp(new URL(path, root), new URL(`dist/${path}`, root), { recursive: true });
}
console.log('Standalone DPI frontend built in dist/');
