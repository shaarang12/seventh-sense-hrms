'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2 } from 'lucide-react';
import styles from './settings.module.css';

export default function SettingsPage() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newDate, setNewDate] = useState('');
  const [newDesc, setNewDesc] = useState('');

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    setLoading(true);

    const { data } = await supabase.from('holidays').select('*').order('date', { ascending: true });
    if (data) {
      setHolidays(data);
    }
    setLoading(false);
  };

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!newDate || !newDesc) return;

    const { data, error } = await supabase.from('holidays').insert([{
      date: newDate,
      description: newDesc
    }]).select();

    if (!error && data) {
      setHolidays([...holidays, data[0]].sort((a, b) => new Date(a.date) - new Date(b.date)));
      setNewDate('');
      setNewDesc('');
    }
  };

  const handleDelete = async (id) => {
    await supabase.from('holidays').delete().eq('id', id);
    setHolidays(holidays.filter(h => h.id !== id));
  };

  return (
    <div className="container">
      <div className={styles.header}>
        <h1 className="text-2xl font-bold">Admin Settings</h1>
        <p className="text-secondary">Configure system defaults and public holidays.</p>
      </div>

      <div className={styles.settingsGrid}>
        {/* Holidays Configuration */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Public Holidays</h2>
          <p className="text-secondary text-sm mb-6">
            Days added here will automatically grant 1.0x Regular Pay to all active laborers, unless marked otherwise in attendance.
          </p>

          <form onSubmit={handleAddHoliday} className={styles.addForm}>
            <input 
              type="date" 
              className="input" 
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              required
            />
            <input 
              type="text" 
              className="input" 
              placeholder="Description (e.g. Christmas)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary whitespace-nowrap">
              <Plus size={18} className="mr-2" />
              Add
            </button>
          </form>

          {loading ? (
            <div className="text-center py-4 text-secondary">Loading...</div>
          ) : (
            <div className={styles.holidayList}>
              {holidays.length > 0 ? holidays.map(h => (
                <div key={h.id} className={styles.holidayItem}>
                  <div>
                    <div className="font-semibold">{new Date(h.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                    <div className="text-secondary text-sm">{h.description}</div>
                  </div>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => handleDelete(h.id)}
                    title="Remove Holiday"
                  >
                    <Trash2 size={16} className="text-danger" />
                  </button>
                </div>
              )) : (
                <div className="text-center py-4 text-secondary">No holidays configured.</div>
              )}
            </div>
          )}
        </div>

        {/* System Settings Placeholder */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">System Rules</h2>
          <div className={styles.settingRow}>
            <div>
              <div className="font-medium">Standard Work Week</div>
              <div className="text-sm text-secondary">Monday - Saturday (6 days)</div>
            </div>
          </div>
          <div className={styles.settingRow}>
            <div>
              <div className="font-medium">Standard Work Day</div>
              <div className="text-sm text-secondary">8 Hours</div>
            </div>
          </div>
          <div className={styles.settingRow}>
            <div>
              <div className="font-medium">Annual Leaves</div>
              <div className="text-sm text-secondary">Sick (12), Casual (8)</div>
            </div>
          </div>
          <div className={styles.settingRow}>
            <div>
              <div className="font-medium">Overtime Rate (1.0x)</div>
              <div className="text-sm text-secondary">Standard hourly wage for all overtime hours</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
