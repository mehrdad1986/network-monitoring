import { UIIcon } from '../components/UIIcon';
import { useEffect, useState, useCallback } from 'react';
import './MTUDiscovery.css';

interface MTUTarget {
  id: string;
  name: string;
  host: string;
  description?: string;
}

interface MTUResult {
  host: string;
  status: 'discovering' | 'success' | 'failed' | 'checking';
  mtu_size?: number;
  max_payload?: number;
  test_count?: number;
  last_checked?: string;
  path_mtu?: number;
}

export const MTUDiscovery = () => {
  const defaultTargets: MTUTarget[] = [
    { id: '1', name: 'Google DNS', host: '8.8.8.8', description: 'Google public DNS' },
    { id: '2', name: 'Cloudflare DNS', host: '1.1.1.1', description: 'Cloudflare public DNS' },
    { id: '3', name: 'OpenDNS', host: '208.67.222.222', description: 'OpenDNS resolver' },
    { id: '4', name: 'Quad9', host: '9.9.9.9', description: 'Quad9 DNS' },
    { id: '5', name: 'Level3 DNS', host: '209.244.0.3', description: 'Level3 public DNS' },
  ];

  const [targets, setTargets] = useState<MTUTarget[]>(defaultTargets);
  const [results, setResults] = useState<Map<string, MTUResult>>(new Map());
  const [isDiscovering, setIsDiscovering] = useState(true);
  const [customHost, setCustomHost] = useState('');
  const [customName, setCustomName] = useState('');

  const discoverMTU = useCallback(async (target: MTUTarget) => {
    setResults(prev => new Map(prev).set(target.host, {
      host: target.host,
      status: 'discovering',
    }));

    try {
      const response = await fetch('http://localhost:8080/api/v1/tools/mtu-discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: target.host }),
      });

      if (response.ok) {
        const data = await response.json();
        setResults(prev => new Map(prev).set(target.host, {
          host: target.host,
          status: data.mtu_size > 0 ? 'success' : 'failed',
          mtu_size: data.mtu_size,
          max_payload: data.max_payload,
          test_count: data.test_count,
          path_mtu: data.path_mtu,
          last_checked: new Date().toLocaleTimeString(),
        }));
      } else {
        setResults(prev => new Map(prev).set(target.host, {
          host: target.host,
          status: 'failed',
          last_checked: new Date().toLocaleTimeString(),
        }));
      }
    } catch (error) {
      setResults(prev => new Map(prev).set(target.host, {
        host: target.host,
        status: 'failed',
        last_checked: new Date().toLocaleTimeString(),
      }));
    }
  }, []);

  const discoverAll = useCallback(async () => {
    setIsDiscovering(true);
    await Promise.all(targets.map(target => discoverMTU(target)));
  }, [targets, discoverMTU]);

  useEffect(() => {
    discoverAll();
    const interval = setInterval(discoverAll, 30000);
    return () => clearInterval(interval);
  }, [discoverAll]);

  const addCustomTarget = () => {
    if (customHost && customName) {
      const newTarget: MTUTarget = {
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
      case 'success':
        return '✅';
      case 'failed':
        return '❌';
      case 'discovering':
        return '🔍';
      case 'checking':
        return '⏳';
      default:
        return '❓';
    }
  };

  const getMTUClass = (mtu?: number) => {
    if (!mtu) return 'unknown';
    if (mtu === 1500) return 'optimal';
    if (mtu >= 1400) return 'good';
    if (mtu >= 1280) return 'fair';
    return 'poor';
  };

  const successCount = Array.from(results.values()).filter(r => r.status === 'success').length;
  const failedCount = Array.from(results.values()).filter(r => r.status === 'failed').length;

  return (
    <div className="mtu-discovery">
      <div className="page-header">
        <div>
          <h1>MTU Discovery</h1>
          <p className="page-description">Discover maximum transmission unit sizes across network paths</p>
        </div>
        <button className="btn-discover" onClick={discoverAll} disabled={!isDiscovering}>
          {isDiscovering ? <><UIIcon symbol="🔍" /> Discovering...</> : <><UIIcon symbol="▶" /> Discover All</>}
        </button>
      </div>

      <div className="status-summary">
        <div className="status-card">
          <div className="status-number success"><UIIcon symbol="✅" /> {successCount}</div>
          <div className="status-label">Discovered</div>
        </div>
        <div className="status-card">
          <div className="status-number failed"><UIIcon symbol="❌" /> {failedCount}</div>
          <div className="status-label">Failed</div>
        </div>
        <div className="status-card">
          <div className="status-number total"><UIIcon symbol="📊" /> {targets.length}</div>
          <div className="status-label">Total</div>
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
        <h2>MTU Discovery Results</h2>
        <div className="targets-grid">
          {targets.map((target, index) => {
            const result = results.get(target.host);
            return (
              <div key={target.id} className={`target-card ${result?.status || 'checking'}`} style={{ animationDelay: `${index * 0.05}s` }}>
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

                {result && (
                  <div className="card-body">
                    <div className="status-badge">
                      <span className="status-icon">{<UIIcon symbol={getStatusIcon(result.status)} />}</span>
                      <span className="status-text">
                        {result.status === 'success' && 'Discovered'}
                        {result.status === 'failed' && 'Failed'}
                        {result.status === 'discovering' && 'Discovering...'}
                        {result.status === 'checking' && 'Checking...'}
                      </span>
                    </div>

                    {result.status === 'success' && (
                      <div className="metrics">
                        <div className="metric">
                          <span className="metric-label">MTU Size:</span>
                          <span className={`metric-value ${getMTUClass(result.mtu_size)}`}>{result.mtu_size} bytes</span>
                        </div>
                        {result.path_mtu && (
                          <div className="metric">
                            <span className="metric-label">Path MTU:</span>
                            <span className={`metric-value ${getMTUClass(result.path_mtu)}`}>{result.path_mtu} bytes</span>
                          </div>
                        )}
                        {result.max_payload && (
                          <div className="metric">
                            <span className="metric-label">Max Payload:</span>
                            <span className="metric-value">{result.max_payload} bytes</span>
                          </div>
                        )}
                        {result.test_count && (
                          <div className="metric">
                            <span className="metric-label">Tests Run:</span>
                            <span className="metric-value">{result.test_count}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {result.last_checked && <div className="last-checked">Last checked: {result.last_checked}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {targets.length === 0 && <div className="empty-state"><p>No targets configured. Add a target to start discovering MTU sizes.</p></div>}
    </div>
  );
};
