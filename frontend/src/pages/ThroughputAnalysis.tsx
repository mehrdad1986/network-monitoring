import { UIIcon } from '../components/UIIcon';
import { useEffect, useState, useCallback } from 'react';
import './ThroughputAnalysis.css';

interface ThroughputMetric {
  id: string;
  timestamp: string;
  download: number;
  upload: number;
  bandwidth: number;
}

interface ThroughputStats {
  current_download: number;
  current_upload: number;
  avg_download: number;
  avg_upload: number;
  peak_download: number;
  peak_upload: number;
  total_data: number;
}

export const ThroughputAnalysis = () => {
  const [metrics, setMetrics] = useState<ThroughputMetric[]>([]);
  const [stats, setStats] = useState<ThroughputStats>({
    current_download: 0,
    current_upload: 0,
    avg_download: 0,
    avg_upload: 0,
    peak_download: 0,
    peak_upload: 0,
    total_data: 0,
  });
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [timeRange, setTimeRange] = useState<'5m' | '1h' | '24h'>('5m');

  const generateThroughputData = useCallback(() => {
    const newMetrics: ThroughputMetric[] = [];
    const now = new Date();

    // Generate data based on time range
    let dataPoints = 5;
    let interval = 1;
    if (timeRange === '1h') {
      dataPoints = 12;
      interval = 5;
    } else if (timeRange === '24h') {
      dataPoints = 24;
      interval = 60;
    }

    for (let i = dataPoints; i > 0; i--) {
      const time = new Date(now.getTime() - i * interval * 60000);
      const download = 50 + Math.random() * 150;
      const upload = 20 + Math.random() * 80;
      const bandwidth = download + upload;

      newMetrics.push({
        id: `metric-${i}`,
        timestamp: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        download,
        upload,
        bandwidth,
      });
    }

    setMetrics(newMetrics);

    // Calculate stats
    const avgDownload = newMetrics.reduce((sum, m) => sum + m.download, 0) / newMetrics.length;
    const avgUpload = newMetrics.reduce((sum, m) => sum + m.upload, 0) / newMetrics.length;
    const peakDownload = Math.max(...newMetrics.map(m => m.download));
    const peakUpload = Math.max(...newMetrics.map(m => m.upload));
    const totalData = newMetrics.reduce((sum, m) => sum + m.bandwidth, 0);

    setStats({
      current_download: newMetrics[newMetrics.length - 1]?.download || 0,
      current_upload: newMetrics[newMetrics.length - 1]?.upload || 0,
      avg_download: avgDownload,
      avg_upload: avgUpload,
      peak_download: peakDownload,
      peak_upload: peakUpload,
      total_data: totalData,
    });
  }, [timeRange]);

  useEffect(() => {
    generateThroughputData();
    const interval = setInterval(generateThroughputData, 30000);
    return () => clearInterval(interval);
  }, [generateThroughputData]);

  const startMonitoring = () => {
    setIsMonitoring(true);
    generateThroughputData();
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
  };

  const getMaxBandwidth = () => {
    return Math.max(...metrics.map(m => m.bandwidth), 100);
  };

  return (
    <div className="throughput-analysis">
      <div className="page-header">
        <div>
          <h1>Throughput Analysis</h1>
          <p className="page-description">Monitor network bandwidth utilization</p>
        </div>
        <div className="header-controls">
          <select className="time-range-select" value={timeRange} onChange={(e) => setTimeRange(e.target.value as any)}>
            <option value="5m">Last 5 Minutes</option>
            <option value="1h">Last 1 Hour</option>
            <option value="24h">Last 24 Hours</option>
          </select>
          {isMonitoring ? (
            <button className="btn-stop" onClick={stopMonitoring}><UIIcon symbol="⏹" /> Stop Monitoring</button>
          ) : (
            <button className="btn-monitor" onClick={startMonitoring}><UIIcon symbol="▶" /> Start Monitoring</button>
          )}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon"><UIIcon symbol="⬇️" /></div>
          <div className="stat-info">
            <div className="stat-label">Download Speed</div>
            <div className="stat-value">{stats.current_download.toFixed(1)} Mbps</div>
            <div className="stat-sub">Avg: {stats.avg_download.toFixed(1)} Mbps</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><UIIcon symbol="⬆️" /></div>
          <div className="stat-info">
            <div className="stat-label">Upload Speed</div>
            <div className="stat-value">{stats.current_upload.toFixed(1)} Mbps</div>
            <div className="stat-sub">Avg: {stats.avg_upload.toFixed(1)} Mbps</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><UIIcon symbol="📊" /></div>
          <div className="stat-info">
            <div className="stat-label">Total Throughput</div>
            <div className="stat-value">{(stats.current_download + stats.current_upload).toFixed(1)} Mbps</div>
            <div className="stat-sub">Peak: {stats.peak_download.toFixed(1)} Mbps</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><UIIcon symbol="💾" /></div>
          <div className="stat-info">
            <div className="stat-label">Data Transferred</div>
            <div className="stat-value">{(stats.total_data / 1024).toFixed(2)} GB</div>
            <div className="stat-sub">In period</div>
          </div>
        </div>
      </div>

      <section className="chart-section">
        <h2>Throughput Timeline</h2>
        <div className="chart-container">
          <div className="y-axis">
            <div className="y-label">{getMaxBandwidth().toFixed(0)}</div>
            <div className="y-label">{(getMaxBandwidth() * 0.75).toFixed(0)}</div>
            <div className="y-label">{(getMaxBandwidth() * 0.5).toFixed(0)}</div>
            <div className="y-label">{(getMaxBandwidth() * 0.25).toFixed(0)}</div>
            <div className="y-label">0</div>
          </div>
          <div className="chart">
            {metrics.map((metric, index) => (
              <div key={metric.id} className="chart-bar-container">
                <div className="chart-bar">
                  <div
                    className="bar-segment download"
                    style={{
                      height: `${(metric.download / getMaxBandwidth()) * 100}%`,
                    }}
                    title={`${metric.download.toFixed(1)} Mbps`}
                  ></div>
                  <div
                    className="bar-segment upload"
                    style={{
                      height: `${(metric.upload / getMaxBandwidth()) * 100}%`,
                    }}
                    title={`${metric.upload.toFixed(1)} Mbps`}
                  ></div>
                </div>
                {index % Math.ceil(metrics.length / 5) === 0 && (
                  <div className="chart-label">{metric.timestamp}</div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="chart-legend">
          <div className="legend-item">
            <div className="legend-color download"></div>
            <span>Download</span>
          </div>
          <div className="legend-item">
            <div className="legend-color upload"></div>
            <span>Upload</span>
          </div>
        </div>
      </section>

      <section className="details-section">
        <h2>Throughput Details</h2>
        <div className="details-grid">
          <div className="detail-card">
            <div className="detail-label">Peak Download</div>
            <div className="detail-value">{stats.peak_download.toFixed(2)} Mbps</div>
          </div>
          <div className="detail-card">
            <div className="detail-label">Peak Upload</div>
            <div className="detail-value">{stats.peak_upload.toFixed(2)} Mbps</div>
          </div>
          <div className="detail-card">
            <div className="detail-label">Average Download</div>
            <div className="detail-value">{stats.avg_download.toFixed(2)} Mbps</div>
          </div>
          <div className="detail-card">
            <div className="detail-label">Average Upload</div>
            <div className="detail-value">{stats.avg_upload.toFixed(2)} Mbps</div>
          </div>
        </div>
      </section>
    </div>
  );
};
