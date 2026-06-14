import { useState, useEffect } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import api from '../../api/axios';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/admin/dashboard'), api.get('/admin/analytics')]).then(([s, a]) => {
      setStats(s.data); setAnalytics(a.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const doctorChart = {
    labels: analytics?.topDoctors?.slice(0,5).map(d => d.name.split(' ')[1] || d.name) || [],
    datasets: [{
      label: 'Appointments',
      data: analytics?.topDoctors?.slice(0,5).map(d => d.total_appointments) || [],
      backgroundColor: ['#1565C0','#00B4D8','#16A34A','#D97706','#7c3aed'],
      borderRadius: 6,
    }],
  };

  const userChart = {
    labels: ['Patients', 'Doctors', 'Pending'],
    datasets: [{
      data: [stats?.patients || 0, stats?.doctors || 0, stats?.pending || 0],
      backgroundColor: ['#1565C0','#16A34A','#D97706'],
    }],
  };

  return (
    <div>
      <div className="stat-grid">
        {[
          { label: 'Total Patients', value: stats?.patients || 0, icon: '👥', bg: '#eff6ff', iconBg: '#dbeafe' },
          { label: 'Active Doctors', value: stats?.doctors || 0, icon: '🩺', bg: '#f0fdf4', iconBg: '#dcfce7' },
          { label: 'Appointments (Month)', value: stats?.appointments || 0, icon: '📅', bg: '#fffbeb', iconBg: '#fef3c7' },
          { label: 'Pending Approvals', value: stats?.pending || 0, icon: '⏳', bg: '#fef2f2', iconBg: '#fee2e2' },
          { label: 'Food DB Items', value: stats?.foodItems || 0, icon: '🍎', bg: '#f3e8ff', iconBg: '#e9d5ff' },
          { label: 'Disease Registry', value: stats?.diseases || 0, icon: '🧬', bg: '#ecfeff', iconBg: '#cffafe' },
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
          <div className="card-header"><h3>Top Doctors by Appointments</h3></div>
          <div className="card-body">
            {analytics?.topDoctors?.length
              ? <Bar data={doctorChart} options={{ responsive: true, plugins: { legend: { display: false } } }} />
              : <div className="empty-state"><div className="empty-icon">📊</div><p>No data yet</p></div>
            }
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>User Distribution</h3></div>
          <div className="card-body" style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ maxWidth: 250 }}>
              <Doughnut data={userChart} options={{ responsive: true }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
