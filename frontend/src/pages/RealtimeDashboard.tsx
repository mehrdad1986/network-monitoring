import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LiveTarget, useRealtimeMonitor } from '../hooks/useRealtimeMonitor';
import apiService from '../services/api';
import './RealtimeDashboard.css';

const QUICK_TARGETS_KEY = 'netmon-realtime-quick-targets';
const LABELS = { open: 'TCP reachable', closed: 'Port closed', timeout: 'Timed out', error: 'Check failed' };
const clock = (time: string) => new Date(time).toLocaleTimeString();

function loadQuickTargets(): LiveTarget[] {
  try {
    const saved = JSON.parse(localStorage.getItem(QUICK_TARGETS_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    return saved.filter((target): target is LiveTarget => target && typeof target.id === 'string' &&
      typeof target.name === 'string' && typeof target.host === 'string' && Number.isInteger(target.port) &&
      target.port > 0 && target.port <= 65535).map(target => ({ ...target, custom: true }));
  } catch { return []; }
}

function History({ samples }: { samples: (number | null)[] }) {
  const max = Math.max(1, ...samples.filter((value): value is number => value !== null));
  return <svg className="rt-history" viewBox="0 0 120 30" role="img" aria-label={`${samples.length} recent checks; gaps indicate unsuccessful checks`}>
    {samples.map((value, i) => value === null ? null : <circle key={i} cx={4 + i * 4} cy={26 - value / max * 22} r="2" />)}
  </svg>;
}

export const RealtimeDashboard = () => {
  const [savedTargets, setSavedTargets] = useState<LiveTarget[]>([]);
  const [quickTargets, setQuickTargets] = useState<LiveTarget[]>(loadQuickTargets);
  const [targetsLoading, setTargetsLoading] = useState(true);
  const [targetsError, setTargetsError] = useState('');
  const [paused, setPaused] = useState(false);
  const [interval, setInterval] = useState(5000);
  const [refresh, setRefresh] = useState(0);
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('443');
  const [formError, setFormError] = useState('');
  const targets = useMemo(() => {
    const savedEndpoints = new Set(savedTargets.map(target => `${target.host.toLowerCase()}:${target.port}`));
    return [...savedTargets, ...quickTargets.filter(target => !savedEndpoints.has(`${target.host.toLowerCase()}:${target.port}`))];
  }, [savedTargets, quickTargets]);
  const live = useRealtimeMonitor(targets, paused, interval, refresh);
  const readings = targets.map(target => live.readings[target.id]).filter(Boolean);
  const reachable = readings.filter(reading => reading.status === 'open');
  const unavailable = readings.filter(reading => reading.status === 'closed' || reading.status === 'timeout').length;
  const errors = readings.filter(reading => reading.status === 'error').length;
  const average = reachable.length ? reachable.reduce((sum, reading) => sum + (reading.latency ?? 0), 0) / reachable.length : null;

  const loadTargets = async () => {
    try {
      const data = await apiService.getTargets(true);
      setSavedTargets(data.map(target => ({
        id: `saved-${target.id}`, name: target.name, host: target.address,
        port: target.port || 443, usesDefaultPort: !target.port,
      })));
      setTargetsError('');
    } catch (error) {
      setTargetsError(error instanceof Error ? error.message : 'Could not load saved targets.');
    } finally {
      setTargetsLoading(false);
    }
  };

  useEffect(() => { void loadTargets(); }, []);

  const addTarget = (event: FormEvent) => {
    event.preventDefault();
    const cleanHost = host.trim();
    const cleanName = name.trim();
    const number = Number(port);
    if (!cleanName || cleanName.length > 80 || !cleanHost || cleanHost.length > 253 ||
        /[\s/\\\0]/.test(cleanHost) || !/^\d+$/.test(port) || number < 1 || number > 65535) {
      setFormError('Enter a name, hostname or IP, and a port from 1 to 65535.'); return;
    }
    if (quickTargets.length >= 12) { setFormError('You can add up to 12 quick-check targets.'); return; }
    if (targets.some(target => target.host.toLowerCase() === cleanHost.toLowerCase() && target.port === number)) {
      setFormError('This host and port are already monitored.'); return;
    }
    const next = [...quickTargets, { id: `custom-${Date.now()}`, name: cleanName, host: cleanHost, port: number, custom: true }];
    setQuickTargets(next);
    try { localStorage.setItem(QUICK_TARGETS_KEY, JSON.stringify(next)); } catch { setFormError('Could not save this quick-check target in this browser.'); return; }
    setName(''); setHost(''); setPort('443'); setFormError('');
  };

  const removeQuickTarget = (id: string) => {
    const next = quickTargets.filter(target => target.id !== id);
    setQuickTargets(next);
    try { localStorage.setItem(QUICK_TARGETS_KEY, JSON.stringify(next)); } catch { /* The in-memory removal still applies. */ }
  };

  return <div className="realtime-page">
    <header className="rt-header">
      <div><span className="rt-eyebrow">NETWORK OBSERVATORY</span><h1>Real-time Monitor</h1>
        <p>Live TCP connection checks from this backend to your enabled saved targets.</p></div>
      <div className="rt-controls">
        <button type="button" onClick={() => { setTargetsLoading(true); void loadTargets(); }} disabled={targetsLoading}>Reload targets</button>
        <label>Check interval<select value={interval} onChange={event => setInterval(Number(event.target.value))}>
          <option value={5000}>5 seconds</option><option value={10000}>10 seconds</option><option value={30000}>30 seconds</option>
        </select></label>
        <button onClick={() => setRefresh(value => value + 1)} disabled={paused || live.checking || !targets.length}>Refresh now</button>
        <button className="rt-primary" onClick={() => setPaused(value => !value)}>{paused ? 'Resume monitoring' : 'Pause monitoring'}</button>
      </div>
    </header>
    <div className="rt-live-line" role="status"><span className={`rt-dot ${paused ? 'paused' : ''}`} />
      {paused ? 'Paused — last readings retained' : targetsLoading ? 'Loading saved targets…' : targetsError && targets.length === 0 ? 'Target inventory unavailable' : targets.length === 0 ? 'No targets to check' : live.checking ? 'Checking targets…' : 'Live TCP checks'}
      <span>{live.updatedAt ? `Last completed: ${clock(live.updatedAt)}` : 'Waiting for first results'}</span>
    </div>
    {targetsError && <div className="rt-warning" role="alert">Could not load saved targets: {targetsError} <button type="button" onClick={() => { setTargetsLoading(true); void loadTargets(); }}>Retry</button></div>}
    {targetsLoading && <p className="rt-empty" role="status">Loading enabled saved targets…</p>}
    {!targetsLoading && !targetsError && savedTargets.length === 0 && quickTargets.length === 0 && <div className="rt-empty rt-empty-action"><p>No enabled targets are available for live checks.</p><Link to="/app/targets">Add or enable a target</Link></div>}
    {errors > 0 && <div className="rt-warning" role="alert">{errors} target check{errors === 1 ? '' : 's'} failed. Check the NetMon API connection or target address. Failed checks do not establish port availability.</div>}
    <section className="rt-stats" aria-label="Monitoring summary">
      <div><span>Reachable targets</span><strong className="rt-green">{reachable.length}<small> / {targets.length}</small></strong></div>
      <div><span>Closed / timed out</span><strong>{unavailable}</strong></div>
      <div><span>Mean connect time</span><strong>{average === null ? '—' : average.toFixed(2)}<small> ms</small></strong></div>
      <div><span>Session checks</span><strong>{live.checks}</strong></div>
    </section>
    <div className="rt-columns">
      <section className="rt-panel"><div className="rt-panel-heading"><h2>Monitored targets</h2><span>{targets.length} targets</span></div>
        <div className="rt-table-wrap"><table aria-label="Live TCP checks per target"><thead><tr><th>Target</th><th>Status</th><th>Connect time</th><th>Recent checks</th><th>Last checked</th><th><span className="rt-sr-only">Actions</span></th></tr></thead>
          <tbody>{targets.map(target => {
            const reading = live.readings[target.id];
            return <tr key={target.id}><td><strong>{target.name}</strong><code>{target.host}:{target.port}{target.usesDefaultPort ? ' · default port' : ''}</code></td>
              <td><span className={`rt-badge ${reading?.status || 'pending'}`}>{reading ? LABELS[reading.status] : 'Pending'}</span></td>
              <td className="rt-number">{reading?.latency == null ? '—' : `${reading.latency.toFixed(2)} ms`}</td>
              <td><History samples={reading?.history || []} /></td><td className="rt-time">{reading ? clock(reading.checkedAt) : '—'}</td>
              <td>{target.custom && <button className="rt-remove" aria-label={`Remove ${target.name}`} onClick={() => removeQuickTarget(target.id)}>×</button>}</td>
            </tr>;
          })}</tbody></table></div>
        {targets.length === 0 && !targetsLoading && <p className="rt-empty">No targets are available to check.</p>}
        <form className="rt-add" onSubmit={addTarget} noValidate>
          <h3>Add a target</h3><div className="rt-form-row">
            <label>Name<input value={name} maxLength={80} onChange={event => setName(event.target.value)} placeholder="My service" /></label>
            <label>Host or IP<input value={host} maxLength={253} onChange={event => setHost(event.target.value)} placeholder="example.com" /></label>
            <label className="rt-port">Port<input type="number" min="1" max="65535" value={port} onChange={event => setPort(event.target.value)} /></label>
            <button type="submit">Add target</button>
          </div>{formError && <p className="rt-form-error" role="alert">{formError}</p>}
        </form>
      </section>
      <section className="rt-panel rt-events"><div className="rt-panel-heading"><h2>Status changes</h2><span>Latest 30</span></div>
        {live.events.length === 0 ? <p className="rt-empty">Status changes will appear after the first checks.</p> :
          <ol>{live.events.map(event => <li key={event.id}><span className={`rt-event-dot ${event.status}`} /><div><strong>{event.name}</strong><p>{event.previous ? `${LABELS[event.previous]} → ` : 'Initial check · '}{LABELS[event.status]}</p><time dateTime={event.time}>{clock(event.time)}</time></div></li>)}</ol>}
      </section>
    </div>
    <footer className="rt-footer">These are point-in-time TCP reachability checks, not scheduled monitoring measurements or service identity checks. Saved targets without a configured port use TCP 443. Quick-check target definitions are stored in this browser. Latest 30 samples per target.</footer>
  </div>;
};
