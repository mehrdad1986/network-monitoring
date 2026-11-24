import { UIIcon } from '../components/UIIcon';
import { useEffect, useState, useCallback } from 'react';
import './SLAMonitoring.css';

interface SLAService {
  id: string;
  name: string;
  description: string;
  uptime: number;
  target: number;
  incidents: number;
}

export const SLAMonitoring = () => {
  const defaultServices: SLAService[] = [
    { id: '1', name: 'Primary DNS', description: 'Main DNS service', uptime: 99.98, target: 99.9, incidents: 0 },
    { id: '2', name: 'API Gateway', description: 'REST API endpoint', uptime: 99.95, target: 99.95, incidents: 1 },
    { id: '3', name: 'Database', description: 'Primary database', uptime: 99.99, target: 99.99, incidents: 0 },
    { id: '4', name: 'CDN', description: 'Content delivery', uptime: 99.97, target: 99.9, incidents: 0 },
    { id: '5', name: 'Load Balancer', description: 'Traffic distribution', uptime: 99.99, target: 99.99, incidents: 0 },
  ];

  const [services, setServices] = useState<SLAService[]>(defaultServices);

  useEffect(() => {
    const interval = setInterval(() => {
      setServices(prev => prev.map(s => ({
        ...s,
        uptime: Math.max(99.5, s.uptime - (Math.random() * 0.01)),
      })));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const getSLAStatus = (uptime: number, target: number) => {
    if (uptime >= target) return 'met';
    if (uptime >= target - 0.1) return 'warning';
    return 'breach';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'met':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'breach':
        return '❌';
      default:
        return '❓';
    }
  };

  const avgUptime = services.reduce((sum, s) => sum + s.uptime, 0) / services.length;
  const totalIncidents = services.reduce((sum, s) => sum + s.incidents, 0);
  const metCount = services.filter(s => getSLAStatus(s.uptime, s.target) === 'met').length;

  return (
    <div className="sla-monitoring">
      <div className="page-header">
        <div>
          <h1>SLA Monitoring</h1>
          <p className="page-description">Track service level agreements and uptime</p>
        </div>
      </div>

      <div className="sla-summary">
        <div className="summary-card">
          <div className="summary-value">{avgUptime.toFixed(2)}%</div>
          <div className="summary-label">Average Uptime</div>
        </div>
        <div className="summary-card">
          <div className="summary-value"><UIIcon symbol="✅" /> {metCount}</div>
          <div className="summary-label">SLAs Met</div>
        </div>
        <div className="summary-card">
          <div className="summary-value"><UIIcon symbol="⚠️" /> {services.length - metCount}</div>
          <div className="summary-label">At Risk</div>
        </div>
        <div className="summary-card">
          <div className="summary-value">{totalIncidents}</div>
          <div className="summary-label">Total Incidents</div>
        </div>
      </div>

      <section className="services-section">
        <h2>Service Status</h2>
        <div className="services-grid">
          {services.map(service => {
            const status = getSLAStatus(service.uptime, service.target);
            const statusColor = status === 'met' ? '#10B981' : status === 'warning' ? '#F59E0B' : '#EF4444';
            return (
              <div key={service.id} className={`service-card ${status}`} style={{ borderLeftColor: statusColor }}>
                <div className="card-header">
                  <h3>{service.name}</h3>
                  <span className="status-badge" style={{ backgroundColor: statusColor }}>
                    {<UIIcon symbol={getStatusIcon(status)} />}
                  </span>
                </div>
                <p className="service-description">{service.description}</p>
                <div className="uptime-display">
                  <div className="uptime-value">{service.uptime.toFixed(2)}%</div>
                  <div className="uptime-bar">
                    <div className="bar-fill" style={{ width: `${service.uptime}%`, backgroundColor: statusColor }}></div>
                  </div>
                  <div className="uptime-target">Target: {service.target}%</div>
                </div>
                <div className="card-footer">
                  <span className="incident-count">Incidents: {service.incidents}</span>
                  <span className={`status-text ${status}`}>
                    {status === 'met' ? 'SLA Met' : status === 'warning' ? 'At Risk' : 'SLA Breach'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
