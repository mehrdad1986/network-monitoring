import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiService from '../services/api';
import type { Target } from '../types';
import './TargetsList.css';

export const TargetsList = () => {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'host',
    address: '',
    port: '',
    description: ''
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadTargets = async () => {
    try {
      setLoading(true);
      const data = await apiService.getTargets();
      setTargets(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load targets');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError('');
    if (!formData.name.trim() || !formData.address.trim()) { setFormError('Name and address are required.'); return; }
    if (formData.port && (!/^\d+$/.test(formData.port) || Number(formData.port) < 1 || Number(formData.port) > 65535)) { setFormError('Port must be between 1 and 65535.'); return; }
    setSubmitting(true);
    try {
      const targetData: any = {
        name: formData.name.trim(),
        type: formData.type,
        address: formData.address.trim(),
        description: formData.description
      };

      if (formData.port) {
        targetData.port = parseInt(formData.port);
      }

      await apiService.createTarget(targetData);
      setShowModal(false);
      setFormData({ name: '', type: 'host', address: '', port: '', description: '' });
      loadTargets();
    } catch (err: any) {
      console.error('Failed to create target:', err);
      setFormError(err.message || 'Failed to create target');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    loadTargets();
    const interval = setInterval(loadTargets, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && targets.length === 0 && !showModal) {
    return <div className="targets-list"><div className="loading">Loading targets...</div></div>;
  }

  return (
    <div className="targets-list">
      <div className="list-header">
        <h1>Monitoring Targets</h1>
        <div className="list-actions">
          <button className="btn-primary" onClick={() => { setFormError(''); setShowModal(true); }}>+ Add Target</button>
        </div>
      </div>

      {error && <div className="error-banner" role="alert">{error} <button onClick={loadTargets}>Retry</button></div>}

      {error && targets.length === 0 ? null : targets.length === 0 ? (
        <div className="empty-state">
          <p>No targets configured yet.</p>
          <button className="btn-primary" onClick={() => { setFormError(''); setShowModal(true); }}>Create Your First Target</button>
        </div>
      ) : (
        <div className="targets-grid">
          {targets.map(target => (
            <Link key={target.id} to={`/app/targets/${target.id}`} className="target-card">
              <div className="target-card-header">
                <h3>{target.name}</h3>
                <span className={`status-indicator ${target.enabled ? 'enabled' : 'disabled'}`}>
                  {target.enabled ? '●' : '○'}
                </span>
              </div>
              <div className="target-card-body">
                <div className="target-address">{target.address}</div>
                {target.port && <div className="target-port">Port: {target.port}</div>}
                <div className="target-type">{target.type}</div>
              </div>
              {target.description && (
                <div className="target-card-footer">
                  {target.description}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => { if (!submitting) setShowModal(false); }}>
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="add-target-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 id="add-target-title">Add New Target</h2>
              <button className="modal-close" onClick={() => { if (!submitting) setShowModal(false); }}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              {formError && <p role="alert">{formError}</p>}
              <div className="form-group">
                <label htmlFor="target-name">Name *</label>
                <input
                  type="text" id="target-name" maxLength={120}
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., Production Server"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="target-type">Type *</label>
                <select id="target-type"
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  required
                >
                  <option value="host">Host</option>
                  <option value="server">Server</option>
                  <option value="router">Router</option>
                  <option value="switch">Switch</option>
                  <option value="firewall">Firewall</option>
                  <option value="load_balancer">Load Balancer</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="target-address">Address *</label>
                <input
                  type="text" id="target-address" maxLength={253}
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="e.g., 192.168.1.1 or example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="target-port">Port (optional)</label>
                <input
                  type="number" id="target-port" min="1" max="65535" step="1"
                  value={formData.port}
                  onChange={(e) => setFormData({...formData, port: e.target.value})}
                  placeholder="e.g., 80, 443, 3306"
                />
              </div>

              <div className="form-group">
                <label htmlFor="target-description">Description</label>
                <textarea id="target-description" maxLength={2000}
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { if (!submitting) setShowModal(false); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Target'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
