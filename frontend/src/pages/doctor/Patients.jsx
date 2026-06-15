import { useState, useEffect } from 'react';
import api from '../../api/axios';

const TEST_TYPES = ['Blood Test','Urine Test','Lipid Panel','Thyroid Function','X-Ray','MRI','CT Scan','ECG','HbA1c','Blood Glucose','Full Blood Count','Liver Function'];
const FREQUENCIES = ['Once daily (morning)','Once daily (night)','Twice daily','Three times daily','Every 8 hours','As needed (PRN)','Weekly'];
const FILE_BASE = (api.defaults.baseURL || '').replace(/\/api\/?$/, '');

const PTABS = [
  ['labs', 'fa-flask', 'Lab Results'],
  ['rx', 'fa-pills', 'Prescriptions'],
  ['add-lab', 'fa-plus-circle', 'Add Lab Result'],
  ['add-rx', 'fa-prescription', 'Add Prescription'],
  ['notes', 'fa-notes-medical', 'Notes'],
];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function labStatusBadge(s) {
  const m = { normal: 'success', elevated: 'warning', low: 'info', critical: 'danger', pending: 'gray' };
  return <span className={`badge badge-${m[s] || 'gray'}`}>{s}</span>;
}

export default function DoctorPatients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tab, setTab] = useState('labs');

  const [noteForm, setNoteForm] = useState({ note_type: 'general', content: '' });
  const [noteMsg, setNoteMsg] = useState(null);

  const [labForm, setLabForm] = useState({ test_type: '', result: '', status: 'normal', notes: '', test_date: new Date().toISOString().split('T')[0] });
  const [labFile, setLabFile] = useState(null);
  const [labSubmitting, setLabSubmitting] = useState(false);
  const [labMsg, setLabMsg] = useState(null);

  const [rxForm, setRxForm] = useState({ medication_name: '', dosage: '', frequency: '', duration: '30', start_date: new Date().toISOString().split('T')[0], instructions: '' });
  const [rxFile, setRxFile] = useState(null);
  const [rxSubmitting, setRxSubmitting] = useState(false);
  const [rxMsg, setRxMsg] = useState(null);

  useEffect(() => {
    api.get('/doctor/patients', { params: { search } }).then(r => setPatients(r.data)).finally(() => setLoading(false));
  }, [search]);

  const reloadDetails = async (id) => {
    const r = await api.get(`/doctor/patients/${id}`);
    setDetails(r.data);
    return r.data;
  };

  const viewDetails = async (patient) => {
    setSelected(patient);
    setTab('labs');
    setLabMsg(null);
    setRxMsg(null);
    setDetailLoading(true);
    await reloadDetails(patient.id);
    setDetailLoading(false);
  };

  const addNote = async (e) => {
    e.preventDefault();
    await api.post('/doctor/clinical-notes', { patient_id: selected.id, ...noteForm });
    setNoteMsg('Note added!');
    setNoteForm({ note_type: 'general', content: '' });
    await reloadDetails(selected.id);
    setTimeout(() => setNoteMsg(null), 3000);
  };

  const addLabResult = async (e) => {
    e.preventDefault();
    if (!labForm.test_type || !labForm.result) return;
    setLabSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('patient_id', selected.id);
      Object.entries(labForm).forEach(([k, v]) => fd.append(k, v));
      if (labFile) fd.append('file', labFile);
      await api.post('/doctor/lab-results', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await reloadDetails(selected.id);
      setLabForm({ test_type: '', result: '', status: 'normal', notes: '', test_date: new Date().toISOString().split('T')[0] });
      setLabFile(null);
      setLabMsg(`Lab result added and is now visible to the patient.`);
      setTab('labs');
    } catch (err) {
      setLabMsg(err.response?.data?.error || 'Failed to add lab result.');
    } finally { setLabSubmitting(false); }
  };

  const addPrescription = async (e) => {
    e.preventDefault();
    if (!rxForm.medication_name || !rxForm.dosage || !rxForm.frequency) return;
    setRxSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('patient_id', selected.id);
      const duration = parseInt(rxForm.duration, 10) || 30;
      const end = new Date(rxForm.start_date);
      end.setDate(end.getDate() + duration);
      Object.entries(rxForm).forEach(([k, v]) => fd.append(k, v));
      fd.append('end_date', end.toISOString().split('T')[0]);
      if (rxFile) fd.append('file', rxFile);
      await api.post('/doctor/prescriptions', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await reloadDetails(selected.id);
      setRxForm({ medication_name: '', dosage: '', frequency: '', duration: '30', start_date: new Date().toISOString().split('T')[0], instructions: '' });
      setRxFile(null);
      setRxMsg(`Prescription for ${rxForm.medication_name} added successfully.`);
      setTab('rx');
    } catch (err) {
      setRxMsg(err.response?.data?.error || 'Failed to add prescription.');
    } finally { setRxSubmitting(false); }
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
                display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between',
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
                    NHS: {p.nhs_id} · Last: {p.last_visit ? new Date(p.last_visit).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'N/A'}
                  </div>
                  {p.allergy && (
                    <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }}>
                      <i className="fas fa-exclamation-triangle" /> {p.allergy}
                    </div>
                  )}
                </div>
              </div>
              {p.bp_sys && (
                <div style={{ textAlign: 'right', fontSize: 12, flexShrink: 0 }}>
                  <div style={{ fontWeight: 700 }}>{p.bp_sys}/{p.bp_sys - 42}</div>
                  <div style={{ color: 'var(--text-muted)' }}>mmHg</div>
                </div>
              )}
            </div>
          ))
        )}
        {!loading && !patients.length && <div className="empty-state"><div className="empty-icon">👥</div><p>No patients found</p></div>}
      </div>

      {/* Patient Details */}
      {selected && (
        <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 130px)' }}>
          {/* Header */}
          <div className="card mb-4">
            <div className="card-body" style={{ background: 'var(--primary)', borderRadius: 11, color: '#fff', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, flexShrink: 0 }}>
                {selected.name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: 18 }}>{selected.name}</h4>
                <div style={{ fontSize: 13, opacity: .8 }}>
                  NHS ID: {selected.nhs_id} · DOB: {selected.date_of_birth ? new Date(selected.date_of_birth).toLocaleDateString('en-GB') : '—'} · Blood: {selected.blood_type || '—'}
                </div>
              </div>
              <a href="/doctor/messages" className="btn btn-sm btn-primary"><i className="fas fa-comment" /> Message</a>
              <button className="btn btn-sm btn-ghost" style={{ color: '#fff' }} onClick={() => setSelected(null)}>✕</button>
            </div>
          </div>

          {/* Quick info grid */}
          <div className="card mb-4">
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
                            ['Heart Rate', v.heartRate || '—', 'bpm'],
                            ['SpO2', v.oxygenSaturation ? `${v.oxygenSaturation}%` : '—', ''],
                            ['Weight', v.weight ? `${v.weight} kg` : '—', ''],
                            ['Steps', v.steps ? v.steps.toLocaleString() : '—', ''],
                            ['Sleep', v.sleepHours ? `${v.sleepHours}h` : '—', ''],
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

              {/* Tab nav */}
              <div style={{ display: 'flex', gap: 4, background: '#fff', borderRadius: 10, padding: 5, border: '1px solid var(--border)', marginBottom: 14, width: 'fit-content', flexWrap: 'wrap' }}>
                {PTABS.map(([k, ic, lbl]) => (
                  <button key={k} onClick={() => setTab(k)}
                    style={{
                      padding: '7px 14px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      background: tab === k ? 'var(--primary-light)' : 'transparent',
                      color: tab === k ? '#fff' : 'var(--text-muted)', fontFamily: 'inherit', whiteSpace: 'nowrap',
                    }}>
                    <i className={`fas ${ic}`} /> {lbl}
                  </button>
                ))}
              </div>

              {/* Lab Results */}
              {tab === 'labs' && (
                <div className="card mb-4">
                  <div className="card-header">
                    <h3><i className="fas fa-flask" /> Lab Results ({details.labs?.length || 0})</h3>
                    <button className="btn btn-sm btn-outline" onClick={() => setTab('add-lab')}>+ Add Result</button>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Test</th><th>Result</th><th>Status</th><th>Date</th><th>File</th></tr></thead>
                      <tbody>
                        {details.labs?.length ? details.labs.map(l => (
                          <tr key={l.id}>
                            <td style={{ fontWeight: 600 }}>{l.testType}</td>
                            <td style={{ fontSize: 12, maxWidth: 220 }}>{l.result}</td>
                            <td>{labStatusBadge(l.status)}</td>
                            <td style={{ fontSize: 12 }}>{l.testDate ? new Date(l.testDate).toLocaleDateString('en-GB') : '—'}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              {l.filePath ? (
                                <a href={`${FILE_BASE}/uploads/${l.filePath}`} target="_blank" rel="noreferrer" download
                                  style={{ fontSize: 11, background: '#16A34A', color: '#fff', padding: '3px 8px', borderRadius: 4, textDecoration: 'none', fontWeight: 600 }}>
                                  <i className="fas fa-download" /> File
                                </a>
                              ) : <span style={{ fontSize: 11, color: '#ccc' }}>—</span>}
                            </td>
                          </tr>
                        )) : <tr><td colSpan={5}><div className="empty-state">No lab results yet</div></td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Prescriptions */}
              {tab === 'rx' && (
                <div className="card mb-4">
                  <div className="card-header">
                    <h3><i className="fas fa-pills" /> Prescriptions ({details.prescriptions?.length || 0})</h3>
                    <button className="btn btn-sm btn-outline" onClick={() => setTab('add-rx')}>+ New Prescription</button>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Medication</th><th>Dosage</th><th>Frequency</th><th>Start</th><th>End</th><th>Status</th><th>File</th></tr></thead>
                      <tbody>
                        {details.prescriptions?.length ? details.prescriptions.map(m => {
                          const ended = m.endDate && new Date(m.endDate) < new Date();
                          return (
                            <tr key={m.id}>
                              <td><strong>{m.medicationName}</strong><br /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.instructions || ''}</span></td>
                              <td>{m.dosage}</td>
                              <td>{m.frequency}</td>
                              <td style={{ fontSize: 12 }}>{m.startDate ? new Date(m.startDate).toLocaleDateString('en-GB') : '—'}</td>
                              <td style={{ fontSize: 12, color: ended ? 'var(--danger)' : 'inherit' }}>{m.endDate ? new Date(m.endDate).toLocaleDateString('en-GB') : '—'}</td>
                              <td><span className={`badge badge-${m.status === 'active' ? 'success' : 'gray'}`}>{m.status}</span></td>
                              <td>
                                {m.filePath ? (
                                  <a href={`${FILE_BASE}/uploads/${m.filePath}`} target="_blank" rel="noreferrer" download
                                    style={{ fontSize: 11, background: '#7C3AED', color: '#fff', padding: '3px 8px', borderRadius: 4, textDecoration: 'none', fontWeight: 600 }}>
                                    <i className="fas fa-download" /> File
                                  </a>
                                ) : <span style={{ fontSize: 11, color: '#ccc' }}>—</span>}
                              </td>
                            </tr>
                          );
                        }) : <tr><td colSpan={7}><div className="empty-state">No prescriptions yet</div></td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Add Lab Result */}
              {tab === 'add-lab' && (
                <div className="card mb-4">
                  <div className="card-header"><h3><i className="fas fa-plus-circle" style={{ color: '#16A34A' }} /> Add Lab Result</h3></div>
                  <div className="card-body">
                    {labMsg && <div className="alert alert-success mb-3">{labMsg}</div>}
                    <form onSubmit={addLabResult}>
                      <div className="grid grid-2 gap-2">
                        <div className="form-group">
                          <label className="form-label">Test Type *</label>
                          <select className="form-control" required value={labForm.test_type}
                            onChange={e => setLabForm({ ...labForm, test_type: e.target.value })}>
                            <option value="">Select test</option>
                            {TEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Result Status *</label>
                          <select className="form-control" value={labForm.status}
                            onChange={e => setLabForm({ ...labForm, status: e.target.value })}>
                            {['normal','elevated','low','critical','pending'].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Result / Findings *</label>
                        <textarea className="form-control" rows={3} required placeholder="e.g. Haemoglobin 13.5 g/dL — within normal range..."
                          value={labForm.result} onChange={e => setLabForm({ ...labForm, result: e.target.value })} />
                      </div>
                      <div className="grid grid-2 gap-2">
                        <div className="form-group">
                          <label className="form-label">Test Date</label>
                          <input type="date" className="form-control" value={labForm.test_date}
                            onChange={e => setLabForm({ ...labForm, test_date: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label className="form-label"><i className="fas fa-paperclip" /> Attach File (optional)</label>
                          <input type="file" className="form-control" accept=".pdf,.jpg,.jpeg,.png"
                            onChange={e => setLabFile(e.target.files[0] || null)} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Clinical Notes (optional)</label>
                        <textarea className="form-control" rows={2} placeholder="Clinical interpretation, recommendations..."
                          value={labForm.notes} onChange={e => setLabForm({ ...labForm, notes: e.target.value })} />
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button type="submit" className="btn btn-primary" disabled={labSubmitting}>
                          <i className="fas fa-save" /> {labSubmitting ? 'Saving...' : 'Save & Notify Patient'}
                        </button>
                        <button type="button" className="btn btn-outline" onClick={() => setTab('labs')}>Cancel</button>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
                        <i className="fas fa-info-circle" /> This result will immediately appear in the patient's Medical Records dashboard.
                      </p>
                    </form>
                  </div>
                </div>
              )}

              {/* Add Prescription */}
              {tab === 'add-rx' && (
                <div className="card mb-4">
                  <div className="card-header"><h3><i className="fas fa-prescription" style={{ color: '#7C3AED' }} /> Add Prescription</h3></div>
                  <div className="card-body">
                    {rxMsg && <div className="alert alert-success mb-3">{rxMsg}</div>}
                    <form onSubmit={addPrescription}>
                      <div className="grid grid-2 gap-2">
                        <div className="form-group">
                          <label className="form-label">Medication Name *</label>
                          <input className="form-control" required placeholder="e.g. Metformin" value={rxForm.medication_name}
                            onChange={e => setRxForm({ ...rxForm, medication_name: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Dosage *</label>
                          <input className="form-control" required placeholder="e.g. 500mg" value={rxForm.dosage}
                            onChange={e => setRxForm({ ...rxForm, dosage: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Frequency *</label>
                          <select className="form-control" required value={rxForm.frequency}
                            onChange={e => setRxForm({ ...rxForm, frequency: e.target.value })}>
                            <option value="">Select frequency...</option>
                            {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Duration</label>
                          <select className="form-control" value={rxForm.duration}
                            onChange={e => setRxForm({ ...rxForm, duration: e.target.value })}>
                            <option value="7">7 days</option>
                            <option value="14">14 days</option>
                            <option value="30">1 month</option>
                            <option value="60">2 months</option>
                            <option value="90">3 months</option>
                            <option value="180">6 months</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Start Date</label>
                          <input type="date" className="form-control" value={rxForm.start_date}
                            onChange={e => setRxForm({ ...rxForm, start_date: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Special Instructions</label>
                          <input className="form-control" placeholder="e.g. Take with food" value={rxForm.instructions}
                            onChange={e => setRxForm({ ...rxForm, instructions: e.target.value })} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label"><i className="fas fa-paperclip" /> Attach Prescription File (optional)</label>
                        <input type="file" className="form-control" accept=".pdf,.jpg,.jpeg,.png"
                          onChange={e => setRxFile(e.target.files[0] || null)} />
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button type="submit" className="btn btn-primary" disabled={rxSubmitting}>
                          <i className="fas fa-pills" /> {rxSubmitting ? 'Saving...' : 'Issue Prescription'}
                        </button>
                        <button type="button" className="btn btn-outline" onClick={() => setTab('rx')}>Cancel</button>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
                        <i className="fas fa-info-circle" /> This prescription will immediately appear in the patient's Medications tab.
                      </p>
                    </form>
                  </div>
                </div>
              )}

              {/* Notes */}
              {tab === 'notes' && (
                <div className="card">
                  <div className="card-header"><h3><i className="fas fa-notes-medical" /> Clinical Notes</h3></div>
                  <div className="card-body">
                    {noteMsg && <div className="alert alert-success mb-3">{noteMsg}</div>}
                    {!details.notes?.length && <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14 }}>No notes yet.</p>}
                    {details.notes?.map(note => (
                      <div key={note.id} style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, marginBottom: 10, borderLeft: '3px solid var(--primary-light)' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                          Dr. {note.doctor_name} · {timeAgo(note.createdAt)}
                        </div>
                        <p style={{ fontSize: 13, margin: 0 }}>{note.content}</p>
                      </div>
                    ))}
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
                        <textarea className="form-control" rows={2} required placeholder="Add clinical note..."
                          value={noteForm.content} onChange={e => setNoteForm({...noteForm, content: e.target.value})} />
                      </div>
                      <button type="submit" className="btn btn-primary btn-sm"><i className="fas fa-save" /> Add Note</button>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
