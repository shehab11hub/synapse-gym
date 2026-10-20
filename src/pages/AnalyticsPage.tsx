import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  PieChart as PieIcon,
  Calendar,
  Users,
  Award,
  Zap,
  Droplets,
  Wrench,
  Percent,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { useGymData } from '../context/GymDataContext';
import { formatEGP } from '../utils/formatters';

export const AnalyticsPage: React.FC = () => {
  const { expenses, cashInflows, transactions, physioBookings } = useGymData();

  // Period Filter: 'week' | 'month' | 'year'
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('week');
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // Live revenue calculations
  const totalSubRevenue = cashInflows
    .filter((i) => i.type === 'subscription' || i.type === 'manual_deposit')
    .reduce((acc, i) => acc + i.amount, 0);

  const totalPosRevenue = transactions.reduce((acc, t) => acc + t.totalAmount, 0);

  const totalPhysioRevenue = physioBookings
    .filter((p) => p.status === 'completed')
    .reduce((acc, p) => acc + p.totalFee, 0);

  const totalRevenue = totalSubRevenue + totalPosRevenue + totalPhysioRevenue;

  // Live expense calculations
  const totalCoachExpense = expenses
    .filter((e) => e.category === 'trainer_payout')
    .reduce((acc, e) => acc + e.amount, 0);

  const totalElectricityExpense = expenses
    .filter((e) => e.category === 'electricity')
    .reduce((acc, e) => acc + e.amount, 0);

  const totalWaterExpense = expenses
    .filter((e) => e.category === 'water')
    .reduce((acc, e) => acc + e.amount, 0);

  const totalMaintenanceExpense = expenses
    .filter((e) => e.category === 'maintenance')
    .reduce((acc, e) => acc + e.amount, 0);

  const totalOtherExpenses = expenses
    .filter((e) => ['rent', 'supplies', 'other'].includes(e.category))
    .reduce((acc, e) => acc + e.amount, 0);

  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

  // Comparison Datasets for Week, Month, and Year
  const weekData = [
    { label: 'السبت', revenue: 5200, expense: 1800, profit: 3400 },
    { label: 'الأحد', revenue: 4800, expense: 1200, profit: 3600 },
    { label: 'الاثنين', revenue: 6100, expense: 2200, profit: 3900 },
    { label: 'الثلاثاء', revenue: 5400, expense: 1500, profit: 3900 },
    { label: 'الأربعاء', revenue: 7300, expense: 2100, profit: 5200 },
    { label: 'الخميس', revenue: 8900, expense: 3400, profit: 5500 },
    { label: 'الجمعة', revenue: 4200, expense: 900, profit: 3300 },
  ];

  const monthData = [
    { label: 'الأسبوع 1', revenue: 24500, expense: 9200, profit: 15300 },
    { label: 'الأسبوع 2', revenue: 28900, expense: 8700, profit: 20200 },
    { label: 'الأسبوع 3', revenue: 31200, expense: 11400, profit: 19800 },
    { label: 'الأسبوع 4 (الحالي)', revenue: 34100, expense: 10500, profit: 23600 },
  ];

  const yearData = [
    { label: 'يناير', revenue: 85000, expense: 38000, profit: 47000 },
    { label: 'فبراير', revenue: 92000, expense: 41000, profit: 51000 },
    { label: 'مارس', revenue: 104000, expense: 43000, profit: 61000 },
    { label: 'أبريل', revenue: 89000, expense: 36000, profit: 53000 },
    { label: 'مايو', revenue: 112000, expense: 48000, profit: 64000 },
    { label: 'يونيو', revenue: 125000, expense: 52000, profit: 73000 },
    { label: 'يوليو', revenue: 138000, expense: 55000, profit: 83000 },
    { label: 'أغسطس', revenue: 142000, expense: 58000, profit: 84000 },
    { label: 'سبتمبر', revenue: 119000, expense: 49000, profit: 70000 },
    { label: 'أكتوبر', revenue: 128000, expense: 46000, profit: 82000 },
  ];

  const currentDataset =
    period === 'week' ? weekData : period === 'month' ? monthData : yearData;

  const maxVal = Math.max(
    ...currentDataset.map((d) => Math.max(d.revenue, d.expense, d.profit)),
    1000
  );

  // Revenue Pie Breakdown Items
  const revenueBreakdown = [
    { name: 'اشتراكات الجيم', amount: Math.max(totalSubRevenue, 1200), color: '#14b8a6' },
    { name: 'مبيعات المتجر (POS)', amount: Math.max(totalPosRevenue, 650), color: '#06b6d4' },
    { name: 'تأجير العلاج الطبيعي', amount: Math.max(totalPhysioRevenue, 450), color: '#a855f7' },
  ];
  const sumRevenue = revenueBreakdown.reduce((acc, r) => acc + r.amount, 0);

  // Expense Pie Breakdown Items
  const expenseBreakdown = [
    { name: 'حسابات ورواتب المدربين', amount: Math.max(totalCoachExpense, 1800), color: '#f43f5e' },
    { name: 'كهرباء ومكيفات', amount: Math.max(totalElectricityExpense, 1200), color: '#f59e0b' },
    { name: 'صيانة المشايات والأجهزة', amount: Math.max(totalMaintenanceExpense, 800), color: '#f97316' },
    { name: 'استهلاك مياه وساونا', amount: Math.max(totalWaterExpense, 450), color: '#38bdf8' },
    { name: 'إيجار ونظافة ونثريات', amount: Math.max(totalOtherExpenses, 500), color: '#8b5cf6' },
  ];
  const sumExpenses = expenseBreakdown.reduce((acc, e) => acc + e.amount, 0);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner with Period Switcher */}
      <div className="bg-gradient-to-r from-[#0d1e38] via-[#0f2342] to-[#091528] border border-cyan-500/20 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
            <BarChart3 className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">
                التحليلات المالية والرسومات البيانية الشاملة
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                Business Intelligence
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              مقارنة الإيرادات، المصاريف، وصافي الأرباح للأسبوع والشهر والسنة وحالة المكان المالية بالكامل
            </p>
          </div>
        </div>

        {/* PERIOD SWITCHER BUTTONS (الأسبوع ده، الشهر ده، السنه دي) */}
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl">
          <button
            onClick={() => setPeriod('week')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              period === 'week'
                ? 'bg-teal-500 text-slate-950 font-black shadow-md shadow-teal-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>الأسبوع الحالي (This Week)</span>
          </button>

          <button
            onClick={() => setPeriod('month')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              period === 'month'
                ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>الشهر الحالي (This Month)</span>
          </button>

          <button
            onClick={() => setPeriod('year')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              period === 'year'
                ? 'bg-indigo-500 text-white font-black shadow-md shadow-indigo-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>السنة الحالية (This Year)</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Revenues */}
        <div className="p-6 rounded-3xl bg-[#0f172a]/90 border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400">إجمالي الإيرادات الكلية</span>
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
          <div className="text-2xl font-black text-emerald-400 font-mono">
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
            مؤشر كفاءة تشغيلية عالي للنادي
          </div>
        </div>
      </div>

      {/* CHART 1: COMPARISON BAR CHART (مقارنة الإيرادات مقابل المصاريف وصافي الربح) */}
      <div className="bg-[#0f172a]/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-teal-400" />
              <span>
                مقارنة الإيرادات والمصاريف وصافي الأرباح (
                {period === 'week' ? 'خلال أيام الأسبوع الحالي' : period === 'month' ? 'خلال أسابيع الشهر الحالي' : 'شهور السنة الحالية'}
                )
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              رسم بياني يوضح التدفق المالي وحجم الفائض الصافي
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

        {/* Custom Responsive SVG Chart */}
        <div className="h-72 w-full pt-4 flex flex-col justify-end">
          <div className="flex-1 flex items-end justify-between gap-3 px-2 border-b border-slate-800 pb-2">
            {currentDataset.map((item, idx) => {
              const revHeight = Math.max(8, Math.round((item.revenue / maxVal) * 100));
              const expHeight = Math.max(8, Math.round((item.expense / maxVal) * 100));
              const profHeight = Math.max(8, Math.round((item.profit / maxVal) * 100));
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
                      <div className="text-emerald-400 font-mono font-bold">صافي: {formatEGP(item.profit)}</div>
                    </div>
                  )}

                  {/* 3 Bars: Revenue, Expense, Profit */}
                  <div className="w-full flex items-end justify-center gap-1 h-full">
                    {/* Revenue Bar */}
                    <div
                      style={{ height: `${revHeight}%` }}
                      className="w-2.5 sm:w-3.5 bg-gradient-to-t from-teal-600 to-teal-400 rounded-t-md transition-all duration-300 group-hover:brightness-125"
                    ></div>

                    {/* Expense Bar */}
                    <div
                      style={{ height: `${expHeight}%` }}
                      className="w-2.5 sm:w-3.5 bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-md transition-all duration-300 group-hover:brightness-125"
                    ></div>

                    {/* Profit Bar */}
                    <div
                      style={{ height: `${profHeight}%` }}
                      className="w-2.5 sm:w-3.5 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-md transition-all duration-300 group-hover:brightness-125"
                    ></div>
                  </div>

                  {/* Label */}
                  <div className="mt-2 text-[10px] sm:text-xs text-slate-400 font-bold truncate max-w-full">
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
        {/* 1. Revenue Sources Breakdown */}
        <div className="bg-[#0f172a]/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <h3 className="text-base font-black text-white mb-1 flex items-center gap-2">
            <PieIcon className="w-5 h-5 text-cyan-400" />
            <span>توزيع مصادر الدخل والإيرادات</span>
          </h3>
          <p className="text-xs text-slate-400 mb-6">
            النسب المئوية لكل قطاع دخل (اشتراكات، متجر، علاج طبيعي)
          </p>

          <div className="space-y-4">
            {revenueBreakdown.map((item, idx) => {
              const pct = Math.round((item.amount / sumRevenue) * 100);
              return (
                <div key={idx} className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-2 font-bold text-white">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                      <span>{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-teal-300 font-bold">{formatEGP(item.amount)}</span>
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
          </div>
        </div>

        {/* 2. Expense Categories Breakdown */}
        <div className="bg-[#0f172a]/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <h3 className="text-base font-black text-white mb-1 flex items-center gap-2">
            <PieIcon className="w-5 h-5 text-rose-400" />
            <span>توزيع بنود المصاريف التشغيلية</span>
          </h3>
          <p className="text-xs text-slate-400 mb-6">
            أين تُنفق أموال الجيم (رواتب، كهرباء، صيانة، مياه، إيجار ونظافة)
          </p>

          <div className="space-y-4">
            {expenseBreakdown.map((item, idx) => {
              const pct = Math.round((item.amount / sumExpenses) * 100);
              return (
                <div key={idx} className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-2 font-bold text-white">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                      <span>{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-rose-300 font-bold">{formatEGP(item.amount)}</span>
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
          </div>
        </div>
      </div>
    </div>
  );
};
