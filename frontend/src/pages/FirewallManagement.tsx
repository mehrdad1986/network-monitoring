import { UIIcon } from '../components/UIIcon';
import { useState } from 'react';
import './FirewallManagement.css';

interface FirewallRule {
  id: string;
  name: string;
  direction: 'inbound' | 'outbound';
  action: 'allow' | 'deny' | 'reject';
  protocol: 'tcp' | 'udp' | 'icmp' | 'all';
  port: number | null;
  source: string;
  destination: string;
  enabled: boolean;
  hitCount: number;
}

interface FirewallZone {
  id: string;
  name: string;
  description: string;
  interfaces: string[];
  inbound: 'accept' | 'drop' | 'reject';
  outbound: 'accept' | 'drop' | 'reject';
  masquerading: boolean;
}

interface Service {
  id: string;
  name: string;
  port: number;
  protocol: 'tcp' | 'udp' | 'both';
  description: string;
  enabled: boolean;
}

export default function FirewallManagement() {
  const [activeTab, setActiveTab] = useState('overview');
  const [firewallEnabled, setFirewallEnabled] = useState(true);

  const [rules, setRules] = useState<FirewallRule[]>([
    {
      id: '1',
      name: 'Allow SSH',
      direction: 'inbound',
      action: 'allow',
      protocol: 'tcp',
      port: 22,
      source: '0.0.0.0/0',
      destination: '0.0.0.0/0',
      enabled: true,
      hitCount: 245,
    },
    {
      id: '2',
      name: 'Allow HTTP',
      direction: 'inbound',
      action: 'allow',
      protocol: 'tcp',
      port: 80,
      source: '0.0.0.0/0',
      destination: '0.0.0.0/0',
      enabled: true,
      hitCount: 1250,
    },
    {
      id: '3',
      name: 'Allow HTTPS',
      direction: 'inbound',
      action: 'allow',
      protocol: 'tcp',
      port: 443,
      source: '0.0.0.0/0',
      destination: '0.0.0.0/0',
      enabled: true,
      hitCount: 980,
    },
    {
      id: '4',
      name: 'Allow DHCP',
      direction: 'inbound',
      action: 'allow',
      protocol: 'udp',
      port: 67,
      source: '0.0.0.0/0',
      destination: '0.0.0.0/0',
      enabled: true,
      hitCount: 5432,
    },
    {
      id: '5',
      name: 'Allow DNS',
      direction: 'inbound',
      action: 'allow',
      protocol: 'udp',
      port: 53,
      source: '0.0.0.0/0',
      destination: '0.0.0.0/0',
      enabled: true,
      hitCount: 8920,
    },
    {
      id: '6',
      name: 'Deny All Inbound',
      direction: 'inbound',
      action: 'deny',
      protocol: 'all',
      port: null,
      source: '0.0.0.0/0',
      destination: '0.0.0.0/0',
      enabled: true,
      hitCount: 12453,
    },
  ]);

  const [zones, setZones] = useState<FirewallZone[]>([
    {
      id: 'public',
      name: 'Public',
      description: 'Internet-facing zone',
      interfaces: ['eth0'],
      inbound: 'drop',
      outbound: 'accept',
      masquerading: false,
    },
    {
      id: 'internal',
      name: 'Internal',
      description: 'Internal network zone',
      interfaces: ['eth1', 'eth2'],
      inbound: 'accept',
      outbound: 'accept',
      masquerading: true,
    },
    {
      id: 'guest',
      name: 'Guest',
      description: 'Guest network zone',
      interfaces: ['wlan0'],
      inbound: 'drop',
      outbound: 'accept',
      masquerading: false,
    },
  ]);

  const [services, setServices] = useState<Service[]>([
    { id: '1', name: 'SSH', port: 22, protocol: 'tcp', description: 'Secure Shell', enabled: true },
    { id: '2', name: 'HTTP', port: 80, protocol: 'tcp', description: 'Web Server', enabled: true },
    { id: '3', name: 'HTTPS', port: 443, protocol: 'tcp', description: 'Secure Web', enabled: true },
    { id: '4', name: 'DHCP', port: 67, protocol: 'udp', description: 'DHCP Server', enabled: true },
    { id: '5', name: 'DNS', port: 53, protocol: 'udp', description: 'Domain Name System', enabled: true },
    { id: '6', name: 'NTP', port: 123, protocol: 'udp', description: 'Network Time Protocol', enabled: false },
  ]);

  const allowedPorts = rules
    .filter(r => r.action === 'allow' && r.port)
    .map(r => ({ port: r.port, name: r.name }));

  return (
    <div className="firewall-management">
      <div className="firewall-header">
        <h1>Firewall Management</h1>
        <p className="firewall-subtitle">Configure firewall rules, zones, and services</p>
      </div>

      <div className="firewall-status">
        <div className="status-card">
          <div className="status-header">
            <span className="status-label">Firewall Status</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={firewallEnabled}
                onChange={e => setFirewallEnabled(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
          <div className="status-info">
            <span className={`status-indicator ${firewallEnabled ? 'enabled' : 'disabled'}`}>
              {firewallEnabled ? <><UIIcon symbol="🟢" /> Enabled</> : <><UIIcon symbol="🔴" /> Disabled</>}
            </span>
            <span className="status-detail">
              {rules.filter(r => r.enabled).length} Active Rules
            </span>
            <span className="status-detail">
              {rules.reduce((sum, r) => sum + r.hitCount, 0)} Total Hits
            </span>
          </div>
        </div>

        <div className="status-card">
          <div className="status-header">
            <span className="status-label">Quick Access</span>
          </div>
          <div className="quick-access">
            <button className="quick-btn"><UIIcon symbol="📋" /> Export Rules</button>
            <button className="quick-btn"><UIIcon symbol="⚙️" /> Reset to Default</button>
            <button className="quick-btn"><UIIcon symbol="⏱️" /> Schedule Update</button>
          </div>
        </div>
      </div>

      <div className="firewall-tabs">
        <button
          className={`firewall-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <UIIcon symbol="📊" /> Overview
        </button>
        <button
          className={`firewall-tab ${activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          <UIIcon symbol="🔒" /> Rules
        </button>
        <button
          className={`firewall-tab ${activeTab === 'zones' ? 'active' : ''}`}
          onClick={() => setActiveTab('zones')}
        >
          <UIIcon symbol="🗺️" /> Zones
        </button>
        <button
          className={`firewall-tab ${activeTab === 'services' ? 'active' : ''}`}
          onClick={() => setActiveTab('services')}
        >
          <UIIcon symbol="⚙️" /> Services
        </button>
        <button
          className={`firewall-tab ${activeTab === 'ports' ? 'active' : ''}`}
          onClick={() => setActiveTab('ports')}
        >
          <UIIcon symbol="🔌" /> Ports
        </button>
      </div>

      <div className="firewall-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="firewall-section">
            <div className="overview-grid">
              <div className="overview-card">
                <h3>Firewall Statistics</h3>
                <div className="stats-list">
                  <div className="stat-row">
                    <span className="stat-label">Total Rules</span>
                    <span className="stat-value">{rules.length}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Active Rules</span>
                    <span className="stat-value">{rules.filter(r => r.enabled).length}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Allow Rules</span>
                    <span className="stat-value green">{rules.filter(r => r.action === 'allow').length}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Deny Rules</span>
                    <span className="stat-value red">{rules.filter(r => r.action === 'deny').length}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Total Hits</span>
                    <span className="stat-value">{rules.reduce((sum, r) => sum + r.hitCount, 0)}</span>
                  </div>
                </div>
              </div>

              <div className="overview-card">
                <h3>Allowed Ports</h3>
                <div className="ports-list">
                  {allowedPorts.map((item, idx) => (
                    <div key={idx} className="port-item">
                      <span className="port-number">{item.port}</span>
                      <span className="port-name">{item.name}</span>
                    </div>
                  ))}
                  {allowedPorts.length === 0 && <p className="no-data">No allowed ports</p>}
                </div>
              </div>

              <div className="overview-card">
                <h3>Active Zones</h3>
                <div className="zones-list">
                  {zones.map(zone => (
                    <div key={zone.id} className="zone-item">
                      <div className="zone-badge">{zone.name}</div>
                      <div className="zone-info">
                        <small>{zone.interfaces.join(', ')}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rules Tab */}
        {activeTab === 'rules' && (
          <div className="firewall-section">
            <div className="rules-header">
              <h3>Firewall Rules</h3>
              <button className="add-rule-btn">+ Add Rule</button>
            </div>
            <div className="rules-table-container">
              <table className="rules-table">
                <thead>
                  <tr>
                    <th>Enabled</th>
                    <th>Name</th>
                    <th>Direction</th>
                    <th>Action</th>
                    <th>Protocol</th>
                    <th>Port</th>
                    <th>Hits</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map(rule => (
                    <tr key={rule.id} className={`rule-row ${rule.action}`}>
                      <td className="enabled-col">
                        <input type="checkbox" checked={rule.enabled} readOnly />
                      </td>
                      <td className="name-col">{rule.name}</td>
                      <td className="direction-col">
                        <span className={`badge ${rule.direction}`}>
                          {rule.direction === 'inbound' ? <><UIIcon symbol="📥" /></> : <><UIIcon symbol="📤" /></>} {rule.direction}
                        </span>
                      </td>
                      <td className="action-col">
                        <span className={`badge action-${rule.action}`}>{rule.action}</span>
                      </td>
                      <td className="protocol-col">
                        <span className="protocol">{rule.protocol.toUpperCase()}</span>
                      </td>
                      <td className="port-col">
                        {rule.port ? <span className="port">{rule.port}</span> : <span className="all">All</span>}
                      </td>
                      <td className="hits-col">{rule.hitCount}</td>
                      <td className="actions-col">
                        <button className="action-icon"><UIIcon symbol="✏️" /></button>
                        <button className="action-icon"><UIIcon symbol="🗑️" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Zones Tab */}
        {activeTab === 'zones' && (
          <div className="firewall-section">
            <div className="zones-header">
              <h3>Firewall Zones</h3>
              <button className="add-rule-btn">+ Create Zone</button>
            </div>
            <div className="zones-grid">
              {zones.map(zone => (
                <div key={zone.id} className="zone-card">
                  <div className="zone-card-header">
                    <h4>{zone.name}</h4>
                    <span className="zone-id">{zone.id}</span>
                  </div>
                  <p className="zone-description">{zone.description}</p>
                  <div className="zone-details">
                    <div className="detail-row">
                      <span className="label">Interfaces:</span>
                      <span className="value">{zone.interfaces.join(', ')}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Inbound:</span>
                      <span className={`value ${zone.inbound}`}>{zone.inbound}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Outbound:</span>
                      <span className={`value ${zone.outbound}`}>{zone.outbound}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Masquerading:</span>
                      <span className="value">{zone.masquerading ? '✓ Enabled' : '✗ Disabled'}</span>
                    </div>
                  </div>
                  <div className="zone-actions">
                    <button className="action-btn primary">Edit</button>
                    <button className="action-btn">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Services Tab */}
        {activeTab === 'services' && (
          <div className="firewall-section">
            <div className="services-header">
              <h3>Services</h3>
              <button className="add-rule-btn">+ Add Service</button>
            </div>
            <div className="services-table-container">
              <table className="services-table">
                <thead>
                  <tr>
                    <th>Enabled</th>
                    <th>Service</th>
                    <th>Port</th>
                    <th>Protocol</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map(service => (
                    <tr key={service.id} className={`service-row ${service.enabled ? 'enabled' : 'disabled'}`}>
                      <td className="enabled-col">
                        <input type="checkbox" checked={service.enabled} readOnly />
                      </td>
                      <td className="service-name">{service.name}</td>
                      <td className="port">{service.port}</td>
                      <td className="protocol">
                        <span className="protocol-badge">{service.protocol.toUpperCase()}</span>
                      </td>
                      <td className="description">{service.description}</td>
                      <td className="actions-col">
                        <button className="action-icon"><UIIcon symbol="✏️" /></button>
                        <button className="action-icon"><UIIcon symbol="🗑️" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ports Tab */}
        {activeTab === 'ports' && (
          <div className="firewall-section">
            <div className="ports-container">
              <h3>Port Summary</h3>
              <div className="port-ranges">
                <div className="port-card">
                  <h4>Well-Known Ports (0-1023)</h4>
                  <div className="port-list">
                    {allowedPorts
                      .filter(p => p.port! < 1024)
                      .map((item, idx) => (
                        <div key={idx} className="port-badge-item">{item.port}</div>
                      ))}
                    {allowedPorts.filter(p => p.port! < 1024).length === 0 && (
                      <p className="no-data">No ports in range</p>
                    )}
                  </div>
                </div>

                <div className="port-card">
                  <h4>Registered Ports (1024-49151)</h4>
                  <div className="port-list">
                    {allowedPorts
                      .filter(p => p.port! >= 1024 && p.port! < 49152)
                      .map((item, idx) => (
                        <div key={idx} className="port-badge-item">{item.port}</div>
                      ))}
                    {allowedPorts.filter(p => p.port! >= 1024 && p.port! < 49152).length === 0 && (
                      <p className="no-data">No ports in range</p>
                    )}
                  </div>
                </div>

                <div className="port-card">
                  <h4>Dynamic Ports (49152-65535)</h4>
                  <div className="port-list">
                    {allowedPorts
                      .filter(p => p.port! >= 49152)
                      .map((item, idx) => (
                        <div key={idx} className="port-badge-item">{item.port}</div>
                      ))}
                    {allowedPorts.filter(p => p.port! >= 49152).length === 0 && (
                      <p className="no-data">No ports in range</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
