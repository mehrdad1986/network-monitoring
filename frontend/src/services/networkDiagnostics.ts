import { traceRoute } from './traceroute';
const apiBase = (process.env.REACT_APP_API_URL || '/api/v1').replace(/\/$/, '');

export async function runTargetDiagnostic(tool: string, target: string, signal: AbortSignal) {
  if (tool === 'traceroute') {
    return traceRoute(target, signal);
  }
  if (tool === 'ping') {
    const response = await fetch(`${apiBase}/tools/ping`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, count: 4 }), signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) throw new Error(data?.error || `Ping failed (HTTP ${response.status})`);
    return data;
  }
  return runNetworkTool(tool, target, signal);
}

export async function runNetworkTool(tool: string, input: string, signal: AbortSignal) {
  const response = await fetch(`${apiBase}/tools/${tool}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: input.trim() }), signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Diagnostic failed (HTTP ${response.status})`);
  if (!data || typeof data !== 'object') throw new Error('The diagnostic returned an invalid result');
  return data;
}

export interface SpeedMeasurement {
  downloadSpeed: number;
  uploadSpeed: number;
  jitter: number;
  publicIP: string;
  location: string;
  isp: string;
}

// HowFastly provides CORS-enabled, uncached byte transfers on Fastly Compute.
const edge = 'https://speed.edgecompute.app';
export function transferMbps(bytes: number, milliseconds: number) {
  if (!Number.isFinite(bytes) || bytes <= 0 || !Number.isFinite(milliseconds) || milliseconds <= 0) {
    throw new Error('Insufficient transfer data to measure speed');
  }
  return bytes * 8 / milliseconds / 1000;
}

async function speedRequest(path: string, signal: AbortSignal, body?: Blob) {
  const response = await fetch(`${edge}${path}`, {
    method: body ? 'POST' : 'GET', body, signal, cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Remote measurement failed (HTTP ${response.status})`);
  return response;
}

async function measureTransfer(direction: 'download' | 'upload', signal: AbortSignal) {
  let size = 1024 * 1024;
  let bytes = 0;
  let elapsed = 0;
  // Adaptive sizes avoid reporting a tiny, latency-dominated transfer as line speed.
  // At most five requests and 79 MiB per direction; overall caller deadline is 90s.
  for (let round = 0; round < 5 && elapsed < 5000; round++) {
    let body: Blob | undefined;
    if (direction === 'upload') {
      const payload = new Uint8Array(size);
      for (let offset = 0; offset < size; offset += 65536) {
        crypto.getRandomValues(payload.subarray(offset, Math.min(offset + 65536, size)));
      }
      body = new Blob([payload]);
    }
    const start = performance.now();
    const response = await speedRequest(direction === 'download' ? `/down?bytes=${size}&r=${Date.now()}-${round}` : '/up', signal, body);
    const received = await response.arrayBuffer();
    const duration = performance.now() - start;
    if (direction === 'upload' && Number(new TextDecoder().decode(received)) !== size) throw new Error('Upload was not fully received; measurement discarded');
    if (direction === 'download' && received.byteLength !== size) throw new Error('Incomplete download; measurement discarded');
    bytes += direction === 'download' ? received.byteLength : size;
    elapsed += duration;
    size = Math.min(size * 4, 32 * 1024 * 1024);
  }
  return transferMbps(bytes, elapsed);
}

export async function measureInternetSpeed(signal: AbortSignal, onStage: (stage: string) => void): Promise<SpeedMeasurement> {
  onStage('Measuring HTTP latency variation…');
  const latency: number[] = [];
  for (let n = 0; n < 6; n++) {
    const start = performance.now();
    const response = await speedRequest(`/down?bytes=0&r=${Date.now()}-${n}`, signal);
    await response.arrayBuffer();
    if (n > 0) latency.push(performance.now() - start); // discard connection warm-up
  }
  const jitter = latency.slice(1).reduce((sum, sample, i) => sum + Math.abs(sample - latency[i]), 0) / (latency.length - 1);
  onStage('Measuring download to this browser…');
  const downloadSpeed = await measureTransfer('download', signal);
  onStage('Measuring upload from this browser…');
  const uploadSpeed = await measureTransfer('upload', signal);
  let publicIP = 'Unavailable';
  let location = 'Unavailable';
  let isp = 'Unavailable';
  try {
    const response = await speedRequest('/meta', signal);
    const metadata = await response.json();
    publicIP = typeof metadata.ip === 'string' ? metadata.ip : 'Unavailable';
    location = [metadata.city, metadata.country].filter(value => typeof value === 'string').join(', ') || 'Unavailable';
    isp = typeof metadata.org === 'string' ? metadata.org : 'Unavailable';
  } catch (error) {
    if (signal.aborted) throw error;
    console.warn('Speed test public IP lookup unavailable', error);
  }
  return { downloadSpeed, uploadSpeed, jitter, publicIP, location, isp };
}
