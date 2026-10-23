import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  PieChart as PieIcon,
  Calendar,
  Award,
  Percent,
  ArrowUpRight,
  Sparkles,
  Clock,
  Filter,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { useGymData } from '../context/GymDataContext';
import { formatEGP } from '../utils/formatters';

type PeriodMode = 'day' | 'month' | 'year';

const ARABIC_MONTH_LABELS = [
  'يناير',
  'فبراير',
  'مارس',
  'إبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

export const AnalyticsPage: React.FC = () => {
  const { expenses, cashInflows, transactions, physioBookings, yearlyArchives } = useGymData();

  // Period mode: 'day' | 'month' | 'year'
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');

  // Selected Date States
  const todayIso = new Date().toISOString().slice(0, 10);
  const currentMonthIso = new Date().toISOString().slice(0, 7);
  const currentYearNum = new Date().getFullYear();

  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthIso);
  const [selectedYear, setSelectedYear] = useState<number>(currentYearNum);

  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // Helper date shortcuts
  const handleSetToday = () => {
    setSelectedDate(todayIso);
  };

  const handleSetYesterday = () => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    setSelectedDate(y.toISOString().slice(0, 10));
  };

  const handleSetCurrentMonth = () => {
    setSelectedMonth(currentMonthIso);
  };

  const handleSetPreviousMonth = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${d.getFullYear()}-${m}`);
  };

  const handleSetCurrentYear = () => {
    setSelectedYear(currentYearNum);
  };

  const handleSetPreviousYear = () => {
    setSelectedYear(currentYearNum - 1);
  };

  // 1. FILTER LIVE DATA STRICTLY ACCORDING TO SELECTED PERIOD
  const filteredData = useMemo(() => {
    let matchDate: (dateStr?: string) => boolean;

    if (periodMode === 'day') {
      matchDate = (dateStr?: string) => !!dateStr && dateStr.startsWith(selectedDate);
    } else if (periodMode === 'month') {
      matchDate = (dateStr?: string) => !!dateStr && dateStr.startsWith(selectedMonth);
    } else {
      matchDate = (dateStr?: string) => !!dateStr && dateStr.startsWith(String(selectedYear));
    }

    const matchedInflows = cashInflows.filter((inf) => matchDate(inf.date));
    const matchedExpenses = expenses.filter((exp) => matchDate(exp.date));
    const matchedTransactions = transactions.filter((tx) => matchDate(tx.timestamp));
    const matchedPhysio = physioBookings.filter(
      (b) => b.status === 'completed' && matchDate(b.startTime)
    );

    return {
      inflows: matchedInflows,
      expenses: matchedExpenses,
      transactions: matchedTransactions,
      physio: matchedPhysio,
    };
  }, [
    cashInflows,
    expenses,
    transactions,
    physioBookings,
    periodMode,
    selectedDate,
    selectedMonth,
    selectedYear,
  ]);

  // Check if current periodMode === 'year' matches an archived year
  const archivedYearData = useMemo(() => {
    if (periodMode !== 'year') return undefined;
    return yearlyArchives?.find((a) => a.year === selectedYear);
  }, [periodMode, yearlyArchives, selectedYear]);

  // 2. LIVE REVENUE CALCULATIONS (Strictly real data, zero fake numbers)
  const totalSubRevenue = filteredData.inflows
    .filter(
      (i) =>
        i.type === 'subscription' ||
        i.type === 'manual_deposit' ||
        i.type === 'coach_settlement'
    )
    .reduce((acc, i) => acc + i.amount, 0);

  const totalPosRevenue = filteredData.transactions.reduce(
    (acc, t) => acc + t.totalAmount,
    0
  );

  const totalPhysioRevenue = filteredData.physio.reduce(
    (acc, p) => acc + p.totalFee,
    0
  );

  const liveTotalRevenue = totalSubRevenue + totalPosRevenue + totalPhysioRevenue;
  const totalRevenue = archivedYearData ? archivedYearData.totalRevenue : liveTotalRevenue;

  // 3. LIVE EXPENSE CALCULATIONS (Strictly real data)
  const currentExpensesList = archivedYearData
    ? archivedYearData.expensesSnapshot || []
    : filteredData.expenses;

  const totalCoachExpense = currentExpensesList
    .filter((e) => e.category === 'trainer_payout')
    .reduce((acc, e) => acc + e.amount, 0);

  const totalElectricityExpense = currentExpensesList
    .filter((e) => e.category === 'electricity')
    .reduce((acc, e) => acc + e.amount, 0);

  const totalWaterExpense = currentExpensesList
    .filter((e) => e.category === 'water')
    .reduce((acc, e) => acc + e.amount, 0);

  const totalMaintenanceExpense = currentExpensesList
    .filter((e) => e.category === 'maintenance')
    .reduce((acc, e) => acc + e.amount, 0);

  const totalOtherExpenses = currentExpensesList
    .filter((e) => ['rent', 'supplies', 'other'].includes(e.category))
    .reduce((acc, e) => acc + e.amount, 0);

  const liveTotalExpenses = filteredData.expenses.reduce((acc, e) => acc + e.amount, 0);
  const totalExpenses = archivedYearData ? archivedYearData.totalExpenses : liveTotalExpenses;
  const netProfit = archivedYearData ? archivedYearData.netProfit : totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

  // 4. DYNAMIC BAR CHART DATASET ACCORDING TO PERIOD
  const currentDataset = useMemo(() => {
    if (periodMode === 'day') {
      // 6 time slots throughout the day
      const slots = [
        { label: '08:00 - 11:00', startH: 8, endH: 11 },
        { label: '11:00 - 14:00', startH: 11, endH: 14 },
        { label: '14:00 - 17:00', startH: 14, endH: 17 },
        { label: '17:00 - 20:00', startH: 17, endH: 20 },
        { label: '20:00 - 23:00', startH: 20, endH: 23 },
        { label: '23:00 - 02:00', startH: 23, endH: 26 },
      ];

      return slots.map((slot) => {
        const isInSlot = (dateStr?: string) => {
          if (!dateStr || !dateStr.startsWith(selectedDate)) return false;
          try {
            const h = new Date(dateStr).getHours();
            if (slot.endH === 26) {
              return h >= 23 || h < 2;
            }
            return h >= slot.startH && h < slot.endH;
          } catch {
            return false;
          }
        };

        const subRev = filteredData.inflows
          .filter(
            (i) =>
              isInSlot(i.date) &&
              (i.type === 'subscription' ||
                i.type === 'manual_deposit' ||
                i.type === 'coach_settlement')
          )
          .reduce((acc, i) => acc + i.amount, 0);

        const posRev = filteredData.transactions
          .filter((t) => isInSlot(t.timestamp))
          .reduce((acc, t) => acc + t.totalAmount, 0);

        const physRev = filteredData.physio
          .filter((p) => isInSlot(p.startTime))
          .reduce((acc, p) => acc + p.totalFee, 0);

        const exp = filteredData.expenses
          .filter((e) => isInSlot(e.date))
          .reduce((acc, e) => acc + e.amount, 0);

        const rev = subRev + posRev + physRev;
        return {
          label: slot.label,
          revenue: rev,
          expense: exp,
          profit: rev - exp,
        };
      });
    }

    if (periodMode === 'month') {
      // 4 weeks of the selected month
      const weeks = [
        { label: 'الأسبوع 1 (1 - 7)', startDay: 1, endDay: 7 },
        { label: 'الأسبوع 2 (8 - 14)', startDay: 8, endDay: 14 },
        { label: 'الأسبوع 3 (15 - 21)', startDay: 15, endDay: 21 },
        { label: 'الأسبوع 4 (22 - 31)', startDay: 22, endDay: 31 },
      ];

      return weeks.map((w) => {
        const isInWeek = (dateStr?: string) => {
          if (!dateStr || !dateStr.startsWith(selectedMonth)) return false;
          try {
            const day = new Date(dateStr).getDate();
            return day >= w.startDay && day <= w.endDay;
          } catch {
            return false;
          }
        };

        const subRev = filteredData.inflows
          .filter(
            (i) =>
              isInWeek(i.date) &&
              (i.type === 'subscription' ||
                i.type === 'manual_deposit' ||
                i.type === 'coach_settlement')
          )
          .reduce((acc, i) => acc + i.amount, 0);

        const posRev = filteredData.transactions
          .filter((t) => isInWeek(t.timestamp))
          .reduce((acc, t) => acc + t.totalAmount, 0);

        const physRev = filteredData.physio
          .filter((p) => isInWeek(p.startTime))
          .reduce((acc, p) => acc + p.totalFee, 0);

        const exp = filteredData.expenses
          .filter((e) => isInWeek(e.date))
          .reduce((acc, e) => acc + e.amount, 0);

        const rev = subRev + posRev + physRev;
        return {
          label: w.label,
          revenue: rev,
          expense: exp,
          profit: rev - exp,
        };
      });
    }

    // Yearly: check if archived snapshot exists
    if (periodMode === 'year' && archivedYearData?.monthlyStats && archivedYearData.monthlyStats.length > 0) {
      return archivedYearData.monthlyStats.map((stat) => ({
        label: stat.monthName,
        revenue: stat.revenue,
        expense: stat.expenses,
        profit: stat.netProfit,
      }));
    }

    // Yearly: 12 months live
    return ARABIC_MONTH_LABELS.map((monthName, idx) => {
      const monthPrefix = `${selectedYear}-${String(idx + 1).padStart(2, '0')}`;

      const isInMonth = (dateStr?: string) => !!dateStr && dateStr.startsWith(monthPrefix);

      const subRev = filteredData.inflows
        .filter(
          (i) =>
            isInMonth(i.date) &&
            (i.type === 'subscription' ||
              i.type === 'manual_deposit' ||
              i.type === 'coach_settlement')
        )
        .reduce((acc, i) => acc + i.amount, 0);

      const posRev = filteredData.transactions
        .filter((t) => isInMonth(t.timestamp))
        .reduce((acc, t) => acc + t.totalAmount, 0);

      const physRev = filteredData.physio
        .filter((p) => isInMonth(p.startTime))
        .reduce((acc, p) => acc + p.totalFee, 0);

      const exp = filteredData.expenses
        .filter((e) => isInMonth(e.date))
        .reduce((acc, e) => acc + e.amount, 0);

      const rev = subRev + posRev + physRev;
      return {
        label: monthName,
        revenue: rev,
        expense: exp,
        profit: rev - exp,
      };
    });
  }, [periodMode, selectedDate, selectedMonth, selectedYear, filteredData, archivedYearData]);

  // Dynamic Scale for Bars
  const rawMax = Math.max(
    ...currentDataset.map((d) => Math.max(d.revenue, d.expense, Math.abs(d.profit))),
    0
  );
  const maxVal = rawMax > 0 ? rawMax : 1000;
  const isAllZeroData = rawMax === 0;

  // 5. REVENUE BREAKDOWN (Zero-fake numbers)
  const revenueBreakdown = useMemo(() => {
    if (archivedYearData) {
      return [
        { name: 'اشتراكات وتحصيلات الجيم', amount: archivedYearData.totalDirectSubscriptions || 0, color: '#14b8a6' },
        { name: 'سدادات مديونيات الكباتن', amount: archivedYearData.totalCoachSettlements || 0, color: '#06b6d4' },
        { name: 'تحميلات المدربين المسجلة', amount: archivedYearData.totalCoachDebtsLoaded || 0, color: '#a855f7' },
      ];
    }
    return [
      { name: 'اشتراكات وتحصيلات الجيم', amount: totalSubRevenue, color: '#14b8a6' },
      { name: 'مبيعات المتجر (POS)', amount: totalPosRevenue, color: '#06b6d4' },
      { name: 'جلسات العلاج الطبيعي والمساج', amount: totalPhysioRevenue, color: '#a855f7' },
    ];
  }, [archivedYearData, totalSubRevenue, totalPosRevenue, totalPhysioRevenue]);
  const sumRevenue = revenueBreakdown.reduce((acc, r) => acc + r.amount, 0);

  // 6. EXPENSE BREAKDOWN (Zero-fake numbers)
  const expenseBreakdown = useMemo(() => [
    { name: 'حسابات ورواتب المدربين', amount: totalCoachExpense, color: '#f43f5e' },
    { name: 'كهرباء ومكيفات', amount: totalElectricityExpense, color: '#f59e0b' },
    { name: 'صيانة المشايات والأجهزة', amount: totalMaintenanceExpense, color: '#f97316' },
    { name: 'استهلاك مياه ومرافق', amount: totalWaterExpense, color: '#38bdf8' },
    { name: 'إيجار ونظافة ونثريات', amount: totalOtherExpenses, color: '#8b5cf6' },
  ], [totalCoachExpense, totalElectricityExpense, totalMaintenanceExpense, totalWaterExpense, totalOtherExpenses]);
  const sumExpenses = expenseBreakdown.reduce((acc, e) => acc + e.amount, 0);

  // Formatted Period Description
  const formattedPeriodTitle = useMemo(() => {
    if (periodMode === 'day') {
      try {
        const d = new Date(selectedDate);
        return d.toLocaleDateString('ar-EG', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      } catch {
        return selectedDate;
      }
    }
    if (periodMode === 'month') {
      try {
        const parts = selectedMonth.split('-');
        const y = parts[0];
        const m = parseInt(parts[1]) - 1;
        return `${ARABIC_MONTH_LABELS[m] || ''} ${y}`;
      } catch {
        return selectedMonth;
      }
    }
    return `عام ${selectedYear}`;
  }, [periodMode, selectedDate, selectedMonth, selectedYear]);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner with Period Mode Tabs & Interactive Date Pickers */}
      <div className="bg-gradient-to-r from-[#0d1e38] via-[#0f2342] to-[#091528] border border-cyan-500/20 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shadow-inner">
              <BarChart3 className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">
                  التحليلات المالية والرسومات البيانية الشاملة
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                  Business Intelligence 100% Real
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                مقارنة الإيرادات، المصاريف، وصافي الأرباح محسوبة ديناميكياً 100% من واقع المعاملات المسجلة
              </p>
            </div>
          </div>

          {/* PERIOD MODE SELECTOR TABS (يومي | شهري | سنوي) */}
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl">
            <button
              onClick={() => setPeriodMode('day')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                periodMode === 'day'
                  ? 'bg-teal-500 text-slate-950 font-black shadow-md shadow-teal-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>عرض يومي (Day)</span>
            </button>

            <button
              onClick={() => setPeriodMode('month')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                periodMode === 'month'
                  ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>عرض شهري (Month)</span>
            </button>

            <button
              onClick={() => setPeriodMode('year')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                periodMode === 'year'
                  ? 'bg-indigo-500 text-white font-black shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>عرض سنوي (Year)</span>
            </button>
          </div>
        </div>

        {/* INTERACTIVE DATE FILTER TOOLBAR */}
        <div className="pt-4 border-t border-cyan-500/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span>تحديد النطاق الزمني:</span>
            </span>

            {/* Daily Picker Controls */}
            {periodMode === 'day' && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-slate-900 border border-slate-700 hover:border-teal-400 text-white font-mono font-bold text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-teal-400 cursor-pointer shadow-inner"
                />
                <button
                  type="button"
                  onClick={handleSetToday}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    selectedDate === todayIso
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  اليوم
                </button>
                <button
                  type="button"
                  onClick={handleSetYesterday}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer"
                >
                  أمس
                </button>
              </div>
            )}

            {/* Monthly Picker Controls */}
            {periodMode === 'month' && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-slate-900 border border-slate-700 hover:border-cyan-400 text-white font-mono font-bold text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-400 cursor-pointer shadow-inner"
                />
                <button
                  type="button"
                  onClick={handleSetCurrentMonth}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    selectedMonth === currentMonthIso
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  الشهر الحالي
                </button>
                <button
                  type="button"
                  onClick={handleSetPreviousMonth}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer"
                >
                  الشهر السابق
                </button>
              </div>
            )}

            {/* Yearly Picker Controls */}
            {periodMode === 'year' && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="bg-slate-900 border border-slate-700 hover:border-indigo-400 text-white font-mono font-bold text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-400 cursor-pointer shadow-inner"
                >
                  {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleSetCurrentYear}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    selectedYear === currentYearNum
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  السنة الحالية
                </button>
                <button
                  type="button"
                  onClick={handleSetPreviousYear}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer"
                >
                  السنة السابقة
                </button>
              </div>
            )}
          </div>

          {/* Active Period Label Display */}
          <div className="flex flex-wrap items-center gap-2">
            {archivedYearData && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>أرشيف سنوي معتمد ({archivedYearData.archivedAt?.slice(0, 10)})</span>
              </span>
            )}
            <div className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 shadow-sm">
              <span className="text-slate-500">الفترة المعروضة:</span>
              <span className="text-cyan-300 font-bold">{formattedPeriodTitle}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Metrics (100% Dynamic Calculated) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Revenues */}
        <div className="p-6 rounded-3xl bg-[#0f172a]/90 border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400">إجمالي الإيرادات الفعلية</span>
            <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-teal-300 font-mono">
            {formatEGP(totalRevenue)}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 mt-2 font-bold">
            <ArrowUpRight className="w-4 h-4" />
            <span>اشتراكات + متجر + عيادات</span>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="p-6 rounded-3xl bg-[#0f172a]/90 border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400">إجمالي المصاريف والتشغيل</span>
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono">
            {formatEGP(totalExpenses)}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-2">
            <span>كهرباء، مياه، صيانة، ومدربين</span>
          </div>
        </div>

        {/* Net Profit */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-[#0c2419] to-[#081710] border border-emerald-500/30 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-emerald-300">صافي الأرباح المحققة</span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-black font-mono ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatEGP(netProfit)}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-300 mt-2 font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>الإيرادات مطروح منها المصاريف</span>
          </div>
        </div>

        {/* Profit Margin */}
        <div className="p-6 rounded-3xl bg-[#0f172a]/90 border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400">هامش الربح الصافي</span>
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-cyan-300 font-mono">
            {profitMargin}%
          </div>
          <div className="text-[11px] text-cyan-400/80 mt-2 font-bold">
            {totalRevenue === 0
              ? 'بانتظار تسجيل حركات للفترة'
              : profitMargin >= 30
              ? 'مؤشر كفاءة تشغيلية عالي للنادي'
              : 'مؤشر تشغيلي متوازن'}
          </div>
        </div>
      </div>

      {/* CHART 1: DYNAMIC COMPARISON BAR CHART */}
      <div className="bg-[#0f172a]/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-teal-400" />
              <span>
                مقارنة الإيرادات والمصاريف وصافي الأرباح (
                {periodMode === 'day'
                  ? 'خلال فترات اليوم المحدد'
                  : periodMode === 'month'
                  ? 'خلال أسابيع الشهر المحدد'
                  : 'خلال شهور السنة المحددة'}
                )
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              رسم بياني تفاعلي يوضح التدفق المالي الفعلي (بيانات حية 100%)
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="flex items-center gap-1.5 text-teal-400">
              <span className="w-3 h-3 rounded-full bg-teal-500"></span>
              إيرادات
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="w-3 h-3 rounded-full bg-rose-500"></span>
              مصاريف
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
              صافي الربح
            </span>
          </div>
        </div>

        {/* Empty State Banner if all data is 0 */}
        {isAllZeroData && (
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center gap-2 text-xs text-slate-400">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span>
              لا توجد حركات مالية أو مصروفات مسجلة في هذا التاريخ المحدد ({formattedPeriodTitle}).
              جميع الأرقام صفرية وفعلية.
            </span>
          </div>
        )}

        {/* Custom Responsive Dynamic SVG/CSS Bar Chart */}
        <div className="h-72 w-full pt-4 flex flex-col justify-end">
          <div className="flex-1 flex items-end justify-between gap-2 sm:gap-3 px-2 border-b border-slate-800 pb-2">
            {currentDataset.map((item, idx) => {
              const revHeight =
                item.revenue > 0 ? Math.max(8, Math.round((item.revenue / maxVal) * 100)) : 0;
              const expHeight =
                item.expense > 0 ? Math.max(8, Math.round((item.expense / maxVal) * 100)) : 0;
              const profHeight =
                item.profit > 0 ? Math.max(8, Math.round((item.profit / maxVal) * 100)) : 0;
              const isHovered = hoveredBarIndex === idx;

              return (
                <div
                  key={idx}
                  onMouseEnter={() => setHoveredBarIndex(idx)}
                  onMouseLeave={() => setHoveredBarIndex(null)}
                  className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                >
                  {/* Tooltip on hover */}
                  {isHovered && (
                    <div className="absolute -top-24 bg-slate-950 border border-slate-700 rounded-xl p-2.5 shadow-2xl text-[11px] z-30 pointer-events-none whitespace-nowrap text-right">
                      <div className="font-bold text-white mb-1 border-b border-slate-800 pb-1">
                        {item.label}
                      </div>
                      <div className="text-teal-400 font-mono">إيرادات: {formatEGP(item.revenue)}</div>
                      <div className="text-rose-400 font-mono">مصاريف: {formatEGP(item.expense)}</div>
                      <div
                        className={`font-mono font-bold ${
                          item.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        صافي: {formatEGP(item.profit)}
                      </div>
                    </div>
                  )}

                  {/* 3 Bars: Revenue, Expense, Profit */}
                  <div className="w-full flex items-end justify-center gap-1 h-full">
                    {/* Revenue Bar */}
                    <div
                      style={{ height: `${revHeight}%` }}
                      className={`w-2 sm:w-3.5 bg-gradient-to-t from-teal-600 to-teal-400 rounded-t-md transition-all duration-300 group-hover:brightness-125 ${
                        revHeight === 0 ? 'opacity-20 bg-slate-800 h-1' : ''
                      }`}
                    ></div>

                    {/* Expense Bar */}
                    <div
                      style={{ height: `${expHeight}%` }}
                      className={`w-2 sm:w-3.5 bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-md transition-all duration-300 group-hover:brightness-125 ${
                        expHeight === 0 ? 'opacity-20 bg-slate-800 h-1' : ''
                      }`}
                    ></div>

                    {/* Profit Bar */}
                    <div
                      style={{ height: `${profHeight}%` }}
                      className={`w-2 sm:w-3.5 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-md transition-all duration-300 group-hover:brightness-125 ${
                        profHeight === 0 ? 'opacity-20 bg-slate-800 h-1' : ''
                      }`}
                    ></div>
                  </div>

                  {/* Label */}
                  <div className="mt-2 text-[10px] sm:text-xs text-slate-400 font-bold truncate max-w-full text-center">
                    {item.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CHARTS ROW 2: (توزيع مصادر الدخل + توزيع بنود المصاريف) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 1. Revenue Sources Breakdown (Zero Fake Data) */}
        <div className="bg-[#0f172a]/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-cyan-400" />
              <span>توزيع مصادر الدخل والإيرادات الفعلية</span>
            </h3>
            <span className="text-xs font-mono font-bold text-teal-300">
              {formatEGP(sumRevenue)}
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-6">
            النسب المئوية المحسوبة لكل قطاع دخل خلال الفترة المحددة
          </p>

          <div className="space-y-4">
            {revenueBreakdown.map((item, idx) => {
              const pct = sumRevenue > 0 ? Math.round((item.amount / sumRevenue) * 100) : 0;
              return (
                <div key={idx} className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-2 font-bold text-white">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      ></span>
                      <span>{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-teal-300 font-bold">
                        {formatEGP(item.amount)}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-lg">
                        {pct}%
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: item.color }}
                    ></div>
                  </div>
                </div>
              );
            })}

            {sumRevenue === 0 && (
              <div className="text-center py-3 text-xs text-slate-500">
                لا توجد إيرادات مسجلة لهذه الفترة
              </div>
            )}
          </div>
        </div>

        {/* 2. Expense Categories Breakdown (Zero Fake Data) */}
        <div className="bg-[#0f172a]/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-rose-400" />
              <span>توزيع بنود المصاريف التشغيلية الفعلية</span>
            </h3>
            <span className="text-xs font-mono font-bold text-rose-300">
              {formatEGP(sumExpenses)}
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-6">
            أين أُنفقت أموال الجيم خلال الفترة المحددة
          </p>

          <div className="space-y-4">
            {expenseBreakdown.map((item, idx) => {
              const pct = sumExpenses > 0 ? Math.round((item.amount / sumExpenses) * 100) : 0;
              return (
                <div key={idx} className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-2 font-bold text-white">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      ></span>
                      <span>{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-rose-300 font-bold">
                        {formatEGP(item.amount)}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-lg">
                        {pct}%
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: item.color }}
                    ></div>
                  </div>
                </div>
              );
            })}

            {sumExpenses === 0 && (
              <div className="text-center py-3 text-xs text-slate-500">
                لا توجد مصاريف مسجلة لهذه الفترة
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
