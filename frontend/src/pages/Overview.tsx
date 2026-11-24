import { UIIcon } from '../components/UIIcon';
import { useEffect, useState } from 'react';
import './Overview.css';

function RadarTrafficChart() {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (loaded || failed) return undefined;
    const timer = window.setTimeout(() => setFailed(true), 12_000);
    return () => window.clearTimeout(timer);
  }, [loaded, failed]);

  return (
    <section className={`card radar-traffic-card${loaded && !failed ? ' is-visible' : ''}`} aria-labelledby="radar-traffic-title" aria-hidden={!loaded || failed}>
      <div className="radar-traffic-heading">
        <div>
          <span className="radar-traffic-eyebrow">Cloudflare Radar · Iran</span>
          <h2 id="radar-traffic-title">Traffic volume in Iran</h2>
          <p>Relative change from the previous 7-day period</p>
        </div>
        {loaded && !failed && <a className="radar-source-link" href="https://radar.cloudflare.com/traffic/ir" target="_blank" rel="noreferrer">Open Radar ↗</a>}
      </div>
      <iframe
        className="radar-traffic-embed"
        title="Cloudflare Radar traffic volume in Iran"
        src="https://radar.cloudflare.com/embed/TrafficVolumeXY?theme=system&dateRange=7d&location=IR&ref=%2Ftraffic%2Fir"
        loading="eager"
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => { if (!failed) setLoaded(true); }}
        onError={() => setFailed(true)}
      />
    </section>
  );
}

interface Stats {
  totalDevices: number;
  online: number;
  offline: number;
  warning: number;
  avgLatency: number;
  dataCenters: number;
  activeAlerts: number;
  bandwidth: number;
}

interface Device {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline' | 'warning';
  latency: number;
  uptime: number;
  location: string;
}

interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
  device: string;
}

