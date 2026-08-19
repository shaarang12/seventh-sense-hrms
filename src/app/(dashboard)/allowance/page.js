'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Search, Trash2, X } from 'lucide-react';
import styles from './allowance.module.css';

export default function AllowanceRegistry() {
  const [allowances, setAllowances] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    laborer_id: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    // Fetch workers
    const { data: workersData } = await supabase
      .from('laborers')
      .select('id, full_name')
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    if (workersData) setWorkers(workersData);

    // Fetch allowances
    const { data: allowancesData } = await supabase
      .from('allowances')
      .select('*, laborers(full_name)')
      .order('date', { ascending: false });

    if (allowancesData) setAllowances(allowancesData);

    setLoading(false);
  };

  const openAddModal = () => {
    setFormData({
      laborer_id: workers.length > 0 ? workers[0].id : '',
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    const { data, error } = await supabase
      .from('allowances')
      .insert([{
        laborer_id: formData.laborer_id,
        amount: Number(formData.amount),
        description: formData.description,
        date: formData.date
      }])
      .select('*, laborers(full_name)');
      
    if (!error && data) {
      setAllowances([data[0], ...allowances]);
      setIsModalOpen(false);
    } else {
      alert('Error saving allowance. Please check database constraint.');
      console.error(error);
    }
    
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this allowance?')) return;
    
    await supabase.from('allowances').delete().eq('id', id);
    setAllowances(allowances.filter(a => a.id !== id));
  };

  const filteredAllowances = allowances.filter(a =>
    a.laborers?.full_name.toLowerCase().includes(search.toLowerCase()) ||
    a.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container relative">
      <div className={styles.header}>
        <div>
          <h1 className="text-2xl font-bold">Allowances</h1>
          <p className="text-secondary">Manage and track extra payouts for workers.</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={18} className="mr-2" />
          Add Allowance
        </button>
      </div>

      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by worker or description..."
            className={`input ${styles.searchInput}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="text-center py-8 text-secondary">Loading allowances...</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Worker Name</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAllowances.length > 0 ? (
                  filteredAllowances.map((allowance) => (
                    <tr key={allowance.id}>
                      <td>{new Date(allowance.date).toLocaleDateString()}</td>
                      <td>
                        <div className="font-semibold">{allowance.laborers?.full_name || 'Unknown'}</div>
                      </td>
                      <td>{allowance.description}</td>
                      <td className="font-semibold text-primary">
                        ₹{allowance.amount.toFixed(2)}
                      </td>
                      <td>
                        <button className={`${styles.iconBtn} ${styles.dangerIconBtn}`} onClick={() => handleDelete(allowance.id)} title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-secondary">
                      No allowances found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 className="text-xl font-bold">Add Allowance</h2>
              <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className={styles.formGroup}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Worker</label>
                <select
                  className="input"
                  required
                  value={formData.laborer_id}
                  onChange={(e) => setFormData({ ...formData, laborer_id: e.target.value })}
                >
                  <option value="" disabled>Select a worker...</option>
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>{w.full_name}</option>
                  ))}
                </select>
              </div>
              
              <div className={styles.rowGroup}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Amount (₹)</label>
                  <input
                    type="number"
                    className="input"
                    required
                    min="0"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  />
                </div>
                
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Date</label>
                  <input
                    type="date"
                    className="input"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Description</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Travel, Food, Bonus"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className={styles.modalActions}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Allowance'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
