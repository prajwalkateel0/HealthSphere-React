import { useState, useEffect } from 'react';
import api from '../../api/axios';

export default function AccessLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/access-logs').then(r => setLogs(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="card">
      <div className="card-header">
        <h3>Access Logs (Privacy Audit Trail)</h3>
        <span className="badge badge-gray">{logs.length} entries</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>User</th><th>Patient Accessed</th><th>Action</th><th>IP Address</th><th>Timestamp</th></tr></thead>
          <tbody>
            {logs.length ? logs.map(l => (
              <tr key={l.id}>
                <td style={{ fontWeight: 600 }}>{l.user_name}</td>
                <td>{l.patient_name || '—'}</td>
                <td><span className="badge badge-gray">{l.action}</span></td>
                <td className="text-muted text-sm">{l.ip_address}</td>
                <td className="text-muted text-sm">{new Date(l.created_at).toLocaleString('en-GB')}</td>
              </tr>
            )) : <tr><td colSpan={5}><div className="empty-state">No access logs</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
