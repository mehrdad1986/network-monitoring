import { useLocation } from 'react-router-dom';
const sources: Record<string, string> = {
  targets: 'Saved local inventory', realtime: 'Live network checks', latency: 'Live network checks',
  'network-performance': 'Browser network measurements', icmp: 'Live network checks', tcp: 'Live network checks', udp: 'Live network checks',
  'dns-servers': 'Live network checks', 'http-monitoring': 'Live network checks', traceroute: 'Live network checks', 'network-tools': 'Local diagnostic service',
  'packet-capture': 'Local capture service', settings: 'Browser preferences', 'audit-logs': 'Local backend activity', 'tool-management': 'Local tool inventory',
  probes: 'Monitoring service connection',
  backup: 'Router setup required',
};
export function FeatureSource() {
  const section = useLocation().pathname.split('/')[2] || 'overview';
  const source = sources[section];
  return <span className={`feature-source ${source ? '' : 'preview'}`}><span aria-hidden="true" />{source || 'Preview data · monitoring source not connected'}</span>;
}
