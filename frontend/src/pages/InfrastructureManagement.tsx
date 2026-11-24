import { UIIcon } from '../components/UIIcon';
import React, { useState, useEffect } from 'react';
import './InfrastructureManagement.css';

interface DHCPServer {
  id: string;
  name: string;
  subnet: string;
  gateway: string;
  dns_servers: string[];
  lease_time_seconds: number;
  status: string;
  active_leases: number;
  total_leases: number;
  utilization_percent: number;
  last_updated: string;
}

interface BGPSession {
  id: string;
  remote_asn: number;
  remote_ip: string;
  local_ip: string;
  status: string;
  uptime: string;
  routes_received: number;
  routes_sent: number;
  prefixes_in: number;
  prefixes_out: number;
  last_updated: string;
}

interface FirewallRule {
  id: string;
  name: string;
  direction: string;
  action: string;
  source_ip: string;
  destination_ip: string;
  protocol: string;
  port: number;
  status: string;
  hit_count: number;
  last_hit: string | null;
}

interface WANConnection {
  id: string;
  name: string;
  interface: string;
  isp: string;
  public_ip: string;
  status: string;
  latency_ms: number;
  packet_loss_percent: number;
  bandwidth_mbps: number;
  uptime: string;
  primary: boolean;
  last_updated: string;
}

interface VLAN {
  id: string;
  vlan_id: number;
  name: string;
  subnet: string;
  gateway: string;
  interfaces: string[];
  status: string;
  host_count: number;
  active_hosts: number;
  last_updated: string;
}

interface VPNInterface {
  id: string;
  name: string;
  public_key: string;
  listen_port: number;
  status: string;
  peers_connected: number;
  bytes_received: number;
  bytes_sent: number;
  last_updated: string;
}

