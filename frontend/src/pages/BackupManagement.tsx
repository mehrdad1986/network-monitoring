import { Link } from 'react-router-dom';
import { NetworkSummary } from '../components/NetworkSummary';
import { UIIcon } from '../components/UIIcon';
import { useBackendList } from '../hooks/useBackendList';
type RouterTarget = { id: string; name: string; address: string; target_type: string };
const isTarget = (value: unknown): value is RouterTarget => {
  if (!value || typeof value !== 'object') return false;
  const target = value as Partial<RouterTarget>;
  return [target.id, target.name, target.address, target.target_type].every(field => typeof field === 'string');
};
export function BackupManagement() {
  const { items, error, loading, reload } = useBackendList<RouterTarget>('/api/v1/targets', '', isTarget);
  const routers = (items || []).filter(target => target.target_type === 'router');
  return <NetworkSummary title="MikroTik Backup" category="System" source="Router setup" description="Review router targets and prepare a backup connection. Backup collection requires a configured RouterOS device and a backup agent." metrics={[
    { label: 'Saved router targets', value: items ? routers.length : '—', icon: 'server' }, { label: 'Backup integration', value: 'Setup required', icon: 'settings' },
  ]}>{error && <section className="summary-detail-card" role="alert"><h2>Router inventory unavailable</h2><p>{error}</p><button type="button" className="btn-secondary" onClick={reload}>Retry connection</button></section>}{loading && !items && <p role="status">Loading router targets…</p>}{items && <section className="summary-detail-card"><header><h2>{routers.length ? 'Router targets' : 'Add your first router'}</h2><p>{routers.length ? 'These are actual saved targets. Backup collection is not configured for them yet.' : 'Create a target with type Router, then configure its backup integration.'}</p></header>{routers.map(router => <dl key={router.id}><div><dt>{router.name}</dt><dd>{router.address}</dd></div></dl>)}<Link className="btn-primary summary-setup-link" to="/app/targets"><UIIcon symbol="plus" />Manage router targets</Link></section>}</NetworkSummary>;
}
