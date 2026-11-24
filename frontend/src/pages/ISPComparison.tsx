import { NetworkSummary } from '../components/NetworkSummary';
import { UIIcon } from '../components/UIIcon';
const isps = [
  { id: 1, name: 'ISP-A', latency: 18.5, throughput: 850, uptime: 99.98 },
  { id: 2, name: 'ISP-B', latency: 22.3, throughput: 920, uptime: 99.95 },
  { id: 3, name: 'ISP-C', latency: 35.2, throughput: 680, uptime: 99.87 },
];
export const ISPComparison = () => <NetworkSummary title="ISP Comparison" category="ISP & Connectivity" description="Compare provider response time, throughput and availability in one consistent view." metrics={[
  {label:'Providers',value:isps.length,icon:'globe'},
  {label:'Average latency',value:(isps.reduce((sum,p)=>sum+p.latency,0)/isps.length).toFixed(1)+' ms',icon:'time'},
  {label:'Highest throughput',value:Math.max(...isps.map(p=>p.throughput))+' Mbps',icon:'bolt'},
]}><div className="summary-provider-grid">{isps.map(isp=><section className="summary-provider-card" key={isp.id}><div className="summary-provider-header"><span className="summary-metric-icon"><UIIcon symbol="globe" /></span><h3>{isp.name}</h3><span className="summary-inline-badge">Provider {isp.id}</span></div><dl><div><dt>Latency</dt><dd>{isp.latency} ms</dd></div><div><dt>Throughput</dt><dd>{isp.throughput} Mbps</dd></div><div><dt>Availability</dt><dd>{isp.uptime}%</dd></div></dl></section>)}</div></NetworkSummary>;
