import { useState, useEffect } from 'react';
import api from '../../api/axios';

export default function Diseases() {
  const [diseases, setDiseases] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', inheritance_type: '', symptoms: '', food_triggers: '', exercise_guidance: '', care_plan: '' });
  const [expanded, setExpanded] = useState(null);

  const load = () => api.get('/admin/diseases').then(r => setDiseases(r.data));
  useEffect(load, []);

  const add = async (e) => {
    e.preventDefault();
    await api.post('/admin/diseases', form);
    load(); setShowModal(false);
    setForm({ name: '', inheritance_type: '', symptoms: '', food_triggers: '', exercise_guidance: '', care_plan: '' });
  };

  const del = async (id) => {
    if (!confirm('Delete this disease?')) return;
    await api.delete(`/admin/diseases/${id}`);
    load();
  };

  return (
    <div>
      <div className="flex-between mb-4">
        <h3 style={{ color: 'var(--text-muted)' }}>{diseases.length} conditions in registry</h3>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Disease</button>
      </div>

      <div className="grid grid-auto gap-4">
        {diseases.map(d => (
          <div className="card" key={d.id}>
            <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === d.id ? null : d.id)}>
              <div>
                <h3>🧬 {d.name}</h3>
                {d.inheritance_type && <span className="badge badge-purple">{d.inheritance_type}</span>}
              </div>
              <button className="btn btn-ghost btn-sm">{expanded === d.id ? '▲' : '▼'}</button>
            </div>
            {expanded === d.id && (
              <div className="card-body" style={{ display: 'grid', gap: 10 }}>
                {[
                  ['Symptoms', d.symptoms],
                  ['Food Triggers', d.food_triggers],
                  ['Exercise Guidance', d.exercise_guidance],
                  ['Care Plan', d.care_plan],
                ].filter(([,v]) => v).map(([label, value]) => (
                  <div key={label} style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 13 }}>{value}</div>
                  </div>
                ))}
                <button className="btn btn-sm btn-danger" onClick={() => del(d.id)}>Delete</button>
              </div>
            )}
          </div>
        ))}
        {!diseases.length && (
          <div className="card"><div className="empty-state"><div className="empty-icon">🧬</div><p>No diseases in registry</p></div></div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header"><h3>Add Genetic Disease</h3><button className="modal-close" onClick={() => setShowModal(false)}>✕</button></div>
            <form onSubmit={add}>
              <div className="modal-body">
                <div className="grid grid-2 gap-2">
                  <div className="form-group"><label className="form-label">Disease Name *</label><input className="form-control" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Inheritance Type</label><input className="form-control" placeholder="e.g. Autosomal Dominant" value={form.inheritance_type} onChange={e => setForm({...form, inheritance_type: e.target.value})} /></div>
                </div>
                {[['symptoms','Symptoms'],['food_triggers','Food Triggers'],['exercise_guidance','Exercise Guidance'],['care_plan','Care Plan']].map(([key, label]) => (
                  <div className="form-group" key={key}><label className="form-label">{label}</label><textarea className="form-control" rows={2} value={form[key]} onChange={e => setForm({...form, [key]: e.target.value})} /></div>
                ))}
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">Add Disease</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
