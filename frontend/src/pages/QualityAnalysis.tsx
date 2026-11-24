import { UIIcon } from '../components/UIIcon';
import { useState, useCallback, useEffect } from 'react';
import './QualityAnalysis.css';

interface QualityMetric {
  timestamp: string;
  jitter: number;
  packet_loss: number;
  latency: number;
  quality_score: number;
}

export const QualityAnalysis = () => {
  const [metrics, setMetrics] = useState<QualityMetric[]>([]);
  const [currentScore, setCurrentScore] = useState(95);
  const [isMonitoring] = useState(true);

  const generateQualityMetrics = useCallback(() => {
    const newMetrics: QualityMetric[] = [];
    const now = new Date();

    for (let i = 10; i > 0; i--) {
      const time = new Date(now.getTime() - i * 6000);
      const jitter = 2 + Math.random() * 8;
      const packetLoss = Math.random() * 0.5;
      const latency = 15 + Math.random() * 30;
      const qualityScore = 100 - (jitter * 2 + packetLoss * 100 + latency * 0.5);

      newMetrics.push({
        timestamp: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        jitter,
        packet_loss: packetLoss,
        latency,
        quality_score: Math.max(0, qualityScore),
      });
    }

    setMetrics(newMetrics);
    setCurrentScore(newMetrics[newMetrics.length - 1]?.quality_score || 95);
  }, []);

  useEffect(() => {
    generateQualityMetrics();
    const interval = setInterval(generateQualityMetrics, 30000);
    return () => clearInterval(interval);
  }, [generateQualityMetrics]);

  const getQualityColor = (score: number) => {
    if (score >= 90) return 'var(--success)';
    if (score >= 70) return '#3B82F6';
    if (score >= 50) return 'var(--warning)';
    return 'var(--danger)';
  };

  const getQualityLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Poor';
  };

  const avgJitter = metrics.reduce((sum, m) => sum + m.jitter, 0) / (metrics.length || 1);
  const avgPacketLoss = metrics.reduce((sum, m) => sum + m.packet_loss, 0) / (metrics.length || 1);
  const avgLatency = metrics.reduce((sum, m) => sum + m.latency, 0) / (metrics.length || 1);

  return (
    <div className="quality-analysis">
      <div className="page-header">
        <div>
          <h1>Quality Analysis</h1>
          <p className="page-description">Network quality metrics and analysis</p>
        </div>
        <button className="btn-refresh" onClick={generateQualityMetrics} disabled={!isMonitoring}>
          {isMonitoring ? <><UIIcon symbol="🔄" /> Analyzing...</> : <><UIIcon symbol="▶" /> Analyze</>}
        </button>
      </div>

      <div className="quality-score-card">
        <div className="score-circle" style={{ background: `conic-gradient(${getQualityColor(currentScore)} 0deg ${(currentScore / 100) * 360}deg, rgba(0,0,0,0.2) ${(currentScore / 100) * 360}deg)` }}>
          <div className="score-inner">
            <div className="score-value">{currentScore.toFixed(0)}</div>
            <div className="score-label">{getQualityLabel(currentScore)}</div>
          </div>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon"><UIIcon symbol="📊" /></div>
          <div className="metric-info">
            <div className="metric-label">Average Jitter</div>
            <div className="metric-value">{avgJitter.toFixed(2)} ms</div>
            <div className="metric-status" style={{ color: avgJitter < 5 ? 'var(--success)' : avgJitter < 10 ? 'var(--warning)' : 'var(--danger)' }}>
              {avgJitter < 5 ? <><UIIcon symbol="✅" /> Good</> : avgJitter < 10 ? <><UIIcon symbol="⚠️" /> Fair</> : <><UIIcon symbol="❌" /> Poor</>}
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon"><UIIcon symbol="📉" /></div>
          <div className="metric-info">
            <div className="metric-label">Packet Loss</div>
            <div className="metric-value">{(avgPacketLoss * 100).toFixed(2)}%</div>
            <div className="metric-status" style={{ color: avgPacketLoss < 0.1 ? 'var(--success)' : avgPacketLoss < 0.3 ? 'var(--warning)' : 'var(--danger)' }}>
              {avgPacketLoss < 0.1 ? <><UIIcon symbol="✅" /> Good</> : avgPacketLoss < 0.3 ? <><UIIcon symbol="⚠️" /> Fair</> : <><UIIcon symbol="❌" /> Poor</>}
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon"><UIIcon symbol="⏱️" /></div>
          <div className="metric-info">
            <div className="metric-label">Average Latency</div>
            <div className="metric-value">{avgLatency.toFixed(1)} ms</div>
            <div className="metric-status" style={{ color: avgLatency < 30 ? 'var(--success)' : avgLatency < 50 ? 'var(--warning)' : 'var(--danger)' }}>
              {avgLatency < 30 ? <><UIIcon symbol="✅" /> Good</> : avgLatency < 50 ? <><UIIcon symbol="⚠️" /> Fair</> : <><UIIcon symbol="❌" /> Poor</>}
            </div>
          </div>
        </div>
      </div>

      <section className="history-section">
        <h2>Quality Timeline</h2>
        <div className="timeline">
          {metrics.map((metric) => (
            <div key={metric.timestamp} className="timeline-item">
              <div className="timeline-time">{metric.timestamp}</div>
              <div className="timeline-bar">
                <div className="bar-fill" style={{ width: `${metric.quality_score}%`, backgroundColor: getQualityColor(metric.quality_score) }}></div>
              </div>
              <div className="timeline-score">{metric.quality_score.toFixed(0)}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
