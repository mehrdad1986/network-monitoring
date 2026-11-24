import { ReactNode } from 'react';
import { UIIcon } from './UIIcon';
import './NetworkSummary.css';

export type SummaryMetric = { label: string; value: string | number; icon: string; detail?: string };
export function NetworkSummary({ title, category, description, metrics, children, source = 'Sample data' }: { title: string; category: string; description: string; metrics: SummaryMetric[]; children?: ReactNode; source?: string }) {
  return <div className="network-summary">
    <header className="summary-page-header"><div><span className="summary-category">{category}</span><h1>{title}</h1><p>{description}</p></div><span className="summary-source"><UIIcon symbol="info" />{source}</span></header>
    <div className="summary-metric-grid">{metrics.map(metric => <section className="summary-metric-card" key={metric.label}><span className="summary-metric-icon"><UIIcon symbol={metric.icon} /></span><div><span className="summary-metric-label">{metric.label}</span><strong className="summary-metric-number">{metric.value}</strong>{metric.detail && <small>{metric.detail}</small>}</div></section>)}</div>
    {children}
  </div>;
}

export function SummaryDetails({ title, description, rows }: { title: string; description: string; rows: { label: string; value: string | number }[] }) {
  return <section className="summary-detail-card"><header><h2>{title}</h2><p>{description}</p></header><dl>{rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></section>;
}
