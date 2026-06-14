import { useState, useEffect } from 'react';
import api from '../../api/axios';

export default function Approvals() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => api.get('/admin/approvals').then(r => setPending(r.data)).finally(() => setLoading(false));
  useEffect(load, []);

  const approve = async (id) => {
    await api.put(`/admin/users/${id}/status`, { status: 'active' });
    load();
  };

  const reject = async (id) => {
    if (!confirm('Reject this application?')) return;
    await api.put(`/admin/users/${id}/status`, { status: 'suspended' });
    load();
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3>Pending Approvals</h3>
          <span className="badge badge-warning">{pending.length} pending</span>
        </div>
        {loading ? <div className="loading"><div className="spinner" /></div>
        : pending.length ? pending.map(u => (
          <div key={u.id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{u.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{u.email} • {u.phone || 'No phone'}</div>
              <div style={{ marginTop: 4 }}>
                <span className="badge badge-warning">{u.role}</span>
                <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                  Registered {new Date(u.created_at).toLocaleDateString('en-GB')}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-success" onClick={() => approve(u.id)}>✓ Approve</button>
              <button className="btn btn-danger" onClick={() => reject(u.id)}>✗ Reject</button>
            </div>
          </div>
        )) : (
          <div className="empty-state"><div className="empty-icon">✅</div><p>No pending approvals</p></div>
        )}
      </div>
    </div>
  );
}
