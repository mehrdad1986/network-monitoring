import { UIIcon } from '../components/UIIcon';
import { useEffect, useState, useCallback, useRef } from 'react';
import './ICMPMonitoring.css';

interface PingTarget {
  id: string;
  name: string;
  address: string;
  description?: string;
}

interface PingResult {
  target: string;
  status: 'up' | 'down' | 'timeout' | 'checking' | 'error';
  rtt_min?: number;
  rtt_max?: number;
  rtt_avg?: number;
  packet_loss?: number;
  packets_sent?: number;
  packets_received?: number;
  last_checked?: string;
}

export const ICMPMonitoring = () => {
  const defaultTargets: PingTarget[] = [
    { id: '1', name: 'Google DNS', address: '8.8.8.8', description: 'Google public DNS' },
    { id: '2', name: 'Cloudflare DNS', address: '1.1.1.1', description: 'Cloudflare public DNS' },
    { id: '3', name: 'Quad9 DNS', address: '9.9.9.9', description: 'Quad9 public DNS' },
    { id: '4', name: 'OpenDNS', address: '208.67.222.222', description: 'Cisco OpenDNS' },
    { id: '5', name: 'Gateway', address: '192.168.1.1', description: 'Local gateway' },
  ];

  const batch = useRef<AbortController | null>(null);
  const [error, setError] = useState('');
  const [targets, setTargets] = useState<PingTarget[]>(defaultTargets);
  const [results, setResults] = useState<Map<string, PingResult>>(new Map());
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [packetCount, setPacketCount] = useState(4);
  const [customTarget, setCustomTarget] = useState('');
  const [customName, setCustomName] = useState('');

  const pingTarget = useCallback(async (target: PingTarget, signal: AbortSignal) => {
    setResults(prev => new Map(prev).set(target.address, {
      target: target.address,
      status: 'checking',
    }));

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || '/api/v1'}/tools/icmp-monitor`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: target.address,
          count: packetCount,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (signal.aborted) return;
        setResults(prev => new Map(prev).set(target.address, {
          target: target.address,
          status: data.packet_loss === 100 ? 'down' : 'up',
          rtt_min: data.min_rtt,
          rtt_max: data.max_rtt,
          rtt_avg: data.avg_rtt,
          packet_loss: data.packet_loss,
          packets_sent: data.sent,
          packets_received: data.received,
          last_checked: new Date().toLocaleTimeString(),
        }));
      } else {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || `Check failed (HTTP ${response.status})`);
      }
    } catch (error) {
      if (signal.aborted) return;
      console.error('Network check failed', error);
      setError(error instanceof Error ? error.message : 'Network check failed');
      setResults(prev => new Map(prev).set(target.address, {
        target: target.address,
        status: 'error',
        last_checked: new Date().toLocaleTimeString(),
      }));
    }
  }, [packetCount]);

  const pingAll = useCallback(async () => {
    if (batch.current) return;
    const request = new AbortController();
    batch.current = request;
    setIsMonitoring(true);
    setError('');
    try { await Promise.all(targets.map(target => pingTarget(target, request.signal))); }
    finally { if (batch.current === request) { batch.current = null; setIsMonitoring(false); } }
  }, [targets, pingTarget]);

  useEffect(() => {
    pingAll();
    const interval = setInterval(pingAll, 30000); // Refresh every 30 seconds
    return () => { clearInterval(interval); batch.current?.abort(); batch.current = null; };
  }, [pingAll]);

  const addCustomTarget = () => {
    if (customTarget && customName) {
      const newTarget: PingTarget = {
        id: Date.now().toString(),
        name: customName,
        address: customTarget,
      };
      setTargets([...targets, newTarget]);
      setCustomTarget('');
      setCustomName('');
    }
  };

  const removeTarget = (id: string) => {
    setTargets(targets.filter(t => t.id !== id));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'up':
        return '✓';
      case 'down':
        return '✗';
      case 'checking':
        return '⏳';
      case 'timeout':
        return '⏱';
      default:
        return '?';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'up':
        return 'online';
      case 'down':
      case 'timeout':
        return 'offline';
      case 'checking':
        return 'checking';
      default:
        return 'unknown';
    }
  };

  const upCount = targets.map(target => results.get(target.address)).filter((result): result is PingResult => !!result).filter(r => r.status === 'up').length;
  const downCount = targets.map(target => results.get(target.address)).filter((result): result is PingResult => !!result).filter(r => r.status === 'down' || r.status === 'timeout').length;

  return (
    <div className="icmp-monitoring">
      {error && <p role="alert">{error}</p>}
      <div className="page-header">
        <div>
          <h1>ICMP Monitoring</h1>
          <p className="page-description">Monitor target reachability with ping tests</p>
        </div>
        <button
          className="btn-refresh"
          onClick={pingAll}
          disabled={isMonitoring}
        >
          {isMonitoring ? <><UIIcon symbol="🔄" /> Monitoring...</> : <><UIIcon symbol="▶" /> Ping All</>}
        </button>
      </div>

      {/* Status Summary */}
      <div className="status-summary">
        <div className="status-card">
          <div className="status-number online">{upCount}</div>
          <div className="status-label">Hosts Up</div>
        </div>
        <div className="status-card">
          <div className="status-number offline">{downCount}</div>
          <div className="status-label">Hosts Down</div>
        </div>
        <div className="status-card">
          <div className="status-number total">{targets.length}</div>
          <div className="status-label">Total Targets</div>
        </div>
      </div>

      {/* Configuration Section */}
      <section className="config-section">
        <h2>Configuration</h2>
        <div className="config-grid">
          <div className="config-item">
            <label>Packets per Ping:</label>
            <input
              type="number"
              min="1"
              max="10"
              value={packetCount}
              onChange={(e) => setPacketCount(parseInt(e.target.value))}
            />
          </div>
        </div>
      </section>

      {/* Add Custom Target */}
      <section className="add-target-section">
        <h2>Add Custom Target</h2>
        <div className="add-target-form">
          <input
            type="text"
            placeholder="Host name/IP"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCustomTarget()}
          />
          <input
            type="text"
            placeholder="IP Address"
            value={customTarget}
            onChange={(e) => setCustomTarget(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCustomTarget()}
          />
          <button onClick={addCustomTarget} className="btn-add">Add Target</button>
        </div>
      </section>

      {/* Targets Grid */}
      <section className="targets-section">
        <h2>Monitoring Targets</h2>
        <div className="targets-grid">
          {targets.map((target, index) => {
            const result = results.get(target.address);
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
                    <code className="target-address">{target.address}</code>
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
                      <span className={`status-icon ${getStatusColor(result.status)}`}>
                        {<UIIcon symbol={getStatusIcon(result.status)} />}
                      </span>
                      <span className="status-text">
                        {result.status === 'up' && 'Host Up'}
                        {result.status === 'down' && 'Host Down'}
                        {result.status === 'timeout' && 'Timeout'}
                        {result.status === 'checking' && 'Checking...'}
                        {result.status === 'error' && 'Check failed'}
                      </span>
                    </div>

                    {result.status === 'up' && (
                      <div className="metrics-grid">
                        <div className="metric">
                          <span className="metric-label">Min RTT:</span>
                          <span className="metric-value">{result.rtt_min?.toFixed(2)} ms</span>
                        </div>
                        <div className="metric">
                          <span className="metric-label">Max RTT:</span>
                          <span className="metric-value">{result.rtt_max?.toFixed(2)} ms</span>
                        </div>
                        <div className="metric">
                          <span className="metric-label">Avg RTT:</span>
                          <span className={`metric-value ${
                            result.rtt_avg! < 50 ? 'excellent' : result.rtt_avg! < 100 ? 'good' : 'poor'
                          }`}>
                            {result.rtt_avg?.toFixed(2)} ms
                          </span>
                        </div>
                        <div className="metric">
                          <span className="metric-label">Packet Loss:</span>
                          <span className={`metric-value ${
                            result.packet_loss === 0 ? 'excellent' : result.packet_loss! < 10 ? 'good' : 'poor'
                          }`}>
                            {result.packet_loss}%
                          </span>
                        </div>
                        <div className="metric">
                          <span className="metric-label">Packets:</span>
                          <span className="metric-value">{result.packets_received}/{result.packets_sent}</span>
                        </div>
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
          <p>No targets configured. Add a target to start monitoring.</p>
        </div>
      )}
    </div>
  );
};
