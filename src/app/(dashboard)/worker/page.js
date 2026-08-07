'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Search, Edit2, Trash2, X } from 'lucide-react';
import styles from './labor.module.css';

export default function LaborRegistry() {
  const [laborers, setLaborers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLaborer, setEditingLaborer] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    mobile_number: '',
    wage_type: 'daily',
    rate_value: '',
  });

  useEffect(() => {
    fetchLaborers();
  }, []);

  const fetchLaborers = async () => {
    setLoading(true);

    const { data: laborersData, error: laborersError } = await supabase
      .from('laborers')
      .select('*')
      .order('full_name', { ascending: true });
      
    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('laborer_id, status')
      .in('status', ['sl', 'cl']);

    if (!laborersError && laborersData) {
      const usedLeaves = {};
      if (attendanceData) {
        attendanceData.forEach(record => {
          if (!usedLeaves[record.laborer_id]) usedLeaves[record.laborer_id] = { sl: 0, cl: 0 };
          if (record.status === 'sl') usedLeaves[record.laborer_id].sl += 1;
          if (record.status === 'cl') usedLeaves[record.laborer_id].cl += 1;
        });
      }

      const enhancedLaborers = laborersData.map(l => ({
        ...l,
        remaining_sl: l.sl_balance - (usedLeaves[l.id]?.sl || 0),
        remaining_cl: l.cl_balance - (usedLeaves[l.id]?.cl || 0),
      }));

      setLaborers(enhancedLaborers);
    }
    setLoading(false);
  };

  const openAddModal = () => {
    setEditingLaborer(null);
    setFormData({
      full_name: '',
      mobile_number: '',
      wage_type: 'daily',
      rate_value: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (laborer) => {
    setEditingLaborer(laborer);
    setFormData({
      full_name: laborer.full_name,
      mobile_number: laborer.mobile_number,
      wage_type: laborer.wage_type,
      rate_value: laborer.rate_value,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    if (editingLaborer) {
      // Update
      const { data, error } = await supabase
        .from('laborers')
        .update({ ...formData, rate_value: Number(formData.rate_value) })
        .eq('id', editingLaborer.id)
        .select();
      if (!error && data) {
        setLaborers(laborers.map(l => l.id === editingLaborer.id ? data[0] : l));
      }
    } else {
      // Add
      const { data, error } = await supabase
        .from('laborers')
        .insert([{ ...formData, rate_value: Number(formData.rate_value) }])
        .select();
      if (!error && data) {
        setLaborers([...laborers, data[0]]);
      }
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to deactivate/remove this laborer?')) return;
    
    await supabase.from('laborers').delete().eq('id', id);
    setLaborers(laborers.filter(l => l.id !== id));
  };

  const filteredLaborers = laborers.filter(l =>
    l.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container relative">
      <div className={styles.header}>
        <div>
          <h1 className="text-2xl font-bold">Worker Registry</h1>
          <p className="text-secondary">Manage worker profiles and leave balances.</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={18} className="mr-2" />
          Add Worker
        </button>
      </div>

      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by name..."
            className={`input ${styles.searchInput}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="text-center py-8 text-secondary">Loading laborers...</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Wage Rate</th>
                  <th>Leaves (SL/CL)</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLaborers.length > 0 ? (
                  filteredLaborers.map((laborer) => (
                    <tr key={laborer.id}>
                      <td>
                        <div className="font-semibold">{laborer.full_name}</div>
                      </td>
                      <td>{laborer.mobile_number}</td>
                      <td>
                        {laborer.wage_type === 'hourly'
                          ? `₹${laborer.rate_value}/hr`
                          : laborer.wage_type === 'monthly'
                          ? `₹${laborer.rate_value}/month`
                          : `₹${laborer.rate_value}/day`}
                      </td>
                      <td>
                        <div className={styles.leaveBalances}>
                          <span className={`${styles.leaveTag} ${styles.slTag}`}>SL: {laborer.remaining_sl}</span>
                          <span className={`${styles.leaveTag} ${styles.clTag}`}>CL: {laborer.remaining_cl}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${laborer.is_active ? 'badge-success' : 'badge-danger'}`}>
                          {laborer.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button className={styles.iconBtn} onClick={() => openEditModal(laborer)} title="Edit">
                            <Edit2 size={16} />
                          </button>
                          <button className={`${styles.iconBtn} ${styles.dangerIconBtn}`} onClick={() => handleDelete(laborer.id)} title="Deactivate">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-secondary">
                      No workers found matching your search.
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
              <h2 className="text-xl font-bold">{editingLaborer ? 'Edit Worker' : 'Add Worker'}</h2>
              <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className={styles.formGroup}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Full Name</label>
                <input
                  type="text"
                  className="input"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Mobile Number</label>
                <input
                  type="text"
                  className="input"
                  required
                  value={formData.mobile_number}
                  onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                />
              </div>



              <div className={styles.rowGroup}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Wage Type</label>
                  <select
                    className="input"
                    value={formData.wage_type}
                    onChange={(e) => setFormData({ ...formData, wage_type: e.target.value })}
                  >
                    <option value="daily">Daily</option>
                    <option value="hourly">Hourly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>Rate Value (₹)</label>
                  <input
                    type="number"
                    className="input"
                    required
                    min="0"
                    step="0.01"
                    value={formData.rate_value}
                    onChange={(e) => setFormData({ ...formData, rate_value: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingLaborer ? 'Update' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
