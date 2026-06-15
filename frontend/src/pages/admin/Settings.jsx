import { useState, useEffect } from 'react';
import api from '../../api/axios';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => api.get('/admin/settings').then(r => setSettings(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div style={{ maxWidth: 700 }}>
      <div className="card mb-4">
        <div className="card-header"><span className="card-title">⚙️ General Settings</span></div>
        <div style={{ padding: 20 }}>
          <div className="form-group">
            <label className="form-label">Application Name</label>
            <input type="text" className="form-control" value={settings.appName} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">System Email</label>
            <input type="email" className="form-control" value={settings.systemEmail} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">NHS Login Integration</label>
            <select className="form-control" disabled defaultValue="enabled">
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">🗄️ Database Status</span></div>
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
          {Object.entries(settings.tables).map(([table, count]) => (
            <div key={table} style={{ background: 'var(--bg)', padding: '10px 14px', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'monospace' }}>{table}</span>
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{Number(count).toLocaleString()} rows</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
