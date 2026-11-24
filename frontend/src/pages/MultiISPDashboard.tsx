import { UIIcon } from '../components/UIIcon';
import React, { useState, useEffect } from 'react';
import './MultiISPDashboard.css';

interface ISP {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  primary_dns: string;
  secondary_dns: string;
  gateway: string;
  interface: string;
  connection_type: string;
  priority: number;
  bandwidth_mbps: number;
  created_at: string;
  updated_at: string;
}

interface ISPConnection {
  id: string;
  isp_id: string;
  isp_name: string;
  status: string;
  ip_address: string;
  public_ip: string;
  latency_ms: number;
  packet_loss_percent: number;
  bandwidth_mbps: number;
  uptime: string;
  last_updated: string;
}

interface ISPTraffic {
  id: string;
  isp_id: string;
  isp_name: string;
  rx_bps_now: number;
  tx_bps_now: number;
  rx_bps_avg: number;
  tx_bps_avg: number;
  rx_bps_max: number;
  tx_bps_max: number;
  total_rx_bytes: number;
  total_tx_bytes: number;
  timestamp: string;
}

interface ISPHealthCheck {
  id: string;
  isp_id: string;
  isp_name: string;
  check_type: string;
  target: string;
  status: string;
  latency_ms: number;
  last_check: string;
  consecutive_fails: number;
}

interface ISPDiagnostics {
  id: string;
  isp_id: string;
  isp_name: string;
  ping_target: string;
  avg_latency_ms: number;
  packet_loss_percent: number;
  jitter_ms: number;
  dns_resolution_ms: number;
  http_latency_ms: number;
  timestamp: string;
}

interface ISPMetrics {
  id: string;
  isp_id: string;
  isp_name: string;
  connection_time: string;
  uptime: string;
  uptime_percent: number;
  avg_latency_ms: number;
  avg_packet_loss_percent: number;
  total_data_used_bytes: number;
  cost_per_gb: number;
  monthly_data_gb: number;
}

