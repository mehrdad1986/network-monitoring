import { useCallback, useEffect, useMemo, useState } from 'react';
import { NetworkSummary, SummaryDetails } from '../components/NetworkSummary';
import { UIIcon } from '../components/UIIcon';
import apiService from '../services/api';
import { getSavedAnalyticsReports, removeSavedAnalyticsReport, saveAnalyticsReport, SavedAnalyticsReport } from '../services/savedAnalyticsReports';
import type { Measurement } from '../types';
import './AnalyticsMonitoring.css';

export const AlertRules = () => <NetworkSummary title="Alert Rules" category="Incidents & Alerts" description="Review configured rules and their current enabled state." metrics={[
  {label:'Configured rules',value:15,icon:'list'},{label:'Enabled',value:14,icon:'check'},{label:'Disabled',value:1,icon:'pause'},
]}><SummaryDetails title="Rule activity" description="Summary of the existing sample alert policy." rows={[{label:'Triggered today',value:'2 events'},{label:'Enabled rules',value:'14 of 15'},{label:'Disabled rules',value:'1 rule'}]} /></NetworkSummary>;

const channels=[
 {name:'Email',description:'Email delivery for monitoring updates and alert summaries.',configured:true,icon:'bell'},
 {name:'Slack',description:'Team notifications delivered to a shared messaging channel.',configured:true,icon:'users'},
 {name:'PagerDuty',description:'Incident notifications for your on-call response workflow.',configured:true,icon:'shield'},
 {name:'SMS',description:'Text message notifications for time-sensitive alerts.',configured:false,icon:'phone'},
];
export const NotificationSettings = () => {
 const [filter,setFilter]=useState('all');
 const visible=channels.filter(channel=>filter==='all'||channel.configured===(filter==='configured'));
 return <NetworkSummary title="Notification Settings" category="Incidents & Alerts" description="Review notification channels and see which delivery methods still need setup." metrics={[
  {label:'Delivery channels',value:channels.length,icon:'bell'},{label:'Configured',value:channels.filter(c=>c.configured).length,icon:'check'},{label:'Needs setup',value:channels.filter(c=>!c.configured).length,icon:'settings'},
 ]}><div className="summary-filter" role="group" aria-label="Filter notification channels">{[['all','All channels'],['configured','Configured'],['setup','Needs setup']].map(([key,label])=><button type="button" key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}</div><div className="summary-channel-grid">{visible.map(channel=><section className="summary-channel-card" key={channel.name}><div className="summary-provider-header"><span className="summary-metric-icon"><UIIcon symbol={channel.icon} /></span><h3>{channel.name}</h3></div><p>{channel.description}</p><div className="summary-channel-footer"><span>Configuration</span><span className="summary-inline-badge"><UIIcon symbol={channel.configured?'check':'settings'} />{channel.configured?'Configured':'Not configured'}</span></div></section>)}</div></NetworkSummary>;
};

type AnalyticsKind = 'history' | 'trends' | 'availability' | 'capacity' | 'comparison';
function useAnalyticsMeasurements() {
 const [measurements,setMeasurements]=useState<Measurement[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [attempt,setAttempt]=useState(0);
 const retry=useCallback(()=>setAttempt(value=>value+1),[]);
 useEffect(()=>{
  let current=true;
  setLoading(true);setError('');
  apiService.getTargets().then(targets=>Promise.all(targets.map(target=>apiService.getTargetMeasurements(target.id))))
   .then(rows=>{if(current)setMeasurements(rows.flatMap(group=>group||[]).filter(row=>row && Number.isFinite(Date.parse(row.time))).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time)));})
   .catch(reason=>{if(current)setError(reason instanceof Error?reason.message:'Analytics data could not be loaded.');})
   .finally(()=>{if(current)setLoading(false);});
  return ()=>{current=false;};
 },[attempt]);
 return {measurements,loading,error,retry};
}
const average=(values:number[])=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const ms=(value:number|null)=>value===null?'Unavailable':`${value.toFixed(2)} ms`;
const percent=(value:number|null)=>value===null?'Unavailable':`${value.toFixed(2)}%`;
function AnalyticsReport({kind,title,description}: {kind:AnalyticsKind;title:string;description:string}) {
 const {measurements,loading,error,retry}=useAnalyticsMeasurements();
 const [savedReports,setSavedReports]=useState<SavedAnalyticsReport[]>(()=>getSavedAnalyticsReports());
 const [saveStatus,setSaveStatus]=useState('');
 const values=useMemo(()=>{
  const withLatency=measurements.filter(row=>typeof row.latency_ms==='number'&&Number.isFinite(row.latency_ms));
  const midpoint=Math.floor(measurements.length/2);
  const first=measurements.slice(0,midpoint),second=measurements.slice(midpoint);
  const firstLatency=average(first.flatMap(row=>typeof row.latency_ms==='number'?[row.latency_ms]:[]));
  const secondLatency=average(second.flatMap(row=>typeof row.latency_ms==='number'?[row.latency_ms]:[]));
  const firstAvailability=first.length?first.filter(row=>row.success).length/first.length*100:null;
  const secondAvailability=second.length?second.filter(row=>row.success).length/second.length*100:null;
  const timeRange=measurements.length?`${new Date(measurements[0].time).toLocaleString()} – ${new Date(measurements[measurements.length-1].time).toLocaleString()}`:'Unavailable';
  const latencyChange=firstLatency!==null&&secondLatency!==null&&firstLatency!==0?(secondLatency-firstLatency)/firstLatency*100:null;
  return {withLatency,firstLatency,secondLatency,firstAvailability,secondAvailability,timeRange,latencyChange,availability:measurements.length?measurements.filter(row=>row.success).length/measurements.length*100:null};
 },[measurements]);
 const metrics=kind==='history'?[{label:'Measurements',value:loading?'Loading…':measurements.length,icon:'chart'},{label:'Observation window',value:loading?'Loading…':values.timeRange,icon:'time'},{label:'Average latency',value:loading?'Loading…':ms(average(values.withLatency.map(row=>row.latency_ms!))),icon:'route'}]
  :kind==='availability'?[{label:'Observed availability',value:loading?'Loading…':percent(values.availability),icon:'check'},{label:'Measurements',value:loading?'Loading…':measurements.length,icon:'list'},{label:'Observation window',value:loading?'Loading…':values.timeRange,icon:'time'}]
  :kind==='trends'?[{label:'Latency trend',value:loading?'Loading…':values.latencyChange===null?'More data needed':values.latencyChange<0?'Improving':values.latencyChange>0?'Worsening':'Unchanged',icon:'chart'},{label:'Latency change',value:loading?'Loading…':values.latencyChange===null?'Unavailable':`${values.latencyChange>0?'+':''}${values.latencyChange.toFixed(2)}%`,icon:'bolt'},{label:'Measurements',value:loading?'Loading…':measurements.length,icon:'list'}]
  :kind==='comparison'?[{label:'Earlier half latency',value:loading?'Loading…':ms(values.firstLatency),icon:'chart'},{label:'Later half latency',value:loading?'Loading…':ms(values.secondLatency),icon:'route'},{label:'Availability change',value:loading?'Loading…':values.firstAvailability===null||values.secondAvailability===null?'Unavailable':`${(values.secondAvailability-values.firstAvailability>0?'+':'')+(values.secondAvailability-values.firstAvailability).toFixed(2)} pp`,icon:'check'}]
  :[{label:'Capacity utilization',value:'Unavailable',icon:'chart'},{label:'Forecast',value:'Unavailable',icon:'time'},{label:'Resource samples',value:'Unavailable',icon:'server'}];
 const source=loading?'Loading measurements':error?'Data unavailable':'Recorded target measurements';
 const saveCurrentReport=()=>{
  try {
   setSavedReports(saveAnalyticsReport(title,[...metrics.map(({label,value})=>({label,value})),{label:'Data source',value:source}]));
   setSaveStatus('Report saved in this browser.');
  } catch { setSaveStatus('Could not save this report in browser storage.'); }
 };
 const removeReport=(id:string)=>{
  try { setSavedReports(removeSavedAnalyticsReport(id)); setSaveStatus('Saved report removed.'); }
  catch { setSaveStatus('Could not remove the saved report.'); }
 };
 return <NetworkSummary title={title} category="Analytics" description={description} metrics={metrics} source={source}>
  <section className="analytics-saved-controls" aria-label={`${title} saved reports`}>
   <div><h2>Save this report</h2><p>Save the current summary in this browser so you can return to it later.</p></div>
   <button type="button" onClick={saveCurrentReport} disabled={loading||!!error}>Save report</button>
   {saveStatus&&<p role="status">{saveStatus}</p>}
   {savedReports.length>0&&<div className="analytics-saved-list"><h3>Saved reports</h3>{savedReports.map(report=><article key={report.id}>
    <header><div><strong>{report.title}</strong><time dateTime={report.savedAt}>{new Date(report.savedAt).toLocaleString()}</time></div><button type="button" aria-label={`Remove saved report ${report.title}`} onClick={()=>removeReport(report.id)}>Remove</button></header>
    <dl>{report.summary.map(row=><div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
   </article>)}</div>}
  </section>
  {error?<section className="summary-detail-card" role="alert"><h2>Analytics could not be loaded</h2><p>{error}</p><button type="button" onClick={retry}>Retry</button></section>
   :loading?<p role="status">Loading recorded monitoring measurements…</p>
   :kind==='capacity'?<SummaryDetails title="Capacity planning unavailable" description="No resource utilization measurements or forecast inputs are available. Capacity cannot be estimated from reachability or latency data." rows={[{label:'Resource utilization samples',value:'None available'},{label:'Forecast',value:'Unavailable'}]} />
   :measurements.length===0?<SummaryDetails title="No monitoring measurements recorded yet" description="Add or enable targets and monitors to collect measurements for Analytics." rows={[{label:'Data points',value:'None'},{label:'Observation window',value:'Unavailable'}]} />
   :kind==='history'?<SummaryDetails title="Recorded observation summary" description="Values are calculated from measurements returned for saved targets." rows={[{label:'Observation window',value:values.timeRange},{label:'Collected measurements',value:measurements.length},{label:'Average latency observations',value:values.withLatency.length},{label:'Average response time',value:ms(average(values.withLatency.map(row=>row.latency_ms!)))}]} />
   :kind==='availability'?<SummaryDetails title="Observed availability" description="Successful recorded measurements divided by all returned measurements; this is not a forecast." rows={[{label:'Successful measurements',value:measurements.filter(row=>row.success).length},{label:'Total measurements',value:measurements.length},{label:'Observed availability',value:percent(values.availability)},{label:'Observation window',value:values.timeRange}]} />
   :kind==='trends'?<SummaryDetails title="Measured latency trend" description="Compares the earlier and later halves of the measurements currently returned by the API." rows={[{label:'Earlier half average',value:ms(values.firstLatency)},{label:'Later half average',value:ms(values.secondLatency)},{label:'Percent change',value:values.latencyChange===null?'More comparable data needed':`${values.latencyChange>0?'+':''}${values.latencyChange.toFixed(2)}%`}]} />
   :<SummaryDetails title="Period comparison" description="Compares the earlier and later halves of the measurements currently returned by the API." rows={[{label:'Earlier half average latency',value:ms(values.firstLatency)},{label:'Later half average latency',value:ms(values.secondLatency)},{label:'Earlier half availability',value:percent(values.firstAvailability)},{label:'Later half availability',value:percent(values.secondAvailability)}]} />}
 </NetworkSummary>;
}
export const HistoricalAnalysis = () => <AnalyticsReport kind="history" title="Historical Analysis" description="Review actual recorded measurements from saved targets." />;
export const PerformanceTrends = () => <AnalyticsReport kind="trends" title="Performance Trends" description="Compare measured latency across the available observation window." />;
export const AvailabilityReports = () => <AnalyticsReport kind="availability" title="Availability Reports" description="Review success rates calculated from recorded monitoring measurements." />;
export const CapacityPlanning = () => <AnalyticsReport kind="capacity" title="Capacity Planning" description="Review capacity metrics only when resource utilization data is available." />;
export const ComparativeAnalysis = () => <AnalyticsReport kind="comparison" title="Comparative Analysis" description="Compare actual measurements from the earlier and later observation periods." />;
export const APIMonitoring = () => <NetworkSummary title="API Monitoring" category="Applications" description="Review endpoint health and aggregate response time." metrics={[
 {label:'API endpoints',value:24,icon:'link'},{label:'Healthy endpoints',value:23,icon:'check'},{label:'Average response',value:'145.5 ms',icon:'time'},
]}><SummaryDetails title="Endpoint overview" description="Existing aggregate sample API measurements." rows={[{label:'Monitored endpoints',value:24},{label:'Healthy',value:23},{label:'Average response time',value:'145.5 ms'}]} /></NetworkSummary>;
