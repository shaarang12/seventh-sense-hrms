export const isSundayDate = (dateStr) => {
  if (!dateStr) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.getDay() === 0;
};

export const calculateDailyPay = (laborer, attendanceRecord) => {
  const { wage_type, rate_value } = laborer;
  const { status, overtime_hours, date } = attendanceRecord;

  let hourlyRate = 0;
  let dailyWage = 0;

  if (wage_type === 'hourly') {
    hourlyRate = Number(rate_value);
    dailyWage = hourlyRate * 8;
  } else if (wage_type === 'monthly') {
    // 26 working days standard divisor
    dailyWage = Number(rate_value) / 26;
    hourlyRate = dailyWage / 8;
  } else {
    // daily
    dailyWage = Number(rate_value);
    hourlyRate = dailyWage / 8;
  }

  const isSunday = isSundayDate(date);
  const rawOT = Number(overtime_hours) > 0 ? Number(overtime_hours) : 0;

  // RULE: Sundays are treated as non-working days. Any work logged for a worker on Sundays is treated as overtime.
  if (isSunday) {
    let sundayOTHours = 0;
    if (status === 'present') {
      // Full regular day on Sunday is 8 hours OT + any extra OT logged
      sundayOTHours = 8 + rawOT;
    } else if (status === 'half_day') {
      sundayOTHours = 4 + rawOT;
    } else {
      // Absent or leave on Sunday has 0 deduction; any explicit OT hours logged counts as OT
      sundayOTHours = rawOT;
    }

    const overtimePay = sundayOTHours * hourlyRate * 1.0;
    return {
      regularDayPay: 0,
      overtimeHours: sundayOTHours,
      overtimePay,
      absenteeDeduction: 0,
      isSunday: true,
      totalDailyPay: overtimePay,
      // Backward compatibility fields
      tier1OTHours: sundayOTHours,
      tier1OTPay: overtimePay,
      tier2OTHours: 0,
      tier2OTPay: 0,
    };
  }

  // Monday - Saturday (Regular Working Days)
  let attendanceMultiplier = 0;
  let absenteeDeduction = 0;

  switch (status) {
    case 'present':
    case 'holiday':
    case 'sl':
    case 'cl':
      attendanceMultiplier = 1.0;
      absenteeDeduction = 0;
      break;
    case 'half_day':
      attendanceMultiplier = 0.5;
      absenteeDeduction = dailyWage * 0.5;
      break;
    case 'absent':
    default:
      attendanceMultiplier = 0;
      absenteeDeduction = dailyWage * 1.0;
      break;
  }

  const regularDayPay = dailyWage * attendanceMultiplier;
  const overtimeHours = rawOT;
  const overtimePay = overtimeHours * hourlyRate * 1.0;
  const totalDailyPay = regularDayPay + overtimePay;

  return {
    regularDayPay,
    overtimeHours,
    overtimePay,
    absenteeDeduction,
    isSunday: false,
    totalDailyPay,
    // Backward compatibility fields
    tier1OTHours: overtimeHours,
    tier1OTPay: overtimePay,
    tier2OTHours: 0,
    tier2OTPay: 0,
  };
};

export const aggregatePayouts = (laborers, attendanceRecords, allowances = [], options = {}) => {
  const mode = options.mode || 'monthly'; // 'monthly' (subtractive for monthly workers) or 'daily_additive'
  const payouts = {};

  laborers.forEach(l => {
    payouts[l.id] = {
      laborer: l,
      totalDaysWorked: 0, // Present or Half Day (including Sunday work)
      totalPaidLeavesUsed: 0, // SL or CL
      totalHolidays: 0,
      totalAbsentDays: 0, // Monday-Saturday absences (1 for absent, 0.5 for half day)
      totalAbsenteeDeduction: 0,
      totalOvertimeHours: 0,
      totalSundayOTHours: 0,
      totalTier1OTHours: 0,
      totalTier2OTHours: 0,
      basePayBreakdown: 0,
      overtimePayBreakdown: 0,
      tier1OTPayBreakdown: 0,
      tier2OTPayBreakdown: 0,
      totalAllowances: 0,
      totalNetPayable: 0,
    };
  });

  attendanceRecords.forEach(record => {
    const laborer = laborers.find(l => l.id === record.laborer_id);
    if (!laborer) return;

    const payout = payouts[laborer.id];
    const dailyCalc = calculateDailyPay(laborer, record);

    if (dailyCalc.isSunday) {
      payout.totalOvertimeHours += dailyCalc.overtimeHours;
      payout.totalSundayOTHours += dailyCalc.overtimeHours;
      payout.totalTier1OTHours += dailyCalc.overtimeHours;
      payout.overtimePayBreakdown += dailyCalc.overtimePay;
      payout.tier1OTPayBreakdown += dailyCalc.overtimePay;

      if (record.status === 'present' || record.status === 'half_day') {
        payout.totalDaysWorked += (record.status === 'half_day' ? 0.5 : 1.0);
      }
    } else {
      if (record.status === 'present' || record.status === 'half_day') {
        payout.totalDaysWorked += (record.status === 'half_day' ? 0.5 : 1.0);
      } else if (record.status === 'sl' || record.status === 'cl') {
        payout.totalPaidLeavesUsed += 1.0;
      } else if (record.status === 'holiday') {
        payout.totalHolidays += 1.0;
      } else if (record.status === 'absent') {
        payout.totalAbsentDays += 1.0;
      }

      if (record.status === 'half_day') {
        payout.totalAbsentDays += 0.5;
      }

      payout.totalAbsenteeDeduction += dailyCalc.absenteeDeduction;
      payout.totalOvertimeHours += dailyCalc.overtimeHours;
      payout.totalTier1OTHours += dailyCalc.overtimeHours;
      payout.overtimePayBreakdown += dailyCalc.overtimePay;
      payout.tier1OTPayBreakdown += dailyCalc.overtimePay;

      if (mode === 'daily_additive' || laborer.wage_type !== 'monthly') {
        payout.basePayBreakdown += dailyCalc.regularDayPay;
      }
    }
  });

  // Calculate Base Pay & Net Pay for each laborer
  laborers.forEach(l => {
    const payout = payouts[l.id];

    if (mode === 'monthly' && l.wage_type === 'monthly') {
      const grossBase = Number(l.rate_value);
      payout.basePayBreakdown = Math.max(0, grossBase - payout.totalAbsenteeDeduction);
    }

    payout.totalNetPayable = payout.basePayBreakdown + payout.overtimePayBreakdown;
  });

  allowances.forEach(allowance => {
    const laborer = laborers.find(l => l.id === allowance.laborer_id);
    if (!laborer) return;

    const payout = payouts[laborer.id];
    payout.totalAllowances += Number(allowance.amount);
    payout.totalNetPayable += Number(allowance.amount);
  });

  return Object.values(payouts);
};
