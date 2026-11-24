import { UIIcon } from '../components/UIIcon';
import { useState, useEffect } from 'react';
import './PingTool.css';

interface PingTarget {
  id: string;
  host: string;
  status: 'online' | 'offline' | 'timeout';
  latency: number;
  minLatency: number;
  maxLatency: number;
  avgLatency: number;
  packetLoss: number;
  sent: number;
  received: number;
  lastCheck: string;
  successRate: number;
}

interface PingHistory {
  timestamp: string;
  latency: number;
  status: 'success' | 'timeout';
}

export const PingTool = () => {
  const [targets, setTargets] = useState<PingTarget[]>([
    {
      id: '1',
      host: '8.8.8.8',
      status: 'online',
      latency: 24.5,
      minLatency: 18.2,
      maxLatency: 45.8,
      avgLatency: 26.3,
      packetLoss: 0,
      sent: 100,
      received: 100,
      lastCheck: new Date().toLocaleTimeString(),
      successRate: 100,
    },
    {
      id: '2',
      host: '1.1.1.1',
      status: 'online',
      latency: 18.2,
      minLatency: 15.5,
      maxLatency: 32.1,
      avgLatency: 19.8,
      packetLoss: 0,
      sent: 100,
      received: 100,
      lastCheck: new Date().toLocaleTimeString(),
      successRate: 100,
    },
    {
      id: '3',
      host: '192.168.1.1',
      status: 'online',
      latency: 2.1,
      minLatency: 1.8,
      maxLatency: 5.2,
      avgLatency: 2.8,
      packetLoss: 0,
      sent: 100,
      received: 100,
      lastCheck: new Date().toLocaleTimeString(),
      successRate: 100,
    },
    {
      id: '4',
      host: 'google.com',
      status: 'online',
      latency: 32.5,
      minLatency: 28.1,
      maxLatency: 52.3,
      avgLatency: 35.2,
      packetLoss: 0,
      sent: 100,
      received: 100,
      lastCheck: new Date().toLocaleTimeString(),
      successRate: 100,
    },
  ]);

  const [newHost, setNewHost] = useState('');
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [history, setHistory] = useState<Record<string, PingHistory[]>>({});
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!isMonitoring) return;

    const interval = setInterval(() => {
      setTargets((prevTargets) =>
        prevTargets.map((target) => {
          const newLatency = Math.random() * 40 + 5;
          const newStatus = newLatency < 100 ? 'online' : 'timeout';
          const packetLoss = Math.random() > 0.95 ? Math.random() * 5 : 0;

          return {
            ...target,
            latency: parseFloat(newLatency.toFixed(1)),
            status: newStatus as 'online' | 'offline' | 'timeout',
            minLatency: Math.min(target.minLatency, newLatency),
            maxLatency: Math.max(target.maxLatency, newLatency),
            avgLatency: (target.avgLatency + newLatency) / 2,
            packetLoss: parseFloat(packetLoss.toFixed(2)),
            sent: target.sent + 1,
            received: newStatus === 'online' ? target.received + 1 : target.received,
            lastCheck: new Date().toLocaleTimeString(),
            successRate: ((target.received + (newStatus === 'online' ? 1 : 0)) / (target.sent + 1)) * 100,
          };
        })
      );

      setHistory((prev) => {
        const updated = { ...prev };
        targets.forEach((target) => {
          if (!updated[target.id]) updated[target.id] = [];
          const newLatency = Math.random() * 40 + 5;
          updated[target.id].push({
            timestamp: new Date().toLocaleTimeString(),
            latency: parseFloat(newLatency.toFixed(1)),
            status: newLatency < 100 ? 'success' : 'timeout',
          });
          if (updated[target.id].length > 60) updated[target.id].shift();
        });
        return updated;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isMonitoring, targets]);

  const addTarget = () => {
    if (!newHost.trim()) return;
    const newTarget: PingTarget = {
      id: Date.now().toString(),
      host: newHost,
      status: 'online',
      latency: Math.random() * 40 + 5,
      minLatency: 50,
      maxLatency: 50,
      avgLatency: 50,
      packetLoss: 0,
      sent: 1,
      received: 1,
      lastCheck: new Date().toLocaleTimeString(),
      successRate: 100,
    };
    setTargets([...targets, newTarget]);
    setNewHost('');
  };

  const removeTarget = (id: string) => {
    setTargets(targets.filter((t) => t.id !== id));
  };

  return (
    <div className="ping-wrapper">
      <div className="ping-header-section">
        <div className="ping-header-content">
          <h1>Ping Test</h1>
          <p>Real-time network connectivity monitoring and latency analysis.</p>
        </div>
        <div className="ping-header-buttons">
          <button className={`btn-control ${isMonitoring ? 'active' : ''}`} onClick={() => setIsMonitoring(!isMonitoring)}>
            {isMonitoring ? <><UIIcon symbol="⏸" /> Stop Monitoring</> : <><UIIcon symbol="▶" /> Start Monitoring</>}
          </button>
          <button className="btn-control"><UIIcon symbol="🔄" /> Refresh</button>
        </div>
      </div>

      <div className="metrics-container">
        <div className="metric-box">
          <div className="metric-badge online">✓</div>
          <div className="metric-content">
            <div className="metric-label">ONLINE HOSTS</div>
            <div className="metric-number">{targets.filter((t) => t.status === 'online').length}</div>
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-badge offline">✕</div>
          <div className="metric-content">
            <div className="metric-label">OFFLINE HOSTS</div>
            <div className="metric-number">{targets.filter((t) => t.status === 'offline').length}</div>
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-badge latency"><UIIcon symbol="⚡" /></div>
          <div className="metric-content">
            <div className="metric-label">AVG LATENCY</div>
            <div className="metric-number">{(targets.reduce((acc, t) => acc + t.avgLatency, 0) / targets.length).toFixed(1)}ms</div>
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-badge total"><UIIcon symbol="📊" /></div>
          <div className="metric-content">
            <div className="metric-label">TOTAL TARGETS</div>
            <div className="metric-number">{targets.length}</div>
          </div>
        </div>
      </div>

      <div className="add-target-box">
        <input
          type="text"
          placeholder="Enter IP address or hostname (e.g., 8.8.8.8 or google.com)"
          value={newHost}
          onChange={(e) => setNewHost(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addTarget()}
          className="target-input"
        />
        <button onClick={addTarget} className="btn-add">+ Add Target</button>
      </div>

      <div className="table-container">
        <h2>Active Ping Targets</h2>
        <table className="ping-table">
          <thead>
            <tr>
              <th>STATUS</th>
              <th>HOST</th>
              <th>CURRENT (MS)</th>
              <th>MIN (MS)</th>
              <th>MAX (MS)</th>
              <th>AVG (MS)</th>
              <th>LOSS %</th>
              <th>PACKETS</th>
              <th>SUCCESS RATE</th>
              <th>LAST CHECK</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {targets.map((target) => (
              <tr key={target.id}>
                <td className="col-status">
                  <span className={`status-dot status-${target.status}`}></span>
                </td>
                <td className="col-host">{target.host}</td>
                <td className="col-number">{target.latency}</td>
                <td className="col-number">{target.minLatency.toFixed(1)}</td>
                <td className="col-number">{target.maxLatency.toFixed(1)}</td>
                <td className="col-number">{target.avgLatency.toFixed(1)}</td>
                <td className="col-number">{target.packetLoss.toFixed(1)}</td>
                <td className="col-number">{target.received}/{target.sent}</td>
                <td className="col-progress">
                  <div className="progress-wrapper">
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: `${target.successRate}%` }}></div>
                    </div>
                    <span className="progress-text">{target.successRate.toFixed(1)}%</span>
                  </div>
                </td>
                <td className="col-time">{target.lastCheck}</td>
                <td className="col-action">
                  <button className="btn-view" onClick={() => setSelectedTarget(target.id)}><UIIcon symbol="👁" /></button>
                  <button className="btn-delete" onClick={() => removeTarget(target.id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedTarget && (
        <div className="details-container">
          <div className="details-header">
            <h2>Ping History - {targets.find((t) => t.id === selectedTarget)?.host}</h2>
            <button className="btn-close" onClick={() => setSelectedTarget(null)}>✕</button>
          </div>

          <div className="chart-box">
            <div className="chart-area">
              {history[selectedTarget]?.slice(-30).map((entry, idx) => (
                <div
                  key={idx}
                  className="bar"
                  style={{
                    height: `${(entry.latency / 50) * 100}%`,
                    backgroundColor: entry.status === 'success' ? '#22C55E' : '#EF4444',
                  }}
                  title={`${entry.latency.toFixed(1)}ms`}
                />
              ))}
            </div>
          </div>

          <table className="history-table">
            <thead>
              <tr>
                <th>TIME</th>
                <th>LATENCY</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {history[selectedTarget]?.slice().reverse().slice(0, 10).map((entry, idx) => (
                <tr key={idx}>
                  <td>{entry.timestamp}</td>
                  <td>{entry.latency.toFixed(1)}ms</td>
                  <td>
                    <span className={`status-${entry.status}`}>
                      {entry.status === 'success' ? '✓ Success' : '✕ Timeout'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
