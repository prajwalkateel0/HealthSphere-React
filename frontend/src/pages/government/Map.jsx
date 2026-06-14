import { useEffect } from 'react';

const UK_REGIONS = [
  { name: 'London', lat: 51.5074, lng: -0.1278, patients: 245000, alerts: 12 },
  { name: 'South East', lat: 51.2362, lng: -0.5704, patients: 189000, alerts: 8 },
  { name: 'North West', lat: 53.4808, lng: -2.2426, patients: 167000, alerts: 15 },
  { name: 'Yorkshire', lat: 53.9591, lng: -1.0815, patients: 134000, alerts: 6 },
  { name: 'West Midlands', lat: 52.4862, lng: -1.8904, patients: 156000, alerts: 11 },
  { name: 'East of England', lat: 52.2053, lng: 0.1218, patients: 121000, alerts: 4 },
  { name: 'South West', lat: 51.4545, lng: -2.5879, patients: 98000, alerts: 3 },
  { name: 'North East', lat: 54.9783, lng: -1.6178, patients: 88000, alerts: 7 },
];

export default function GovMap() {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = initMap;
    document.head.appendChild(script);

    function initMap() {
      const mapEl = document.getElementById('gov-map');
      if (!mapEl || mapEl._leaflet_id) return;
      const L = window.L;
      const map = L.map('gov-map').setView([52.5, -1.5], 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      UK_REGIONS.forEach(r => {
        const color = r.alerts > 10 ? '#DC2626' : r.alerts > 5 ? '#D97706' : '#16A34A';
        const circle = L.circle([r.lat, r.lng], {
          color, fillColor: color, fillOpacity: 0.3,
          radius: r.patients * 10,
        }).addTo(map);
        circle.bindPopup(`
          <div style="min-width:200px">
            <h4 style="margin:0 0 8px;color:#0A1F44">${r.name}</h4>
            <div><strong>Registered Patients:</strong> ${r.patients.toLocaleString()}</div>
            <div><strong>Active Alerts:</strong> ${r.alerts}</div>
          </div>
        `);
      });
    }
  }, []);

  return (
    <div>
      <div className="card mb-4">
        <div className="card-header">
          <h3>UK Regional Health Map</h3>
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} /> Low Risk</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: '#D97706', display: 'inline-block' }} /> Moderate</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: '#DC2626', display: 'inline-block' }} /> High Alerts</span>
          </div>
        </div>
      </div>
      <div className="card">
        <div id="gov-map" style={{ height: 550, borderRadius: '0 0 12px 12px' }} />
      </div>

      <div className="grid grid-4 gap-4 mt-4">
        {UK_REGIONS.map(r => (
          <div className="card" key={r.name}>
            <div className="card-body" style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{r.name}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1565C0', margin: '4px 0' }}>{r.patients.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>patients</div>
              <div style={{ marginTop: 6 }}>
                <span className={`badge badge-${r.alerts > 10 ? 'danger' : r.alerts > 5 ? 'warning' : 'success'}`}>
                  {r.alerts} alerts
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
