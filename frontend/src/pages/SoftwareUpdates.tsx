import { UIIcon } from '../components/UIIcon';
import { useState } from 'react';
import './SoftwareUpdates.css';

interface Package {
  id: string;
  name: string;
  currentVersion: string;
  availableVersion: string;
  size: number;
  category: 'security' | 'bugfix' | 'feature' | 'system';
  status: 'available' | 'installed' | 'updating' | 'failed';
  releaseDate: string;
  changelog: string[];
  selected: boolean;
}

interface SystemUpdate {
  id: string;
  name: string;
  version: string;
  size: number;
  releaseDate: string;
  status: 'available' | 'installed' | 'downloading';
  progress: number;
  critical: boolean;
}

export default function SoftwareUpdates() {
  const [activeTab, setActiveTab] = useState('packages');
  const [autoUpdate, setAutoUpdate] = useState(true);

  const [packages, setPackages] = useState<Package[]>([
    {
      id: '1',
      name: 'kea-dhcp4',
      currentVersion: '2.4.1',
      availableVersion: '2.5.0',
      size: 45,
      category: 'feature',
      status: 'available',
      releaseDate: '2026-09-18',
      changelog: ['New DHCPv6 support', 'Performance improvements', 'Bug fixes'],
      selected: true,
    },
    {
      id: '2',
      name: 'nginx',
      currentVersion: '1.24.0',
      availableVersion: '1.25.0',
      size: 12,
      category: 'security',
      status: 'available',
      releaseDate: '2026-09-15',
      changelog: ['Security patch for SSL/TLS', 'Module updates'],
      selected: true,
    },
    {
      id: '3',
      name: 'postgresql',
      currentVersion: '15.2',
      availableVersion: '15.3',
      size: 35,
      category: 'bugfix',
      status: 'available',
      releaseDate: '2026-09-10',
      changelog: ['Bug fixes', 'Performance tuning'],
      selected: false,
    },
    {
      id: '4',
      name: 'dnsmasq',
      currentVersion: '2.89',
      availableVersion: '2.90',
      size: 8,
      category: 'security',
      status: 'available',
      releaseDate: '2026-09-12',
      changelog: ['DNS security improvements', 'Cache management updates'],
      selected: true,
    },
    {
      id: '5',
      name: 'openssh-server',
      currentVersion: '9.1p1',
      availableVersion: '9.2p1',
      size: 15,
      category: 'security',
      status: 'available',
      releaseDate: '2026-09-08',
      changelog: ['Critical security patch'],
      selected: true,
    },
  ]);

  const [systemUpdates, setSystemUpdates] = useState<SystemUpdate[]>([
    {
      id: 'ubuntu-2026.09',
      name: 'Ubuntu 22.04 LTS - September Updates',
      version: '22.04.3',
      size: 520,
      releaseDate: '2026-09-10',
      status: 'available',
      progress: 0,
      critical: true,
    },
    {
      id: 'kernel-6.5.9',
      name: 'Linux Kernel 6.5.9',
      version: '6.5.9',
      size: 180,
      releaseDate: '2026-09-15',
      status: 'available',
      progress: 0,
      critical: false,
    },
  ]);

  const selectedSize = packages
    .filter(p => p.selected)
    .reduce((sum, p) => sum + p.size, 0);

  const selectedCount = packages.filter(p => p.selected).length;

  const securityUpdates = packages.filter(p => p.category === 'security' && p.status === 'available').length;

  const togglePackage = (id: string) => {
    setPackages(packages.map(p => (p.id === id ? { ...p, selected: !p.selected } : p)));
  };

  const handleInstallUpdates = () => {
    setPackages(
      packages.map(p =>
        p.selected ? { ...p, status: 'updating', selected: false } : p
      )
    );
    setTimeout(() => {
      setPackages(packages =>
        packages.map(p =>
          p.status === 'updating' ? { ...p, status: 'installed' } : p
        )
      );
    }, 2000);
  };

  return (
    <div className="software-updates">
      <div className="update-header">
        <h1>Software Updates</h1>
        <p className="update-subtitle">Manage package updates and system patches</p>
      </div>

      <div className="update-stats">
        <div className="stat-card">
          <div className="stat-icon"><UIIcon symbol="📦" /></div>
          <div className="stat-content">
            <div className="stat-label">Available Updates</div>
            <div className="stat-value">{packages.filter(p => p.status === 'available').length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><UIIcon symbol="⚠️" /></div>
          <div className="stat-content">
            <div className="stat-label">Security Updates</div>
            <div className="stat-value">{securityUpdates}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✓</div>
          <div className="stat-content">
            <div className="stat-label">Selected</div>
            <div className="stat-value">{selectedCount}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><UIIcon symbol="💾" /></div>
          <div className="stat-content">
            <div className="stat-label">Total Size</div>
            <div className="stat-value">{selectedSize} MB</div>
          </div>
        </div>
      </div>

      <div className="update-settings">
        <div className="settings-card">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={autoUpdate}
              onChange={e => setAutoUpdate(e.target.checked)}
            />
            <span className="toggle-text">Enable automatic updates</span>
          </label>
          <p className="settings-info">Updates will be installed automatically when available</p>
        </div>
      </div>

      <div className="update-tabs">
        <button
          className={`update-tab ${activeTab === 'packages' ? 'active' : ''}`}
          onClick={() => setActiveTab('packages')}
        >
          <UIIcon symbol="📦" /> Packages
        </button>
        <button
          className={`update-tab ${activeTab === 'system' ? 'active' : ''}`}
          onClick={() => setActiveTab('system')}
        >
          <UIIcon symbol="🖥️" /> System
        </button>
        <button
          className={`update-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <UIIcon symbol="📜" /> History
        </button>
      </div>

      <div className="update-content">
        {/* Packages Tab */}
        {activeTab === 'packages' && (
          <div className="update-section">
            <div className="packages-header">
              <h3>Package Updates</h3>
              <button className="install-btn" onClick={handleInstallUpdates} disabled={selectedCount === 0}>
                Install Selected ({selectedCount})
              </button>
            </div>

            <div className="packages-list">
              {packages.map(pkg => (
                <div key={pkg.id} className={`package-card ${pkg.status}`}>
                  <div className="package-checkbox">
                    <input
                      type="checkbox"
                      checked={pkg.selected}
                      onChange={() => togglePackage(pkg.id)}
                      disabled={pkg.status !== 'available'}
                    />
                  </div>

                  <div className="package-info">
                    <div className="package-header">
                      <h4>{pkg.name}</h4>
                      <div className="package-badges">
                        <span className={`category-badge ${pkg.category}`}>
                          {pkg.category === 'security' ? <><UIIcon symbol="🔒" /> Security</> :
                           pkg.category === 'bugfix' ? <><UIIcon symbol="🐛" /> Bugfix</> :
                           pkg.category === 'feature' ? <><UIIcon symbol="✨" /> Feature</> : <><UIIcon symbol="⚙️" /> System</>}
                        </span>
                        <span className={`status-badge ${pkg.status}`}>
                          {pkg.status === 'available' ? <><UIIcon symbol="📥" /> Available</> :
                           pkg.status === 'installed' ? '✓ Installed' :
                           pkg.status === 'updating' ? <><UIIcon symbol="⏳" /> Updating</> : <><UIIcon symbol="❌" /> Failed</>}
                        </span>
                      </div>
                    </div>

                    <div className="package-details">
                      <div className="detail">
                        <span className="label">Version:</span>
                        <span className="value">
                          {pkg.currentVersion} → {pkg.availableVersion}
                        </span>
                      </div>
                      <div className="detail">
                        <span className="label">Size:</span>
                        <span className="value">{pkg.size} MB</span>
                      </div>
                      <div className="detail">
                        <span className="label">Released:</span>
                        <span className="value">{pkg.releaseDate}</span>
                      </div>
                    </div>

                    {pkg.changelog && pkg.changelog.length > 0 && (
                      <div className="changelog">
                        <strong>Changes:</strong>
                        <ul>
                          {pkg.changelog.map((change, idx) => (
                            <li key={idx}>{change}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* System Tab */}
        {activeTab === 'system' && (
          <div className="update-section">
            <h3>System Updates</h3>
            <div className="system-updates-list">
              {systemUpdates.map(update => (
                <div key={update.id} className={`system-update-card ${update.status} ${update.critical ? 'critical' : ''}`}>
                  <div className="update-icon">
                    {update.critical ? <><UIIcon symbol="🔴" /></> : <><UIIcon symbol="🟡" /></>}
                  </div>

                  <div className="update-info">
                    <h4>{update.name}</h4>
                    <div className="update-meta">
                      <span className="version">v{update.version}</span>
                      <span className="date">{update.releaseDate}</span>
                      <span className="size">{update.size} MB</span>
                    </div>
                  </div>

                  <div className="update-status">
                    {update.status === 'available' && (
                      <>
                        <button className="btn-install">Install</button>
                        <button className="btn-details">Details</button>
                      </>
                    )}
                    {update.status === 'downloading' && (
                      <div className="progress-container">
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${update.progress}%` }}></div>
                        </div>
                        <span className="progress-text">{update.progress}%</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="update-section">
            <h3>Update History</h3>
            <div className="history-table-container">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Package</th>
                    <th>From Version</th>
                    <th>To Version</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { pkg: 'nginx', from: '1.23.0', to: '1.24.0', date: '2026-08-15', status: 'success' },
                    { pkg: 'postgresql', from: '15.1', to: '15.2', date: '2026-08-10', status: 'success' },
                    { pkg: 'kea-dhcp4', from: '2.4.0', to: '2.4.1', date: '2026-08-05', status: 'success' },
                    { pkg: 'openssh-server', from: '9.0p1', to: '9.1p1', date: '2026-07-28', status: 'success' },
                    { pkg: 'dnsmasq', from: '2.88', to: '2.89', date: '2026-07-20', status: 'success' },
                  ].map((item, idx) => (
                    <tr key={idx}>
                      <td className="package-name">{item.pkg}</td>
                      <td className="version">{item.from}</td>
                      <td className="version">{item.to}</td>
                      <td className="date">{item.date}</td>
                      <td>
                        <span className="status-badge success">✓ {item.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
