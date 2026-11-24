import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiService from '../services/api';
import { runTargetDiagnostic } from '../services/networkDiagnostics';
import type { Target } from '../types';
import './TargetDetail.css';

const networkTools = [
  { id: 'ping', name: 'Ping', description: 'ICMP reachability, latency and packet loss.' },
  { id: 'traceroute', name: 'Traceroute', description: 'The observed route to the target.' },
  { id: 'parisroute', name: 'Paris traceroute', description: 'Trace a stable flow through load-balanced paths.' },
  { id: 'nmap', name: 'Nmap', description: 'TCP scan of the top 100 ports.' },
  { id: 'mtr', name: 'MTR', description: 'Repeated route and packet-loss measurements.' },
  { id: 'port-scan', name: 'TCP port check', description: 'Check a fixed set of common TCP ports.' },
  { id: 'dns-propagation', name: 'DNS lookup', description: 'Compare answers from public DNS resolvers.' },
  { id: 'ssl-check', name: 'TLS certificate', description: 'Verify the target certificate and expiry.' },
  { id: 'bgp-route', name: 'BGP route', description: 'Look up the announced prefix and origin.' },
  { id: 'whois', name: 'WHOIS', description: 'Query registration data for the target.' },
  { id: 'asn-lookup', name: 'ASN lookup', description: 'Look up the target’s network and ASN.' },
  { id: 'geoip', name: 'GeoIP', description: 'Look up the target IP’s approximate location.' },
];

type ToolResult = { state: 'queued' | 'running' | 'completed' | 'no-response' | 'no-open-ports' | 'failed' | 'cancelled'; output?: string; error?: string; ranAt?: string };
type TargetTools = { selected: string[]; results: Record<string, ToolResult> };
const toolStorageKey = (id: string) => `netmon-target-tools:${id}`;

function loadTargetTools(id: string): TargetTools {
  try {
    const parsed = JSON.parse(localStorage.getItem(toolStorageKey(id)) || '{}');
    const selected = Array.isArray(parsed.selected) ? parsed.selected.filter((value: unknown) => typeof value === 'string' && networkTools.some(tool => tool.id === value)) : [];
    const stored = parsed.results && typeof parsed.results === 'object' && !Array.isArray(parsed.results) ? parsed.results : {};
    const results = Object.fromEntries(networkTools.flatMap(tool => {
      const result = stored[tool.id];
      if (!result || typeof result !== 'object') return [];
      const state = ['queued', 'running', 'completed', 'no-response', 'no-open-ports', 'failed', 'cancelled'].includes(result.state) ? result.state : 'queued';
      return [[tool.id, { ...result, state: state === 'running' ? 'cancelled' : state }]];
    }));
    return { selected: Array.from(new Set(selected)), results };
  } catch { return { selected: [], results: {} }; }
}

function saveTargetTools(id: string, value: TargetTools) {
  try { localStorage.setItem(toolStorageKey(id), JSON.stringify(value)); }
  catch (error) { console.error('Could not save target tool selection/results', error); }
}

