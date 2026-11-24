import { UIIcon } from '../components/UIIcon';
import { useState } from 'react';
import './ServiceManagement.css';

interface Service {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'failed';
  enabled: boolean;
  autoStart: boolean;
  memory: number;
  cpu: number;
  uptime: string;
  restarts: number;
  lastRestart: string;
}

interface ServiceLog {
  id: string;
  service: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  message: string;
}

export default function ServiceManagement() {
  const [activeTab, setActiveTab] = useState('services');

  const [services, setServices] = useState<Service[]>([
    {
      id: 'kea-dhcp4',
      name: 'KEA DHCP4',
      status: 'running',
      enabled: true,
      autoStart: true,
      memory: 125,
      cpu: 2.5,
      uptime: '45 days, 12 hours',
      restarts: 0,
      lastRestart: '2026-08-06 14:30:00',
    },
    {
      id: 'dnsmasq',
      name: 'Dnsmasq',
      status: 'running',
      enabled: true,
      autoStart: true,
      memory: 45,
      cpu: 1.2,
      uptime: '45 days, 12 hours',
      restarts: 1,
      lastRestart: '2026-08-20 10:15:00',
    },
    {
      id: 'nginx',
      name: 'Nginx',
      status: 'running',
      enabled: true,
      autoStart: true,
      memory: 89,
      cpu: 0.8,
      uptime: '30 days, 5 hours',
      restarts: 2,
      lastRestart: '2026-08-21 09:45:00',
    },
    {
      id: 'postgresql',
      name: 'PostgreSQL',
      status: 'running',
      enabled: true,
      autoStart: true,
      memory: 456,
      cpu: 3.1,
      uptime: '15 days, 8 hours',
      restarts: 0,
      lastRestart: '2026-09-05 12:00:00',
    },
    {
      id: 'ssh',
      name: 'SSH Server',
      status: 'running',
      enabled: true,
      autoStart: true,
      memory: 32,
      cpu: 0.1,
      uptime: '45 days, 12 hours',
      restarts: 0,
      lastRestart: '2026-08-06 14:30:00',
    },
    {
      id: 'ntpd',
      name: 'NTP Daemon',
      status: 'stopped',
      enabled: false,
      autoStart: false,
      memory: 0,
      cpu: 0,
      uptime: '-',
      restarts: 5,
      lastRestart: '2026-09-10 08:20:00',
    },
  ]);

  const [logs, setLogs] = useState<ServiceLog[]>([
    {
      id: '1',
      service: 'kea-dhcp4',
      timestamp: '2026-09-20 06:35:12',
      level: 'info',
      message: 'DHCP lease assigned to 192.168.1.100 (MAC: aa:bb:cc:dd:ee:ff)',
    },
    {
      id: '2',
      service: 'nginx',
      timestamp: '2026-09-20 06:34:45',
      level: 'info',
      message: 'Connection from 203.0.113.45 - GET /api/v1/health 200',
    },
    {
      id: '3',
      service: 'postgresql',
      timestamp: '2026-09-20 06:32:10',
      level: 'warning',
      message: 'Cache size approaching limit (92% full)',
    },
    {
      id: '4',
      service: 'dnsmasq',
      timestamp: '2026-09-20 06:30:22',
      level: 'info',
      message: 'DNS query: google.com resolved to 142.251.41.14',
    },
    {
      id: '5',
      service: 'ssh',
      timestamp: '2026-09-20 06:28:15',
      level: 'info',
      message: 'Accepted publickey for admin from 192.168.1.50 port 54321',
    },
    {
      id: '6',
      service: 'kea-dhcp4',
      timestamp: '2026-09-20 06:25:00',
      level: 'error',
      message: 'Failed to bind to port 67 - Port already in use',
    },
  ]);

  const runningServices = services.filter(s => s.status === 'running').length;
  const totalMemory = services.reduce((sum, s) => sum + s.memory, 0);
  const totalCPU = services.reduce((sum, s) => sum + s.cpu, 0);

  return (
    <div className="service-management">
      <div className="service-header">
        <h1>Service Management</h1>
        <p className="service-subtitle">Manage systemd services and view logs</p>
      </div>

      <div className="service-stats">
        <div className="stat-card">
          <div className="stat-icon"><UIIcon symbol="🟢" /></div>
          <div className="stat-content">
            <div className="stat-label">Services Running</div>
            <div className="stat-value">{runningServices}/{services.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><UIIcon symbol="💾" /></div>
          <div className="stat-content">
            <div className="stat-label">Total Memory</div>
            <div className="stat-value">{totalMemory} MB</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><UIIcon symbol="⚡" /></div>
          <div className="stat-content">
            <div className="stat-label">Total CPU</div>
            <div className="stat-value">{totalCPU.toFixed(1)}%</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><UIIcon symbol="⚙️" /></div>
          <div className="stat-content">
            <div className="stat-label">Auto-Start Enabled</div>
            <div className="stat-value">{services.filter(s => s.autoStart).length}</div>
          </div>
        </div>
      </div>

      <div className="service-tabs">
        <button
          className={`service-tab ${activeTab === 'services' ? 'active' : ''}`}
          onClick={() => setActiveTab('services')}
        >
          <UIIcon symbol="⚙️" /> Services
        </button>
        <button
          className={`service-tab ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          <UIIcon symbol="📋" /> Logs
        </button>
      </div>

      <div className="service-content">
        {/* Services Tab */}
        {activeTab === 'services' && (
          <div className="service-section">
            <div className="services-table-container">
              <table className="services-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Status</th>
                    <th>Auto-Start</th>
                    <th>Memory (MB)</th>
                    <th>CPU (%)</th>
                    <th>Uptime</th>
                    <th>Restarts</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map(service => (
                    <tr key={service.id} className={`service-row ${service.status}`}>
                      <td className="service-name">
                        <span className={`status-dot ${service.status}`}></span>
                        {service.name}
                      </td>
                      <td className="service-status">
                        <span className={`status-badge ${service.status}`}>
                          {service.status === 'running' ? <><UIIcon symbol="🟢" /> Running</> : service.status === 'stopped' ? <><UIIcon symbol="🔴" /> Stopped</> : <><UIIcon symbol="🟠" /> Failed</>}
                        </span>
                      </td>
                      <td className="auto-start">
                        <input type="checkbox" checked={service.autoStart} readOnly />
                      </td>
                      <td className="memory">{service.memory} MB</td>
                      <td className="cpu">{service.cpu}%</td>
                      <td className="uptime">{service.uptime}</td>
                      <td className="restarts">{service.restarts}</td>
                      <td className="actions">
                        <button className="action-btn" title="Start"><UIIcon symbol="▶️" /></button>
                        <button className="action-btn" title="Stop"><UIIcon symbol="⏹️" /></button>
                        <button className="action-btn" title="Restart"><UIIcon symbol="🔄" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="service-section">
            <div className="logs-container">
              <div className="logs-header">
                <h3>Service Logs</h3>
                <button className="clear-logs-btn">Clear Logs</button>
              </div>
              <div className="logs-list">
                {logs.map(log => (
                  <div key={log.id} className={`log-entry ${log.level}`}>
                    <div className="log-timestamp">{log.timestamp}</div>
                    <div className="log-service">{log.service}</div>
                    <div className={`log-level ${log.level}`}>
                      {log.level === 'error' ? <><UIIcon symbol="❌" /></> : log.level === 'warning' ? <><UIIcon symbol="⚠️" /></> : <><UIIcon symbol="ℹ️" /></>} {log.level.toUpperCase()}
                    </div>
                    <div className="log-message">{log.message}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
