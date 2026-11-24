import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { NetworkSummary } from '../components/NetworkSummary';
import { getActiveRadarScan, getRadarStatus, radarSources, RadarSource, RadarStatus, startRadarScan, stopRadarScan } from '../services/netmonRadar';
import './Radar.css';

const ports = [443, 2053, 2083, 2087, 2096, 8443, 80, 2052, 2082, 2086, 2095, 8080];

export default function Radar() {
  const [sources, setSources] = useState<RadarSource[]>([]);
  const [discoveryMode, setDiscoveryMode] = useState<'dns' | 'sources'>('sources');
  const [selectedSources, setSelectedSources] = useState<string[]>(['official']);
  const [selectedPorts, setSelectedPorts] = useState<number[]>([443]);
  const [target, setTarget] = useState('cloudflare.com');
  const [sample, setSample] = useState(64);
  const [status, setStatus] = useState<RadarStatus | null>(null);
  const [jobId, setJobId] = useState('');
  const [loadingSources, setLoadingSources] = useState(true);
  const [sourceError, setSourceError] = useState('');
  const [error, setError] = useState('');
  const [attachedToRunning, setAttachedToRunning] = useState(false);
  const polling = useRef(false);
  const busy = Boolean(jobId);

  useEffect(() => {
    let active = true;
    radarSources().then(data => { if (active) setSources(data.sources); })
      .catch(reason => { if (active) setSourceError(reason instanceof Error ? reason.message : 'Provider-range sources could not be loaded.'); })
      .finally(() => { if (active) setLoadingSources(false); });
    getActiveRadarScan().then(job => {
      if (active && job) {
        setStatus(job);
        setJobId(job.id);
        setAttachedToRunning(true);
      }
    }).catch(() => { /* Older backend versions may not expose active-scan recovery. */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!jobId) return;
    let active = true;
    const update = async () => {
      if (polling.current) return;
      polling.current = true;
      try {
        const next = await getRadarStatus(jobId);
        if (!active) return;
        setStatus(next);
        if (['complete', 'failed', 'stopped'].includes(next.state)) setJobId('');
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not update the scan.');
      } finally { polling.current = false; }
    };
    void update();
    const timer = window.setInterval(() => { void update(); }, 700);
    return () => { active = false; window.clearInterval(timer); };
  }, [jobId]);

  const average = useMemo(() => {
    const values = status?.results?.map(result => result.latency_ms).filter(value => value > 0) || [];
    return values.length ? `${Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)} ms` : '—';
  }, [status]);

  const run = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError(''); setStatus(null); setAttachedToRunning(false);
    try {
      const result = await startRadarScan(target.trim(), discoveryMode === 'sources' ? selectedSources : [], selectedPorts, discoveryMode === 'dns' ? 32 : sample);
      setAttachedToRunning(Boolean(result.attached));
      if (result.attached) setStatus({ id: result.id, state: 'preparing', phase: 'Reconnecting to the active scan', total: 0, completed: 0, alive: 0, dead: 0, candidates: [], results: [], updated_at: new Date().toISOString() });
      setJobId(result.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not start NetMon Radar.'); }
  };

  const toggleValue = <T extends string | number>(items: T[], value: T, setItems: (items: T[]) => void) => setItems(items.includes(value) ? items.filter(item => item !== value) : [...items, value]);
  const metrics = [
    { label: 'IP candidates found', value: status?.candidates?.length ?? '—', icon: 'globe' },
    { label: 'Checks completed', value: status ? `${status.completed.toLocaleString()} / ${status.total.toLocaleString()}` : '—', icon: 'route' },
    { label: 'Verified IPs', value: status?.alive ?? '—', icon: 'check' },
    { label: 'Average response', value: average, icon: 'activity' },
  ];

  return <NetworkSummary title="NetMon Radar" category="Edge Network Scanner" description="Resolve the hostname and test only the IP addresses returned by public DNS. Optional provider-range sampling is available separately." metrics={metrics} source={status?.updated_at ? `Updated ${new Date(status.updated_at).toLocaleTimeString()}` : 'Live backend checks'}>
    <form className="netmon-radar-form" onSubmit={run}>
      <label htmlFor="netmon-radar-target">Cloudflare hostname to resolve and verify (TLS/SNI)</label>
      <input id="netmon-radar-target" value={target} onChange={event => setTarget(event.target.value)} placeholder="cloudflare.com" maxLength={253} disabled={busy} required />
      <fieldset className="netmon-radar-discovery-mode"><legend>How to find IP addresses</legend>
        <label><input type="radio" name="radar-discovery" checked={discoveryMode === 'dns'} onChange={() => setDiscoveryMode('dns')} disabled={busy} />Resolve this hostname</label>
        <label><input type="radio" name="radar-discovery" checked={discoveryMode === 'sources'} onChange={() => { setDiscoveryMode('sources'); if (selectedSources.length === 0) setSelectedSources(['official']); }} disabled={busy} />Find Cloudflare IPs from provider ranges (recommended)</label>
      </fieldset>
      {discoveryMode === 'sources' && <>
        <fieldset><legend>Provider IP sources</legend>{loadingSources ? <span role="status">Loading source catalog…</span> : sources.map(source => <label key={source.id}><input type="checkbox" checked={selectedSources.includes(source.id)} onChange={() => toggleValue(selectedSources, source.id, setSelectedSources)} disabled={busy} />{source.name}</label>)}</fieldset>
        {sourceError && <p role="status">{sourceError}</p>}
        <label htmlFor="netmon-radar-sample">Maximum IP sample <span>(up to 512)</span></label>
        <input id="netmon-radar-sample" type="number" min={1} max={512} value={sample} onChange={event => setSample(Math.min(512, Math.max(1, Number(event.target.value))))} disabled={busy} />
      </>}
      <fieldset><legend>Ports to check</legend>{ports.map(port => <label key={port}><input type="checkbox" checked={selectedPorts.includes(port)} onChange={() => toggleValue(selectedPorts, port, setSelectedPorts)} disabled={busy} />{port}</label>)}</fieldset>
      <div className="netmon-radar-actions"><button type="submit" disabled={busy || !target.trim() || selectedPorts.length === 0 || (discoveryMode === 'sources' && (loadingSources || selectedSources.length === 0))}>{busy ? 'Radar running…' : 'Run Radar'}</button>{busy && <button type="button" className="secondary" onClick={() => { void stopRadarScan(jobId).catch(() => setError('Could not stop the active scan.')); }}>Stop scan</button>}</div>
      <p>Cloudflare range mode samples up to 512 public IPs from the selected source and verifies each against the TLS hostname. DNS mode checks only DNS-returned public IPv4 addresses (maximum 32). A failed edge check does not mean the hostname or website is down.</p>
    </form>
    {error && <div className="netmon-radar-error" role="alert">{error}</div>}
    {status?.error && <div className="netmon-radar-error" role="alert">{status.error}</div>}
    {busy && <div className="netmon-radar-progress" role="status"><div><span>{status?.phase || 'Starting scan'}</span><span>{status?.total ? `${status.completed} / ${status.total}` : 'Preparing'}</span></div><progress value={status?.total ? status.completed : 0} max={status?.total || 1} />{attachedToRunning && <small>Connected to the scan already running on this backend.</small>}{status?.current_source && <small>Source: {status.current_source}</small>}{status?.current_ip && <small>Current: {status.current_ip}:{status.current_port}</small>}</div>}
    {!status && !error && !busy && <section className="netmon-radar-empty"><h2>Ready to scan Cloudflare</h2><p>Run Radar to list the hostname’s discovered IP addresses and then verify which endpoints respond to the selected TLS/HTTP checks. A responsive endpoint is verified, not certified as “clean.”</p></section>}
    {!!status?.candidates?.length && <section className="netmon-radar-candidates"><h2>Discovered IP candidates <span>{status.candidates.length}</span></h2><div className="netmon-radar-table-wrap"><table><thead><tr><th>IP address</th><th>Port</th><th>Status</th></tr></thead><tbody>{status.candidates.map(ip => {
      const result = status.results?.find(item => item.ip === ip);
      const checking = busy && status.current_ip === ip;
      const label = result ? `Verified · ${result.latency_ms} ms` : checking ? `Checking ${status.current_port || ''}` : busy ? 'Waiting' : status.state === 'complete' ? 'No verified endpoint' : status.state === 'stopped' ? 'Stopped' : 'Discovered';
      return <tr key={ip}><td><code>{ip}</code></td><td>{result?.port || (checking ? status.current_port || '—' : '443')}</td><td>{label}</td></tr>;
    })}</tbody></table></div></section>}
    {status?.results?.length ? <section className="netmon-radar-results"><h2>Verified results <span>{status.results.length}</span></h2><div className="netmon-radar-table-wrap"><table><thead><tr><th>IP address</th><th>Port</th><th>TLS / HTTP</th><th>Latency</th></tr></thead><tbody>{status.results.map((result, index) => <tr key={`${result.ip}:${result.port}:${index}`}><td><code>{result.ip}</code></td><td>{result.port}</td><td>{result.status}</td><td>{result.latency_ms} ms</td></tr>)}</tbody></table></div></section> : status && !busy && status.state === 'complete' && <div className="netmon-radar-empty"><h2>No candidate passed verification</h2><p>Checked {status.completed} probes across {status.candidates?.length || 0} discovered addresses. This does not mean the website is down; it means no candidate passed the selected port and TLS/HTTP checks.</p></div>}
  </NetworkSummary>;
}
