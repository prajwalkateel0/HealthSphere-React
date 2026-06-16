import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const STATUS_BADGE = {
  active:    <span className="badge badge-success">Active</span>,
  pending:   <span className="badge badge-warning">Pending</span>,
  suspended: <span className="badge badge-danger">Suspended</span>,
  inactive:  <span className="badge badge-gray">Inactive</span>,
};

const ROLE_BADGE = {
  patient:    { bg: '#DBEAFE', color: '#1E40AF' },
  doctor:     { bg: '#DCFCE7', color: '#166534' },
  admin:      { bg: '#FEF3C7', color: '#92400E' },
  government: { bg: '#EDE9FE', color: '#5B21B6' },
  pharmacy:   { bg: '#ECFEFF', color: '#0E7490' },
};

const QUICK_LINKS = [
  { icon: 'fa-users',        label: 'User Management',  to: '/admin/users',         color: '#1565C0', bg: '#DBEAFE' },
  { icon: 'fa-user-md',      label: 'Doctor Access',    to: '/admin/doctors',       color: '#16A34A', bg: '#DCFCE7' },
  { icon: 'fa-drumstick-bite',label:'Food Database',    to: '/admin/food-database', color: '#D97706', bg: '#FEF3C7' },
  { icon: 'fa-dna',          label: 'Genetic Diseases', to: '/admin/diseases',      color: '#7C3AED', bg: '#EDE9FE' },
  { icon: 'fa-shield-alt',   label: 'Access Logs',      to: '/admin/access-logs',   color: '#0891B2', bg: '#CFFAFE' },
  { icon: 'fa-cog',          label: 'Settings',         to: '/admin/settings',      color: '#5E7A99', bg: '#F1F5F9' },
];

function actionColor(action = '') {
  const u = action.toUpperCase();
  if (/LOGIN|AUTH/.test(u))   return '#16A34A';
  if (/DELETE|SUSPEND/.test(u)) return '#DC2626';
  return '#1565C0';
}

export default function AdminDashboard() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/dashboard').then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const s = data || {};

  const STAT_CARDS = [
    { label: 'Patients',            value: s.patients,        icon: 'fa-users',         color: '#1565C0', bg: '#EFF6FF', sub: 'Registered users' },
    { label: 'Doctors',             value: s.doctors,         icon: 'fa-user-md',       color: '#16A34A', bg: '#F0FDF4', sub: `${s.pendingDoctors ?? 0} pending verification` },
    { label: 'Appointments (30d)',  value: s.appointments,    icon: 'fa-calendar-check', color: '#0891B2', bg: '#ECFEFF', sub: 'Last 30 days' },
    { label: 'Food Items',          value: s.foodItems,       icon: 'fa-drumstick-bite', color: '#D97706', bg: '#FFFBEB', sub: 'In database' },
    { label: 'Genetic Diseases',    value: s.diseases,        icon: 'fa-dna',           color: '#7C3AED', bg: '#F5F3FF', sub: 'In registry' },
  ];

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>
            <i className="fas fa-shield-alt" style={{ color: '#1565C0', marginRight: 8 }}></i>Admin Console
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            HealthSphere Control Panel &middot; {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>
        {s.pendingDoctors > 0 && (
          <Link to="/admin/doctors" className="btn btn-danger btn-sm">
            <i className="fas fa-exclamation-triangle"></i> {s.pendingDoctors} Pending Doctors
          </Link>
        )}
      </div>

      {/* Stat cards */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', marginBottom: 24 }}>
        {STAT_CARDS.map(c => (
          <div key={c.label} className="stat-card">
            <div className="stat-icon" style={{ background: c.bg, color: c.color }}>
              <i className={`fas ${c.icon}`}></i>
            </div>
            <div className="stat-info">
              <div className="stat-value">{(c.value ?? 0).toLocaleString()}</div>
              <div className="stat-label">{c.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent users + Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* Recent users table */}
        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-user-plus" style={{ marginRight: 6, color: '#1565C0' }}></i>Recently Registered</h3>
            <Link to="/admin/users" style={{ fontSize: 12, color: '#1565C0', textDecoration: 'none', fontWeight: 500 }}>View all →</Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>User</th><th>Role</th><th>NHS ID</th><th>Status</th><th>Joined</th></tr>
              </thead>
              <tbody>
                {s.recentUsers?.length ? s.recentUsers.map(u => {
                  const rs = ROLE_BADGE[u.role] || { bg: '#F3F4F6', color: '#374151' };
                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#1565C020', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1565C0', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                            {initials(u.name)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{u.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ background: rs.bg, color: rs.color, textTransform: 'capitalize' }}>{u.role}</span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{u.nhsId || '—'}</td>
                      <td>{STATUS_BADGE[u.status] || <span className="badge badge-gray">{u.status}</span>}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{timeAgo(u.createdAt)}</td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={5}><div className="empty-state">No users yet</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick actions */}
        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-bolt" style={{ marginRight: 6, color: '#D97706' }}></i>Quick Actions</h3>
          </div>
          <div className="card-body" style={{ padding: '12px 16px' }}>
            {QUICK_LINKS.map(lnk => (
              <Link
                key={lnk.to}
                to={lnk.to}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 8, textDecoration: 'none', marginBottom: 8, transition: 'all 0.15s', background: 'white' }}
                onMouseOver={e => { e.currentTarget.style.borderColor = lnk.color; e.currentTarget.style.background = lnk.bg; }}
                onMouseOut={e =>  { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'white'; }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 8, background: lnk.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: lnk.color, flexShrink: 0 }}>
                  <i className={`fas ${lnk.icon}`}></i>
                </div>
                <span style={{ fontWeight: 600, color: 'var(--primary)', fontSize: 13.5 }}>{lnk.label}</span>
                <i className="fas fa-chevron-right" style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 12 }}></i>
              </Link>
            ))}
          </div>
        </div>

      </div>

      {/* Recent access logs */}
      <div className="card">
        <div className="card-header">
          <h3><i className="fas fa-history" style={{ marginRight: 6, color: '#1565C0' }}></i>Recent Access Logs</h3>
          <Link to="/admin/access-logs" style={{ fontSize: 12, color: '#1565C0', textDecoration: 'none', fontWeight: 500 }}>Full log →</Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>User</th><th>Role</th><th>Action</th><th>IP Address</th><th>Time</th></tr>
            </thead>
            <tbody>
              {s.recentLogs?.length ? s.recentLogs.map((log, i) => {
                const c = actionColor(log.action);
                return (
                  <tr key={log.id ?? i}>
                    <td style={{ fontWeight: 600 }}>{log.user_name}</td>
                    <td style={{ textTransform: 'capitalize', fontSize: 13 }}>{log.role}</td>
                    <td>
                      <code style={{ background: `${c}15`, color: c, padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>{log.action || '—'}</code>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{log.ip_address || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{timeAgo(log.created_at)}</td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={5}><div className="empty-state">No access logs yet</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
