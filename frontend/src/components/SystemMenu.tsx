import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './SystemMenu.css';
import { FeatureSource } from './FeatureSource';

const systemSections = [
  { label: 'ACCOUNT & PREFERENCES', items: [
    { label: 'Profile', path: '/app/profile', glyph: 'M9 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8ZM2 21v-2a7 7 0 0 1 14 0v2m1-17a4 4 0 0 1 0 8m1 3a6 6 0 0 1 4 5' },
    { label: 'Settings', path: '/app/settings', glyph: 'M3 7h18M3 17h18M9 4v6m6 4v6' },
    { label: 'Preferences', path: '/app/settings?tab=preferences', glyph: 'M3 7h18M3 17h18M9 4v6m6 4v6' },
    { label: 'Notifications', path: '/app/settings?tab=notifications', glyph: 'M4 5h16v14H4zM4 7l8 6 8-6' },
    { label: 'Security', path: '/app/settings?tab=security', glyph: 'M12 2l9 4v6c0 5-3.5 8-9 10-5.5-2-9-5-9-10V6l9-4ZM9 12l2 2 4-4' },
    { label: 'Appearance', path: '/app/settings?tab=appearance', glyph: 'M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h4a4 4 0 0 0 4-4c0-4-5-6-9-6ZM7 9h.01M10 6h.01M15 6h.01' },
  ] },
  { label: 'SYSTEM ADMINISTRATION', items: [
    { label: 'System Dashboard', path: '/app/system-dashboard', glyph: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z' },
    { label: 'Users & Roles', path: '/app/users', glyph: 'M9 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8ZM2 21v-2a7 7 0 0 1 14 0v2m1-17a4 4 0 0 1 0 8m1 3a6 6 0 0 1 4 5' },
    { label: 'Audit Logs', path: '/app/audit-logs', glyph: 'M8 6h12M8 12h12M8 18h12M3 6h.01M3 12h.01M3 18h.01' },
    { label: 'Service Management', path: '/app/service-management', glyph: 'M4 4h16v6H4zM4 14h16v6H4zM7 7h.01M7 17h.01' },
    { label: 'Backup & Restore', path: '/app/backup', glyph: 'M4 3h16v7H4V3ZM4 14h16v7H4v-7ZM7 7h.01M7 18h.01M11 7h6M11 18h6' },
    { label: 'Tool Management', path: '/app/tool-management', glyph: 'M13 3a5 5 0 0 0-4 7L3 16l5 5 6-6a5 5 0 0 0 7-4l-4 2-3-3 2-4a5 5 0 0 0-3-3Z' },
    { label: 'Software Updates', path: '/app/software-updates', glyph: 'M12 3v12m0 0 5-5m-5 5-5-5M4 17v4h16v-4' },
    { label: 'Storage Management', path: '/app/storage-management', glyph: 'M12 3c5 0 8 1.3 8 3s-3 3-8 3-8-1.3-8-3 3-3 8-3Zm-8 3v12c0 1.7 3 3 8 3s8-1.3 8-3V6' },
  ] },
];

const workspaceSections = [
  { label: 'OVERVIEW', items: [
    { label: 'Overview', path: '/app/', glyph: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z' },
    { label: 'Real-time Monitoring', path: '/app/realtime', glyph: 'M3 12h4l3-8 4 16 3-8h4' },
  ] },
  { label: 'MONITORING', items: [
    { label: 'Network Targets', path: '/app/targets', glyph: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20M2 12h20' },
    { label: 'Monitors', path: '/app/monitors', glyph: 'M4 4h16v16H4zM8 8h8v8H8z' },
    { label: 'Probes', path: '/app/probes', glyph: 'M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M19 5l-3 3m-8 8-3 3' },
    { label: 'Website Monitor', path: '/app/website-monitor', glyph: 'M3 4h18v14H3zM8 21h8m-4-3v3' },
  ] },
  { label: 'INTERNET ACCESS', items: [
    { label: 'DoH Servers', path: '/app/monitoring/doh', glyph: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20M2 12h20' },
    { label: 'DNS Servers', path: '/app/monitoring/dns', glyph: 'M4 5h16v14H4zM8 9h8M8 13h8' },
    { label: 'Websites', path: '/app/monitoring/websites', glyph: 'M3 4h18v14H3zM8 21h8m-4-3v3' },
    { label: 'Filtered Websites', path: '/app/monitoring/filtered-websites', glyph: 'M4 4h16l-6 7v7l-4 2v-9L4 4Z' },
    { label: 'Sanctioned Websites', path: '/app/monitoring/sanctioned-websites', glyph: 'M12 2l9 4v6c0 5-3.5 8-9 10-5.5-2-9-5-9-10V6l9-4Z' },
  ] },
  { label: 'NETWORK PERFORMANCE', items: [
    { label: 'Latency Monitoring', path: '/app/latency', glyph: 'M3 12h4l3-8 4 16 3-8h4' },
    { label: 'Network Performance', path: '/app/network-performance', glyph: 'M4 18V6m5 12V9m5 9V4m5 14v-7' },
    { label: 'Throughput Analysis', path: '/app/throughput', glyph: 'M3 12h18M12 3v18m-7-5 5-4-5-4m14 8-5-4 5-4' },
    { label: 'Quality Analysis', path: '/app/quality', glyph: 'M12 2v20M2 12h20M5 5l14 14m0-14L5 19' },
    { label: 'SLA Monitoring', path: '/app/sla', glyph: 'M12 2l9 4v6c0 5-3.5 8-9 10-5.5-2-9-5-9-10V6l9-4Z' },
  ] },
  { label: 'PROTOCOLS', items: [
    { label: 'ICMP Monitoring', path: '/app/icmp', glyph: 'M3 12h18M12 3v18' },
    { label: 'TCP Monitoring', path: '/app/tcp', glyph: 'M4 4h16v16H4zM8 8h8v8H8z' },
    { label: 'UDP Monitoring', path: '/app/udp', glyph: 'M4 4h16v16H4zM8 12h8' },
    { label: 'DNS Server Monitoring', path: '/app/dns-servers', glyph: 'M4 5h16v14H4zM8 9h8M8 13h8' },
    { label: 'HTTP Monitoring', path: '/app/http-monitoring', glyph: 'M3 4h18v16H3zM7 8h10M7 12h10M7 16h6' },
    { label: 'TLS Certificates', path: '/app/tls-certificates', glyph: 'M12 2l9 4v6c0 5-3.5 8-9 10-5.5-2-9-5-9-10V6l9-4Z' },
  ] },
  { label: 'DIAGNOSTICS', items: [
    { label: 'Diagnostics', path: '/app/diagnostics', glyph: 'M4 4h16v16H4zM8 8h8v8H8z' },
    { label: 'Ping Tool', path: '/app/ping-tools', glyph: 'M3 12h18M12 3v18' },
    { label: 'Traceroute Tool', path: '/app/traceroute', glyph: 'M4 19a2 2 0 1 0 0-4a2 2 0 1 0 0 4ZM20 9a2 2 0 1 0 0-4a2 2 0 1 0 0 4ZM4 15V8a4 4 0 0 1 4-4h8M6 17h10a4 4 0 0 0 4-4V9' },
    { label: 'MTU Discovery', path: '/app/mtu-discovery', glyph: 'M3 12h18M6 8l-4 4 4 4m12-8 4 4-4 4' },
    { label: 'Packet Capture', path: '/app/packet-capture', glyph: 'M4 4h16v16H4zM8 8h8v8H8z' },
    { label: 'Network Tools', path: '/app/network-tools', glyph: 'M13 3a5 5 0 0 0-4 7L3 16l5 5 6-6a5 5 0 0 0 7-4l-4 2-3-3 2-4a5 5 0 0 0-3-3Z' },
  ] },
  { label: 'NETWORK ANALYSIS', items: [
    { label: 'Diagnostics Dashboard', path: '/app/diagnostics-dashboard', glyph: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z' },
    { label: 'Network Discovery', path: '/app/discovery', glyph: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20M2 12h20' },
    { label: 'Flow Analyzer', path: '/app/flows', glyph: 'M3 6h7l2 4h9M3 18h7l2-4h9' },
    { label: 'Performance Metrics', path: '/app/performance', glyph: 'M4 18V6m5 12V9m5 9V4m5 14v-7' },
  ] },
  { label: 'ROUTING & BGP', items: [
    { label: 'Traceroute / BGP Lookup', path: '/app/monitoring/routes', glyph: 'M4 19a2 2 0 1 0 0-4a2 2 0 1 0 0 4ZM20 9a2 2 0 1 0 0-4a2 2 0 1 0 0 4ZM4 15V8a4 4 0 0 1 4-4h8' },
    { label: 'AS Path Analysis', path: '/app/as-path', glyph: 'M3 12h18m-5-5 5 5-5 5M8 7l-5 5 5 5' },
    { label: 'Route Monitoring', path: '/app/route-monitoring', glyph: 'M4 19a2 2 0 1 0 0-4a2 2 0 1 0 0 4ZM20 9a2 2 0 1 0 0-4a2 2 0 1 0 0 4ZM4 15V8a4 4 0 0 1 4-4h8' },
    { label: 'BGP Intelligence', path: '/app/bgp-intelligence', glyph: 'M12 2v20m-7-5 7-7 7 7M5 5l7 7 7-7' },
    { label: 'Routing History', path: '/app/routing-history', glyph: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5m4-2v5l4 2' },
  ] },
  { label: 'ANALYTICS', items: [
    { label: 'Historical Analysis', path: '/app/historical', glyph: 'M3 3v18h18M6 16l4-5 4 3 5-7' },
    { label: 'Performance Trends', path: '/app/trends', glyph: 'M3 18l6-6 4 3 8-9' },
    { label: 'Availability Reports', path: '/app/availability', glyph: 'M4 12l5 5L20 6' },
    { label: 'Capacity Planning', path: '/app/capacity-planning', glyph: 'M3 20h18M5 17V8m5 9V4m5 13v-6m5 6V6' },
    { label: 'Comparative Analysis', path: '/app/comparative', glyph: 'M4 5h7v14H4zM13 5h7v14h-7z' },
  ] },
  { label: 'INFRASTRUCTURE', items: [
    { label: 'Infrastructure Management', path: '/app/infrastructure', glyph: 'M3 21h18M5 21V5l7-3 7 3v16M9 8h1m4 0h1m-6 4h1m4 0h1' },
    { label: 'Network Management', path: '/app/network-management', glyph: 'M4 4h16v16H4zM8 8h8v8H8z' },
    { label: 'Firewall Management', path: '/app/firewall-management', glyph: 'M12 2l9 4v6c0 5-3.5 8-9 10-5.5-2-9-5-9-10V6l9-4Z' },
    { label: 'Devices', path: '/app/devices', glyph: 'M4 4h16v16H4zM8 8h3v3H8zM14 8h3M14 11h3M8 15h9' },
    { label: 'SNMP Monitoring', path: '/app/snmp', glyph: 'M3 18a13 13 0 0 1 18 0M6 15a9 9 0 0 1 12 0M9 12a5 5 0 0 1 6 0M12 9v.01' },
    { label: 'Interface Monitoring', path: '/app/interfaces', glyph: 'M4 7h16M4 17h16M8 4v6m8 4v6' },
    { label: 'Topology', path: '/app/topology', glyph: 'M5 5h4v4H5zM15 15h4v4h-4zM15 5h4v4h-4zM9 7h6m-8 2v6h10m0 0v-2' },
    { label: 'Data Centers', path: '/app/datacenters', glyph: 'M3 21h18M5 21V5l7-3 7 3v16M9 8h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1' },
  ] },
  { label: 'ISP & CONNECTIVITY', items: [
    { label: 'ISP Operations', path: '/app/isp-management', glyph: 'M4 6h16M4 12h16M4 18h16M8 4v4m8 2v4m-8 2v4' },
    { label: 'ISP Comparison', path: '/app/isp-comparison', glyph: 'M4 6h16M4 12h16M4 18h16M8 4v4m8 2v4m-8 2v4' },
    { label: 'IPv4 Monitoring', path: '/app/ipv4-monitoring', glyph: 'M4 7h16M4 12h16M4 17h16' },
    { label: 'IPv6 Monitoring', path: '/app/ipv6-monitoring', glyph: 'M4 5h16M4 9h16M4 13h16M4 17h16' },
    { label: 'Multi-Location', path: '/app/multi-location', glyph: 'M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z' },
    { label: 'Connectivity Tests', path: '/app/connectivity', glyph: 'M8 12h8m-4-4 4 4-4 4M4 5v14' },
  ] },
  { label: 'INCIDENTS & ALERTS', items: [
    { label: 'Alerts', path: '/app/alerts', glyph: 'M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4' },
    { label: 'Incidents', path: '/app/incidents', glyph: 'M12 3 2.8 20h18.4L12 3Zm0 6v5m0 3v.01' },
    { label: 'Alert Rules', path: '/app/alert-rules', glyph: 'M4 5h16M4 12h16M4 19h16M8 3v4m8 3v4m-8 3v4' },
    { label: 'Notifications', path: '/app/notifications', glyph: 'M4 5h16v14H4zM4 7l8 6 8-6' },
  ] },
  { label: 'APPLICATIONS', items: [
    { label: 'API Monitoring', path: '/app/api-monitoring', glyph: 'M4 5h16v14H4zM8 9h8M8 13h5' },
    { label: 'Database Monitoring', path: '/app/database-monitoring', glyph: 'M12 3c5 0 8 1.3 8 3s-3 3-8 3-8-1.3-8-3 3-3 8-3Zm-8 3v12c0 1.7 3 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3 3 8 3s8-1.3 8-3' },
    { label: 'CDN Performance', path: '/app/cdn-performance', glyph: 'M3 12h4l3-8 4 16 3-8h4' },
  ] },
  { label: 'SCANNER CARDS', items: [
    { label: 'DNS Hunter', path: '/app/dns-hunter', glyph: 'M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0m9-9c-3 3-3 15 0 18m0-18c3 3 3 15 0 18M3 12h18' },
    { label: 'Edge IP Checker', path: '/app/edge-ip-checker', glyph: 'M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0m9-9c-3 3-3 15 0 18' },
    { label: 'CDN Xray Scanner', path: '/app/cdn-xray-scanner', glyph: 'M4 4h16v16H4zM8 8h8v8H8z' },
    { label: 'Akamai IP Scan', path: '/app/akamai-ip-scan', glyph: 'M3 12h18M12 3v18' },
    { label: 'NetMon Radar', path: '/app/netmon-radar', glyph: 'M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0m9-9v9l6 3' },
    { label: 'Iran Internet Observatory', path: '/iran-monitor', glyph: 'M12 2l9 4v6c0 5-3.5 8-9 10-5.5-2-9-5-9-10V6l9-4Z' },
    { label: 'DPI Tools', path: '/app/dpi-tools', glyph: 'M13 3a5 5 0 0 0-4 7L3 16l5 5 6-6a5 5 0 0 0 7-4l-4 2-3-3 2-4a5 5 0 0 0-3-3Z' },
    { label: 'VPN Subscriptions', path: '/vpn', glyph: 'M12 2l9 4v6c0 5-3.5 8-9 10-5.5-2-9-5-9-10V6l9-4Z' },
    { label: 'Contact Us', path: '/contact', glyph: 'M4 5h16v14H4zM4 7l8 6 8-6' },
  ] },
];

export function SystemMenu() {
  const [open, setOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const workspaceRoot = useRef<HTMLDivElement>(null);
  const workspaceTrigger = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const systemItems = systemSections.flatMap(section => section.items);
  const activeItem = systemItems.find(item => location.pathname + location.search === item.path) || systemItems.find(item => location.pathname === item.path);
  const activeWorkspaceItem = workspaceSections.flatMap(section => section.items).find(item => location.pathname === item.path);

  useEffect(() => { setOpen(false); setWorkspaceOpen(false); }, [location.pathname, location.search]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node) && !workspaceRoot.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setWorkspaceOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  useEffect(() => {
    if (!workspaceOpen) return;
    const outside = (event: PointerEvent) => {
      if (!workspaceRoot.current?.contains(event.target as Node) && !root.current?.contains(event.target as Node)) setWorkspaceOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setWorkspaceOpen(false);
        setOpen(false);
        workspaceTrigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [workspaceOpen]);

  return (
    <header className="app-topbar">
      <FeatureSource />
      <div className="topbar-menus">
      <Link to="/dashboard" className="app-home-back" aria-label="Back to the application home page" title="Back to application home">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5m7 7-7-7 7-7" /></svg>
      </Link>
      <div className="system-menu workspace-menu" ref={workspaceRoot}>
        <button ref={workspaceTrigger} type="button" className={`system-menu-trigger ${workspaceOpen || activeWorkspaceItem ? 'selected' : ''}`} aria-expanded={workspaceOpen} aria-controls="workspace-navigation" onClick={() => { setWorkspaceOpen(value => !value); setOpen(false); }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M4 5h16M4 12h16M4 19h16" /></svg>
          <span>Operations</span>
          {activeWorkspaceItem && <span className="system-current-page">/ {activeWorkspaceItem.label}</span>}
          <svg className="system-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        {workspaceOpen && <nav id="workspace-navigation" className="system-menu-panel workspace-menu-panel" aria-label="Operations navigation">
          {workspaceSections.map(section => <div className="workspace-menu-section" key={section.label}>
            <div className="system-menu-heading">{section.label}</div>
            {section.items.map(item => <Link key={item.path} to={item.path} aria-current={activeWorkspaceItem === item ? 'page' : undefined} onClick={() => setWorkspaceOpen(false)}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={item.glyph} /></svg>
              <span>{item.label}</span><span className="system-link-arrow" aria-hidden="true">↗</span>
            </Link>)}
          </div>)}
        </nav>}
      </div>
      <div className="system-menu" ref={root}>
        <button ref={trigger} type="button" className={`system-menu-trigger ${open || activeItem ? 'selected' : ''}`} aria-expanded={open} aria-controls="system-navigation" onClick={() => setOpen(value => !value)}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M3 7h18M3 17h18M9 4v6m6 4v6" /></svg>
          <span>System</span>
          {activeItem && <span className="system-current-page">/ {activeItem.label}</span>}
          <svg className="system-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        {open && <nav id="system-navigation" className="system-menu-panel" aria-label="System navigation">
          {systemSections.map(section => <div className="system-menu-section" key={section.label}>
            <div className="system-menu-heading">{section.label}</div>
            {section.items.map(item => <Link key={item.path} to={item.path} className={item.label === 'Appearance' ? 'system-appearance-link' : undefined} aria-current={activeItem === item ? 'page' : undefined} onClick={() => setOpen(false)}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={item.glyph} /></svg>
              <span>{item.label}</span>
              <span className="system-link-arrow" aria-hidden="true">↗</span>
            </Link>)}
          </div>)}
        </nav>}
      </div>
      </div>
    </header>
  );
}
