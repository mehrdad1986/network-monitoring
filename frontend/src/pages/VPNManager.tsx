import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UIIcon } from '../components/UIIcon';
import './VPNManager.css';

const protocols = [
  { id: 'openvpn', name: 'OpenVPN', description: 'Create or import an OpenVPN client profile.', icon: 'shield' },
  { id: 'wireguard', name: 'WireGuard', description: 'Create or import a WireGuard peer configuration.', icon: 'route' },
  { id: 'v2rayng', name: 'V2RayNG', description: 'Create or import a V2RayNG subscription or server link.', icon: 'link' },
  { id: 'outline', name: 'Outline VPN', description: 'Create or import an Outline access key.', icon: 'shield' },
  { id: 'amnezia', name: 'Amnezia VPN', description: 'Create or import an Amnezia connection configuration.', icon: 'route' },
  { id: 'hiddify', name: 'Hiddify', description: 'Create or import a Hiddify subscription link.', icon: 'link' },
];

export default function VPNManager() {
  const [selectedProtocol, setSelectedProtocol] = useState('');
  const selected = protocols.find(protocol => protocol.id === selectedProtocol);

  return (
    <main className="vpn-manager vpn-config-page">
      <header className="page-header">
        <div>
          <div className="page-breadcrumb">VPN CONFIGURATION</div>
          <h1>Create VPN Subscription / Config</h1>
          <p className="page-description">Choose the client format you want to configure.</p>
        </div>
        <Link to="/dashboard" className="vpn-back-link" aria-label="Back to dashboard">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5m7 7-7-7 7-7" /></svg>
        </Link>
      </header>
      <section className="vpn-protocol-grid" aria-label="Choose a VPN protocol">
        {protocols.map(protocol => (
          <button
            className={`vpn-protocol-card${selectedProtocol === protocol.id ? ' selected' : ''}`}
            type="button"
            key={protocol.id}
            aria-pressed={selectedProtocol === protocol.id}
            onClick={() => setSelectedProtocol(protocol.id)}
          >
            <span className="vpn-protocol-icon"><UIIcon symbol={protocol.icon} /></span>
            <span className="vpn-protocol-name">{protocol.name}</span>
            <span className="vpn-protocol-description">{protocol.description}</span>
            <span className="vpn-protocol-action">{selectedProtocol === protocol.id ? 'Selected' : 'Choose protocol'}</span>
          </button>
        ))}
      </section>
      {selected && <p className="vpn-protocol-selection" role="status">{selected.name} selected.</p>}
    </main>
  );
}
