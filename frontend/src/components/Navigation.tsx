import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import './Navigation.css';
import { accessCategories } from '../pages/AccessChecks';

// Keep route ownership explicit so a deep link opens its navigation group.
const sectionRoutes: Record<string, readonly string[]> = {
  overview: ['/', '/realtime'],
  monitoring: ['/targets', '/monitors', '/probes', '/website-monitor'],
  internetAccess: ['/monitoring/doh', '/monitoring/dns', '/monitoring/websites', '/monitoring/filtered-websites', '/monitoring/sanctioned-websites'],
  performance: ['/latency', '/network-performance', '/throughput', '/quality', '/sla'],
  protocols: ['/icmp', '/tcp', '/udp', '/dns-servers', '/http-monitoring', '/tls-certificates'],
  diagnostics: ['/ping-tools', '/mtu-discovery', '/packet-capture', '/network-tools'],
  routing: ['/monitoring/routes', '/traceroute', '/as-path', '/route-monitoring', '/bgp-intelligence', '/routing-history'],
  analytics: ['/historical', '/trends', '/availability', '/capacity-planning', '/comparative'],
};

const glyphBySymbol: Record<string, string> = {
  '📊': 'chart', '📈': 'chart', '📋': 'list', '📚': 'list', '📝': 'list', '✅': 'check',
  '📡': 'signal', '🌐': 'globe', '🌍': 'globe', '4️⃣': 'globe', '6️⃣': 'globe',
  '🎯': 'target', '🔬': 'target', '🏓': 'target', '📸': 'target',
  '⚡': 'bolt', '🚀': 'bolt', '✨': 'bolt',
  '🔌': 'link', '🔗': 'link', '🛤️': 'link', '▶': 'link',
  '📦': 'cube', '🖥️': 'server', '🏢': 'server', '🗄️': 'server', '💾': 'server',
  '🔒': 'shield', '⚠️': 'shield', '🔔': 'bell', '📧': 'bell',
  '🔧': 'tool', '🛠️': 'tool', '⚙️': 'tool', '🔍': 'tool',
  '🗺️': 'route', '🧠': 'route', '📏': 'route', '⚖️': 'route',
  '👥': 'users',
};

const glyphPaths: Record<string, string> = {
  chart: 'M3 3v18h18M6 16l4-5 4 3 5-7',
  list: 'M8 6h12M8 12h12M8 18h12M3 6h.01M3 12h.01M3 18h.01',
  check: 'M4 12l5 5L20 6',
  signal: 'M3 18a13 13 0 0 1 18 0M6 18a9 9 0 0 1 12 0M9 18a5 5 0 0 1 6 0M12 21v.01',
  globe: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20M2 12h20M12 2c-5 5-5 15 0 20M12 2c5 5 5 15 0 20',
  target: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20M12 6a6 6 0 1 0 0 12a6 6 0 1 0 0-12M12 11v2',
  bolt: 'M13 2L4 13h7l-1 9 10-12h-7l0-8Z',
  link: 'M10 13a5 5 0 0 0 7 .4l2-2a5 5 0 0 0-7-7l-1.1 1.1M14 11a5 5 0 0 0-7-.4l-2 2a5 5 0 0 0 7 7l1.1-1.1',
  cube: 'M12 2l9 5v10l-9 5-9-5V7l9-5ZM3 7l9 5 9-5M12 12v10',
  server: 'M4 3h16v7H4V3ZM4 14h16v7H4v-7ZM7 7h.01M7 18h.01M11 7h6M11 18h6',
  shield: 'M12 2l9 4v6c0 5-3.5 8-9 10-5.5-2-9-5-9-10V6l9-4ZM9 12l2 2 4-4',
  bell: 'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3ZM10 21h4',
  tool: 'M13 3a5 5 0 0 0-4 7L3 16l5 5 6-6a5 5 0 0 0 7-4l-4 2-3-3 2-4a5 5 0 0 0-3-3Z',
  route: 'M4 19a2 2 0 1 0 0-4a2 2 0 1 0 0 4ZM20 9a2 2 0 1 0 0-4a2 2 0 1 0 0 4ZM4 15V8a4 4 0 0 1 4-4h8M6 17h10a4 4 0 0 0 4-4V9',
  users: 'M9 12a4 4 0 1 0 0-8a4 4 0 1 0 0 8ZM2 20v-2a7 7 0 0 1 14 0v2M17 4a4 4 0 0 1 0 8M18 15a6 6 0 0 1 4 5',
};

