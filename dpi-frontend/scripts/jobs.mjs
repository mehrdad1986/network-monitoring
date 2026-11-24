import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function createJobs({ backend, python, storage, dataDir, pythonPath }) {
  const worker = fileURLToPath(new URL('./worker.py', import.meta.url));
  await mkdir(storage, { recursive: true, mode: 0o700 });
  const jobs = new Map();
  let active = null;
  let creating = false;
  const save = async job => {
    const path = resolve(storage, `${job.id}.json`);
    await writeFile(`${path}.tmp`, JSON.stringify(job), { mode: 0o600 });
    await rename(`${path}.tmp`, path);
  };
  for (const name of await readdir(storage)) {
    if (!/^[a-f0-9-]{36}\.json$/.test(name)) continue;
    let job;
    try {
      job = JSON.parse(await readFile(resolve(storage, name), 'utf8'));
      if (job.id !== name.slice(0, -5) || typeof job.started_at !== 'string' || typeof job.file !== 'string') throw new Error('Invalid report metadata');
    } catch (error) {
      console.error('DPI saved report ignored:', name, error.code || error.name);
      continue;
    }
    if (['running', 'cancelling'].includes(job.status)) {
      Object.assign(job, { status: 'interrupted', finished_at: new Date().toISOString(), reasons: ['Server restarted before a final report was recorded'] });
      await save(job);
    }
    jobs.set(job.id, job);
  }
  async function catalog() {
    try {
      const data = JSON.parse(await readFile(resolve(backend, 'apps_catalog.json'), 'utf8'));
      if (!Array.isArray(data.apps) || data.apps.some(app => typeof app.file !== 'string' || !app.file.endsWith('.py') || app.file.split(/[\\/]/).includes('..'))) throw new Error('Invalid catalog');
      return data;
    } catch (error) {
      console.error('DPI catalog unavailable:', error.code || error.name);
      throw new ApiError(503, 'Backend catalog is unavailable. Check DPI_BACKEND_DIR.');
    }
  }
  const summarize = ({ stdout, stderr, ...job }) => job;
  async function readiness() {
    return new Promise((resolveCheck, reject) => {
      const child = spawn(python, [worker], { stdio: ['pipe', 'pipe', 'pipe'] });
      let output = '';
      let settled = false;
      const fail = message => {
        if (settled) return;
        settled = true;
        console.error('DPI readiness check failed');
        reject(new ApiError(503, message));
      };
      const timer = setTimeout(() => { child.kill('SIGTERM'); fail('Readiness check timed out'); }, 15000);
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', chunk => {
        output += chunk;
        if (output.length > 1024 * 1024) { child.kill('SIGTERM'); fail('Readiness report exceeded limit'); }
      });
      child.stderr.on('data', () => {});
      child.stdin.on('error', () => fail('Readiness worker input failed'));
      child.on('error', () => { clearTimeout(timer); fail('Python interpreter is unavailable'); });
      child.on('close', () => {
        clearTimeout(timer);
        if (settled) return;
        try {
          const event = JSON.parse(output);
          if (!Array.isArray(event.data?.apps)) throw new Error('Invalid readiness response');
          settled = true;
          resolveCheck(event.data);
        } catch (error) { console.error('DPI readiness report invalid:', error.name); fail('Unable to inspect backend applications'); }
      });
      child.stdin.end(JSON.stringify({ backend, dataDir, pythonPath, mode: 'readiness' }) + '\n');
    });
  }
  const get = id => {
    if (!jobs.has(id)) throw new ApiError(404, 'Run not found');
    return jobs.get(id);
  };
  async function start(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['file', 'args', 'timeout'].includes(key))) throw new ApiError(400, 'Expected file, optional arguments and timeout');
    let timeout = input.timeout ?? 300;
    if (typeof input.file !== 'string' || !Number.isFinite(timeout) || timeout < 1 || timeout > 3600) throw new ApiError(400, 'Select an application and a timeout between 1 and 3600 seconds');
    if ('args' in input && (!Array.isArray(input.args) || input.args.length > 64 || input.args.some(arg => typeof arg !== 'string' || arg.length > 1024 || arg.includes('\0')))) throw new ApiError(400, 'Arguments must be an array of at most 64 strings (1024 characters each)');
    if (active || creating) throw new ApiError(409, 'Another application is running. Wait or cancel it first.');
    creating = true;
    try {
      const { apps } = await catalog();
      const app = apps.find(app => app.file === input.file);
      if (!app) throw new ApiError(404, 'Application not found in backend catalog');
      if (input.timeout === undefined && app.runner) timeout = 1800;
      const job = { id: randomUUID(), file: input.file, status: 'running', started_at: new Date().toISOString(), timeout, stdout: '', stderr: '', note: 'Completed means exit code 0; inspect output to assess probe findings.' };
      await save(job);
      jobs.set(job.id, job);
      const child = spawn(python, [worker], { stdio: ['pipe', 'pipe', 'pipe'] });
      let output = '';
      let result = null;
      let failure = null;
      active = { id: job.id, child };
      const watchdog = setTimeout(() => child.kill('SIGTERM'), (timeout + 10) * 1000);
      const hardStop = setTimeout(() => child.kill('SIGKILL'), (timeout + 15) * 1000);
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', chunk => {
        output += chunk;
        let newline;
        while ((newline = output.indexOf('\n')) !== -1) {
          const line = output.slice(0, newline);
          output = output.slice(newline + 1);
          try {
            if (Buffer.byteLength(line) > 512 * 1024) throw new Error('Oversized worker event');
            const event = JSON.parse(line);
            if (event.type === 'result') result = event.data;
            else if (event.type === 'progress') {
              job.stdout = event.data.stdout;
              job.stderr = event.data.stderr;
              job.output_truncated = event.data.output_truncated;
            }
          } catch (error) {
            console.error('DPI worker event invalid:', job.id, error.name);
            failure = 'Worker returned an invalid event'; child.kill('SIGTERM');
          }
        }
        if (Buffer.byteLength(output) > 512 * 1024) { failure = 'Worker report exceeded output limit'; child.kill('SIGTERM'); }
      });
      child.stderr.on('data', () => { /* Script output is returned in the report, never echoed to server logs. */ });
      child.stdin.on('error', () => { console.error('DPI worker input pipe closed:', job.id); });
      child.on('error', error => { failure = `Unable to start Python worker (${error.code || error.name})`; console.error('DPI worker start failed:', job.id, error.code || error.name); });
      child.on('close', async () => {
        clearTimeout(watchdog); clearTimeout(hardStop);
        let finished;
        try {
          const final = failure ? { status: 'failed', reasons: [failure] } : result;
          if (!final || !['completed', 'failed', 'unavailable', 'timeout', 'cancelled'].includes(final.status)) throw new Error('Invalid status');
          finished = { ...job, ...final, finished_at: new Date().toISOString() };
        } catch (error) {
          console.error('DPI worker report failed:', job.id, error.name);
          finished = { ...job, status: job.status === 'cancelling' ? 'cancelled' : 'failed', reasons: ['Worker stopped without a valid report'], finished_at: new Date().toISOString() };
        }
        try { await save(finished); } catch (error) { console.error('DPI report persistence failed:', job.id, error.code || error.name); finished.persistence_error = 'Report could not be saved to disk'; }
        Object.assign(job, finished);
        if (['failed', 'unavailable', 'timeout'].includes(job.status)) console.error('DPI application ended:', job.id, job.status);
        if (active?.id === job.id) active = null;
      });
      child.stdin.write(JSON.stringify({ backend, dataDir, pythonPath, file: input.file, timeout, ...('args' in input ? { args: input.args } : {}) }) + '\n');
      return summarize(job);
    } finally { creating = false; }
  }
  return {
    catalog, readiness, start, get,
    async input(id, payload) {
      if (!payload || typeof payload.text !== 'string' || payload.text.length > 4096 || /[\r\n\0]/.test(payload.text) || Object.keys(payload).some(key => key !== 'text')) throw new ApiError(400, 'Reply must be one line of at most 4096 characters');
      const job = get(id);
      if (active?.id !== id || job.status !== 'running' || active.child.stdin.destroyed) throw new ApiError(409, 'This application is no longer accepting input');
      await new Promise((resolveWrite, reject) => active.child.stdin.write(JSON.stringify({ text: payload.text }) + '\n', error => {
        if (error) { console.error('DPI prompt input failed:', id, error.code || error.name); reject(new ApiError(409, 'Application input pipe closed')); }
        else resolveWrite();
      }));
      return { accepted: true };
    },
    list: () => [...jobs.values()].sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 100).map(summarize),
    cancel(id) {
      const job = get(id);
      if (active?.id === id && job.status === 'running') {
        job.status = 'cancelling';
        active.child.kill('SIGTERM');
        const child = active.child;
        const timer = setTimeout(() => child.kill('SIGKILL'), 4000);
        child.once('close', () => clearTimeout(timer));
      }
      return summarize(job);
    },
    async shutdown() {
      if (!active) return;
      const child = active.child;
      const done = new Promise(resolveDone => child.once('close', resolveDone));
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 4000);
      await done;
      clearTimeout(timer);
    },
  };
}
