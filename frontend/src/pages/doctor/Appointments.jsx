import { useState, useEffect } from 'react';
import api from '../../api/axios';

const STATUSES = ['pending','confirmed','arrived','waiting','completed','late','no_show','cancelled'];
const statusColors = { pending: 'warning', confirmed: 'info', arrived: 'purple', waiting: 'warning', completed: 'success', cancelled: 'danger', late: 'danger', no_show: 'gray' };

export default function DoctorAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  const load = () => {
    const params = {};
    if (filter !== 'all') params.status = filter;
    if (dateFilter) params.date = dateFilter;
    api.get('/doctor/appointments', { params }).then(r => setAppointments(r.data)).finally(() => setLoading(false));
  };

  useEffect(load, [filter, dateFilter]);

  const updateStatus = async (id, status) => {
    await api.put(`/doctor/appointments/${id}/status`, { status });
    load();
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="flex-between mb-4">
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <button className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('all')}>All</button>
          {STATUSES.map(s => (
            <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(s)}>
              {s.replace('_',' ')}
            </button>
          ))}
        </div>
        <input type="date" className="form-control" style={{ width: 160 }} value={dateFilter}
          onChange={e => setDateFilter(e.target.value)} />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Patient</th><th>Date & Time</th><th>Type</th><th>Reason</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {appointments.length ? appointments.map(a => (
                <tr key={a.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="user-avatar" style={{ width: 32, height: 32, fontSize: 11 }}>
                        {a.patient_name?.split(' ').map(n=>n[0]).join('').slice(0,2)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{a.patient_name}</div>
                        {a.blood_type && <span className="badge badge-info" style={{ fontSize: 10 }}>BT: {a.blood_type}</span>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>{new Date(a.appointment_date).toLocaleDateString('en-GB')}</div>
                    <div className="text-muted text-sm">{a.appointment_time?.slice(0,5)}</div>
                  </td>
                  <td><span className="badge badge-gray">{a.type?.replace('_',' ')}</span></td>
                  <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.reason || '—'}</td>
                  <td><span className={`badge badge-${statusColors[a.status] || 'gray'}`}>{a.status}</span></td>
                  <td>
                    <select className="form-control" style={{ padding: '4px 8px', fontSize: 12, width: 140 }}
                      value={a.status} onChange={e => updateStatus(a.id, e.target.value)}>
                      {STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                    </select>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6}><div className="empty-state">No appointments found</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
