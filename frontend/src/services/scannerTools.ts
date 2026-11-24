const apiBase = (process.env.REACT_APP_API_URL || '/api/v1').replace(/\/$/, '');

async function postScanner<T>(path: string, body: unknown, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${apiBase}/tools/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Scanner failed (HTTP ${response.status})`);
  if (!data || typeof data !== 'object') throw new Error('Scanner returned an invalid result');
  return data as T;
}

export type AkamaiScanResult = { ip: string; open: boolean; latency_ms: number; status: string };
export type CdnXrayResult = { ip: string; success: boolean; latency_ms?: number; error?: string };
export const scanAkamaiIPs = (ips: string[], signal: AbortSignal) => postScanner<{ results: AkamaiScanResult[] }>('akamai-ip-scan', { ips }, signal);
export const scanCdnXrayIP = (ip: string, config: string, signal: AbortSignal) => postScanner<CdnXrayResult>('cdn-xray-scan', { ip, config }, signal);

export async function resolveScannerIPv4(hostname: string, signal: AbortSignal): Promise<string[]> {
  const data = await postScanner<{ servers: { result?: string; error?: string }[] }>('dns-propagation', { input: hostname }, signal);
  if (!Array.isArray(data.servers)) throw new Error('DNS discovery returned an invalid response');
  const answers = data.servers.flatMap(server => server.error || !server.result || server.result === 'Unavailable' ? [] : server.result.split(/[,\s]+/));
  const ipv4 = answers.filter(value => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value) && value.split('.').every(part => Number(part) <= 255));
  return [...new Set(ipv4)];
}
