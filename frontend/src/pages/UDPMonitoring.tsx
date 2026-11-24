import { UIIcon } from '../components/UIIcon';
import { useEffect, useState, useCallback, useRef } from 'react';
import './UDPMonitoring.css';

interface UDPTarget {
  id: string;
  name: string;
  host: string;
  port: number;
  description?: string;
}

interface UDPResult {
  target: string;
  port: number;
  status: 'reachable' | 'unreachable' | 'timeout' | 'checking' | 'error';
  response_time?: number;
  packet_loss?: number;
  last_checked?: string;
  service?: string;
}

export const UDPMonitoring = () => {
  const defaultTargets: UDPTarget[] = [
    { id: '1', name: 'Google DNS (53)', host: '8.8.8.8', port: 53, description: 'DNS service' },
    { id: '2', name: 'Cloudflare DNS (53)', host: '1.1.1.1', port: 53, description: 'DNS service' },
    { id: '3', name: 'Quad9 DNS (53)', host: '9.9.9.9', port: 53, description: 'DNS service' },
    { id: '4', name: 'OpenDNS (53)', host: '208.67.222.222', port: 53, description: 'DNS service' },
    { id: '5', name: 'NTP Time (123)', host: 'pool.ntp.org', port: 123, description: 'NTP service' },
  ];

  const batch = useRef<AbortController | null>(null);
  const [error, setError] = useState('');
  const [targets, setTargets] = useState<UDPTarget[]>(defaultTargets);
  const [results, setResults] = useState<Map<string, UDPResult>>(new Map());
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [customHost, setCustomHost] = useState('');
  const [customPort, setCustomPort] = useState('53');
  const [customName, setCustomName] = useState('');

  const testUDPPort = useCallback(async (target: UDPTarget, signal: AbortSignal) => {
    const key = `${target.host}:${target.port}`;
    setResults(prev => new Map(prev).set(key, {
      target: target.host,
      port: target.port,
      status: 'checking',
    }));

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || '/api/v1'}/tools/udp-test`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: target.host,
          port: target.port,
          timeout: 5,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (signal.aborted) return;
        setResults(prev => new Map(prev).set(key, {
          target: target.host,
          port: target.port,
          status: data.reachable ? 'reachable' : 'unreachable',
          response_time: data.response_time,
          packet_loss: data.packet_loss,
          last_checked: new Date().toLocaleTimeString(),
          service: data.service,
        }));
      } else {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || `Check failed (HTTP ${response.status})`);
      }
    } catch (error) {
      if (signal.aborted) return;
      console.error('Network check failed', error);
      setError(error instanceof Error ? error.message : 'Network check failed');
      setResults(prev => new Map(prev).set(key, {
        target: target.host,
        port: target.port,
        status: 'error',
        last_checked: new Date().toLocaleTimeString(),
      }));
    }
  }, []);

  const testAll = useCallback(async () => {
    if (batch.current) return;
    const request = new AbortController();
    batch.current = request;
    setIsMonitoring(true);
    setError('');
    try { await Promise.all(targets.map(target => testUDPPort(target, request.signal))); }
    finally { if (batch.current === request) { batch.current = null; setIsMonitoring(false); } }
  }, [targets, testUDPPort]);

  useEffect(() => {
    testAll();
    const interval = setInterval(testAll, 30000);
    return () => { clearInterval(interval); batch.current?.abort(); batch.current = null; };
  }, [testAll]);

  const addCustomTarget = () => {
    if (!customHost.trim() || !customName.trim() || !/^\d+$/.test(customPort) || Number(customPort) < 1 || Number(customPort) > 65535) { setError('Enter a name, host and port from 1 to 65535.'); return; }
    if (customHost && customPort && customName) {
      const newTarget: UDPTarget = {
        id: Date.now().toString(),
        name: customName,
        host: customHost,
        port: parseInt(customPort),
      };
      setTargets([...targets, newTarget]);
      setCustomHost('');
      setCustomPort('53');
      setCustomName('');
    }
  };

  const removeTarget = (id: string) => {
    setTargets(targets.filter(t => t.id !== id));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'reachable':
        return '📡';
      case 'unreachable':
        return '🚫';
      case 'checking':
        return '⏳';
      case 'timeout':
        return '⏱';
      default:
        return '❓';
    }
  };

  const getResponseTimeClass = (time?: number) => {
    if (!time) return 'unknown';
    if (time < 100) return 'excellent';
    if (time < 300) return 'good';
    if (time < 500) return 'fair';
    return 'poor';
  };

  const reachableCount = targets.map(target => results.get(`${target.host}:${target.port}`)).filter((result): result is UDPResult => !!result).filter(r => r.status === 'reachable').length;
  const unreachableCount = targets.map(target => results.get(`${target.host}:${target.port}`)).filter((result): result is UDPResult => !!result).filter(r => r.status === 'unreachable' || r.status === 'timeout').length;

  return (
    <div className="udp-monitoring">
      {error && <p role="alert">{error}</p>}
      <div className="page-header">
        <div>
          <h1>UDP Monitoring</h1>
          <p className="page-description">Monitor UDP port connectivity and packet loss</p>
        </div>
        <button
          className="btn-test"
          onClick={testAll}
          disabled={isMonitoring}
        >
          {isMonitoring ? <><UIIcon symbol="🔄" /> Testing...</> : <><UIIcon symbol="▶" /> Test All</>}
        </button>
      </div>

      {/* Status Summary */}
      <div className="status-summary">
        <div className="status-card">
          <div className="status-number reachable"><UIIcon symbol="📡" /> {reachableCount}</div>
          <div className="status-label">Reachable</div>
        </div>
        <div className="status-card">
          <div className="status-number unreachable"><UIIcon symbol="🚫" /> {unreachableCount}</div>
          <div className="status-label">Unreachable</div>
        </div>
        <div className="status-card">
          <div className="status-number total"><UIIcon symbol="📊" /> {targets.length}</div>
          <div className="status-label">Total Tests</div>
        </div>
      </div>

      {/* Add Custom Target */}
      <section className="add-target-section">
        <h2>Add UDP Target</h2>
        <div className="add-target-form">
          <input
            type="text"
            placeholder="Service name"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCustomTarget()}
          />
          <input
            type="text"
            placeholder="Host or IP"
            value={customHost}
            onChange={(e) => setCustomHost(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCustomTarget()}
          />
          <input
            type="number"
            placeholder="Port"
            min="1"
            max="65535"
            value={customPort}
            onChange={(e) => setCustomPort(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCustomTarget()}
          />
          <button onClick={addCustomTarget} className="btn-add">Add Target</button>
        </div>
      </section>

      {/* Targets Grid */}
      <section className="targets-section">
        <h2>UDP Connection Tests</h2>
        <div className="targets-grid">
          {targets.map((target, index) => {
            const key = `${target.host}:${target.port}`;
            const result = results.get(key);
            return (
              <div
                key={target.id}
                className={`target-card ${result?.status || 'checking'}`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="card-header">
                  <div className="target-info">
                    <h3>{target.name}</h3>
                    {target.description && (
                      <p className="target-description">{target.description}</p>
                    )}
                    <div className="target-address">
                      <code>{target.host}</code>
                      <span className="port-badge">:{target.port}</span>
                    </div>
                  </div>
                  {targets.length > defaultTargets.length && !defaultTargets.find(t => t.id === target.id) && (
                    <button
                      className="btn-remove"
                      onClick={() => removeTarget(target.id)}
                      title="Remove target"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {result && (
                  <div className="card-body">
                    <div className="status-badge">
                      <span className="status-icon">{<UIIcon symbol={getStatusIcon(result.status)} />}</span>
                      <span className="status-text">
                        {result.status === 'reachable' && 'Reachable'}
                        {result.status === 'unreachable' && 'No response'}
                        {result.status === 'timeout' && 'Timeout'}
                        {result.status === 'checking' && 'Checking...'}
                        {result.status === 'error' && 'Check failed'}
                      </span>
                    </div>

                    {result.status === 'reachable' && (
                      <div className="metrics">
                        <div className="metric">
                          <span className="metric-label">Response Time:</span>
                          <span className={`metric-value ${getResponseTimeClass(result.response_time)}`}>
                            {result.response_time?.toFixed(2)} ms
                          </span>
                        </div>
                        <div className="metric">
                          <span className="metric-label">Packet Loss:</span>
                          <span className={`metric-value ${result.packet_loss === 0 ? 'excellent' : result.packet_loss! < 10 ? 'good' : 'poor'}`}>
                            {result.packet_loss}%
                          </span>
                        </div>
                        {result.service && (
                          <div className="metric">
                            <span className="metric-label">Service:</span>
                            <span className="metric-value">{result.service}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {result.last_checked && (
                      <div className="last-checked">
                        Last checked: {result.last_checked}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {targets.length === 0 && (
        <div className="empty-state">
          <p>No UDP targets configured. Add a target to start testing.</p>
        </div>
      )}
    </div>
  );
};
