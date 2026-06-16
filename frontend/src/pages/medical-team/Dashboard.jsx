import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';

const STATUS_CONFIG = {
  approved:   { color: '#1565C0', bg: '#DBEAFE', icon: 'fa-check-circle',  label: 'Awaiting Preparation' },
  preparing:  { color: '#0891B2', bg: '#E0F2FE', icon: 'fa-mortar-pestle', label: 'Being Prepared' },
  dispatched: { color: '#7C3AED', bg: '#EDE9FE', icon: 'fa-truck',         label: 'Dispatched' },
  delivered:  { color: '#16A34A', bg: '#DCFCE7', icon: 'fa-check-double',  label: 'Delivered' },
};

const NEXT_MAP = {
  approved:   ['preparing', 'Mark Preparing', '#0891B2'],
  preparing:  ['dispatch',  'Mark Dispatched', '#7C3AED'],
  dispatched: ['deliver',   'Mark Delivered', '#16A34A'],
};

export default function MedicalTeamDashboard() {
  const [stats, setStats] = useState({ awaiting: 0, preparing: 0, dispatched: 0, delivered: 0, today: 0 });
  const [urgent, setUrgent] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get('/medical-team/dashboard').then(r => {
      setStats(r.data.stats);
      setUrgent(r.data.urgent);
    }).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const quickUpdate = async (orderId, action) => {
    if (!window.confirm(`Update order status to "${action}"?`)) return;
    try {
      await api.put('/medical-team/queue', { action, order_id: orderId, doctor_notes: '' });
      load();
    } catch { alert('Failed to update order'); }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const cards = [
    { label: 'Awaiting Prep', value: stats.awaiting, color: '#F59E0B', sub: 'Approved orders' },
    { label: 'Preparing', value: stats.preparing, color: '#0891B2', sub: 'Being dispensed' },
    { label: 'Dispatched', value: stats.dispatched, color: '#7C3AED', sub: 'In transit' },
    { label: 'Delivered', value: stats.delivered, color: '#16A34A', sub: 'All time total' },
    { label: 'Orders Today', value: stats.today, color: 'var(--primary-light)', sub: 'New requests' },
  ];

  return (
    <div>
      <div className="flex-between mb-4">
        <div />
        <Link to="/medical-team/medicine-queue" className="btn btn-primary"><i className="fas fa-pills" /> Open Queue</Link>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        {cards.map(c => (
          <div key={c.label} className="card" style={{ borderLeft: `4px solid ${c.color}` }}>
            <div className="card-body" style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header flex-between">
          <h3><i className="fas fa-clock" style={{ color: '#F59E0B' }} /> Active Orders Queue</h3>
          <Link to="/medical-team/medicine-queue" className="btn btn-outline btn-sm">View All</Link>
        </div>
        {!urgent.length ? (
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            <p>No active orders — queue is clear!</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Patient</th><th>Medication</th><th>Delivery</th><th>Status</th><th>Ordered</th><th>Action</th></tr></thead>
              <tbody>
                {urgent.map(o => {
                  const sc = STATUS_CONFIG[o.status] || STATUS_CONFIG.approved;
                  const next = NEXT_MAP[o.status];
                  return (
                    <tr key={o.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{o.patient_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>NHS: {o.nhs_id}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>💊 {o.medication_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.dosage} · {o.frequency}</div>
                      </td>
                      <td>
                        {o.delivery_method === 'delivery'
                          ? <span style={{ color: '#7C3AED', fontSize: 12, fontWeight: 600 }}><i className="fas fa-truck" /> Home Delivery</span>
                          : <span style={{ color: '#1565C0', fontSize: 12, fontWeight: 600 }}><i className="fas fa-store" /> Collection</span>}
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: sc.bg, color: sc.color, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                          <i className={`fas ${sc.icon}`} /> {sc.label}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(o.ordered_at).toLocaleString('en-GB')}</td>
                      <td>
                        {next ? (
                          <button onClick={() => quickUpdate(o.id, next[0])}
                            style={{ background: next[2], color: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                            {next[1]}
                          </button>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
