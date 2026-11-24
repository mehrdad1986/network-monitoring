import { UIIcon } from '../components/UIIcon';
import React, { useState, useEffect } from 'react';
import './DNSMasqDashboard.css';

interface DHCPServer {
  id: string;
  name: string;
  enabled: boolean;
  interface: string;
  start_ip: string;
  end_ip: string;
  netmask: string;
  gateway: string;
  dns_servers: string[];
  domain: string;
  lease_time_seconds: number;
  status: string;
  active_leases: number;
  total_leases: number;
  utilization_percent: number;
  last_updated: string;
}

interface DHCPLease {
  id: string;
  server_id: string;
  ip_address: string;
  mac_address: string;
  hostname: string;
  client_name: string;
  lease_start: string;
  lease_expiry: string;
  remaining_seconds: number;
  status: string;
  vendor: string;
  type: string;
}

interface DHCPOptions {
  id: string;
  server_id: string;
  option_number: number;
  option_name: string;
  option_value: string;
  option_type: string;
  description: string;
  enabled: boolean;
}

interface StaticReservation {
  id: string;
  server_id: string;
  mac_address: string;
  ip_address: string;
  hostname: string;
  description: string;
}

interface DNSRecord {
  id: string;
  domain: string;
  record_type: string;
  value: string;
  ttl: number;
  enabled: boolean;
}

interface DHCPClient {
  id: string;
  interface_name: string;
  enabled: boolean;
  status: string;
  ip_address: string;
  netmask: string;
  gateway: string;
  dns_servers: string[];
  dhcp_server: string;
  lease_start: string;
  lease_expiry: string;
  lease_remaining_seconds: number;
  renewal_time: string;
  rebind_time: string;
  client_id: string;
  uptime: string;
}

