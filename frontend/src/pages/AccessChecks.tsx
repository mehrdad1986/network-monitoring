import { FormEvent, useEffect, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import './AccessChecks.css';
import { runNetworkTool } from '../services/networkDiagnostics';

export const accessCategories = [
  { id: 'doh', title: 'Accessible DoH', description: 'DNS-over-HTTPS endpoints that replied to real DNS queries.' },
  { id: 'dns', title: 'Accessible DNS Servers', description: 'IPv4 DNS resolvers that answered the supplied checker.' },
  { id: 'websites', title: 'Accessible Websites', description: 'Websites that returned an HTTP response below 400.' },
  { id: 'filtered-websites', title: 'Filtered Websites', description: 'Public websites with non-public DNS answers. DNS differences alone do not establish filtering.' },
  { id: 'sanctioned-websites', title: 'Sanctioned Websites', description: 'HTTP 451 indicates a legal restriction; it does not confirm sanctions. HTTP 403 has an unknown cause and is excluded.' },
  { id: 'routes', title: 'Traceroute / BGP', description: 'Observed traceroute hops with best-effort ASN annotations. Traceroute cannot establish BGP sessions.' },
];

const defaultRunSizes: Record<string, number> = {
  doh: 814,
  dns: 62780,
  websites: 4000,
  'filtered-websites': 4000,
  'sanctioned-websites': 4000,
  routes: 20,
};

interface Report {
  rows: Record<string, string>[]; columns: string[]; total: number; page: number;
  state: string; log: string; historical: boolean; updated_at: string | null; started_at: string | null;
}

async function request(path: string, signal: AbortSignal, options?: RequestInit) {
  const response = await fetch(`/check-tools/api/checks/${path}`, { ...options, signal });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error || 'Check service unavailable. Start scripts/check_service.py and reload.');
  return data;
}

export function AccessChecks() {
  const { category = 'doh' } = useParams();
  // Keying prevents one category's results or errors from appearing on another.
  if (!accessCategories.some(item => item.id === category)) return <Navigate to="/app/monitoring/doh" replace />;
  return <CheckPanel key={category} category={category} />;
}

