import { useState } from 'react';
import { NetworkSummary } from '../components/NetworkSummary';
import { UIIcon } from '../components/UIIcon';
import { useBackendList } from '../hooks/useBackendList';
type Tool = { name: string; binary: string; category: string; description: string; installed: boolean };
const isTool = (value: unknown): value is Tool => {
  if (!value || typeof value !== 'object') return false;
  const tool = value as Partial<Tool>;
  return [tool.name, tool.binary, tool.category, tool.description].every(field => typeof field === 'string') && typeof tool.installed === 'boolean';
};
export function ToolManagement() {
  const { items, error, loading, reload } = useBackendList<Tool>('/api/v1/tools/catalog', 'tools', isTool);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const tools = items || [];
  const visible = tools.filter(tool => `${tool.name} ${tool.category} ${tool.description}`.toLowerCase().includes(search.toLowerCase()) && (filter === 'all' || tool.installed === (filter === 'installed')));
  return <NetworkSummary title="Tool Management" category="System" source="Local backend" description="Discover which diagnostic tools are actually available on the backend host. Availability checks do not execute or install tools." metrics={[
    { label: 'Registered tools', value: items ? tools.length : '—', icon: 'settings' }, { label: 'Installed', value: items ? tools.filter(tool => tool.installed).length : '—', icon: 'check' }, { label: 'Not installed', value: items ? tools.filter(tool => !tool.installed).length : '—', icon: 'info' },
  ]}>
    <div className="summary-filter"><input aria-label="Search diagnostic tools" placeholder="Search tools or categories" value={search} onChange={event => setSearch(event.target.value)} />{['all', 'installed', 'missing'].map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? 'All tools' : value === 'installed' ? 'Installed' : 'Not installed'}</button>)}<button type="button" onClick={reload} disabled={loading}><UIIcon symbol="refresh" />Refresh</button></div>
    {error && <div className="summary-detail-card" role="alert"><h2>Tool inventory unavailable</h2><p>{error}</p><button type="button" className="btn-secondary" onClick={reload}>Retry connection</button></div>}
    {loading && !items && <p role="status">Checking tool availability…</p>}
    <div className="summary-provider-grid">{visible.map(tool => <section className="summary-provider-card" key={tool.name}><div className="summary-provider-header"><span className="summary-metric-icon"><UIIcon symbol="settings" /></span><h3>{tool.name}</h3><span className="summary-inline-badge">{tool.installed ? 'Installed' : 'Not installed'}</span></div><p>{tool.description}</p><dl><div><dt>Category</dt><dd>{String(tool.category).replace(/_/g, ' ')}</dd></div><div><dt>Command</dt><dd><code>{tool.binary}</code></dd></div></dl></section>)}</div>
    {items && !visible.length && <div className="summary-detail-card"><h2>No tools match this filter</h2><p>Try another search or choose All tools.</p></div>}
  </NetworkSummary>;
}
