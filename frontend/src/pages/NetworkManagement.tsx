import { UIIcon } from '../components/UIIcon';
import { useState } from 'react';
import './NetworkManagement.css';

interface NetworkInterface {
  id: string;
  name: string;
  type: 'ethernet' | 'wifi' | 'vlan' | 'bridge' | 'bond';
  ipAddress: string;
  gateway: string;
  netmask: string;
  dns: string[];
  status: 'up' | 'down';
  speed: string;
  mtu: number;
  macAddress: string;
  dhcp: boolean;
}

interface Route {
  id: string;
  destination: string;
  gateway: string;
  interface: string;
  metric: number;
  type: 'static' | 'dynamic';
}

interface VLAN {
  id: string;
  name: string;
  vlanId: number;
  interface: string;
  ipAddress: string;
  status: 'active' | 'inactive';
}

interface Bond {
  id: string;
  name: string;
  members: string[];
  mode: 'active-backup' | 'balance-alb' | 'balance-rr';
  status: 'up' | 'down';
}

export default function NetworkManagement() {
  const [activeTab, setActiveTab] = useState('interfaces');
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([
    {
      id: 'eth0',
      name: 'eth0',
      type: 'ethernet',
      ipAddress: '203.0.113.1',
      gateway: '203.0.113.254',
      netmask: '255.255.255.0',
      dns: ['8.8.8.8', '8.8.4.4'],
      status: 'up',
      speed: '1Gbps',
      mtu: 1500,
      macAddress: '00:0C:29:AB:CD:EF',
      dhcp: false,
    },
    {
      id: 'eth1',
      name: 'eth1',
      type: 'ethernet',
      ipAddress: '192.168.1.1',
      gateway: '192.168.1.254',
      netmask: '255.255.255.0',
      dns: ['1.1.1.1', '1.0.0.1'],
      status: 'up',
      speed: '1Gbps',
      mtu: 1500,
      macAddress: '00:0C:29:AB:CD:F0',
      dhcp: false,
    },
    {
      id: 'wlan0',
      name: 'wlan0',
      type: 'wifi',
      ipAddress: '172.16.0.1',
      gateway: '172.16.0.254',
      netmask: '255.255.255.0',
      dns: ['9.9.9.9', '149.112.112.112'],
      status: 'up',
      speed: 'WiFi 6 (802.11ax)',
      mtu: 1500,
      macAddress: '00:0C:29:AB:CD:F1',
      dhcp: true,
    },
  ]);

  const [routes, setRoutes] = useState<Route[]>([
    {
      id: '1',
      destination: '0.0.0.0/0',
      gateway: '203.0.113.254',
      interface: 'eth0',
      metric: 0,
      type: 'static',
    },
    {
      id: '2',
      destination: '192.168.0.0/16',
      gateway: '192.168.1.254',
      interface: 'eth1',
      metric: 100,
      type: 'static',
    },
    {
      id: '3',
      destination: '10.0.0.0/8',
      gateway: '192.168.1.254',
      interface: 'eth1',
      metric: 200,
      type: 'static',
    },
  ]);

  const [vlans, setVlans] = useState<VLAN[]>([
    {
      id: '100',
      name: 'Management',
      vlanId: 100,
      interface: 'eth0',
      ipAddress: '10.0.100.1/24',
      status: 'active',
    },
    {
      id: '200',
      name: 'Guest',
      vlanId: 200,
      interface: 'eth1',
      ipAddress: '10.0.200.1/24',
      status: 'active',
    },
  ]);

  const [bonds, setBonds] = useState<Bond[]>([
    {
      id: 'bond0',
      name: 'bond0',
      members: ['eth2', 'eth3'],
      mode: 'active-backup',
      status: 'up',
    },
  ]);

  return (
    <div className="network-management">
      <div className="network-header">
        <h1>Network Management</h1>
        <p className="network-subtitle">Configure and monitor network interfaces, routes, and settings</p>
      </div>

      <div className="network-tabs">
        <button
          className={`network-tab ${activeTab === 'interfaces' ? 'active' : ''}`}
          onClick={() => setActiveTab('interfaces')}
        >
          <UIIcon symbol="🔌" /> Interfaces
        </button>
        <button
          className={`network-tab ${activeTab === 'routes' ? 'active' : ''}`}
          onClick={() => setActiveTab('routes')}
        >
          <UIIcon symbol="🛣️" /> Routes
        </button>
        <button
          className={`network-tab ${activeTab === 'vlans' ? 'active' : ''}`}
          onClick={() => setActiveTab('vlans')}
        >
          <UIIcon symbol="🏷️" /> VLANs
        </button>
        <button
          className={`network-tab ${activeTab === 'bonds' ? 'active' : ''}`}
          onClick={() => setActiveTab('bonds')}
        >
          <UIIcon symbol="⛓️" /> Bonds
        </button>
        <button
          className={`network-tab ${activeTab === 'dns' ? 'active' : ''}`}
          onClick={() => setActiveTab('dns')}
        >
          <UIIcon symbol="📡" /> DNS
        </button>
      </div>

      <div className="network-content">
        {/* Interfaces Tab */}
        {activeTab === 'interfaces' && (
          <div className="network-section">
            <div className="interfaces-grid">
              {interfaces.map(iface => (
                <div key={iface.id} className={`interface-card ${iface.status}`}>
                  <div className="interface-header">
                    <h3>{iface.name}</h3>
                    <span className={`interface-badge ${iface.type}`}>{iface.type}</span>
                  </div>

                  <div className="interface-status">
                    <span className={`status-indicator ${iface.status}`}></span>
                    <span className="status-text">{iface.status === 'up' ? <><UIIcon symbol="🟢" /> Up</> : <><UIIcon symbol="🔴" /> Down</>}</span>
                  </div>

                  <div className="interface-details">
                    <div className="detail-row">
                      <span className="label">IP Address:</span>
                      <span className="value">{iface.ipAddress}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Gateway:</span>
                      <span className="value">{iface.gateway}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Netmask:</span>
                      <span className="value">{iface.netmask}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">MAC:</span>
                      <span className="value">{iface.macAddress}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Speed:</span>
                      <span className="value">{iface.speed}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">MTU:</span>
                      <span className="value">{iface.mtu}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">DHCP:</span>
                      <span className="value">{iface.dhcp ? '✓ Enabled' : '✗ Disabled'}</span>
                    </div>
                  </div>

                  <div className="interface-dns">
                    <strong>DNS Servers:</strong>
                    <ul>
                      {iface.dns.map((dns, idx) => (
                        <li key={idx}>{dns}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="interface-actions">
                    <button className="action-btn primary">Edit</button>
                    <button className="action-btn">Restart</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Routes Tab */}
        {activeTab === 'routes' && (
          <div className="network-section">
            <div className="routes-header">
              <h3>Network Routes</h3>
              <button className="add-btn">+ Add Route</button>
            </div>
            <div className="routes-table-container">
              <table className="routes-table">
                <thead>
                  <tr>
                    <th>Destination</th>
                    <th>Gateway</th>
                    <th>Interface</th>
                    <th>Metric</th>
                    <th>Type</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map(route => (
                    <tr key={route.id}>
                      <td className="destination">{route.destination}</td>
                      <td className="gateway">{route.gateway}</td>
                      <td>{route.interface}</td>
                      <td>{route.metric}</td>
                      <td>
                        <span className={`type-badge ${route.type}`}>{route.type}</span>
                      </td>
                      <td className="actions">
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

        {/* VLANs Tab */}
        {activeTab === 'vlans' && (
          <div className="network-section">
            <div className="routes-header">
              <h3>Virtual LANs (VLANs)</h3>
              <button className="add-btn">+ Create VLAN</button>
            </div>
            <div className="vlans-grid">
              {vlans.map(vlan => (
                <div key={vlan.id} className="vlan-card">
                  <div className="vlan-header">
                    <h4>{vlan.name}</h4>
                    <span className={`vlan-status ${vlan.status}`}>
                      {vlan.status === 'active' ? <><UIIcon symbol="🟢" /> Active</> : <><UIIcon symbol="🔴" /> Inactive</>}
                    </span>
                  </div>
                  <div className="vlan-details">
                    <div className="detail-row">
                      <span className="label">VLAN ID:</span>
                      <span className="value">{vlan.vlanId}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Interface:</span>
                      <span className="value">{vlan.interface}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">IP Range:</span>
                      <span className="value">{vlan.ipAddress}</span>
                    </div>
                  </div>
                  <div className="vlan-actions">
                    <button className="action-btn primary">Edit</button>
                    <button className="action-btn">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bonds Tab */}
        {activeTab === 'bonds' && (
          <div className="network-section">
            <div className="routes-header">
              <h3>Network Bonds</h3>
              <button className="add-btn">+ Create Bond</button>
            </div>
            <div className="bonds-grid">
              {bonds.map(bond => (
                <div key={bond.id} className={`bond-card ${bond.status}`}>
                  <div className="bond-header">
                    <h4>{bond.name}</h4>
                    <span className={`bond-status ${bond.status}`}>
                      {bond.status === 'up' ? <><UIIcon symbol="🟢" /> Up</> : <><UIIcon symbol="🔴" /> Down</>}
                    </span>
                  </div>
                  <div className="bond-details">
                    <div className="detail-row">
                      <span className="label">Mode:</span>
                      <span className="value">{bond.mode}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Members:</span>
                      <div className="members-list">
                        {bond.members.map((member, idx) => (
                          <span key={idx} className="member-badge">{member}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="bond-actions">
                    <button className="action-btn primary">Edit</button>
                    <button className="action-btn">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DNS Tab */}
        {activeTab === 'dns' && (
          <div className="network-section">
            <div className="dns-container">
              <div className="dns-card">
                <h3>DNS Configuration</h3>
                <div className="dns-settings">
                  <div className="dns-section">
                    <label>Primary DNS</label>
                    <input type="text" placeholder="8.8.8.8" defaultValue="8.8.8.8" />
                  </div>
                  <div className="dns-section">
                    <label>Secondary DNS</label>
                    <input type="text" placeholder="8.8.4.4" defaultValue="8.8.4.4" />
                  </div>
                  <div className="dns-section">
                    <label>Tertiary DNS</label>
                    <input type="text" placeholder="1.1.1.1" defaultValue="1.1.1.1" />
                  </div>
                  <div className="dns-section">
                    <label>Search Domain</label>
                    <input type="text" placeholder="example.com" defaultValue="example.com" />
                  </div>
                  <button className="save-btn">Save DNS Settings</button>
                </div>
              </div>

              <div className="dns-card">
                <h3>DNS Servers by Interface</h3>
                <div className="dns-by-interface">
                  {interfaces.map(iface => (
                    <div key={iface.id} className="interface-dns-row">
                      <div className="interface-name">{iface.name}</div>
                      <div className="dns-list">
                        {iface.dns.map((dns, idx) => (
                          <span key={idx} className="dns-badge">{dns}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
