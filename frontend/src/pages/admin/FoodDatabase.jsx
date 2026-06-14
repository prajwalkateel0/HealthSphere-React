import { useState, useEffect } from 'react';
import api from '../../api/axios';

export default function FoodDatabase() {
  const [foods, setFoods] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '', fiber: '', allergens: '', health_rating: 'good' });

  const load = () => api.get('/admin/food-database', { params: { search } }).then(r => setFoods(r.data)).finally(() => setLoading(false));
  useEffect(load, [search]);

  const add = async (e) => {
    e.preventDefault();
    await api.post('/admin/food-database', form);
    load(); setShowModal(false);
    setForm({ name: '', calories: '', protein: '', carbs: '', fat: '', fiber: '', allergens: '', health_rating: 'good' });
  };

  const del = async (id) => {
    if (!confirm('Delete this food item?')) return;
    await api.delete(`/admin/food-database/${id}`);
    load();
  };

  const ratingBadge = (r) => {
    const m = { excellent: 'success', good: 'info', moderate: 'warning', poor: 'danger' };
    return <span className={`badge badge-${m[r] || 'gray'}`}>{r}</span>;
  };

  return (
    <div>
      <div className="flex-between mb-4">
        <input className="form-control" style={{ maxWidth: 300 }} placeholder="🔍 Search foods..." value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Food</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Calories</th><th>Protein</th><th>Carbs</th><th>Fat</th><th>Allergens</th><th>Rating</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8}><div className="loading"><div className="spinner" /></div></td></tr>
              : foods.map(f => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 600 }}>🍎 {f.name}</td>
                  <td>{f.calories || '—'}</td>
                  <td>{f.protein ? `${f.protein}g` : '—'}</td>
                  <td>{f.carbs ? `${f.carbs}g` : '—'}</td>
                  <td>{f.fat ? `${f.fat}g` : '—'}</td>
                  <td style={{ fontSize: 12 }}>{f.allergens || 'None'}</td>
                  <td>{ratingBadge(f.health_rating)}</td>
                  <td><button className="btn btn-sm btn-danger" onClick={() => del(f.id)}>Delete</button></td>
                </tr>
              ))}
              {!loading && !foods.length && <tr><td colSpan={8}><div className="empty-state">No food items</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h3>Add Food Item</h3><button className="modal-close" onClick={() => setShowModal(false)}>✕</button></div>
            <form onSubmit={add}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Name *</label><input className="form-control" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
                <div className="grid grid-2 gap-2">
                  {['calories','protein','carbs','fat','fiber'].map(f => (
                    <div className="form-group" key={f}><label className="form-label">{f}</label><input type="number" className="form-control" value={form[f]} onChange={e => setForm({...form, [f]: e.target.value})} /></div>
                  ))}
                </div>
                <div className="form-group"><label className="form-label">Allergens</label><input className="form-control" placeholder="e.g. Milk, Wheat" value={form.allergens} onChange={e => setForm({...form, allergens: e.target.value})} /></div>
                <div className="form-group">
                  <label className="form-label">Health Rating</label>
                  <select className="form-control" value={form.health_rating} onChange={e => setForm({...form, health_rating: e.target.value})}>
                    {['excellent','good','moderate','poor'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">Add Food</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
