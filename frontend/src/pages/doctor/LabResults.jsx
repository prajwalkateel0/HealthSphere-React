import { useState, useEffect } from 'react';
import api from '../../api/axios';

const TEST_TYPES = ['Blood Test','Urine Test','Lipid Panel','Thyroid Function','X-Ray','MRI','CT Scan','ECG','HbA1c','Blood Glucose','Full Blood Count','Liver Function'];

export default function LabResults() {
  const [labs, setLabs] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ patient_id: '', test_type: '', result: '', status: 'normal', notes: '', test_date: new Date().toISOString().split('T')[0] });
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    Promise.all([
      api.get('/doctor/lab-results'),
      api.get('/doctor/patients'),
    ]).then(([labsRes, patientsRes]) => {
      setLabs(labsRes.data);
      setPatients(patientsRes.data);
    }).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/doctor/lab-results', form);
      load();
      setShowModal(false);
      setForm({ patient_id: '', test_type: '', result: '', status: 'normal', notes: '', test_date: new Date().toISOString().split('T')[0] });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    } finally { setSubmitting(false); }
  };

  const statusBadge = (s) => {
    const m = { normal: 'success', elevated: 'warning', low: 'info', critical: 'danger', pending: 'gray' };
    return <span className={`badge badge-${m[s] || 'gray'}`}>{s}</span>;
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="flex-between mb-4">
        <div />
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Lab Result</button>
      </div>

      <div className="card">
        <div className="card-header">
          <h3><i className="fas fa-flask" /> Lab Results ({labs.length})</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Patient</th><th>NHS ID</th><th>Test</th><th>Result</th><th>Status</th><th>Date</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {labs.length ? labs.map(l => (
                <tr key={l.id}>
                  <td style={{ fontWeight: 600 }}>{l.patient_name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{l.nhs_id}</td>
                  <td>{l.test_type}</td>
                  <td>{l.result}</td>
                  <td>{statusBadge(l.status)}</td>
                  <td>{l.test_date ? new Date(l.test_date).toLocaleDateString('en-GB') : '—'}</td>
                  <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.notes || '—'}</td>
                </tr>
              )) : <tr><td colSpan={7}><div className="empty-state">No lab results</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Add Lab Result</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Patient *</label>
                  <select className="form-control" required value={form.patient_id}
                    onChange={e => setForm({...form, patient_id: e.target.value})}>
                    <option value="">Select patient</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.name} — {p.nhs_id}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Test Type *</label>
                  <select className="form-control" required value={form.test_type}
                    onChange={e => setForm({...form, test_type: e.target.value})}>
                    <option value="">Select test</option>
                    {TEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="grid grid-2 gap-2">
                  <div className="form-group">
                    <label className="form-label">Result *</label>
                    <input className="form-control" required value={form.result}
                      onChange={e => setForm({...form, result: e.target.value})} placeholder="e.g. 120 mg/dL" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-control" value={form.status}
                      onChange={e => setForm({...form, status: e.target.value})}>
                      {['normal','elevated','low','critical','pending'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Test Date</label>
                  <input type="date" className="form-control" value={form.test_date}
                    onChange={e => setForm({...form, test_date: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-control" rows={3} value={form.notes}
                    onChange={e => setForm({...form, notes: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Result'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
