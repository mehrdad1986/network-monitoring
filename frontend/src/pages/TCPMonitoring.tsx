import { UIIcon } from '../components/UIIcon';
import { useEffect, useState, useCallback, useRef } from 'react';
import './TCPMonitoring.css';
import { checkTCP } from '../services/tcp';

interface TCPTarget {
  id: string;
  name: string;
  host: string;
  port: number;
  description?: string;
}

interface TCPResult {
  target: string;
  port: number;
  status: 'open' | 'closed' | 'timeout' | 'error' | 'checking';
  connect_time?: number;
  last_checked?: string;
  service?: string;
  error?: string;
}

export const TCPMonitoring = () => {
  const defaultTargets: TCPTarget[] = [
    { id: '1', name: 'Google DNS (53)', host: '8.8.8.8', port: 53, description: 'DNS service' },
    { id: '2', name: 'Google DNS (443)', host: '8.8.8.8', port: 443, description: 'HTTPS service' },
    { id: '3', name: 'Cloudflare DNS (53)', host: '1.1.1.1', port: 53, description: 'DNS service' },
    { id: '4', name: 'Cloudflare DNS (80)', host: '1.1.1.1', port: 80, description: 'HTTP service' },
    { id: '5', name: 'OpenDNS (53)', host: '208.67.222.222', port: 53, description: 'DNS service' },
  ];

  const [targets, setTargets] = useState<TCPTarget[]>(defaultTargets);
  const [results, setResults] = useState<Map<string, TCPResult>>(new Map());
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [customHost, setCustomHost] = useState('');
  const [customPort, setCustomPort] = useState('443');
  const [customName, setCustomName] = useState('');

  const [formError, setFormError] = useState('');
  const activeCheck = useRef<AbortController | null>(null);

  const testAll = useCallback(async () => {
    if (activeCheck.current) return;
    const controller = new AbortController();
    activeCheck.current = controller;
    setIsMonitoring(true);
    setResults(new Map(targets.map(target => [`${target.host}:${target.port}`, {
      target: target.host, port: target.port, status: 'checking' as const,
    }])));
    // Bound even an unreachable/stalled API, independently of its TCP timeout.
    const deadline = setTimeout(() => controller.abort(), 10000);
    try {
      await Promise.all(targets.map(async target => {
        let result: TCPResult;
        try {
          const data = await checkTCP(target.host, target.port, controller.signal);
          result = { target: target.host, port: target.port, status: data.status,
            connect_time: data.connect_time, service: data.service, error: data.error };
        } catch (error) {
          console.error('TCP check failed:', error);
          result = { target: target.host, port: target.port, status: 'error',
            error: controller.signal.aborted ? 'TCP API request timed out.' :
              'TCP API unavailable. Check that the NetMon backend is running.' };
        }
        if (activeCheck.current !== controller) return;
        result.last_checked = new Date().toLocaleTimeString();
        setResults(prev => new Map(prev).set(`${target.host}:${target.port}`, result));
      }));
    } finally {
      clearTimeout(deadline);
      if (activeCheck.current === controller) {
        activeCheck.current = null;
        setIsMonitoring(false);
      }
    }
  }, [targets]);

  useEffect(() => {
    void testAll();
    const interval = setInterval(() => void testAll(), 30000);
    return () => {
      clearInterval(interval);
      const controller = activeCheck.current;
      activeCheck.current = null;
      controller?.abort();
    };
  }, [testAll]);

  const addCustomTarget = () => {
    const host = customHost.trim();
    const name = customName.trim();
    const port = Number(customPort);
    if (!name || !host || host.length > 253 || /[\s/\\]/.test(host) ||
        !/^\d+$/.test(customPort) || !Number.isInteger(port) || port < 1 || port > 65535) {
      setFormError('Enter a name, hostname or IP, and a port from 1 to 65535.');
      return;
    }
    if (targets.some(target => target.host === host && target.port === port)) {
      setFormError('This host and port are already configured.');
      return;
    }
    setTargets(prev => [...prev, { id: `custom-${Date.now()}`, name, host, port }]);
    setFormError('');
    setCustomHost('');
    setCustomPort('443');
    setCustomName('');
  };

  const removeTarget = (id: string) => {
    setTargets(prev => prev.filter(target => target.id !== id));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return '🟢';
      case 'closed':
        return '🔴';
      case 'checking':
        return '⏳';
      case 'error':
        return '❓';
      case 'timeout':
        return '⏱';
      default:
        return '❓';
    }
  };

  const getConnectTimeClass = (time?: number) => {
    if (time === undefined) return 'unknown';
    if (time < 50) return 'excellent';
    if (time < 200) return 'good';
    if (time < 500) return 'fair';
    return 'poor';
  };

  const openCount = targets.filter(t => results.get(`${t.host}:${t.port}`)?.status === 'open').length;
  const closedCount = targets.filter(t => results.get(`${t.host}:${t.port}`)?.status === 'closed').length;

  return (
    <div className="tcp-monitoring">
      <div className="page-header">
        <div>
          <h1>TCP Monitoring</h1>
          <p className="page-description">Monitor TCP port connectivity and service availability</p>
        </div>
        <button
          className="btn-test"
          onClick={testAll}
          disabled={isMonitoring || targets.length === 0}
        >
          {isMonitoring ? <><UIIcon symbol="🔄" /> Testing...</> : <><UIIcon symbol="▶" /> Test All</>}
        </button>
      </div>

      {/* Status Summary */}
      <div className="status-summary">
        <div className="status-card">
          <div className="status-number open"><UIIcon symbol="🟢" /> {openCount}</div>
          <div className="status-label">Ports Open</div>
        </div>
        <div className="status-card">
          <div className="status-number closed"><UIIcon symbol="🔴" /> {closedCount}</div>
          <div className="status-label">Ports Closed</div>
        </div>
        <div className="status-card">
          <div className="status-number total"><UIIcon symbol="📊" /> {targets.length}</div>
          <div className="status-label">Total Tests</div>
        </div>
      </div>

      {/* Add Custom Target */}
      <section className="add-target-section">
        <h2>Add TCP Target</h2>
        <div className="add-target-form">
          <input
            type="text"
            aria-label="Target name"
            placeholder="Target name"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCustomTarget()}
          />
          <input
            type="text"
            aria-label="Hostname or IP address"
            placeholder="IP Address or Hostname"
            value={customHost}
            onChange={(e) => setCustomHost(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCustomTarget()}
          />
          <input
            type="number"
            aria-label="Port"
            placeholder="Port"
            min="1"
            max="65535"
            value={customPort}
            onChange={(e) => setCustomPort(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCustomTarget()}
          />
          <button onClick={addCustomTarget} className="btn-add">Add Target</button>
        </div>
        {formError && <p role="alert">{formError}</p>}
      </section>

      {/* Targets Grid */}
      <section className="targets-section">
        <h2>TCP Connection Tests</h2>
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
                        {result.status === 'open' && 'Port Open'}
                        {result.status === 'closed' && 'Port Closed'}
                        {result.status === 'timeout' && 'Timeout'}
                        {result.status === 'error' && 'Check Failed'}
                        {result.status === 'checking' && 'Checking...'}
                      </span>
                    </div>

                    {result.error && <p role="status">{result.error}</p>}
                    {result.status === 'open' && (
                      <div className="metrics">
                        <div className="metric">
                          <span className="metric-label">Connection Time:</span>
                          <span className={`metric-value ${getConnectTimeClass(result.connect_time)}`}>
                            {result.connect_time?.toFixed(2)} ms
                          </span>
                        </div>
                        {result.service && (
                          <div className="metric">
                            <span className="metric-label">Service (port hint):</span>
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
          <p>No TCP targets configured. Add a target to start testing.</p>
        </div>
      )}
    </div>
  );
};
