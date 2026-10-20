import React, { useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  UserCheck,
  Plus,
  Wallet,
  Calendar,
  Layers,
  Banknote,
  CheckCircle,
  Clock,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Search,
  Filter,
  Receipt,
  ArrowRightLeft,
  User,
  Tag,
  AlertCircle,
  History,
  X,
  CreditCard,
  Smartphone,
  ChevronDown,
  Users,
  UserPlus,
} from 'lucide-react';
import { useGymData } from '../context/GymDataContext';
import { useAuth } from '../context/AuthContext';
import { Coach, CollectedBy, TrainerTransaction, TransactionStatus } from '../types';
import { formatEGP, formatDateAr } from '../utils/formatters';
import { SettlementModal } from '../components/trainers/SettlementModal';
import { sounds } from '../utils/sound';

export const TrainerAccountsPage: React.FC = () => {
  const {
    coaches,
    sessions,
    toggleSessionCoachCompletion,
    settleCoachAccount,
    payMonthlySalary,
    addCoach,
    getTodayStats,
    trainerTransactions,
    addTrainerTransaction,
    settleCoachPayable,
    collectGymReceivable,
    netSettleTrainer,
    getCoachFinancialSummary,
    getAllTrainersFinancialSummary,
    repayCoachDebt,
    getCoachMonthlyBreakdown,
    billingCycles,
    currentMonth,
  } = useGymData();

  const { currentUser } = useAuth();
  const stats = getTodayStats();
  const globalSummary = getAllTrainersFinancialSummary();

  // Active Month filter (allows switching between months & seeing carried-over debt)
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);

  // Active top-level view: 'overview' (بطاقات المدربين والمديونيات) vs 'history' (سجل وتاريخ المعاملات) vs 'ledger' (الدفتر المالي الموحد)
  const [activeView, setActiveView] = useState<'overview' | 'history' | 'ledger'>('overview');

  // Filter within overview: 'all' | 'monthly' | 'per_session'
  const [activeFilter, setActiveFilter] = useState<'all' | 'monthly' | 'per_session'>('all');

  // Modals state
  const [selectedCoachForSettlement, setSelectedCoachForSettlement] = useState<Coach | null>(null);
  const [isAddCoachModalOpen, setIsAddCoachModalOpen] = useState(false);
  const [isAddTransactionModalOpen, setIsAddTransactionModalOpen] = useState(false);

  // Partial / Full Repay Modal state
  const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);
  const [selectedCoachForRepay, setSelectedCoachForRepay] = useState<Coach | null>(null);
  const [repayAmount, setRepayAmount] = useState<number>(0);
  const [repayMethod, setRepayMethod] = useState<'cash' | 'instapay'>('cash');
  const [repayNotes, setRepayNotes] = useState<string>('');

  // History Tab Filters
  const [historyCoachFilter, setHistoryCoachFilter] = useState<string>('all');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>('all');

  // Ledger table filters
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerCollectorFilter, setLedgerCollectorFilter] = useState<'all' | 'gym' | 'coach'>('all');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<'all' | 'pending' | 'settled'>('all');

  // New Transaction Form state
  const [trxForm, setTrxForm] = useState({
    coach_id: coaches[0]?.id || '',
    amount: 1000,
    collected_by: 'coach' as CollectedBy,
    payer_type: 'حصة تدريب خاصة PT',
    payer_name: '',
    splitMode: 'percent' as 'percent' | 'manual',
    gym_percentage: 100,
    manual_gym_share: 1000,
    manual_coach_share: 0,
    payment_method: 'coach_collected' as 'cash' | 'card' | 'instapay' | 'coach_collected',
    notes: '',
  });

  // New Coach Form state
  const [newCoachForm, setNewCoachForm] = useState({
    name: '',
    phone: '',
    specialty: 'لياقة بدنية وكمال أجسام',
    paymentType: 'per_session' as Coach['paymentType'],
    ratePerSession: 150,
    monthlySalary: 6000,
    commissionRate: 30,
  });

  // Calculate live preview shares for the transaction modal
  const computedGymShare =
    trxForm.splitMode === 'percent'
      ? Math.round((trxForm.amount * trxForm.gym_percentage) / 100)
      : trxForm.manual_gym_share;

  const computedCoachShare =
    trxForm.splitMode === 'percent'
      ? trxForm.amount - computedGymShare
      : trxForm.manual_coach_share;

  // Aggregate monthly stats across all coaches for the selected month
  const monthlyCoachesStats = coaches.map((c) => ({
    coach: c,
    breakdown: getCoachMonthlyBreakdown(c.id, selectedMonth),
  }));

  const totalMonthlyChargesAllCoaches = monthlyCoachesStats.reduce(
    (sum, item) => sum + item.breakdown.currentMonthCharges,
    0
  );
  const totalCarriedDebtAllCoaches = monthlyCoachesStats.reduce(
    (sum, item) => sum + item.breakdown.previousCarriedDebt,
    0
  );
  const totalMonthlyRepaidAllCoaches = monthlyCoachesStats.reduce(
    (sum, item) => sum + item.breakdown.currentMonthRepaid,
    0
  );
  const totalRemainingDebtAllCoaches = monthlyCoachesStats.reduce(
    (sum, item) => sum + item.breakdown.remainingTotalDebt,
    0
  );

  // Open Repay Modal
  const openRepayModal = (coach: Coach) => {
    setSelectedCoachForRepay(coach);
    const b = getCoachMonthlyBreakdown(coach.id, selectedMonth);
    setRepayAmount(b.remainingTotalDebt > 0 ? b.remainingTotalDebt : 500);
    setRepayMethod('cash');
    setRepayNotes(`سداد مديونية من كابتن ${coach.name}`);
    setIsRepayModalOpen(true);
  };

  const handleConfirmRepay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoachForRepay || repayAmount <= 0) return;

    const res = repayCoachDebt(
      selectedCoachForRepay.id,
      Number(repayAmount),
      repayMethod,
      repayNotes,
      currentUser?.name || 'الاستقبال'
    );

    if (res.success) {
      sounds.playCashRegister();
      alert(`✅ تم تسجيل سداد مبلغ ${formatEGP(res.repaidAmount)} بنجاح، وتوريده فورياً إلى درج الخزينة وصفحة المصاريف!`);
      setIsRepayModalOpen(false);
      setSelectedCoachForRepay(null);
    }
  };

  // Actions
  const handleCreateTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trxForm.coach_id || trxForm.amount <= 0) return;

    addTrainerTransaction({
      coach_id: trxForm.coach_id,
      amount: Number(trxForm.amount),
      collected_by: trxForm.collected_by,
      payer_type: trxForm.payer_type,
      payer_name: trxForm.payer_name || 'متدرب',
      gym_share: computedGymShare,
      coach_share: computedCoachShare,
      payment_method: trxForm.payment_method,
      notes: trxForm.notes,
    });

    sounds.playSuccessDing();
    setIsAddTransactionModalOpen(false);
    setTrxForm({
      coach_id: coaches[0]?.id || '',
      amount: 1000,
      collected_by: 'coach',
      payer_type: 'حصة تدريب خاصة PT',
      payer_name: '',
      splitMode: 'percent',
      gym_percentage: 100,
      manual_gym_share: 1000,
      manual_coach_share: 0,
      payment_method: 'coach_collected',
      notes: '',
    });
  };

  const handlePayMonthlySalary = (coach: Coach) => {
    if (!coach.monthlySalary) return;
    if (coach.monthlySalaryPaidThisMonth) {
      if (!confirm(`تم صرف راتب هذا الشهر للمدرب ${coach.name} مسبقاً. هل ترغب في صرف راتب إضافي؟`)) {
        return;
      }
    }

    const res = payMonthlySalary(coach.id, currentUser?.name || 'المدير العام');
    if (res.success) {
      sounds.playCashRegister();
      alert(`تم صرف الراتب الشهري بقيمة ${formatEGP(res.salaryAmount)} للمدرب ${coach.name} وتسجيله تلقائياً في صفحة المصاريف والدرج.`);
    }
  };

  const handleCreateCoach = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCoachForm.name) return;

    addCoach({
      name: newCoachForm.name,
      phone: newCoachForm.phone,
      specialty: newCoachForm.specialty,
      paymentType: newCoachForm.paymentType,
      ratePerSession: Number(newCoachForm.ratePerSession),
      monthlySalary: Number(newCoachForm.monthlySalary),
      commissionRate: Number(newCoachForm.commissionRate),
      active: true,
    });

    setIsAddCoachModalOpen(false);
    setNewCoachForm({
      name: '',
      phone: '',
      specialty: 'لياقة بدنية وكمال أجسام',
      paymentType: 'per_session',
      ratePerSession: 150,
      monthlySalary: 6000,
      commissionRate: 30,
    });
  };

  // Filtered coaches for Overview Tab
  const filteredCoaches = coaches.filter((coach) => {
    if (activeFilter === 'monthly') return coach.paymentType === 'monthly';
    if (activeFilter === 'per_session') return coach.paymentType === 'per_session';
    return true;
  });

  // History timeline transactions filter
  const historyTransactions = trainerTransactions.filter((t) => {
    const matchesMonth =
      selectedMonth === 'all' || t.month === selectedMonth || (!t.month && selectedMonth === currentMonth);
    const matchesCoach = historyCoachFilter === 'all' || t.coach_id === historyCoachFilter;
    const matchesType =
      historyTypeFilter === 'all' ||
      (historyTypeFilter === 'charges' && t.collected_by === 'coach' && t.type !== 'coach_repayment') ||
      (historyTypeFilter === 'repayments' && t.type === 'coach_repayment') ||
      (historyTypeFilter === 'salaries' && t.type === 'salary_payout');

    return matchesMonth && matchesCoach && matchesType;
  });

  // Filtered transactions for Master Ledger Tab
  const filteredTransactions = trainerTransactions.filter((trx) => {
    const matchesCollector =
      ledgerCollectorFilter === 'all' || trx.collected_by === ledgerCollectorFilter;
    const matchesStatus =
      ledgerStatusFilter === 'all' || trx.status === ledgerStatusFilter;
    const matchesText =
      trx.transaction_id.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
      trx.coach_name.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
      trx.payer_type.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
      (trx.payer_name && trx.payer_name.toLowerCase().includes(ledgerSearch.toLowerCase()));

    return matchesCollector && matchesStatus && matchesText;
  });

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* 1. TOP MONTH SWITCHER & AUDIT SUMMARY BANNER */}
      <div className="bg-gradient-to-r from-[#111e33] via-[#0f172a] to-[#0d1527] border-2 border-teal-500/30 rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-black uppercase tracking-wider px-3 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40">
                إدارة حسابات وتحميلات المدربين والمديونيات
              </span>
              <span className="text-xs font-mono font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                Monthly Debt Ledger
              </span>
            </div>
            <h2 className="text-2xl font-black text-white">
              حسابات ومديونيات الكباتن الشهرية (نظام التحميل المباشر)
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              تحميل حصص واشتراكات اللاعبين كاملة كمديونية على الكابتن عند اكتمال الحصة، مع ترحيل مديونية الشهور السابقة تلقائياً وإمكانية السداد الجزئي بالدرج.
            </p>
          </div>

          {/* Month Switcher Dropdown (الخانة للتحويل بين الشهور والترحيل) */}
          <div className="flex items-center gap-3 bg-slate-900 border border-teal-500/40 p-2 rounded-2xl">
            <Calendar className="w-5 h-5 text-teal-400" />
            <div className="text-right">
              <div className="text-[10px] text-slate-400 font-bold">الشهر المالي المعروض:</div>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-sm font-black text-teal-300 focus:outline-none cursor-pointer dir-rtl"
              >
                <option value="all" className="bg-slate-900 text-white">كل الشهور (الرصيد التراكمي)</option>
                {billingCycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.name} className="bg-slate-900 text-white">
                    {cycle.name} {cycle.isActive ? '(الشهر الحالي)' : '(شهر سابق)'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 4 Financial Aggregate Cards for the Selected Month */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-800">
          {/* Card 1: This Month's New Debt */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-amber-500/30">
            <div className="flex items-center justify-between text-xs text-amber-300 mb-1">
              <span className="font-bold">تحميلات الشهر المحدد</span>
              <ArrowUpRight className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400 font-mono">
              {formatEGP(totalMonthlyChargesAllCoaches)}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">حصص واشتراكات محملة على الكباتن</p>
          </div>

          {/* Card 2: Carried-over Past Debt (مديونيات سابقة مرحلة) */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-rose-500/30">
            <div className="flex items-center justify-between text-xs text-rose-300 mb-1">
              <span className="font-bold">مديونية سابقة مرحلة</span>
              <History className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-black text-rose-400 font-mono">
              {formatEGP(totalCarriedDebtAllCoaches)}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">متبقية من الشهور الماضية ولم تسدد</p>
          </div>

          {/* Card 3: Repaid this month (ما تم سداده وتوريده) */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/30">
            <div className="flex items-center justify-between text-xs text-emerald-300 mb-1">
              <span className="font-bold">ما تم سداده وإيداعه</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {formatEGP(totalMonthlyRepaidAllCoaches)}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">سدادات نقدية موردة لدرج الخزينة</p>
          </div>

          {/* Card 4: Net Remaining Debt (إجمالي المديونية المتبقية المستحقة للجيم) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 to-slate-900 border-2 border-cyan-500/40">
            <div className="flex items-center justify-between text-xs text-cyan-300 mb-1">
              <span className="font-bold">صافي المديونية المتبقية</span>
              <Wallet className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-black text-cyan-300 font-mono">
              {formatEGP(totalRemainingDebtAllCoaches)}
            </div>
            <p className="text-[10px] text-cyan-300/80 mt-1">المستحق النهائي على الكباتن للجيم</p>
          </div>
        </div>

        {/* View Toggle Bar (نظرة عامة / سجل وتاريخ المعاملات / الدفتر الموحد) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveView('overview')}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeView === 'overview'
                  ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>بطاقات ومديونيات المدربين</span>
            </button>

            <button
              onClick={() => setActiveView('history')}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeView === 'history'
                  ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <History className="w-4 h-4" />
              <span>تاريخ وسجل المعاملات اليومية</span>
            </button>

            <button
              onClick={() => setActiveView('ledger')}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeView === 'ledger'
                  ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>الدفتر الموحد الشامل (Master Ledger)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddTransactionModalOpen(true)}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold text-xs border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>تسجيل حركة يدوية</span>
            </button>

            <button
              onClick={() => setIsAddCoachModalOpen(true)}
              className="py-2 px-3.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>إضافة مدرب جديد</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN VIEW 1: COACH CARDS & MONTHLY DEBT BREAKDOWN */}
      {activeView === 'overview' && (
        <div className="space-y-6">
          {/* Sub-Filter for coach contract type */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-bold">تصفية العقود:</span>
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-bold transition ${
                  activeFilter === 'all'
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                الكل ({coaches.length})
              </button>
              <button
                onClick={() => setActiveFilter('per_session')}
                className={`px-3 py-1.5 rounded-xl font-bold transition ${
                  activeFilter === 'per_session'
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                بالحصة / النسبة
              </button>
              <button
                onClick={() => setActiveFilter('monthly')}
                className={`px-3 py-1.5 rounded-xl font-bold transition ${
                  activeFilter === 'monthly'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                راتب شهري
              </button>
            </div>
            <span className="text-slate-400">
              المعروض لشهر: <strong className="text-teal-300 font-mono">{selectedMonth}</strong>
            </span>
          </div>

          {/* Coach Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCoaches.map((coach) => {
              const breakdown = getCoachMonthlyBreakdown(coach.id, selectedMonth);
              const hasDebt = breakdown.remainingTotalDebt > 0;
              const hasPreviousDebt = breakdown.previousCarriedDebt > 0;

              return (
                <div
                  key={coach.id}
                  className="bg-[#0f172a]/95 border border-slate-800 hover:border-teal-500/30 rounded-3xl p-6 shadow-xl flex flex-col justify-between transition"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-slate-950 font-black text-lg">
                          {coach.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-base font-black text-white">{coach.name}</h3>
                          <div className="text-xs text-slate-400">{coach.specialty}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{coach.phone}</div>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          coach.paymentType === 'monthly'
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                            : coach.paymentType === 'percentage'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                            : 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                        }`}
                      >
                        {coach.paymentType === 'monthly'
                          ? 'راتب شهري'
                          : coach.paymentType === 'percentage'
                          ? `نسبة ${coach.commissionRate}%`
                          : 'بالحصة'}
                      </span>
                    </div>

                    {/* Monthly Breakdown Card (مديونية كل كابتن شهريا والترحيل) */}
                    <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2 mb-4 text-xs">
                      {/* Carried over debt from previous months if any */}
                      {hasPreviousDebt && (
                        <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-rose-300 font-bold">
                          <span>مديونية سابقة مرحلة (الشهر اللي فات):</span>
                          <span className="font-mono">{formatEGP(breakdown.previousCarriedDebt)}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-slate-300">
                        <span>تحميلات هذا الشهر ({selectedMonth}):</span>
                        <span className="font-mono font-bold text-amber-300">
                          {formatEGP(breakdown.currentMonthCharges)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-slate-300">
                        <span>ما سدده الكابتن هذا الشهر:</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {formatEGP(breakdown.currentMonthRepaid)}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex justify-between items-center font-black">
                        <span className="text-white">إجمالي المديونية المتبقية المستحقة:</span>
                        <span
                          className={`font-mono text-base ${
                            hasDebt ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {formatEGP(breakdown.remainingTotalDebt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for this Coach */}
                  <div className="space-y-2 pt-2">
                    {/* Repay Debt Button (سداد جزء أو كامل المديونية) */}
                    <button
                      type="button"
                      onClick={() => openRepayModal(coach)}
                      className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition cursor-pointer"
                    >
                      <Banknote className="w-4 h-4" />
                      <span>إيداع سداد مديونية (كامل أو جزء)</span>
                    </button>

                    {/* Pay Monthly Salary if applicable */}
                    {coach.paymentType === 'monthly' && coach.monthlySalary && (
                      <button
                        type="button"
                        onClick={() => handlePayMonthlySalary(coach)}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          coach.monthlySalaryPaidThisMonth
                            ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
                        }`}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>
                          {coach.monthlySalaryPaidThisMonth
                            ? `تم صرف الراتب (${formatEGP(coach.monthlySalary)})`
                            : `صرف الراتب الشهري (${formatEGP(coach.monthlySalary)})`}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. MAIN VIEW 2: TRANSACTION HISTORY & AUDIT LOG (تاريخ المعاملات) */}
      {activeView === 'history' && (
        <div className="bg-[#0f172a]/95 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-teal-400" />
                <h3 className="text-base font-black text-white">
                  سجل وتاريخ المعاملات والتحميلات اليومية
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                تاريخ تفصيلي يبين كل حركة: "كابتن فلان أضيف عليه كذا، كابتن فلان سدد كذا" مع التوقيت الدقيق
              </p>
            </div>

            {/* History Filters */}
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <select
                value={historyCoachFilter}
                onChange={(e) => setHistoryCoachFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-teal-500"
              >
                <option value="all">كل الكباتن</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={historyTypeFilter}
                onChange={(e) => setHistoryTypeFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-teal-500"
              >
                <option value="all">كل أنواع الحركات</option>
                <option value="charges">تحميلات مديونية فقط</option>
                <option value="repayments">إيداعات وسداد فقط</option>
                <option value="salaries">رواتب منصرفة</option>
              </select>
            </div>
          </div>

          {/* Timeline List of Transactions */}
          {historyTransactions.length > 0 ? (
            <div className="divide-y divide-slate-800/80">
              {historyTransactions.map((trx) => {
                const isRepay = trx.type === 'coach_repayment';
                const isCharge = trx.collected_by === 'coach' && !isRepay;
                const isPayable = trx.collected_by === 'gym' && !isRepay;

                return (
                  <div
                    key={trx.transaction_id}
                    className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-900/40 px-3 rounded-2xl transition"
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${
                          isRepay
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : isCharge
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        }`}
                      >
                        {isRepay ? (
                          <Banknote className="w-5 h-5" />
                        ) : isCharge ? (
                          <ArrowUpRight className="w-5 h-5" />
                        ) : (
                          <ArrowDownLeft className="w-5 h-5" />
                        )}
                      </div>

                      <div>
                        <div className="text-sm font-black text-white flex items-center gap-2">
                          <span>{trx.coach_name}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isRepay
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : isCharge
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-purple-500/20 text-purple-300'
                            }`}
                          >
                            {isRepay ? 'سداد مديونية بالدرج' : isCharge ? 'تحميل مديونية للجيم' : 'مستحق للمدرب'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {trx.notes || trx.payer_type}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          رقم القيد: {trx.transaction_id} | {new Date(trx.created_at).toLocaleString('ar-EG')}
                        </div>
                      </div>
                    </div>

                    <div className="text-left">
                      <div
                        className={`text-base font-black font-mono ${
                          isRepay ? 'text-emerald-400' : isCharge ? 'text-amber-400' : 'text-purple-400'
                        }`}
                      >
                        {isRepay ? `+${formatEGP(trx.amount)}` : formatEGP(trx.amount)}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {trx.status === 'settled' ? 'تمت التسوية' : 'معلق في الحساب'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-500">
              لا توجد معاملات مسجلة في هذا الشهر أو تطابق شروط التصفية.
            </div>
          )}
        </div>
      )}

      {/* 4. MAIN VIEW 3: MASTER UNIFIED LEDGER TABLE */}
      {activeView === 'ledger' && (
        <div className="bg-[#0f172a]/95 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <h3 className="text-base font-black text-white">دفتر المعاملات المالي الموحد</h3>
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                placeholder="بحث بالكود أو الكابتن أو البيان..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 text-[11px] font-bold">
                  <th className="py-3 px-3">رقم المعاملة</th>
                  <th className="py-3 px-4">الكابتن</th>
                  <th className="py-3 px-4">البيان / نوع الحركة</th>
                  <th className="py-3 px-3">المبلغ الإجمالي</th>
                  <th className="py-3 px-3 text-amber-400">حصة الجيم (مديونية)</th>
                  <th className="py-3 px-3 text-emerald-400">حصة المدرب</th>
                  <th className="py-3 px-3">الشهر</th>
                  <th className="py-3 px-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredTransactions.map((trx) => (
                  <tr key={trx.transaction_id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-3 font-mono text-cyan-400">{trx.transaction_id}</td>
                    <td className="py-3 px-4 font-bold text-white">{trx.coach_name}</td>
                    <td className="py-3 px-4 text-slate-300">{trx.payer_type}</td>
                    <td className="py-3 px-3 font-mono font-bold text-white">{formatEGP(trx.amount)}</td>
                    <td className="py-3 px-3 font-mono text-amber-400">{formatEGP(trx.gym_share)}</td>
                    <td className="py-3 px-3 font-mono text-emerald-400">{formatEGP(trx.coach_share)}</td>
                    <td className="py-3 px-3 text-slate-400">{trx.month || selectedMonth}</td>
                    <td className="py-3 px-3">
                      {trx.status === 'settled' ? (
                        <span className="text-emerald-400 font-bold text-[10px]">مسدد</span>
                      ) : (
                        <span className="text-amber-400 font-bold text-[10px]">معلق</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: PARTIAL / FULL REPAYMENT FROM COACH (إيداع سداد مديونية كامل أو جزء) */}
      {isRepayModalOpen && selectedCoachForRepay && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-emerald-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setIsRepayModalOpen(false);
                setSelectedCoachForRepay(null);
              }}
              className="absolute top-5 left-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400">
                <Banknote className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">إيداع سداد مديونية من الكابتن</h3>
                <p className="text-xs text-emerald-300 font-bold">
                  {selectedCoachForRepay.name} ({selectedCoachForRepay.specialty})
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmRepay} className="space-y-4">
              {/* Summary of what coach owes */}
              {(() => {
                const b = getCoachMonthlyBreakdown(selectedCoachForRepay.id, selectedMonth);
                return (
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">مديونية الشهر المحدد ({selectedMonth}):</span>
                      <span className="font-mono text-amber-300 font-bold">{formatEGP(b.currentMonthCharges)}</span>
                    </div>
                    {b.previousCarriedDebt > 0 && (
                      <div className="flex justify-between text-rose-300">
                        <span>مديونية سابقة مرحلة (الشهر اللي فات):</span>
                        <span className="font-mono font-bold">+{formatEGP(b.previousCarriedDebt)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-slate-800 pt-1.5 font-bold">
                      <span className="text-white">إجمالي المستحق عليه للجيم:</span>
                      <span className="text-sm font-black text-rose-400 font-mono">
                        {formatEGP(b.remainingTotalDebt)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Amount to Repay (Partial or Full) */}
              <div>
                <label className="block text-xs font-bold text-emerald-300 mb-1">
                  المبلغ المراد سداده الآن (ج.م) - يقبل السداد الجزئي:
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-emerald-500/40 rounded-xl px-3 py-2.5 text-base text-white font-mono font-black focus:outline-none focus:border-emerald-400"
                />

                {/* Quick Chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[200, 500, 1000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setRepayAmount(amt)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-[11px] text-slate-300 hover:bg-emerald-500 hover:text-slate-950 font-bold transition"
                    >
                      +{amt} ج.م
                    </button>
                  ))}
                  {(() => {
                    const b = getCoachMonthlyBreakdown(selectedCoachForRepay.id, selectedMonth);
                    return b.remainingTotalDebt > 0 ? (
                      <button
                        type="button"
                        onClick={() => setRepayAmount(b.remainingTotalDebt)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold hover:bg-emerald-500 hover:text-slate-950 transition"
                      >
                        سداد كامل المبلغ ({formatEGP(b.remainingTotalDebt)})
                      </button>
                    ) : null;
                  })()}
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">طريقة التوريد:</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label
                    className={`p-2.5 rounded-xl border text-center cursor-pointer transition ${
                      repayMethod === 'cash'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="repayMethod"
                      value="cash"
                      checked={repayMethod === 'cash'}
                      onChange={() => setRepayMethod('cash')}
                      className="sr-only"
                    />
                    <span>نقداً بدرج الخزينة</span>
                  </label>

                  <label
                    className={`p-2.5 rounded-xl border text-center cursor-pointer transition ${
                      repayMethod === 'instapay'
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="repayMethod"
                      value="instapay"
                      checked={repayMethod === 'instapay'}
                      onChange={() => setRepayMethod('instapay')}
                      className="sr-only"
                    />
                    <span>تحويل إنستاباي</span>
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">ملاحظات (اختياري):</label>
                <input
                  type="text"
                  value={repayNotes}
                  onChange={(e) => setRepayNotes(e.target.value)}
                  placeholder="ملاحظات على السداد..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer"
                >
                  تأكيد استلام وتوريد السداد للدرج
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsRepayModalOpen(false);
                    setSelectedCoachForRepay(null);
                  }}
                  className="py-3 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Coach Modal */}
      {isAddCoachModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-teal-400" />
              <span>إضافة مدرب جديد للنظام</span>
            </h3>

            <form onSubmit={handleCreateCoach} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">الاسم الكامل</label>
                <input
                  type="text"
                  required
                  value={newCoachForm.name}
                  onChange={(e) => setNewCoachForm({ ...newCoachForm, name: e.target.value })}
                  placeholder="مثال: كابتن أحمد فتحي"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">رقم الهاتف</label>
                  <input
                    type="text"
                    value={newCoachForm.phone}
                    onChange={(e) => setNewCoachForm({ ...newCoachForm, phone: e.target.value })}
                    placeholder="010..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 dir-ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">التخصص</label>
                  <input
                    type="text"
                    value={newCoachForm.specialty}
                    onChange={(e) => setNewCoachForm({ ...newCoachForm, specialty: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">نوع العقد المالي</label>
                <select
                  value={newCoachForm.paymentType}
                  onChange={(e) =>
                    setNewCoachForm({ ...newCoachForm, paymentType: e.target.value as Coach['paymentType'] })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="per_session">أجر ثابت بالحصة (Per Session)</option>
                  <option value="percentage">نسبة مئوية من إيراد الحصة (%)</option>
                  <option value="monthly">راتب شهري ثابت (Monthly Salary)</option>
                </select>
              </div>

              {newCoachForm.paymentType === 'monthly' && (
                <div>
                  <label className="block text-xs font-bold text-blue-300 mb-1">الراتب الشهري (ج.م)</label>
                  <input
                    type="number"
                    value={newCoachForm.monthlySalary}
                    onChange={(e) => setNewCoachForm({ ...newCoachForm, monthlySalary: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-blue-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-bold"
                  />
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-teal-500/20"
                >
                  حفظ وتسجيل المدرب
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddCoachModalOpen(false)}
                  className="py-3 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Manual Transaction Modal */}
      {isAddTransactionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-teal-400" />
              <span>تسجيل حركة تحميل أو تحصيل يدوية</span>
            </h3>

            <form onSubmit={handleCreateTransaction} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اختر المدرب</label>
                <select
                  value={trxForm.coach_id}
                  onChange={(e) => setTrxForm({ ...trxForm, coach_id: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.specialty})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">بيان الحركة</label>
                <input
                  type="text"
                  required
                  value={trxForm.payer_type}
                  onChange={(e) => setTrxForm({ ...trxForm, payer_type: e.target.value })}
                  placeholder="مثال: حصة تدريب خاصة PT"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">إجمالي المبلغ (ج.م)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={trxForm.amount}
                  onChange={(e) => setTrxForm({ ...trxForm, amount: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-teal-300 font-bold focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-teal-500/20"
                >
                  حفظ الحركة في الحساب
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddTransactionModalOpen(false)}
                  className="py-3 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};