export const Overview = () => {
  const [stats, setStats] = useState<Stats>({
    totalDevices: 156,
    online: 148,
    offline: 2,
    warning: 6,
    avgLatency: 12,
    dataCenters: 4,
    activeAlerts: 3,
    bandwidth: 847.2
  });

  const [cpuUsage, setCpuUsage] = useState(34.2);
  const [memoryUsage, setMemoryUsage] = useState(58.4);
  const [networkRx, setNetworkRx] = useState(423.5);
  const [networkTx, setNetworkTx] = useState(156.8);

  const [recentDevices] = useState<Device[]>([
    { id: '1', name: 'core-router-01', type: 'Router', status: 'online', latency: 8, uptime: 99.9, location: 'DC-1' },
    { id: '2', name: 'switch-access-12', type: 'Switch', status: 'online', latency: 5, uptime: 100, location: 'DC-1' },
    { id: '3', name: 'firewall-edge-02', type: 'Firewall', status: 'warning', latency: 45, uptime: 98.2, location: 'DC-2' },
    { id: '4', name: 'vpn-gateway-01', type: 'VPN', status: 'online', latency: 12, uptime: 99.7, location: 'DC-1' },
    { id: '5', name: 'load-balancer-03', type: 'Load Balancer', status: 'offline', latency: 0, uptime: 0, location: 'DC-3' },
  ]);

  const [recentAlerts] = useState<Alert[]>([
    { id: '1', severity: 'critical', message: 'High packet loss detected on core-router-03', timestamp: '2 min ago', device: 'core-router-03' },
    { id: '2', severity: 'warning', message: 'CPU usage above 80% on firewall-edge-02', timestamp: '15 min ago', device: 'firewall-edge-02' },
    { id: '3', severity: 'info', message: 'Firmware update available for switch-access-05', timestamp: '1 hour ago', device: 'switch-access-05' },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCpuUsage(prev => Math.max(10, Math.min(95, prev + (Math.random() - 0.5) * 15)));
      setMemoryUsage(prev => Math.max(30, Math.min(90, prev + (Math.random() - 0.5) * 8)));
      setNetworkRx(prev => Math.max(100, prev + (Math.random() - 0.5) * 80));
      setNetworkTx(prev => Math.max(50, prev + (Math.random() - 0.5) * 40));

      setStats(prev => ({
        ...prev,
        bandwidth: Math.max(500, prev.bandwidth + (Math.random() - 0.5) * 100),
        avgLatency: Math.max(5, Math.min(50, prev.avgLatency + (Math.random() - 0.5) * 3))
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return '🟢';
      case 'offline': return '🔴';
      case 'warning': return '🟡';
      default: return '⚪';
    }
  };

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'critical': return 'alert-critical';
      case 'warning': return 'alert-warning';
      case 'info': return 'alert-info';
      default: return '';
    }
  };

  return (
    <div className="overview-page">
      <div className="overview-header">
        <div className="header-content">
          <div className="breadcrumb">Network Operations Center</div>
          <h1 className="page-title">Network Overview</h1>
          <p className="page-subtitle">Real-time monitoring and analytics for your entire infrastructure</p>
        </div>
        <div className="header-actions">
          <button className="action-btn secondary">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Add Device
          </button>
          <button className="action-btn primary">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M17 10L13 6M17 10L13 14M17 10H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            View All
          </button>
        </div>
      </div>

      <RadarTrafficChart />

      <div className="stats-overview">
        <div className="stat-card primary">
          <div className="stat-icon-wrapper">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="4" y="4" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 12H20M12 16H20M12 20H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Devices</div>
            <div className="stat-value">{stats.totalDevices}</div>
            <div className="stat-trend positive">+12 this month</div>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon-wrapper">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2"/>
              <path d="M11 16L14 19L21 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">Online</div>
            <div className="stat-value">{stats.online}</div>
            <div className="stat-trend">{((stats.online / stats.totalDevices) * 100).toFixed(1)}% uptime</div>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon-wrapper">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M16 6L28 26H4L16 6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M16 12V18M16 22V22.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">Warnings</div>
            <div className="stat-value">{stats.warning}</div>
            <div className="stat-trend">Needs attention</div>
          </div>
        </div>

        <div className="stat-card danger">
          <div className="stat-icon-wrapper">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 12L20 20M20 12L12 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">Offline</div>
            <div className="stat-value">{stats.offline}</div>
            <div className="stat-trend negative">Critical</div>
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-icon-wrapper">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M4 12L16 4L28 12V26H4V12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              <rect x="12" y="18" width="8" height="8" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">Data Centers</div>
            <div className="stat-value">{stats.dataCenters}</div>
            <div className="stat-trend">All operational</div>
          </div>
        </div>

        <div className="stat-card accent">
          <div className="stat-icon-wrapper">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M4 20L16 28L28 20M4 12L16 20L28 12M16 4L28 12L16 20L4 12L16 4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">Avg Latency</div>
            <div className="stat-value">{stats.avgLatency.toFixed(1)}ms</div>
            <div className="stat-trend positive">Excellent</div>
          </div>
        </div>
      </div>

      <div className="content-grid">
        <div className="main-content">
          <div className="card system-metrics">
            <div className="card-header">
              <h3>System Metrics</h3>
              <div className="time-indicator">
                <span className="pulse-dot"></span>
                Live
              </div>
            </div>
            <div className="metrics-grid">
              <div className="metric-item">
                <div className="metric-header">
                  <span className="metric-label">CPU Usage</span>
                  <span className="metric-value">{cpuUsage.toFixed(1)}%</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill cpu"
                    style={{ width: `${cpuUsage}%` }}
                  ></div>
                </div>
              </div>

              <div className="metric-item">
                <div className="metric-header">
                  <span className="metric-label">Memory Usage</span>
                  <span className="metric-value">{memoryUsage.toFixed(1)}%</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill memory"
                    style={{ width: `${memoryUsage}%` }}
                  ></div>
                </div>
              </div>

              <div className="metric-item">
                <div className="metric-header">
                  <span className="metric-label">Network RX</span>
                  <span className="metric-value">{networkRx.toFixed(1)} KB/s</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill network-rx"
                    style={{ width: `${Math.min((networkRx / 1000) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="metric-item">
                <div className="metric-header">
                  <span className="metric-label">Network TX</span>
                  <span className="metric-value">{networkTx.toFixed(1)} KB/s</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill network-tx"
                    style={{ width: `${Math.min((networkTx / 1000) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div className="card devices-list">
            <div className="card-header">
              <h3>Recent Devices</h3>
              <button className="link-btn">View All →</button>
            </div>
            <div className="devices-table">
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Device</th>
                    <th>Type</th>
                    <th>Location</th>
                    <th>Latency</th>
                    <th>Uptime</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDevices.map(device => (
                    <tr key={device.id} className={`device-row ${device.status}`}>
                      <td>
                        <span className={`status-badge ${device.status}`}>
                          {<UIIcon symbol={getStatusIcon(device.status)} />}
                        </span>
                      </td>
                      <td className="device-name">{device.name}</td>
                      <td>{device.type}</td>
                      <td>{device.location}</td>
                      <td>{device.latency > 0 ? `${device.latency}ms` : '—'}</td>
                      <td>{device.uptime > 0 ? `${device.uptime}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="sidebar">
          <div className="card alerts-card">
            <div className="card-header">
              <h3>Active Alerts</h3>
              <span className="alert-count">{stats.activeAlerts}</span>
            </div>
            <div className="alerts-list">
              {recentAlerts.map(alert => (
                <div key={alert.id} className={`alert-item ${getSeverityClass(alert.severity)}`}>
                  <div className="alert-icon">
                    {alert.severity === 'critical' && '🔴'}
                    {alert.severity === 'warning' && '🟡'}
                    {alert.severity === 'info' && '🔵'}
                  </div>
                  <div className="alert-content">
                    <div className="alert-message">{alert.message}</div>
                    <div className="alert-meta">
                      <span className="alert-device">{alert.device}</span>
                      <span className="alert-time">{alert.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button className="view-all-btn">View All Alerts</button>
          </div>

          <div className="card bandwidth-card">
            <div className="card-header">
              <h3>Bandwidth Usage</h3>
            </div>
            <div className="bandwidth-display">
              <div className="bandwidth-value">{stats.bandwidth.toFixed(1)}</div>
              <div className="bandwidth-unit">Mbps</div>
              <div className="bandwidth-graph">
                <div className="graph-bar" style={{ height: '40%' }}></div>
                <div className="graph-bar" style={{ height: '65%' }}></div>
                <div className="graph-bar" style={{ height: '45%' }}></div>
                <div className="graph-bar" style={{ height: '80%' }}></div>
                <div className="graph-bar" style={{ height: '70%' }}></div>
                <div className="graph-bar" style={{ height: '55%' }}></div>
                <div className="graph-bar" style={{ height: '90%' }}></div>
                <div className="graph-bar" style={{ height: '75%' }}></div>
              </div>
            </div>
          </div>

          <div className="card quick-actions">
            <div className="card-header">
              <h3>Quick Actions</h3>
            </div>
            <div className="actions-list">
              <button className="quick-action-btn">
                <span className="action-icon"><UIIcon symbol="🔍" /></span>
                <span>Run Discovery</span>
              </button>
              <button className="quick-action-btn">
                <span className="action-icon"><UIIcon symbol="📊" /></span>
                <span>Generate Report</span>
              </button>
              <button className="quick-action-btn">
                <span className="action-icon"><UIIcon symbol="⚙️" /></span>
                <span>System Settings</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
