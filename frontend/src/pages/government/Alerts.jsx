import { useState, useEffect } from 'react';
import api from '../../api/axios';

export default function GovAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', message: '', severity: 'info', region: 'National' });

  const load = () => api.get('/government/alerts').then(r => setAlerts(r.data));
  useEffect(load, []);

  const issue = async (e) => {
    e.preventDefault();
    await api.post('/government/alerts', form);
    load(); setShowModal(false);
    setForm({ title: '', message: '', severity: 'info', region: 'National' });
  };

  const severityConfig = {
    info: { icon: 'ℹ️', badge: 'info', bg: '#eff6ff', border: '#bfdbfe' },
    warning: { icon: '⚠️', badge: 'warning', bg: '#fffbeb', border: '#fde68a' },
    critical: { icon: '🚨', badge: 'danger', bg: '#fef2f2', border: '#fecaca' },
  };

  return (
    <div>
      <div className="flex-between mb-4">
        <div />
        <button className="btn btn-danger" onClick={() => setShowModal(true)}>🚨 Issue Health Alert</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {alerts.map(a => {
          const cfg = severityConfig[a.severity] || severityConfig.info;
          return (
            <div key={a.id} style={{ background: cfg.bg, border: `2px solid ${cfg.border}`, borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 20 }}>{cfg.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>{a.title}</span>
                    <span className={`badge badge-${cfg.badge}`}>{a.severity}</span>
                    <span className="badge badge-gray">{a.region}</span>
                  </div>
                  <p style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5 }}>{a.message}</p>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                    Issued: {new Date(a.created_at).toLocaleString('en-GB')}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {!alerts.length && (
          <div className="card"><div className="empty-state"><div className="empty-icon">🔔</div><p>No health alerts issued</p></div></div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h3>Issue Public Health Alert</h3><button className="modal-close" onClick={() => setShowModal(false)}>✕</button></div>
            <form onSubmit={issue}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Alert Title *</label><input className="form-control" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Message *</label><textarea className="form-control" rows={4} required value={form.message} onChange={e => setForm({...form, message: e.target.value})} /></div>
                <div className="grid grid-2 gap-2">
                  <div className="form-group">
                    <label className="form-label">Severity</label>
                    <select className="form-control" value={form.severity} onChange={e => setForm({...form, severity: e.target.value})}>
                      <option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Region</label>
                    <select className="form-control" value={form.region} onChange={e => setForm({...form, region: e.target.value})}>
                      {['National','London','Midlands','North West','North East','South West','South East','Yorkshire','East of England'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button><button type="submit" className="btn btn-danger">Issue Alert</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
