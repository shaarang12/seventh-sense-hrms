'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { isSundayDate } from '@/lib/payrollEngine';
import { Calendar, ChevronDown, Save } from 'lucide-react';
import styles from './attendance.module.css';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present', short: 'P' },
  { value: 'absent', label: 'Absent', short: 'A' },
  { value: 'half_day', label: 'Half Day', short: 'HD' },
  { value: 'sl', label: 'Sick Leave', short: 'SL' },
  { value: 'cl', label: 'Casual Leave', short: 'CL' },
];

const getTodayDateStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export default function AttendanceMatrix() {
  const [selectedDate, setSelectedDate] = useState(getTodayDateStr);
  const [laborers, setLaborers] = useState([]);
  const [attendance, setAttendance] = useState({}); // { laborerId: { status, overtime } }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isHoliday, setIsHoliday] = useState(false);
  const dateInputRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    const dateStr = selectedDate;

    const { data: laborersData } = await supabase.from('laborers').select('id, full_name').eq('is_active', true);
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

  const isSunday = isSundayDate(selectedDate);

  const handleStatusChange = (laborerId, status) => {
    setAttendance(prev => {
      const updated = { ...prev[laborerId], status };
      if (!isSunday && ['absent', 'sl', 'cl'].includes(status)) {
        updated.overtime = 0;
      }
      return {
        ...prev,
        [laborerId]: updated
      };
    });
  };

  const handleOvertimeChange = (laborerId, overtime) => {
    setAttendance(prev => ({
      ...prev,
      [laborerId]: { ...prev[laborerId], overtime: parseFloat(overtime) || 0 }
    }));
  };

  const saveAttendance = async () => {
    setSaving(true);
    const dateStr = selectedDate;

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
          <div
            className={styles.calendarPicker}
            onClick={() => {
              try {
                if (dateInputRef.current) {
                  if (typeof dateInputRef.current.showPicker === 'function') {
                    dateInputRef.current.showPicker();
                  } else {
                    dateInputRef.current.focus();
                  }
                }
              } catch (_) {}
            }}
            title="Click to select date from calendar"
          >
            <Calendar size={18} className={styles.calendarIcon} />
            <span className={styles.dateDisplay}>
              {formatDisplayDate(selectedDate)}
            </span>
            <ChevronDown size={15} className={styles.chevronIcon} />
            <input
              ref={dateInputRef}
              type="date"
              className={styles.hiddenDateInput}
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(e.target.value);
                }
              }}
              onClick={(e) => {
                try {
                  if (typeof e.target.showPicker === 'function') {
                    e.target.showPicker();
                  }
                } catch (_) {}
              }}
            />
          </div>

          {selectedDate !== getTodayDateStr() && (
            <button
              type="button"
              className={`btn btn-secondary ${styles.todayBtn}`}
              onClick={() => setSelectedDate(getTodayDateStr())}
              title="Jump to today's date"
            >
              Today
            </button>
          )}
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

      {isSunday && (
        <div className="card" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'var(--accent-primary)', marginBottom: '1.25rem', padding: '0.85rem 1.25rem' }}>
          <div className="font-semibold" style={{ color: 'var(--accent-primary)' }}>☀️ Sunday (Weekly Off)</div>
          <div className="text-secondary text-sm">Sundays are treated as non-working days. Any work or hours logged today are automatically credited as Overtime without penalizing regular pay.</div>
        </div>
      )}

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
                  <th className={styles.nameCol}>Worker</th>
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
                          disabled={!isSunday && ['absent', 'sl', 'cl'].includes(currentStatus)}
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
