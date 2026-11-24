import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';
import { ApiError, createJobs } from './jobs.mjs';
import { prepareSavedData } from './saved-data.mjs';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const allowed = new Set(['/index.html', '/src/app.js', '/src/catalog.js', '/src/launch-config.js', '/src/api.js', '/src/styles.css', '/apps-catalog.json']);

function interpreterAvailable(python) {
  return new Promise(resolveReady => {
    const child = spawn(python, ['--version'], { stdio: 'ignore' });
    const timer = setTimeout(() => { child.kill(); resolveReady(false); }, 3000);
    child.on('error', () => { clearTimeout(timer); resolveReady(false); });
    child.on('close', code => { clearTimeout(timer); resolveReady(code === 0); });
  });
}

export async function createApp(options = {}) {
  const backend = resolve(options.backend || process.env.DPI_BACKEND_DIR || resolve(root, '..', 'integrations', 'dpi-apps'));
  const python = options.python || process.env.DPI_PYTHON || 'python3';
  const storage = options.storage || resolve(root, '.runs');
  const savedData = await prepareSavedData(backend, storage);
  let pythonPath;
  try { await access(resolve(root, '.python-deps/httpx/__init__.py')); pythonPath = resolve(root, '.python-deps'); }
  catch (error) { if (error.code !== 'ENOENT') console.error('Private Python dependency check failed:', error.code || error.name); }
  const jobs = await createJobs({ backend, python, storage, dataDir: savedData?.directory, pythonPath });
  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
    res.end(JSON.stringify(body));
  };
  const readBody = async req => {
    if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw new ApiError(415, 'Expected application/json');
    let body = '';
    req.setEncoding('utf8');
    for await (const chunk of req) {
      body += chunk;
      if (Buffer.byteLength(body) > 16384) throw new ApiError(413, 'Request body is too large');
    }
    try { return JSON.parse(body); }
    catch { console.error('DPI request validation: invalid JSON'); throw new ApiError(400, 'Invalid JSON'); }
  };
  const server = createServer(async (req, res) => {
  try {
    const port = server.address().port;
    const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    if (!hosts.includes(req.headers.host)) throw new ApiError(403, 'Invalid request host');
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) throw new ApiError(403, 'Cross-origin requests are not allowed');
    if (req.headers['sec-fetch-site'] === 'cross-site') throw new ApiError(403, 'Cross-site requests are not allowed');
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname.startsWith('/api/')) {
      if (!['GET', 'POST', 'DELETE'].includes(req.method)) throw new ApiError(405, 'Method not allowed');
      if (req.method !== 'GET' && req.headers['x-dpi-request'] !== '1') throw new ApiError(403, 'Missing local application request header');
      if (req.method === 'GET' && pathname === '/api/health') {
        const catalog = await jobs.catalog();
        try { await access(resolve(backend, 'mother_app.py')); }
        catch (error) { console.error('DPI runner unavailable:', error.code || error.name); throw new ApiError(503, 'Backend runner is unavailable. Check DPI_BACKEND_DIR.'); }
        const ready = await interpreterAvailable(python);
        return send(res, ready ? 200 : 503, { ready, applications: catalog.apps.length, interpreter: python, saved_data: savedData, message: ready ? 'Python backend connected' : 'Python interpreter unavailable. Set DPI_PYTHON.' });
      }
      if (req.method === 'GET' && pathname === '/api/apps') return send(res, 200, await jobs.catalog());
      if (req.method === 'GET' && pathname === '/api/readiness') return send(res, 200, await jobs.readiness());
      if (pathname === '/api/runs') {
        if (req.method === 'GET') return send(res, 200, { runs: jobs.list() });
        if (req.method === 'POST') {
          return send(res, 202, { run: await jobs.start(await readBody(req)) });
        }
      }
      const inputMatch = pathname.match(/^\/api\/runs\/([a-f0-9-]{36})\/inputs$/);
      if (inputMatch && req.method === 'POST') return send(res, 200, await jobs.input(inputMatch[1], await readBody(req)));
      const match = pathname.match(/^\/api\/runs\/([a-f0-9-]{36})(\/report)?$/);
      if (match && req.method === 'GET') {
        const job = jobs.get(match[1]);
        return send(res, 200, { run: job }, match[2] ? { 'Content-Disposition': `attachment; filename="dpi-report-${job.id}.json"` } : {});
      }
      if (match && !match[2] && req.method === 'DELETE') return send(res, 200, { run: jobs.cancel(match[1]) });
      throw new ApiError(404, 'API resource not found');
    }
    if (!['GET', 'HEAD'].includes(req.method)) throw new ApiError(405, 'Method not allowed');
    const path = pathname === '/' ? '/index.html' : pathname;
    const file = resolve(root, `.${path}`);
    if (!file.startsWith(root + sep) || !allowed.has(path)) throw new ApiError(404, 'Not found');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': `${types[extname(file)]}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (error) {
    console.error('DPI request failed:', error.status || 500, error.name);
    if (!res.headersSent) send(res, error.status || 500, { error: { message: error.status ? error.message : 'Internal server error; check server logs' } });
    else res.end();
  }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return { server, jobs };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server, jobs } = await createApp();
  server.on('error', error => { console.error('Frontend server failed:', error.code || error.name); process.exitCode = 1; });
  server.listen(Number(process.env.PORT || 3100), '127.0.0.1', () => console.log(`DPI Apps: http://127.0.0.1:${server.address().port}`));
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    server.close();
    await jobs.shutdown();
    server.closeAllConnections();
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
