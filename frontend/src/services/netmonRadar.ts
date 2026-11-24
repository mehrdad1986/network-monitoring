const apiBase = (process.env.REACT_APP_API_URL || '/api/v1').replace(/\/$/, '');
export type RadarSource = { id: string; name: string };
export type RadarResult = { ip: string; port: number; latency_ms: number; status: string };
export type RadarStatus = { id: string; state: 'preparing' | 'scanning' | 'verifying' | 'complete' | 'failed' | 'stopped'; phase: string; total: number; completed: number; alive: number; dead: number; current_ip?: string; current_port?: number; current_source?: string; candidates: string[] | null; error?: string; results: RadarResult[] | null; updated_at: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}/tools/netmon-radar${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `NetMon Radar failed (HTTP ${response.status})`);
  return data as T;
}

export const radarSources = () => request<{ sources: RadarSource[] }>('/sources');
export const getActiveRadarScan = async () => (await request<{ job: RadarStatus | null }>('/active')).job;
export const startRadarScan = (target: string, sources: string[], ports: number[], sample: number) => request<{ id: string; attached?: boolean }>('/start', { method: 'POST', body: JSON.stringify({ target, sources, ports, sample }) });
export const getRadarStatus = (id: string) => request<RadarStatus>(`/${encodeURIComponent(id)}`);
export const stopRadarScan = (id: string) => request<{ stopped: boolean }>(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
