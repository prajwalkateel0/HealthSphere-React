import { useState, useEffect } from 'react';
import api from '../../api/axios';

export default function DoctorProfile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api.get('/doctor/profile').then(r => {
      setProfile(r.data);
      setForm({
        name: r.data.name || '', phone: r.data.phone || '',
        address: r.data.address || '', specialization: r.data.specialization || '',
        hospital: r.data.hospital || '', bio: r.data.bio || '', availability: r.data.availability || '',
        experience_years: r.data.experienceYears ?? '',
      });
    }).finally(() => setLoading(false));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/doctor/profile', form);
      setMsg({ type: 'success', text: 'Profile updated!' });
    } catch { setMsg({ type: 'danger', text: 'Failed to update' }); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="grid grid-2 gap-4">
      {/* Profile Summary */}
      <div className="card">
        <div className="card-body" style={{ textAlign: 'center', padding: 32 }}>
          <div className="user-avatar" style={{ width: 80, height: 80, fontSize: 28, margin: '0 auto 16px' }}>
            {profile?.name?.split(' ').map(n=>n[0]).join('').slice(0,2)}
          </div>
          <h2 style={{ fontWeight: 700, marginBottom: 4 }}>{profile?.name}</h2>
          <div style={{ color: 'var(--text-muted)', marginBottom: 12 }}>{profile?.specialization}</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            {profile?.hcpcVerified && <span className="badge badge-success">✓ HCPC Verified</span>}
            <span className="badge badge-info">⭐ {profile?.rating || '0.0'}/5.0</span>
          </div>
          <div style={{ marginTop: 20, textAlign: 'left', display: 'grid', gap: 10 }}>
            {[
              ['🏥 Hospital', profile?.hospital],
              ['📋 HCPC', profile?.hcpcNumber],
              ['💼 Experience', profile?.experienceYears != null ? `${profile.experienceYears} years` : null],
              ['🪪 NHS ID', profile?.nhsId],
              ['📧 Email', profile?.email],
              ['📞 Phone', profile?.phone],
              ['🌍 Address', profile?.address],
            ].filter(([,v]) => v).map(([label, value]) => (
              <div key={label} style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, fontSize: 13 }}>
                <strong>{label}:</strong> {value}
              </div>
            ))}
          </div>
          {profile?.bio && (
            <div style={{ marginTop: 16, textAlign: 'left', padding: '12px', background: '#eff6ff', borderRadius: 8, fontSize: 13, color: 'var(--text)' }}>
              <strong>Bio:</strong> {profile.bio}
            </div>
          )}
        </div>
      </div>

      {/* Edit Form */}
      <div className="card">
        <div className="card-header"><h3>Edit Profile</h3></div>
        <div className="card-body">
          {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
          <form onSubmit={save}>
            {[
              ['name', 'Full Name'],
              ['phone', 'Phone'],
              ['specialization', 'Specialization'],
              ['hospital', 'Hospital'],
            ].map(([key, label]) => (
              <div className="form-group" key={key}>
                <label className="form-label">{label}</label>
                <input className="form-control" value={form[key] || ''} onChange={e => setForm({...form, [key]: e.target.value})} />
              </div>
            ))}
            <div className="form-group">
              <label className="form-label">Years of Experience</label>
              <input type="number" min="0" className="form-control" value={form.experience_years}
                onChange={e => setForm({...form, experience_years: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <textarea className="form-control" rows={2} value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Bio</label>
              <textarea className="form-control" rows={3} value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} />
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
