import { UIIcon } from '../components/UIIcon';
import { useState, useEffect } from 'react';
import './SystemDashboard.css';

interface SystemStats {
  cpu: number;
  memory: number;
  disk: number;
  uptime: string;
  hostname: string;
  os: string;
  kernel: string;
}

interface NetworkInterface {
  name: string;
  rxMbps: number;
  txMbps: number;
  status: 'up' | 'down';
  ipAddress: string;
}

interface HardwareInfo {
  cpus: number;
  totalMemory: number;
  totalDisk: number;
  motherboard: string;
}

export default function SystemDashboard() {
  const [stats, setStats] = useState<SystemStats>({
    cpu: 72,
    memory: 58,
    disk: 45,
    uptime: '45 days, 12 hours, 30 minutes',
    hostname: 'netmon-router-01',
    os: 'Linux (Ubuntu 22.04 LTS)',
    kernel: '5.15.0-56-generic',
  });

  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([
    { name: 'eth0', rxMbps: 125, txMbps: 45, status: 'up', ipAddress: '203.0.113.1' },
    { name: 'eth1', rxMbps: 85, txMbps: 32, status: 'up', ipAddress: '192.168.1.1' },
    { name: 'eth2', rxMbps: 0, txMbps: 0, status: 'down', ipAddress: '10.0.0.1' },
    { name: 'wlan0', rxMbps: 25, txMbps: 8, status: 'up', ipAddress: '172.16.0.1' },
  ]);

  const [hardware, setHardware] = useState<HardwareInfo>({
    cpus: 16,
    totalMemory: 32,
    totalDisk: 2000,
    motherboard: 'ASUS ROG STRIX Z790',
  });

  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        cpu: Math.max(20, Math.min(90, prev.cpu + (Math.random() - 0.5) * 10)),
        memory: Math.max(30, Math.min(85, prev.memory + (Math.random() - 0.5) * 5)),
        disk: prev.disk,
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const ProgressBar = ({ value, label }: { value: number; label: string }) => {
    const filledBlocks = Math.round((value / 100) * 10);
    const emptyBlocks = 10 - filledBlocks;
    return (
      <div className="progress-item">
        <span className="progress-label">{label}</span>
        <div className="progress-bar">
          {'█'.repeat(filledBlocks)}
          {'░'.repeat(emptyBlocks)}
        </div>
        <span className="progress-value">{Math.round(value)}%</span>
      </div>
    );
  };

  return (
    <div className="system-dashboard">
      <div className="system-header">
        <h1>System Dashboard</h1>
        <p className="system-subtitle">Real-time system monitoring and management</p>
      </div>

      <div className="system-tabs">
        <button
          className={`system-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <UIIcon symbol="📊" /> Overview
        </button>
        <button
          className={`system-tab ${activeTab === 'resources' ? 'active' : ''}`}
          onClick={() => setActiveTab('resources')}
        >
          <UIIcon symbol="⚙️" /> Resources
        </button>
        <button
          className={`system-tab ${activeTab === 'network' ? 'active' : ''}`}
          onClick={() => setActiveTab('network')}
        >
          <UIIcon symbol="🌐" /> Network
        </button>
        <button
          className={`system-tab ${activeTab === 'hardware' ? 'active' : ''}`}
          onClick={() => setActiveTab('hardware')}
        >
          <UIIcon symbol="🖥️" /> Hardware
        </button>
      </div>

      <div className="system-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="system-section">
            <div className="overview-cards">
              <div className="overview-card">
                <h3>Server Status</h3>
                <div className="status-content">
                  <ProgressBar value={stats.cpu} label="CPU" />
                  <ProgressBar value={stats.memory} label="Memory" />
                  <ProgressBar value={stats.disk} label="Disk" />
                  <div className="status-info">
                    <p><strong>Uptime:</strong> {stats.uptime}</p>
                    <p><strong>Hostname:</strong> {stats.hostname}</p>
                    <p><strong>OS:</strong> {stats.os}</p>
                    <p><strong>Kernel:</strong> {stats.kernel}</p>
                  </div>
                </div>
              </div>

              <div className="overview-card">
                <h3>Network Activity</h3>
                <div className="network-summary">
                  {interfaces.slice(0, 2).map(iface => (
                    <div key={iface.name} className="network-item">
                      <div className="network-name">
                        <span className={`status-dot ${iface.status}`}></span>
                        {iface.name}
                      </div>
                      <div className="network-stats">
                        <div className="network-stat">RX: {iface.rxMbps} Mbps</div>
                        <div className="network-stat">TX: {iface.txMbps} Mbps</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overview-card">
                <h3>Quick Stats</h3>
                <div className="quick-stats">
                  <div className="stat-box">
                    <div className="stat-icon"><UIIcon symbol="📈" /></div>
                    <div className="stat-text">
                      <div className="stat-label">Avg CPU</div>
                      <div className="stat-value">{Math.round(stats.cpu)}%</div>
                    </div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-icon"><UIIcon symbol="💾" /></div>
                    <div className="stat-text">
                      <div className="stat-label">RAM Used</div>
                      <div className="stat-value">{Math.round(stats.memory)}%</div>
                    </div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-icon"><UIIcon symbol="💿" /></div>
                    <div className="stat-text">
                      <div className="stat-label">Disk Used</div>
                      <div className="stat-value">{Math.round(stats.disk)}%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Resources Tab */}
        {activeTab === 'resources' && (
          <div className="system-section">
            <div className="resources-grid">
              <div className="resource-card">
                <h3>CPU Usage</h3>
                <div className="large-progress">
                  <div className="large-bar" style={{ width: `${stats.cpu}%` }}></div>
                </div>
                <div className="resource-details">
                  <p>Current: {Math.round(stats.cpu)}%</p>
                  <p>Cores: {hardware.cpus}</p>
                  <p>Load Average: 4.5, 3.8, 3.2</p>
                </div>
              </div>

              <div className="resource-card">
                <h3>Memory Usage</h3>
                <div className="large-progress">
                  <div className="large-bar" style={{ width: `${stats.memory}%` }}></div>
                </div>
                <div className="resource-details">
                  <p>Used: {Math.round(hardware.totalMemory * stats.memory / 100)} GB</p>
                  <p>Total: {hardware.totalMemory} GB</p>
                  <p>Available: {Math.round(hardware.totalMemory * (100 - stats.memory) / 100)} GB</p>
                </div>
              </div>

              <div className="resource-card">
                <h3>Disk Usage</h3>
                <div className="large-progress">
                  <div className="large-bar" style={{ width: `${stats.disk}%` }}></div>
                </div>
                <div className="resource-details">
                  <p>Used: {Math.round(hardware.totalDisk * stats.disk / 100)} GB</p>
                  <p>Total: {hardware.totalDisk} GB</p>
                  <p>Free: {Math.round(hardware.totalDisk * (100 - stats.disk) / 100)} GB</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Network Tab */}
        {activeTab === 'network' && (
          <div className="system-section">
            <div className="network-table-container">
              <h3>Network Interfaces</h3>
              <table className="network-table">
                <thead>
                  <tr>
                    <th>Interface</th>
                    <th>Status</th>
                    <th>IP Address</th>
                    <th>RX (Mbps)</th>
                    <th>TX (Mbps)</th>
                    <th>Total Traffic</th>
                  </tr>
                </thead>
                <tbody>
                  {interfaces.map(iface => (
                    <tr key={iface.name} className={`interface-row ${iface.status}`}>
                      <td className="interface-name">{iface.name}</td>
                      <td>
                        <span className={`status-badge ${iface.status}`}>
                          {iface.status === 'up' ? <><UIIcon symbol="🟢" /> Up</> : <><UIIcon symbol="🔴" /> Down</>}
                        </span>
                      </td>
                      <td className="ip-addr">{iface.ipAddress}</td>
                      <td className="traffic-rx">{iface.rxMbps} Mbps</td>
                      <td className="traffic-tx">{iface.txMbps} Mbps</td>
                      <td>{(iface.rxMbps + iface.txMbps).toFixed(1)} Mbps</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Hardware Tab */}
        {activeTab === 'hardware' && (
          <div className="system-section">
            <div className="hardware-grid">
              <div className="hardware-card">
                <h3>Processor</h3>
                <div className="hardware-content">
                  <p><strong>Cores:</strong> {hardware.cpus}</p>
                  <p><strong>Architecture:</strong> x86_64</p>
                  <p><strong>Model:</strong> Intel Core i7-13700K</p>
                  <p><strong>Frequency:</strong> 3.4 GHz</p>
                </div>
              </div>

              <div className="hardware-card">
                <h3>Memory</h3>
                <div className="hardware-content">
                  <p><strong>Total RAM:</strong> {hardware.totalMemory} GB</p>
                  <p><strong>Type:</strong> DDR5 5600MHz</p>
                  <p><strong>Slots:</strong> 2 / 4</p>
                  <p><strong>Available:</strong> {hardware.totalMemory / 2} GB</p>
                </div>
              </div>

              <div className="hardware-card">
                <h3>Storage</h3>
                <div className="hardware-content">
                  <p><strong>Total Disk:</strong> {hardware.totalDisk} GB</p>
                  <p><strong>Type:</strong> NVMe SSD</p>
                  <p><strong>Model:</strong> Samsung 990 Pro</p>
                  <p><strong>Speed:</strong> 7,100 MB/s</p>
                </div>
              </div>

              <div className="hardware-card">
                <h3>Motherboard</h3>
                <div className="hardware-content">
                  <p><strong>Model:</strong> {hardware.motherboard}</p>
                  <p><strong>BIOS:</strong> American Megatrends 3601</p>
                  <p><strong>Chipset:</strong> Intel Z790</p>
                  <p><strong>Revision:</strong> Rev 1.02</p>
                </div>
              </div>

              <div className="hardware-card">
                <h3>Network Adapters</h3>
                <div className="hardware-content">
                  <p><strong>Ethernet:</strong> Intel 10GbE</p>
                  <p><strong>WiFi:</strong> Intel AX200</p>
                  <p><strong>Total:</strong> {interfaces.length} Interfaces</p>
                  <p><strong>Speed:</strong> Up to 10 Gbps</p>
                </div>
              </div>

              <div className="hardware-card">
                <h3>System</h3>
                <div className="hardware-content">
                  <p><strong>Hostname:</strong> {stats.hostname}</p>
                  <p><strong>Uptime:</strong> {stats.uptime}</p>
                  <p><strong>Kernel:</strong> {stats.kernel}</p>
                  <p><strong>OS:</strong> {stats.os}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
