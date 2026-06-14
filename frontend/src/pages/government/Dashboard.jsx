import { useState, useEffect } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import api from '../../api/axios';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

export default function GovDashboard() {
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/government/dashboard'), api.get('/government/analytics')]).then(([s, a]) => {
      setStats(s.data); setAnalytics(a.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const conditionsData = {
    labels: analytics?.conditions?.slice(0,8).map(c => c.condition_name) || [],
    datasets: [{
      label: 'Reported Cases',
      data: analytics?.conditions?.slice(0,8).map(c => c.count) || [],
      backgroundColor: '#1565C0', borderRadius: 6,
    }],
  };

  const monthlyData = {
    labels: analytics?.monthlyTrends?.reverse().map(t => t.month) || [],
    datasets: [{
      label: 'New Patients',
      data: analytics?.monthlyTrends?.map(t => t.new_patients) || [],
      borderColor: '#00B4D8', backgroundColor: 'rgba(0,180,216,0.1)', fill: true, tension: 0.4,
    }],
  };

  return (
    <div>
      <div className="alert alert-info mb-4">
        🔒 <strong>Anonymised Data.</strong> All patient data is anonymised in compliance with UK GDPR regulations.
      </div>

      <div className="stat-grid">
        {[
          { label: 'Total Registered Patients', value: stats?.totalPatients?.toLocaleString() || 0, icon: '👥', bg: '#eff6ff', iconBg: '#dbeafe' },
          { label: 'Critical Health Alerts', value: stats?.criticalAlerts || 0, icon: '🚨', bg: '#fef2f2', iconBg: '#fee2e2' },
          { label: 'Appointments (Month)', value: stats?.appointments || 0, icon: '📅', bg: '#f0fdf4', iconBg: '#dcfce7' },
          { label: 'Active Prescriptions', value: stats?.activePrescriptions || 0, icon: '💊', bg: '#fffbeb', iconBg: '#fef3c7' },
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
        <div className="card">
          <div className="card-header"><h3>Top Reported Conditions</h3></div>
          <div className="card-body">
            {analytics?.conditions?.length
              ? <Bar data={conditionsData} options={{ responsive: true, plugins: { legend: { display: false } }, indexAxis: 'y' }} />
              : <div className="empty-state"><div className="empty-icon">📊</div><p>No data available</p></div>}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>Monthly Patient Registrations</h3></div>
          <div className="card-body">
            {analytics?.monthlyTrends?.length
              ? <Line data={monthlyData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
              : <div className="empty-state"><div className="empty-icon">📈</div><p>No trend data</p></div>}
          </div>
        </div>
      </div>

      {/* Age Distribution */}
      {analytics?.ageDistribution?.length > 0 && (
        <div className="card mt-4">
          <div className="card-header"><h3>Population Age Distribution</h3></div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {analytics.ageDistribution.map(a => {
                const total = analytics.ageDistribution.reduce((s, x) => s + x.count, 0);
                const pct = total ? Math.round((a.count / total) * 100) : 0;
                return (
                  <div key={a.age_group} style={{ flex: 1, minWidth: 100, textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: 22, color: '#1565C0' }}>{pct}%</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.age_group}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.count} patients</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