export default function DNSMasqDashboard() {
  const [servers, setServers] = useState<DHCPServer[]>([]);
  const [leases, setLeases] = useState<DHCPLease[]>([]);
  const [options, setOptions] = useState<DHCPOptions[]>([]);
  const [reservations, setReservations] = useState<StaticReservation[]>([]);
  const [dnsRecords, setDnsRecords] = useState<DNSRecord[]>([]);
  const [clients, setClients] = useState<DHCPClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [dnsCache, setDnsCache] = useState<any>(null);

  useEffect(() => {
    fetchDNSMasqData();
    const interval = setInterval(fetchDNSMasqData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchDNSMasqData = async () => {
    try {
      const [srv, lease, opt, res, dns, cache, cli] = await Promise.all([
        fetch('/api/v1/tools/dnsmasq/dhcp-server/configs').then(r => r.json()),
        fetch('/api/v1/tools/dnsmasq/dhcp-server/leases').then(r => r.json()),
        fetch('/api/v1/tools/dnsmasq/dhcp-server/options').then(r => r.json()),
        fetch('/api/v1/tools/dnsmasq/dhcp-server/reservations').then(r => r.json()),
        fetch('/api/v1/tools/dnsmasq/dns/records').then(r => r.json()),
        fetch('/api/v1/tools/dnsmasq/dns/cache').then(r => r.json()),
        fetch('/api/v1/tools/dnsmasq/dhcp-client/interfaces').then(r => r.json()),
      ]);

      setServers(srv.servers || []);
      setLeases(lease.leases || []);
      setOptions(opt.options || []);
      setReservations(res.reservations || []);
      setDnsRecords(dns.records || []);
      setDnsCache(cache);
      setClients(cli.interfaces || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch DNSMasq data:', error);
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'running':
      case 'bound':
      case 'active':
        return '#10B981';
      case 'down':
      case 'stopped':
      case 'expired':
        return '#EF4444';
      case 'searching':
      case 'rebinding':
        return '#F59E0B';
      default:
        return '#3B82F6';
    }
  };

  const calculateLeaseProgress = (start: string, expiry: string) => {
    const startTime = new Date(start).getTime();
    const expiryTime = new Date(expiry).getTime();
    const now = Date.now();
    const total = expiryTime - startTime;
    const elapsed = now - startTime;
    return Math.max(0, Math.min(100, (elapsed / total) * 100));
  };

  if (loading) {
    return (
      <div className="dnsmasq loading">
        <div className="loading-spinner">
          <div></div>
          <p>Loading DNSMasq Configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dnsmasq">
      <div className="dnsmasq-header">
        <h1><UIIcon symbol="🔧" /> DNSMasq DHCP & DNS Management</h1>
        <p className="subtitle">DHCP Server • DHCP Client • DNS Records • IP Pool • Lease Management</p>
      </div>

      <div className="tabs-container">
        {[
          'overview',
          'dhcp-server',
          'leases',
          'options',
          'reservations',
          'dns',
          'dhcp-client',
        ].map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab
              .split('-')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')}
          </button>
        ))}
      </div>

      <div className="dnsmasq-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="section">
            <h2>DNSMasq Overview</h2>
            <div className="overview-grid">
              <div className="stat-card">
                <div className="stat-icon"><UIIcon symbol="📡" /></div>
                <div className="stat-info">
                  <p className="stat-label">DHCP Servers</p>
                  <p className="stat-value">{servers.length}</p>
                  <p className="stat-detail">
                    {servers.filter(s => s.status === 'running').length} Running
                  </p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><UIIcon symbol="📋" /></div>
                <div className="stat-info">
                  <p className="stat-label">Active Leases</p>
                  <p className="stat-value">
                    {servers.reduce((sum, s) => sum + s.active_leases, 0)}
                  </p>
                  <p className="stat-detail">
                    {servers.reduce((sum, s) => sum + s.total_leases, 0)} Total
                  </p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><UIIcon symbol="🔗" /></div>
                <div className="stat-info">
                  <p className="stat-label">DHCP Clients</p>
                  <p className="stat-value">{clients.length}</p>
                  <p className="stat-detail">
                    {clients.filter(c => c.status === 'bound').length} Bound
                  </p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><UIIcon symbol="📚" /></div>
                <div className="stat-info">
                  <p className="stat-label">DNS Cache</p>
                  <p className="stat-value">{dnsCache?.cache_util_percent.toFixed(1)}%</p>
                  <p className="stat-detail">
                    Hit Ratio: {dnsCache?.hit_ratio_percent.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><UIIcon symbol="🧬" /></div>
                <div className="stat-info">
                  <p className="stat-label">DNS Records</p>
                  <p className="stat-value">{dnsRecords.length}</p>
                  <p className="stat-detail">
                    {dnsRecords.filter(r => r.enabled).length} Active
                  </p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><UIIcon symbol="🔖" /></div>
                <div className="stat-info">
                  <p className="stat-label">Reservations</p>
                  <p className="stat-value">{reservations.length}</p>
                  <p className="stat-detail">Static IP Reservations</p>
                </div>
              </div>
            </div>

            {/* Server Summary Cards */}
            <div className="servers-summary">
              <h3>DHCP Servers Summary</h3>
              <div className="server-cards">
                {servers.map((server) => (
                  <div key={server.id} className="server-summary-card">
                    <div className="server-header">
                      <h4>{server.name}</h4>
                      <span
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(server.status) }}
                      >
                        {server.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="server-stats">
                      <p>
                        <strong>Interface:</strong> {server.interface}
                      </p>
                      <p>
                        <strong>Pool:</strong> {server.start_ip} - {server.end_ip}
                      </p>
                      <p>
                        <strong>Gateway:</strong> {server.gateway}
                      </p>
                      <p>
                        <strong>DNS:</strong> {server.dns_servers.join(', ')}
                      </p>
                    </div>
                    <div className="utilization">
                      <div className="util-label">
                        Utilization: {server.active_leases}/{server.total_leases}
                      </div>
                      <div className="util-bar">
                        <div
                          className="util-fill"
                          style={{
                            width: `${server.utilization_percent}%`,
                            backgroundColor:
                              server.utilization_percent > 80
                                ? '#EF4444'
                                : server.utilization_percent > 60
                                ? '#F59E0B'
                                : '#10B981',
                          }}
                        />
                      </div>
                      <p className="util-percent">{server.utilization_percent.toFixed(1)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DHCP Server Tab */}
        {activeTab === 'dhcp-server' && (
          <div className="section">
            <h2>DHCP Server Configuration</h2>
            <div className="servers-list">
              {servers.map((server) => (
                <div key={server.id} className="server-card">
                  <div className="server-card-header">
                    <h3>{server.name}</h3>
                    <div className="server-badges">
                      <span className="enabled-badge">
                        {server.enabled ? '✓ Enabled' : '✗ Disabled'}
                      </span>
                      <span
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(server.status) }}
                      >
                        {server.status}
                      </span>
                    </div>
                  </div>

                  <div className="server-config-grid">
                    <div className="config-group">
                      <h4>Network Configuration</h4>
                      <div className="config-item">
                        <span className="config-label">Interface:</span>
                        <span className="config-value">{server.interface}</span>
                      </div>
                      <div className="config-item">
                        <span className="config-label">IP Pool Start:</span>
                        <span className="config-value">{server.start_ip}</span>
                      </div>
                      <div className="config-item">
                        <span className="config-label">IP Pool End:</span>
                        <span className="config-value">{server.end_ip}</span>
                      </div>
                      <div className="config-item">
                        <span className="config-label">Netmask:</span>
                        <span className="config-value">{server.netmask}</span>
                      </div>
                      <div className="config-item">
                        <span className="config-label">Gateway:</span>
                        <span className="config-value">{server.gateway}</span>
                      </div>
                    </div>

                    <div className="config-group">
                      <h4>DHCP Configuration</h4>
                      <div className="config-item">
                        <span className="config-label">Lease Time:</span>
                        <span className="config-value">
                          {(server.lease_time_seconds / 3600).toFixed(0)} hours
                        </span>
                      </div>
                      <div className="config-item">
                        <span className="config-label">Domain:</span>
                        <span className="config-value">{server.domain}</span>
                      </div>
                      <div className="config-item">
                        <span className="config-label">DNS Servers:</span>
                        <span className="config-value">
                          {server.dns_servers.join(', ')}
                        </span>
                      </div>
                    </div>

                    <div className="config-group">
                      <h4>Pool Status</h4>
                      <div className="config-item">
                        <span className="config-label">Active Leases:</span>
                        <span className="config-value">{server.active_leases}</span>
                      </div>
                      <div className="config-item">
                        <span className="config-label">Total Leases:</span>
                        <span className="config-value">{server.total_leases}</span>
                      </div>
                      <div className="config-item">
                        <span className="config-label">Utilization:</span>
                        <span
                          className="config-value"
                          style={{
                            color:
                              server.utilization_percent > 80
                                ? '#EF4444'
                                : server.utilization_percent > 60
                                ? '#F59E0B'
                                : '#10B981',
                          }}
                        >
                          {server.utilization_percent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leases Tab */}
        {activeTab === 'leases' && (
          <div className="section">
            <h2>Active DHCP Leases</h2>
            <table className="leases-table">
              <thead>
                <tr>
                  <th>IP Address</th>
                  <th>MAC Address</th>
                  <th>Hostname</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Expires In</th>
                  <th>Remaining %</th>
                </tr>
              </thead>
              <tbody>
                {leases.map((lease) => {
                  const expiryTime = new Date(lease.lease_expiry).getTime();
                  const now = Date.now();
                  const remaining = Math.max(0, ((expiryTime - now) / (lease.remaining_seconds * 1000)) * 100);

                  return (
                    <tr key={lease.id} className={`lease-${lease.status}`}>
                      <td className="ip-cell">{lease.ip_address}</td>
                      <td className="mac-cell">{lease.mac_address}</td>
                      <td>{lease.hostname || lease.client_name}</td>
                      <td>
                        <span className={`type-badge ${lease.type}`}>{lease.type}</span>
                      </td>
                      <td>
                        <span
                          className="status-badge"
                          style={{ backgroundColor: getStatusColor(lease.status) }}
                        >
                          {lease.status}
                        </span>
                      </td>
                      <td>
                        {Math.floor(lease.remaining_seconds / 3600)}h{' '}
                        {Math.floor((lease.remaining_seconds % 3600) / 60)}m
                      </td>
                      <td>
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${remaining}%`,
                              backgroundColor:
                                remaining > 50
                                  ? '#10B981'
                                  : remaining > 20
                                  ? '#F59E0B'
                                  : '#EF4444',
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* DHCP Options Tab */}
        {activeTab === 'options' && (
          <div className="section">
            <h2>DHCP Options Configuration</h2>
            <div className="options-list">
              {options.map((opt) => (
                <div key={opt.id} className={`option-card ${opt.enabled ? 'enabled' : 'disabled'}`}>
                  <div className="option-header">
                    <h4>
                      Option {opt.option_number}: {opt.option_name}
                    </h4>
                    <span className={`option-status ${opt.enabled ? 'enabled' : 'disabled'}`}>
                      {opt.enabled ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="option-details">
                    <p>
                      <strong>Type:</strong> {opt.option_type}
                    </p>
                    <p>
                      <strong>Value:</strong> <code>{opt.option_value}</code>
                    </p>
                    <p>
                      <strong>Description:</strong> {opt.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Static Reservations Tab */}
        {activeTab === 'reservations' && (
          <div className="section">
            <h2>Static IP Reservations</h2>
            <table className="reservations-table">
              <thead>
                <tr>
                  <th>MAC Address</th>
                  <th>IP Address</th>
                  <th>Hostname</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((res) => (
                  <tr key={res.id}>
                    <td className="mac-cell">{res.mac_address}</td>
                    <td className="ip-cell">{res.ip_address}</td>
                    <td>{res.hostname}</td>
                    <td>{res.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* DNS Tab */}
        {activeTab === 'dns' && (
          <div className="section">
            <h2>DNS Records & Cache</h2>

            {/* DNS Cache Stats */}
            {dnsCache && (
              <div className="dns-cache-stats">
                <h3>DNS Cache Statistics</h3>
                <div className="cache-stats-grid">
                  <div className="cache-stat">
                    <span className="label">Cache Size</span>
                    <span className="value">{dnsCache.cache_size}</span>
                  </div>
                  <div className="cache-stat">
                    <span className="label">Cache Used</span>
                    <span className="value">{dnsCache.cache_used}</span>
                  </div>
                  <div className="cache-stat">
                    <span className="label">Utilization</span>
                    <span className="value">{dnsCache.cache_util_percent.toFixed(1)}%</span>
                  </div>
                  <div className="cache-stat">
                    <span className="label">Cache Hits</span>
                    <span className="value">{dnsCache.cache_hits}</span>
                  </div>
                  <div className="cache-stat">
                    <span className="label">Cache Misses</span>
                    <span className="value">{dnsCache.cache_misses}</span>
                  </div>
                  <div className="cache-stat">
                    <span className="label">Hit Ratio</span>
                    <span className="value">{dnsCache.hit_ratio_percent.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* DNS Records Table */}
            <table className="dns-table">
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th>TTL</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {dnsRecords.map((record) => (
                  <tr key={record.id}>
                    <td>{record.domain}</td>
                    <td>
                      <span className="record-type">{record.record_type}</span>
                    </td>
                    <td className="dns-value">{record.value}</td>
                    <td>{record.ttl}s</td>
                    <td>
                      <span className={`dns-status ${record.enabled ? 'enabled' : 'disabled'}`}>
                        {record.enabled ? '✓ Active' : '✗ Disabled'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* DHCP Client Tab */}
        {activeTab === 'dhcp-client' && (
          <div className="section">
            <h2>DHCP Client Configuration</h2>
            <div className="clients-list">
              {clients.map((client) => (
                <div key={client.id} className="client-card">
                  <div className="client-header">
                    <h4>{client.interface_name}</h4>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(client.status) }}
                    >
                      {client.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="client-details">
                    <div className="detail-column">
                      <h5>Current Configuration</h5>
                      <p>
                        <strong>IP Address:</strong> {client.ip_address}
                      </p>
                      <p>
                        <strong>Netmask:</strong> {client.netmask}
                      </p>
                      <p>
                        <strong>Gateway:</strong> {client.gateway}
                      </p>
                      <p>
                        <strong>DHCP Server:</strong> {client.dhcp_server}
                      </p>
                    </div>

                    <div className="detail-column">
                      <h5>Lease Information</h5>
                      <p>
                        <strong>Status:</strong> {client.status}
                      </p>
                      <p>
                        <strong>Remaining Time:</strong>{' '}
                        {Math.floor(client.lease_remaining_seconds / 3600)}h{' '}
                        {Math.floor((client.lease_remaining_seconds % 3600) / 60)}m
                      </p>
                      <p>
                        <strong>Renewal At:</strong>{' '}
                        {new Date(client.renewal_time).toLocaleTimeString()}
                      </p>
                      <p>
                        <strong>Rebind At:</strong>{' '}
                        {new Date(client.rebind_time).toLocaleTimeString()}
                      </p>
                    </div>

                    <div className="detail-column">
                      <h5>DNS & Network</h5>
                      <p>
                        <strong>DNS Servers:</strong>
                        <br />
                        {client.dns_servers.map((dns, idx) => (
                          <span key={idx} className="dns-item">
                            {dns}
                          </span>
                        ))}
                      </p>
                      <p>
                        <strong>Uptime:</strong> {client.uptime}
                      </p>
                    </div>
                  </div>

                  <div className="lease-progress">
                    <p className="progress-label">Lease Progress</p>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${calculateLeaseProgress(
                            client.lease_start,
                            client.lease_expiry
                          )}%`,
                        }}
                      />
                    </div>
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