export const TargetDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [target, setTarget] = useState<Target | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetTools, setTargetTools] = useState<TargetTools>(() => id ? loadTargetTools(id) : { selected: [], results: {} });
  const [running, setRunning] = useState(false);
  const runController = useRef<AbortController | null>(null);

  useEffect(() => {
    setTargetTools(id ? loadTargetTools(id) : { selected: [], results: {} });
    setRunning(false);
    return () => { runController.current?.abort(); runController.current = null; };
  }, [id]);

  const updateTargetTools = (update: (current: TargetTools) => TargetTools) => {
    setTargetTools(current => {
      const next = update(current);
      if (id) saveTargetTools(id, next);
      return next;
    });
  };

  const addTool = (toolId: string) => updateTargetTools(current => ({
    ...current, selected: current.selected.includes(toolId) ? current.selected : [...current.selected, toolId],
    results: { ...current.results, [toolId]: current.results[toolId] || { state: 'queued' } },
  }));

  const removeTool = (toolId: string) => updateTargetTools(current => ({
    selected: current.selected.filter(value => value !== toolId),
    results: Object.fromEntries(Object.entries(current.results).filter(([key]) => key !== toolId)),
  }));

  const runSelectedTools = async () => {
    if (!target || running || targetTools.selected.length === 0) return;
    const controller = new AbortController();
    runController.current = controller;
    setRunning(true);
    updateTargetTools(current => ({ ...current, results: Object.fromEntries(current.selected.map(toolId => [toolId, { state: 'queued' as const }])) }));
    for (const toolId of targetTools.selected) {
      if (controller.signal.aborted) break;
      updateTargetTools(current => ({ ...current, results: { ...current.results, [toolId]: { state: 'running' } } }));
      try {
        const response = await runTargetDiagnostic(toolId, target.address, controller.signal);
        const output = JSON.stringify(response, null, 2);
        if (controller.signal.aborted || runController.current !== controller) break;
        const observation = response as { packets_received?: number; open_ports?: unknown[] };
        const state = toolId === 'ping' && observation.packets_received === 0
          ? 'no-response'
          : toolId === 'port-scan' && Array.isArray(observation.open_ports) && observation.open_ports.length === 0
            ? 'no-open-ports'
            : 'completed';
        updateTargetTools(current => ({ ...current, results: { ...current.results, [toolId]: {
          state, output: output.length > 30000 ? `${output.slice(0, 30000)}\n…output shortened…` : output, ranAt: new Date().toISOString(),
        } } }));
      } catch (failure) {
        if (controller.signal.aborted || runController.current !== controller) break;
        console.error(`Target diagnostic failed (${toolId})`, failure);
        updateTargetTools(current => ({ ...current, results: { ...current.results, [toolId]:
          { state: 'failed', error: failure instanceof Error ? failure.message : 'Network tool failed', ranAt: new Date().toISOString() } } }));
      }
    }
    if (runController.current === controller) { runController.current = null; setRunning(false); }
  };

  const stopSelectedTools = () => {
    runController.current?.abort();
    runController.current = null;
    updateTargetTools(current => ({ ...current, results: Object.fromEntries(current.selected.map(toolId => {
      const result = current.results[toolId];
      return [toolId, result?.state === 'completed' || result?.state === 'failed' ? result : { state: 'cancelled' as const }];
    })) }));
    setRunning(false);
  };

  const loadData = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const targetData = await apiService.getTarget(id);
      setTarget(targetData);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load target data');
      console.error('Failed to load target:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTarget(null);
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading && !target) {
    return <div className="target-detail"><div className="loading">Loading...</div></div>;
  }

  if (error && !target) {
    return <div className="target-detail"><div className="error" role="alert">{error} <button onClick={loadData}>Retry</button><Link to="/app/targets">Back to Targets</Link></div></div>;
  }

  if (!target) {
    return <div className="target-detail"><div className="error">Target not found</div></div>;
  }

  const getStatusClass = () => {
    if (target.status === 'up') return 'status-up';
    if (target.status === 'degraded') return 'status-degraded';
    if (target.status === 'down') return 'status-down';
    return 'status-unknown';
  };

  return (
    <div className="target-detail">
      <div className="breadcrumb">
        <Link to="/app/targets">← Back to Targets</Link>
      </div>

      <div className="target-header">
        <div>
          <h1>{target.name}</h1>
          <div className="target-meta">
            <span className="target-address">{target.address}</span>
            {target.port && <span className="target-port">Port: {target.port}</span>}
            <span className={`target-status ${getStatusClass()}`}>
              {target.status.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {target.status === 'unknown' && <p role="status">Target saved. No monitoring measurements have been recorded yet.</p>}
      <div className="stats-row">
        <div className="stat-box">
          <div className="stat-label">Status</div>
          <div className="stat-value">{target.status.toUpperCase()}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Type</div>
          <div className="stat-value">{target.type}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Enabled</div>
          <div className="stat-value">{target.enabled ? 'Yes' : 'No'}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Last Check</div>
          <div className="stat-value">
            {target.last_check ? new Date(target.last_check).toLocaleTimeString() : 'Never'}
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Created</div>
          <div className="stat-value">
            {new Date(target.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      <section className="target-tools" aria-labelledby="target-tools-title">
        <div className="target-tools-header">
          <div><h2 id="target-tools-title">Network tools</h2><p>Add tools for this target, then run them when you’re ready.</p></div>
          <div className="target-tools-actions">
            <button type="button" className="target-tool-run" onClick={runSelectedTools} disabled={running || targetTools.selected.length === 0}>Run selected</button>
            {running && <button type="button" onClick={stopSelectedTools}>Stop</button>}
          </div>
        </div>
        <div className="target-tools-layout">
          <div className="target-tool-catalog"><h3>Add a tool</h3>
            {networkTools.filter(tool => !targetTools.selected.includes(tool.id)).map(tool => <div className="target-tool-option" key={tool.id}>
              <div><strong>{tool.name}</strong><p>{tool.description}</p></div>
              <button type="button" aria-label={`Add ${tool.name}`} onClick={() => addTool(tool.id)}>+</button>
            </div>)}
            {targetTools.selected.length === networkTools.length && <p>All available tools have been added.</p>}
          </div>
          <div className="target-tool-results"><h3>Selected tools &amp; results</h3>
            {targetTools.selected.length === 0 ? <p className="target-tools-empty">Choose tools from the list to add them here. Adding a tool does not run it.</p> :
              targetTools.selected.map(toolId => {
                const tool = networkTools.find(item => item.id === toolId)!;
                const result = targetTools.results[toolId] || { state: 'queued' as const };
                return <article className="target-tool-result" key={toolId}>
                  <div className="target-tool-result-header"><div><h4>{tool.name}</h4><span role="status" className={`target-tool-state ${result.state}`}>{result.state}</span></div>
                    <button type="button" disabled={running} onClick={() => removeTool(toolId)}>Remove</button></div>
                  {result.ranAt && <p className="target-tool-time">Last run: {new Date(result.ranAt).toLocaleString()}</p>}
                  {result.error && <p className="target-tool-error" role="alert">{result.error}</p>}
                  {result.output && <pre className="target-tool-output">{result.output}</pre>}
                </article>;
              })}
          </div>
        </div>
      </section>
    </div>
  );
};
