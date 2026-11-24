import { useState } from 'react';
import { NetworkSummary } from '../components/NetworkSummary';
import { useBackendList } from '../hooks/useBackendList';
type Activity = { id: string; time: string; category: string; action: string };
const isActivity = (value: unknown): value is Activity => {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<Activity>;
  return [event.id, event.time, event.category, event.action].every(field => typeof field === 'string') && Number.isFinite(Date.parse(event.time || ''));
};
export function AuditLogs() {
  const { items, error, loading, reload } = useBackendList<Activity>('/api/v1/activity', 'events', isActivity);
  const [category, setCategory] = useState('all');
  const events = items || [];
  const visible = events.filter(event => category === 'all' || event.category === category);
  return <NetworkSummary title="Audit Logs" category="System" source="Local backend" description="Actual local API startup and saved target-creation records. This view covers the current API session and the latest 100 inventory records." metrics={[
    { label: 'Activity records', value: items ? events.length : '—', icon: 'list' }, { label: 'Target records', value: items ? events.filter(event => event.category === 'targets').length : '—', icon: 'target' }, { label: 'Runtime events', value: items ? events.filter(event => event.category === 'runtime').length : '—', icon: 'monitor' },
  ]}><div className="summary-filter" role="group" aria-label="Filter audit activity">{[['all', 'All activity'], ['targets', 'Targets'], ['runtime', 'Runtime']].map(([value, label]) => <button type="button" key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{label}</button>)}<button type="button" onClick={reload} disabled={loading}>Refresh</button></div>{error && <div className="summary-detail-card" role="alert"><h2>Activity service unavailable</h2><p>{error}</p><button type="button" className="btn-secondary" onClick={reload}>Retry connection</button></div>}{loading && !items && <p role="status">Loading activity…</p>}<section className="summary-detail-card"><header><h2>Recorded activity</h2><p>Target names, addresses and credentials are excluded from this report.</p></header><div className="summary-table-wrap"><table><thead><tr><th>Time</th><th>Category</th><th>Activity</th></tr></thead><tbody>{visible.map(event => <tr key={event.id}><td>{new Date(event.time).toLocaleString()}</td><td>{event.category}</td><td>{event.action}</td></tr>)}</tbody></table></div>{items && !visible.length && <p>No activity is recorded for this filter.</p>}</section></NetworkSummary>;
}
