import { useState, useEffect } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import api from '../../api/axios';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/analytics').then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const growthData = {
    labels: [...new Set(data?.userGrowth?.map(d => d.month))].sort().slice(-6),
    datasets: [
      { label: 'Patients', data: data?.userGrowth?.filter(d => d.role === 'patient').map(d => d.count) || [], borderColor: '#1565C0', backgroundColor: 'rgba(21,101,192,0.1)', fill: true, tension: 0.4 },
      { label: 'Doctors', data: data?.userGrowth?.filter(d => d.role === 'doctor').map(d => d.count) || [], borderColor: '#16A34A', backgroundColor: 'rgba(22,163,74,0.1)', fill: true, tension: 0.4 },
    ],
  };

  const topDoctorsData = {
    labels: data?.topDoctors?.slice(0, 8).map(d => d.name.split(' ').slice(-1)[0]) || [],
    datasets: [{
      label: 'Appointments',
      data: data?.topDoctors?.slice(0, 8).map(d => d.total_appointments) || [],
      backgroundColor: '#1565C0', borderRadius: 6,
    }],
  };

  return (
    <div>
      <div className="grid grid-2 gap-4 mb-4">
        <div className="card">
          <div className="card-header"><h3>User Growth Trend</h3></div>
          <div className="card-body">
            <Line data={growthData} options={{ responsive: true, plugins: { legend: { position: 'top' } } }} />
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>Top Doctors by Appointments</h3></div>
          <div className="card-body">
            <Bar data={topDoctorsData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3>Top Doctors Performance</h3></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Doctor</th><th>Specialization</th><th>Rating</th><th>Total Appointments</th></tr></thead>
            <tbody>
              {data?.topDoctors?.map((d, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{d.name}</td>
                  <td>{d.specialization}</td>
                  <td>⭐ {d.rating}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: '#1565C0', width: `${Math.min((d.total_appointments / (data.topDoctors[0]?.total_appointments || 1)) * 100, 100)}%` }} />
                      </div>
                      {d.total_appointments}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
