import { useState, useEffect } from 'react';
import api from '../../api/axios';

export default function AdminDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => api.get('/admin/doctors').then(r => setDoctors(r.data)).finally(() => setLoading(false));
  useEffect(load, []);

  const verify = async (id, verified) => {
    await api.put(`/admin/doctors/${id}/verify`, { hcpc_verified: verified });
    load();
  };

  return (
    <div className="card">
      <div className="card-header"><h3>Doctors ({doctors.length})</h3></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Doctor</th><th>Specialization</th><th>Hospital</th><th>HCPC</th><th>Rating</th><th>Status</th><th>Verified</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8}><div className="loading"><div className="spinner" /></div></td></tr>
            : doctors.map(d => (
              <tr key={d.id}>
                <td style={{ fontWeight: 600 }}>{d.name}</td>
                <td>{d.specialization}</td>
                <td className="text-muted">{d.hospital}</td>
                <td className="text-sm">{d.hcpc_number || '—'}</td>
                <td>⭐ {d.rating}</td>
                <td><span className={`badge badge-${d.status === 'active' ? 'success' : 'warning'}`}>{d.status}</span></td>
                <td>
                  {d.hcpc_verified
                    ? <span className="badge badge-success">✓ Verified</span>
                    : <span className="badge badge-warning">Pending</span>
                  }
                </td>
                <td>
                  {!d.hcpc_verified
                    ? <button className="btn btn-sm btn-success" onClick={() => verify(d.id, true)}>Verify</button>
                    : <button className="btn btn-sm btn-danger" onClick={() => verify(d.id, false)}>Revoke</button>
                  }
                </td>
              </tr>
            ))}
            {!loading && !doctors.length && <tr><td colSpan={8}><div className="empty-state">No doctors</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
