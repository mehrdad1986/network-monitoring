import { UIIcon } from '../components/UIIcon';
import { useEffect, useState, useCallback, useRef } from 'react';
import './LatencyMonitoring.css';

interface LatencyTarget {
  id: string;
  name: string;
  host: string;
  description?: string;
}

interface LatencyMetric {
  host: string;
  current: number;
  min: number;
  max: number;
  avg: number;
  last_checked?: string;
  status: 'excellent' | 'good' | 'fair' | 'poor';
}

export const LatencyMonitoring = () => {
  const defaultTargets: LatencyTarget[] = [
    { id: 'google-primary', name: 'Google DNS — Primary', host: '8.8.8.8', description: 'Google public DNS' },
    { id: 'google-secondary', name: 'Google DNS — Secondary', host: '8.8.4.4', description: 'Google public DNS' },
    { id: 'cloudflare-primary', name: 'Cloudflare DNS — Primary', host: '1.1.1.1', description: 'Cloudflare public DNS' },
    { id: 'cloudflare-secondary', name: 'Cloudflare DNS — Secondary', host: '1.0.0.1', description: 'Cloudflare public DNS' },
    { id: 'quad9-primary', name: 'Quad9 — Primary', host: '9.9.9.9', description: 'Quad9 threat-blocking DNS' },
    { id: 'quad9-secondary', name: 'Quad9 — Secondary', host: '149.112.112.112', description: 'Quad9 threat-blocking DNS' },
    { id: 'opendns-primary', name: 'OpenDNS — Primary', host: '208.67.222.222', description: 'Cisco OpenDNS resolver' },
    { id: 'opendns-secondary', name: 'OpenDNS — Secondary', host: '208.67.220.220', description: 'Cisco OpenDNS resolver' },
    { id: 'adguard-primary', name: 'AdGuard DNS — Primary', host: '94.140.14.14', description: 'AdGuard ad and tracker blocking DNS' },
    { id: 'adguard-secondary', name: 'AdGuard DNS — Secondary', host: '94.140.15.15', description: 'AdGuard ad and tracker blocking DNS' },
    { id: 'cleanbrowsing-primary', name: 'CleanBrowsing — Primary', host: '185.228.168.9', description: 'CleanBrowsing Security Filter' },
    { id: 'cleanbrowsing-secondary', name: 'CleanBrowsing — Secondary', host: '185.228.169.9', description: 'CleanBrowsing Security Filter' },
    { id: 'controld-primary', name: 'Control D — Primary', host: '76.76.2.0', description: 'Control D unfiltered public DNS' },
    { id: 'controld-secondary', name: 'Control D — Secondary', host: '76.76.10.0', description: 'Control D unfiltered public DNS' },
    { id: 'dnssb-primary', name: 'DNS.SB — Primary', host: '185.222.222.222', description: 'DNS.SB public DNS' },
    { id: 'dnssb-secondary', name: 'DNS.SB — Secondary', host: '45.11.45.11', description: 'DNS.SB public DNS' },
    { id: 'yandex-primary', name: 'Yandex DNS — Primary', host: '77.88.8.8', description: 'Yandex Basic public DNS' },
    { id: 'yandex-secondary', name: 'Yandex DNS — Secondary', host: '77.88.8.1', description: 'Yandex Basic public DNS' },
    { id: 'alidns-primary', name: 'AliDNS — Primary', host: '223.5.5.5', description: 'Alibaba Cloud public DNS' },
    { id: 'alidns-secondary', name: 'AliDNS — Secondary', host: '223.6.6.6', description: 'Alibaba Cloud public DNS' },
  ];

  const [targets, setTargets] = useState<LatencyTarget[]>(defaultTargets);
  const [metrics, setMetrics] = useState<Map<string, LatencyMetric>>(new Map());
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const controller = useRef<AbortController | null>(null);
  const [customHost, setCustomHost] = useState('');
  const [customName, setCustomName] = useState('');
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('1h');

  const measureLatency = useCallback(async (target: LatencyTarget, signal: AbortSignal) => {
    try {
      const response = await fetch('/api/v1/tools/latency-measure', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: target.host }), signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Latency measurement unavailable. Try again.');
      if (![data.current, data.min, data.max, data.avg].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)) throw new Error('The measurement service returned invalid latency data.');
      if (signal.aborted) return;
      const status = data.avg > 100 ? 'poor' : data.avg > 50 ? 'fair' : data.avg > 30 ? 'good' : 'excellent';
      setMetrics(previous => new Map(previous).set(target.host, { host: target.host, current: data.current, min: data.min, max: data.max, avg: data.avg, status, last_checked: new Date().toLocaleTimeString() }));
      setErrors(previous => { const next = new Map(previous); next.delete(target.host); return next; });
    } catch (error) {
      if (signal.aborted) return;
      const message = error instanceof Error ? error.message : 'Latency measurement unavailable. Try again.';
      console.error('Latency measurement failed:', message);
      setErrors(previous => new Map(previous).set(target.host, message));
    }
  }, []);

  const measureAll = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController(); controller.current = current;
    setIsMonitoring(true);
    try { await Promise.all(targets.map(target => measureLatency(target, current.signal))); }
    finally { if (controller.current === current && !current.signal.aborted) setIsMonitoring(false); }
  }, [targets, measureLatency]);

  useEffect(() => {
    measureAll();
    const interval = setInterval(measureAll, 30000);
    return () => { clearInterval(interval); controller.current?.abort(); };
  }, [measureAll]);

  const addCustomTarget = () => {
    if (customHost && customName) {
      const newTarget: LatencyTarget = {
        id: Date.now().toString(),
        name: customName,
        host: customHost,
      };
      setTargets([...targets, newTarget]);
      setCustomHost('');
      setCustomName('');
    }
  };

  const removeTarget = (id: string) => {
    setTargets(targets.filter(t => t.id !== id));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent':
        return '✅';
      case 'good':
        return '👍';
      case 'fair':
        return '⚠️';
      case 'poor':
        return '❌';
      default:
        return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return '#10B981';
      case 'good':
        return '#3B82F6';
      case 'fair':
        return '#F59E0B';
      case 'poor':
        return '#EF4444';
      default:
        return '#8B5CF6';
    }
  };

  const avgLatency = Array.from(metrics.values()).reduce((sum, m) => sum + m.avg, 0) / (metrics.size || 1);
  const excellentCount = Array.from(metrics.values()).filter(m => m.status === 'excellent').length;
  const poorCount = Array.from(metrics.values()).filter(m => m.status === 'poor').length;

  return (
    <div className="latency-monitoring">
      <div className="page-header">
        <div>
          <h1>Latency Monitoring</h1>
          <p className="page-description">Real-time latency measurement and analysis</p>
        </div>
        <div className="header-controls">
          <select className="time-range-select" value={timeRange} onChange={(e) => setTimeRange(e.target.value as any)}>
            <option value="1h">Last 1 Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
          <button className="btn-measure" onClick={measureAll} disabled={isMonitoring}>
            {isMonitoring ? <><UIIcon symbol="🔄" /> Measuring...</> : <><UIIcon symbol="▶" /> Measure Now</>}
          </button>
        </div>
      </div>

      <div className="stats-summary">
        <div className="stat-card">
          <div className="stat-label">Average Latency</div>
          <div className="stat-value">{metrics.size ? avgLatency.toFixed(1) + ' ms' : '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Excellent</div>
          <div className="stat-value" style={{ color: '#10B981' }}><UIIcon symbol="✅" /> {excellentCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Poor</div>
          <div className="stat-value" style={{ color: '#EF4444' }}><UIIcon symbol="❌" /> {poorCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Monitored</div>
          <div className="stat-value"><UIIcon symbol="📊" /> {targets.length}</div>
        </div>
      </div>

      <section className="add-target-section">
        <h2>Add Target</h2>
        <div className="add-target-form">
          <input type="text" placeholder="Target name" value={customName} onChange={(e) => setCustomName(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addCustomTarget()} />
          <input type="text" placeholder="Host or IP address" value={customHost} onChange={(e) => setCustomHost(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addCustomTarget()} />
          <button onClick={addCustomTarget} className="btn-add">Add Target</button>
        </div>
      </section>

      <section className="targets-section">
        <h2>Latency Metrics</h2>
        <div className="metrics-grid">
          {targets.map((target, index) => {
            const metric = metrics.get(target.host);
            const error = errors.get(target.host);
            return (
              <div key={target.id} className="metric-card" style={{ borderLeftColor: metric ? getStatusColor(metric.status) : '#888', animationDelay: `${index * 0.05}s` }}>
                <div className="card-header">
                  <div className="target-info">
                    <h3>{target.name}</h3>
                    {target.description && <p className="target-description">{target.description}</p>}
                    <code className="target-host">{target.host}</code>
                  </div>
                  {targets.length > defaultTargets.length && !defaultTargets.find(t => t.id === target.id) && (
                    <button className="btn-remove" onClick={() => removeTarget(target.id)} title="Remove">✕</button>
                  )}
                </div>

                {error && <p className="measurement-state" role="alert"><UIIcon symbol="warning" />{error}{metric && ' Last successful measurement is shown below.'}</p>}
                {!metric && !error && <p className="measurement-state" role="status"><UIIcon symbol="time" />{isMonitoring ? 'Measuring latency…' : 'No measurement recorded yet.'}</p>}
                {metric && (
                  <div className="card-body">
                    <div className="status-badge" style={{ backgroundColor: getStatusColor(metric.status) }}>
                      <span className="status-icon">{<UIIcon symbol={getStatusIcon(metric.status)} />}</span>
                      <span className="status-text">{metric.status.charAt(0).toUpperCase() + metric.status.slice(1)}</span>
                    </div>

                    <div className="metrics">
                      <div className="metric-row">
                        <span className="metric-label">Current:</span>
                        <span className="metric-value current">{metric.current.toFixed(2)} ms</span>
                      </div>
                      <div className="metric-row">
                        <span className="metric-label">Average:</span>
                        <span className="metric-value">{metric.avg.toFixed(2)} ms</span>
                      </div>
                      <div className="metric-row">
                        <span className="metric-label">Min:</span>
                        <span className="metric-value">{metric.min.toFixed(2)} ms</span>
                      </div>
                      <div className="metric-row">
                        <span className="metric-label">Max:</span>
                        <span className="metric-value">{metric.max.toFixed(2)} ms</span>
                      </div>
                    </div>

                    <div className="latency-bar">
                      <div className="bar-fill" style={{ width: `${(metric.current / 100) * 100}%`, backgroundColor: getStatusColor(metric.status) }}></div>
                    </div>

                    {metric.last_checked && <div className="last-checked">Updated: {metric.last_checked}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {targets.length === 0 && <div className="empty-state"><p>No targets configured. Add a target to start measuring latency.</p></div>}
    </div>
  );
};