export default function InfrastructureManagement() {
  const [dhcpServers, setDhcpServers] = useState<DHCPServer[]>([]);
  const [bgpSessions, setBgpSessions] = useState<BGPSession[]>([]);
  const [firewallRules, setFirewallRules] = useState<FirewallRule[]>([]);
  const [wanConnections, setWanConnections] = useState<WANConnection[]>([]);
  const [vlans, setVlans] = useState<VLAN[]>([]);
  const [wireguard, setWireguard] = useState<VPNInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchInfrastructureData();
    const interval = setInterval(fetchInfrastructureData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchInfrastructureData = async () => {
    try {
      const [dhcp, bgp, fw, wan, vlan, wg] = await Promise.all([
        fetch('/api/v1/tools/infrastructure/dhcp/servers').then(r => r.json()),
        fetch('/api/v1/tools/infrastructure/routing/bgp-sessions').then(r => r.json()),
        fetch('/api/v1/tools/infrastructure/firewall/rules').then(r => r.json()),
        fetch('/api/v1/tools/infrastructure/multi-wan/connections').then(r => r.json()),
        fetch('/api/v1/tools/infrastructure/vlan/list').then(r => r.json()),
        fetch('/api/v1/tools/infrastructure/vpn/wireguard/interfaces').then(r => r.json()),
      ]);

      setDhcpServers(dhcp.servers || []);
      setBgpSessions(bgp.sessions || []);
      setFirewallRules(fw.rules || []);
      setWanConnections(wan.connections || []);
      setVlans(vlan.vlans || []);
      setWireguard(wg.interfaces || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch infrastructure data:', error);
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'up':
      case 'active':
      case 'running':
        return '#10B981';
      case 'down':
      case 'inactive':
        return '#EF4444';
      case 'degraded':
      case 'warning':
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

  if (loading) {
    return (
      <div className="infra-management loading">
        <div className="loading-spinner">
          <div></div>
          <p>Loading Infrastructure Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="infra-management">
      <div className="infra-header">
        <h1><UIIcon symbol="🏗️" /> Infrastructure Management</h1>
        <p className="subtitle">DHCP • Routing • VPN • Firewall • Multi-WAN • VLANs • QoS</p>
      </div>

      <div className="tabs-container">
        {['overview', 'dhcp', 'routing', 'firewall', 'wan', 'vpn', 'vlans'].map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="infra-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="section">
            <h2>Infrastructure Health</h2>
            <div className="overview-grid">
              <div className="stat-card">
                <div className="stat-icon"><UIIcon symbol="🌐" /></div>
                <div className="stat-info">
                  <p className="stat-label">WAN Connections</p>
                  <p className="stat-value">{wanConnections.length}</p>
                  <p className="stat-detail">
                    {wanConnections.filter(w => w.status === 'up').length} Active
                  </p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><UIIcon symbol="📡" /></div>
                <div className="stat-info">
                  <p className="stat-label">BGP Sessions</p>
                  <p className="stat-value">{bgpSessions.length}</p>
                  <p className="stat-detail">
                    {bgpSessions.filter(b => b.status === 'up').length} Up
                  </p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><UIIcon symbol="🛡️" /></div>
                <div className="stat-info">
                  <p className="stat-label">Firewall Rules</p>
                  <p className="stat-value">{firewallRules.length}</p>
                  <p className="stat-detail">
                    {firewallRules.filter(r => r.status === 'active').length} Active
                  </p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><UIIcon symbol="🔐" /></div>
                <div className="stat-info">
                  <p className="stat-label">VPN Interfaces</p>
                  <p className="stat-value">{wireguard.length}</p>
                  <p className="stat-detail">
                    {wireguard.filter(w => w.status === 'up').length} Running
                  </p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><UIIcon symbol="🏘️" /></div>
                <div className="stat-info">
                  <p className="stat-label">VLANs</p>
                  <p className="stat-value">{vlans.length}</p>
                  <p className="stat-detail">Active Networks</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><UIIcon symbol="📋" /></div>
                <div className="stat-info">
                  <p className="stat-label">DHCP Servers</p>
                  <p className="stat-value">{dhcpServers.length}</p>
                  <p className="stat-detail">
                    {dhcpServers.reduce((sum, s) => sum + s.active_leases, 0)} Active Leases
                  </p>
                </div>
              </div>
            </div>

            {/* Multi-WAN Status */}
            <div className="card">
              <h3>Multi-WAN Status</h3>
              <div className="wan-overview">
                {wanConnections.map((wan) => (
                  <div key={wan.id} className="wan-item">
                    <div className="wan-header">
                      <h4>{wan.name}</h4>
                      <span className="primary-badge" style={{ opacity: wan.primary ? 1 : 0.5 }}>
                        {wan.primary ? '★ PRIMARY' : 'BACKUP'}
                      </span>
                    </div>
                    <div className="wan-stats">
                      <div className="stat">
                        <span className="label">ISP:</span>
                        <span className="value">{wan.isp}</span>
                      </div>
                      <div className="stat">
                        <span className="label">IP:</span>
                        <span className="value">{wan.public_ip}</span>
                      </div>
                      <div className="stat">
                        <span className="label">Latency:</span>
                        <span className="value">{wan.latency_ms}ms</span>
                      </div>
                      <div className="stat">
                        <span className="label">Loss:</span>
                        <span className="value">{wan.packet_loss_percent.toFixed(2)}%</span>
                      </div>
                      <div className="stat">
                        <span className="label">Speed:</span>
                        <span className="value">{wan.bandwidth_mbps}Mbps</span>
                      </div>
                      <div className="stat">
                        <span className="label">Status:</span>
                        <span className="status-indicator" style={{ color: getStatusColor(wan.status) }}>
                          ● {wan.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DHCP Tab */}
        {activeTab === 'dhcp' && (
          <div className="section">
            <h2>DHCP Configuration</h2>
            <div className="dhcp-list">
              {dhcpServers.map((server) => (
                <div key={server.id} className="dhcp-card">
                  <div className="dhcp-header">
                    <h3>{server.name}</h3>
                    <span className="status-badge" style={{ backgroundColor: getStatusColor(server.status) }}>
                      {server.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="dhcp-details">
                    <div className="detail-row">
                      <span className="label">Subnet:</span>
                      <span className="value">{server.subnet}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Gateway:</span>
                      <span className="value">{server.gateway}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">DNS:</span>
                      <span className="value">{server.dns_servers.join(', ')}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Lease Time:</span>
                      <span className="value">{server.lease_time_seconds / 3600} hours</span>
                    </div>
                  </div>
                  <div className="lease-status">
                    <p className="lease-title">Active Leases: {server.active_leases} / {server.total_leases}</p>
                    <div className="lease-bar">
                      <div
                        className="lease-fill"
                        style={{ width: `${server.utilization_percent}%` }}
                      />
                    </div>
                    <p className="lease-percent">{server.utilization_percent.toFixed(1)}% Utilized</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Routing Tab */}
        {activeTab === 'routing' && (
          <div className="section">
            <h2>BGP Routing Status</h2>
            <div className="managed-table-scroll" role="region" aria-label="BGP routing table" tabIndex={0}>
            <table className="routing-table">
              <thead>
                <tr>
                  <th>Remote ASN</th>
                  <th>Remote IP</th>
                  <th>Status</th>
                  <th>Uptime</th>
                  <th>Routes Received</th>
                  <th>Routes Sent</th>
                  <th>Prefixes In</th>
                  <th>Prefixes Out</th>
                </tr>
              </thead>
              <tbody>
                {bgpSessions.map((session) => (
                  <tr key={session.id}>
                    <td><strong>AS{session.remote_asn}</strong></td>
                    <td>{session.remote_ip}</td>
                    <td>
                      <span
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(session.status) }}
                      >
                        {session.status.toUpperCase()}
                      </span>
                    </td>
                    <td>{session.uptime}</td>
                    <td>{session.routes_received}</td>
                    <td>{session.routes_sent}</td>
                    <td>{session.prefixes_in}</td>
                    <td>{session.prefixes_out}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* Firewall Tab */}
        {activeTab === 'firewall' && (
          <div className="section">
            <h2>Firewall Rules</h2>
            <div className="managed-table-scroll" role="region" aria-label="Firewall rules table" tabIndex={0}>
            <table className="firewall-table">
              <thead>
                <tr>
                  <th>Rule Name</th>
                  <th>Direction</th>
                  <th>Action</th>
                  <th>Source IP</th>
                  <th>Destination</th>
                  <th>Protocol</th>
                  <th>Port</th>
                  <th>Status</th>
                  <th>Hit Count</th>
                </tr>
              </thead>
              <tbody>
                {firewallRules.map((rule) => (
                  <tr key={rule.id}>
                    <td>{rule.name}</td>
                    <td>
                      <span className={`direction ${rule.direction}`}>
                        {rule.direction === 'inbound' ? <><UIIcon symbol="📥" /></> : <><UIIcon symbol="📤" /></>} {rule.direction}
                      </span>
                    </td>
                    <td>
                      <span className={`action ${rule.action}`}>
                        {rule.action === 'allow' ? '✓' : '✗'} {rule.action}
                      </span>
                    </td>
                    <td className="ip-cell">{rule.source_ip}</td>
                    <td className="ip-cell">{rule.destination_ip}</td>
                    <td><strong>{rule.protocol}</strong></td>
                    <td>{rule.port}</td>
                    <td>
                      <span
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(rule.status) }}
                      >
                        {rule.status}
                      </span>
                    </td>
                    <td>{rule.hit_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* WAN Tab */}
        {activeTab === 'wan' && (
          <div className="section">
            <h2>Multi-WAN Connections</h2>
            <div className="wan-detailed">
              {wanConnections.map((wan) => (
                <div key={wan.id} className="wan-detail-card">
                  <div className="wan-detail-header">
                    <h3>{wan.name}</h3>
                    {wan.primary && <span className="primary-badge">PRIMARY</span>}
                  </div>
                  <div className="wan-detail-grid">
                    <div className="detail">
                      <span className="detail-label">ISP</span>
                      <span className="detail-value">{wan.isp}</span>
                    </div>
                    <div className="detail">
                      <span className="detail-label">Interface</span>
                      <span className="detail-value">{wan.interface}</span>
                    </div>
                    <div className="detail">
                      <span className="detail-label">Public IP</span>
                      <span className="detail-value">{wan.public_ip}</span>
                    </div>
                    <div className="detail">
                      <span className="detail-label">Status</span>
                      <span
                        className="detail-value"
                        style={{ color: getStatusColor(wan.status) }}
                      >
                        ● {wan.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="detail">
                      <span className="detail-label">Latency</span>
                      <span className="detail-value">{wan.latency_ms}ms</span>
                    </div>
                    <div className="detail">
                      <span className="detail-label">Packet Loss</span>
                      <span className="detail-value">{wan.packet_loss_percent.toFixed(3)}%</span>
                    </div>
                    <div className="detail">
                      <span className="detail-label">Bandwidth</span>
                      <span className="detail-value">{wan.bandwidth_mbps}Mbps</span>
                    </div>
                    <div className="detail">
                      <span className="detail-label">Uptime</span>
                      <span className="detail-value">{wan.uptime}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VPN Tab */}
        {activeTab === 'vpn' && (
          <div className="section">
            <h2>VPN Interfaces (WireGuard)</h2>
            <div className="vpn-list">
              {wireguard.map((vpn) => (
                <div key={vpn.id} className="vpn-card">
                  <div className="vpn-header">
                    <h3>{vpn.name}</h3>
                    <span className="vpn-port">Port {vpn.listen_port}</span>
                    <span className="status-badge" style={{ backgroundColor: getStatusColor(vpn.status) }}>
                      {vpn.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="vpn-details">
                    <div className="detail-row">
                      <span className="label">Connected Peers:</span>
                      <span className="value">{vpn.peers_connected}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Received:</span>
                      <span className="value">{formatBytes(vpn.bytes_received)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Sent:</span>
                      <span className="value">{formatBytes(vpn.bytes_sent)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Public Key:</span>
                      <span className="value mono">{vpn.public_key.substring(0, 20)}...</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VLANs Tab */}
        {activeTab === 'vlans' && (
          <div className="section">
            <h2>VLAN Configuration</h2>
            <div className="vlan-list">
              {vlans.map((vlan) => (
                <div key={vlan.id} className="vlan-card">
                  <div className="vlan-header">
                    <h3>VLAN {vlan.vlan_id}: {vlan.name}</h3>
                    <span className="status-badge" style={{ backgroundColor: getStatusColor(vlan.status) }}>
                      {vlan.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="vlan-details">
                    <div className="detail-row">
                      <span className="label">Subnet:</span>
                      <span className="value">{vlan.subnet}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Gateway:</span>
                      <span className="value">{vlan.gateway}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Interfaces:</span>
                      <span className="value">{vlan.interfaces.join(', ')}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Active Hosts:</span>
                      <span className="value">
                        {vlan.active_hosts} / {vlan.host_count}
                      </span>
                    </div>
                  </div>
                  <div className="host-status">
                    <div className="host-bar">
                      <div
                        className="host-fill"
                        style={{ width: `${(vlan.active_hosts / vlan.host_count) * 100}%` }}
                      />
                    </div>
                    <p className="host-percent">
                      {((vlan.active_hosts / vlan.host_count) * 100).toFixed(1)}% Utilized
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
