import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { DPITools } from './pages/DPITools';
import { AccessChecks } from './pages/AccessChecks';
import { Overview } from './pages/Overview';
import { Devices } from './pages/Devices';
import { Topology } from './pages/Topology';
import { WebsiteMonitor } from './pages/WebsiteMonitor';
import { NMS } from './pages/NMS';
import { Probes } from './pages/Probes';
import { TargetsList } from './pages/TargetsList';
import { TargetDetail } from './pages/TargetDetail';
import { DNSServers } from './pages/DNSServers';
import { NetworkPerformance } from './pages/NetworkPerformance';
import { Traceroute } from './pages/Traceroute';
import { RealtimeDashboard } from './pages/RealtimeDashboard';
import { ICMPMonitoring } from './pages/ICMPMonitoring';
import { TCPMonitoring } from './pages/TCPMonitoring';
import { UDPMonitoring } from './pages/UDPMonitoring';
import { HTTPMonitoring } from './pages/HTTPMonitoring';
import { MTUDiscovery } from './pages/MTUDiscovery';
import { PacketCapture } from './pages/PacketCapture';
import { PingTool } from './pages/PingTool';
import { TLSCertificates } from './pages/TLSCertificates';
import { LatencyMonitoring } from './pages/LatencyMonitoring';
import { ThroughputAnalysis } from './pages/ThroughputAnalysis';
import { QualityAnalysis } from './pages/QualityAnalysis';
import { SLAMonitoring } from './pages/SLAMonitoring';
import { ASPathAnalysis } from './pages/ASPathAnalysis';
import { RouteMonitoring } from './pages/RouteMonitoring';
import { BGPIntelligence } from './pages/BGPIntelligence';
import { RoutingHistory } from './pages/RoutingHistory';
import { SNMPMonitoring } from './pages/SNMPMonitoring';
import { InterfaceMonitoring } from './pages/InterfaceMonitoring';
import { DataCenters } from './pages/DataCenters';
import { ISPComparison } from './pages/ISPComparison';
import { IPv4Monitoring } from './pages/IPv4Monitoring';
import { IPv6Monitoring } from './pages/IPv6Monitoring';
import { MultiLocation } from './pages/MultiLocation';
import { ConnectivityTesting } from './pages/ConnectivityTesting';
import { AlertsPage } from './pages/AlertsPage';
import { AlertRules, NotificationSettings, HistoricalAnalysis, PerformanceTrends, AvailabilityReports, CapacityPlanning, ComparativeAnalysis, APIMonitoring } from './pages/AnalyticsMonitoring';
import { DatabaseMonitoring, CDNPerformance } from './pages/AppMonitoring';
import { NetworkTools } from './pages/NetworkTools';
import { Diagnostics } from './pages/Diagnostics';
import { Incidents } from './pages/Incidents';
import InfrastructureManagement from './pages/InfrastructureManagement';
import DiagnosticsDashboard from './pages/DiagnosticsDashboard';
import MultiISPDashboard from './pages/MultiISPDashboard';
import SystemDashboard from './pages/SystemDashboard';
import NetworkManagement from './pages/NetworkManagement';
import FirewallManagement from './pages/FirewallManagement';
import ServiceManagement from './pages/ServiceManagement';
import StorageManagement from './pages/StorageManagement';
import UserManagement from './pages/UserManagement';
import SoftwareUpdates from './pages/SoftwareUpdates';
import UserSettings from './pages/UserSettings';
import UserProfile from './pages/UserProfile';
import VPNManager from './pages/VPNManager';
import IranInternetMonitor from './pages/IranInternetMonitor';
import Radar from './pages/Radar';
import NetworkDiscovery from './pages/NetworkDiscovery';
import FlowAnalyzer from './pages/FlowAnalyzer';
import PerformanceMetrics from './pages/PerformanceMetrics';
import { Navigation } from './components/Navigation';
import { SystemMenu } from './components/SystemMenu';
import { AuditLogs } from './pages/AuditLogs';
import { ToolManagement } from './pages/ToolManagement';
import { BackupManagement } from './pages/BackupManagement';
import { Contact } from './pages/Contact';
import { DNSInvestigation } from './pages/DNSInvestigation';
import { ScannerTools } from './pages/ScannerTools';
import { StandaloneToolShell } from './components/StandaloneToolShell';
import { NotificationContainer } from './components/NotificationContainer';
import './App.css';
import './layout.css';
import './cards.css';
import './appearance/appearance.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('user');

    if (token && user) {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (token: string, user: any) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
  };

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading NetMon...</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="app">
        {!isAuthenticated ? (
          <Routes>
            <Route path="/" element={<div className="page-surface" data-page="Home"><Home onLogin={handleLogin} /></div>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/app/dpi-tools" element={<DPITools />} />
            <Route
              path="/dashboard"
              element={
                <main className="dashboard-main" data-page="Dashboard">
                  <Dashboard onLogout={handleLogout} />
                </main>
              }
            />
            <Route path="/vpn/*" element={<div className="vpn-standalone" data-page="VPNManager"><VPNManager /></div>} />
            <Route path="/contact/*" element={<Contact />} />
            <Route path="/iran-monitor/*" element={<IranInternetMonitor />} />
            <Route path="/app/dns-hunter" element={<StandaloneToolShell title="DNS Hunter"><DNSInvestigation mode="dns" /></StandaloneToolShell>} />
            <Route path="/app/edge-ip-checker" element={<StandaloneToolShell title="Edge IP Checker"><DNSInvestigation mode="edge" /></StandaloneToolShell>} />
            <Route path="/app/cdn-xray-scanner" element={<StandaloneToolShell title="CDN Xray Scanner"><ScannerTools mode="cdn" /></StandaloneToolShell>} />
            <Route path="/app/akamai-ip-scan" element={<StandaloneToolShell title="Akamai IP Scan"><ScannerTools mode="akamai" /></StandaloneToolShell>} />
            <Route path="/app/netmon-radar" element={<StandaloneToolShell title="NetMon Radar"><Radar /></StandaloneToolShell>} />
            <Route
              path="/app/*"
              element={
                <>
                  <Navigation onLogout={handleLogout} />
                  <NotificationContainer />
                  <main className="app-main-content">
                    <SystemMenu />
                    <Routes>
                      <Route index element={<div className="page-surface" data-page="Overview"><Overview /></div>} />
                      <Route path="realtime" element={<div className="page-surface" data-page="RealtimeDashboard"><RealtimeDashboard /></div>} />
                      <Route path="monitoring" element={<Navigate to="/app/monitoring/doh" replace />} />
                      <Route path="monitoring/:category" element={<div className="page-surface" data-page="AccessChecks"><AccessChecks /></div>} />
                      <Route path="targets" element={<div className="page-surface" data-page="TargetsList"><TargetsList /></div>} />
                      <Route path="targets/:id" element={<div className="page-surface" data-page="TargetDetail"><TargetDetail /></div>} />
                      <Route path="monitors" element={<div className="page-surface" data-page="NMS"><NMS /></div>} />
                      <Route path="probes" element={<div className="page-surface" data-page="Probes"><Probes /></div>} />
                      <Route path="website-monitor" element={<div className="page-surface" data-page="WebsiteMonitor"><WebsiteMonitor /></div>} />
                      <Route path="latency" element={<div className="page-surface" data-page="LatencyMonitoring"><LatencyMonitoring /></div>} />
                      <Route path="network-performance" element={<div className="page-surface" data-page="NetworkPerformance"><NetworkPerformance /></div>} />
                      <Route path="throughput" element={<div className="page-surface" data-page="ThroughputAnalysis"><ThroughputAnalysis /></div>} />
                      <Route path="quality" element={<div className="page-surface" data-page="QualityAnalysis"><QualityAnalysis /></div>} />
                      <Route path="sla" element={<div className="page-surface" data-page="SLAMonitoring"><SLAMonitoring /></div>} />
                      <Route path="icmp" element={<div className="page-surface" data-page="ICMPMonitoring"><ICMPMonitoring /></div>} />
                      <Route path="tcp" element={<div className="page-surface" data-page="TCPMonitoring"><TCPMonitoring /></div>} />
                      <Route path="udp" element={<div className="page-surface" data-page="UDPMonitoring"><UDPMonitoring /></div>} />
                      <Route path="dns-servers" element={<div className="page-surface" data-page="DNSServers"><DNSServers /></div>} />
                      <Route path="dns-hunter" element={<Navigate to="/app/dns-hunter" replace />} />
                      <Route path="edge-ip-checker" element={<Navigate to="/app/edge-ip-checker" replace />} />
                      <Route path="http-monitoring" element={<div className="page-surface" data-page="HTTPMonitoring"><HTTPMonitoring /></div>} />
                      <Route path="tls-certificates" element={<div className="page-surface" data-page="TLSCertificates"><TLSCertificates /></div>} />
                      <Route path="diagnostics" element={<div className="page-surface" data-page="Diagnostics"><Diagnostics /></div>} />
                      <Route path="ping-tools" element={<div className="page-surface" data-page="PingTool"><PingTool /></div>} />
                      <Route path="traceroute" element={<div className="page-surface" data-page="Traceroute"><Traceroute /></div>} />
                      <Route path="vpn" element={<Navigate to="/vpn" replace />} />
                      <Route path="mtu-discovery" element={<div className="page-surface" data-page="MTUDiscovery"><MTUDiscovery /></div>} />
                      <Route path="packet-capture" element={<div className="page-surface" data-page="PacketCapture"><PacketCapture /></div>} />
                      <Route path="network-tools" element={<div className="page-surface" data-page="NetworkTools"><NetworkTools /></div>} />
                      <Route path="as-path" element={<div className="page-surface" data-page="ASPathAnalysis"><ASPathAnalysis /></div>} />
                      <Route path="route-monitoring" element={<div className="page-surface" data-page="RouteMonitoring"><RouteMonitoring /></div>} />
                      <Route path="bgp-intelligence" element={<div className="page-surface" data-page="BGPIntelligence"><BGPIntelligence /></div>} />
                      <Route path="routing-history" element={<div className="page-surface" data-page="RoutingHistory"><RoutingHistory /></div>} />
                      <Route path="system-dashboard" element={<div className="page-surface" data-page="SystemDashboard"><SystemDashboard /></div>} />
                      <Route path="infrastructure" element={<div className="page-surface" data-page="InfrastructureManagement"><InfrastructureManagement /></div>} />
                      <Route path="diagnostics-dashboard" element={<div className="page-surface" data-page="DiagnosticsDashboard"><DiagnosticsDashboard /></div>} />
                      <Route path="network-management" element={<div className="page-surface" data-page="NetworkManagement"><NetworkManagement /></div>} />
                      <Route path="firewall-management" element={<div className="page-surface" data-page="FirewallManagement"><FirewallManagement /></div>} />
                      <Route path="service-management" element={<div className="page-surface" data-page="ServiceManagement"><ServiceManagement /></div>} />
                      <Route path="storage-management" element={<div className="page-surface" data-page="StorageManagement"><StorageManagement /></div>} />
                      <Route path="user-management" element={<div className="page-surface" data-page="UserManagement"><UserManagement /></div>} />
                      <Route path="software-updates" element={<div className="page-surface" data-page="SoftwareUpdates"><SoftwareUpdates /></div>} />
                      <Route path="settings" element={<div className="page-surface" data-page="UserSettings"><UserSettings /></div>} />
                      <Route path="profile" element={<div className="page-surface" data-page="UserProfile"><UserProfile /></div>} />
                      <Route path="iran-monitor" element={<Navigate to="/iran-monitor" replace />} />
                      <Route path="radar" element={<Navigate to="/app/netmon-radar" replace />} />
                      <Route path="discovery" element={<div className="page-surface" data-page="NetworkDiscovery"><NetworkDiscovery /></div>} />
                      <Route path="flows" element={<div className="page-surface" data-page="FlowAnalyzer"><FlowAnalyzer /></div>} />
                      <Route path="performance" element={<div className="page-surface" data-page="PerformanceMetrics"><PerformanceMetrics /></div>} />
                      <Route path="devices" element={<div className="page-surface" data-page="Devices"><Devices /></div>} />
                      <Route path="snmp" element={<div className="page-surface" data-page="SNMPMonitoring"><SNMPMonitoring /></div>} />
                      <Route path="interfaces" element={<div className="page-surface" data-page="InterfaceMonitoring"><InterfaceMonitoring /></div>} />
                      <Route path="topology" element={<div className="page-surface" data-page="Topology"><Topology /></div>} />
                      <Route path="datacenters" element={<div className="page-surface" data-page="DataCenters"><DataCenters /></div>} />
                      <Route path="isp-comparison" element={<div className="page-surface" data-page="ISPComparison"><ISPComparison /></div>} />
                      <Route path="isp-management" element={<div className="page-surface" data-page="MultiISPDashboard"><MultiISPDashboard /></div>} />
                      <Route path="ipv4-monitoring" element={<div className="page-surface" data-page="IPv4Monitoring"><IPv4Monitoring /></div>} />
                      <Route path="ipv6-monitoring" element={<div className="page-surface" data-page="IPv6Monitoring"><IPv6Monitoring /></div>} />
                      <Route path="multi-location" element={<div className="page-surface" data-page="MultiLocation"><MultiLocation /></div>} />
                      <Route path="connectivity" element={<div className="page-surface" data-page="ConnectivityTesting"><ConnectivityTesting /></div>} />
                      <Route path="alerts" element={<div className="page-surface" data-page="AlertsPage"><AlertsPage /></div>} />
                      <Route path="incidents" element={<div className="page-surface" data-page="Incidents"><Incidents /></div>} />
                      <Route path="alert-rules" element={<div className="page-surface" data-page="AlertRules"><AlertRules /></div>} />
                      <Route path="notifications" element={<div className="page-surface" data-page="NotificationSettings"><NotificationSettings /></div>} />
                      <Route path="historical" element={<div className="page-surface" data-page="HistoricalAnalysis"><HistoricalAnalysis /></div>} />
                      <Route path="trends" element={<div className="page-surface" data-page="PerformanceTrends"><PerformanceTrends /></div>} />
                      <Route path="availability" element={<div className="page-surface" data-page="AvailabilityReports"><AvailabilityReports /></div>} />
                      <Route path="capacity-planning" element={<div className="page-surface" data-page="CapacityPlanning"><CapacityPlanning /></div>} />
                      <Route path="comparative" element={<div className="page-surface" data-page="ComparativeAnalysis"><ComparativeAnalysis /></div>} />
                      <Route path="api-monitoring" element={<div className="page-surface" data-page="APIMonitoring"><APIMonitoring /></div>} />
                      <Route path="database-monitoring" element={<div className="page-surface" data-page="DatabaseMonitoring"><DatabaseMonitoring /></div>} />
                      <Route path="cdn-performance" element={<div className="page-surface" data-page="CDNPerformance"><CDNPerformance /></div>} />
                      <Route path="users" element={<div className="page-surface" data-page="UserManagement"><UserManagement /></div>} />
                      <Route path="audit-logs" element={<div className="page-surface" data-page="AuditLogs"><AuditLogs /></div>} />
                      <Route path="backup" element={<div className="page-surface" data-page="BackupManagement"><BackupManagement /></div>} />
                      <Route path="tool-management" element={<div className="page-surface" data-page="ToolManagement"><ToolManagement /></div>} />
                      <Route path="*" element={<Navigate to="/app/" replace />} />
                    </Routes>
                  </main>
                </>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        )}
      </div>
    </Router>
  );
}

export default App;
