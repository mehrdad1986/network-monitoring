import { UIIcon } from '../components/UIIcon';
import { useState, useCallback } from 'react';
import './PacketCapture.css';

interface CaptureFilter {
  protocol: 'tcp' | 'udp' | 'icmp' | 'all';
  port?: number;
  count: number;
}

interface CapturePacket {
  id: number;
  timestamp: string;
  protocol: string;
  source: string;
  destination: string;
  length: number;
  info: string;
}

export const PacketCapture = () => {
  const [packets, setPackets] = useState<CapturePacket[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [filter, setFilter] = useState<CaptureFilter>({
    protocol: 'all',
    count: 50,
  });
  const [captureStats, setCaptureStats] = useState({
    total: 0,
    tcp: 0,
    udp: 0,
    icmp: 0,
    other: 0,
    avgSize: 0,
  });
  const [displayCount, setDisplayCount] = useState(20);

  const startCapture = useCallback(async () => {
    setIsCapturing(true);
    setPackets([]);

    try {
      const response = await fetch('http://localhost:8080/api/v1/tools/packet-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocol: filter.protocol,
          port: filter.port,
          count: filter.count,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setPackets(data.packets || []);

        const stats = {
          total: data.packets?.length || 0,
          tcp: data.packets?.filter((p: CapturePacket) => p.protocol === 'TCP').length || 0,
          udp: data.packets?.filter((p: CapturePacket) => p.protocol === 'UDP').length || 0,
          icmp: data.packets?.filter((p: CapturePacket) => p.protocol === 'ICMP').length || 0,
          other: 0,
          avgSize: data.avg_size || 0,
        };
        stats.other = stats.total - stats.tcp - stats.udp - stats.icmp;
        setCaptureStats(stats);
      }
    } catch (error) {
      console.error('Capture error:', error);
    } finally {
      setIsCapturing(false);
    }
  }, [filter]);

  const stopCapture = useCallback(() => {
    setIsCapturing(false);
  }, []);

  const getProtocolColor = (protocol: string) => {
    switch (protocol) {
      case 'TCP':
        return '#3B82F6';
      case 'UDP':
        return '#10B981';
      case 'ICMP':
        return '#F59E0B';
      default:
        return '#8B5CF6';
    }
  };

  const getProtocolIcon = (protocol: string) => {
    switch (protocol) {
      case 'TCP':
        return '🔴';
      case 'UDP':
        return '🟢';
      case 'ICMP':
        return '🟡';
      default:
        return '⚪';
    }
  };

  const filteredPackets = packets.slice(0, displayCount);
  const totalSize = packets.reduce((sum, p) => sum + p.length, 0);

  return (
    <div className="packet-capture">
      <div className="page-header">
        <div>
          <h1>Packet Capture</h1>
          <p className="page-description">Live packet capture and analysis</p>
        </div>
        {isCapturing ? (
          <button className="btn-stop" onClick={stopCapture}><UIIcon symbol="⏹" /> Stop Capture</button>
        ) : (
          <button className="btn-capture" onClick={startCapture}><UIIcon symbol="▶" /> Start Capture</button>
        )}
      </div>

      <section className="capture-controls">
        <h2>Capture Settings</h2>
        <div className="controls-grid">
          <div className="control-group">
            <label>Protocol:</label>
            <select value={filter.protocol} onChange={(e) => setFilter({ ...filter, protocol: e.target.value as any })}>
              <option value="all">All Protocols</option>
              <option value="tcp">TCP Only</option>
              <option value="udp">UDP Only</option>
              <option value="icmp">ICMP Only</option>
            </select>
          </div>
          <div className="control-group">
            <label>Port (optional):</label>
            <input type="number" placeholder="Leave empty for all" value={filter.port || ''} onChange={(e) => setFilter({ ...filter, port: e.target.value ? parseInt(e.target.value) : undefined })} min="1" max="65535" />
          </div>
          <div className="control-group">
            <label>Packet Count:</label>
            <input type="number" value={filter.count} onChange={(e) => setFilter({ ...filter, count: parseInt(e.target.value) })} min="10" max="1000" />
          </div>
        </div>
      </section>

      <div className="stats-summary">
        <div className="stat-card">
          <div className="stat-value">{captureStats.total}</div>
          <div className="stat-label">Total Packets</div>
        </div>
        <div className="stat-card">
          <div className="stat-value tcp">{captureStats.tcp}</div>
          <div className="stat-label">TCP</div>
        </div>
        <div className="stat-card">
          <div className="stat-value udp">{captureStats.udp}</div>
          <div className="stat-label">UDP</div>
        </div>
        <div className="stat-card">
          <div className="stat-value icmp">{captureStats.icmp}</div>
          <div className="stat-label">ICMP</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{(totalSize / 1024).toFixed(2)} KB</div>
          <div className="stat-label">Total Size</div>
        </div>
      </div>

      <section className="packets-section">
        <div className="section-header">
          <h2>Captured Packets ({packets.length})</h2>
          {packets.length > displayCount && (
            <button className="btn-load-more" onClick={() => setDisplayCount(displayCount + 20)}>Load More</button>
          )}
        </div>

        {packets.length === 0 ? (
          <div className="empty-state">
            <p>No packets captured yet. Click "Start Capture" to begin.</p>
          </div>
        ) : (
          <div className="packets-table">
            <div className="table-header">
              <div className="col col-id">#</div>
              <div className="col col-time">Time</div>
              <div className="col col-protocol">Protocol</div>
              <div className="col col-source">Source</div>
              <div className="col col-dest">Destination</div>
              <div className="col col-length">Length</div>
              <div className="col col-info">Info</div>
            </div>
            <div className="table-body">
              {filteredPackets.map((packet) => (
                <div key={packet.id} className="table-row">
                  <div className="col col-id">{packet.id}</div>
                  <div className="col col-time">{packet.timestamp}</div>
                  <div className="col col-protocol">
                    <span className="protocol-badge" style={{ backgroundColor: getProtocolColor(packet.protocol) }}>
                      {getProtocolIcon(packet.protocol)} {packet.protocol}
                    </span>
                  </div>
                  <div className="col col-source">
                    <code>{packet.source}</code>
                  </div>
                  <div className="col col-dest">
                    <code>{packet.destination}</code>
                  </div>
                  <div className="col col-length">{packet.length} B</div>
                  <div className="col col-info">{packet.info}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
