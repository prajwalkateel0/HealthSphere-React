import { useState, useEffect } from 'react';
import api from '../../api/axios';

export default function DoctorPatients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [noteForm, setNoteForm] = useState({ note_type: 'general', content: '' });
  const [noteMsg, setNoteMsg] = useState(null);

  useEffect(() => {
    api.get('/doctor/patients', { params: { search } }).then(r => setPatients(r.data)).finally(() => setLoading(false));
  }, [search]);

  const viewDetails = async (patient) => {
    setSelected(patient);
    setDetailLoading(true);
    const r = await api.get(`/doctor/patients/${patient.id}`);
    setDetails(r.data);
    setDetailLoading(false);
  };

  const addNote = async (e) => {
    e.preventDefault();
    await api.post('/doctor/clinical-notes', { patient_id: selected.id, ...noteForm });
    setNoteMsg('Note added!');
    setNoteForm({ note_type: 'general', content: '' });
    const r = await api.get(`/doctor/patients/${selected.id}`);
    setDetails(r.data);
    setTimeout(() => setNoteMsg(null), 3000);
  };

  const calcAge = (dob) => {
    if (!dob) return '—';
    return Math.floor((new Date() - new Date(dob)) / (1000 * 60 * 60 * 24 * 365.25));
  };

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: selected ? '1fr 1.5fr' : '1fr' }}>
      {/* Patient List */}
      <div className="card" style={{ maxHeight: 'calc(100vh - 130px)', overflowY: 'auto' }}>
        <div className="card-header">
          <h3>Patients ({patients.length})</h3>
        </div>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <input className="form-control" placeholder="🔍 Search patients..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        {loading ? <div className="loading"><div className="spinner" /></div> : (
          patients.map(p => (
            <div key={p.id} onClick={() => viewDetails(p)}
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                background: selected?.id === p.id ? '#eff6ff' : 'white',
              }}
              onMouseOver={e => { if (selected?.id !== p.id) e.currentTarget.style.background = '#f8faff'; }}
              onMouseOut={e => { if (selected?.id !== p.id) e.currentTarget.style.background = 'white'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="user-avatar">{p.name?.split(' ').map(n => n[0]).join('').slice(0,2)}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {calcAge(p.date_of_birth)} yrs • {p.gender || 'Unknown'} • NHS: {p.nhs_id}
                  </div>
                  {p.blood_type && <span className="badge badge-info" style={{ fontSize: 10 }}>BT: {p.blood_type}</span>}
                </div>
              </div>
            </div>
          ))
        )}
        {!loading && !patients.length && <div className="empty-state"><div className="empty-icon">👥</div><p>No patients found</p></div>}
      </div>

      {/* Patient Details */}
      {selected && (
        <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 130px)' }}>
          <div className="card mb-4">
            <div className="card-header">
              <h3>{selected.name}</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="card-body">
              <div className="grid grid-2 gap-3">
                {[
                  ['Age', calcAge(selected.date_of_birth) + ' years'],
                  ['NHS ID', selected.nhs_id],
                  ['Blood Type', selected.blood_type || 'Unknown'],
                  ['Gender', selected.gender || 'Not specified'],
                  ['Phone', selected.phone || '—'],
                  ['Email', selected.email],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {detailLoading ? <div className="loading"><div className="spinner" /></div> : details && (
            <>
              {/* Vitals */}
              {details.vitals?.length > 0 && (
                <div className="card mb-4">
                  <div className="card-header"><h3>Latest Vitals</h3></div>
                  <div className="card-body">
                    {(() => {
                      const v = details.vitals[0];
                      return (
                        <div className="grid grid-3 gap-2">
                          {[
                            ['BP', v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic}` : '—', 'mmHg'],
                            ['Heart Rate', v.heart_rate || '—', 'bpm'],
                            ['SpO2', v.oxygen_saturation ? `${v.oxygen_saturation}%` : '—', ''],
                            ['Weight', v.weight ? `${v.weight} kg` : '—', ''],
                            ['Steps', v.steps ? v.steps.toLocaleString() : '—', ''],
                            ['Sleep', v.sleep_hours ? `${v.sleep_hours}h` : '—', ''],
                          ].map(([l, val]) => (
                            <div key={l} style={{ textAlign: 'center', background: 'var(--bg)', borderRadius: 8, padding: 10 }}>
                              <div style={{ fontWeight: 700, fontSize: 16 }}>{val}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Allergies */}
              {details.allergies?.length > 0 && (
                <div className="card mb-4">
                  <div className="card-header"><h3>⚠️ Allergies</h3></div>
                  <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {details.allergies.map(a => (
                      <span key={a.id} className={`badge badge-${a.severity === 'severe' ? 'danger' : 'warning'}`}
                        style={{ fontSize: 13, padding: '4px 12px' }}>
                        {a.allergen} ({a.severity})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Lab Results */}
              {details.labs?.length > 0 && (
                <div className="card mb-4">
                  <div className="card-header"><h3>Lab Results</h3></div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Test</th><th>Result</th><th>Status</th><th>Date</th></tr></thead>
                      <tbody>
                        {details.labs.slice(0,5).map(l => (
                          <tr key={l.id}>
                            <td>{l.test_type}</td>
                            <td>{l.result}</td>
                            <td><span className={`badge badge-${l.status === 'normal' ? 'success' : l.status === 'critical' ? 'danger' : 'warning'}`}>{l.status}</span></td>
                            <td style={{ fontSize: 12 }}>{l.test_date ? new Date(l.test_date).toLocaleDateString('en-GB') : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Add Clinical Note */}
              <div className="card">
                <div className="card-header"><h3>Add Clinical Note</h3></div>
                <div className="card-body">
                  {noteMsg && <div className="alert alert-success">{noteMsg}</div>}
                  <form onSubmit={addNote}>
                    <div className="form-group">
                      <label className="form-label">Note Type</label>
                      <select className="form-control" value={noteForm.note_type}
                        onChange={e => setNoteForm({...noteForm, note_type: e.target.value})}>
                        {['general','follow_up','diagnosis','prescription','referral'].map(t => (
                          <option key={t} value={t}>{t.replace('_',' ')}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Note Content</label>
                      <textarea className="form-control" rows={4} required
                        value={noteForm.content} onChange={e => setNoteForm({...noteForm, content: e.target.value})} />
                    </div>
                    <button type="submit" className="btn btn-primary">Add Note</button>
                  </form>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
