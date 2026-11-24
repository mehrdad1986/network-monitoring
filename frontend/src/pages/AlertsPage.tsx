import { useState } from 'react';
import { NetworkSummary } from '../components/NetworkSummary';
import { UIIcon } from '../components/UIIcon';
const alerts=[{id:1,msg:'High latency detected',severity:'critical',time:'14:32'},{id:2,msg:'Interface eth1 down',severity:'warning',time:'14:28'},{id:3,msg:'Disk usage at 85%',severity:'warning',time:'14:15'}];
export const AlertsPage=()=>{
 const [filter,setFilter]=useState('all');
 const visible=alerts.filter(alert=>filter==='all'||alert.severity===filter);
 return <NetworkSummary title="Alerts" category="Incidents & Alerts" description="Review alerts by severity and keep the most urgent events in focus." metrics={[{label:'Total alerts',value:alerts.length,icon:'bell'},{label:'Critical',value:alerts.filter(a=>a.severity==='critical').length,icon:'warning'},{label:'Warning',value:alerts.filter(a=>a.severity==='warning').length,icon:'info'}]}><div className="summary-filter" role="group" aria-label="Filter alerts">{['all','critical','warning'].map(severity=><button type="button" key={severity} aria-pressed={filter===severity} onClick={()=>setFilter(severity)}>{severity==='all'?'All alerts':severity[0].toUpperCase()+severity.slice(1)}</button>)}</div><section className="summary-detail-card"><header><h2>Alert activity</h2><p>Existing sample alerts, grouped by severity.</p></header><div className="summary-table-wrap"><table><thead><tr><th>Alert</th><th>Severity</th><th>Time</th></tr></thead><tbody>{visible.map(alert=><tr key={alert.id}><td><UIIcon symbol="warning" /> {alert.msg}</td><td><span className="summary-inline-badge">{alert.severity}</span></td><td>{alert.time}</td></tr>)}</tbody></table></div></section></NetworkSummary>;
};
