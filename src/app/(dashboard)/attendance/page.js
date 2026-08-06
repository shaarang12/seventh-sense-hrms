'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import styles from './attendance.module.css';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present', short: 'P' },
  { value: 'absent', label: 'Absent', short: 'A' },
  { value: 'half_day', label: 'Half Day', short: 'HD' },
  { value: 'sl', label: 'Sick Leave', short: 'SL' },
  { value: 'cl', label: 'Casual Leave', short: 'CL' },
];

export default function AttendanceMatrix() {
  const [date, setDate] = useState(new Date());
  const [laborers, setLaborers] = useState([]);
  const [attendance, setAttendance] = useState({}); // { laborerId: { status, overtime } }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isHoliday, setIsHoliday] = useState(false);

  useEffect(() => {
    fetchData();
  }, [date]);

  const fetchData = async () => {
    setLoading(true);
    const dateStr = date.toISOString().split('T')[0];

    const { data: laborersData } = await supabase.from('laborers').select('id, full_name, role').eq('is_active', true);
    if (laborersData) setLaborers(laborersData);

    const { data: attendanceData } = await supabase.from('attendance').select('*').eq('date', dateStr);

    const attMap = {};
    if (attendanceData) {
      attendanceData.forEach(record => {
        attMap[record.laborer_id] = { status: record.status, overtime: record.overtime_hours };
      });
    }
    setAttendance(attMap);

    const { data: holidayData } = await supabase.from('holidays').select('*').eq('date', dateStr).single();
    setIsHoliday(!!holidayData);

    setLoading(false);
  };

  const changeDate = (days) => {
    const newDate = new Date(date);
    newDate.setDate(date.getDate() + days);
    setDate(newDate);
  };

  const handleStatusChange = (laborerId, status) => {
    setAttendance(prev => ({
      ...prev,
      [laborerId]: { ...prev[laborerId], status }
    }));
  };

  const handleOvertimeChange = (laborerId, overtime) => {
    setAttendance(prev => ({
      ...prev,
      [laborerId]: { ...prev[laborerId], overtime: parseFloat(overtime) || 0 }
    }));
  };

  const saveAttendance = async () => {
    setSaving(true);
    const dateStr = date.toISOString().split('T')[0];

    const recordsToUpsert = laborers.map(laborer => ({
      laborer_id: laborer.id,
      date: dateStr,
      status: attendance[laborer.id]?.status || 'present',
      overtime_hours: parseFloat(attendance[laborer.id]?.overtime) || 0
    }));

    if (recordsToUpsert.length > 0) {
      const { error } = await supabase
        .from('attendance')
        .upsert(recordsToUpsert, { onConflict: 'laborer_id,date' });
      
      if (error) {
        console.error('Error saving attendance:', error);
        alert('Failed to save attendance.');
      }
    }

    if (isHoliday) {
      await supabase.from('holidays').upsert({ date: dateStr, description: 'Public Holiday' }, { onConflict: 'date' });
    } else {
      await supabase.from('holidays').delete().eq('date', dateStr);
    }

    setSaving(false);
    alert('Attendance saved successfully!');
  };

  return (
    <div className="container">
      <div className={styles.header}>
        <div>
          <h1 className="text-2xl font-bold">Daily Attendance Matrix</h1>
          <p className="text-secondary">Mark attendance and record overtime efficiently.</p>
        </div>

        <div className={styles.dateControls}>
          <button className="btn btn-secondary" onClick={() => changeDate(-1)}>
            <ChevronLeft size={20} />
          </button>
          <div className={styles.currentDate}>
            {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <button className="btn btn-secondary" onClick={() => changeDate(1)}>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <label className={styles.holidayToggle}>
          <input
            type="checkbox"
            checked={isHoliday}
            onChange={(e) => setIsHoliday(e.target.checked)}
          />
          <span className={styles.toggleSlider}></span>
          <span className={styles.toggleLabel}>Mark as Public Holiday</span>
        </label>

        <button
          className={`btn btn-primary ${styles.saveBtn}`}
          onClick={saveAttendance}
          disabled={saving || loading}
        >
          <Save size={18} className="mr-2" />
          {saving ? 'Saving...' : 'Save Attendance'}
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="text-center py-8 text-secondary">Loading matrix...</div>
        ) : isHoliday ? (
          <div className={styles.holidayState}>
            <h3>🌴 Public Holiday Declared</h3>
            <p>All active laborers will receive regular pay for this day.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className={styles.matrixTable}>
              <thead>
                <tr>
                  <th className={styles.nameCol}>Laborer</th>
                  <th>Attendance Status</th>
                  <th className={styles.otCol}>Overtime (Hrs)</th>
                </tr>
              </thead>
              <tbody>
                {laborers.map((laborer) => {
                  const currentStatus = attendance[laborer.id]?.status || 'present';
                  const currentOT = attendance[laborer.id]?.overtime || '';

                  return (
                    <tr key={laborer.id}>
                      <td className={styles.nameCol}>
                        <div className="font-semibold">{laborer.full_name}</div>
                        <div className="text-secondary text-sm">{laborer.role}</div>
                      </td>
                      <td>
                        <div className={styles.statusSelector}>
                          {STATUS_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              className={`${styles.statusBtn} ${currentStatus === opt.value ? styles.statusBtnActive : ''} ${currentStatus === opt.value ? styles[`status_${opt.value}`] : ''}`}
                              onClick={() => handleStatusChange(laborer.id, opt.value)}
                            >
                              <span className={styles.statusShort}>{opt.short}</span>
                              <span className={styles.statusLabel}>{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className={styles.otCol}>
                        <input
                          type="number"
                          min="0"
                          max="24"
                          step="0.5"
                          className={`input ${styles.otInput}`}
                          placeholder="0"
                          value={currentOT}
                          onChange={(e) => handleOvertimeChange(laborer.id, e.target.value)}
                          disabled={currentStatus === 'absent'}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
