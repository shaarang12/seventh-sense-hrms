'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { aggregatePayouts } from '@/lib/payrollEngine';
import styles from './page.module.css';

export default function DashboardOverview() {
  const [stats, setStats] = useState({
    activeLaborers: 0,
    attendanceToday: 0,
    pendingPayouts: 0,
    nextHoliday: 'None'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardStats() {
      setLoading(true);
      
      const today = new Date().toISOString().split('T')[0];
      
      // 1. Fetch active laborers count
      const { data: laborers } = await supabase
        .from('laborers')
        .select('*')
        .eq('is_active', true);
        
      const activeLaborers = laborers ? laborers.length : 0;
      
      // 2. Fetch today's attendance
      const { data: attendanceToday } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', today)
        .neq('status', 'absent');
        
      const presentCount = attendanceToday ? attendanceToday.length : 0;
      
      // 3. Next Holiday
      const { data: holidays } = await supabase
        .from('holidays')
        .select('date, description')
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(1);
        
      let nextHolStr = 'None';
      if (holidays && holidays.length > 0) {
        const d = new Date(holidays[0].date);
        nextHolStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }

      // 4. Calculate Payouts for the current month
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const { data: monthAttendance } = await supabase
        .from('attendance')
        .select('*')
        .gte('date', startOfMonth)
        .lte('date', today);
        
      let totalPayouts = 0;
      if (laborers && monthAttendance) {
        const payouts = aggregatePayouts(laborers, monthAttendance);
        totalPayouts = payouts.reduce((sum, p) => sum + p.totalNetPayable, 0);
      }

      setStats({
        activeLaborers,
        attendanceToday: presentCount,
        pendingPayouts: totalPayouts,
        nextHoliday: nextHolStr
      });
      
      setLoading(false);
    }
    
    fetchDashboardStats();
  }, []);

  return (
    <div className="container">
      <div className={styles.header}>
        <h1 className="text-2xl font-bold">Dashboard Overview</h1>
        <p className="text-secondary">Welcome back, Super User.</p>
      </div>

      <div className={styles.statsGrid}>
        <div className="card">
          <h3 className="text-secondary">Active Laborers</h3>
          <p className={styles.statValue}>
            {loading ? '...' : stats.activeLaborers}
          </p>
        </div>
        <div className="card">
          <h3 className="text-secondary">Today's Attendance</h3>
          <p className={styles.statValue}>
            {loading ? '...' : `${stats.attendanceToday} / ${stats.activeLaborers}`}
          </p>
        </div>
        <div className="card">
          <h3 className="text-secondary">Month Payouts</h3>
          <p className={styles.statValue}>
            {loading ? '...' : `₹${stats.pendingPayouts.toFixed(2)}`}
          </p>
        </div>
        <div className="card">
          <h3 className="text-secondary">Next Holiday</h3>
          <p className={styles.statValue}>
            {loading ? '...' : stats.nextHoliday}
          </p>
        </div>
      </div>
      
      <div className={styles.recentActivity}>
        <h2 className="text-2xl font-semibold mb-4">Recent Activity</h2>
        <div className="card">
          <p className="text-secondary">No recent activity to show right now.</p>
        </div>
      </div>
    </div>
  );
}
