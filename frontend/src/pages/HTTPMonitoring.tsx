import { UIIcon } from '../components/UIIcon';
import { useEffect, useState, useCallback, useRef } from 'react';
import './HTTPMonitoring.css';

interface HTTPTarget {
  id: string;
  name: string;
  url: string;
  description?: string;
}

interface HTTPResult {
  url: string;
  status: 'online' | 'offline' | 'error' | 'checking';
  status_code?: number;
  response_time?: number;
  ttfb?: number;
  content_length?: number;
  last_checked?: string;
  ssl_valid?: boolean;
  ssl_days?: number;
}

export const HTTPMonitoring = () => {
  const defaultTargets: HTTPTarget[] = [
    { id: '1', name: 'Google', url: 'https://google.com', description: 'Search engine' },
    { id: '2', name: 'Cloudflare', url: 'https://cloudflare.com', description: 'CDN provider' },
    { id: '3', name: 'GitHub', url: 'https://github.com', description: 'Repository hosting' },
    { id: '4', name: 'OpenDNS', url: 'https://opendns.com', description: 'DNS security' },
    { id: '5', name: 'Wikipedia', url: 'https://wikipedia.org', description: 'Reference' },
  ];

  const batch = useRef<AbortController | null>(null);
  const [error, setError] = useState('');
  const [targets, setTargets] = useState<HTTPTarget[]>(defaultTargets);
  const [results, setResults] = useState<Map<string, HTTPResult>>(new Map());
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [customUrl, setCustomUrl] = useState('');
  const [customName, setCustomName] = useState('');

  const testHTTP = useCallback(async (target: HTTPTarget, signal: AbortSignal) => {
    setResults(prev => new Map(prev).set(target.url, {
      url: target.url,
      status: 'checking',
    }));

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || '/api/v1'}/tools/http-check`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target.url }),
      });

      if (response.ok) {
        const data = await response.json();
        if (signal.aborted) return;
        setResults(prev => new Map(prev).set(target.url, {
          url: target.url,
          status: data.status_code >= 200 && data.status_code < 300 ? 'online' : 'offline',
          status_code: data.status_code,
          response_time: data.response_time,
          ttfb: data.ttfb,
          content_length: data.content_length,
          ssl_valid: data.ssl_valid,
          ssl_days: data.ssl_days,
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
      setResults(prev => new Map(prev).set(target.url, {
        url: target.url,
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
    try { await Promise.all(targets.map(target => testHTTP(target, request.signal))); }
    finally { if (batch.current === request) { batch.current = null; setIsMonitoring(false); } }
  }, [targets, testHTTP]);

  useEffect(() => {
    testAll();
    const interval = setInterval(testAll, 30000);
    return () => { clearInterval(interval); batch.current?.abort(); batch.current = null; };
  }, [testAll]);

  const addCustomTarget = () => {
    if (customUrl && customName) {
      const newTarget: HTTPTarget = {
        id: Date.now().toString(),
        name: customName,
        url: customUrl,
      };
      setTargets([...targets, newTarget]);
      setCustomUrl('');
      setCustomName('');
    }
  };

  const removeTarget = (id: string) => {
    setTargets(targets.filter(t => t.id !== id));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return '🟢';
      case 'offline':
        return '🔴';
      case 'error':
        return '⚠️';
      case 'checking':
        return '⏳';
      default:
        return '❓';
    }
  };

  const getResponseTimeClass = (time?: number) => {
    if (!time) return 'unknown';
    if (time < 200) return 'excellent';
    if (time < 500) return 'good';
    if (time < 1000) return 'fair';
    return 'poor';
  };

  const onlineCount = targets.map(target => results.get(target.url)).filter((result): result is HTTPResult => !!result).filter(r => r.status === 'online').length;
  const offlineCount = targets.map(target => results.get(target.url)).filter((result): result is HTTPResult => !!result).filter(r => r.status !== 'online' && r.status !== 'checking').length;

  return (
    <div className="http-monitoring">
      {error && <p role="alert">{error}</p>}
      <div className="page-header">
        <div>
          <h1>HTTP/HTTPS Monitoring</h1>
          <p className="page-description">Monitor web service performance and availability</p>
        </div>
        <button className="btn-test" onClick={testAll} disabled={isMonitoring}>
          {isMonitoring ? <><UIIcon symbol="🔄" /> Testing...</> : <><UIIcon symbol="▶" /> Test All</>}
        </button>
      </div>

      <div className="status-summary">
        <div className="status-card">
          <div className="status-number online"><UIIcon symbol="🟢" /> {onlineCount}</div>
          <div className="status-label">Online</div>
        </div>
        <div className="status-card">
          <div className="status-number offline"><UIIcon symbol="🔴" /> {offlineCount}</div>
          <div className="status-label">Offline</div>
        </div>
        <div className="status-card">
          <div className="status-number total"><UIIcon symbol="📊" /> {targets.length}</div>
          <div className="status-label">Total</div>
        </div>
      </div>

      <section className="add-target-section">
        <h2>Add Website</h2>
        <div className="add-target-form">
          <input type="text" placeholder="Website name" value={customName} onChange={(e) => setCustomName(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addCustomTarget()} />
          <input type="url" placeholder="https://example.com" value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addCustomTarget()} />
          <button onClick={addCustomTarget} className="btn-add">Add Website</button>
        </div>
      </section>

      <section className="targets-section">
        <h2>Website Status</h2>
        <div className="targets-grid">
          {targets.map((target, index) => {
            const result = results.get(target.url);
            return (
              <div key={target.id} className={`target-card ${result?.status || 'checking'}`} style={{ animationDelay: `${index * 0.05}s` }}>
                <div className="card-header">
                  <div className="target-info">
                    <h3>{target.name}</h3>
                    {target.description && <p className="target-description">{target.description}</p>}
                    <a href={target.url} target="_blank" rel="noopener noreferrer" className="target-url">{target.url}</a>
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
                        {result.status === 'online' && 'Online'}
                        {result.status === 'offline' && 'Offline'}
                        {result.status === 'error' && 'Error'}
                        {result.status === 'checking' && 'Checking...'}
                      </span>
                    </div>

                    {result.status === 'online' && (
                      <div className="metrics">
                        <div className="metric">
                          <span className="metric-label">Status Code:</span>
                          <span className="metric-value">{result.status_code}</span>
                        </div>
                        <div className="metric">
                          <span className="metric-label">Response Time:</span>
                          <span className={`metric-value ${getResponseTimeClass(result.response_time)}`}>{result.response_time?.toFixed(0)} ms</span>
                        </div>
                        <div className="metric">
                          <span className="metric-label">TTFB:</span>
                          <span className={`metric-value ${getResponseTimeClass(result.ttfb)}`}>{result.ttfb?.toFixed(0)} ms</span>
                        </div>
                        {result.content_length && (
                          <div className="metric">
                            <span className="metric-label">Size:</span>
                            <span className="metric-value">{(result.content_length / 1024).toFixed(1)} KB</span>
                          </div>
                        )}
                        {result.ssl_valid !== undefined && (
                          <div className="metric">
                            <span className="metric-label">SSL Valid:</span>
                            <span className={`metric-value ${result.ssl_valid ? 'excellent' : 'poor'}`}>{result.ssl_valid ? '✓' : '✗'}</span>
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

      {targets.length === 0 && <div className="empty-state"><p>No websites configured. Add a website to start monitoring.</p></div>}
    </div>
  );
};
