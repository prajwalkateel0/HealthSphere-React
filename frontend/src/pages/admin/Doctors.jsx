import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function AdminDoctors() {
  const [doctors,  setDoctors]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [verified, setVerified] = useState('');
  const [success,  setSuccess]  = useState('');
  const [acting,   setActing]   = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/doctors', { params: { search, verified } })
      .then(r => setDoctors(r.data))
      .finally(() => setLoading(false));
  }, [search, verified]);

  useEffect(() => { load(); }, [load]);

  const flash = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); };

  const doVerify = async (id, verify) => {
    if (!verify && !confirm('Revoke HCPC access for this doctor?')) return;
    setActing(id);
    try {
      const r = await api.put(`/admin/doctors/${id}/verify`, { hcpc_verified: verify });
      flash(r.data?.message || (verify ? 'Doctor verified.' : 'Access revoked.'));
      load();
    } finally { setActing(null); }
  };

  const pendingCount   = doctors.filter(d => !d.hcpcVerified).length;
  const verifiedCount  = doctors.filter(d =>  d.hcpcVerified).length;

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>
            <i className="fas fa-user-md" style={{ color: '#1565C0', marginRight: 8 }}></i>Doctor Access Control
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {doctors.length} total &middot; <span style={{ color: '#16A34A', fontWeight: 600 }}>{verifiedCount} verified</span> &middot; <span style={{ color: '#D97706', fontWeight: 600 }}>{pendingCount} pending</span>
          </div>
        </div>
      </div>

      {/* Success alert */}
      {success && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          <i className="fas fa-check-circle"></i> {success}
        </div>
      )}

      {/* Filter bar */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-control"
            style={{ flex: 1, minWidth: 220 }}
            placeholder="🔍 Search name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="form-control" style={{ width: 180 }} value={verified} onChange={e => setVerified(e.target.value)}>
            <option value="">All Doctors</option>
            <option value="false">Pending Verification</option>
            <option value="true">Verified Only</option>
          </select>
          <button className="btn btn-sm btn-outline" onClick={load}>
            <i className="fas fa-sync"></i> Refresh
          </button>
        </div>
      </div>

      {/* Main table */}
      <div className="card">
        <div className="card-header">
          <h3><i className="fas fa-user-md" style={{ marginRight: 6, color: '#1565C0' }}></i>Doctors Access</h3>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{doctors.length} total</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Doctor</th>
                <th>Email Address</th>
                <th>Hospital</th>
                <th>HCPC No.</th>
                <th>Rating</th>
                <th>Exp.</th>
                <th>Access</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8}><div className="loading"><div className="spinner" /></div></td></tr>
              ) : doctors.length ? doctors.map(d => (
                <tr key={d.id}>
                  {/* Name + avatar + specialization */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: d.hcpcVerified ? '#DCFCE7' : '#FEF3C7',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: d.hcpcVerified ? '#166534' : '#92400E',
                        fontWeight: 700, fontSize: 12, flexShrink: 0,
                      }}>
                        {initials(d.name)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{d.name}</div>
                        <div style={{ fontSize: 11, color: '#1565C0', fontWeight: 500 }}>{d.specialization || '—'}</div>
                      </div>
                    </div>
                  </td>

                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.email}</td>

                  <td style={{ fontSize: 13 }}>{d.hospital || '—'}</td>

                  <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>
                    {d.hcpcNumber || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>

                  <td style={{ fontSize: 13 }}>
                    {d.rating
                      ? <span style={{ color: '#D97706', fontWeight: 700 }}>★ {parseFloat(d.rating).toFixed(1)}</span>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>

                  <td style={{ fontSize: 13 }}>
                    {d.experienceYears
                      ? <span style={{ fontWeight: 600 }}>{d.experienceYears}y</span>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>

                  <td>
                    {d.hcpcVerified
                      ? <span className="badge badge-success"><i className="fas fa-check-circle" style={{ marginRight: 4 }}></i>Approved</span>
                      : <span className="badge badge-warning"><i className="fas fa-hourglass-half" style={{ marginRight: 4 }}></i>Pending</span>}
                  </td>

                  <td>
                    {!d.hcpcVerified ? (
                      <button
                        className="btn btn-sm btn-success"
                        disabled={acting === d.id}
                        onClick={() => doVerify(d.id, true)}
                      >
                        <i className="fas fa-check"></i> Verify
                      </button>
                    ) : (
                      <button
                        className="btn btn-sm btn-danger"
                        disabled={acting === d.id}
                        onClick={() => doVerify(d.id, false)}
                      >
                        <i className="fas fa-ban"></i> Revoke
                      </button>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      {search || verified ? 'No doctors match your filters' : 'No doctors registered yet'}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
