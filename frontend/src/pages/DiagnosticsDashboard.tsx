import { UIIcon } from '../components/UIIcon';
import React, { useState, useEffect } from 'react';
import './DiagnosticsDashboard.css';

interface PingResult {
  id: string;
  target: string;
  min_rtt_ms: number;
  max_rtt_ms: number;
  avg_rtt_ms: number;
  packet_loss_percent: number;
  jitter_ms: number;
  packets_sent: number;
  packets_received: number;
  timestamp: string;
}

interface TraceHop {
  hop_number: number;
  ip: string;
  asn: number;
  asn_name: string;
  country: string;
  city: string;
  min_rtt_ms: number;
  avg_rtt_ms: number;
  max_rtt_ms: number;
  jitter_ms: number;
  packet_loss_percent: number;
  hostname: string;
  response_time_ms: number;
}

interface HTTPMonitoring {
  id: string;
  url: string;
  method: string;
  protocol: string;
  status_code: number;
  connect_time_ms: number;
  dns_lookup_time_ms: number;
  first_byte_time_ms: number;
  total_time_ms: number;
  content_length: number;
  ssl_cert_info: string;
  status: string;
  timestamp: string;
}

interface SpeedTestResult {
  id: string;
  test_server: string;
  download_mbps: number;
  upload_mbps: number;
  ping_ms: number;
  jitter_ms: number;
  packet_loss_percent: number;
  timestamp: string;
}

interface VoIPMetrics {
  id: string;
  call_id: string;
  local_ip: string;
  remote_ip: string;
  codec: string;
  jitter_ms: number;
  mos: number;
  packet_loss_percent: number;
  rtt_ms: number;
  timestamp: string;
}

interface CapturedPacket {
  number: number;
  timestamp: number;
  source: string;
  destination: string;
  protocol: string;
  length: number;
  info: string;
  ttl: number;
  flags: string;
}

