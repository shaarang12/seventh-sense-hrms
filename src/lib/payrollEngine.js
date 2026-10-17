export const calculateDailyPay = (laborer, attendanceRecord) => {
  const { wage_type, rate_value } = laborer;
  const { status, overtime_hours } = attendanceRecord;

  let hourlyRate = 0;
  let dailyWage = 0;

  if (wage_type === 'hourly') {
    hourlyRate = rate_value;
    dailyWage = rate_value * 8;
  } else if (wage_type === 'monthly') {
    dailyWage = rate_value / 26;
    hourlyRate = dailyWage / 8;
  } else {
    dailyWage = rate_value;
    hourlyRate = rate_value / 8;
  }

  let attendanceMultiplier = 0;
  switch (status) {
    case 'present':
    case 'holiday':
    case 'sl':
    case 'cl':
      attendanceMultiplier = 1.0;
      break;
    case 'half_day':
      attendanceMultiplier = 0.5;
      break;
    case 'absent':
    default:
      attendanceMultiplier = 0;
      break;
  }

  const regularDayPay = dailyWage * attendanceMultiplier;

  const overtimeHours = Number(overtime_hours) > 0 ? Number(overtime_hours) : 0;
  const overtimePay = overtimeHours * hourlyRate * 1.0;

  const totalDailyPay = regularDayPay + overtimePay;

  return {
    regularDayPay,
    overtimeHours,
    overtimePay,
    // Kept for backward compatibility
    tier1OTHours: overtimeHours,
    tier1OTPay: overtimePay,
    tier2OTHours: 0,
    tier2OTPay: 0,
    totalDailyPay,
  };
};

export const aggregatePayouts = (laborers, attendanceRecords, allowances = []) => {
  const payouts = {};

  laborers.forEach(l => {
    payouts[l.id] = {
      laborer: l,
      totalDaysWorked: 0, // Present or Half Day
      totalPaidLeavesUsed: 0, // SL or CL
      totalHolidays: 0,
      totalOvertimeHours: 0,
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

    if (record.status === 'present' || record.status === 'half_day') {
      payout.totalDaysWorked += (record.status === 'half_day' ? 0.5 : 1.0);
    } else if (record.status === 'sl' || record.status === 'cl') {
      payout.totalPaidLeavesUsed += 1.0;
    } else if (record.status === 'holiday') {
      payout.totalHolidays += 1.0;
    }

    payout.totalOvertimeHours += dailyCalc.overtimeHours;
    payout.totalTier1OTHours += dailyCalc.tier1OTHours;
    payout.totalTier2OTHours += dailyCalc.tier2OTHours;
    
    payout.basePayBreakdown += dailyCalc.regularDayPay;
    payout.overtimePayBreakdown += dailyCalc.overtimePay;
    payout.tier1OTPayBreakdown += dailyCalc.tier1OTPay;
    payout.tier2OTPayBreakdown += dailyCalc.tier2OTPay;
    
    payout.totalNetPayable += dailyCalc.totalDailyPay;
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
