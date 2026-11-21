import React, { useState } from 'react';
import {
  WalletCards,
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  Zap,
  Droplets,
  Wrench,
  Building,
  UserCheck,
  Package,
  FileText,
  Search,
  Calendar,
  DollarSign,
  Filter,
  CheckCircle2,
  Trash2,
  Sparkles,
  Layers,
  QrCode,
  Printer,
  Smartphone,
  X,
  UserPlus,
  CreditCard,
  Phone,
  MapPin,
  Clock,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { useGymData } from '../context/GymDataContext';
import { useAuth } from '../context/AuthContext';
import { ExpenseCategory, ExpenseItem, CashInflowItem, Member, SessionCategory } from '../types';
import { formatEGP, formatDateAr, formatArabicDayMonth, getSubscriptionStatus } from '../utils/formatters';
import { generateQRDataUrl } from '../utils/qrGenerator';
import { sounds } from '../utils/sound';

export const ExpensesPage: React.FC = () => {
  const {
    expenses,
    cashInflows,
    members,
    renewMemberSubscription,
    addMember,
    addExpense,
    deleteExpense,
    addCashInflow,
    addManualCashMovement,
    getDrawerStats,
  } = useGymData();
  const { currentUser } = useAuth();

  const drawer = getDrawerStats();

  // Modals state
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isCashDepositModalOpen, setIsCashDepositModalOpen] = useState(false);
  const [isManualMovementModalOpen, setIsManualMovementModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [subscriptionTab, setSubscriptionTab] = useState<'existing' | 'new'>('existing');

  // Existing member search & renewal
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [selectedMemberForRenewal, setSelectedMemberForRenewal] = useState<Member | null>(null);
  const [renewalForm, setRenewalForm] = useState({
    planName: 'اشتراك شهري صالة الجيم (30 يوم)',
    durationDays: 30,
    sessionsCount: 0,
    fee: 500,
    paymentMethod: 'cash' as 'cash' | 'instapay',
    notes: '',
  });

  // New member form
  const [newMemberForm, setNewMemberForm] = useState({
    name: '',
    phone: '',
    age: 22,
    residentialArea: '',
    sessionCategory: 'gym' as SessionCategory,
    subscriptionPlan: 'اشتراك شهري صالة الجيم (30 يوم)',
    totalDays: 30,
    totalSessions: 0,
    fee: 500,
    paymentMethod: 'cash' as 'cash' | 'instapay',
    notes: '',
  });

  // Generated QR Modal
  const [qrModalMember, setQrModalMember] = useState<Member | null>(null);
  const [qrModalUrl, setQrModalUrl] = useState<string>('');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'expenses' | 'inflow' | 'coaches' | 'utilities'>('all');

  // Manual Movement Form
  const [manualMovementForm, setManualMovementForm] = useState({
    type: 'deposit' as 'deposit' | 'withdrawal',
    title: '',
    amount: 200,
    notes: '',
  });

  // New Expense form
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    category: 'maintenance' as ExpenseCategory,
    amount: 100,
    notes: '',
    paymentMethod: 'cash' as 'cash' | 'card' | 'instapay',
  });

  // New Inflow form (Quick cash subscription/deposit)
  const [inflowForm, setInflowForm] = useState({
    title: '',
    type: 'subscription' as CashInflowItem['type'],
    amount: 500,
    memberName: '',
    paymentMethod: 'cash' as 'cash' | 'card' | 'instapay',
  });

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.title || expenseForm.amount <= 0) return;

    addExpense({
      title: expenseForm.title,
      category: expenseForm.category,
      amount: Number(expenseForm.amount),
      notes: expenseForm.notes,
      paymentMethod: expenseForm.paymentMethod,
      recordedBy: currentUser?.name || 'الاستقبال',
    });

    sounds.playCashRegister();
    setIsAddExpenseModalOpen(false);
    setExpenseForm({
      title: '',
      category: 'maintenance',
      amount: 100,
      notes: '',
      paymentMethod: 'cash',
    });
  };

  const handleCreateCashDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inflowForm.title || inflowForm.amount <= 0) return;

    addCashInflow({
      title: inflowForm.title,
      type: 'manual_deposit',
      amount: Number(inflowForm.amount),
      memberName: inflowForm.memberName || 'إيداع بالخزينة',
      paymentMethod: inflowForm.paymentMethod,
      recordedBy: currentUser?.name || 'الاستقبال',
    });

    sounds.playSuccessDing();
    setIsCashDepositModalOpen(false);
    setInflowForm({
      title: '',
      type: 'manual_deposit',
      amount: 500,
      memberName: '',
      paymentMethod: 'cash',
    });
  };

  const handleSelectMemberForRenewal = (m: Member) => {
    setSelectedMemberForRenewal(m);
    setRenewalForm({
      planName: m.subscriptionPlan || 'اشتراك شهري صالة الجيم (30 يوم)',
      durationDays: m.totalDays > 0 ? m.totalDays : 30,
      sessionsCount: m.totalSessions || 0,
      fee: m.subscriptionFee || 500,
      paymentMethod: m.paymentMethod === 'instapay' ? 'instapay' : 'cash',
      notes: '',
    });
  };

  const handleConfirmRenewal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberForRenewal) return;

    const res = renewMemberSubscription(
      selectedMemberForRenewal.id,
      renewalForm.planName,
      Number(renewalForm.durationDays) || 30,
      Number(renewalForm.fee) || 0,
      renewalForm.paymentMethod,
      renewalForm.notes || 'تجديد اشتراك من صفحة إدارة الدرج',
      Number(renewalForm.sessionsCount) || undefined
    );

    if (res.success && res.member) {
      setIsSubscriptionModalOpen(false);
      setSelectedMemberForRenewal(null);
      setMemberSearchQuery('');

      // Generate Personalized Member QR code
      const baseUrl = typeof window !== 'undefined' && window.location.origin ? window.location.origin : '';
      const bindUrl = `${baseUrl}/checkin?code=${res.member.code}&bind=true&t=${Date.now()}`;
      const qrData = await generateQRDataUrl(bindUrl);
      setQrModalMember(res.member);
      setQrModalUrl(qrData);
      sounds.playSuccessDing();
    }
  };

  const handleConfirmNewMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberForm.name.trim() || !newMemberForm.phone.trim()) {
      alert('يرجى إدخال اسم اللاعب ورقم الهاتف بالكامل');
      return;
    }

    const durationDays = Number(newMemberForm.totalDays) || 30;
    const fee = Number(newMemberForm.fee) || 0;
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + durationDays * 86400000).toISOString().split('T')[0];
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const created = addMember({
      code,
      name: newMemberForm.name.trim(),
      phone: newMemberForm.phone.trim(),
      age: Number(newMemberForm.age) || undefined,
      residentialArea: newMemberForm.residentialArea.trim() || undefined,
      type: 'member',
      subscriptionPlan: newMemberForm.subscriptionPlan,
      subscriptionFee: fee,
      paymentMethod: newMemberForm.paymentMethod,
      paymentStatus: 'paid',
      sessionCategory: newMemberForm.sessionCategory,
      startDate,
      endDate,
      totalDays: durationDays,
      remainingDays: durationDays,
      totalSessions: Number(newMemberForm.totalSessions) || 0,
      remainingSessions: Number(newMemberForm.totalSessions) || 0,
      active: true,
      notes: newMemberForm.notes || 'تسجيل اشتراك جديد من صفحة إدارة الدرج',
    });

    setIsSubscriptionModalOpen(false);
    setNewMemberForm({
      name: '',
      phone: '',
      age: 22,
      residentialArea: '',
      sessionCategory: 'gym',
      subscriptionPlan: 'اشتراك شهري صالة الجيم (30 يوم)',
      totalDays: 30,
      totalSessions: 0,
      fee: 500,
      paymentMethod: 'cash',
      notes: '',
    });

    // Generate Personalized Member QR code
    const baseUrl = typeof window !== 'undefined' && window.location.origin ? window.location.origin : '';
    const bindUrl = `${baseUrl}/checkin?code=${created.code}&bind=true&t=${Date.now()}`;
    const qrData = await generateQRDataUrl(bindUrl);
    setQrModalMember(created);
    setQrModalUrl(qrData);
    sounds.playSuccessDing();
  };

  const handleManualMovementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualMovementForm.title.trim()) {
      alert('يرجى إدخال سبب أو بيان تسوية العهدة بوضوح لضمان دقة التقارير المالية واليومية.');
      return;
    }
    if (manualMovementForm.amount <= 0) {
      alert('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }

    addManualCashMovement(
      manualMovementForm.type,
      Number(manualMovementForm.amount),
      manualMovementForm.title.trim(),
      manualMovementForm.notes
    );

    sounds.playCashRegister();
    setIsManualMovementModalOpen(false);
    setManualMovementForm({
      type: 'deposit',
      title: '',
      amount: 200,
      notes: '',
    });
  };

  const getCategoryIcon = (cat: ExpenseCategory) => {
    switch (cat) {
      case 'electricity':
        return <Zap className="w-4 h-4 text-amber-400" />;
      case 'water':
        return <Droplets className="w-4 h-4 text-cyan-400" />;
      case 'maintenance':
        return <Wrench className="w-4 h-4 text-orange-400" />;
      case 'rent':
        return <Building className="w-4 h-4 text-purple-400" />;
      case 'trainer_payout':
        return <UserCheck className="w-4 h-4 text-rose-400" />;
      case 'supplies':
        return <Package className="w-4 h-4 text-teal-400" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  const getCategoryName = (cat: ExpenseCategory) => {
    switch (cat) {
      case 'electricity':
        return 'فاتورة كهرباء';
      case 'water':
        return 'فاتورة مياه';
      case 'maintenance':
        return 'أعمال صيانة';
      case 'rent':
        return 'إيجار المكان';
      case 'trainer_payout':
        return 'حسابات مدربين';
      case 'supplies':
        return 'مشتريات ونظافة';
      default:
        return 'نثريات ومصاريف أخرى';
    }
  };

  // Combine expenses and cash inflows for complete ledger
  type LedgerItem =
    | { kind: 'out'; data: ExpenseItem }
    | { kind: 'in'; data: CashInflowItem };

  const ledgerItems: LedgerItem[] = [
    ...expenses.map((e) => ({ kind: 'out' as const, data: e })),
    ...cashInflows.map((i) => ({ kind: 'in' as const, data: i })),
  ].sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime());

  // Filter items
  const filteredLedger = ledgerItems.filter((item) => {
    const isOut = item.kind === 'out';
    const textMatch =
      item.data.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ('notes' in item.data && item.data.notes?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      ('memberName' in item.data && item.data.memberName?.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!textMatch) return false;

    if (activeTab === 'expenses') return isOut;
    if (activeTab === 'inflow') return !isOut;
    if (activeTab === 'coaches') {
      return isOut && (item.data as ExpenseItem).category === 'trainer_payout';
    }
    if (activeTab === 'utilities') {
      return (
        isOut &&
        ['electricity', 'water', 'maintenance'].includes((item.data as ExpenseItem).category)
      );
    }
    return true;
  });

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* TOP PROMINENT CASH DRAWER BANNER */}
      <div className="bg-gradient-to-r from-[#0d221d] via-[#102b25] to-[#0a1b17] border-2 border-emerald-500/40 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                <WalletCards className="w-6 h-6" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                الخزينة المباشرة (Live Cash Drawer)
              </span>
            </div>
            <h2 className="text-2xl font-black text-white">
              صافي النقدية المتواجدة في الدرج حالياً
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
              محسوبة تلقائياً وبدقة متناهية: (إجمالي الاشتراكات ومبيعات المتجر والعلاج الطبيعي) مخصوماً منها (فواتير الكهرباء والمياه والصيانة ومسحوبات وتصفيات المدربين)
            </p>
          </div>

          {/* NET CASH IN DRAWER NUMBER (المطلوب: تطلع الرقم اللي في الدرج صافي بالجنيه) */}
          <div className="bg-slate-950/80 backdrop-blur-md border border-emerald-500/40 rounded-2xl p-6 px-8 text-center shadow-xl shrink-0 min-w-[280px]">
            <div className="text-xs font-bold text-slate-400 mb-1">
              الرصيد الفعلي الموجود بالدرج كاش
            </div>
            <div className="text-4xl font-black text-emerald-400 font-mono tracking-tight glow-teal">
              {formatEGP(drawer.netCashInDrawer)}
            </div>
            <div className="text-[11px] text-emerald-300/80 font-bold mt-2 flex items-center justify-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>جاهز للجرد الفوري في أي لحظة</span>
            </div>
          </div>
        </div>

        {/* 4 Pillars of Gym Liquidity (حساب كل جنيه حرفياً في الجيم سواء داخل أو خارج) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-emerald-500/20 text-xs">
          {/* 1. Cash in Drawer */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-emerald-500/30">
            <div className="text-slate-400 flex items-center justify-between mb-1.5">
              <span className="font-bold text-emerald-300">نقدية الدرج (كاش)</span>
              <ArrowDownCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-400 font-mono">
              {formatEGP(drawer.netCashInDrawer)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">سيولة فورية في درج الاستقبال</div>
          </div>

          {/* 2. InstaPay Account */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-purple-500/30">
            <div className="text-slate-400 flex items-center justify-between mb-1.5">
              <span className="font-bold text-purple-300">محفظة إنستاباي</span>
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-xl font-black text-purple-400 font-mono">
              {formatEGP(drawer.totalInstapayIn)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">تحويلات بنكية ومحافظ إلكترونية</div>
          </div>

          {/* 3. Coach Receivables */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-amber-500/30">
            <div className="text-slate-400 flex items-center justify-between mb-1.5">
              <span className="font-bold text-amber-300">مديونيات عند الكباتن</span>
              <UserCheck className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-black text-amber-400 font-mono">
              {formatEGP(drawer.totalPendingOnCoaches)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">اشتراكات مع الكباتن لم تورد للجيم</div>
          </div>

          {/* 4. Total Liquid Wealth */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-teal-500/30">
            <div className="text-slate-400 flex items-center justify-between mb-1.5">
              <span className="font-bold text-teal-300">إجمالي سيولة الجيم</span>
              <WalletCards className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-xl font-black text-white font-mono">
              {formatEGP(
                drawer.netCashInDrawer + drawer.totalInstapayIn + drawer.totalPendingOnCoaches
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">شاملة الكاش والإنستاباي والمديونيات</div>
          </div>
        </div>

        {/* Daily Breakdown Sub-Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-emerald-500/10 text-[11px]">
          <div className="text-slate-300">
            <span className="text-slate-500">إجمالي مقبوضات الكاش: </span>
            <span className="font-bold text-emerald-400">{formatEGP(drawer.totalCashIn)}</span>
          </div>
          <div className="text-slate-300">
            <span className="text-slate-500">إجمالي مصروفات الكاش: </span>
            <span className="font-bold text-rose-400">{formatEGP(drawer.totalCashOut)}</span>
          </div>
          <div className="text-slate-300">
            <span className="text-slate-500">وارد كاش اليوم: </span>
            <span className="font-bold text-teal-300">{formatEGP(drawer.todayCashIn)}</span>
          </div>
          <div className="text-slate-300">
            <span className="text-slate-500">منصرف كاش اليوم: </span>
            <span className="font-bold text-amber-300">{formatEGP(drawer.todayCashOut)}</span>
          </div>
        </div>
      </div>

      {/* Action Controls & Add Modals Buttons */}
      <div className="bg-[#0f172a]/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-white">دفتر وسجل المصاريف وحركات الدرج</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              تسجيل ومراجعة كافة المصاريف التشغيلية، فواتير المرافق، وتصفية حسابات المدربين
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Manual Drawer Movement Button */}
            <button
              onClick={() => setIsManualMovementModalOpen(true)}
              className="flex-1 sm:flex-none py-3 px-4 rounded-2xl bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 font-bold text-xs flex items-center justify-center gap-2 border border-cyan-500/40 transition cursor-pointer"
            >
              <WalletCards className="w-4 h-4 text-cyan-400" />
              <span>تسوية عهدة / سحب أو إيداع</span>
            </button>

            {/* Member Subscription Button (تسجيل / تجديد اشتراك لاعب) */}
            <button
              onClick={() => {
                setSubscriptionTab('existing');
                setSelectedMemberForRenewal(null);
                setMemberSearchQuery('');
                setIsSubscriptionModalOpen(true);
              }}
              className="flex-1 sm:flex-none py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>تسجيل / تجديد اشتراك لاعب</span>
            </button>

            {/* Pure Cash Deposit Button (إيداع نقدية بالخزينة) */}
            <button
              onClick={() => setIsCashDepositModalOpen(true)}
              className="flex-1 sm:flex-none py-3 px-4 rounded-2xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 border border-emerald-500/40 transition cursor-pointer"
            >
              <ArrowDownCircle className="w-4 h-4 text-emerald-400" />
              <span>إيداع نقدية بالخزينة</span>
            </button>

            {/* Add Expense Button (كهربا، ميا، صيانة...) */}
            <button
              onClick={() => setIsAddExpenseModalOpen(true)}
              className="flex-1 sm:flex-none py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>تسجيل مصروف جديد</span>
            </button>
          </div>
        </div>

        {/* Search & Tabs */}
        <div className="pt-3 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 text-xs">
            {[
              { id: 'all', label: 'كافة الحركات' },
              { id: 'expenses', label: 'المصاريف فقط' },
              { id: 'inflow', label: 'الوارد والاشتراكات' },
              { id: 'coaches', label: 'حسابات المدربين المخصومة' },
              { id: 'utilities', label: 'فواتير وصيانة (كهرباء/مياه)' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-teal-500 text-slate-950 shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث في البنود..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 pl-8 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* Complete Ledger Table */}
      <div className="bg-[#0f172a]/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black text-white">حركات الخزينة والمصروفات</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {filteredLedger.length} بند
            </span>
          </div>
        </div>

        {filteredLedger.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-3 px-4 font-bold">البيان / البند</th>
                  <th className="py-3 px-4 font-bold">التصنيف</th>
                  <th className="py-3 px-4 font-bold">النوع</th>
                  <th className="py-3 px-4 font-bold">المبلغ</th>
                  <th className="py-3 px-4 font-bold">طريقة الدفع</th>
                  <th className="py-3 px-4 font-bold">التاريخ</th>
                  <th className="py-3 px-4 font-bold">المسؤول</th>
                  <th className="py-3 px-4 font-bold text-left">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLedger.map((item) => {
                  const isOut = item.kind === 'out';
                  const expense = isOut ? (item.data as ExpenseItem) : null;
                  const inflow = !isOut ? (item.data as CashInflowItem) : null;

                  return (
                    <tr key={item.data.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3.5 px-4 font-bold text-white">
                        <div className="flex items-center gap-2">
                          {isOut ? (
                            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
                              {getCategoryIcon(expense!.category)}
                            </div>
                          ) : (
                            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                              <ArrowDownCircle className="w-4 h-4" />
                            </div>
                          )}
                          <div>
                            <div>{item.data.title}</div>
                            {isOut && expense?.notes && (
                              <div className="text-[10px] text-slate-400 mt-0.5 font-normal">
                                {expense.notes}
                              </div>
                            )}
                            {!isOut && inflow?.memberName && (
                              <div className="text-[10px] text-teal-400 mt-0.5 font-normal">
                                العضو: {inflow.memberName}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {isOut ? (
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium text-[10px]">
                            {getCategoryName(expense!.category)}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-300 font-medium text-[10px]">
                            {inflow?.type === 'subscription' ? 'اشتراك جيم' : inflow?.type === 'pos' ? 'مبيعات متجر' : 'تأجير علاج طبيعي'}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-bold">
                        {isOut ? (
                          <span className="text-rose-400 font-bold flex items-center gap-1">
                            <ArrowUpCircle className="w-3.5 h-3.5" />
                            <span>منصرف (-)</span>
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <ArrowDownCircle className="w-3.5 h-3.5" />
                            <span>وارد (+)</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-black font-mono text-sm">
                        <span className={isOut ? 'text-rose-400' : 'text-emerald-400'}>
                          {isOut ? '-' : '+'}
                          {formatEGP(item.data.amount)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-300">
                        {item.data.paymentMethod === 'cash' ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                            نقدي (بالدرج)
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                            {item.data.paymentMethod}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 text-[11px] font-mono">
                        {formatDateAr(item.data.date)}
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {'recordedBy' in item.data ? item.data.recordedBy : '---'}
                      </td>

                      <td className="py-3.5 px-4 text-left">
                        {isOut && !expense?.autoGenerated && (
                          <button
                            onClick={() => {
                              if (confirm('هل أنت متأكد من حذف هذا المصروف؟')) {
                                deleteExpense(item.data.id);
                              }
                            }}
                            className="p-1 text-slate-500 hover:text-rose-400 transition"
                            title="حذف المصروف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isOut && expense?.autoGenerated && (
                          <span className="text-[10px] text-slate-500 italic">آلي من المدربين</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-500">
            لا توجد بنود تطابق البحث في الدفتر.
          </div>
        )}
      </div>

      {/* Add Expense Modal (كهربا، ميا، صيانة، إيجار، أدوات...) */}
      {isAddExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-rose-500/30 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-rose-400" />
              <span>تسجيل مصروف جديد في الدرج</span>
            </h3>

            <form onSubmit={handleCreateExpense} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">بيان المصروف</label>
                <input
                  type="text"
                  required
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  placeholder="مثال: فاتورة كهرباء شهر أكتوبر، صيانة مشاية 3"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">بند المصروف</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) =>
                      setExpenseForm({
                        ...expenseForm,
                        category: e.target.value as ExpenseCategory,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="electricity">كهرباء (فاتورة)</option>
                    <option value="water">مياه (فاتورة)</option>
                    <option value="maintenance">صيانة وأعطال</option>
                    <option value="rent">إيجار المكان</option>
                    <option value="supplies">أدوات ونظافة ومعقمات</option>
                    <option value="other">مصاريف أخرى ونثريات</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">المبلغ المطلوب (EGP)</label>
                  <input
                    type="number"
                    required
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">طريقة الدفع</label>
                <select
                  value={expenseForm.paymentMethod}
                  onChange={(e) =>
                    setExpenseForm({
                      ...expenseForm,
                      paymentMethod: e.target.value as 'cash' | 'card' | 'instapay',
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="cash">نقداً من الدرج (يخصم من الرصيد النقدي فوراً)</option>
                  <option value="instapay">تحويل انستاباي</option>
                  <option value="card">فيزا / بطاقة بنكية</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">ملاحظات إضافية (اختياري)</label>
                <textarea
                  rows={2}
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  placeholder="رقم الفاتورة، اسم الفني، تفاصيل العطل..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-600/20"
                >
                  حفظ وخصم من الدرج
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddExpenseModalOpen(false)}
                  className="py-3 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cash Deposit Modal (إيداع نقدية بالخزينة) */}
      {isCashDepositModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-emerald-500/30 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <ArrowDownCircle className="w-5 h-5 text-emerald-400" />
              <span>إيداع نقدية جديدة بالخزينة / الدرج</span>
            </h3>

            <form onSubmit={handleCreateCashDeposit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">بيان وسبب الإيداع</label>
                <input
                  type="text"
                  required
                  value={inflowForm.title}
                  onChange={(e) => setInflowForm({ ...inflowForm, title: e.target.value })}
                  placeholder="مثال: رصيد افتتاحي، توريد نقدية من الإدارة، سداد فائض"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">المبلغ (EGP)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={inflowForm.amount}
                    onChange={(e) => setInflowForm({ ...inflowForm, amount: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">طريقة الإيداع</label>
                  <select
                    value={inflowForm.paymentMethod}
                    onChange={(e) => setInflowForm({ ...inflowForm, paymentMethod: e.target.value as 'cash' | 'instapay' })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                  >
                    <option value="cash">كاش في الدرج</option>
                    <option value="instapay">تحويل إنستاباي</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">المسؤول / المودع (اختياري)</label>
                <input
                  type="text"
                  value={inflowForm.memberName}
                  onChange={(e) => setInflowForm({ ...inflowForm, memberName: e.target.value })}
                  placeholder="اسم الشخص أو الجهة المودعة"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  إيداع وإضافة لرصيد الدرج
                </button>
                <button
                  type="button"
                  onClick={() => setIsCashDepositModalOpen(false)}
                  className="py-3 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-700"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Subscription & Renewal Modal */}
      {isSubscriptionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="bg-[#0f172a] border border-emerald-500/40 rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col p-4 sm:p-6 shadow-2xl overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">تسجيل وتجديد اشتراك المتدربين</h3>
                  <p className="text-[11px] text-slate-400">إيداع اشتراكات الأعضاء بالدرج وتوليد QR كود الربط</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSubscriptionModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Switcher */}
            <div className="flex items-center gap-2 p-1 bg-slate-900 rounded-2xl border border-slate-800 my-3 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setSubscriptionTab('existing');
                  setSelectedMemberForRenewal(null);
                }}
                className={`flex-1 py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  subscriptionTab === 'existing'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>تجديد لاعب قديم (بحث برقم الهاتف)</span>
              </button>
              <button
                type="button"
                onClick={() => setSubscriptionTab('new')}
                className={`flex-1 py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  subscriptionTab === 'new'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>تسجيل لاعب جديد لأول مرة</span>
              </button>
            </div>

            {/* TAB 1: EXISTING MEMBER RENEWAL */}
            {subscriptionTab === 'existing' && (
              <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    ابحث برقم الهاتف أو كود العضو أو الاسم:
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute top-3 right-3" />
                    <input
                      type="text"
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      placeholder="اكتب رقم الهاتف (مثال: 010...) أو كود اللاعب أو الاسم..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {memberSearchQuery.trim() && (
                    <div className="mt-2 max-h-40 overflow-y-auto rounded-xl bg-slate-900 border border-slate-800 divide-y divide-slate-800">
                      {members
                        .filter((m) => {
                          const q = memberSearchQuery.trim().toLowerCase();
                          return (
                            m.phone?.includes(q) ||
                            m.code?.toLowerCase().includes(q) ||
                            m.name.toLowerCase().includes(q)
                          );
                        })
                        .slice(0, 6)
                        .map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleSelectMemberForRenewal(m)}
                            className={`w-full p-2.5 text-right flex items-center justify-between hover:bg-slate-800/80 transition cursor-pointer text-xs ${
                              selectedMemberForRenewal?.id === m.id ? 'bg-emerald-500/20 text-emerald-300 font-bold' : ''
                            }`}
                          >
                            <div>
                              <div className="font-bold text-white">{m.name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                {m.phone || 'بدون هاتف'} • كود: {m.code}
                              </div>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-teal-300 font-mono">
                              {m.subscriptionPlan || 'عضوية'}
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {selectedMemberForRenewal ? (
                  <form onSubmit={handleConfirmRenewal} className="space-y-3 pt-2 border-t border-slate-800">
                    <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 text-xs space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">اللاعب المحدد:</span>
                        <span className="font-black text-white text-sm">{selectedMemberForRenewal.name}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">رقم الهاتف والكود:</span>
                        <span className="font-mono text-emerald-300 font-bold">
                          {selectedMemberForRenewal.phone || '—'} (كود: {selectedMemberForRenewal.code})
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">حالة الاشتراك الحالية:</span>
                        <span className="font-mono text-amber-300">
                          {selectedMemberForRenewal.remainingDays} يوم متبقي • متبقي {selectedMemberForRenewal.remainingSessions} حصة
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">اسم باقة التجديد</label>
                        <input
                          type="text"
                          required
                          value={renewalForm.planName}
                          onChange={(e) => setRenewalForm({ ...renewalForm, planName: e.target.value })}
                          placeholder="مثال: اشتراك شهري جيم 30 يوم"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">المدة بالأيام (الصلاحية)</label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={renewalForm.durationDays}
                          onChange={(e) => setRenewalForm({ ...renewalForm, durationDays: Number(e.target.value) })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">سعر التجديد / المبلغ (EGP)</label>
                        <input
                          type="number"
                          required
                          min="0"
                          value={renewalForm.fee}
                          onChange={(e) => setRenewalForm({ ...renewalForm, fee: Number(e.target.value) })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-black focus:outline-none focus:border-emerald-500 text-emerald-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">عدد الحصص (إن وُجد أو 0 للحر)</label>
                        <input
                          type="number"
                          min="0"
                          value={renewalForm.sessionsCount}
                          onChange={(e) => setRenewalForm({ ...renewalForm, sessionsCount: Number(e.target.value) })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">طريقة السداد</label>
                        <select
                          value={renewalForm.paymentMethod}
                          onChange={(e) => setRenewalForm({ ...renewalForm, paymentMethod: e.target.value as 'cash' | 'instapay' })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                        >
                          <option value="cash">كاش في درج الخزينة</option>
                          <option value="instapay">تحويل إنستاباي (InstaPay)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">ملاحظات (اختياري)</label>
                        <input
                          type="text"
                          value={renewalForm.notes}
                          onChange={(e) => setRenewalForm({ ...renewalForm, notes: e.target.value })}
                          placeholder="ملاحظات السداد..."
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>تأكيد تجديد الاشتراك وتوليد QR كود للعميل</span>
                    </button>
                  </form>
                ) : (
                  <div className="p-6 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 text-center text-xs text-slate-500">
                    ابحث برقم هاتف اللاعب أو اسمه بالأعلى واختره لتجديد اشتراكه وتوليد الـ QR الخاص به
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: NEW MEMBER REGISTRATION */}
            {subscriptionTab === 'new' && (
              <form onSubmit={handleConfirmNewMember} className="overflow-y-auto flex-1 pr-1 custom-scrollbar space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">اسم اللاعب الكامل *</label>
                    <input
                      type="text"
                      required
                      value={newMemberForm.name}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, name: e.target.value })}
                      placeholder="الاسم الثلاثي أو الثنائي"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">رقم الهاتف *</label>
                    <input
                      type="tel"
                      required
                      value={newMemberForm.phone}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, phone: e.target.value })}
                      placeholder="010... أو 011..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">السن / العمر</label>
                    <input
                      type="number"
                      min="10"
                      max="90"
                      value={newMemberForm.age || ''}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, age: Number(e.target.value) })}
                      placeholder="مثال: 24"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">المنطقة السكنية</label>
                    <input
                      type="text"
                      value={newMemberForm.residentialArea}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, residentialArea: e.target.value })}
                      placeholder="مثال: المعادي، الهرم، التجمع..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">نوع النشاط / الصالة</label>
                    <select
                      value={newMemberForm.sessionCategory}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, sessionCategory: e.target.value as SessionCategory })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                    >
                      <option value="gym">🏋️ صالة الجيم العامة</option>
                      <option value="private">🎯 تدريب خاص (Private PT)</option>
                      <option value="physio">🩺 علاج طبيعي وتأهيل</option>
                      <option value="massage">💆‍♂️ مساج واستشفاء</option>
                      <option value="group">👥 كلاسات جماعية</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">اسم باقة الاشتراك</label>
                    <input
                      type="text"
                      required
                      value={newMemberForm.subscriptionPlan}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, subscriptionPlan: e.target.value })}
                      placeholder="مثال: اشتراك شهري جيم 30 يوم"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">المدة بالأيام</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={newMemberForm.totalDays}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, totalDays: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">عدد الحصص</label>
                    <input
                      type="number"
                      min="0"
                      value={newMemberForm.totalSessions}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, totalSessions: Number(e.target.value) })}
                      placeholder="0 للحر"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">المبلغ (EGP) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={newMemberForm.fee}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, fee: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-black focus:outline-none focus:border-emerald-500 text-emerald-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">طريقة السداد</label>
                    <select
                      value={newMemberForm.paymentMethod}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, paymentMethod: e.target.value as 'cash' | 'instapay' })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                    >
                      <option value="cash">كاش في درج الخزينة</option>
                      <option value="instapay">تحويل إنستاباي (InstaPay)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">ملاحظات (اختياري)</label>
                    <input
                      type="text"
                      value={newMemberForm.notes}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, notes: e.target.value })}
                      placeholder="أي ملاحظات خاصة بالمتدرب..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>تسجيل العضو الجديد وتوليد QR كود الربط الخاص به</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MEMBER PERSONALIZED QR CODE MODAL FOR PHONE SCANNING */}
      {qrModalMember && qrModalUrl && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border-2 border-emerald-500/50 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl relative animate-scale-up">
            <button
              onClick={() => {
                setQrModalMember(null);
                setQrModalUrl('');
              }}
              className="absolute top-4 left-4 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-3">
              <QrCode className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black text-white">كيو آر كود ربط العضوية بالهاتف</h3>
            <p className="text-xs text-slate-300 mt-1">
              اللاعب: <strong className="text-emerald-400">{qrModalMember.name}</strong> • كود: <span className="font-mono text-white font-bold">{qrModalMember.code}</span>
            </p>

            {/* The QR Image */}
            <div className="my-4 p-4 bg-white rounded-2xl border-4 border-emerald-500/40 inline-block shadow-inner">
              <img src={qrModalUrl} alt="Member QR Code" className="w-48 h-48 mx-auto object-contain" />
            </div>

            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs text-center space-y-1 mb-4">
              <p className="font-bold">📱 اطلب من اللاعب مسح هذا الكود الآن بكاميرا هاتفه:</p>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                بمجرد مسح هذا الكود، سيرتبط هاتفه بعضويته نهائياً، وفي كل مرة يحضر فيها للجيم سيمسح كود الاستقبال ليسجل حضوره تلقائياً دون كتابة أي بيانات!
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الكود</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setQrModalMember(null);
                  setQrModalUrl('');
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition cursor-pointer"
              >
                تم الانتهاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Drawer Movement Modal (إيداع / سحب عهدة يدوية بالدرج) */}
      {isManualMovementModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-cyan-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-black text-white mb-2 flex items-center gap-2">
              <WalletCards className="w-5 h-5 text-cyan-400" />
              <span>تسوية عهدة (سحب أو إيداع نقدي بالدرج)</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              تسوية العهدة تتطلب إدخال السبب أو البيان بوضوح، وتسمع أوتوماتيكياً في تقفيل اليومية والتقرير الشامل.
            </p>

            <form onSubmit={handleManualMovementSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setManualMovementForm({ ...manualMovementForm, type: 'deposit' })}
                  className={`py-2.5 px-3 rounded-xl font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    manualMovementForm.type === 'deposit'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <ArrowDownCircle className="w-4 h-4" />
                  <span>إيداع عهدة بالدرج (+)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setManualMovementForm({ ...manualMovementForm, type: 'withdrawal' })}
                  className={`py-2.5 px-3 rounded-xl font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    manualMovementForm.type === 'withdrawal'
                      ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <ArrowUpCircle className="w-4 h-4" />
                  <span>سحب عهدة من الدرج (-)</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  بيان تسوية العهدة / السبب <span className="text-rose-400">* (إلزامي للتقارير)</span>
                </label>
                <input
                  type="text"
                  required
                  value={manualMovementForm.title}
                  onChange={(e) => setManualMovementForm({ ...manualMovementForm, title: e.target.value })}
                  placeholder={manualMovementForm.type === 'deposit' ? 'مثال: إيداع فكة الصباح أو دعم الخزينة' : 'مثال: مسحوبات المالك أو عهدة نثرية ومشتريات'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">المبلغ بالجنيه (EGP)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={manualMovementForm.amount}
                  onChange={(e) => setManualMovementForm({ ...manualMovementForm, amount: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">ملاحظات إضافية (اختياري)</label>
                <textarea
                  rows={2}
                  value={manualMovementForm.notes}
                  onChange={(e) => setManualMovementForm({ ...manualMovementForm, notes: e.target.value })}
                  placeholder="أي تفاصيل أو مستندات تخص الحركة..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-cyan-500/20"
                >
                  تأكيد وتسجيل الحركة
                </button>
                <button
                  type="button"
                  onClick={() => setIsManualMovementModalOpen(false)}
                  className="py-3 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-700"
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
