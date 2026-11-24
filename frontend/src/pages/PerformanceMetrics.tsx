import { UIIcon } from '../components/UIIcon';
import { useState, useEffect } from 'react';
import './PerformanceMetrics.css';

interface MetricData {
  timestamp: string;
  value: number;
}

interface PerformanceMetric {
  id: string;
  name: string;
  category: 'cpu' | 'memory' | 'disk' | 'network' | 'sensor' | 'availability';
  current: number;
  threshold: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  history: MetricData[];
}

interface Threshold {
  id: string;
  metric: string;
  warning: number;
  critical: number;
  enabled: boolean;
}

export default function PerformanceMetrics() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('1h');

  const [metrics, setMetrics] = useState<PerformanceMetric[]>([
    {
      id: 'cpu-1',
      name: 'CPU Usage',
      category: 'cpu',
      current: 62,
      threshold: 80,
      unit: '%',
      status: 'normal',
      history: Array.from({ length: 60 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        value: 45 + Math.random() * 30,
      })).reverse(),
    },
    {
      id: 'mem-1',
      name: 'Memory Usage',
      category: 'memory',
      current: 78,
      threshold: 85,
      unit: '%',
      status: 'warning',
      history: Array.from({ length: 60 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        value: 60 + Math.random() * 25,
      })).reverse(),
    },
    {
      id: 'disk-1',
      name: 'Disk Usage (/)',
      category: 'disk',
      current: 85,
      threshold: 90,
      unit: '%',
      status: 'warning',
      history: Array.from({ length: 60 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        value: 80 + Math.random() * 10,
      })).reverse(),
    },
    {
      id: 'latency-1',
      name: 'Network Latency',
      category: 'network',
      current: 45,
      threshold: 100,
      unit: 'ms',
      status: 'normal',
      history: Array.from({ length: 60 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        value: 30 + Math.random() * 40,
      })).reverse(),
    },
    {
      id: 'packet-loss-1',
      name: 'Packet Loss',
      category: 'network',
      current: 0.5,
      threshold: 2,
      unit: '%',
      status: 'normal',
      history: Array.from({ length: 60 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        value: Math.random() * 1.5,
      })).reverse(),
    },
    {
      id: 'temp-1',
      name: 'CPU Temperature',
      category: 'sensor',
      current: 62,
      threshold: 85,
      unit: '°C',
      status: 'normal',
      history: Array.from({ length: 60 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        value: 55 + Math.random() * 15,
      })).reverse(),
    },
    {
      id: 'avail-1',
      name: 'Service Availability',
      category: 'availability',
      current: 99.95,
      threshold: 99.0,
      unit: '%',
      status: 'normal',
      history: Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        value: 99.5 + Math.random() * 0.5,
      })).reverse(),
    },
  ]);

  const [thresholds, setThresholds] = useState<Threshold[]>([
    { id: 'th-1', metric: 'CPU Usage', warning: 70, critical: 85, enabled: true },
    { id: 'th-2', metric: 'Memory Usage', warning: 80, critical: 90, enabled: true },
    { id: 'th-3', metric: 'Disk Usage', warning: 85, critical: 95, enabled: true },
    { id: 'th-4', metric: 'Latency', warning: 80, critical: 120, enabled: true },
  ]);

  const stats = {
    totalMetrics: metrics.length,
    normal: metrics.filter(m => m.status === 'normal').length,
    warning: metrics.filter(m => m.status === 'warning').length,
    critical: metrics.filter(m => m.status === 'critical').length,
    availability: (metrics.find(m => m.id === 'avail-1')?.current || 0).toFixed(2),
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'critical': return '#ef4444';
      default: return '#94a3b8';
    }
  };

  return (
    <div className="performance-metrics">
      <div className="metrics-header">
        <div className="header-content">
          <h1><UIIcon symbol="📊" /> Performance Metrics</h1>
          <p className="header-subtitle">Real-time monitoring of CPU, memory, disk, sensors, and availability</p>
        </div>
        <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className="time-select">
          <option value="1h">Last 1 Hour</option>
          <option value="6h">Last 6 Hours</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
        </select>
      </div>

      {/* Statistics */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon"><UIIcon symbol="📊" /></span>
          <div className="stat-content">
            <span className="stat-label">Total Metrics</span>
            <span className="stat-value">{stats.totalMetrics}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon"><UIIcon symbol="🟢" /></span>
          <div className="stat-content">
            <span className="stat-label">Normal</span>
            <span className="stat-value">{stats.normal}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon"><UIIcon symbol="🟡" /></span>
          <div className="stat-content">
            <span className="stat-label">Warning</span>
            <span className="stat-value">{stats.warning}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon"><UIIcon symbol="🔴" /></span>
          <div className="stat-content">
            <span className="stat-label">Critical</span>
            <span className="stat-value">{stats.critical}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon"><UIIcon symbol="✅" /></span>
          <div className="stat-content">
            <span className="stat-label">Availability</span>
            <span className="stat-value">{stats.availability}%</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="metrics-tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <UIIcon symbol="📈" /> Overview
        </button>
        <button
          className={`tab ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          <UIIcon symbol="📋" /> Details
        </button>
        <button
          className={`tab ${activeTab === 'thresholds' ? 'active' : ''}`}
          onClick={() => setActiveTab('thresholds')}
        >
          <UIIcon symbol="⚙️" /> Thresholds
        </button>
      </div>

      {/* Content */}
      <div className="metrics-content">
        {activeTab === 'overview' && (
          <div className="overview-section">
            <h3>Metrics Overview</h3>
            <div className="metrics-grid">
              {metrics.map(metric => (
                <div
                  key={metric.id}
                  className={`metric-card ${metric.status}`}
                  onClick={() => setSelectedMetric(metric.id)}
                >
                  <div className="metric-header">
                    <h4>{metric.name}</h4>
                    <span className={`status-dot ${metric.status}`}></span>
                  </div>
                  <div className="metric-value">
                    {metric.current}
                    <span className="unit">{metric.unit}</span>
                  </div>
                  <div className="metric-bar">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${Math.min((metric.current / metric.threshold) * 100, 100)}%`,
                        backgroundColor: getStatusColor(metric.status),
                      }}
                    ></div>
                  </div>
                  <div className="metric-threshold">
                    Threshold: {metric.threshold}{metric.unit}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'details' && (
          <div className="details-section">
            <h3>Detailed Metrics</h3>
            <div className="metrics-list">
              {metrics.map(metric => (
                <div key={metric.id} className={`metric-row ${metric.status}`}>
                  <div className="metric-name">
                    <span className={`status-badge ${metric.status}`}></span>
                    <div>
                      <h4>{metric.name}</h4>
                      <p>{metric.category.toUpperCase()}</p>
                    </div>
                  </div>
                  <div className="metric-current">
                    <span className="value">{metric.current}{metric.unit}</span>
                    <span className="label">Current</span>
                  </div>
                  <div className="metric-threshold">
                    <span className="value">{metric.threshold}{metric.unit}</span>
                    <span className="label">Threshold</span>
                  </div>
                  <div className="metric-usage">
                    <div className="usage-bar">
                      <div
                        className="usage-fill"
                        style={{
                          width: `${Math.min((metric.current / metric.threshold) * 100, 100)}%`,
                          backgroundColor: getStatusColor(metric.status),
                        }}
                      ></div>
                    </div>
                    <span className="percentage">
                      {Math.round((metric.current / metric.threshold) * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'thresholds' && (
          <div className="thresholds-section">
            <h3>Threshold Configuration</h3>
            <div className="thresholds-grid">
              {thresholds.map(threshold => (
                <div key={threshold.id} className="threshold-card">
                  <div className="threshold-header">
                    <h4>{threshold.metric}</h4>
                    <label className="toggle">
                      <input type="checkbox" defaultChecked={threshold.enabled} />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="threshold-controls">
                    <div className="control-group">
                      <label>Warning Threshold</label>
                      <div className="input-group">
                        <input type="number" defaultValue={threshold.warning} className="threshold-input" />
                        <span>%</span>
                      </div>
                    </div>
                    <div className="control-group">
                      <label>Critical Threshold</label>
                      <div className="input-group">
                        <input type="number" defaultValue={threshold.critical} className="threshold-input" />
                        <span>%</span>
                      </div>
                    </div>
                  </div>
                  <button className="btn-save">Save</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="metrics-footer">
        <span>Last updated: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