export default function MultiISPDashboard() {
  const [isps, setISPs] = useState<ISP[]>([]);
  const [connections, setConnections] = useState<ISPConnection[]>([]);
  const [traffic, setTraffic] = useState<ISPTraffic[]>([]);
  const [healthChecks, setHealthChecks] = useState<ISPHealthCheck[]>([]);
  const [diagnostics, setDiagnostics] = useState<ISPDiagnostics[]>([]);
  const [metrics, setMetrics] = useState<ISPMetrics[]>([]);
  const [failover, setFailover] = useState<any>(null);
  const [loadBalancing, setLoadBalancing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedISP, setSelectedISP] = useState<string | null>(null);

  useEffect(() => {
    fetchAllISPData();
    const interval = setInterval(fetchAllISPData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchAllISPData = async () => {
    try {
      const [ispList, conn, trfc, health, diag, met, failov, lb] = await Promise.all([
        fetch('/api/v1/tools/isp/list').then(r => r.json()),
        fetch('/api/v1/tools/isp/connections').then(r => r.json()),
        fetch('/api/v1/tools/isp/traffic').then(r => r.json()),
        fetch('/api/v1/tools/isp/health-checks').then(r => r.json()),
        fetch('/api/v1/tools/isp/diagnostics').then(r => r.json()),
        fetch('/api/v1/tools/isp/metrics').then(r => r.json()),
        fetch('/api/v1/tools/isp/failover').then(r => r.json()),
        fetch('/api/v1/tools/isp/load-balancing').then(r => r.json()),
      ]);

      setISPs(ispList.isps || []);
      setConnections(conn.connections || []);
      setTraffic(trfc.traffic || []);
      setHealthChecks(health.checks || []);
      setDiagnostics(diag.diagnostics || []);
      setMetrics(met.metrics || []);
      setFailover(failov.failovers?.[0]);
      setLoadBalancing(lb.load_balancers?.[0]);
      setLoading(false);

      if (!selectedISP && ispList.isps?.length > 0) {
        setSelectedISP(ispList.isps[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch ISP data:', error);
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'connected':
      case 'active':
      case 'success':
        return '#10B981';
      case 'disconnected':
      case 'inactive':
      case 'failed':
        return '#EF4444';
      case 'connecting':
      case 'maintenance':
        return '#F59E0B';
      default:
        return '#3B82F6';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatBps = (bps: number) => {
    if (bps === 0) return '0 bps';
    if (bps < 1000000) return (bps / 1000).toFixed(1) + ' Kbps';
    if (bps < 1000000000) return (bps / 1000000).toFixed(1) + ' Mbps';
    return (bps / 1000000000).toFixed(1) + ' Gbps';
  };

  if (loading) {
    return (
      <div className="multi-isp loading">
        <div className="loading-spinner">
          <div></div>
          <p>Loading Multi-ISP Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="multi-isp">
      <div className="isp-header">
        <h1><UIIcon symbol="🌐" /> Multi-ISP Management Dashboard</h1>
        <p className="subtitle">Manage, Monitor & Balance Multiple ISPs (MCI, Irancell, Rightel, etc.)</p>
      </div>

      <div className="tabs-container">
        {['overview', 'connections', 'traffic', 'health', 'diagnostics', 'metrics', 'failover', 'load-balancing'].map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
          </button>
        ))}
      </div>

      <div className="isp-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="section">
            <h2>ISP Overview</h2>
            <div className="overview-grid">
              <div className="stat-card">
                <div className="stat-icon"><UIIcon symbol="🌍" /></div>
                <div className="stat-info">
                  <p className="stat-label">Total ISPs</p>
                  <p className="stat-value">{isps.length}</p>
                  <p className="stat-detail">
                    {isps.filter(i => i.status === 'active').length} Active
                  </p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><UIIcon symbol="🔗" /></div>
                <div className="stat-info">
                  <p className="stat-label">Connected</p>
                  <p className="stat-value">
                    {connections.filter(c => c.status === 'connected').length}
                  </p>
                  <p className="stat-detail">
                    {connections.length} Total
                  </p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><UIIcon symbol="⚡" /></div>
                <div className="stat-info">
                  <p className="stat-label">Avg Latency</p>
                  <p className="stat-value">
                    {(connections.reduce((sum, c) => sum + c.latency_ms, 0) / connections.length).toFixed(1)}ms
                  </p>
                  <p className="stat-detail">Across all ISPs</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><UIIcon symbol="📡" /></div>
                <div className="stat-info">
                  <p className="stat-label">Total Bandwidth</p>
                  <p className="stat-value">
                    {isps.reduce((sum, i) => sum + i.bandwidth_mbps, 0)}
                  </p>
                  <p className="stat-detail">Mbps combined</p>
                </div>
              </div>
            </div>

            {/* ISP Cards */}
            <div className="isp-cards">
              <h3>Registered ISPs</h3>
              <div className="cards-grid">
                {isps.map((isp) => {
                  const conn = connections.find(c => c.isp_id === isp.id);
                  return (
                    <div
                      key={isp.id}
                      className={`isp-card ${conn?.status === 'connected' ? 'connected' : 'disconnected'}`}
                      onClick={() => setSelectedISP(isp.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="card-header">
                        <h4>{isp.name}</h4>
                        <span className="isp-code">{isp.code}</span>
                      </div>
                      <div className="card-details">
                        <p>
                          <strong>Type:</strong> {isp.type}
                        </p>
                        <p>
                          <strong>Connection:</strong> {isp.connection_type}
                        </p>
                        <p>
                          <strong>Bandwidth:</strong> {isp.bandwidth_mbps} Mbps
                        </p>
                        <p>
                          <strong>Priority:</strong> {isp.priority}
                        </p>
                      </div>
                      {conn && (
                        <div className="card-status">
                          <span
                            className="status-indicator"
                            style={{ color: getStatusColor(conn.status) }}
                          >
                            ● {conn.status.toUpperCase()}
                          </span>
                          <p className="ip-address">{conn.public_ip}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Connections Tab */}
        {activeTab === 'connections' && (
          <div className="section">
            <h2>ISP Connections Status</h2>
            <div className="managed-table-scroll" role="region" aria-label="ISP connections table" tabIndex={0}>
            <table className="connections-table">
              <thead>
                <tr>
                  <th>ISP Name</th>
                  <th>Status</th>
                  <th>Local IP</th>
                  <th>Public IP</th>
                  <th>Latency</th>
                  <th>Loss</th>
                  <th>Bandwidth</th>
                  <th>Uptime</th>
                </tr>
              </thead>
              <tbody>
                {connections.map((conn) => (
                  <tr key={conn.id}>
                    <td><strong>{conn.isp_name}</strong></td>
                    <td>
                      <span
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(conn.status) }}
                      >
                        {conn.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="ip-cell">{conn.ip_address}</td>
                    <td className="ip-cell">{conn.public_ip}</td>
                    <td>{conn.latency_ms}ms</td>
                    <td style={{ color: conn.packet_loss_percent > 1 ? '#EF4444' : '#10B981' }}>
                      {conn.packet_loss_percent.toFixed(2)}%
                    </td>
                    <td>{conn.bandwidth_mbps} Mbps</td>
                    <td>{conn.uptime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* Traffic Tab */}
        {activeTab === 'traffic' && (
          <div className="section">
            <h2>Real-Time Traffic Analysis</h2>
            <div className="traffic-cards">
              {traffic.map((t) => (
                <div key={t.id} className="traffic-card">
                  <h3>{t.isp_name}</h3>
                  <div className="traffic-metrics">
                    <div className="metric-row">
                      <span className="label">↓ RX Now</span>
                      <span className="value">{formatBps(t.rx_bps_now)}</span>
                    </div>
                    <div className="metric-row">
                      <span className="label">↑ TX Now</span>
                      <span className="value">{formatBps(t.tx_bps_now)}</span>
                    </div>
                    <div className="metric-row">
                      <span className="label">↓ RX Avg</span>
                      <span className="value">{formatBps(t.rx_bps_avg)}</span>
                    </div>
                    <div className="metric-row">
                      <span className="label">↑ TX Avg</span>
                      <span className="value">{formatBps(t.tx_bps_avg)}</span>
                    </div>
                    <div className="metric-row">
                      <span className="label">↓ RX Max</span>
                      <span className="value">{formatBps(t.rx_bps_max)}</span>
                    </div>
                    <div className="metric-row">
                      <span className="label">↑ TX Max</span>
                      <span className="value">{formatBps(t.tx_bps_max)}</span>
                    </div>
                    <div className="metric-row">
                      <span className="label">Total RX</span>
                      <span className="value">{formatBytes(t.total_rx_bytes)}</span>
                    </div>
                    <div className="metric-row">
                      <span className="label">Total TX</span>
                      <span className="value">{formatBytes(t.total_tx_bytes)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Health Checks Tab */}
        {activeTab === 'health' && (
          <div className="section">
            <h2>Health Check Status</h2>
            <div className="health-checks">
              {healthChecks.map((check) => (
                <div key={check.id} className="health-card">
                  <div className="health-header">
                    <h4>{check.isp_name}</h4>
                    <span
                      className="health-status"
                      style={{ backgroundColor: getStatusColor(check.status) }}
                    >
                      {check.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="health-details">
                    <p>
                      <strong>Check Type:</strong> {check.check_type.toUpperCase()}
                    </p>
                    <p>
                      <strong>Target:</strong> {check.target}
                    </p>
                    <p>
                      <strong>Latency:</strong> {check.latency_ms}ms
                    </p>
                    <p>
                      <strong>Consecutive Fails:</strong> {check.consecutive_fails}
                    </p>
                    <p>
                      <strong>Last Check:</strong> {new Date(check.last_check).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Diagnostics Tab */}
        {activeTab === 'diagnostics' && (
          <div className="section">
            <h2>Network Diagnostics</h2>
            <div className="diagnostics-grid">
              {diagnostics.map((diag) => (
                <div key={diag.id} className="diagnostic-card">
                  <h3>{diag.isp_name}</h3>
                  <div className="diag-metrics">
                    <div className="metric">
                      <span className="label">Ping Target</span>
                      <span className="value">{diag.ping_target}</span>
                    </div>
                    <div className="metric">
                      <span className="label">Avg Latency</span>
                      <span className="value">{diag.avg_latency_ms.toFixed(2)}ms</span>
                    </div>
                    <div className="metric">
                      <span className="label">Packet Loss</span>
                      <span className="value">{diag.packet_loss_percent.toFixed(2)}%</span>
                    </div>
                    <div className="metric">
                      <span className="label">Jitter</span>
                      <span className="value">{diag.jitter_ms.toFixed(2)}ms</span>
                    </div>
                    <div className="metric">
                      <span className="label">DNS Resolution</span>
                      <span className="value">{diag.dns_resolution_ms}ms</span>
                    </div>
                    <div className="metric">
                      <span className="label">HTTP Latency</span>
                      <span className="value">{diag.http_latency_ms}ms</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metrics Tab */}
        {activeTab === 'metrics' && (
          <div className="section">
            <h2>ISP Performance Metrics</h2>
            <div className="metrics-list">
              {metrics.map((metric) => (
                <div key={metric.id} className="metric-card">
                  <div className="metric-header">
                    <h3>{metric.isp_name}</h3>
                  </div>
                  <div className="metric-grid">
                    <div className="metric-item">
                      <span className="label">Uptime</span>
                      <span className="value">{metric.uptime}</span>
                      <span className="detail">{metric.uptime_percent.toFixed(2)}%</span>
                    </div>
                    <div className="metric-item">
                      <span className="label">Avg Latency</span>
                      <span className="value">{metric.avg_latency_ms.toFixed(2)}ms</span>
                    </div>
                    <div className="metric-item">
                      <span className="label">Avg Packet Loss</span>
                      <span className="value">{metric.avg_packet_loss_percent.toFixed(3)}%</span>
                    </div>
                    <div className="metric-item">
                      <span className="label">Total Data Used</span>
                      <span className="value">{formatBytes(metric.total_data_used_bytes)}</span>
                    </div>
                    <div className="metric-item">
                      <span className="label">Monthly Data</span>
                      <span className="value">{metric.monthly_data_gb} GB</span>
                    </div>
                    <div className="metric-item">
                      <span className="label">Cost per GB</span>
                      <span className="value">${metric.cost_per_gb.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Failover Tab */}
        {activeTab === 'failover' && failover && (
          <div className="section">
            <h2>Failover Configuration</h2>
            <div className="failover-card">
              <h3>{failover.name}</h3>
              <div className="failover-details">
                <div className="detail-row">
                  <span className="label">Primary ISP:</span>
                  <span className="value">
                    {isps.find(i => i.id === failover.primary_isp)?.name}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">Backup ISP:</span>
                  <span className="value">
                    {isps.find(i => i.id === failover.backup_isp)?.name}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">Status:</span>
                  <span
                    className="value"
                    style={{ color: failover.enabled ? '#10B981' : '#EF4444' }}
                  >
                    {failover.enabled ? '✓ Enabled' : '✗ Disabled'}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">Current Active:</span>
                  <span className="value">
                    {isps.find(i => i.id === failover.current_active)?.name}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">Health Check Interval:</span>
                  <span className="value">{failover.health_check_interval_seconds}s</span>
                </div>
                <div className="detail-row">
                  <span className="label">Failover Count:</span>
                  <span className="value">{failover.failover_count}</span>
                </div>
                {failover.last_failover && (
                  <div className="detail-row">
                    <span className="label">Last Failover:</span>
                    <span className="value">
                      {new Date(failover.last_failover).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Load Balancing Tab */}
        {activeTab === 'load-balancing' && loadBalancing && (
          <div className="section">
            <h2>Load Balancing Configuration</h2>
            <div className="lb-card">
              <h3>{loadBalancing.name}</h3>
              <div className="lb-details">
                <div className="detail-row">
                  <span className="label">Algorithm:</span>
                  <span className="value">{loadBalancing.algorithm}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Status:</span>
                  <span
                    className="value"
                    style={{
                      color: loadBalancing.status === 'active' ? '#10B981' : '#EF4444',
                    }}
                  >
                    {loadBalancing.status.toUpperCase()}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">Active Connections:</span>
                  <span className="value">{loadBalancing.active_connections}</span>
                </div>
              </div>

              <div className="weights-table">
                <h4>ISP Weights</h4>
                <table>
                  <thead>
                    <tr>
                      <th>ISP</th>
                      <th>Weight</th>
                      <th>Distribution %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadBalancing.isp_ids.map((ispId: string) => {
                      const weight = loadBalancing.weights[ispId];
                      const totalWeight = Object.values(loadBalancing.weights).reduce((a, b) => (a as number) + (b as number), 0 as number) as number;
                      const percentage = ((weight / totalWeight) * 100).toFixed(1);
                      return (
                        <tr key={ispId}>
                          <td>{isps.find(i => i.id === ispId)?.name}</td>
                          <td>{weight}</td>
                          <td>{percentage}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