function NavGlyph({ symbol }: { symbol: string }) {
  return <span className="menu-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"><path d={glyphPaths[glyphBySymbol[symbol] || 'cube']} /></svg></span>;
}

interface NavigationProps {
  onLogout: () => void;
}

export const Navigation = ({ onLogout }: NavigationProps) => {
  const user = (() => {
    try {
      const storedUser = localStorage.getItem('user');
      return storedUser ? JSON.parse(storedUser) : {};
    } catch {
      return {};
    }
  })();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const activeSection = Object.entries(sectionRoutes).find(([, routes]) =>
    routes.some(path => location.pathname === `/app${path}` || location.pathname.startsWith(`/app${path}/`))
  )?.[0];
  const [focusedSection, setFocusedSection] = useState<string | undefined>(activeSection);

  // Keep every section closed until the user opens it.
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: false,
    monitoring: false,
    internetAccess: false,
    performance: false,
    protocols: false,
    diagnostics: false,
    routing: false,
    analytics: false,
  });

  const isActive = (path: string) => {
    const currentPath = location.pathname.replace(/\/$/, '') || '/';
    const targetPath = path === '/' ? '/app' : `/app${path}`;

    return path === '/'
      ? currentPath === targetPath
      : currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
  };

  const toggleSection = (section: string) => {
    setFocusedSection(expandedSections[section] ? undefined : section);
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    setFocusedSection(activeSection);
  }, [activeSection]);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname, location.hash]);

  return (
    <>
      <button
        type="button"
        className="mobile-nav-toggle"
        onClick={() => setIsMobileOpen(prev => !prev)}
        aria-label={isMobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={isMobileOpen}
      >
        <span aria-hidden="true">{isMobileOpen ? '×' : '☰'}</span>
      </button>

      {isMobileOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          onClick={() => setIsMobileOpen(false)}
          aria-label="Close navigation menu"
        />
      )}

      <nav
        className={`noc-sidebar ${isMobileOpen ? 'mobile-open' : ''}`}
        aria-label="Primary navigation"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('a')) {
            setIsMobileOpen(false);
            setFocusedSection((event.target as HTMLElement).closest<HTMLElement>('[data-section]')?.dataset.section);
          }
        }}
      >
      {/* Logo Section */}
      <div className="sidebar-logo">
        <div className="nav-logo-icon">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2"/>
            <circle cx="16" cy="16" r="8" fill="currentColor"/>
            <circle cx="16" cy="16" r="4" fill="var(--bg-sidebar)"/>
          </svg>
        </div>
        <div className="nav-logo-text">
          <span className="logo-name">NetMon</span>
          <span className="logo-subtitle">PT. Bisnis Digital</span>
        </div>
      </div>

      {/* Navigation Menu */}
      <div className="sidebar-menu">
        {/* OVERVIEW Section */}
        <div className="menu-section" data-section="overview" data-focused={focusedSection === 'overview' || undefined}>
          <button type="button" className="menu-label collapsible" aria-expanded={expandedSections.overview} onClick={() => toggleSection('overview')}>
            <span>OVERVIEW</span><svg className="menu-chevron" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="m4 5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {expandedSections.overview && (
            <>
              <Link to="/app/" className={`menu-item ${isActive('/') ? 'active' : ''}`} aria-current={isActive('/') ? 'page' : undefined}>
                <NavGlyph symbol="📊" />
                <span className="menu-text">Dashboard</span>
              </Link>
              <Link to="/app/realtime" className={`menu-item ${isActive('/realtime') ? 'active' : ''}`} aria-current={isActive('/realtime') ? 'page' : undefined}>
                <NavGlyph symbol="📡" />
                <span className="menu-text">Real-time Monitor</span>
              </Link>
            </>
          )}
        </div>

        {/* MONITORING Section */}
        <div className="menu-section" data-section="monitoring" data-focused={focusedSection === 'monitoring' || undefined}>
          <button type="button" className="menu-label collapsible" aria-expanded={expandedSections.monitoring} onClick={() => toggleSection('monitoring')}>
            <span>MONITORING</span><svg className="menu-chevron" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="m4 5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {expandedSections.monitoring && (
            <>
              <Link to="/app/targets" className={`menu-item ${isActive('/targets') ? 'active' : ''}`} aria-current={isActive('/targets') ? 'page' : undefined}>
                <NavGlyph symbol="🎯" />
                <span className="menu-text">Targets</span>
              </Link>
              <Link to="/app/monitors" className={`menu-item ${isActive('/monitors') ? 'active' : ''}`} aria-current={isActive('/monitors') ? 'page' : undefined}>
                <NavGlyph symbol="📈" />
                <span className="menu-text">Monitors</span>
              </Link>
              <Link to="/app/probes" className={`menu-item ${isActive('/probes') ? 'active' : ''}`} aria-current={isActive('/probes') ? 'page' : undefined}>
                <NavGlyph symbol="🔬" />
                <span className="menu-text">Probes</span>
              </Link>
              <Link to="/app/website-monitor" className={`menu-item ${isActive('/website-monitor') ? 'active' : ''}`} aria-current={isActive('/website-monitor') ? 'page' : undefined}>
                <NavGlyph symbol="🌐" />
                <span className="menu-text">Website Monitor</span>
              </Link>
            </>
          )}
        </div>

        {/* INTERNET ACCESS CHECKS */}
        <div className="menu-section" data-section="internetAccess" data-focused={focusedSection === 'internetAccess' || undefined}>
          <button type="button" className="menu-label collapsible" aria-expanded={expandedSections.internetAccess} onClick={() => toggleSection('internetAccess')}>
            <span>INTERNET ACCESS CHECKS</span><svg className="menu-chevron" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="m4 5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {expandedSections.internetAccess && accessCategories.filter(item => item.id !== 'routes').map(item => <Link key={item.id} to={`/app/monitoring/${item.id}`} className={`menu-item ${isActive(`/monitoring/${item.id}`) ? 'active' : ''}`} aria-current={isActive(`/monitoring/${item.id}`) ? 'page' : undefined}>
            <NavGlyph symbol="🌐" />
            <span className="menu-text">{item.title}</span>
          </Link>)}
        </div>

        {/* NETWORK PERFORMANCE Section */}
        <div className="menu-section" data-section="performance" data-focused={focusedSection === 'performance' || undefined}>
          <button type="button" className="menu-label collapsible" aria-expanded={expandedSections.performance} onClick={() => toggleSection('performance')}>
            <span>NETWORK PERFORMANCE</span><svg className="menu-chevron" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="m4 5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {expandedSections.performance && (
            <>
              <Link to="/app/latency" className={`menu-item ${isActive('/latency') ? 'active' : ''}`} aria-current={isActive('/latency') ? 'page' : undefined}>
                <NavGlyph symbol="⚡" />
                <span className="menu-text">Latency Monitoring</span>
              </Link>
              <Link to="/app/network-performance" className={`menu-item ${isActive('/network-performance') ? 'active' : ''}`} aria-current={isActive('/network-performance') ? 'page' : undefined}>
                <NavGlyph symbol="🚀" />
                <span className="menu-text">Bandwidth Testing</span>
              </Link>
              <Link to="/app/throughput" className={`menu-item ${isActive('/throughput') ? 'active' : ''}`} aria-current={isActive('/throughput') ? 'page' : undefined}>
                <NavGlyph symbol="📊" />
                <span className="menu-text">Throughput Analysis</span>
              </Link>
              <Link to="/app/quality" className={`menu-item ${isActive('/quality') ? 'active' : ''}`} aria-current={isActive('/quality') ? 'page' : undefined}>
                <NavGlyph symbol="✨" />
                <span className="menu-text">Quality Analysis</span>
              </Link>
              <Link to="/app/sla" className={`menu-item ${isActive('/sla') ? 'active' : ''}`} aria-current={isActive('/sla') ? 'page' : undefined}>
                <NavGlyph symbol="📋" />
                <span className="menu-text">SLA Monitoring</span>
              </Link>
            </>
          )}
        </div>

        {/* PROTOCOL MONITORING Section */}
        <div className="menu-section" data-section="protocols" data-focused={focusedSection === 'protocols' || undefined}>
          <button type="button" className="menu-label collapsible" aria-expanded={expandedSections.protocols} onClick={() => toggleSection('protocols')}>
            <span>PROTOCOL MONITORING</span><svg className="menu-chevron" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="m4 5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {expandedSections.protocols && (
            <>
              <Link to="/app/icmp" className={`menu-item ${isActive('/icmp') ? 'active' : ''}`} aria-current={isActive('/icmp') ? 'page' : undefined}>
                <NavGlyph symbol="🏓" />
                <span className="menu-text">ICMP / Ping</span>
              </Link>
              <Link to="/app/tcp" className={`menu-item ${isActive('/tcp') ? 'active' : ''}`} aria-current={isActive('/tcp') ? 'page' : undefined}>
                <NavGlyph symbol="🔌" />
                <span className="menu-text">TCP Monitoring</span>
              </Link>
              <Link to="/app/udp" className={`menu-item ${isActive('/udp') ? 'active' : ''}`} aria-current={isActive('/udp') ? 'page' : undefined}>
                <NavGlyph symbol="📦" />
                <span className="menu-text">UDP Monitoring</span>
              </Link>
              <Link to="/app/dns-servers" className={`menu-item ${isActive('/dns-servers') ? 'active' : ''}`} aria-current={isActive('/dns-servers') ? 'page' : undefined}>
                <NavGlyph symbol="🌍" />
                <span className="menu-text">DNS Monitoring</span>
              </Link>
              <Link to="/app/http-monitoring" className={`menu-item ${isActive('/http-monitoring') ? 'active' : ''}`} aria-current={isActive('/http-monitoring') ? 'page' : undefined}>
                <NavGlyph symbol="🌐" />
                <span className="menu-text">HTTP/HTTPS</span>
              </Link>
              <Link to="/app/tls-certificates" className={`menu-item ${isActive('/tls-certificates') ? 'active' : ''}`} aria-current={isActive('/tls-certificates') ? 'page' : undefined}>
                <NavGlyph symbol="🔒" />
                <span className="menu-text">TLS/Certificates</span>
              </Link>
            </>
          )}
        </div>

        {/* NETWORK TROUBLESHOOTING Section */}
        <div className="menu-section" data-section="diagnostics" data-focused={focusedSection === 'diagnostics' || undefined}>
          <button type="button" className="menu-label collapsible" aria-expanded={expandedSections.diagnostics} onClick={() => toggleSection('diagnostics')}>
            <span>NETWORK TROUBLESHOOTING</span><svg className="menu-chevron" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="m4 5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {expandedSections.diagnostics && (
            <>
              <Link to="/app/ping-tools" className={`menu-item ${isActive('/ping-tools') ? 'active' : ''}`} aria-current={isActive('/ping-tools') ? 'page' : undefined}>
                <NavGlyph symbol="🏓" />
                <span className="menu-text">Ping Tools</span>
              </Link>
              <Link to="/app/mtu-discovery" className={`menu-item ${isActive('/mtu-discovery') ? 'active' : ''}`} aria-current={isActive('/mtu-discovery') ? 'page' : undefined}>
                <NavGlyph symbol="📏" />
                <span className="menu-text">MTU Discovery</span>
              </Link>
              <Link to="/app/packet-capture" className={`menu-item ${isActive('/packet-capture') ? 'active' : ''}`} aria-current={isActive('/packet-capture') ? 'page' : undefined}>
                <NavGlyph symbol="📸" />
                <span className="menu-text">Packet Capture</span>
              </Link>
              <Link to="/app/network-tools" className={`menu-item ${isActive('/network-tools') ? 'active' : ''}`} aria-current={isActive('/network-tools') ? 'page' : undefined}>
                <NavGlyph symbol="🛠️" />
                <span className="menu-text">Network Tools</span>
              </Link>
            </>
          )}
        </div>

        {/* ROUTING & BGP Section */}
        <div className="menu-section" data-section="routing" data-focused={focusedSection === 'routing' || undefined}>
          <button type="button" className="menu-label collapsible" aria-expanded={expandedSections.routing} onClick={() => toggleSection('routing')}>
            <span>ROUTING & BGP</span><svg className="menu-chevron" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="m4 5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {expandedSections.routing && (
            <>
              <Link to="/app/monitoring/routes" className={`menu-item ${isActive('/monitoring/routes') ? 'active' : ''}`} aria-current={isActive('/monitoring/routes') ? 'page' : undefined}>
                <NavGlyph symbol="🗺️" />
                <span className="menu-text">Traceroute / BGP Lookup</span>
              </Link>
              <Link to="/app/traceroute" className={`menu-item ${isActive('/traceroute') ? 'active' : ''}`} aria-current={isActive('/traceroute') ? 'page' : undefined}>
                <NavGlyph symbol="🗺️" />
                <span className="menu-text">Traceroute Tool</span>
              </Link>
              <Link to="/app/as-path" className={`menu-item ${isActive('/as-path') ? 'active' : ''}`} aria-current={isActive('/as-path') ? 'page' : undefined}>
                <NavGlyph symbol="🌐" />
                <span className="menu-text">AS Path Analysis</span>
              </Link>
              <Link to="/app/route-monitoring" className={`menu-item ${isActive('/route-monitoring') ? 'active' : ''}`} aria-current={isActive('/route-monitoring') ? 'page' : undefined}>
                <NavGlyph symbol="🛤️" />
                <span className="menu-text">Route Monitoring</span>
              </Link>
              <Link to="/app/bgp-intelligence" className={`menu-item ${isActive('/bgp-intelligence') ? 'active' : ''}`} aria-current={isActive('/bgp-intelligence') ? 'page' : undefined}>
                <NavGlyph symbol="🧠" />
                <span className="menu-text">BGP Intelligence</span>
              </Link>
              <Link to="/app/routing-history" className={`menu-item ${isActive('/routing-history') ? 'active' : ''}`} aria-current={isActive('/routing-history') ? 'page' : undefined}>
                <NavGlyph symbol="📚" />
                <span className="menu-text">Routing History</span>
              </Link>
            </>
          )}
        </div>

        {/* ANALYTICS & REPORTS Section */}
        <div className="menu-section" data-section="analytics" data-focused={focusedSection === 'analytics' || undefined}>
          <button type="button" className="menu-label collapsible" aria-expanded={expandedSections.analytics} onClick={() => toggleSection('analytics')}>
            <span>ANALYTICS</span><svg className="menu-chevron" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="m4 5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {expandedSections.analytics && (
            <>
              <Link to="/app/historical" className={`menu-item ${isActive('/historical') ? 'active' : ''}`} aria-current={isActive('/historical') ? 'page' : undefined}>
                <NavGlyph symbol="📊" />
                <span className="menu-text">Historical Analysis</span>
              </Link>
              <Link to="/app/trends" className={`menu-item ${isActive('/trends') ? 'active' : ''}`} aria-current={isActive('/trends') ? 'page' : undefined}>
                <NavGlyph symbol="📈" />
                <span className="menu-text">Performance Trends</span>
              </Link>
              <Link to="/app/availability" className={`menu-item ${isActive('/availability') ? 'active' : ''}`} aria-current={isActive('/availability') ? 'page' : undefined}>
                <NavGlyph symbol="✅" />
                <span className="menu-text">Availability Reports</span>
              </Link>
              <Link to="/app/capacity-planning" className={`menu-item ${isActive('/capacity-planning') ? 'active' : ''}`} aria-current={isActive('/capacity-planning') ? 'page' : undefined}>
                <NavGlyph symbol="📊" />
                <span className="menu-text">Capacity Planning</span>
              </Link>
              <Link to="/app/comparative" className={`menu-item ${isActive('/comparative') ? 'active' : ''}`} aria-current={isActive('/comparative') ? 'page' : undefined}>
                <NavGlyph symbol="⚖️" />
                <span className="menu-text">Comparative Analysis</span>
              </Link>
            </>
          )}
        </div>

      </div>

      {/* User Profile Section */}
      <div className="sidebar-user">
        <div className="user-avatar">
          <span className="avatar-initials">
            {(user.username || 'DI').substring(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="user-details">
          <div className="nav-user-name">{user.username || 'Dion IPe'}</div>
          <div className="user-role">Admin</div>
        </div>
        <button className="user-logout" onClick={onLogout} title="Logout">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 14H3C2.44772 14 2 13.5523 2 13V3C2 2.44772 2.44772 2 3 2H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M11 11L14 8L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      </nav>
    </>
  );
};
