import { UIIcon } from '../components/UIIcon';
import { useState, useEffect } from 'react';
import './NetworkDiscovery.css';

interface DiscoveryTarget {
  id: string;
  name: string;
  ipAddress: string;
  macAddress: string;
  deviceType: string;
  vendor: string;
  status: 'discovered' | 'verifying' | 'failed';
  snmpEnabled: boolean;
  services: number;
  lastDiscovered: string;
}

interface DiscoveryPolicy {
  id: string;
  name: string;
  ranges: string[];
  protocols: string[];
  enabled: boolean;
  schedule: string;
  lastRun: string;
}

export default function NetworkDiscovery() {
  const [activeTab, setActiveTab] = useState('discovery');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const [discoveredNodes, setDiscoveredNodes] = useState<DiscoveryTarget[]>([
    { id: 'node-1', name: 'Router-01', ipAddress: '192.168.1.1', macAddress: '00:11:22:33:44:55', deviceType: 'Router', vendor: 'Cisco', status: 'discovered', snmpEnabled: true, services: 5, lastDiscovered: new Date().toISOString() },
    { id: 'node-2', name: 'Switch-Core', ipAddress: '192.168.1.2', macAddress: '00:11:22:33:44:66', deviceType: 'Switch', vendor: 'Juniper', status: 'discovered', snmpEnabled: true, services: 12, lastDiscovered: new Date().toISOString() },
    { id: 'node-3', name: 'Firewall-FW01', ipAddress: '192.168.1.3', macAddress: '00:11:22:33:44:77', deviceType: 'Firewall', vendor: 'Palo Alto', status: 'discovered', snmpEnabled: true, services: 8, lastDiscovered: new Date().toISOString() },
    { id: 'node-4', name: 'Server-Web-01', ipAddress: '192.168.1.100', macAddress: '00:11:22:33:44:88', deviceType: 'Server', vendor: 'Dell', status: 'discovered', snmpEnabled: false, services: 3, lastDiscovered: new Date().toISOString() },
    { id: 'node-5', name: 'AP-Wireless-01', ipAddress: '192.168.1.50', macAddress: '00:11:22:33:44:99', deviceType: 'Access Point', vendor: 'Arista', status: 'verifying', snmpEnabled: true, services: 2, lastDiscovered: new Date().toISOString() },
  ]);

  const [discoveryPolicies, setDiscoveryPolicies] = useState<DiscoveryPolicy[]>([
    { id: 'policy-1', name: 'Corporate Network', ranges: ['192.168.0.0/16', '10.0.0.0/8'], protocols: ['ICMP', 'SNMP', 'SSH'], enabled: true, schedule: 'Daily at 2:00 AM', lastRun: new Date(Date.now() - 3600000).toISOString() },
    { id: 'policy-2', name: 'DMZ Scan', ranges: ['10.20.0.0/24'], protocols: ['ICMP', 'TCP', 'HTTP'], enabled: true, schedule: 'Every 6 hours', lastRun: new Date(Date.now() - 1800000).toISOString() },
    { id: 'policy-3', name: 'Guest Network', ranges: ['10.50.0.0/24'], protocols: ['ICMP', 'DHCP'], enabled: false, schedule: 'Weekly', lastRun: new Date(Date.now() - 86400000).toISOString() },
  ]);

  const handleStartDiscovery = () => {
    setIsScanning(true);
    setScanProgress(0);

    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsScanning(false);
          return 100;
        }
        return prev + Math.random() * 20;
      });
    }, 400);
  };

  const stats = {
    discovered: discoveredNodes.filter(n => n.status === 'discovered').length,
    verifying: discoveredNodes.filter(n => n.status === 'verifying').length,
    failed: discoveredNodes.filter(n => n.status === 'failed').length,
    snmpEnabled: discoveredNodes.filter(n => n.snmpEnabled).length,
  };

  return (
    <div className="network-discovery">
      <div className="discovery-header">
        <div className="header-content">
          <h1><UIIcon symbol="🔍" /> Network Discovery</h1>
          <p className="header-subtitle">Discover and inventory network nodes, devices, and services</p>
        </div>
        <button
          className={`scan-btn ${isScanning ? 'scanning' : ''}`}
          onClick={handleStartDiscovery}
          disabled={isScanning}
        >
          {isScanning ? '⟳ Scanning...' : <><UIIcon symbol="🔍" /> Start Discovery</>}
        </button>
      </div>

      {isScanning && (
        <div className="scan-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${scanProgress}%` }}></div>
          </div>
          <span className="progress-text">{Math.round(scanProgress)}%</span>
        </div>
      )}

      {/* Statistics */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon"><UIIcon symbol="🟢" /></span>
          <div className="stat-content">
            <span className="stat-label">Discovered</span>
            <span className="stat-value">{stats.discovered}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon"><UIIcon symbol="🟡" /></span>
          <div className="stat-content">
            <span className="stat-label">Verifying</span>
            <span className="stat-value">{stats.verifying}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon"><UIIcon symbol="❌" /></span>
          <div className="stat-content">
            <span className="stat-label">Failed</span>
            <span className="stat-value">{stats.failed}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon"><UIIcon symbol="📡" /></span>
          <div className="stat-content">
            <span className="stat-label">SNMP Enabled</span>
            <span className="stat-value">{stats.snmpEnabled}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="discovery-tabs">
        <button
          className={`tab ${activeTab === 'discovery' ? 'active' : ''}`}
          onClick={() => setActiveTab('discovery')}
        >
          <UIIcon symbol="📊" /> Discovered Nodes ({discoveredNodes.length})
        </button>
        <button
          className={`tab ${activeTab === 'policies' ? 'active' : ''}`}
          onClick={() => setActiveTab('policies')}
        >
          <UIIcon symbol="⚙️" /> Discovery Policies ({discoveryPolicies.length})
        </button>
        <button
          className={`tab ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          <UIIcon symbol="📥" /> Import/Provisioning
        </button>
      </div>

      {/* Content */}
      <div className="discovery-content">
        {activeTab === 'discovery' && (
          <div className="nodes-section">
            <h3>Discovered Network Nodes</h3>
            <div className="nodes-table">
              <div className="table-header">
                <div className="col-status">Status</div>
                <div className="col-name">Name</div>
                <div className="col-ip">IP Address</div>
                <div className="col-mac">MAC Address</div>
                <div className="col-type">Type</div>
                <div className="col-vendor">Vendor</div>
                <div className="col-snmp">SNMP</div>
                <div className="col-services">Services</div>
              </div>
              {discoveredNodes.map(node => (
                <div key={node.id} className={`table-row ${node.status}`}>
                  <div className="col-status">
                    <span className={`status-badge ${node.status}`}>
                      {node.status === 'discovered' ? '✓' : node.status === 'verifying' ? '⟳' : '✗'}
                    </span>
                  </div>
                  <div className="col-name">{node.name}</div>
                  <div className="col-ip"><code>{node.ipAddress}</code></div>
                  <div className="col-mac"><code>{node.macAddress}</code></div>
                  <div className="col-type">{node.deviceType}</div>
                  <div className="col-vendor">{node.vendor}</div>
                  <div className="col-snmp">
                    {node.snmpEnabled ? <span className="snmp-enabled">✓ Yes</span> : <span className="snmp-disabled">✗ No</span>}
                  </div>
                  <div className="col-services">{node.services}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'policies' && (
          <div className="policies-section">
            <h3>Discovery Policies</h3>
            <div className="policies-grid">
              {discoveryPolicies.map(policy => (
                <div key={policy.id} className={`policy-card ${policy.enabled ? 'enabled' : 'disabled'}`}>
                  <div className="policy-header">
                    <h4>{policy.name}</h4>
                    <span className={`enabled-badge ${policy.enabled ? 'on' : 'off'}`}>
                      {policy.enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>

                  <div className="policy-content">
                    <div className="detail">
                      <span className="label">IP Ranges:</span>
                      {policy.ranges.map((range, idx) => (
                        <div key={idx} className="range-item">
                          <code>{range}</code>
                        </div>
                      ))}
                    </div>

                    <div className="detail">
                      <span className="label">Protocols:</span>
                      <div className="protocols">
                        {policy.protocols.map((proto, idx) => (
                          <span key={idx} className="protocol-badge">{proto}</span>
                        ))}
                      </div>
                    </div>

                    <div className="detail">
                      <span className="label">Schedule:</span>
                      <span className="schedule">{policy.schedule}</span>
                    </div>

                    <div className="detail">
                      <span className="label">Last Run:</span>
                      <span className="timestamp">{new Date(policy.lastRun).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="policy-actions">
                    <button className="btn-edit">Edit</button>
                    <button className="btn-run">Run Now</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'import' && (
          <div className="import-section">
            <h3>Import & Provisioning</h3>
            <div className="import-content">
              <div className="import-card">
                <h4><UIIcon symbol="📄" /> Import from CSV</h4>
                <p>Upload a CSV file with network device information</p>
                <input type="file" accept=".csv" className="file-input" />
                <button className="btn-import">Import Devices</button>
              </div>

              <div className="import-card">
                <h4><UIIcon symbol="🔄" /> Auto-Provisioning</h4>
                <p>Automatically provision discovered devices with SNMP/SSH</p>
                <div className="provision-options">
                  <label><input type="checkbox" defaultChecked /> Enable SNMP on discovery</label>
                  <label><input type="checkbox" defaultChecked /> Configure SSH access</label>
                  <label><input type="checkbox" /> Add to monitoring groups</label>
                </div>
                <button className="btn-provision">Apply Provisioning</button>
              </div>

              <div className="import-card">
                <h4><UIIcon symbol="📤" /> Export Inventory</h4>
                <p>Export discovered devices as CSV or JSON</p>
                <div className="export-options">
                  <button className="btn-export">Export CSV</button>
                  <button className="btn-export">Export JSON</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Last Updated */}
      <div className="last-updated">
        Last discovery: {new Date().toLocaleString()}
      </div>
    </div>
  );
}
