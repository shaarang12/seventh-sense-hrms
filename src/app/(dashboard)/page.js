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
  const [activities, setActivities] = useState([]);
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

      // 4. Calculate Payouts for the current week (Monday to Saturday)
      const now = new Date();
      const currentDay = now.getDay();
      const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;
      const startOfWeekDate = new Date(now);
      startOfWeekDate.setDate(now.getDate() - daysToMonday);
      const startOfWeek = startOfWeekDate.toISOString().split('T')[0];
      
      const { data: weekAttendance } = await supabase
        .from('attendance')
        .select('*')
        .gte('date', startOfWeek)
        .lte('date', today);
        
      let totalPayouts = 0;
      if (laborers && weekAttendance) {
        const payouts = aggregatePayouts(laborers, weekAttendance);
        totalPayouts = payouts.reduce((sum, p) => sum + p.totalNetPayable, 0);
      }

      // Generate Recent Activities
      const newActivities = [];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      
      if (laborers) {
        laborers.forEach(l => {
          const cDate = new Date(l.created_at);
          if (cDate >= sevenDaysAgo) {
            newActivities.push({
              id: `reg-${l.id}`,
              type: 'registration',
              message: `${l.full_name} was registered`,
              date: cDate
            });
          }
        });
      }

      if (weekAttendance && laborers) {
        const laborerMap = {};
        laborers.forEach(l => laborerMap[l.id] = l.full_name);

        weekAttendance.forEach(a => {
          const aDate = new Date(a.date);
          if (a.status === 'sl' || a.status === 'cl') {
            newActivities.push({
              id: `leave-${a.id}`,
              type: 'leave',
              message: `${laborerMap[a.laborer_id]} took a ${a.status.toUpperCase()}`,
              date: aDate
            });
          }
          if (a.overtime_hours > 0) {
            newActivities.push({
              id: `ot-${a.id}`,
              type: 'overtime',
              message: `${laborerMap[a.laborer_id]} logged ${a.overtime_hours} hrs overtime`,
              date: aDate
            });
          }
        });
      }

      if (holidays && holidays.length > 0) {
        const hDate = new Date(holidays[0].date);
        const next7Days = new Date(now);
        next7Days.setDate(now.getDate() + 7);
        if (hDate <= next7Days && hDate >= now) {
          newActivities.push({
            id: `hol-${holidays[0].id}`,
            type: 'holiday',
            message: `Upcoming Holiday: ${holidays[0].description}`,
            date: hDate
          });
        }
      }

      newActivities.sort((a, b) => b.date - a.date);
      setActivities(newActivities.slice(0, 5));

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
          <h3 className="text-secondary">Weekly Payouts</h3>
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
          {loading ? (
             <p className="text-secondary">Loading activity...</p>
          ) : activities.length > 0 ? (
            <ul className={styles.activityList}>
              {activities.map(act => (
                <li key={act.id} className={styles.activityItem}>
                  <div className={styles.activityIcon}>
                     {act.type === 'registration' ? '👤' : act.type === 'leave' ? '🤒' : act.type === 'overtime' ? '⏱️' : '🌴'}
                  </div>
                  <div>
                    <p>{act.message}</p>
                    <span className="text-xs text-secondary">{act.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-secondary">No recent activity to show right now.</p>
          )}
        </div>
      </div>
    </div>
  );
}
