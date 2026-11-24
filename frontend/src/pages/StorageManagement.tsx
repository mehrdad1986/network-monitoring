import { UIIcon } from '../components/UIIcon';
import { useState } from 'react';
import './StorageManagement.css';

interface Disk {
  id: string;
  name: string;
  size: number;
  used: number;
  type: 'ssd' | 'hdd';
  status: 'healthy' | 'warning' | 'critical';
  model: string;
  temp: number;
}

interface Partition {
  id: string;
  name: string;
  diskId: string;
  size: number;
  used: number;
  filesystem: string;
  mountPoint: string;
  status: 'healthy' | 'warning' | 'critical';
}

interface RAID {
  id: string;
  name: string;
  level: string;
  members: string[];
  status: 'healthy' | 'degraded' | 'failed';
  syncProgress: number;
}

interface LVM {
  id: string;
  name: string;
  size: number;
  used: number;
  status: 'active' | 'inactive';
}

export default function StorageManagement() {
  const [activeTab, setActiveTab] = useState('disks');

  const [disks, setDisks] = useState<Disk[]>([
    {
      id: 'sda',
      name: '/dev/sda',
      size: 2000,
      used: 900,
      type: 'ssd',
      status: 'healthy',
      model: 'Samsung 990 Pro 2TB',
      temp: 42,
    },
    {
      id: 'sdb',
      name: '/dev/sdb',
      size: 4000,
      used: 2800,
      type: 'hdd',
      status: 'healthy',
      model: 'WD Red 4TB',
      temp: 35,
    },
    {
      id: 'sdc',
      name: '/dev/sdc',
      size: 1000,
      used: 850,
      type: 'ssd',
      status: 'warning',
      model: 'Kingston 1TB',
      temp: 58,
    },
  ]);

  const [partitions, setPartitions] = useState<Partition[]>([
    {
      id: 'sda1',
      name: '/dev/sda1',
      diskId: 'sda',
      size: 512,
      used: 125,
      filesystem: 'ext4',
      mountPoint: '/boot',
      status: 'healthy',
    },
    {
      id: 'sda2',
      name: '/dev/sda2',
      diskId: 'sda',
      size: 1488,
      used: 775,
      filesystem: 'ext4',
      mountPoint: '/',
      status: 'healthy',
    },
    {
      id: 'sdb1',
      name: '/dev/sdb1',
      diskId: 'sdb',
      size: 4000,
      used: 2800,
      filesystem: 'ext4',
      mountPoint: '/data',
      status: 'healthy',
    },
    {
      id: 'sdc1',
      name: '/dev/sdc1',
      diskId: 'sdc',
      size: 1000,
      used: 850,
      filesystem: 'ext4',
      mountPoint: '/backup',
      status: 'warning',
    },
  ]);

  const [raids, setRaids] = useState<RAID[]>([
    {
      id: 'md0',
      name: 'md0',
      level: 'RAID 1',
      members: ['/dev/sda', '/dev/sdb'],
      status: 'healthy',
      syncProgress: 100,
    },
  ]);

  const [lvms, setLvms] = useState<LVM[]>([
    {
      id: 'vg0-lv0',
      name: 'vg0-lv0',
      size: 500,
      used: 350,
      status: 'active',
    },
    {
      id: 'vg0-lv1',
      name: 'vg0-lv1',
      size: 800,
      used: 600,
      status: 'active',
    },
  ]);

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} TB`;
    return `${bytes} GB`;
  };

  const getStorageTree = () => {
    return disks.map(disk => ({
      disk,
      partitions: partitions.filter(p => p.diskId === disk.id),
    }));
  };

  return (
    <div className="storage-management">
      <div className="storage-header">
        <h1>Storage Management</h1>
        <p className="storage-subtitle">Manage disks, partitions, RAID, and LVM volumes</p>
      </div>

      <div className="storage-stats">
        <div className="stat-card">
          <div className="stat-icon"><UIIcon symbol="💿" /></div>
          <div className="stat-content">
            <div className="stat-label">Total Capacity</div>
            <div className="stat-value">{formatBytes(disks.reduce((sum, d) => sum + d.size, 0))}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><UIIcon symbol="💾" /></div>
          <div className="stat-content">
            <div className="stat-label">Used Space</div>
            <div className="stat-value">{formatBytes(disks.reduce((sum, d) => sum + d.used, 0))}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><UIIcon symbol="📊" /></div>
          <div className="stat-content">
            <div className="stat-label">Free Space</div>
            <div className="stat-value">{formatBytes(disks.reduce((sum, d) => sum + (d.size - d.used), 0))}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><UIIcon symbol="📈" /></div>
          <div className="stat-content">
            <div className="stat-label">Usage %</div>
            <div className="stat-value">
              {Math.round(
                (disks.reduce((sum, d) => sum + d.used, 0) / disks.reduce((sum, d) => sum + d.size, 0)) * 100
              )}%
            </div>
          </div>
        </div>
      </div>

      <div className="storage-tabs">
        <button
          className={`storage-tab ${activeTab === 'disks' ? 'active' : ''}`}
          onClick={() => setActiveTab('disks')}
        >
          <UIIcon symbol="💿" /> Disks
        </button>
        <button
          className={`storage-tab ${activeTab === 'partitions' ? 'active' : ''}`}
          onClick={() => setActiveTab('partitions')}
        >
          <UIIcon symbol="📁" /> Partitions
        </button>
        <button
          className={`storage-tab ${activeTab === 'raid' ? 'active' : ''}`}
          onClick={() => setActiveTab('raid')}
        >
          <UIIcon symbol="⛓️" /> RAID
        </button>
        <button
          className={`storage-tab ${activeTab === 'lvm' ? 'active' : ''}`}
          onClick={() => setActiveTab('lvm')}
        >
          <UIIcon symbol="🔗" /> LVM
        </button>
        <button
          className={`storage-tab ${activeTab === 'tree' ? 'active' : ''}`}
          onClick={() => setActiveTab('tree')}
        >
          <UIIcon symbol="🌳" /> Tree View
        </button>
      </div>

      <div className="storage-content">
        {/* Disks Tab */}
        {activeTab === 'disks' && (
          <div className="storage-section">
            <div className="disks-grid">
              {disks.map(disk => {
                const usage = Math.round((disk.used / disk.size) * 100);
                return (
                  <div key={disk.id} className={`disk-card ${disk.status}`}>
                    <div className="disk-header">
                      <h3>{disk.name}</h3>
                      <span className={`disk-type ${disk.type}`}>{disk.type.toUpperCase()}</span>
                    </div>

                    <div className="disk-model">{disk.model}</div>

                    <div className="disk-usage">
                      <div className="usage-bar">
                        <div className="usage-fill" style={{ width: `${usage}%` }}></div>
                      </div>
                      <div className="usage-text">
                        {formatBytes(disk.used)} / {formatBytes(disk.size)} ({usage}%)
                      </div>
                    </div>

                    <div className="disk-details">
                      <div className="detail-row">
                        <span className="label">Status:</span>
                        <span className={`value ${disk.status}`}>
                          {disk.status === 'healthy' ? <><UIIcon symbol="🟢" /> Healthy</> : disk.status === 'warning' ? <><UIIcon symbol="🟡" /> Warning</> : <><UIIcon symbol="🔴" /> Critical</>}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Temperature:</span>
                        <span className="value">{disk.temp}°C</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Free Space:</span>
                        <span className="value">{formatBytes(disk.size - disk.used)}</span>
                      </div>
                    </div>

                    <div className="disk-actions">
                      <button className="action-btn"><UIIcon symbol="🔧" /> Properties</button>
                      <button className="action-btn"><UIIcon symbol="⚠️" /> SMART Test</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Partitions Tab */}
        {activeTab === 'partitions' && (
          <div className="storage-section">
            <div className="partitions-table-container">
              <table className="partitions-table">
                <thead>
                  <tr>
                    <th>Partition</th>
                    <th>Disk</th>
                    <th>Size</th>
                    <th>Used</th>
                    <th>Free</th>
                    <th>Usage %</th>
                    <th>FS Type</th>
                    <th>Mount Point</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {partitions.map(partition => {
                    const usage = Math.round((partition.used / partition.size) * 100);
                    return (
                      <tr key={partition.id} className={`partition-row ${partition.status}`}>
                        <td className="partition-name">{partition.name}</td>
                        <td>{partition.diskId}</td>
                        <td>{formatBytes(partition.size)}</td>
                        <td>{formatBytes(partition.used)}</td>
                        <td>{formatBytes(partition.size - partition.used)}</td>
                        <td className="usage-cell">{usage}%</td>
                        <td className="fs-type">{partition.filesystem}</td>
                        <td className="mount-point">{partition.mountPoint}</td>
                        <td className="status-cell">
                          <span className={`status-badge ${partition.status}`}>
                            {partition.status === 'healthy' ? <><UIIcon symbol="🟢" /> Healthy</> : partition.status === 'warning' ? <><UIIcon symbol="🟡" /> Warning</> : <><UIIcon symbol="🔴" /> Critical</>}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RAID Tab */}
        {activeTab === 'raid' && (
          <div className="storage-section">
            <div className="raid-container">
              <div className="raid-header">
                <h3>RAID Arrays</h3>
                <button className="add-btn">+ Create RAID</button>
              </div>
              <div className="raid-cards">
                {raids.map(raid => (
                  <div key={raid.id} className={`raid-card ${raid.status}`}>
                    <div className="raid-card-header">
                      <h4>{raid.name}</h4>
                      <span className={`raid-level ${raid.status}`}>{raid.level}</span>
                    </div>

                    <div className="raid-status">
                      <span className={`status-indicator ${raid.status}`}>
                        {raid.status === 'healthy' ? <><UIIcon symbol="🟢" /> Healthy</> : raid.status === 'degraded' ? <><UIIcon symbol="🟡" /> Degraded</> : <><UIIcon symbol="🔴" /> Failed</>}
                      </span>
                    </div>

                    <div className="raid-members">
                      <strong>Members:</strong>
                      <ul>
                        {raid.members.map((member, idx) => (
                          <li key={idx}>{member}</li>
                        ))}
                      </ul>
                    </div>

                    {raid.syncProgress < 100 && (
                      <div className="sync-progress">
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${raid.syncProgress}%` }}></div>
                        </div>
                        <span className="progress-text">Sync: {raid.syncProgress}%</span>
                      </div>
                    )}

                    <div className="raid-actions">
                      <button className="action-btn"><UIIcon symbol="🔧" /> Manage</button>
                      <button className="action-btn"><UIIcon symbol="🔍" /> Details</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* LVM Tab */}
        {activeTab === 'lvm' && (
          <div className="storage-section">
            <div className="lvm-container">
              <div className="lvm-header">
                <h3>Logical Volume Manager</h3>
                <button className="add-btn">+ Create Volume</button>
              </div>
              <div className="lvm-cards">
                {lvms.map(lvm => {
                  const usage = Math.round((lvm.used / lvm.size) * 100);
                  return (
                    <div key={lvm.id} className={`lvm-card ${lvm.status}`}>
                      <div className="lvm-card-header">
                        <h4>{lvm.name}</h4>
                        <span className={`lvm-status ${lvm.status}`}>
                          {lvm.status === 'active' ? <><UIIcon symbol="🟢" /> Active</> : <><UIIcon symbol="🔴" /> Inactive</>}
                        </span>
                      </div>

                      <div className="lvm-usage">
                        <div className="usage-bar">
                          <div className="usage-fill" style={{ width: `${usage}%` }}></div>
                        </div>
                        <div className="usage-text">
                          {formatBytes(lvm.used)} / {formatBytes(lvm.size)} ({usage}%)
                        </div>
                      </div>

                      <div className="lvm-actions">
                        <button className="action-btn"><UIIcon symbol="⚙️" /> Edit</button>
                        <button className="action-btn"><UIIcon symbol="📈" /> Resize</button>
                        <button className="action-btn"><UIIcon symbol="🗑️" /> Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tree View Tab */}
        {activeTab === 'tree' && (
          <div className="storage-section">
            <div className="tree-container">
              <h3>Storage Hierarchy</h3>
              <div className="storage-tree">
                {getStorageTree().map(item => (
                  <div key={item.disk.id} className="tree-node">
                    <div className="tree-item disk-item">
                      <span className="tree-icon"><UIIcon symbol="💿" /></span>
                      <span className="tree-label">{item.disk.name}</span>
                      <span className="tree-info">
                        {formatBytes(item.disk.used)} / {formatBytes(item.disk.size)}
                      </span>
                    </div>
                    <div className="tree-children">
                      {item.partitions.map(partition => (
                        <div key={partition.id} className="tree-node">
                          <div className="tree-item partition-item">
                            <span className="tree-icon"><UIIcon symbol="📁" /></span>
                            <span className="tree-label">{partition.name}</span>
                            <span className="tree-info">{partition.mountPoint}</span>
                            <span className="tree-info">
                              {Math.round((partition.used / partition.size) * 100)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
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
