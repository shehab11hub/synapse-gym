import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  Search,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  Trash2,
  User,
  TrendingUp,
  CreditCard,
  Banknote,
  Smartphone,
  ChevronDown,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Activity,
  Layers,
  Building,
  Lock,
  ShieldCheck,
  Archive,
  Database,
  FileCheck,
  X,
} from 'lucide-react';
import { useGymData } from '../context/GymDataContext';
import { useAuth } from '../context/AuthContext';
import { MasterReportEntry, SessionCategory, Coach, ExpenseItem, CashInflowItem } from '../types';
import { formatEGP, formatDateAr } from '../utils/formatters';
import { sounds } from '../utils/sound';

export const ARABIC_MONTH_NAMES = [
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

export const parseMonthYear = (str: string) => {
  const yearMatch = str.match(/\d{4}/);
  const year = yearMatch ? yearMatch[0] : '';
  const monthIdx = ARABIC_MONTH_NAMES.findIndex((m) => str.includes(m));
  const monthNum = monthIdx !== -1 ? String(monthIdx + 1).padStart(2, '0') : '';
  return { year, monthNum };
};

export const MasterReportPage: React.FC = () => {
  const {
    masterReportEntries,
    billingCycles,
    currentMonth,
    startNewMonth,
    exportMasterReportToCSV,
    exportMasterReportXLSX,
    addMasterReportEntry,
    deleteMasterReportEntry,
    coaches,
    expenses,
    cashInflows,
    yearlyArchives,
    archiveYear,
    exportYearlyArchiveXLSX,
    exportYearlyArchiveJSON,
    dailyShiftClosings,
    closeDailyShift,
    getTodayShiftStatus,
    exportDailyShiftXLSX,
  } = useGymData();

  const { currentUser, users } = useAuth();

  // Active Month & Year filters (default to current month and all years)
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('all');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals - Dedicated Month and Year for Start New Month
  const [isNewMonthModalOpen, setIsNewMonthModalOpen] = useState(false);
  const [selectedNewMonthName, setSelectedNewMonthName] = useState<string>('نوفمبر');
  const [selectedNewMonthYear, setSelectedNewMonthYear] = useState<number>(new Date().getFullYear());
  const [isAddEntryModalOpen, setIsAddEntryModalOpen] = useState(false);

  // Shift Closing Modals & States (تقفيل اليومية والدرج)
  const [isShiftAuthModalOpen, setIsShiftAuthModalOpen] = useState(false);
  const [isShiftClosingModalOpen, setIsShiftClosingModalOpen] = useState(false);
  const [shiftAuthUsername, setShiftAuthUsername] = useState(currentUser?.username || '');
  const [shiftAuthPassword, setShiftAuthPassword] = useState('');
  const [shiftAuthError, setShiftAuthError] = useState('');
  const [actualCountedCashInput, setActualCountedCashInput] = useState<string>('');
  const [shiftNotes, setShiftNotes] = useState('');
  const [isExportingShift, setIsExportingShift] = useState(false);

  // Yearly Archive Modal & States (أرشفة السنة وبدء سنة جديدة)
  const [isYearArchiveModalOpen, setIsYearArchiveModalOpen] = useState(false);
  const [yearToArchiveInput, setYearToArchiveInput] = useState<number>(new Date().getFullYear());

  // XLSX export loading state
  const [isExportingXLSX, setIsExportingXLSX] = useState(false);

  // Today's shift financial calculations
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayShiftStatus = getTodayShiftStatus();

  // Today's direct cash collected at reception
  const todayDirectEntries = masterReportEntries.filter(
    (e) => e.date?.startsWith(todayIso) && e.paymentMethod !== 'coach_collected'
  );
  const todayDirectCash = todayDirectEntries.reduce((sum, e) => sum + e.amount, 0);

  // Today's coach repayments
  const todayRepayments = cashInflows.filter(
    (i) => i.type === 'coach_settlement' && i.date.startsWith(todayIso)
  );
  const todayRepaymentsAmount = todayRepayments.reduce((sum, i) => sum + i.amount, 0);

  // Today's expenses from drawer
  const todayExpenses = expenses.filter(
    (e) => e.date.startsWith(todayIso) && e.paymentMethod === 'cash'
  );
  const todayExpensesAmount = todayExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Expected Net Drawer Cash today
  const todayExpectedNetCash = todayDirectCash + todayRepaymentsAmount - todayExpensesAmount;

  // Today's coach debts loaded
  const todayCoachDebts = masterReportEntries.filter(
    (e) => e.date?.startsWith(todayIso) && e.paymentMethod === 'coach_collected'
  );
  const todayCoachDebtsAmount = todayCoachDebts.reduce((sum, e) => sum + e.amount, 0);

  // Available years dynamically extracted from cycles, entries, and current year
  const availableYears = Array.from(
    new Set([
      String(new Date().getFullYear()),
      '2026',
      '2025',
      ...billingCycles.map((c) => {
        const match = c.name.match(/\d{4}/);
        return match ? match[0] : '';
      }),
      ...masterReportEntries.map((e) => {
        const match = e.month?.match(/\d{4}/) || e.date?.match(/\d{4}/);
        return match ? match[0] : '';
      }),
    ])
  )
    .filter(Boolean)
    .sort()
    .reverse();

  // Filter cycles list by selected year if active
  const displayedCycles = billingCycles.filter((cycle) => {
    if (selectedYearFilter === 'all') return true;
    return cycle.name.includes(selectedYearFilter);
  });

  // Manual entry form
  const [newEntryForm, setNewEntryForm] = useState({
    playerName: '',
    playerCode: '',
    amount: 500,
    coachId: '',
    sessionCategory: 'gym' as SessionCategory,
    sessionTitle: 'اشتراك شهري',
    paymentMethod: 'coach_collected' as 'cash' | 'coach_collected' | 'instapay',
    paymentStatus: 'pending_on_coach' as 'paid' | 'pending_on_coach' | 'unpaid',
    notes: '',
  });

  // Filter entries according to month, year and search/filters
  const filteredEntries = masterReportEntries.filter((item) => {
    // Year filter (when viewing all months or filtering)
    if (selectedYearFilter !== 'all') {
      const matchYear =
        item.month?.includes(selectedYearFilter) || item.date?.startsWith(selectedYearFilter);
      if (!matchYear) return false;
    }

    // Month filter
    if (selectedMonth !== 'all' && item.month !== selectedMonth) {
      return false;
    }

    // Category filter
    if (categoryFilter !== 'all' && item.sessionCategory !== categoryFilter) {
      return false;
    }

    // Payment method filter
    if (paymentMethodFilter !== 'all' && item.paymentMethod !== paymentMethodFilter) {
      return false;
    }

    // Status filter
    if (statusFilter !== 'all' && item.paymentStatus !== statusFilter) {
      return false;
    }

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.playerName.toLowerCase().includes(q);
      const matchCode = item.playerCode?.toLowerCase().includes(q) || false;
      const matchCoach = item.coachName?.toLowerCase().includes(q) || false;
      const matchTitle = item.sessionTitle?.toLowerCase().includes(q) || false;
      return matchName || matchCode || matchCoach || matchTitle;
    }

    return true;
  });

  // 1. Separate Direct Subscriptions (regular payments at the top) vs Coach Loaded Players
  const directEntries = filteredEntries.filter((e) => e.paymentMethod !== 'coach_collected');
  const coachEntries = filteredEntries.filter((e) => e.paymentMethod === 'coach_collected');

  // 2. Filter Expenses & Repayments dynamically according to selectedMonth and selectedYearFilter
  const filteredExpenses = expenses.filter((exp) => {
    if (selectedMonth === 'all') {
      if (selectedYearFilter !== 'all') {
        return exp.date.startsWith(selectedYearFilter);
      }
      return true;
    }
    const { year, monthNum } = parseMonthYear(selectedMonth);
    if (year && monthNum) {
      return exp.date.startsWith(`${year}-${monthNum}`);
    }
    return exp.date.includes(selectedMonth);
  });

  const filteredRepayments = cashInflows.filter((inf) => {
    if (inf.type !== 'coach_settlement') return false;
    if (selectedMonth === 'all') {
      if (selectedYearFilter !== 'all') {
        return inf.date.startsWith(selectedYearFilter);
      }
      return true;
    }
    const { year, monthNum } = parseMonthYear(selectedMonth);
    if (year && monthNum) {
      return inf.date.startsWith(`${year}-${monthNum}`);
    }
    return inf.date.includes(selectedMonth);
  });

  // Financial aggregates
  const totalDirectRevenue = directEntries.reduce((sum, item) => sum + item.amount, 0);
  const totalCoachDebtRevenue = coachEntries.reduce((sum, item) => sum + item.amount, 0);
  const grandTotalPlayerRevenue = totalDirectRevenue + totalCoachDebtRevenue;

  const totalExpensesAmount = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const totalRepaymentsAmount = filteredRepayments.reduce((sum, rep) => sum + rep.amount, 0);

  // Net Cash in Drawer for the period (Direct Cash/Inflows + Repayments - Expenses)
  const netPeriodCash = totalDirectRevenue + totalRepaymentsAmount - totalExpensesAmount;

  // Handlers
  const handleExportCSV = () => {
    exportMasterReportToCSV(selectedMonth);
    sounds.playSuccessDing();
  };

  const handleExportXLSX = async () => {
    setIsExportingXLSX(true);
    try {
      await exportMasterReportXLSX(selectedMonth);
      sounds.playSuccessDing();
    } catch {
      // ignore
    } finally {
      setIsExportingXLSX(false);
    }
  };

  const handleShiftAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShiftAuthError('');

    const matchedUser = users.find(
      (u) =>
        u.username.toLowerCase() === shiftAuthUsername.trim().toLowerCase() &&
        u.password === shiftAuthPassword &&
        u.active
    );

    if (!matchedUser) {
      setShiftAuthError('بيانات الدخول غير صحيحة، يرجى التأكد من اسم المستخدم وكلمة المرور');
      return;
    }

    sounds.playSuccessDing();
    setIsShiftAuthModalOpen(false);
    setActualCountedCashInput(String(todayExpectedNetCash));
    setIsShiftClosingModalOpen(true);
  };

  const handleConfirmShiftClose = (e: React.FormEvent) => {
    e.preventDefault();
    const actualCashNum = parseFloat(actualCountedCashInput) || 0;
    const diff = actualCashNum - todayExpectedNetCash;

    closeDailyShift({
      date: todayIso,
      closedBy: currentUser?.name || shiftAuthUsername || 'المدير العام',
      totalDirectCash: todayDirectCash,
      totalRepayments: todayRepaymentsAmount,
      totalPosCash: 0,
      totalPhysioCash: 0,
      totalExpenses: todayExpensesAmount,
      expectedNetDrawerCash: todayExpectedNetCash,
      actualCountedCash: actualCashNum,
      difference: diff,
      totalCoachDebtsLoadedToday: todayCoachDebtsAmount,
      notes: shiftNotes.trim() || undefined,
    });

    sounds.playCashRegister();
    setIsShiftClosingModalOpen(false);
    setShiftAuthPassword('');
    setShiftNotes('');
  };

  const handleExportDailyShiftFile = async () => {
    setIsExportingShift(true);
    try {
      await exportDailyShiftXLSX();
      sounds.playSuccessDing();
    } catch {
      // ignore
    } finally {
      setIsExportingShift(false);
    }
  };

  const handleConfirmYearArchive = (e: React.FormEvent) => {
    e.preventDefault();
    archiveYear(yearToArchiveInput, currentUser?.name || 'المدير العام');
    sounds.playCashRegister();
    setIsYearArchiveModalOpen(false);
    setSelectedYearFilter(String(yearToArchiveInput));
  };

  const handleStartNewMonthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const compositeName = `${selectedNewMonthName} ${selectedNewMonthYear}`.trim();
    if (!compositeName) return;

    startNewMonth(compositeName);
    setSelectedMonth(compositeName);
    setSelectedYearFilter(String(selectedNewMonthYear));
    setIsNewMonthModalOpen(false);
    sounds.playCashRegister();
  };

  const handleCreateEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntryForm.playerName || newEntryForm.amount <= 0) return;

    const coach = coaches.find((t: Coach) => t.id === newEntryForm.coachId);

    addMasterReportEntry({
      playerName: newEntryForm.playerName,
      playerCode: newEntryForm.playerCode || Math.floor(100000 + Math.random() * 900000).toString(),
      amount: Number(newEntryForm.amount),
      coachId: newEntryForm.coachId || undefined,
      coachName: coach ? coach.name : 'اشتراك عام بالخزينة',
      sessionCategory: newEntryForm.sessionCategory,
      sessionTitle: newEntryForm.sessionTitle,
      paymentMethod: newEntryForm.paymentMethod,
      paymentStatus: newEntryForm.paymentStatus,
      notes: newEntryForm.notes,
      month: selectedMonth === 'all' ? currentMonth : selectedMonth,
      date: new Date().toISOString(),
      sourceType: 'manual',
    });

    sounds.playCashRegister();
    setIsAddEntryModalOpen(false);
    setNewEntryForm({
      playerName: '',
      playerCode: '',
      amount: 500,
      coachId: '',
      sessionCategory: 'gym',
      sessionTitle: 'اشتراك شهري',
      paymentMethod: 'coach_collected',
      paymentStatus: 'pending_on_coach',
      notes: '',
    });
  };

  const getCategoryBadge = (cat?: SessionCategory) => {
    switch (cat) {
      case 'private':
        return (
          <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold text-[11px] whitespace-nowrap">
            تدريب خاص (Private)
          </span>
        );
      case 'group':
        return (
          <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold text-[11px] whitespace-nowrap">
            كلاس جماعي (Group)
          </span>
        );
      case 'physio':
        return (
          <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold text-[11px] whitespace-nowrap">
            علاج طبيعي (Physio)
          </span>
        );
      case 'massage':
        return (
          <span className="px-2.5 py-1 rounded-lg bg-pink-500/20 text-pink-300 border border-pink-500/30 font-bold text-[11px] whitespace-nowrap">
            مساج واستشفاء
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[11px] whitespace-nowrap">
            جيم عام (Gym)
          </span>
        );
    }
  };

  const getPaymentMethodBadge = (method: string) => {
    switch (method) {
      case 'coach_collected':
        return (
          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-[11px] flex items-center gap-1 whitespace-nowrap">
            <User className="w-3 h-3" />
            <span>مع الكابتن</span>
          </span>
        );
      case 'instapay':
        return (
          <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold text-[11px] flex items-center gap-1 whitespace-nowrap">
            <Smartphone className="w-3 h-3" />
            <span>إنستاباي</span>
          </span>
        );
      case 'card':
        return (
          <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold text-[11px] flex items-center gap-1 whitespace-nowrap">
            <CreditCard className="w-3 h-3" />
            <span>بطاقة / فيزا</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[11px] flex items-center gap-1 whitespace-nowrap">
            <Banknote className="w-3 h-3" />
            <span>كاش بالخزينة</span>
          </span>
        );
    }
  };

  const getExpenseCategoryBadge = (category: string) => {
    switch (category) {
      case 'electricity':
        return <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">كهرباء وتكييف</span>;
      case 'water':
        return <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold text-[10px]">مياه ومرافق</span>;
      case 'maintenance':
        return <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">صيانة وأجهزة</span>;
      case 'rent':
        return <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold text-[10px]">إيجار مقر</span>;
      case 'trainer_payout':
        return <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-bold text-[10px]">رواتب كباتن</span>;
      case 'supplies':
        return <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold text-[10px]">نظافة ومستلزمات</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-bold text-[10px]">مصاريف نثرية</span>;
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner & Main Actions */}
      <div className="bg-gradient-to-r from-[#0b1c2b] via-[#0d2235] to-[#071520] border-2 border-teal-500/30 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2.5 rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider px-3 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40">
                التقرير المالي والتشغيلي الشامل (Master Excel Ledger)
              </span>
            </div>
            <h2 className="text-2xl font-black text-white">
              دفتر وسجل الاشتراكات المجمع وجداول المصاريف وسداد التحميل المتوازية
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
              سجل تفصيلي احترافي يضع الاشتراكات المباشرة أولاً، تليها مجموعات لاعبي الكباتن مع حالة "تحميل"، وجداول متوازية بالعرض للمصاريف وإيداعات سداد التحميل مع تصدير إكسيل متكامل.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Export to XLSX (Excel) */}
            <button
              onClick={handleExportXLSX}
              disabled={isExportingXLSX}
              className="flex-1 sm:flex-none py-3.5 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition cursor-pointer disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              <span>{isExportingXLSX ? 'جارِ إنشاء شيت الإكسيل...' : 'تحميل شيت إكسيل احترافي (.xlsx)'}</span>
            </button>

            {/* Daily Shift Closing Button */}
            <button
              onClick={() => {
                setShiftAuthError('');
                setShiftAuthPassword('');
                setIsShiftAuthModalOpen(true);
              }}
              className="flex-1 sm:flex-none py-3.5 px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>تقفيل اليومية والدرج</span>
            </button>

            {/* Yearly Archive Button */}
            <button
              onClick={() => setIsYearArchiveModalOpen(true)}
              className="flex-1 sm:flex-none py-3.5 px-4 rounded-2xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Archive className="w-4 h-4" />
              <span>أرشفة وبدء سنة جديدة</span>
            </button>

            {/* Start New Month Button */}
            <button
              onClick={() => setIsNewMonthModalOpen(true)}
              className="flex-1 sm:flex-none py-3.5 px-4 rounded-2xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
              <span>بدء شهر جديد</span>
            </button>

            {/* Add Manual Entry */}
            <button
              onClick={() => setIsAddEntryModalOpen(true)}
              className="flex-1 sm:flex-none py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-teal-400" />
              <span>إضافة قيد</span>
            </button>
          </div>
        </div>

        {/* Month Selector Bar & Quick Meta */}
        <div className="mt-8 pt-6 border-t border-teal-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Year Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">السنة:</span>
              <select
                value={selectedYearFilter}
                onChange={(e) => {
                  setSelectedYearFilter(e.target.value);
                  if (e.target.value !== 'all' && selectedMonth !== 'all' && !selectedMonth.includes(e.target.value)) {
                    setSelectedMonth('all');
                  }
                }}
                className="bg-slate-900 border border-slate-700 hover:border-teal-500/40 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-teal-400 cursor-pointer shadow-inner"
              >
                <option value="all">كل السنوات</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-teal-400" />
                <span>الشهر المالي:</span>
              </span>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-900 border border-teal-500/40 rounded-xl px-4 py-2 text-xs font-bold text-teal-300 focus:outline-none focus:border-teal-400 cursor-pointer shadow-inner"
              >
                <option value="all">كل الشهور (تراكمي كامل)</option>
                {displayedCycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.name}>
                    {cycle.name} {cycle.isActive ? '(الشهر الحالي النشط)' : '(شهر مؤرشف)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Year Archive Status Banner if selected year is archived */}
            {(() => {
              const yrNum = parseInt(selectedYearFilter);
              const arch = yearlyArchives.find((a) => a.year === yrNum);
              if (!arch) return null;
              return (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-950/70 border border-indigo-500/40 text-xs">
                  <Archive className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-indigo-300 font-bold">
                    أرشيف {arch.year} ({arch.totalCheckIns} حضور)
                  </span>
                  <button
                    onClick={() => exportYearlyArchiveXLSX(arch.year)}
                    className="px-2 py-0.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-black text-[10px] cursor-pointer"
                  >
                    إكسيل (.xlsx)
                  </button>
                  <button
                    onClick={() => exportYearlyArchiveJSON(arch.year)}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] border border-slate-700 cursor-pointer"
                  >
                    JSON
                  </button>
                </div>
              );
            })()}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-teal-400" />
              <span>
                إجمالي قيود اللاعبين:{' '}
                <strong className="text-white font-mono">{filteredEntries.length} قيد</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-rose-400" />
              <span>
                المصاريف المسجلة:{' '}
                <strong className="text-white font-mono">{filteredExpenses.length} بند</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
              <span>
                إيداعات سداد التحميل:{' '}
                <strong className="text-white font-mono">{filteredRepayments.length} توريد</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5 Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Grand Revenue */}
        <div className="p-5 rounded-3xl bg-[#0f172a]/90 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-bold">إجمالي قيود اللاعبين</span>
            <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-white font-mono">{formatEGP(grandTotalPlayerRevenue)}</div>
          <p className="text-[10px] text-slate-500 mt-1">مباشر + مديونيات الكباتن</p>
        </div>

        {/* Direct Subscriptions Revenue */}
        <div className="p-5 rounded-3xl bg-[#0f172a]/90 border border-emerald-500/30 shadow-xl">
          <div className="flex items-center justify-between text-xs text-emerald-300 mb-2">
            <span className="font-bold">اشتراكات بالخزينة</span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-400 font-mono">
            {formatEGP(totalDirectRevenue)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">سداد مباشر أول الجدول</p>
        </div>

        {/* Coach Debt Revenue */}
        <div className="p-5 rounded-3xl bg-[#0f172a]/90 border border-amber-500/30 shadow-xl">
          <div className="flex items-center justify-between text-xs text-amber-300 mb-2">
            <span className="font-bold">تحميل على الكباتن</span>
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <User className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-amber-400 font-mono">
            {formatEGP(totalCoachDebtRevenue)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">حالة تحميل (مديونيات)</p>
        </div>

        {/* Coach Debt Repayments */}
        <div className="p-5 rounded-3xl bg-[#0f172a]/90 border border-cyan-500/30 shadow-xl">
          <div className="flex items-center justify-between text-xs text-cyan-300 mb-2">
            <span className="font-bold">إيداع سداد تحميل</span>
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-cyan-400 font-mono">
            {formatEGP(totalRepaymentsAmount)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">سدادات موردة للخزينة</p>
        </div>

        {/* Total Expenses */}
        <div className="p-5 rounded-3xl bg-[#0f172a]/90 border border-rose-500/30 shadow-xl">
          <div className="flex items-center justify-between text-xs text-rose-300 mb-2">
            <span className="font-bold">المصاريف التشغيلية</span>
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-rose-400 font-mono">
            {formatEGP(totalExpensesAmount)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">منصرفة من الدرج</p>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. MAIN EXCEL-STYLE TABLE: PLAYERS & SESSIONS LEDGER     */}
      {/* ======================================================== */}
      <div className="bg-[#0f172a]/90 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
        {/* Controls Row */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-teal-400" />
            <h3 className="text-base font-black text-white">
              الجدول الأساسي للاعبين والتحميلات (الاشتراكات المباشرة أولاً ثم لاعبو كل كابتن)
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto text-xs">
            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باللاعب أو الكود أو الكابتن..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 pl-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-2.5 top-2.5" />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-teal-500"
            >
              <option value="all">كل الأنشطة</option>
              <option value="gym">جيم عام (Gym)</option>
              <option value="private">تدريب خاص (Private)</option>
              <option value="group">كلاس جماعي (Group)</option>
              <option value="physio">علاج طبيعي (Physio)</option>
              <option value="massage">مساج واستشفاء</option>
            </select>

            {/* Payment Method Filter */}
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-teal-500"
            >
              <option value="all">كل طرق الدفع</option>
              <option value="coach_collected">تحميل على الكابتن</option>
              <option value="cash">كاش بالخزينة</option>
              <option value="instapay">إنستاباي</option>
            </select>
          </div>
        </div>

        {/* Master Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 text-[11px] font-bold">
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-4">اسم اللاعب</th>
                <th className="py-3 px-3">نوع التمرين</th>
                <th className="py-3 px-4 text-teal-300">السعر (ج.م)</th>
                <th className="py-3 px-4">الحالة</th>
                <th className="py-3 px-4">مع كابتن مين</th>
                <th className="py-3 px-3">طريقة الدفع</th>
                <th className="py-3 px-3">التاريخ</th>
                <th className="py-3 px-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {/* ==================================================== */}
              {/* SECTION A: DIRECT SUBSCRIPTIONS & CASH AT THE TOP    */}
              {/* ==================================================== */}
              <tr className="bg-emerald-950/30 border-y-2 border-emerald-500/40">
                <td colSpan={9} className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span className="font-black text-emerald-300 text-xs tracking-wide">
                        1. الاشتراكات العادية والمدفوعات المباشرة بالخزينة (سداد فوري كاش / إنستاباي - أول التقرير)
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-400">
                        العدد: <strong className="text-white font-mono">{directEntries.length} لاعب</strong>
                      </span>
                      <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-black font-mono">
                        إجمالي المباشر: {formatEGP(totalDirectRevenue)}
                      </span>
                    </div>
                  </div>
                </td>
              </tr>

              {directEntries.length > 0 ? (
                directEntries.map((row, idx) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-800/40 transition duration-150 odd:bg-slate-900/30"
                  >
                    <td className="py-3 px-3 font-mono text-slate-500 text-[10px]">{idx + 1}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-bold text-white">{row.playerName}</div>
                      <div className="text-[10px] font-mono text-cyan-400">{row.playerCode}</div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">{getCategoryBadge(row.sessionCategory)}</td>
                    <td className="py-3 px-4 font-black font-mono text-teal-300 text-sm whitespace-nowrap">
                      {formatEGP(row.amount)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-[11px] flex items-center gap-1.5 w-fit">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>مدفوع بالخزينة</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-bold whitespace-nowrap">
                      {row.coachName || 'اشتراك عام بالجيم'}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">{getPaymentMethodBadge(row.paymentMethod)}</td>
                    <td className="py-3 px-3 font-mono text-slate-400 text-[10px] whitespace-nowrap">
                      {new Date(row.date).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => {
                          if (confirm(`هل أنت متأكد من حذف قيد "${row.playerName}"؟`)) {
                            deleteMasterReportEntry(row.id);
                          }
                        }}
                        className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                        title="حذف القيد"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-4 text-center text-xs text-slate-500">
                    لا توجد اشتراكات مباشرة مسجلة في هذا الشهر
                  </td>
                </tr>
              )}

              {/* ==================================================== */}
              {/* SECTION B: PLAYERS GROUPED BY COACH (STATUS: تحميل)  */}
              {/* ==================================================== */}
              <tr className="bg-amber-950/30 border-y-2 border-amber-500/40">
                <td colSpan={9} className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                      <span className="font-black text-amber-300 text-xs tracking-wide">
                        2. تفصيل لاعبي الكباتن وحالات التحميل (مجمعة لكل كابتن مع حالة "تحميل")
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-400">
                        العدد: <strong className="text-white font-mono">{coachEntries.length} لاعب</strong>
                      </span>
                      <span className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-black font-mono">
                        إجمالي التحميلات: {formatEGP(totalCoachDebtRevenue)}
                      </span>
                    </div>
                  </div>
                </td>
              </tr>

              {/* Render Players Grouped by Each Coach */}
              {coaches.map((coach) => {
                const thisCoachPlayers = coachEntries.filter(
                  (e) => e.coachId === coach.id || e.coachName === coach.name
                );

                if (thisCoachPlayers.length === 0) return null;

                const coachTotalAmount = thisCoachPlayers.reduce((sum, p) => sum + p.amount, 0);

                return (
                  <React.Fragment key={coach.id}>
                    {/* Coach Group Header Strip */}
                    <tr className="bg-slate-800/80 border-t border-slate-700">
                      <td colSpan={9} className="py-2.5 px-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                              <User className="w-3.5 h-3.5" />
                            </div>
                            <span className="font-black text-white text-xs">
                              {coach.name} ({coach.specialty})
                            </span>
                            <span className="text-[11px] text-slate-400">
                              - عدد اللاعبين: <strong className="text-amber-400 font-mono">{thisCoachPlayers.length}</strong>
                            </span>
                          </div>
                          <div className="text-xs font-bold text-amber-300 font-mono">
                            إجمالي تحميل الكابتن: {formatEGP(coachTotalAmount)}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Players under this coach */}
                    {thisCoachPlayers.map((row, pIdx) => (
                      <tr
                        key={row.id}
                        className="hover:bg-slate-800/50 transition duration-150 bg-slate-900/20"
                      >
                        <td className="py-3 px-3 font-mono text-slate-500 text-[10px]">
                          {pIdx + 1}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-bold text-white">{row.playerName}</div>
                          <div className="text-[10px] font-mono text-cyan-400">{row.playerCode}</div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">{getCategoryBadge(row.sessionCategory)}</td>
                        <td className="py-3 px-4 font-black font-mono text-amber-400 text-sm whitespace-nowrap">
                          {formatEGP(row.amount)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {/* STRICT REQUIREMENT: Status says "تحميل" */}
                          <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black text-xs flex items-center gap-1.5 w-fit shadow-sm">
                            <Clock className="w-3.5 h-3.5" />
                            <span>تحميل</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-200 whitespace-nowrap">
                          {coach.name}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">{getPaymentMethodBadge(row.paymentMethod)}</td>
                        <td className="py-3 px-3 font-mono text-slate-400 text-[10px] whitespace-nowrap">
                          {new Date(row.date).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <button
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من حذف قيد "${row.playerName}"؟`)) {
                                deleteMasterReportEntry(row.id);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                            title="حذف القيد"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}

              {coachEntries.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-4 text-center text-xs text-slate-500">
                    لا توجد تحميلات حصص مسجلة على الكباتن في هذا الشهر
                  </td>
                </tr>
              )}
            </tbody>

            {/* GRAND CONSOLIDATED FOOTER OF MAIN TABLE (مجمع كل إجمالي اللعيبة) */}
            <tfoot>
              <tr className="bg-slate-900 border-t-2 border-teal-500/40 text-xs font-bold">
                <td colSpan={3} className="py-4 px-4 text-white">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-teal-400" />
                    <span>إجمالي جدول التحميل الأساسي لكافة اللاعبين (مباشر + كباتن):</span>
                    <span className="font-mono text-cyan-400 font-black">
                      ({filteredEntries.length} لاعب)
                    </span>
                  </div>
                </td>
                <td className="py-4 px-4 font-black font-mono text-teal-300 text-base whitespace-nowrap">
                  {formatEGP(grandTotalPlayerRevenue)}
                </td>
                <td colSpan={5} className="py-4 px-4 text-slate-400 text-left">
                  <span className="text-[11px]">
                    مباشر بالخزينة: <strong className="text-emerald-400 font-mono">{formatEGP(totalDirectRevenue)}</strong> | 
                    تحميل على الكباتن: <strong className="text-amber-400 font-mono">{formatEGP(totalCoachDebtRevenue)}</strong>
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. THE TWO SIDE-BY-SIDE TABLES: EXPENSES & REPAYMENTS    */}
      {/* (خانتين بالعرض بعد الجدول الأساسي: المصاريف وإيداع تحميل)  */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TABLE 1: المصاريف والمبلغ */}
        <div className="bg-[#0f172a]/90 border border-rose-500/30 rounded-3xl p-6 shadow-2xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-rose-500/20 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">جدول المصاريف التشغيلية (المصاريف والمبلغ)</h3>
                  <p className="text-[11px] text-slate-400">مسحوبة تلقائياً من صفحة المصاريف وإدارة الدرج</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-black font-mono text-xs">
                {filteredExpenses.length} بند
              </span>
            </div>

            <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-2xl border border-slate-800">
              <table className="w-full text-right text-xs">
                <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 font-bold z-10">
                  <tr>
                    <th className="py-2.5 px-3">المصاريف (بيان المصروف)</th>
                    <th className="py-2.5 px-3 text-rose-400">المبلغ</th>
                    <th className="py-2.5 px-3">التصنيف</th>
                    <th className="py-2.5 px-3">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredExpenses.length > 0 ? (
                    filteredExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-800/40 transition odd:bg-slate-900/30">
                        <td className="py-2.5 px-3 text-slate-200 font-bold max-w-xs truncate">
                          {exp.title}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-black text-rose-400 whitespace-nowrap">
                          {formatEGP(exp.amount)}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">{getExpenseCategoryBadge(exp.category)}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-400 text-[10px] whitespace-nowrap">
                          {new Date(exp.date).toLocaleDateString('ar-EG')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-xs text-slate-500">
                        لا توجد مصاريف مسجلة في هذه الفترة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Expenses Total Strip */}
          <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 flex items-center justify-between">
            <span className="font-bold text-xs text-rose-300">إجمالي المصاريف التشغيلية:</span>
            <span className="text-lg font-black font-mono text-rose-400">{formatEGP(totalExpensesAmount)}</span>
          </div>
        </div>

        {/* TABLE 2: إيداع تحميل والمبلغ */}
        <div className="bg-[#0f172a]/90 border border-cyan-500/30 rounded-3xl p-6 shadow-2xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-cyan-500/20 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">جدول إيداعات سداد التحميل (إيداع تحميل والمبلغ)</h3>
                  <p className="text-[11px] text-slate-400">سدادات وتوريدات الكباتن المسددة كاش أو إنستاباي</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-black font-mono text-xs">
                {filteredRepayments.length} إيداع
              </span>
            </div>

            <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-2xl border border-slate-800">
              <table className="w-full text-right text-xs">
                <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 font-bold z-10">
                  <tr>
                    <th className="py-2.5 px-3">إيداع تحميل (اسم الكابتن / البند)</th>
                    <th className="py-2.5 px-3 text-cyan-400">المبلغ</th>
                    <th className="py-2.5 px-3">طريقة السداد</th>
                    <th className="py-2.5 px-3">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredRepayments.length > 0 ? (
                    filteredRepayments.map((rep) => (
                      <tr key={rep.id} className="hover:bg-slate-800/40 transition odd:bg-slate-900/30">
                        <td className="py-2.5 px-3 text-slate-200 font-bold max-w-xs truncate">
                          {rep.title}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-black text-cyan-400 whitespace-nowrap">
                          {formatEGP(rep.amount)}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">{getPaymentMethodBadge(rep.paymentMethod)}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-400 text-[10px] whitespace-nowrap">
                          {new Date(rep.date).toLocaleDateString('ar-EG')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-xs text-slate-500">
                        لا توجد إيداعات سداد تحميل مسجلة في هذه الفترة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Repayments Total Strip */}
          <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 flex items-center justify-between">
            <span className="font-bold text-xs text-cyan-300">إجمالي إيداعات سداد التحميل:</span>
            <span className="text-lg font-black font-mono text-cyan-400">{formatEGP(totalRepaymentsAmount)}</span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. RECONCILIATION SUMMARY BAR: CONSOLIDATED NET          */}
      {/* ======================================================== */}
      <div className="bg-gradient-to-r from-slate-900 via-[#0e1e2d] to-slate-900 border border-teal-500/40 rounded-3xl p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-black text-white">ملخص التصفية الشامل وصافي التدفق المالي بالدرج</h4>
              <p className="text-xs text-slate-400">
                (الاشتراكات المباشرة + إيداعات سداد التحميل المستلمة) - المصاريف التشغيلية المنصرفة
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-center">
              <div className="text-[10px] text-slate-400">إجمالي اشتراكات الخزينة</div>
              <div className="text-sm font-bold text-emerald-400">{formatEGP(totalDirectRevenue)}</div>
            </div>

            <span className="text-slate-500 font-black text-lg">+</span>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-center">
              <div className="text-[10px] text-slate-400">إيداعات سداد التحميل</div>
              <div className="text-sm font-bold text-cyan-400">{formatEGP(totalRepaymentsAmount)}</div>
            </div>

            <span className="text-slate-500 font-black text-lg">-</span>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-center">
              <div className="text-[10px] text-slate-400">المصاريف التشغيلية</div>
              <div className="text-sm font-bold text-rose-400">{formatEGP(totalExpensesAmount)}</div>
            </div>

            <span className="text-slate-500 font-black text-lg">=</span>

            <div className="p-3 px-5 rounded-2xl bg-teal-500/20 border border-teal-500/40 text-center">
              <div className="text-[10px] text-teal-300 font-bold">صافي النقدية المحصلة بالدرج</div>
              <div className="text-lg font-black text-white">{formatEGP(netPeriodCash)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Start New Month Modal */}
      {isNewMonthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-teal-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-teal-500/20 text-teal-400">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">بدء شهر مالي جديد (New Billing Cycle)</h3>
                <p className="text-xs text-slate-400">أرشفة الشهر السابق وبدء دورة محاسبية جديدة محددة بالسنة</p>
              </div>
            </div>

            <form onSubmit={handleStartNewMonthSubmit} className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>الشهر الحالي المفتوح:</span>
                  <span className="font-bold text-amber-400">{currentMonth}</span>
                </div>
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  💡 عند بدء شهر جديد، سيتم نقل الشهر الحالي إلى الأرشيف التاريخي، وستظل كافة بياناته
                  وقيوده ومصاريفه محفوظة بالكامل ويمكن الرجوع إليها والاطلاع عليها وتحميلها في أي وقت!
                </div>
              </div>

              {/* Dedicated Month & Year Pickers */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    اختر الشهر:
                  </label>
                  <select
                    value={selectedNewMonthName}
                    onChange={(e) => setSelectedNewMonthName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 font-bold cursor-pointer"
                  >
                    {ARABIC_MONTH_NAMES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    اختر / حدد السنة:
                  </label>
                  <input
                    type="number"
                    min="2020"
                    max="2035"
                    required
                    value={selectedNewMonthYear}
                    onChange={(e) => setSelectedNewMonthYear(parseInt(e.target.value) || 2026)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">اسم الدورة المالية الجديدة:</span>
                <span className="font-black text-teal-300 text-sm font-mono bg-teal-950/60 px-3 py-1 rounded-xl border border-teal-500/40">
                  {selectedNewMonthName} {selectedNewMonthYear}
                </span>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-teal-500/20 transition"
                >
                  تأكيد وبدء الدورة الجديدة
                </button>
                <button
                  type="button"
                  onClick={() => setIsNewMonthModalOpen(false)}
                  className="py-3 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-700 transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Manual Entry Modal */}
      {isAddEntryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-base font-black text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-teal-400" />
              <span>إضافة قيد اشتراك / حصة في التقرير الشامل</span>
            </h3>

            <form onSubmit={handleCreateEntrySubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">اسم اللاعب</label>
                  <input
                    type="text"
                    required
                    value={newEntryForm.playerName}
                    onChange={(e) =>
                      setNewEntryForm({ ...newEntryForm, playerName: e.target.value })
                    }
                    placeholder="اسم العضو"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">كود اللاعب</label>
                  <input
                    type="text"
                    value={newEntryForm.playerCode}
                    onChange={(e) =>
                      setNewEntryForm({ ...newEntryForm, playerCode: e.target.value })
                    }
                    placeholder="مثال: 102938"
                    inputMode="numeric"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-teal-500 dir-ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">المبلغ (ج.م)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newEntryForm.amount}
                    onChange={(e) =>
                      setNewEntryForm({ ...newEntryForm, amount: Number(e.target.value) })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-teal-400 font-bold focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">الكابتن المسؤول</label>
                  <select
                    value={newEntryForm.coachId}
                    onChange={(e) =>
                      setNewEntryForm({ ...newEntryForm, coachId: e.target.value })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="">-- اشتراك عام بالخزينة (بدون كابتن) --</option>
                    {coaches.map((t: Coach) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">نوع السيشن / التمرين</label>
                  <select
                    value={newEntryForm.sessionCategory}
                    onChange={(e) =>
                      setNewEntryForm({
                        ...newEntryForm,
                        sessionCategory: e.target.value as SessionCategory,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="gym">اشتراك جيم عام (Gym)</option>
                    <option value="private">تدريب خاص (Private PT)</option>
                    <option value="group">كلاس جماعي (Group Class)</option>
                    <option value="physio">علاج طبيعي (Physio)</option>
                    <option value="massage">مساج واستشفاء</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">طريقة الدفع</label>
                  <select
                    value={newEntryForm.paymentMethod}
                    onChange={(e) => {
                      const method = e.target.value as any;
                      setNewEntryForm({
                        ...newEntryForm,
                        paymentMethod: method,
                        paymentStatus: method === 'coach_collected' ? 'pending_on_coach' : 'paid',
                      });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="coach_collected">مع الكابتن (تحميل مديونية)</option>
                    <option value="cash">كاش بالخزينة (سداد فوري)</option>
                    <option value="instapay">إنستاباي</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">بيان الحصة / الباقة</label>
                <input
                  type="text"
                  value={newEntryForm.sessionTitle}
                  onChange={(e) =>
                    setNewEntryForm({ ...newEntryForm, sessionTitle: e.target.value })
                  }
                  placeholder="مثال: باقة PT 6 حصص أو اشتراك شهري"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-teal-500/20"
                >
                  حفظ القيد بالتقرير
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddEntryModalOpen(false)}
                  className="py-3 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-700"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. Shift Auth Modal (Authentication Guard) */}
      {isShiftAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0f172a] border border-amber-500/30 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">التحقق الأمني - تقفيل اليومية والدرج</h3>
                  <p className="text-xs text-slate-400 mt-0.5">يتطلب صلاحيات إدارية (Admin / Manager)</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsShiftAuthModalOpen(false);
                  setShiftAuthError('');
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {shiftAuthError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{shiftAuthError}</span>
              </div>
            )}

            <form onSubmit={handleShiftAuthSubmit} className="space-y-4 mt-5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم المستخدم (المسؤول)</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={shiftAuthUsername}
                    onChange={(e) => setShiftAuthUsername(e.target.value)}
                    placeholder="اسم المستخدم"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 transition"
                  />
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">كلمة المرور الإدارية</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    autoFocus
                    value={shiftAuthPassword}
                    onChange={(e) => setShiftAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500 transition dir-ltr text-right"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>متابعة لمطابقة النقدية والتقفيل</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsShiftAuthModalOpen(false);
                    setShiftAuthError('');
                  }}
                  className="py-3 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-700 transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Daily Shift Reconciliation Modal */}
      {isShiftClosingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Banknote className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">تقفيل اليومية ومطابقة النقدية بالدرج</h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                    <span className="flex items-center gap-1 font-mono text-amber-300">
                      <Clock className="w-3.5 h-3.5" />
                      {todayIso}
                    </span>
                    <span>•</span>
                    <span>المسؤول: {currentUser?.name || shiftAuthUsername || 'الإدارة'}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsShiftClosingModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {todayShiftStatus.isClosedToday && (
              <div className="mt-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  تنبيه: تم تسجيل تقفيل لليومية مسبقاً في تمام الساعة{' '}
                  <strong className="font-mono">{new Date(todayShiftStatus.lastClosing!.closedAt).toLocaleTimeString('ar-EG')}</strong>{' '}
                  بواسطة ({todayShiftStatus.lastClosing?.closedBy}). إعادة التقفيل ستحدث المحضر الحالي.
                </span>
              </div>
            )}

            {/* Financial Reconciliation KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                <p className="text-[11px] font-bold text-slate-400">كاش اشتراكات الاستقبال</p>
                <p className="text-base font-black text-emerald-400 font-mono mt-1">
                  +{formatEGP(todayDirectCash)}
                </p>
                <span className="text-[10px] text-slate-500">{todayDirectEntries.length} حركة اشتراك مباشر</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                <p className="text-[11px] font-bold text-slate-400">سدادات الكباتن للدرج</p>
                <p className="text-base font-black text-cyan-400 font-mono mt-1">
                  +{formatEGP(todayRepaymentsAmount)}
                </p>
                <span className="text-[10px] text-slate-500">{todayRepayments.length} إيداع سداد مديونية</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                <p className="text-[11px] font-bold text-slate-400">مصاريف مسحوبة من الدرج</p>
                <p className="text-base font-black text-rose-400 font-mono mt-1">
                  -{formatEGP(todayExpensesAmount)}
                </p>
                <span className="text-[10px] text-slate-500">{todayExpenses.length} بنود مصاريف نقدية</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <p className="text-[11px] font-bold text-slate-400">تحميلات مديونيات الكباتن</p>
                <p className="text-base font-black text-amber-400 font-mono mt-1">
                  {formatEGP(todayCoachDebtsAmount)}
                </p>
                <span className="text-[10px] text-slate-500">لا تدخل الدرج ككاش (تثبت كمديونية)</span>
              </div>

              <div className="col-span-2 p-4 rounded-2xl bg-gradient-to-r from-teal-950/40 to-emerald-950/30 border-2 border-teal-500/40 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-teal-300">الصافي النقدي المتوقع بالدرج (Expected Cash)</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    (كاش الاشتراكات + سدادات الكباتن) - مصاريف الدرج
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-xl font-black text-teal-400 font-mono">
                    {formatEGP(todayExpectedNetCash)}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleConfirmShiftClose} className="space-y-4 mt-6">
              {/* Actual counted cash field */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <label className="block text-xs font-bold text-slate-200">
                  النقدية الفعلية المحصورة داخل الدرج الآن (العد الفعلي اليدوي):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={actualCountedCashInput}
                    onChange={(e) => setActualCountedCashInput(e.target.value)}
                    placeholder="أدخل إجمالي النقدية المعدودة بالدرج"
                    className="w-full bg-slate-950 border-2 border-slate-700 rounded-xl px-4 py-3 text-base text-teal-300 font-mono font-black focus:outline-none focus:border-teal-500 transition"
                  />
                  <span className="absolute left-4 top-3 text-xs text-slate-500 font-bold">ج.م نقداً</span>
                </div>

                {/* Discrepancy indicator */}
                {(() => {
                  const actualNum = parseFloat(actualCountedCashInput) || 0;
                  const diff = actualNum - todayExpectedNetCash;
                  if (actualCountedCashInput === '') return null;
                  if (diff === 0) {
                    return (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 font-bold text-xs flex items-center justify-between">
                        <span>حالة المطابقة:</span>
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          مطابق تماماً (لا يوجد أي عجز أو زيادة)
                        </span>
                      </div>
                    );
                  }
                  if (diff > 0) {
                    return (
                      <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 font-bold text-xs flex items-center justify-between">
                        <span>فائض نقدي بالدرج (زيادة):</span>
                        <span className="font-mono font-black text-sm">+{formatEGP(diff)}</span>
                      </div>
                    );
                  }
                  return (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 font-bold text-xs flex items-center justify-between">
                      <span>عجز نقدي بالدرج (نقص):</span>
                      <span className="font-mono font-black text-sm">-{formatEGP(Math.abs(diff))}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  ملاحظات تقفيل الوردية (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={shiftNotes}
                  onChange={(e) => setShiftNotes(e.target.value)}
                  placeholder="أي ملاحظات حول العجز/الفائض أو استلام النقدية أو تسليم الوردية التالية..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 transition"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>تأثير تقفيل اليومية:</strong> يتم حفظ تقرير الإغلاق واعتماده رسمياً، وإعادة ضبط حسابات الدرج اليومية لتبدأ غداً برصيد جديد ونظيف، مع بقاء كافة مديونيات الكباتن واشتراكات الأعضاء محفوظة بدون أي مساس.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={handleExportDailyShiftFile}
                  disabled={isExportingShift}
                  className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-400 border border-teal-500/30 font-bold text-xs cursor-pointer flex items-center justify-center gap-2 transition disabled:opacity-60"
                >
                  <Download className="w-4 h-4" />
                  <span>{isExportingShift ? 'جارِ التحميل...' : 'تحميل شيت إكسيل للوردية (.xlsx)'}</span>
                </button>

                <div className="flex items-center gap-3 w-full sm:flex-1">
                  <button
                    type="submit"
                    className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تأكيد إغلاق الوردية وتصفير الدرج</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsShiftClosingModalOpen(false)}
                    className="py-3 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-700 transition"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Yearly Archive Modal */}
      {isYearArchiveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0f172a] border border-indigo-500/30 rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Archive className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">أرشفة وبدء سنة مالية جديدة</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    تجميع البيانات السنوية وحفظ سرعة وخفة السيستم
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsYearArchiveModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmYearArchive} className="space-y-4 mt-5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  حدد السنة المراد أرشفتها وإغلاق سنتها المالية
                </label>
                <select
                  value={yearToArchiveInput}
                  onChange={(e) => setYearToArchiveInput(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      سنة {y} {String(y) === String(new Date().getFullYear()) ? '(السنة الحالية)' : ''}
                    </option>
                  ))}
                  <option value={new Date().getFullYear() + 1}>
                    سنة {new Date().getFullYear() + 1} (السنة القادمة)
                  </option>
                </select>
              </div>

              {/* Explanatory benefit boxes */}
              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-2.5 text-slate-300">
                  <Database className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" />
                  <span>
                    <strong>تجميع شامل:</strong> يتم تحزيم وحساب إجمالي إيرادات ومصاريف وأرباح شهور سنة {yearToArchiveInput} وحفظها في جدول <code className="text-indigo-300">yearly_archives</code>.
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-2.5 text-slate-300">
                  <FileSpreadsheet className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  <span>
                    <strong>تصدير فوري دائم:</strong> يمكنك تصفح سنة {yearToArchiveInput} في أي وقت وتحميل شيت إكسيل احترافي (.xlsx) أو ملف JSON متكامل بنقرة واحدة.
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-amber-300">
                  <Sparkles className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <span>
                    <strong>تفريغ السجلات النشطة (Purge Logs):</strong> يتم مسح سجلات الحضور النشطة الخاصة بسنة {yearToArchiveInput} فقط بعد حفظ لقطة كاملة منها في الأرشيف لتخفيف قاعدة البيانات والحفاظ على سرعة السيستم.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-indigo-500/20 transition flex items-center justify-center gap-2"
                >
                  <Archive className="w-4 h-4" />
                  <span>تأكيد أرشفة سنة {yearToArchiveInput} وبدء الدورة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsYearArchiveModalOpen(false)}
                  className="py-3 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-700 transition"
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

