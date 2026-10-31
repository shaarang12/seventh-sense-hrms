'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { aggregatePayouts } from '@/lib/payrollEngine';
import { Download, Calendar, ChevronDown } from 'lucide-react';
import styles from './payout.module.css';

const getCurrentMonthStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getTodayDateStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMonthDateRange = (monthStr) => {
  if (!monthStr) return { startDate: '', endDate: '', isCurrentMonth: false };

  const [yearStr, mStr] = monthStr.split('-');
  const year = Number(yearStr);
  const month = Number(mStr);

  const startDate = `${yearStr}-${mStr}-01`;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const isCurrentMonth = year === currentYear && month === currentMonth;

  let endDate;
  if (isCurrentMonth) {
    // Current month: from 1st of month till today (e.g. Oct 1 to Oct 30; or Nov 1 to Nov 1)
    endDate = getTodayDateStr();
  } else {
    // Past or future month: from 1st of month till last day of that month
    const lastDay = new Date(year, month, 0).getDate();
    endDate = `${yearStr}-${mStr}-${String(lastDay).padStart(2, '0')}`;
  }

  return { startDate, endDate, isCurrentMonth };
};

const formatMonthDisplay = (monthStr) => {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-').map(Number);
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const formatDateRangeDisplay = (startDate, endDate) => {
  if (!startDate || !endDate) return '';
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);

  const startD = new Date(sy, sm - 1, sd);
  const endD = new Date(ey, em - 1, ed);

  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${startD.toLocaleDateString('en-US', options)} – ${endD.toLocaleDateString('en-US', options)}`;
};

export default function SalaryDashboard() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthStr);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(() => getMonthDateRange(getCurrentMonthStr()));
  const monthInputRef = useRef(null);

  useEffect(() => {
    fetchPayoutData();
  }, [selectedMonth]);

  const fetchPayoutData = async () => {
    setLoading(true);

    const range = getMonthDateRange(selectedMonth);
    setDateRange(range);

    const { data: laborers } = await supabase
      .from('laborers')
      .select('*')
      .order('full_name', { ascending: true });

    const { data: attendanceRecords } = await supabase
      .from('attendance')
      .select('*')
      .gte('date', range.startDate)
      .lte('date', range.endDate);

    const { data: allowances } = await supabase
      .from('allowances')
      .select('*')
      .gte('date', range.startDate)
      .lte('date', range.endDate);

    if (laborers && attendanceRecords) {
      const aggregated = aggregatePayouts(laborers, attendanceRecords, allowances || []);
      setPayouts(aggregated);
    }

    setLoading(false);
  };

  const exportCSV = () => {
    if (payouts.length === 0) return;

    const headers = ['Worker Name', 'Role/Type', 'Days Worked', 'Leaves Used', 'Overtime (Hrs)', 'Base Pay', 'OT Pay', 'Allowances', 'Total Net Payable'];
    const rows = payouts.map(p => [
      p.laborer.full_name,
      p.laborer.role || p.laborer.wage_type,
      p.totalDaysWorked,
      p.totalPaidLeavesUsed,
      p.totalOvertimeHours ?? p.totalTier1OTHours,
      `₹${p.basePayBreakdown.toFixed(2)}`,
      `₹${(p.overtimePayBreakdown ?? (p.tier1OTPayBreakdown + p.tier2OTPayBreakdown)).toFixed(2)}`,
      `₹${p.totalAllowances.toFixed(2)}`,
      `₹${p.totalNetPayable.toFixed(2)}`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `payouts_${selectedMonth}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalCompanyPayout = payouts.reduce((sum, p) => sum + p.totalNetPayable, 0);

  return (
    <div className="container">
      <div className={styles.header}>
        <div>
          <h1 className="text-2xl font-bold">Salary & Payout Dashboard</h1>
          <p className="text-secondary">Review aggregated monthly payroll metrics and export records.</p>
        </div>

        <div className={styles.actions}>
          <div
            className={styles.monthPicker}
            onClick={() => {
              try {
                if (monthInputRef.current) {
                  if (typeof monthInputRef.current.showPicker === 'function') {
                    monthInputRef.current.showPicker();
                  } else {
                    monthInputRef.current.focus();
                  }
                }
              } catch (_) {}
            }}
            title="Click to select month and year"
          >
            <Calendar size={18} className={styles.calendarIcon} />
            <span className={styles.monthDisplay}>
              {formatMonthDisplay(selectedMonth)}
            </span>
            <ChevronDown size={15} className={styles.chevronIcon} />
            <input
              ref={monthInputRef}
              type="month"
              className={styles.hiddenMonthInput}
              value={selectedMonth}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedMonth(e.target.value);
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

          {selectedMonth !== getCurrentMonthStr() && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSelectedMonth(getCurrentMonthStr())}
              title="Return to current month"
            >
              Current Month
            </button>
          )}

          <button className="btn btn-primary" onClick={exportCSV} disabled={payouts.length === 0}>
            <Download size={18} className="mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      <div className={styles.summaryCards}>
        <div className="card">
          <div className={styles.summaryHeader}>
            <div>
              <h3 className="text-secondary text-sm font-semibold uppercase tracking-wider">
                Total Payout for {formatMonthDisplay(selectedMonth)}
              </h3>
              <p className={styles.grandTotal}>₹{totalCompanyPayout.toFixed(2)}</p>
            </div>
            <div className={styles.dateRangeBadge}>
              <Calendar size={15} className="text-secondary" />
              <span>{formatDateRangeDisplay(dateRange.startDate, dateRange.endDate)}</span>
              {dateRange.isCurrentMonth && (
                <span className={styles.todayIndicator}>Month to Date</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="text-center py-8 text-secondary">Calculating payouts for {formatMonthDisplay(selectedMonth)}...</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Attendance</th>
                  <th>Overtime (1.0x)</th>
                  <th>Base Pay</th>
                  <th>OT Pay</th>
                  <th>Allowances</th>
                  <th className={styles.amountCol}>Net Payable</th>
                </tr>
              </thead>
              <tbody>
                {payouts.length > 0 ? payouts.map(p => (
                  <tr key={p.laborer.id}>
                    <td>
                      <div className="font-semibold">{p.laborer.full_name}</div>
                      <div className="text-secondary text-sm">{p.laborer.role || `${p.laborer.wage_type} worker`}</div>
                    </td>
                    <td>
                      <div>Days: <span className="font-medium">{p.totalDaysWorked}</span></div>
                      <div className="text-sm text-secondary">Leaves: {p.totalPaidLeavesUsed}</div>
                    </td>
                    <td>
                      <div className={styles.otTags}>
                        <span className={styles.otTier1}>{(p.totalOvertimeHours ?? p.totalTier1OTHours)}h</span>
                      </div>
                    </td>
                    <td>₹{p.basePayBreakdown.toFixed(2)}</td>
                    <td>₹{(p.overtimePayBreakdown ?? (p.tier1OTPayBreakdown + p.tier2OTPayBreakdown)).toFixed(2)}</td>
                    <td className="text-primary font-medium">₹{p.totalAllowances.toFixed(2)}</td>
                    <td className={`${styles.amountCol} font-bold text-accent-primary`}>
                      ₹{p.totalNetPayable.toFixed(2)}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-secondary">
                      No records found for {formatMonthDisplay(selectedMonth)}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
