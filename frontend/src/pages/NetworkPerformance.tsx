import { UIIcon } from '../components/UIIcon';
import { useEffect, useState, useCallback, useRef } from 'react';
import './NetworkPerformance.css';
import { measureInternetSpeed } from '../services/networkDiagnostics';

interface PerformanceTest {
  timestamp: string;
  downloadSpeed: number; // Mbps
  uploadSpeed: number; // Mbps
  jitter: number; // ms
  publicIP: string;
  location: string;
  isp: string;
  status: 'testing' | 'completed' | 'failed';
}

export const NetworkPerformance = () => {
  const mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const [error, setError] = useState('');
  const [stage, setStage] = useState('');
  const [currentTest, setCurrentTest] = useState<PerformanceTest | null>(null);
  const [testHistory, setTestHistory] = useState<PerformanceTest[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [nextScheduledTest, setNextScheduledTest] = useState<string>('');

  const runSpeedTest = useCallback(async () => {
    if (controller.current) return;
    const request = new AbortController();
    controller.current = request;
    const timeout = setTimeout(() => request.abort(), 90000);
    setIsTesting(true);
    setError('');
    setCurrentTest(null);
    try {
      const values = await measureInternetSpeed(request.signal, setStage);
      if (request.signal.aborted) return;
      const result: PerformanceTest = { ...values, timestamp: new Date().toISOString(), status: 'completed' };
      setCurrentTest(result);
      setTestHistory(previous => {
        const history = [result, ...previous].slice(0, 20);
        try { localStorage.setItem('speedtest_history_v2', JSON.stringify(history)); }
        catch (error) { console.warn('Speed test history could not be saved', error); }
        return history;
      });
      try { localStorage.setItem('last_speedtest_time', result.timestamp); }
      catch (error) { console.warn('Speed test schedule could not be saved', error); }
    } catch (error) {
      console.error('Speed measurement failed', error);
      if (mounted.current) setError(request.signal.aborted ? 'Speed test cancelled or timed out. No result was saved.' : error instanceof Error ? error.message : 'Speed test failed');
    } finally {
      clearTimeout(timeout);
      controller.current = null;
      if (mounted.current) { setIsTesting(false); setStage(''); }
    }
  }, []);

  const calculateNextTest = () => {
    const now = new Date();
    const hours = now.getHours();

    // Schedule for 8 AM and 8 PM
    let nextTest = new Date(now);

    if (hours < 8) {
      nextTest.setHours(8, 0, 0, 0);
    } else if (hours < 20) {
      nextTest.setHours(20, 0, 0, 0);
    } else {
      nextTest.setDate(nextTest.getDate() + 1);
      nextTest.setHours(8, 0, 0, 0);
    }

    return nextTest;
  };

  useEffect(() => {
    mounted.current = true;
    try {
      const saved = JSON.parse(localStorage.getItem('speedtest_history_v2') || '[]');
      if (Array.isArray(saved)) setTestHistory(saved.filter(test => test?.status === 'completed' &&
        [test.downloadSpeed, test.uploadSpeed, test.jitter].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0) &&
        typeof test.timestamp === 'string' && Number.isFinite(Date.parse(test.timestamp))).slice(0, 20));
    } catch (error) { console.warn('Speed test history could not be loaded', error); }

    // Calculate next scheduled test
    const nextTest = calculateNextTest();
    setNextScheduledTest(nextTest.toLocaleString());

    // Set up scheduled tests (every 12 hours)
    const interval = setInterval(() => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();

      // Run at 8:00 AM and 8:00 PM
      if ((hours === 8 || hours === 20) && minutes === 0) {
        runSpeedTest();
        setNextScheduledTest(calculateNextTest().toLocaleString());
      }
    }, 60000); // Check every minute

    return () => { mounted.current = false; clearInterval(interval); controller.current?.abort(); };
  }, [runSpeedTest]);

  const getSpeedClass = (speed: number, type: 'download' | 'upload') => {
    const threshold = type === 'download' ? { good: 50, fair: 25 } : { good: 20, fair: 10 };
    if (speed >= threshold.good) return 'excellent';
    if (speed >= threshold.fair) return 'good';
    return 'poor';
  };

  const getJitterClass = (jitter: number) => {
    if (jitter < 5) return 'excellent';
    if (jitter < 15) return 'good';
    return 'poor';
  };

  return (
    <div className="network-performance">
      <div className="page-header">
        <div>
          <h1>Network Performance Monitor</h1>
          <p className="next-test">Next scheduled test: {nextScheduledTest}</p>
        </div>
        <button
          className="btn-test"
          onClick={runSpeedTest}
          disabled={isTesting}
        >
          {isTesting ? <><UIIcon symbol="🔄" /> Testing...</> : <><UIIcon symbol="▶" /> Run Speed Test</>}
        </button>
      </div>

      <p>Browser-to-Fastly (HowFastly) throughput estimate. Transfers up to 170 MiB per test; results depend on this path and current network load. Jitter is HTTP round-trip variation.</p>
      {isTesting && <div role="status">{stage} <button onClick={() => controller.current?.abort()}>Cancel</button></div>}
      {error && <p role="alert">{error}</p>}
      {/* Current Test Results */}
      {currentTest && (
        <section className="current-test">
          <h2>Current Test Results</h2>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon"><UIIcon symbol="⬇️" /></div>
              <div className="metric-content">
                <div className="metric-label">Download Speed</div>
                <div className={`metric-value ${getSpeedClass(currentTest.downloadSpeed, 'download')}`}>
                  {currentTest.status === 'testing' && currentTest.downloadSpeed === 0 ? (
                    <span className="loading-dots">Testing...</span>
                  ) : (
                    <>{currentTest.downloadSpeed.toFixed(2)} <span className="unit">Mbps</span></>
                  )}
                </div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon"><UIIcon symbol="⬆️" /></div>
              <div className="metric-content">
                <div className="metric-label">Upload Speed</div>
                <div className={`metric-value ${getSpeedClass(currentTest.uploadSpeed, 'upload')}`}>
                  {currentTest.status === 'testing' && currentTest.uploadSpeed === 0 ? (
                    <span className="loading-dots">Testing...</span>
                  ) : (
                    <>{currentTest.uploadSpeed.toFixed(2)} <span className="unit">Mbps</span></>
                  )}
                </div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon"><UIIcon symbol="📊" /></div>
              <div className="metric-content">
                <div className="metric-label">HTTP Jitter</div>
                <div className={`metric-value ${getJitterClass(currentTest.jitter)}`}>
                  {currentTest.status === 'testing' && currentTest.jitter === 0 ? (
                    <span className="loading-dots">Testing...</span>
                  ) : (
                    <>{currentTest.jitter.toFixed(2)} <span className="unit">ms</span></>
                  )}
                </div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon"><UIIcon symbol="🌐" /></div>
              <div className="metric-content">
                <div className="metric-label">Public IP</div>
                <div className="metric-value ip-value">
                  {currentTest.publicIP || <span className="loading-dots">Detecting...</span>}
                </div>
                {currentTest.location && (
                  <div className="metric-sub">{currentTest.location}</div>
                )}
                {currentTest.isp && (
                  <div className="metric-sub">ISP: {currentTest.isp}</div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Test History */}
      <section className="test-history">
        <h2>Test History (Last 20 Tests)</h2>
        {testHistory.length === 0 ? (
          <div className="empty-state">
            <p>No test history yet. Run your first speed test!</p>
          </div>
        ) : (
          <div className="history-table">
            <div className="table-header">
              <div className="col-time">Date & Time</div>
              <div className="col-download">Download</div>
              <div className="col-upload">Upload</div>
              <div className="col-jitter">Jitter</div>
              <div className="col-ip">Public IP</div>
            </div>
            {testHistory.map((test, index) => (
              <div key={index} className="table-row" style={{ animationDelay: `${index * 0.05}s` }}>
                <div className="col-time">
                  {new Date(test.timestamp).toLocaleString()}
                </div>
                <div className={`col-download ${getSpeedClass(test.downloadSpeed, 'download')}`}>
                  {test.downloadSpeed.toFixed(2)} Mbps
                </div>
                <div className={`col-upload ${getSpeedClass(test.uploadSpeed, 'upload')}`}>
                  {test.uploadSpeed.toFixed(2)} Mbps
                </div>
                <div className={`col-jitter ${getJitterClass(test.jitter)}`}>
                  {test.jitter.toFixed(2)} ms
                </div>
                <div className="col-ip">
                  <code>{test.publicIP}</code>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
