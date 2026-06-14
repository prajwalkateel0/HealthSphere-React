import { useState, useEffect } from 'react';
import api from '../../api/axios';

const statusColors = { pending: 'warning', confirmed: 'info', arrived: 'purple', waiting: 'warning', completed: 'success', cancelled: 'danger', late: 'danger' };

export default function DoctorDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/doctor/dashboard').then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  const updateStatus = async (id, status) => {
    await api.put(`/doctor/appointments/${id}/status`, { status });
    const r = await api.get('/doctor/dashboard');
    setData(r.data);
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const { todaysAppts, totalPatients, criticalLabs, pendingRefills, recentMessages } = data || {};

  return (
    <div>
      <div className="stat-grid">
        {[
          { label: "Today's Patients", value: todaysAppts?.length || 0, icon: '👥', bg: '#eff6ff', iconBg: '#dbeafe' },
          { label: "Total Patients", value: totalPatients || 0, icon: '🏥', bg: '#f0fdf4', iconBg: '#dcfce7' },
          { label: "Critical Alerts", value: criticalLabs?.length || 0, icon: '🚨', bg: '#fef2f2', iconBg: '#fee2e2' },
          { label: "Pending Refills", value: pendingRefills?.length || 0, icon: '💊', bg: '#fffbeb', iconBg: '#fef3c7' },
        ].map(s => (
          <div className="stat-card" key={s.label} style={{ background: s.bg }}>
            <div className="stat-icon" style={{ background: s.iconBg }}>{s.icon}</div>
            <div className="stat-info">
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-2 gap-4">
        {/* Today's Appointments */}
        <div className="card">
          <div className="card-header">
            <h3>📅 Today's Appointments</h3>
            <a href="/doctor/appointments" className="btn btn-sm btn-outline">View All</a>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {todaysAppts?.length ? todaysAppts.map(a => (
              <div key={a.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{a.patient_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {a.appointment_time?.slice(0,5)} • {a.reason || 'General visit'}
                    </div>
                    {a.blood_type && <span className="badge badge-info" style={{ marginTop: 4 }}>BT: {a.blood_type}</span>}
                  </div>
                  <span className={`badge badge-${statusColors[a.status] || 'gray'}`}>{a.status}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['arrived','waiting','completed'].map(s => (
                    a.status !== s && (
                      <button key={s} className="btn btn-sm btn-outline" style={{ fontSize: 11 }}
                        onClick={() => updateStatus(a.id, s)}>
                        → {s.charAt(0).toUpperCase()+s.slice(1)}
                      </button>
                    )
                  ))}
                </div>
              </div>
            )) : <div className="empty-state"><div className="empty-icon">📅</div><p>No appointments today</p></div>}
          </div>
        </div>

        <div>
          {/* Critical Lab Results */}
          <div className="card mb-4">
            <div className="card-header">
              <h3>🚨 Critical Lab Alerts</h3>
              <a href="/doctor/lab-results" className="btn btn-sm btn-outline">View All</a>
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {criticalLabs?.length ? criticalLabs.map(l => (
                <div key={l.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: '#fef2f2' }}>
                  <div style={{ fontWeight: 700, color: '#dc2626' }}>🚨 {l.patient_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.test_type}: {l.result}</div>
                </div>
              )) : <div className="empty-state" style={{ padding: 20 }}><p style={{ fontSize: 13 }}>No critical alerts</p></div>}
            </div>
          </div>

          {/* Messages */}
          <div className="card">
            <div className="card-header">
              <h3>💬 Recent Messages</h3>
              <a href="/doctor/messages" className="btn btn-sm btn-outline">View All</a>
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {recentMessages?.length ? recentMessages.map(m => (
                <div key={m.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{m.sender_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.content}
                  </div>
                </div>
              )) : <div className="empty-state" style={{ padding: 20 }}><p style={{ fontSize: 13 }}>No unread messages</p></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
