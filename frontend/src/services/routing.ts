export type RoutingCheckKind = 'AS path lookup' | 'BGP intelligence lookup' | 'Local routing table';

export interface RoutingHistoryEntry {
  id: string;
  kind: RoutingCheckKind;
  input: string;
  observedAt: string;
  summary: string;
}

export interface LocalRoute {
  dst?: string;
  gateway?: string;
  dev?: string;
  protocol?: string;
  metric?: number;
  table?: string | number;
  type?: string;
  [key: string]: unknown;
}

const historyKey = 'netmon.routing.history.v1';
const apiBase = (process.env.REACT_APP_API_URL || '/api/v1').replace(/\/$/, '');

function isHistoryEntry(value: unknown): value is RoutingHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<RoutingHistoryEntry>;
  return typeof row.id === 'string' && typeof row.kind === 'string' &&
    typeof row.input === 'string' && typeof row.observedAt === 'string' && typeof row.summary === 'string';
}

export function getRoutingHistory(): RoutingHistoryEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(historyKey) || '[]');
    return Array.isArray(parsed) ? parsed.filter(isHistoryEntry) : [];
  } catch {
    return [];
  }
}

export function saveRoutingHistory(entry: Omit<RoutingHistoryEntry, 'id' | 'observedAt'>, now = new Date()): RoutingHistoryEntry[] {
  const record: RoutingHistoryEntry = {
    ...entry,
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 9)}`,
    observedAt: now.toISOString(),
  };
  const next = [record, ...getRoutingHistory()].slice(0, 100);
  localStorage.setItem(historyKey, JSON.stringify(next));
  return next;
}

export function removeRoutingHistory(id: string): RoutingHistoryEntry[] {
  const next = getRoutingHistory().filter(entry => entry.id !== id);
  localStorage.setItem(historyKey, JSON.stringify(next));
  return next;
}

export async function getLocalRoutingTable(signal: AbortSignal): Promise<{ routes: LocalRoute[]; count: number; source: string; observedAt: string }> {
  const response = await fetch(`${apiBase}/tools/routing-table`, { signal });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Routing table lookup failed (HTTP ${response.status})`);
  if (!data || !Array.isArray(data.routes)) throw new Error('The backend returned an invalid routing table');
  return data;
}
