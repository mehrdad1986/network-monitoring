import { UIIcon } from '../components/UIIcon';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import apiService from '../services/api';
import type { Target } from '../types';
import './Dashboard.css';

type DashboardCard = {
  id: number;
  title: string;
  description: string;
  icon: string;
  path?: string;
  status: 'active' | 'coming-soon';
  gradient: string;
  metrics: Record<string, string | number>;
};

function isLocalFrontendTarget(target: Target): boolean {
  return target.name.trim().toLowerCase() === 'local frontend';
}

interface DashboardProps {
  onLogout: () => void;
}

export const Dashboard = ({ onLogout }: DashboardProps) => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [targets, setTargets] = useState<Target[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(true);
  const [targetsError, setTargetsError] = useState('');

  const loadTargets = async () => {
    try {
      const data = await apiService.getTargets();
      setTargets(data);
      setTargetsError('');
    } catch (error) {
      setTargetsError(error instanceof Error ? error.message : 'Could not load saved targets.');
    } finally {
      setTargetsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    void loadTargets();
    const refreshTargets = setInterval(() => { void loadTargets(); }, 30000);
    return () => { clearInterval(timer); clearInterval(refreshTargets); };
  }, []);

  const dashboardTargets = targets.filter(target => !isLocalFrontendTarget(target));
  const enabledTargets = dashboardTargets.filter(target => target.enabled);
  const attentionTargets = dashboardTargets.filter(target => target.status === 'down' || target.status === 'degraded');
  const measuredTargets = dashboardTargets.filter(target => target.status !== 'unknown');

  const cards: DashboardCard[] = [
    {
      id: 1,
      title: 'Network Monitoring',
      description: 'Real-time infrastructure monitoring and analytics',
      icon: '🌐',
      path: '/app/',
      status: 'active',
      gradient: 'from-cyan-500 to-blue-500',
      metrics: {
        'Saved targets': targetsLoading ? 'Loading…' : targetsError ? 'Unavailable' : dashboardTargets.length,
        'Enabled targets': targetsLoading || targetsError ? '—' : enabledTargets.length,
      }
    },
    {
      id: 2,
      title: 'Create VPN Subscription / Config',
      description: 'Choose OpenVPN, WireGuard or V2RayNG configuration',
      icon: '🔒',
      path: '/vpn',
      status: 'active',
      gradient: 'from-purple-500 to-pink-500',
      metrics: { protocols: 'OpenVPN · WireGuard · V2RayNG' }
    },
    {
      id: 3,
      title: 'DPI Tools',
      description: 'DPI applications, investigation runs and connection tools',
      icon: '🔍',
      path: '/app/dpi-tools/#applications',
      status: 'active',
      gradient: 'from-green-500 to-teal-500',
      metrics: { workspace: 'Applications · Runs · Connection' }
    },
    {
      id: 6,
      title: 'DNS Hunter',
      description: 'Compare domain answers across public DNS resolvers',
      icon: '🔎',
      path: '/app/dns-hunter',
      status: 'active',
      gradient: 'from-cyan-500 to-blue-500',
      metrics: { tool: 'DNS answer comparison' }
    },
    {
      id: 7,
      title: 'Edge IP Checker',
      description: 'Inspect IP addresses returned for a domain by public resolvers',
      icon: '🌐',
      path: '/app/edge-ip-checker',
      status: 'active',
      gradient: 'from-purple-500 to-pink-500',
      metrics: { tool: 'Resolver IP answers' }
    },
    {
      id: 8,
      title: 'CDN Xray Scanner',
      description: 'Test candidate CDN IPs through an Xray proxy configuration',
      icon: '🛰️',
      path: '/app/cdn-xray-scanner',
      status: 'active',
      gradient: 'from-cyan-500 to-blue-500',
      metrics: { tool: 'Xray proxy reachability' }
    },
    {
      id: 9,
      title: 'Akamai IP Scan',
      description: 'Check TCP port 443 reachability and response time for Akamai IPs',
      icon: '🌍',
      path: '/app/akamai-ip-scan',
      status: 'active',
      gradient: 'from-purple-500 to-pink-500',
      metrics: { tool: 'TCP port 443 check' }
    },
    {
      id: 10,
      title: 'NetMon Radar',
      description: 'Scan candidate edge addresses with live TCP and TLS verification',
      icon: '📡',
      path: '/app/netmon-radar',
      status: 'active',
      gradient: 'from-green-500 to-teal-500',
      metrics: { tool: 'Two-phase edge scan' }
    },
    {
      id: 4,
      title: 'Contact Us',
      description: 'Send a message to the NetMon team',
      icon: '✉️',
      path: '/contact',
      status: 'active',
      gradient: 'from-blue-500 to-indigo-500',
      metrics: { response: 'Write us a message' }
    }
  ];

  const handleCardClick = (card: DashboardCard) => {
    if (card.status === 'active' && card.path) {
      navigate(card.path);
    }
  };

  const getUser = () => {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : { username: 'User' };
    } catch {
      return { username: 'User' };
    }
  };

  const user = getUser();

  return (
    <div className="dashboard-container">
      <div className="dashboard-hero">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">
              Welcome back, <span className="dashboard-user-name">{user.username}</span>
            </h1>
            <p className="hero-subtitle">
              {currentTime.toLocaleString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })}
            </p>
          </div>
      <div className="hero-stats">
            <div className="stat-item">
            <div className="stat-icon"><UIIcon symbol={targetsError ? '🔴' : targetsLoading ? '⏳' : '🟢'} /></div>
              <div className="stat-content">
            <div className="stat-label">Target inventory</div>
            <div className="stat-value">{targetsLoading ? 'Loading' : targetsError ? 'Unavailable' : 'Connected'}</div>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon"><UIIcon symbol="📊" /></div>
              <div className="stat-content">
            <div className="stat-label">Saved targets</div>
            <div className="stat-value">{targetsLoading || targetsError ? '—' : dashboardTargets.length}</div>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon"><UIIcon symbol="⚡" /></div>
              <div className="stat-content">
            <div className="stat-label">Needs attention</div>
            <div className="stat-value">{targetsLoading || targetsError ? '—' : attentionTargets.length}</div>
              </div>
            </div>
          </div>
          <button type="button" className="dashboard-signout" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </div>

      <section className="dashboard-targets" aria-labelledby="dashboard-targets-title">
        <div className="dashboard-targets-heading">
          <div><h2 id="dashboard-targets-title">Network targets</h2>
            <p>{targetsError ? 'Saved target status could not be loaded.' : `${enabledTargets.length} enabled · ${measuredTargets.length} with a recorded status · ${dashboardTargets.length - measuredTargets.length} unknown`}</p></div>
          <div className="dashboard-target-actions">
            <button type="button" onClick={() => { setTargetsLoading(true); void loadTargets(); }} disabled={targetsLoading}>Refresh</button>
            <Link to="/app/targets">Manage targets</Link>
          </div>
        </div>
        {targetsError && <div className="dashboard-target-error" role="alert">{targetsError} <button type="button" onClick={() => { setTargetsLoading(true); void loadTargets(); }}>Retry</button></div>}
        {targetsLoading && dashboardTargets.length === 0 ? <p className="dashboard-target-empty" role="status">Loading saved targets…</p> : null}
        {!targetsLoading && !targetsError && dashboardTargets.length === 0 ? <div className="dashboard-target-empty"><p>No targets have been saved yet.</p><Link to="/app/targets">Add your first target</Link></div> : null}
        {dashboardTargets.length > 0 && <div className="dashboard-target-table-wrap"><table className="dashboard-target-table" aria-label="Saved network targets">
          <thead><tr><th>Target</th><th>Address</th><th>Enabled</th><th>Stored status</th><th>Last check</th></tr></thead>
          <tbody>{dashboardTargets.slice(0, 8).map(target => <tr key={target.id}>
            <td><Link to={`/app/targets/${target.id}`}>{target.name}</Link></td>
            <td><code>{target.address}{target.port ? `:${target.port}` : ''}</code></td>
            <td>{target.enabled ? 'Yes' : 'No'}</td>
            <td><span className={`dashboard-target-status ${target.status}`}>{target.status === 'unknown' ? 'Unknown · no measurement' : target.status}</span></td>
            <td>{target.last_check ? new Date(target.last_check).toLocaleString() : 'Never'}</td>
          </tr>)}</tbody>
        </table>{dashboardTargets.length > 8 && <p className="dashboard-target-more">Showing 8 of {dashboardTargets.length}. <Link to="/app/targets">View all targets</Link></p>}</div>}
      </section>

      <div className="dashboard-section">
        <div className="dashboard-grid">
          {cards.map((card, index) => (
            <button
              key={card.id}
              type="button"
              className={`dashboard-card ${card.status}`}
              onClick={() => handleCardClick(card)}
              disabled={card.status === 'coming-soon'}
              style={{
                animationDelay: `${index * 0.05}s`
              }}
            >
              <div className="dashboard-card-header">
                <div className="dashboard-card-icon">{<UIIcon symbol={card.icon} />}</div>
                {card.status === 'active' && (
                  <div className="status-indicator active"></div>
                )}
                {card.status === 'coming-soon' && (
                  <span className="status-badge">Coming soon</span>
                )}
              </div>

              <div className="dashboard-card-content">
                <h3 className="dashboard-card-title">{card.title}</h3>
                <p className="dashboard-card-description">{card.description}</p>
              </div>

              <div className="dashboard-card-metrics">
                {Object.entries(card.metrics).map(([key, value]) => (
                  <div key={key} className="dashboard-metric">
                    <span className="dashboard-metric-label">{key}:</span>
                    <span className="dashboard-metric-value">{value}</span>
                  </div>
                ))}
              </div>

              <div className={`dashboard-card-gradient ${card.gradient}`}></div>

              {card.status === 'active' && (
                <div className="dashboard-card-arrow">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M7 4L13 10L7 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="dashboard-footer">
        <p>NetMon Comprehensive Network Monitoring Application</p>
      </div>
    </div>
  );
};