export default function DiagnosticsDashboard() {
  const [pingResults, setPingResults] = useState<PingResult[]>([]);
  const [traceRoute, setTraceRoute] = useState<{ hops: TraceHop[] } | null>(null);
  const [httpResults, setHttpResults] = useState<HTTPMonitoring[]>([]);
  const [speedTest, setSpeedTest] = useState<SpeedTestResult | null>(null);
  const [voipMetrics, setVoipMetrics] = useState<VoIPMetrics[]>([]);
  const [packets, setPackets] = useState<CapturedPacket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchDiagnosticsData();
    const interval = setInterval(fetchDiagnosticsData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchDiagnosticsData = async () => {
    try {
      const [ping, tr, http, speed, voip, pkts] = await Promise.all([
        fetch('/api/v1/tools/diagnostics/ping').then(r => r.json()),
        fetch('/api/v1/tools/diagnostics/traceroute').then(r => r.json()),
        fetch('/api/v1/tools/diagnostics/http-monitoring').then(r => r.json()),
        fetch('/api/v1/tools/diagnostics/speed-test').then(r => r.json()),
        fetch('/api/v1/tools/diagnostics/voip').then(r => r.json()),
        fetch('/api/v1/tools/diagnostics/captured-packets').then(r => r.json()),
      ]);

      setPingResults(ping.results || []);
      setTraceRoute(tr);
      setHttpResults(http.results || []);
      setSpeedTest(speed);
      setVoipMetrics(voip.metrics || []);
      setPackets(pkts.packets || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch diagnostics data:', error);
      setLoading(false);
    }
  };

  const getQualityColor = (value: number, type: string) => {
    switch (type) {
      case 'loss':
        return value < 1 ? '#10B981' : value < 5 ? '#F59E0B' : '#EF4444';
      case 'mos':
        return value >= 4 ? '#10B981' : value >= 3 ? '#F59E0B' : '#EF4444';
      case 'rtt':
        return value < 50 ? '#10B981' : value < 150 ? '#F59E0B' : '#EF4444';
      default:
        return '#3B82F6';
    }
  };

  if (loading) {
    return (
      <div className="diagnostics loading">
        <div className="loading-spinner">
          <div></div>
          <p>Running Network Diagnostics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="diagnostics">
      <div className="diag-header">
        <h1><UIIcon symbol="🔍" /> Network Diagnostics</h1>
        <p className="subtitle">Ping • Traceroute • DNS • HTTP/HTTPS • Speed Test • VoIP • Packet Capture</p>
      </div>

      <div className="tabs-container">
        {[
          'overview',
          'ping',
          'traceroute',
          'http',
          'speed',
          'voip',
          'packets',
        ].map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      <div className="diag-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="section">
            <h2>Diagnostics Overview</h2>
            <div className="overview-grid">
              {pingResults.length > 0 && (
                <div className="stat-card">
                  <div className="stat-icon"><UIIcon symbol="📡" /></div>
                  <div className="stat-info">
                    <p className="stat-label">Ping Status</p>
                    <p className="stat-value">{pingResults[0].avg_rtt_ms.toFixed(1)}ms</p>
                    <p className="stat-detail">
                      Loss: {pingResults[0].packet_loss_percent.toFixed(2)}%
                    </p>
                  </div>
                </div>
              )}

              {speedTest && (
                <div className="stat-card">
                  <div className="stat-icon"><UIIcon symbol="⚡" /></div>
                  <div className="stat-info">
                    <p className="stat-label">Speed Test</p>
                    <p className="stat-value">{speedTest.download_mbps.toFixed(1)}↓ Mbps</p>
                    <p className="stat-detail">
                      {speedTest.upload_mbps.toFixed(1)}↑ Mbps
                    </p>
                  </div>
                </div>
              )}

              {traceRoute && traceRoute.hops.length > 0 && (
                <div className="stat-card">
                  <div className="stat-icon"><UIIcon symbol="🛣️" /></div>
                  <div className="stat-info">
                    <p className="stat-label">Traceroute Hops</p>
                    <p className="stat-value">{traceRoute.hops.length}</p>
                    <p className="stat-detail">
                      {traceRoute.hops[traceRoute.hops.length - 1].country}
                    </p>
                  </div>
                </div>
              )}

              {voipMetrics.length > 0 && (
                <div className="stat-card">
                  <div className="stat-icon"><UIIcon symbol="☎️" /></div>
                  <div className="stat-info">
                    <p className="stat-label">VoIP Quality</p>
                    <p className="stat-value">{voipMetrics[0].mos.toFixed(1)}</p>
                    <p className="stat-detail">MOS Score</p>
                  </div>
                </div>
              )}

              {packets.length > 0 && (
                <div className="stat-card">
                  <div className="stat-icon"><UIIcon symbol="📦" /></div>
                  <div className="stat-info">
                    <p className="stat-label">Packets Captured</p>
                    <p className="stat-value">{packets.length}</p>
                    <p className="stat-detail">Packets in buffer</p>
                  </div>
                </div>
              )}

              {httpResults.length > 0 && (
                <div className="stat-card">
                  <div className="stat-icon"><UIIcon symbol="🌐" /></div>
                  <div className="stat-info">
                    <p className="stat-label">HTTP Status</p>
                    <p className="stat-value">{httpResults[0].status_code}</p>
                    <p className="stat-detail">
                      {httpResults[0].total_time_ms.toFixed(0)}ms total
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Ping Tab */}
        {activeTab === 'ping' && (
          <div className="section">
            <h2>ICMP Ping / RTT Monitoring</h2>
            <div className="ping-results">
              {pingResults.map((result) => (
                <div key={result.id} className="result-card">
                  <div className="result-header">
                    <h3>{result.target}</h3>
                    <span className="protocol-badge">ICMP</span>
                  </div>

                  <div className="metrics-grid">
                    <div className="metric">
                      <span className="metric-label">Min RTT</span>
                      <span className="metric-value">{result.min_rtt_ms.toFixed(2)}ms</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Avg RTT</span>
                      <span className="metric-value">{result.avg_rtt_ms.toFixed(2)}ms</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Max RTT</span>
                      <span className="metric-value">{result.max_rtt_ms.toFixed(2)}ms</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Jitter</span>
                      <span className="metric-value">{result.jitter_ms.toFixed(2)}ms</span>
                    </div>
                  </div>

                  <div className="loss-bar">
                    <div className="loss-label">
                      Packet Loss: <span style={{ color: getQualityColor(result.packet_loss_percent, 'loss') }}>
                        {result.packet_loss_percent.toFixed(3)}%
                      </span>
                    </div>
                    <div className="loss-progress">
                      <div
                        className="loss-fill"
                        style={{
                          width: `${Math.min(result.packet_loss_percent, 100)}%`,
                          backgroundColor: getQualityColor(result.packet_loss_percent, 'loss'),
                        }}
                      />
                    </div>
                  </div>

                  <div className="packet-stats">
                    <p>Packets: {result.packets_sent} sent, {result.packets_received} received</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Traceroute Tab */}
        {activeTab === 'traceroute' && traceRoute && (
          <div className="section">
            <h2>Traceroute Path Analysis</h2>
            <div className="traceroute-hops">
              {traceRoute.hops.map((hop) => (
                <div key={hop.hop_number} className="hop-card">
                  <div className="hop-number">{hop.hop_number}</div>
                  <div className="hop-details">
                    <div className="hop-ip">
                      <strong>{hop.ip}</strong>
                      {hop.hostname && <span className="hostname">{hop.hostname}</span>}
                    </div>
                    <div className="hop-location">
                      {hop.country && hop.city && `${hop.city}, ${hop.country}`}
                      {hop.asn && ` (AS${hop.asn} - ${hop.asn_name})`}
                    </div>
                  </div>
                  <div className="hop-metrics">
                    <div className="metric-item">
                      <span className="metric-label">RTT:</span>
                      <span className="metric-value">{hop.avg_rtt_ms.toFixed(2)}ms</span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-label">Loss:</span>
                      <span
                        className="metric-value"
                        style={{ color: getQualityColor(hop.packet_loss_percent, 'loss') }}
                      >
                        {hop.packet_loss_percent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-label">Jitter:</span>
                      <span className="metric-value">{hop.jitter_ms.toFixed(2)}ms</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HTTP Tab */}
        {activeTab === 'http' && (
          <div className="section">
            <h2>HTTP/HTTPS Monitoring</h2>
            <div className="http-results">
              {httpResults.map((result) => (
                <div key={result.id} className="http-card">
                  <div className="http-header">
                    <h3>{result.url}</h3>
                    <span
                      className={`status-code ${result.status_code < 400 ? 'success' : 'error'}`}
                    >
                      {result.status_code}
                    </span>
                  </div>

                  <div className="http-details">
                    <div className="detail">
                      <span className="label">Method:</span>
                      <span className="value">{result.method}</span>
                    </div>
                    <div className="detail">
                      <span className="label">Protocol:</span>
                      <span className="value">{result.protocol}</span>
                    </div>
                    <div className="detail">
                      <span className="label">SSL/TLS:</span>
                      <span className="value">{result.ssl_cert_info}</span>
                    </div>
                    <div className="detail">
                      <span className="label">Content Length:</span>
                      <span className="value">{(result.content_length / 1024).toFixed(2)} KB</span>
                    </div>
                  </div>

                  <div className="timing-breakdown">
                    <h4>Timing Breakdown</h4>
                    <div className="timing-bar">
                      <div className="timing-segment dns" style={{ width: `${(result.dns_lookup_time_ms / result.total_time_ms) * 100}%` }}>
                        <span className="timing-label">DNS</span>
                      </div>
                      <div className="timing-segment connect" style={{ width: `${(result.connect_time_ms / result.total_time_ms) * 100}%` }}>
                        <span className="timing-label">Connect</span>
                      </div>
                      <div className="timing-segment ttfb" style={{ width: `${(result.first_byte_time_ms / result.total_time_ms) * 100}%` }}>
                        <span className="timing-label">TTFB</span>
                      </div>
                    </div>
                    <div className="timing-stats">
                      <p>DNS: {result.dns_lookup_time_ms.toFixed(1)}ms | Connect: {result.connect_time_ms.toFixed(1)}ms | TTFB: {result.first_byte_time_ms.toFixed(1)}ms | Total: {result.total_time_ms.toFixed(1)}ms</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Speed Test Tab */}
        {activeTab === 'speed' && speedTest && (
          <div className="section">
            <h2>Internet Speed Test</h2>
            <div className="speed-card">
              <div className="speed-header">
                <h3>{speedTest.test_server}</h3>
              </div>

              <div className="speed-metrics">
                <div className="speed-metric download">
                  <div className="metric-icon"><UIIcon symbol="📥" /></div>
                  <div className="metric-content">
                    <p className="metric-label">Download</p>
                    <p className="metric-value">{speedTest.download_mbps.toFixed(2)}</p>
                    <p className="metric-unit">Mbps</p>
                  </div>
                </div>

                <div className="speed-metric upload">
                  <div className="metric-icon"><UIIcon symbol="📤" /></div>
                  <div className="metric-content">
                    <p className="metric-label">Upload</p>
                    <p className="metric-value">{speedTest.upload_mbps.toFixed(2)}</p>
                    <p className="metric-unit">Mbps</p>
                  </div>
                </div>

                <div className="speed-metric latency">
                  <div className="metric-icon"><UIIcon symbol="📡" /></div>
                  <div className="metric-content">
                    <p className="metric-label">Ping</p>
                    <p className="metric-value">{speedTest.ping_ms.toFixed(2)}</p>
                    <p className="metric-unit">ms</p>
                  </div>
                </div>
              </div>

              <div className="quality-indicators">
                <div className="indicator">
                  <p className="indicator-label">Jitter</p>
                  <p
                    className="indicator-value"
                    style={{
                      color: getQualityColor(speedTest.jitter_ms, 'rtt'),
                    }}
                  >
                    {speedTest.jitter_ms.toFixed(2)}ms
                  </p>
                </div>
                <div className="indicator">
                  <p className="indicator-label">Packet Loss</p>
                  <p
                    className="indicator-value"
                    style={{
                      color: getQualityColor(speedTest.packet_loss_percent, 'loss'),
                    }}
                  >
                    {speedTest.packet_loss_percent.toFixed(3)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VoIP Tab */}
        {activeTab === 'voip' && (
          <div className="section">
            <h2>VoIP Quality Metrics</h2>
            <div className="voip-results">
              {voipMetrics.map((metric) => (
                <div key={metric.id} className="voip-card">
                  <div className="voip-header">
                    <h3>Call: {metric.call_id}</h3>
                    <div className="mos-badge" style={{ backgroundColor: getQualityColor(metric.mos, 'mos') }}>
                      MOS {metric.mos.toFixed(1)}
                    </div>
                  </div>

                  <div className="voip-details">
                    <div className="detail-grid">
                      <div className="detail-item">
                        <span className="detail-label">Local IP</span>
                        <span className="detail-value">{metric.local_ip}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Remote IP</span>
                        <span className="detail-value">{metric.remote_ip}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Codec</span>
                        <span className="detail-value">{metric.codec}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">RTT</span>
                        <span className="detail-value" style={{ color: getQualityColor(metric.rtt_ms, 'rtt') }}>
                          {metric.rtt_ms.toFixed(1)}ms
                        </span>
                      </div>
                    </div>

                    <div className="voip-metrics">
                      <div className="metric-row">
                        <span className="metric-name">Jitter</span>
                        <div className="metric-bar">
                          <div className="metric-fill" style={{ width: `${Math.min((metric.jitter_ms / 50) * 100, 100)}%`, backgroundColor: getQualityColor(metric.jitter_ms, 'rtt') }} />
                        </div>
                        <span className="metric-value">{metric.jitter_ms.toFixed(2)}ms</span>
                      </div>
                      <div className="metric-row">
                        <span className="metric-name">Packet Loss</span>
                        <div className="metric-bar">
                          <div className="metric-fill" style={{ width: `${Math.min(metric.packet_loss_percent, 100)}%`, backgroundColor: getQualityColor(metric.packet_loss_percent, 'loss') }} />
                        </div>
                        <span className="metric-value">{metric.packet_loss_percent.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Packet Capture Tab */}
        {activeTab === 'packets' && (
          <div className="section">
            <h2>Packet Capture Analysis</h2>
            <div className="managed-table-scroll" role="region" aria-label="Captured packets table" tabIndex={0}>
            <table className="packets-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Time</th>
                  <th>Source</th>
                  <th>Destination</th>
                  <th>Protocol</th>
                  <th>Length</th>
                  <th>TTL</th>
                  <th>Flags</th>
                  <th>Info</th>
                </tr>
              </thead>
              <tbody>
                {packets.map((pkt) => (
                  <tr key={pkt.number}>
                    <td>{pkt.number}</td>
                    <td>{pkt.timestamp.toFixed(6)}</td>
                    <td className="ip-cell">{pkt.source}</td>
                    <td className="ip-cell">{pkt.destination}</td>
                    <td><strong>{pkt.protocol}</strong></td>
                    <td>{pkt.length}</td>
                    <td>{pkt.ttl}</td>
                    <td><span className="flags">{pkt.flags}</span></td>
                    <td>{pkt.info}</td>
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
