import { readFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isIP } from 'node:net';
import { createHash } from 'node:crypto';

const ipv4 = value => typeof value === 'string' && isIP(value) === 4;

// Convert observed route records only; never infer a destination from the last hop.
export function observedRoutes(data) {
  const routes = [];
  for (const [target, hops] of Object.entries(data.dns_servers?.routes || {})) {
    if (!ipv4(target) || !Array.isArray(hops)) continue;
    const observed = hops.filter(hop => hop && ipv4(hop.ip));
    if (observed.length) routes.push({ target, hops: observed.map(hop => ({ hop: hop.hop, ip: hop.ip })) });
  }
  for (const row of Object.values(data.websites?.routes || {})) {
    if (!row || !ipv4(row.ip) || !Array.isArray(row.hops)) continue;
    const observed = row.hops.filter(hop => hop && ipv4(hop.ip));
    if (observed.length) routes.push({ target: row.ip, hops: observed.map(hop => ({ hop: hop.hop, ip: hop.ip })) });
  }
  return routes;
}

export async function prepareSavedData(backend, storage) {
  if (process.env.NETMON_DATA_DIR) return { directory: resolve(process.env.NETMON_DATA_DIR), source: 'NETMON_DATA_DIR' };
  const existing = resolve(backend, 'data');
  try { if ((await stat(existing)).isDirectory()) return { directory: existing, source: 'Existing backend data directory' }; }
  catch (error) { if (error.code !== 'ENOENT') console.error('Saved data directory check failed:', error.code || error.name); }
  const source = resolve(backend, 'bgp_route_analysis.json');
  try {
    const content = await readFile(source, 'utf8');
    const data = JSON.parse(content);
    const routes = observedRoutes(data);
    if (!routes.length) return null;
    const directory = resolve(storage, 'traceroute-data', createHash('sha256').update(content).digest('hex').slice(0, 16));
    await mkdir(directory, { recursive: true, mode: 0o700 });
    for (const [index, row] of routes.entries()) {
      const lines = [`Saved traceroute to ${row.target}`, ...row.hops.map(hop => `${Number.isInteger(hop.hop) ? hop.hop : '?'} ${hop.ip}`)];
      await writeFile(resolve(directory, `route-${String(index).padStart(4, '0')}.txt`), lines.join('\n') + '\n', { mode: 0o600 });
    }
    const provenance = { source, source_modified_at: (await stat(source)).mtime.toISOString(), routes: routes.length, note: 'Derived from saved observations; not a new live measurement' };
    await writeFile(resolve(directory, 'provenance.json'), JSON.stringify(provenance, null, 2), { mode: 0o600 });
    return { directory, source: provenance.note, observations: routes.length, source_file: source };
  } catch (error) {
    console.error('Saved route import unavailable:', error.code || error.name);
    return null;
  }
}
