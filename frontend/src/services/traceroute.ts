export interface Hop {
  number: number;
  ip: string;
  hostname: string;
  rtt1: number | null;
  rtt2: number | null;
  rtt3: number | null;
  avg_rtt: number | null;
}

export async function traceRoute(target: string, signal: AbortSignal): Promise<{ hops: Hop[]; status: 'completed' | 'partial' }> {
  const base = (process.env.REACT_APP_API_URL || '/api/v1').replace(/\/$/, '');
  const response = await fetch(`${base}/tools/traceroute`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target }), signal,
  });
  if (!response.ok) {
    const data = await response.json().catch(error => {
      console.error('Traceroute API error response was not JSON:', error);
      return null;
    });
    throw new Error(data?.error || 'Traceroute API unavailable. Check the NetMon backend.');
  }
  const data = await response.json();
  if (!Array.isArray(data.hops) || !['completed', 'partial'].includes(data.status) ||
      !data.hops.every((hop: Hop) => hop && typeof hop.ip === 'string' &&
        ['rtt1', 'rtt2', 'rtt3', 'avg_rtt'].every(key => {
          const value = hop[key as keyof Hop];
          return value === null || (typeof value === 'number' && Number.isFinite(value));
        }))) {
    throw new Error('Traceroute API returned an invalid response.');
  }
  return data;
}
