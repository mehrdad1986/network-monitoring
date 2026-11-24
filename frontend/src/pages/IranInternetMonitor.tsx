import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { NetworkSummary, SummaryDetails } from '../components/NetworkSummary';
import './IranInternetMonitor.css';

type Service = { id: string; name: string; name_fa?: string; kind: string; status: string; latency_ms: number; http_status?: number; uptime24?: number };
type ServiceCategory = { name: string; name_fa?: string; services: Service[] };
type Operator = { org: string; ranges: number; ips: number; up: number; pct: number; median_ms: number };
type NetworksFeed = { ts: string; ranges_total: number; ranges_up: number; orgs: Operator[] };
type IranFeed = {
  ts: string;
  overall: string;
  counts: { up: number; degraded: number; down: number };
  categories: ServiceCategory[];
  networks?: NetworksFeed;
};
type RadarFeed = { ts?: string; traffic_24h_normalized?: unknown; confirmed_outages_7d?: unknown };
type Tab = 'services' | 'networks' | 'radar';

async function readFeed<T>(path: string): Promise<T> {
  const response = await fetch(`/iran-monitor-data/${path}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

const formatTime = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : 'Unknown';
const statusText = (status: string) => status.replace(/_/g, ' ');

export default function IranInternetMonitor() {
  const [feed, setFeed] = useState<IranFeed | null>(null);
  const [networks, setNetworks] = useState<NetworksFeed | null>(null);
  const [radar, setRadar] = useState<RadarFeed | null>(null);
  const [radarAvailable, setRadarAvailable] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('services');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const retry = useCallback(() => setRefreshKey(value => value + 1), []);

  useEffect(() => {
    let current = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [siteData, networkData] = await Promise.all([
          readFeed<IranFeed>('site.json'),
          readFeed<NetworksFeed>('networks.json'),
        ]);
        let radarData: RadarFeed | null = null;
        try { radarData = await readFeed<RadarFeed>('radar.json'); } catch { /* Radar is optional and unavailable in the current run. */ }
        if (current) {
          setFeed(siteData);
          setNetworks(networkData);
          setRadar(radarData);
          setRadarAvailable(Boolean(radarData));
        }
      } catch (reason) {
        if (current) setError(reason instanceof Error ? reason.message : 'Could not load Iran monitor data.');
      } finally {
        if (current) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => setRefreshKey(value => value + 1), 60_000);
    return () => { current = false; window.clearInterval(timer); };
  }, [refreshKey]);

  const categories = feed?.categories || [];
  const visibleCategories = useMemo(() => category === 'all' ? categories : categories.filter(item => item.name === category), [categories, category]);
  const metrics = [
    { label: 'Services reachable', value: loading ? '—' : feed?.counts.up ?? '—', icon: 'check' },
    { label: 'Degraded / down', value: loading ? '—' : `${feed?.counts.degraded ?? 0} / ${feed?.counts.down ?? 0}`, icon: 'warning' },
    { label: 'IP ranges reachable', value: loading ? '—' : `${networks?.ranges_up ?? 0} / ${networks?.ranges_total ?? 0}`, icon: 'globe' },
  ];

  return (
    <div className="iran-monitor-standalone" data-page="IranInternetMonitor">
    <header className="iran-monitor-standalone-header">
      <span>IRAN INTERNET OBSERVATORY</span>
      <Link to="/dashboard" aria-label="Back to dashboard" title="Back to dashboard">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5m7 7-7-7 7-7" /></svg>
      </Link>
    </header>
    <NetworkSummary
      title="Iran Internet Observatory"
      category="Regional Internet Monitoring"
      description="Iran-focused reachability checks, network operator range measurements, and optional Cloudflare Radar signals."
      metrics={metrics}
      source={loading ? 'Loading monitor data' : error ? 'Data unavailable' : `External vantage · Updated ${formatTime(feed?.ts)}`}
    >
      <div className="iran-monitor-vantage" role="note">Measurements originate from one monitoring vantage point outside Iran; they do not directly measure connectivity from inside Iran.</div>
      {error ? <section className="iran-monitor-state" role="alert"><h2>Iran monitor data unavailable</h2><p>{error}. The local feed must serve the bundled integrations/iran-internet-monitor/data files.</p><button type="button" onClick={retry}>Retry</button></section>
        : loading ? <p className="iran-monitor-loading" role="status">Loading live Iran monitor results…</p>
        : !feed ? <SummaryDetails title="No monitor data" description="The data feed is empty. Run the Iran monitor once and refresh this page." rows={[]} />
        : <>
          <nav className="iran-monitor-tabs" aria-label="Iran monitor data sections">
            {([['services', 'Service checks'], ['networks', 'Networks by operator'], ['radar', 'Cloudflare Radar']] as [Tab, string][]).map(([id, label]) => <button type="button" key={id} className={activeTab === id ? 'selected' : ''} aria-pressed={activeTab === id} onClick={() => setActiveTab(id)}>{label}</button>)}
          </nav>
          {activeTab === 'services' && <section className="iran-monitor-panel">
            <div className="iran-monitor-panel-heading"><div><h2>Iran-focused service checks</h2><p>ISP gateways, DNS resolvers, domestic and foreign services, circumvention tools, and observatories.</p></div><label>Category<select value={category} onChange={event => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map(item => <option value={item.name} key={item.name}>{item.name}</option>)}</select></label></div>
            {visibleCategories.map(item => <section className="iran-service-category" key={item.name}><h3>{item.name}</h3><div className="iran-table-scroll"><table className="iran-data-table"><thead><tr><th>Service</th><th>Check</th><th>Status</th><th>Latency</th><th>24 h uptime</th></tr></thead><tbody>{item.services.map(service => <tr key={service.id}><td>{service.name}</td><td>{service.kind}</td><td><span className={`iran-status ${service.status}`}>{statusText(service.status)}</span></td><td>{service.latency_ms > 0 ? `${service.latency_ms} ms` : '—'}</td><td>{typeof service.uptime24 === 'number' ? `${service.uptime24.toFixed(1)}%` : '—'}</td></tr>)}</tbody></table></div></section>)}
          </section>}
          {activeTab === 'networks' && <section className="iran-monitor-panel"><div className="iran-monitor-panel-heading"><div><h2>IP range sweep by network operator</h2><p>{networks?.ranges_up ?? 0} of {networks?.ranges_total ?? 0} labeled ranges reachable · collected {formatTime(networks?.ts)}</p></div></div>{networks?.orgs?.length ? <div className="iran-table-scroll"><table className="iran-data-table"><thead><tr><th>Network operator</th><th>Ranges</th><th>Reachable</th><th>Reachable share</th><th>Median latency</th></tr></thead><tbody>{networks.orgs.map(operator => <tr key={operator.org}><td>{operator.org}</td><td>{operator.ranges.toLocaleString()}</td><td>{operator.up.toLocaleString()}</td><td>{operator.pct.toFixed(1)}%</td><td>{operator.median_ms > 0 ? `${operator.median_ms} ms` : '—'}</td></tr>)}</tbody></table></div> : <p>No operator range measurements are available.</p>}</section>}
          {activeTab === 'radar' && <section className="iran-monitor-panel"><div className="iran-monitor-panel-heading"><div><h2>Cloudflare Radar · Iran</h2><p>Independent traffic and confirmed outage signals supplement the monitor's external probes.</p></div></div>{radarAvailable && radar ? <div className="iran-radar-grid"><SummaryDetails title="Normalized traffic · last 24 hours" description={`Feed timestamp: ${formatTime(radar.ts)}`} rows={[{ label: 'Radar data', value: JSON.stringify(radar.traffic_24h_normalized ?? 'Unavailable', null, 2) }]} /><SummaryDetails title="Confirmed outages · last 7 days" description="Outage annotations returned by Cloudflare Radar." rows={[{ label: 'Radar data', value: JSON.stringify(radar.confirmed_outages_7d ?? 'Unavailable', null, 2) }]} /></div> : <div className="iran-monitor-state"><h3>Cloudflare Radar is not configured</h3><p>The Iran monitor needs a Cloudflare API token with Radar read access to collect traffic and outage signals. Service checks and IP range measurements are available without it.</p></div>}</section>}
          <p className="iran-monitor-updated">Service feed updated {formatTime(feed.ts)} · Operator data updated {formatTime(networks?.ts)}</p>
        </>}
    </NetworkSummary>
    </div>
  );
}
