import { useState, useEffect } from 'react';
import api from '../../api/axios';

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export default function Schedule() {
  const [schedule, setSchedule] = useState(DAYS.map((_, i) => ({ day_of_week: i, start_time: '09:00', end_time: '17:00', is_available: i >= 1 && i <= 5 })));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api.get('/doctor/schedule').then(r => {
      if (r.data.length) {
        const map = {};
        r.data.forEach(s => { map[s.day_of_week] = s; });
        setSchedule(DAYS.map((_, i) => map[i] || { day_of_week: i, start_time: '09:00', end_time: '17:00', is_available: false }));
      }
    }).finally(() => setLoading(false));
  }, []);

  const update = (day, field, value) => {
    setSchedule(prev => prev.map(s => s.day_of_week === day ? {...s, [field]: value} : s));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/doctor/schedule', { schedules: schedule });
      setMsg('Schedule saved!');
      setTimeout(() => setMsg(null), 3000);
    } catch { setMsg('Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3>Weekly Availability</h3>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save Schedule'}
          </button>
        </div>
        <div className="card-body">
          {msg && <div className="alert alert-success mb-4">{msg}</div>}
          {schedule.map(s => (
            <div key={s.day_of_week} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 100, fontWeight: 600, color: s.is_available ? 'var(--primary)' : 'var(--text-muted)' }}>
                {DAYS[s.day_of_week]}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={s.is_available}
                  onChange={e => update(s.day_of_week, 'is_available', e.target.checked)} />
                Available
              </label>
              {s.is_available && (
                <>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>From</label>
                    <input type="time" className="form-control" style={{ width: 120 }} value={s.start_time}
                      onChange={e => update(s.day_of_week, 'start_time', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>To</label>
                    <input type="time" className="form-control" style={{ width: 120 }} value={s.end_time}
                      onChange={e => update(s.day_of_week, 'end_time', e.target.value)} />
                  </div>
                </>
              )}
              {!s.is_available && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Not available</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
