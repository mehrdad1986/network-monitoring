import { useState } from 'react';
import './CloudflareRadarMenu.css';

interface RadarSection {
  label: string;
  icon: string;
  children?: { label: string; path?: string; external?: boolean }[];
}

const radarSections: RadarSection[] = [
  {
    label: 'Traffic',
    icon: '📊',
    children: [
      { label: 'Overview', path: '/radar/traffic' },
      { label: 'Adoption & Usage', path: '/radar/adoption' },
      { label: 'AI Insights', path: '/radar/ai-insights' },
      { label: 'Bots', path: '/radar/bots' },
      { label: 'Traffic', path: '/radar/traffic-detail' },
      { label: 'Directory', path: '/radar/directory' },
    ],
  },
  {
    label: 'Security',
    icon: '🛡️',
    children: [
      { label: 'Application Layer', path: '/radar/security-app' },
      { label: 'Network Layer', path: '/radar/security-net' },
      { label: 'Email', path: '/radar/security-email' },
      { label: 'Post-Quantum Encryption', path: '/radar/post-quantum' },
      { label: 'Certificate Transparency', path: '/radar/cert-transparency' },
      { label: 'Key Transparency', path: '/radar/key-transparency' },
    ],
  },
  {
    label: 'Connectivity',
    icon: '🌐',
    children: [
      { label: 'Internet Quality', path: '/radar/internet-quality' },
      { label: 'Outage Center', path: '/radar/outages' },
      { label: 'Cloud Observatory', path: '/radar/cloud-observatory' },
      { label: 'IP Address Information', path: '/radar/ip-info' },
    ],
  },
  {
    label: 'Routing',
    icon: '🛤️',
    children: [
      { label: 'Overview', path: '/radar/routing' },
      { label: 'RPKI', path: '/radar/rpki' },
      { label: 'Anomalies', path: '/radar/anomalies' },
      { label: 'ASPA Validation', path: '/radar/aspa' },
      { label: 'MRT Explorer', path: '/radar/mrt-explorer' },
    ],
  },
  {
    label: 'DNS',
    icon: '🔍',
    children: [
      { label: '1.1.1.1 Resolver', path: '/radar/dns-resolver' },
      { label: 'AS112 Project', path: '/radar/as112' },
      { label: 'Top-Level Domains', path: '/radar/tld' },
      { label: 'Domain Rankings', path: '/radar/domain-rankings' },
      { label: 'Domain Information', path: '/radar/domain-info' },
      { label: 'Domain Categorization', path: '/radar/domain-categories' },
    ],
  },
  {
    label: 'Tools',
    icon: '🛠️',
    children: [
      { label: 'Data Explorer', path: '/radar/data-explorer' },
      { label: 'URL Scanner', path: '/radar/url-scanner' },
      { label: 'Network Quality Test', path: '/radar/quality-test' },
    ],
  },
  {
    label: 'Reports',
    icon: '📄',
    children: [],
  },
  {
    label: 'API',
    icon: '⚡',
    children: [
      { label: 'Specification', path: '/radar/api-spec' },
      { label: 'Documentation', path: '/radar/api-docs' },
      { label: 'MCP Server', path: '/radar/mcp-server' },
    ],
  },
  {
    label: 'Resources',
    icon: '📚',
    children: [
      { label: 'About', path: '/radar/about' },
      { label: 'Press', path: '/radar/press' },
      { label: 'Glossary', path: '/radar/glossary' },
      { label: 'Changelog', path: '/radar/changelog' },
      { label: 'Release Notes', path: '/radar/release-notes' },
    ],
  },
];

export const CloudflareRadarMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (label: string) => {
    setExpandedSections(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <>
      <button
        className={`radar-hamburger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Cloudflare Radar Menu"
      >
        <span className="hamburger-line" />
        <span className="hamburger-line" />
        <span className="hamburger-line" />
      </button>

      {isOpen && <div className="radar-overlay" onClick={() => setIsOpen(false)} />}

      <div className={`radar-menu-panel ${isOpen ? 'open' : ''}`}>
        <div className="radar-menu-header">
          <div className="radar-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="var(--accent-primary)" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="6" stroke="var(--accent-primary)" strokeWidth="1.5" strokeDasharray="3 3" />
              <circle cx="12" cy="12" r="2" fill="var(--accent-primary)" />
            </svg>
            <span className="radar-title">Cloudflare Radar</span>
          </div>
          <div className="radar-subtitle">Traffic in Iran</div>
          <button className="radar-close" onClick={() => setIsOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="radar-menu-body">
          {radarSections.map((section) => (
            <div key={section.label} className="radar-section">
              <button
                className={`radar-section-header ${expandedSections[section.label] ? 'expanded' : ''}`}
                onClick={() => toggleSection(section.label)}
              >
                <span className="radar-section-icon">{section.icon}</span>
                <span className="radar-section-label">{section.label}</span>
                {section.children && section.children.length > 0 && (
                  <svg className="radar-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              {section.children && section.children.length > 0 && expandedSections[section.label] && (
                <div className="radar-section-children">
                  {section.children.map((child) => (
                    <a
                      key={child.label}
                      href={child.path || '#'}
                      className="radar-child-item"
                      onClick={(e) => {
                        e.preventDefault();
                        setIsOpen(false);
                      }}
                    >
                      <span className="radar-child-label">{child.label}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="radar-menu-footer">
          <div className="radar-region">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1" />
              <path d="M1 7h12M7 1c1.5 2 2.5 4 2.5 6s-1 4-2.5 6M7 1c-1.5 2-2.5 4-2.5 6s1 4 2.5 6" stroke="currentColor" strokeWidth="1" />
            </svg>
            <span>Iran (IR)</span>
          </div>
        </div>
      </div>
    </>
  );
};
