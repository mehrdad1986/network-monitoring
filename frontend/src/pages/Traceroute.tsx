import { UIIcon } from '../components/UIIcon';
import { useCallback, useEffect, useRef, useState } from 'react';
import './Traceroute.css';
import { Hop, traceRoute } from '../services/traceroute';

interface TracerouteResult {
  target: string;
  targetName: string;
  provider: string;
  hops: Hop[];
  totalHops: number;
  status: 'running' | 'completed' | 'partial' | 'failed';
  error?: string;
}

const dnsServers = [
    { target: '8.8.8.8', name: 'Google DNS Primary', provider: 'Google' },
    { target: '1.1.1.1', name: 'Cloudflare DNS', provider: 'Cloudflare' },
    { target: '208.67.222.222', name: 'OpenDNS Primary', provider: 'Cisco OpenDNS' },
    { target: '9.9.9.9', name: 'Quad9 DNS', provider: 'Quad9' },
    { target: '4.2.2.2', name: 'Level3 DNS', provider: 'Level3 (Microsoft)' },
  ];


export const Traceroute = () => {
  const [traceroutes, setTraceroutes] = useState<TracerouteResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedTarget, setExpandedTarget] = useState<string | null>(null);

  const activeRun = useRef<AbortController | null>(null);

  const runAllTraceroutes = useCallback(async () => {
    if (activeRun.current) return;
    const controller = new AbortController();
    activeRun.current = controller;
    setIsRunning(true);
    setTraceroutes(dnsServers.map(server => ({ target: server.target, targetName: server.name,
      provider: server.provider, hops: [], totalHops: 0, status: 'running' })));
    const deadline = setTimeout(() => controller.abort(), 25000);
    try {
      await Promise.all(dnsServers.map(async server => {
        let result: TracerouteResult;
        try {
          const data = await traceRoute(server.target, controller.signal);
          result = { target: server.target, targetName: server.name, provider: server.provider,
            hops: data.hops, totalHops: data.hops.length, status: data.status };
        } catch (error) {
          console.error('Traceroute check failed:', error);
          result = { target: server.target, targetName: server.name, provider: server.provider,
            hops: [], totalHops: 0, status: 'failed', error: controller.signal.aborted ?
              'Traceroute request timed out.' : error instanceof Error ? error.message : 'Traceroute failed.' };
        }
        if (activeRun.current !== controller) return;
        setTraceroutes(prev => prev.map(trace => trace.target === server.target ? result : trace));
      }));
    } finally {
      clearTimeout(deadline);
      if (activeRun.current === controller) {
        activeRun.current = null;
        setIsRunning(false);
      }
    }
  }, []);

  useEffect(() => {
    void runAllTraceroutes();
    return () => {
      const controller = activeRun.current;
      activeRun.current = null;
      controller?.abort();
    };
  }, [runAllTraceroutes]);

  const toggleExpand = (target: string) => {
    setExpandedTarget(expandedTarget === target ? null : target);
  };

  const getLatencyClass = (rtt: number | null) => {
    if (rtt == null) return 'unknown';
    if (rtt < 50) return 'excellent';
    if (rtt < 100) return 'good';
    if (rtt < 200) return 'fair';
    return 'poor';
  };

  // Sort traceroutes by provider name
  const sortedTraceroutes = [...traceroutes].sort((a, b) =>
    a.provider.localeCompare(b.provider)
  );

  return (
    <div className="traceroute-page">
      <div className="page-header">
        <div>
          <h1>DNS Traceroute Monitor</h1>
          <p className="page-description">Network path analysis to major DNS providers</p>
        </div>
        <button
          className="btn-trace"
          onClick={runAllTraceroutes}
          disabled={isRunning}
        >
          {isRunning ? <><UIIcon symbol="🔄" /> Running Traceroutes...</> : <><UIIcon symbol="▶" /> Run Traceroute</>}
        </button>
      </div>

      <div className="traceroute-grid">
        {sortedTraceroutes.map((trace, index) => (
          <div
            key={trace.target}
            className={`traceroute-card ${trace.status}`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="trace-header" onClick={() => toggleExpand(trace.target)}>
              <div className="trace-info">
                <h3>{trace.targetName}</h3>
                <div className="trace-meta">
                  <span className="trace-provider">{trace.provider}</span>
                  <code className="trace-ip">{trace.target}</code>
                </div>
              </div>

              <div className="trace-summary">
                {trace.status === 'running' && (
                  <div className="status-badge running">
                    <span className="spinner"></span> Running...
                  </div>
                )}
                {(trace.status === 'completed' || trace.status === 'partial') && (
                  <>
                    {trace.status === 'partial' && <span className="status-badge">Partial — destination not reached</span>}
                    <div className="hop-count">
                      <span className="count-value">{trace.totalHops}</span>
                      <span className="count-label">Hops</span>
                    </div>
                    <button className="expand-btn" aria-label={`Show hops for ${trace.targetName}`} aria-expanded={expandedTarget === trace.target}>
                      {trace.error && <p role="alert">{trace.error}</p>}
            {expandedTarget === trace.target ? '▼' : <><UIIcon symbol="▶" /></>}
                    </button>
                  </>
                )}
                {trace.status === 'failed' && (
                  <div className="status-badge failed">✗ Failed</div>
                )}
              </div>
            </div>

            {trace.error && <p role="alert">{trace.error}</p>}
            {expandedTarget === trace.target && (trace.status === 'completed' || trace.status === 'partial') && (
              <div className="trace-hops">
                <div className="hops-header">
                  <div className="hop-col-number">#</div>
                  <div className="hop-col-ip">IP Address</div>
                  <div className="hop-col-hostname">Hostname</div>
                  <div className="hop-col-rtts">RTT (ms)</div>
                </div>

                {trace.hops.map((hop) => (
                  <div key={hop.number} className="hop-row">
                    <div className="hop-col-number">
                      <span className="hop-number">{hop.number}</span>
                    </div>
                    <div className="hop-col-ip">
                      <code>{hop.ip}</code>
                    </div>
                    <div className="hop-col-hostname">
                      {hop.hostname !== hop.ip ? hop.hostname : '—'}
                    </div>
                    <div className="hop-col-rtts">
                      <span className={`rtt ${getLatencyClass(hop.rtt1)}`}>
                        {(hop.rtt1 == null ? '*' : hop.rtt1.toFixed(1))}
                      </span>
                      <span className={`rtt ${getLatencyClass(hop.rtt2)}`}>
                        {(hop.rtt2 == null ? '*' : hop.rtt2.toFixed(1))}
                      </span>
                      <span className={`rtt ${getLatencyClass(hop.rtt3)}`}>
                        {(hop.rtt3 == null ? '*' : hop.rtt3.toFixed(1))}
                      </span>
                      <span className="rtt-avg">
                        avg: {(hop.avg_rtt == null ? '*' : hop.avg_rtt.toFixed(1))} ms
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {traceroutes.length === 0 && !isRunning && (
        <div className="empty-state">
          <p>Click "Run Traceroute" to trace the network path to DNS servers</p>
        </div>
      )}
    </div>
  );
};
