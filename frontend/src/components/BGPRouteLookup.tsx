import { FormEvent, useEffect, useRef, useState } from 'react';
import { runNetworkTool } from '../services/networkDiagnostics';
import { saveRoutingHistory, RoutingCheckKind } from '../services/routing';
import './BGPRouteLookup.css';

type Props = {
  pageClass: string;
  title: string;
  description: string;
  tool: 'as-path-analysis' | 'bgp-intelligence';
  historyKind: RoutingCheckKind;
};

export function BGPRouteLookup({ pageClass, title, description, tool, historyKind }: Props) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const resource = input.trim();
    if (!resource || controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    setError('');
    setHistoryError('');
    setResult(null);
    try {
      const data = await runNetworkTool(tool, resource, request.signal) as Record<string, unknown>;
      setResult(data);
      const observed = typeof data.observedAt === 'string' ? new Date(data.observedAt).toLocaleString() : 'time unavailable';
      try {
        saveRoutingHistory({ kind: historyKind, input: resource, summary: `RIPE RIS lookup completed · ${observed}` });
      } catch {
        setHistoryError('The lookup succeeded, but browser storage could not save it to Routing History.');
      }
    } catch (reason) {
      if (!request.signal.aborted) setError(reason instanceof Error ? reason.message : 'BGP lookup failed.');
    } finally {
      if (controller.current === request) controller.current = null;
      if (!request.signal.aborted) setLoading(false);
    }
  };

  return <div className={`${pageClass} routing-lookup-page`}>
    <header className="page-header">
      <div><h1>{title}</h1><p className="page-description">{description}</p></div>
    </header>
    <form className="routing-lookup-form" onSubmit={submit}>
      <label htmlFor={`${tool}-resource`}>IP address or CIDR prefix</label>
      <div className="routing-lookup-control">
        <input id={`${tool}-resource`} value={input} onChange={event => setInput(event.target.value)} placeholder="8.8.8.0/24 or 8.8.8.8" autoComplete="off" required disabled={loading} />
        <button type="submit" disabled={loading || !input.trim()}>{loading ? 'Looking up…' : 'Run BGP lookup'}</button>
      </div>
      <p>Queries live route observations from RIPE RIS collectors. Private or unannounced ranges may have no route result.</p>
    </form>
    {loading && <p className="routing-lookup-status" role="status">Querying BGP route collectors…</p>}
    {error && <section className="routing-lookup-state" role="alert"><h2>Lookup failed</h2><p>{error}</p></section>}
    {historyError && <p className="routing-lookup-history-error" role="status">{historyError}</p>}
    {result && <section className="routing-lookup-result" aria-label={`${title} result`}>
      <div className="routing-lookup-result-heading">
        <div><h2>Live lookup result</h2><p>{String(result.resource)} · {String(result.source)} · {typeof result.observedAt === 'string' ? new Date(result.observedAt).toLocaleString() : 'time unavailable'}</p></div>
      </div>
      <pre>{JSON.stringify(result.data ?? result, null, 2)}</pre>
    </section>}
    {!result && !error && !loading && <section className="routing-lookup-empty"><h2>Ready for a lookup</h2><p>Enter an IP address or network prefix, then run a live lookup.</p></section>}
  </div>;
}
