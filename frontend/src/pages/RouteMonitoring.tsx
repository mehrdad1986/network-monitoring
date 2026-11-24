import { useCallback, useEffect, useRef, useState } from 'react';
import { getLocalRoutingTable, LocalRoute, saveRoutingHistory } from '../services/routing';
import './RouteMonitoring.css';

type RoutingTable = { routes: LocalRoute[]; count: number; source: string; observedAt: string };

export const RouteMonitoring = () => {
  const [table, setTable] = useState<RoutingTable | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const active = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setError('');
    setHistoryError('');
    try {
      const result = await getLocalRoutingTable(controller.signal);
      setTable(result);
      try {
        saveRoutingHistory({ kind: 'Local routing table', input: 'This Linux host', summary: `${result.count} kernel routes read` });
      } catch {
        setHistoryError('Routing data loaded, but this browser could not save the check to Routing History.');
      }
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'The local routing table could not be loaded.');
    } finally {
      if (active.current === controller) active.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => active.current?.abort();
  }, [refresh]);

  const cell = (value: unknown) => value === undefined || value === null || value === '' ? '—' : String(value);

  return <div className="route-monitoring">
    <header className="page-header">
      <div><h1>Route Monitoring</h1><p className="page-description">Read the actual Linux routing table on this NetMon backend host.</p></div>
      <button className="btn-refresh" type="button" onClick={() => { void refresh(); }} disabled={loading}>{loading ? 'Reading routes…' : 'Refresh routing table'}</button>
    </header>
    {table && <div className="route-live-summary"><strong>{table.count.toLocaleString()}</strong><span>kernel routes</span><small>{table.source} · {new Date(table.observedAt).toLocaleString()}</small></div>}
    {loading && <p className="route-live-state" role="status">Reading routes from the backend host…</p>}
    {error && <section className="route-live-error" role="alert"><h2>Routing table unavailable</h2><p>{error}</p><button type="button" onClick={() => { void refresh(); }} disabled={loading}>Try again</button></section>}
    {historyError && <p className="route-live-note" role="status">{historyError}</p>}
    {table && table.routes.length > 0 && <section className="route-live-table-section">
      <h2>Kernel routes</h2>
      <div className="route-live-table-wrap"><table aria-label="Linux kernel routing table">
        <thead><tr><th>Destination</th><th>Gateway</th><th>Interface</th><th>Protocol</th><th>Metric</th><th>Table</th><th>Type</th></tr></thead>
        <tbody>{table.routes.map((route, index) => <tr key={`${route.dst || 'default'}-${route.gateway || ''}-${route.dev || ''}-${route.table || ''}-${index}`}>
          <td><code>{route.dst || 'default'}</code></td><td><code>{cell(route.gateway)}</code></td><td>{cell(route.dev)}</td><td>{cell(route.protocol)}</td><td>{cell(route.metric)}</td><td>{cell(route.table)}</td><td>{cell(route.type)}</td>
        </tr>)}</tbody>
      </table></div>
    </section>}
    {table && table.routes.length === 0 && <section className="route-live-empty"><h2>No routes returned</h2><p>The backend read the routing table successfully, but the kernel returned no entries.</p></section>}
    {!loading && !error && !table && <section className="route-live-empty"><h2>Route data has not been loaded</h2><p>Refresh the routing table to read the current kernel routes.</p></section>}
  </div>;
};
