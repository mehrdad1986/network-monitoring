import { UIIcon } from '../components/UIIcon';
import { useState, useEffect } from 'react';
import './Probes.css';
import apiService from '../services/api';

interface Probe {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline';
  lastHeartbeat: string;
  apiKey: string;
  version: string;
  tasksExecuted: number;
  uptime: string;
  ip: string;
}

export const Probes = () => {
  const [error, setError] = useState('');
  const [probes, setProbes] = useState<Probe[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchProbes();
  }, []);

  const fetchProbes = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiService.getProbes();
      setProbes(data.map(probe => ({
        id: probe.id, name: probe.name, location: probe.location || 'Unknown',
        status: probe.status === 'active' ? 'online' : 'offline',
        lastHeartbeat: probe.last_heartbeat ? new Date(probe.last_heartbeat).toLocaleString() : 'Never',
        apiKey: 'Not available', version: 'Unknown', tasksExecuted: 0, uptime: 'Unknown', ip: 'Unknown',
      })));
    } catch (error) {
      console.error('Failed to fetch probes:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch probes');
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: probes.length,
    online: probes.filter(p => p.status === 'online').length,
    offline: probes.filter(p => p.status === 'offline').length,
    totalTasks: probes.reduce((sum, p) => sum + p.tasksExecuted, 0)
  };

  return (
    <div className="probes-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">INFRASTRUCTURE</div>
          <h1 className="page-title">Monitoring Probes</h1>
          <p className="page-subtitle">Manage distributed monitoring probes across different locations and networks.</p>
        </div>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <span><UIIcon symbol="➕" /></span> Register Probe
          </button>
          <button className="btn-primary" onClick={fetchProbes}>
            <span><UIIcon symbol="🔄" /></span> Refresh
          </button>
        </div>
      </div>

      {error && <div className="probe-service-message" role="alert"><UIIcon symbol="info" /><div><strong>Probe service unavailable</strong><p>{error}</p></div><button className="btn-secondary" onClick={fetchProbes}>Retry connection</button></div>}
      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon"><UIIcon symbol="🖥️" /></div>
          <div className="stat-content">
            <div className="stat-label">TOTAL PROBES</div>
            <div className="stat-value">{error ? '—' : stats.total}</div>
          </div>
        </div>

        <div className="stat-card stat-success">
          <div className="stat-icon"><UIIcon symbol="✅" /></div>
          <div className="stat-content">
            <div className="stat-label">ONLINE</div>
            <div className="stat-value">{error ? '—' : stats.online}</div>
          </div>
        </div>

        <div className="stat-card stat-danger">
          <div className="stat-icon"><UIIcon symbol="❌" /></div>
          <div className="stat-content">
            <div className="stat-label">OFFLINE</div>
            <div className="stat-value">{error ? '—' : stats.offline}</div>
          </div>
        </div>

        <div className="stat-card stat-info">
          <div className="stat-icon"><UIIcon symbol="📊" /></div>
          <div className="stat-content">
            <div className="stat-label">TASKS EXECUTED</div>
            <div className="stat-value">{error ? '—' : stats.totalTasks.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Probes Grid */}
      {loading ? (
        <div className="loading-state">Loading probes...</div>
      ) : error && probes.length === 0 ? null : probes.length === 0 ? (
        <div className="noc-card empty-state">
          <div className="empty-icon"><UIIcon symbol="🖥️" /></div>
          <h3>No Probes Registered</h3>
          <p>Register your first monitoring probe to start distributed monitoring.</p>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <span><UIIcon symbol="➕" /></span> Register First Probe
          </button>
        </div>
      ) : (
        <div className="probes-grid">
          {probes.map((probe) => (
            <div key={probe.id} className="probe-card noc-card">
              <div className="probe-header">
                <div className="probe-info">
                  <h3 className="probe-name">{probe.name}</h3>
                  <p className="probe-location"><UIIcon symbol="📍" /> {probe.location}</p>
                </div>
                <span className={`status-badge ${probe.status}`}>
                  {probe.status === 'online' ? <><UIIcon symbol="🟢" /></> : <><UIIcon symbol="🔴" /></>}
                  <span>{probe.status.toUpperCase()}</span>
                </span>
              </div>

              <div className="probe-metrics">
                <div className="metric-row">
                  <span className="metric-label">IP Address</span>
                  <span className="metric-value code">{probe.ip}</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Version</span>
                  <span className="metric-value">{probe.version}</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Last Heartbeat</span>
                  <span className="metric-value">{probe.lastHeartbeat}</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Uptime</span>
                  <span className="metric-value">{probe.uptime}</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Tasks Executed</span>
                  <span className="metric-value">{probe.tasksExecuted.toLocaleString()}</span>
                </div>
              </div>

              <div className="probe-api-key">
                <span className="api-key-label">API Key:</span>
                <code className="api-key-value">{probe.apiKey}</code>
                <button className="copy-btn" title="Copy API Key"><UIIcon symbol="📋" /></button>
              </div>

              <div className="probe-actions">
                <button className="action-btn"><UIIcon symbol="📊" /> View Stats</button>
                <button className="action-btn"><UIIcon symbol="⚙️" /> Configure</button>
                <button className="action-btn danger"><UIIcon symbol="🗑️" /> Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Probe Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Register New Probe</h2>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Probe Name</label>
                <input type="text" placeholder="e.g., Probe-NYC-01" />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input type="text" placeholder="e.g., New York, USA" />
              </div>
              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea placeholder="Probe description..." rows={3}></textarea>
              </div>
              <div className="info-box">
                <p><strong><UIIcon symbol="📋" /> Setup Instructions:</strong></p>
                <ol>
                  <li>Click "Generate API Key" to create credentials</li>
                  <li>Copy the API key (shown only once)</li>
                  <li>Install probe on target system: <code>go run cmd/probe/main.go</code></li>
                  <li>Configure with API key and server URL</li>
                </ol>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn-primary"><UIIcon symbol="🔑" /> Generate API Key & Register</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
