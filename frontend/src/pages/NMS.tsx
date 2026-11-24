import { useState } from 'react';
import './NMS.css';

interface SNMPDevice {
  id: string;
  name: string;
  ip: string;
  type: string;
  status: 'online' | 'offline' | 'warning';
  uptime: string;
  cpuUsage: number;
  memoryUsage: number;
  interfaces: number;
}

const NMSIcon = ({ kind }: { kind: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'check' ? <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></> :
      kind === 'offline' ? <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></> :
      kind === 'plus' ? <path d="M12 5v14M5 12h14" /> :
      kind === 'scan' ? <><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 12h10" /><circle cx="12" cy="12" r="3" /></> :
      kind === 'chart' ? <><path d="M4 4v16h16M8 15v-4m4 4V7m4 8v-6" /></> :
      kind === 'settings' ? <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2" /><circle cx="15" cy="17" r="2" /></> :
      kind === 'Firewall' ? <><path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Z" /><path d="m9 12 2 2 4-4" /></> :
      <><rect x="3" y="8" width="18" height="9" rx="3" /><path d="M7 12h.01M11 12h.01M15 12h2M7 8V4m10 4V4M8 20h8" /></>}
  </svg>
);

export const NMS = () => {
  const [devices] = useState<SNMPDevice[]>([
    {
      id: '1',
      name: 'Core Router',
      ip: '192.168.1.1',
      type: 'Router',
      status: 'online',
      uptime: '45d 12h',
      cpuUsage: 23,
      memoryUsage: 45,
      interfaces: 24
    },
    {
      id: '2',
      name: 'Distribution Switch',
      ip: '192.168.1.2',
      type: 'Switch',
      status: 'online',
      uptime: '30d 5h',
      cpuUsage: 15,
      memoryUsage: 32,
      interfaces: 48
    },
    {
      id: '3',
      name: 'Firewall',
      ip: '192.168.1.254',
      type: 'Firewall',
      status: 'online',
      uptime: '90d 22h',
      cpuUsage: 56,
      memoryUsage: 78,
      interfaces: 4
    }
  ]);

  return (
    <div className="nms-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">MONITORING</div>
          <h1 className="page-title">Network Management System</h1>
          <p className="page-subtitle">SNMP-based device monitoring and management.</p>
        </div>
        <div className="header-actions">
          <button className="btn-primary">
            <NMSIcon kind="plus" /> Add Device
          </button>
          <button className="btn-secondary">
            <NMSIcon kind="scan" /> Scan Network
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon"><NMSIcon kind="network" /></div>
          <div className="stat-content">
            <div className="stat-label">SNMP DEVICES</div>
            <div className="stat-value">15</div>
          </div>
        </div>

        <div className="stat-card stat-success">
          <div className="stat-icon"><NMSIcon kind="check" /></div>
          <div className="stat-content">
            <div className="stat-label">ONLINE</div>
            <div className="stat-value">13</div>
          </div>
        </div>

        <div className="stat-card stat-danger">
          <div className="stat-icon"><NMSIcon kind="offline" /></div>
          <div className="stat-content">
            <div className="stat-label">OFFLINE</div>
            <div className="stat-value">2</div>
          </div>
        </div>

        <div className="stat-card stat-info">
          <div className="stat-icon"><NMSIcon kind="scan" /></div>
          <div className="stat-content">
            <div className="stat-label">INTERFACES</div>
            <div className="stat-value">284</div>
          </div>
        </div>
      </div>

      {/* Devices Grid */}
      <div className="nms-section-heading">
        <div><span className="nms-eyebrow">DEVICE INVENTORY</span><h2>Managed devices</h2></div>
        <span className="nms-device-count">{devices.length} devices displayed</span>
      </div>
      <div className="devices-grid">
        {devices.map((device) => (
          <div key={device.id} className="device-card noc-card">
            <div className="device-header">
              <div className="device-avatar"><NMSIcon kind={device.type} /></div>
              <div className="device-info">
                <h3 className="device-name">{device.name}</h3>
                <p className="device-ip">{device.ip}</p>
              </div>
              <span className={`status-indicator ${device.status}`}>
                <span className="device-status-dot" aria-hidden="true" />
                {device.status}
              </span>
            </div>

            <div className="device-type-badge">{device.type}</div>

            <div className="device-metrics">
              <div className="metric-row">
                <span className="metric-label">Uptime</span>
                <span className="metric-value">{device.uptime}</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">CPU Usage</span>
                <span className="metric-value">
                  {device.cpuUsage}%
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${device.cpuUsage}%` }}></div>
                  </div>
                </span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Memory</span>
                <span className="metric-value">
                  {device.memoryUsage}%
                  <div className="progress-bar">
                    <div className="progress-fill memory" style={{ width: `${device.memoryUsage}%` }}></div>
                  </div>
                </span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Interfaces</span>
                <span className="metric-value">{device.interfaces}</span>
              </div>
            </div>

            <div className="device-actions">
              <button className="action-btn"><NMSIcon kind="chart" /> View Stats</button>
              <button className="action-btn"><NMSIcon kind="settings" /> Configure</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
