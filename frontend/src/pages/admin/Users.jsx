import { useState, useEffect } from 'react';
import api from '../../api/axios';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const load = () => {
    api.get('/admin/users', { params: { role, status, search } }).then(r => setUsers(r.data)).finally(() => setLoading(false));
  };

  useEffect(load, [role, status, search]);

  const updateStatus = async (id, newStatus) => {
    await api.put(`/admin/users/${id}/status`, { status: newStatus });
    load();
  };

  const deleteUser = async (id, name) => {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    await api.delete(`/admin/users/${id}`);
    load();
  };

  const roleBadge = (r) => {
    const m = { patient: 'info', doctor: 'success', admin: 'purple', government: 'warning' };
    return <span className={`badge badge-${m[r] || 'gray'}`}>{r}</span>;
  };

  const statusBadge = (s) => {
    const m = { active: 'success', inactive: 'gray', pending: 'warning', suspended: 'danger' };
    return <span className={`badge badge-${m[s] || 'gray'}`}>{s}</span>;
  };

  return (
    <div>
      <div className="card mb-4">
        <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input className="form-control" style={{ flex: 1, minWidth: 200 }} placeholder="🔍 Search name or email..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-control" style={{ width: 140 }} value={role} onChange={e => setRole(e.target.value)}>
            <option value="">All Roles</option>
            {['patient','doctor','admin','government'].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className="form-control" style={{ width: 140 }} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All Status</option>
            {['active','inactive','pending','suspended'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Users ({users.length})</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>NHS ID</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><div className="loading"><div className="spinner" /></div></td></tr>
              ) : users.length ? users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td className="text-muted">{u.email}</td>
                  <td>{roleBadge(u.role)}</td>
                  <td>{statusBadge(u.status)}</td>
                  <td className="text-muted text-sm">{u.nhs_id || '—'}</td>
                  <td className="text-muted text-sm">{new Date(u.created_at).toLocaleDateString('en-GB')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {u.status !== 'active' && <button className="btn btn-sm btn-success" onClick={() => updateStatus(u.id, 'active')}>Activate</button>}
                      {u.status === 'active' && <button className="btn btn-sm btn-warning" onClick={() => updateStatus(u.id, 'suspended')}>Suspend</button>}
                      <button className="btn btn-sm btn-danger" onClick={() => deleteUser(u.id, u.name)}>Delete</button>
                    </div>
                  </td>
                </tr>
              )) : <tr><td colSpan={7}><div className="empty-state">No users found</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
