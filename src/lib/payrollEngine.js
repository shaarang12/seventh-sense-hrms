export const calculateDailyPay = (laborer, attendanceRecord) => {
  const { wage_type, rate_value } = laborer;
  const { status, overtime_hours } = attendanceRecord;

  let hourlyRate = 0;
  let dailyWage = 0;

  if (wage_type === 'hourly') {
    hourlyRate = rate_value;
    dailyWage = rate_value * 8;
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

  let tier1OTHours = 0;
  let tier2OTHours = 0;

  if (overtime_hours > 0) {
    if (overtime_hours <= 2) {
      tier1OTHours = overtime_hours;
    } else {
      tier1OTHours = 2;
      tier2OTHours = overtime_hours - 2;
    }
  }

  const tier1OTPay = tier1OTHours * hourlyRate * 1.0;
  const tier2OTPay = tier2OTHours * hourlyRate * 1.5;

  const totalDailyPay = regularDayPay + tier1OTPay + tier2OTPay;

  return {
    regularDayPay,
    tier1OTHours,
    tier1OTPay,
    tier2OTHours,
    tier2OTPay,
    totalDailyPay,
  };
};

export const aggregatePayouts = (laborers, attendanceRecords) => {
  const payouts = {};

  laborers.forEach(l => {
    payouts[l.id] = {
      laborer: l,
      totalDaysWorked: 0, // Present or Half Day
      totalPaidLeavesUsed: 0, // SL or CL
      totalHolidays: 0,
      totalTier1OTHours: 0,
      totalTier2OTHours: 0,
      basePayBreakdown: 0,
      tier1OTPayBreakdown: 0,
      tier2OTPayBreakdown: 0,
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

    payout.totalTier1OTHours += dailyCalc.tier1OTHours;
    payout.totalTier2OTHours += dailyCalc.tier2OTHours;
    
    payout.basePayBreakdown += dailyCalc.regularDayPay;
    payout.tier1OTPayBreakdown += dailyCalc.tier1OTPay;
    payout.tier2OTPayBreakdown += dailyCalc.tier2OTPay;
    
    payout.totalNetPayable += dailyCalc.totalDailyPay;
  });

  return Object.values(payouts);
};
