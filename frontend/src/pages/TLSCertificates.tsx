import { UIIcon } from '../components/UIIcon';
import { useEffect, useState, useCallback } from 'react';
import './TLSCertificates.css';

interface Certificate {
  id: string;
  domain: string;
  issuer: string;
  issued_date: string;
  expiry_date: string;
  days_remaining: number;
  status: 'valid' | 'expiring' | 'expired';
  algorithms: string;
  public_key_size: number;
}

export const TLSCertificates = () => {
  const defaultDomains = [
    'google.com',
    'cloudflare.com',
    'github.com',
    'wikipedia.org',
    'amazon.com',
  ];

  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customDomain, setCustomDomain] = useState('');
  const [displayMode, setDisplayMode] = useState<'grid' | 'list'>('grid');

  const checkCertificate = useCallback(async (domain: string) => {
    try {
      const response = await fetch('http://localhost:8080/api/v1/tools/tls-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error checking certificate:', error);
    }
    return null;
  }, []);

  const checkAllCertificates = useCallback(async () => {
    setIsLoading(true);
    const results: Certificate[] = [];

    for (const domain of defaultDomains) {
      const cert = await checkCertificate(domain);
      if (cert) {
        results.push(cert);
      }
    }

    setCertificates(results);
    setIsLoading(false);
  }, [checkCertificate]);

  useEffect(() => {
    checkAllCertificates();
    const interval = setInterval(checkAllCertificates, 3600000); // 1 hour
    return () => clearInterval(interval);
  }, [checkAllCertificates]);

  const addCustomDomain = async () => {
    if (customDomain) {
      const cert = await checkCertificate(customDomain);
      if (cert) {
        setCertificates([...certificates, cert]);
        setCustomDomain('');
      }
    }
  };

  const removeCertificate = (id: string) => {
    setCertificates(certificates.filter(c => c.id !== id));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid':
        return '#10B981';
      case 'expiring':
        return '#F59E0B';
      case 'expired':
        return '#EF4444';
      default:
        return '#8B5CF6';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return '✅';
      case 'expiring':
        return '⚠️';
      case 'expired':
        return '❌';
      default:
        return '❓';
    }
  };

  const validCount = certificates.filter(c => c.status === 'valid').length;
  const expiringCount = certificates.filter(c => c.status === 'expiring').length;
  const expiredCount = certificates.filter(c => c.status === 'expired').length;

  return (
    <div className="tls-certificates">
      <div className="page-header">
        <div>
          <h1>TLS Certificates</h1>
          <p className="page-description">Monitor SSL/TLS certificate validity and expiration</p>
        </div>
        <button className="btn-refresh" onClick={checkAllCertificates} disabled={isLoading}>
          {isLoading ? <><UIIcon symbol="🔄" /> Checking...</> : <><UIIcon symbol="🔄" /> Check Now</>}
        </button>
      </div>

      <div className="status-summary">
        <div className="status-card">
          <div className="status-number" style={{ color: '#10B981' }}><UIIcon symbol="✅" /> {validCount}</div>
          <div className="status-label">Valid</div>
        </div>
        <div className="status-card">
          <div className="status-number" style={{ color: '#F59E0B' }}><UIIcon symbol="⚠️" /> {expiringCount}</div>
          <div className="status-label">Expiring Soon</div>
        </div>
        <div className="status-card">
          <div className="status-number" style={{ color: '#EF4444' }}><UIIcon symbol="❌" /> {expiredCount}</div>
          <div className="status-label">Expired</div>
        </div>
        <div className="status-card">
          <div className="status-number"><UIIcon symbol="📊" /> {certificates.length}</div>
          <div className="status-label">Total</div>
        </div>
      </div>

      <section className="add-domain-section">
        <h2>Add Domain</h2>
        <div className="add-domain-form">
          <input type="text" placeholder="example.com" value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addCustomDomain()} />
          <button onClick={addCustomDomain} className="btn-add">Check Certificate</button>
        </div>
      </section>

      <section className="certificates-section">
        <div className="section-header">
          <h2>Certificates ({certificates.length})</h2>
          <div className="view-toggle">
            <button className={`toggle-btn ${displayMode === 'grid' ? 'active' : ''}`} onClick={() => setDisplayMode('grid')}>⊞ Grid</button>
            <button className={`toggle-btn ${displayMode === 'list' ? 'active' : ''}`} onClick={() => setDisplayMode('list')}>≡ List</button>
          </div>
        </div>

        {certificates.length === 0 ? (
          <div className="empty-state"><p>No certificates checked yet.</p></div>
        ) : displayMode === 'grid' ? (
          <div className="certificates-grid">
            {certificates.map((cert) => (
              <div key={cert.id} className="cert-card" style={{ borderLeftColor: getStatusColor(cert.status) }}>
                <div className="card-header">
                  <div className="domain-info">
                    <h3>{cert.domain}</h3>
                    <p className="issuer">{cert.issuer}</p>
                  </div>
                  <div className="status-badge" style={{ backgroundColor: getStatusColor(cert.status) }}>
                    <span className="status-icon">{<UIIcon symbol={getStatusIcon(cert.status)} />}</span>
                  </div>
                </div>

                <div className="card-body">
                  <div className="cert-dates">
                    <div className="date-item">
                      <span className="label">Issued:</span>
                      <span className="value">{cert.issued_date}</span>
                    </div>
                    <div className="date-item">
                      <span className="label">Expires:</span>
                      <span className={`value ${cert.status}`}>{cert.expiry_date}</span>
                    </div>
                  </div>

                  <div className="expiry-countdown">
                    <div className="countdown-value" style={{ color: getStatusColor(cert.status) }}>
                      {cert.days_remaining}
                    </div>
                    <div className="countdown-label">days remaining</div>
                  </div>

                  <div className="cert-details">
                    <div className="detail">
                      <span className="label">Algorithm:</span>
                      <span className="value">{cert.algorithms}</span>
                    </div>
                    <div className="detail">
                      <span className="label">Key Size:</span>
                      <span className="value">{cert.public_key_size} bits</span>
                    </div>
                  </div>
                </div>

                {certificates.length > defaultDomains.length && (
                  <button className="btn-remove" onClick={() => removeCertificate(cert.id)}>Remove</button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="certificates-list">
            <div className="list-header">
              <div className="col col-domain">Domain</div>
              <div className="col col-issuer">Issuer</div>
              <div className="col col-expires">Expiry Date</div>
              <div className="col col-days">Days</div>
              <div className="col col-status">Status</div>
              <div className="col col-actions">Actions</div>
            </div>
            {certificates.map((cert) => (
              <div key={cert.id} className="list-row">
                <div className="col col-domain">{cert.domain}</div>
                <div className="col col-issuer">{cert.issuer}</div>
                <div className="col col-expires">{cert.expiry_date}</div>
                <div className="col col-days" style={{ color: getStatusColor(cert.status) }}>
                  {cert.days_remaining}
                </div>
                <div className="col col-status">
                  <span className="status-badge-list" style={{ backgroundColor: getStatusColor(cert.status) }}>
                    {<UIIcon symbol={getStatusIcon(cert.status)} />} {cert.status}
                  </span>
                </div>
                <div className="col col-actions">
                  {certificates.length > defaultDomains.length && (
                    <button className="btn-remove-small" onClick={() => removeCertificate(cert.id)}>✕</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
