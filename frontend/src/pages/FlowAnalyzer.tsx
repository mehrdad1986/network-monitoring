import { UIIcon } from '../components/UIIcon';
import { useState, useEffect } from 'react';
import './FlowAnalyzer.css';

interface FlowRecord {
  id: string;
  sourceIP: string;
  destIP: string;
  sourcePort: number;
  destPort: number;
  protocol: string;
  packets: number;
  bytes: number;
  duration: number;
  application: string;
  status: 'active' | 'closed' | 'timeout';
  timestamp: string;
}

interface TopTalker {
  rank: number;
  ip: string;
  bytes: number;
  packets: number;
  flows: number;
  protocol: string;
  direction: 'source' | 'destination';
}

interface ApplicationStats {
  name: string;
  bytes: number;
  packets: number;
  flows: number;
  percentage: number;
}

export default function FlowAnalyzer() {
  const [activeTab, setActiveTab] = useState('flows');
  const [timeRange, setTimeRange] = useState('1h');
  const [isCollecting, setIsCollecting] = useState(true);

  const [flowRecords, setFlowRecords] = useState<FlowRecord[]>([
    { id: 'flow-1', sourceIP: '192.168.1.100', destIP: '8.8.8.8', sourcePort: 54321, destPort: 53, protocol: 'UDP', packets: 1024, bytes: 65536, duration: 300, application: 'DNS', status: 'active', timestamp: new Date().toISOString() },
    { id: 'flow-2', sourceIP: '192.168.1.50', destIP: '10.0.0.5', sourcePort: 443, destPort: 443, protocol: 'TCP', packets: 5632, bytes: 2097152, duration: 1800, application: 'HTTPS', status: 'active', timestamp: new Date().toISOString() },
    { id: 'flow-3', sourceIP: '10.20.1.1', destIP: '192.168.1.20', sourcePort: 22, destPort: 22222, protocol: 'TCP', packets: 512, bytes: 32768, duration: 600, application: 'SSH', status: 'closed', timestamp: new Date(Date.now() - 600000).toISOString() },
    { id: 'flow-4', sourceIP: '192.168.1.200', destIP: '172.16.0.1', sourcePort: 80, destPort: 80, protocol: 'TCP', packets: 2048, bytes: 1048576, duration: 1200, application: 'HTTP', status: 'active', timestamp: new Date().toISOString() },
    { id: 'flow-5', sourceIP: '10.50.0.100', destIP: '8.8.4.4', sourcePort: 53, destPort: 53, protocol: 'UDP', packets: 512, bytes: 32768, duration: 180, application: 'DNS', status: 'closed', timestamp: new Date().toISOString() },
  ]);

  const [topTalkers, setTopTalkers] = useState<TopTalker[]>([
    { rank: 1, ip: '192.168.1.50', bytes: 2097152, packets: 5632, flows: 8, protocol: 'TCP', direction: 'source' },
    { rank: 2, ip: '8.8.8.8', bytes: 1048576, packets: 2048, flows: 12, protocol: 'UDP', direction: 'destination' },
    { rank: 3, ip: '192.168.1.100', bytes: 655360, packets: 1024, flows: 5, protocol: 'UDP', direction: 'source' },
    { rank: 4, ip: '10.20.1.1', bytes: 524288, packets: 512, flows: 3, protocol: 'TCP', direction: 'destination' },
    { rank: 5, ip: '172.16.0.1', bytes: 262144, packets: 256, flows: 2, protocol: 'TCP', direction: 'source' },
  ]);

  const [appStats, setAppStats] = useState<ApplicationStats[]>([
    { name: 'HTTPS', bytes: 2097152, packets: 5632, flows: 8, percentage: 45 },
    { name: 'DNS', bytes: 1048576, packets: 1536, flows: 17, percentage: 22 },
    { name: 'HTTP', bytes: 786432, packets: 2048, flows: 5, percentage: 17 },
    { name: 'SSH', bytes: 262144, packets: 512, flows: 2, percentage: 6 },
    { name: 'Other', bytes: 131072, packets: 256, flows: 4, percentage: 10 },
  ]);

  const flowStats = {
    totalFlows: flowRecords.length,
    activeFlows: flowRecords.filter(f => f.status === 'active').length,
    totalBytes: flowRecords.reduce((sum, f) => sum + f.bytes, 0),
    totalPackets: flowRecords.reduce((sum, f) => sum + f.packets, 0),
    avgPacketSize: Math.round(flowRecords.reduce((sum, f) => sum + f.bytes, 0) / flowRecords.reduce((sum, f) => sum + f.packets, 0)),
    avgFlowDuration: Math.round(flowRecords.reduce((sum, f) => sum + f.duration, 0) / flowRecords.length),
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  return (
    <div className="flow-analyzer">
      <div className="flow-header">
        <div className="header-content">
          <h1><UIIcon symbol="📊" /> NetFlow & Traffic Analysis</h1>
          <p className="header-subtitle">Real-time flow monitoring, traffic statistics, and application analysis</p>
        </div>
        <div className="header-controls">
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className="time-select">
            <option value="5m">Last 5 Minutes</option>
            <option value="15m">Last 15 Minutes</option>
            <option value="1h">Last 1 Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
          </select>
          <button className={`collect-btn ${isCollecting ? 'active' : ''}`} onClick={() => setIsCollecting(!isCollecting)}>
            {isCollecting ? <><UIIcon symbol="⏹" /> Stop</> : <><UIIcon symbol="▶" /> Start</>} Collection
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon"><UIIcon symbol="🌊" /></span>
          <div className="stat-content">
            <span className="stat-label">Total Flows</span>
            <span className="stat-value">{flowStats.totalFlows}</span>
            <span className="stat-sub">{flowStats.activeFlows} active</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon"><UIIcon symbol="📦" /></span>
          <div className="stat-content">
            <span className="stat-label">Total Bytes</span>
            <span className="stat-value">{formatBytes(flowStats.totalBytes)}</span>
            <span className="stat-sub">{formatBytes(flowStats.totalBytes / 3600)}/s avg</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon"><UIIcon symbol="🚀" /></span>
          <div className="stat-content">
            <span className="stat-label">Total Packets</span>
            <span className="stat-value">{flowStats.totalPackets.toLocaleString()}</span>
            <span className="stat-sub">{flowStats.avgPacketSize} bytes avg</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon"><UIIcon symbol="⏱️" /></span>
          <div className="stat-content">
            <span className="stat-label">Avg Flow Duration</span>
            <span className="stat-value">{formatDuration(flowStats.avgFlowDuration)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flow-tabs">
        <button
          className={`tab ${activeTab === 'flows' ? 'active' : ''}`}
          onClick={() => setActiveTab('flows')}
        >
          <UIIcon symbol="🌐" /> Active Flows ({flowStats.activeFlows})
        </button>
        <button
          className={`tab ${activeTab === 'toptalkers' ? 'active' : ''}`}
          onClick={() => setActiveTab('toptalkers')}
        >
          <UIIcon symbol="🏆" /> Top Talkers (Top 5)
        </button>
        <button
          className={`tab ${activeTab === 'applications' ? 'active' : ''}`}
          onClick={() => setActiveTab('applications')}
        >
          <UIIcon symbol="📱" /> Applications
        </button>
      </div>

      {/* Content */}
      <div className="flow-content">
        {activeTab === 'flows' && (
          <div className="flows-section">
            <h3>Active Network Flows</h3>
            <div className="flows-table">
              <div className="table-header">
                <div className="col-src">Source IP:Port</div>
                <div className="col-dst">Dest IP:Port</div>
                <div className="col-proto">Protocol</div>
                <div className="col-app">Application</div>
                <div className="col-packets">Packets</div>
                <div className="col-bytes">Bytes</div>
                <div className="col-duration">Duration</div>
                <div className="col-status">Status</div>
              </div>
              {flowRecords.map(flow => (
                <div key={flow.id} className={`table-row ${flow.status}`}>
                  <div className="col-src"><code>{flow.sourceIP}:{flow.sourcePort}</code></div>
                  <div className="col-dst"><code>{flow.destIP}:{flow.destPort}</code></div>
                  <div className="col-proto"><span className="protocol-badge">{flow.protocol}</span></div>
                  <div className="col-app">{flow.application}</div>
                  <div className="col-packets">{flow.packets.toLocaleString()}</div>
                  <div className="col-bytes">{formatBytes(flow.bytes)}</div>
                  <div className="col-duration">{formatDuration(flow.duration)}</div>
                  <div className="col-status">
                    <span className={`status-badge ${flow.status}`}>
                      {flow.status === 'active' ? '●' : flow.status === 'closed' ? '○' : '✕'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'toptalkers' && (
          <div className="toptalkers-section">
            <h3>Top Talkers - Source & Destination Analysis</h3>
            <div className="toptalkers-grid">
              {topTalkers.map(talker => (
                <div key={`${talker.ip}-${talker.direction}`} className="talker-card">
                  <div className="rank">#{talker.rank}</div>
                  <div className="talker-info">
                    <h4>{talker.ip}</h4>
                    <span className="direction-badge">{talker.direction === 'source' ? <><UIIcon symbol="📤" /></> : <><UIIcon symbol="📥" /></>} {talker.direction}</span>
                  </div>
                  <div className="talker-stats">
                    <div className="stat">
                      <span className="label">Bytes:</span>
                      <span className="value">{formatBytes(talker.bytes)}</span>
                    </div>
                    <div className="stat">
                      <span className="label">Packets:</span>
                      <span className="value">{talker.packets.toLocaleString()}</span>
                    </div>
                    <div className="stat">
                      <span className="label">Flows:</span>
                      <span className="value">{talker.flows}</span>
                    </div>
                    <div className="stat">
                      <span className="label">Protocol:</span>
                      <span className="value">{talker.protocol}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'applications' && (
          <div className="applications-section">
            <h3>Application Traffic Breakdown</h3>
            <div className="app-stats">
              {appStats.map(app => (
                <div key={app.name} className="app-item">
                  <div className="app-header">
                    <h4>{app.name}</h4>
                    <span className="percentage">{app.percentage}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${app.percentage}%` }}></div>
                  </div>
                  <div className="app-details">
                    <span className="detail"><UIIcon symbol="📦" /> {formatBytes(app.bytes)}</span>
                    <span className="detail"><UIIcon symbol="🚀" /> {app.packets.toLocaleString()} packets</span>
                    <span className="detail"><UIIcon symbol="🌐" /> {app.flows} flows</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flow-footer">
        <span className="collection-status">
          {isCollecting ? <><UIIcon symbol="🟢" /> NetFlow collection active</> : <><UIIcon symbol="🔴" /> NetFlow collection paused</>}
        </span>
        <span className="last-update">Updated: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
