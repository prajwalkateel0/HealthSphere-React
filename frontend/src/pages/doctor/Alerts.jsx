import { useState, useEffect } from 'react';
import api from '../../api/axios';

export default function DoctorAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/doctor/alerts').then(r => setAlerts(r.data)).finally(() => setLoading(false));
  }, []);

  const priorityColors = { low: 'info', medium: 'warning', high: 'danger', critical: 'danger' };
  const priorityIcons = { low: 'ℹ️', medium: '⚠️', high: '🚨', critical: '🆘' };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3>Health Alerts & Tasks</h3>
          <span className="badge badge-danger">{alerts.filter(a => !a.is_resolved).length} active</span>
        </div>
        {alerts.length ? alerts.map(a => (
          <div key={a.id} style={{
            padding: '16px 20px', borderBottom: '1px solid var(--border)',
            borderLeft: `4px solid ${a.priority === 'critical' || a.priority === 'high' ? 'var(--danger)' : a.priority === 'medium' ? 'var(--warning)' : 'var(--info)'}`,
            background: a.is_resolved ? '#f9fafb' : 'white',
            opacity: a.is_resolved ? 0.6 : 1,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18 }}>{priorityIcons[a.priority]}</span>
                  <span style={{ fontWeight: 700 }}>{a.patient_name}</span>
                  <span className={`badge badge-${priorityColors[a.priority]}`}>{a.priority}</span>
                  {a.is_resolved && <span className="badge badge-success">Resolved</span>}
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--text)' }}>{a.message}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {new Date(a.created_at).toLocaleString('en-GB')}
                </div>
              </div>
              {a.alert_type && <span className="badge badge-gray">{a.alert_type}</span>}
            </div>
          </div>
        )) : (
          <div className="empty-state"><div className="empty-icon">✅</div><p>No active alerts</p></div>
        )}
      </div>
    </div>
  );
}
