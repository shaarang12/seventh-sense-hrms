'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { aggregatePayouts } from '@/lib/payrollEngine';
import { Download, Filter } from 'lucide-react';
import styles from './payout.module.css';

export default function SalaryDashboard() {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState('weekly'); // daily, weekly, monthly

  useEffect(() => {
    fetchPayoutData();
  }, [filterPeriod]);

  const fetchPayoutData = async () => {
    setLoading(true);

    // In a real implementation, you would calculate date ranges based on filterPeriod
    // and fetch only those attendance records from Supabase.
    // For now, simulating fetching all recent records.

    const { data: laborers } = await supabase.from('laborers').select('*');
    const { data: attendanceRecords } = await supabase.from('attendance').select('*');
    const { data: allowances } = await supabase.from('allowances').select('*');

    if (laborers && attendanceRecords) {
      const aggregated = aggregatePayouts(laborers, attendanceRecords, allowances || []);
      setPayouts(aggregated);
    }

    setLoading(false);
  };

  const exportCSV = () => {
    if (payouts.length === 0) return;

    const headers = ['Worker Name', 'Role', 'Days Worked', 'Leaves Used', 'Tier 1 OT', 'Tier 2 OT', 'Base Pay', 'OT Pay', 'Allowances', 'Total Net Payable'];
    const rows = payouts.map(p => [
      p.laborer.full_name,
      p.laborer.role,
      p.totalDaysWorked,
      p.totalPaidLeavesUsed,
      p.totalTier1OTHours,
      p.totalTier2OTHours,
      `₹${p.basePayBreakdown.toFixed(2)}`,
      `₹${(p.tier1OTPayBreakdown + p.tier2OTPayBreakdown).toFixed(2)}`,
      `₹${p.totalAllowances.toFixed(2)}`,
      `₹${p.totalNetPayable.toFixed(2)}`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `payouts_${filterPeriod}.csv`);
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
          <p className="text-secondary">Review aggregated metrics and export payroll data.</p>
        </div>

        <div className={styles.actions}>
          <div className={styles.filterGroup}>
            <Filter size={18} className="text-secondary" />
            <select
              className={`input ${styles.filterSelect}`}
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={exportCSV} disabled={payouts.length === 0}>
            <Download size={18} className="mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      <div className={styles.summaryCards}>
        <div className="card">
          <h3 className="text-secondary text-sm font-semibold uppercase tracking-wider">Total Payout for Period</h3>
          <p className={styles.grandTotal}>₹{totalCompanyPayout.toFixed(2)}</p>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="text-center py-8 text-secondary">Calculating payouts...</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Attendance</th>
                  <th>Overtime (1.0x / 1.5x)</th>
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
                      <div className="text-secondary text-sm">{p.laborer.role}</div>
                    </td>
                    <td>
                      <div>Days: <span className="font-medium">{p.totalDaysWorked}</span></div>
                      <div className="text-sm text-secondary">Leaves: {p.totalPaidLeavesUsed}</div>
                    </td>
                    <td>
                      <div className={styles.otTags}>
                        <span className={styles.otTier1}>{p.totalTier1OTHours}h</span>
                        <span className={styles.otTier2}>{p.totalTier2OTHours}h</span>
                      </div>
                    </td>
                    <td>₹{p.basePayBreakdown.toFixed(2)}</td>
                    <td>₹{(p.tier1OTPayBreakdown + p.tier2OTPayBreakdown).toFixed(2)}</td>
                    <td className="text-primary font-medium">₹{p.totalAllowances.toFixed(2)}</td>
                    <td className={`${styles.amountCol} font-bold text-accent-primary`}>
                      ₹{p.totalNetPayable.toFixed(2)}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-secondary">
                      No records found for this period.
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