function CheckPanel({ category }: { category: string }) {
  const definition = accessCategories.find(item => item.id === category)!;
  const [report, setReport] = useState<Report>();
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(defaultRunSizes[category] ?? 20);
  const [target, setTarget] = useState('1.1.1.1');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [routeMode, setRouteMode] = useState('traceroute');
  const [bgpOutput, setBgpOutput] = useState('');
  const [bgpState, setBgpState] = useState('idle');
  const action = useRef<AbortController>();

  useEffect(() => () => action.current?.abort(), []);
  useEffect(() => {
    if (category === 'routes' && routeMode === 'bgp') {
      setReport(undefined);
      setError('');
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const data = await request(`${category}?page=${page}`, controller.signal);
        if (!Array.isArray(data.rows) || !Array.isArray(data.columns) || typeof data.state !== 'string') {
          throw new Error('The check service returned an invalid report');
        }
        if (!controller.signal.aborted) { setReport(data); setError(''); }
      } catch (failure) {
        if (!controller.signal.aborted) { console.error('Access check report failed', failure); setError(failure instanceof Error ? failure.message : 'Could not load check results'); }
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(load, 2000);
      }
    };
    load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [category, page, revision, routeMode]);

  const changeRun = async (method: 'POST' | 'DELETE') => {
    if (category === 'routes' && routeMode === 'bgp') {
      action.current?.abort();
      if (method === 'DELETE') { setBgpState('cancelled'); setBusy(false); return; }
      const controller = new AbortController();
      action.current = controller;
      setBusy(true); setError(''); setBgpOutput('Looking up BGP route…'); setBgpState('running');
      const deadline = setTimeout(() => controller.abort(), 30000);
      try {
        const result = await runNetworkTool('bgp-intelligence', target, controller.signal);
        if (!controller.signal.aborted) { setBgpOutput(JSON.stringify(result, null, 2)); setBgpState('completed'); }
      } catch (failure) {
        if (controller.signal.aborted) { setBgpState('cancelled or timed out'); }
        else { console.error('BGP route lookup failed', failure); setError(failure instanceof Error ? failure.message : 'BGP lookup failed'); setBgpState('failed'); }
      } finally { clearTimeout(deadline); setBusy(false); }
      return;
    }
    action.current?.abort();
    const controller = new AbortController();
    action.current = controller;
    setBusy(true);
    setError('');
    try {
      await request(category, controller.signal, { method, headers: { 'Content-Type': 'application/json' },
        ...(method === 'POST' ? { body: JSON.stringify({ limit, target }) } : {}) });
      if (!controller.signal.aborted) {
        setPage(1); setRevision(value => value + 1);
        if (method === 'POST') setReport(undefined);
      }
    } catch (failure) {
      if (!controller.signal.aborted) { console.error('Access check action failed', failure); setError(failure instanceof Error ? failure.message : 'Check action failed'); }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const submit = (event: FormEvent) => { event.preventDefault(); changeRun('POST'); };
  const bgp = category === 'routes' && routeMode === 'bgp';
  const running = bgp ? bgpState === 'running' : report?.state === 'running';

  return <div className="access-checks">
    <header><p className="access-eyebrow">Monitoring / Access checks</p><h1>{definition.title}</h1><p>{definition.description}</p></header>
    <div className="access-layout">
      <section className="access-panel access-controls" aria-labelledby="check-controls-title">
        <h2 id="check-controls-title">Check controls</h2>
        <p>{bgp ? 'Queries live route observations from RIPE RIS BGP collectors.' : category === 'routes' ? <>Uses the Python check apps in <code>integrations/check-apps</code> to trace the route from this backend host.</> : <>Uses the Python check apps in <code>integrations/check-apps</code>. Scans run on the server’s network interface.</>}</p>
        <form onSubmit={submit}>
          {category === 'routes' && <label>Route tool<select value={routeMode} disabled={busy || running} onChange={event => { setRouteMode(event.target.value); setError(''); setBgpOutput(''); setBgpState('idle'); }}><option value="traceroute">Traceroute</option><option value="bgp">BGP route lookup</option></select></label>}
          {category === 'routes' ? <label>Route target<input required value={target} maxLength={253} onChange={event => setTarget(event.target.value)} placeholder={bgp ? 'IP address or prefix' : 'IP address or hostname'} /></label>
            : <label>Targets per run<input type="number" min="1" max="100000" required value={limit} onChange={event => setLimit(Number(event.target.value))} /></label>}
          <button type="submit" disabled={busy || running}>Run check</button>
          <button type="button" disabled={!running || (busy && !bgp)} onClick={() => changeRun('DELETE')}>Stop check</button>
        </form>
        <p>Defaults scan all 814 DoH endpoints, all 62,780 DNS servers, or all 4,000 websites. Website tabs share one scan. Large runs can take a long time; saved reports remain historical until you start a new run.</p>
        {error && <p role="alert" className="access-error">{error}</p>}
      </section>
      <section className="access-panel access-results" aria-labelledby="check-results-title">
        <div className="access-result-header"><h2 id="check-results-title">Live output &amp; results</h2><span role="status">{bgp ? bgpState : report?.state || 'Loading…'}</span></div>
        {bgp ? <><p>Live BGP route lookup result for {target}.</p><pre className="access-terminal" aria-label="BGP route results">{bgpOutput || 'Run a lookup to view BGP results here.'}</pre></> : <>
        <p>{report?.historical ? 'Historical report' : 'Current run'}{report?.updated_at ? ` · Updated ${new Date(report.updated_at).toLocaleString()}` : ' · No saved results yet'}</p>
        <pre className="access-terminal" aria-label="Live checker output">{report?.log || (running ? 'Starting checker…' : 'Live output appears here when you run a check.')}</pre>
        <div className="access-result-header"><h3>Matching results</h3><span>{report?.total ?? 0} records</span></div>
        {report && report.rows.length > 0 ? <div className="access-table-scroll" tabIndex={0} aria-label="Check results table"><table>
          <thead><tr>{report.columns.map(column => <th scope="col" key={column}>{column.replace(/_/g, ' ')}</th>)}</tr></thead>
          <tbody>{report.rows.map((row, index) => <tr key={index}>{report.columns.map(column => <td key={column}>{row[column] || '—'}</td>)}</tr>)}</tbody>
        </table></div> : <p>No matching results{running ? ' yet. Watch live output while the checker runs.' : '. Run a check to collect observations.'}</p>}
        <div className="access-pagination"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous</button>
          <span>Page {page}</span><button disabled={!report || page * 30 >= report.total} onClick={() => setPage(value => value + 1)}>Next</button></div></>}
      </section>
    </div>
  </div>;
}
