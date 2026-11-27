import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search,
  Users,
  UserCheck,
  UserX,
  Phone,
  Calendar,
  Clock,
  Sparkles,
  QrCode,
  RefreshCw,
  Plus,
  ShieldCheck,
  AlertCircle,
  MapPin,
  User,
  WalletCards,
  CheckCircle,
  Copy,
  ExternalLink,
  Edit,
  X,
  Download,
  Filter,
} from 'lucide-react';
import { useGymData, generateUniqueMemberCode } from '../context/GymDataContext';
import { Member, SessionCategory } from '../types';
import { formatEGP, formatDateAr, getSubscriptionStatus } from '../utils/formatters';
import { generateQRDataUrl } from '../utils/qrGenerator';
import { sounds } from '../utils/sound';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';
import { PaginationBar } from '../components/PaginationBar';
import { CardsGridSkeleton } from '../components/PageSkeleton';

export const MembersSearchPage: React.FC = () => {
  const {
    members,
    addMember,
    updateMember,
    renewMemberSubscription,
    performCheckIn,
    checkInLogs,
    memberSubscriptionHistoryMap,
  } = useGymData();

  // Search, Filter & Server-Side Pagination State (Limit 20)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagedMembers, setPagedMembers] = useState<Member[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isPageLoading, setIsPageLoading] = useState(false);

  // Renewal Modal
  const [renewalMember, setRenewalMember] = useState<Member | null>(null);
  const [renewalForm, setRenewalForm] = useState({
    planName: 'اشتراك شهري صالة الجيم (30 يوم)',
    durationDays: 30,
    sessionsCount: 0,
    fee: 500,
    paymentMethod: 'cash' as 'cash' | 'instapay',
    notes: '',
  });

  // Edit Member Modal
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    age: 20,
    residentialArea: '',
    notes: '',
  });

  // New Member Modal
  const [isNewMemberModalOpen, setIsNewMemberModalOpen] = useState(false);
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

  // Personalized Member QR Modal
  const [qrModalMember, setQrModalMember] = useState<Member | null>(null);
  const [qrModalUrl, setQrModalUrl] = useState<string>('');
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Local Filtered Members Fallback (when offline / non-Supabase)
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.phone && m.phone.includes(q)) ||
        m.code.toLowerCase().includes(q) ||
        (m.residentialArea && m.residentialArea.toLowerCase().includes(q)) ||
        (m.subscriptionPlan && m.subscriptionPlan.toLowerCase().includes(q));

      if (!matchesQuery) return false;

      const history =
        memberSubscriptionHistoryMap[(m.code || '').toUpperCase()] ||
        memberSubscriptionHistoryMap[m.id] ||
        [];
      const subStatus = getSubscriptionStatus(m, history);
      if (statusFilter === 'active' && !subStatus.isActive) return false;
      if (statusFilter === 'expired' && subStatus.status !== 'expired') return false;

      if (categoryFilter !== 'all' && m.sessionCategory !== categoryFilter) return false;

      return true;
    });
  }, [members, searchQuery, statusFilter, categoryFilter, memberSubscriptionHistoryMap]);

  const loadMembersPage = useCallback(
    async (page: number) => {
      if (!isSupabaseConfigured) {
        const total = filteredMembers.length;
        const pages = Math.max(1, Math.ceil(total / 20));
        const safePage = Math.min(page, pages);
        setPagedMembers(filteredMembers.slice((safePage - 1) * 20, safePage * 20));
        setTotalCount(total);
        setTotalPages(pages);
        return;
      }

      setIsPageLoading(true);
      try {
        const res = await supabaseService.fetchMembersPaginated({
          page,
          pageSize: 20,
          search: searchQuery,
          statusFilter,
          categoryFilter,
        });
        if (res) {
          setPagedMembers(res.data);
          setTotalCount(res.count);
          setTotalPages(res.totalPages);
          setCurrentPage(res.page);
        } else {
          const total = filteredMembers.length;
          const pages = Math.max(1, Math.ceil(total / 20));
          setPagedMembers(filteredMembers.slice((page - 1) * 20, page * 20));
          setTotalCount(total);
          setTotalPages(pages);
        }
      } finally {
        setIsPageLoading(false);
      }
    },
    [searchQuery, statusFilter, categoryFilter, filteredMembers]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadMembersPage(currentPage);
    }, 200);
    return () => clearTimeout(timer);
  }, [currentPage, loadMembersPage]);

  // Statistics
  const stats = useMemo(() => {
    let activeCount = 0;
    let expiredCount = 0;

    members.forEach((m) => {
      const history =
        memberSubscriptionHistoryMap[(m.code || '').toUpperCase()] ||
        memberSubscriptionHistoryMap[m.id] ||
        [];
      const st = getSubscriptionStatus(m, history);
      if (st.isActive) activeCount++;
      else if (st.status === 'expired') expiredCount++;
    });

    const todayCheckInsCount = checkInLogs.length;

    return {
      total: members.length,
      active: activeCount,
      expired: expiredCount,
      todayVisits: todayCheckInsCount,
    };
  }, [members, checkInLogs, memberSubscriptionHistoryMap]);

  // Copy Phone Helper
  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    sounds.playCashRegister();
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  // Open Personalized QR Modal
  const handleShowMemberQR = async (member: Member) => {
    const baseUrl = typeof window !== 'undefined' && window.location.origin ? window.location.origin : '';
    const bindUrl = `${baseUrl}/checkin?code=${member.code}&bind=true&t=${Date.now()}`;
    const qrData = await generateQRDataUrl(bindUrl);
    setQrModalMember(member);
    setQrModalUrl(qrData);
    sounds.playSuccessDing();
  };

  // Quick Direct Check-in to Reception
  const handleDirectCheckIn = (member: Member) => {
    const res = performCheckIn(member.id, 'manual');
    if (res.success) {
      sounds.playSuccessDing();
      setActionNotice(`تم تسكين اللاعب ${member.name} بصالة الجيم وظهر في شاشة الاستقبال بنجاح`);
      setTimeout(() => setActionNotice(null), 4000);
    } else {
      setActionNotice(res.message || 'تعذر تسكين اللاعب');
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  // Submission loading states (Double-Click Protection)
  const [isSubmittingRenewal, setIsSubmittingRenewal] = useState(false);
  const [isSubmittingNewMember, setIsSubmittingNewMember] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Submit Renewal
  const handleRenewalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewalMember || isSubmittingRenewal) return;

    const fee = Number(renewalForm.fee);
    const durationDays = Number(renewalForm.durationDays);
    if (isNaN(fee) || fee < 0) {
      alert('تنبيه: قيمة الاشتراك لا يمكن أن تكون سالبة');
      return;
    }
    if (isNaN(durationDays) || durationDays <= 0) {
      alert('تنبيه: مدة الاشتراك يجب أن تكون يوماً واحداً على الأقل');
      return;
    }

    setIsSubmittingRenewal(true);
    try {
      const res = await renewMemberSubscription(
        renewalMember.id,
        renewalForm.planName,
        durationDays || 30,
        fee || 0,
        renewalForm.paymentMethod,
        renewalForm.notes || 'تجديد اشتراك من دليل الأعضاء',
        Number(renewalForm.sessionsCount) || undefined
      );

      if (res.success && res.member) {
        const updated = res.member;
        setRenewalMember(null);
        // Generate QR for renewed member
        const baseUrl = typeof window !== 'undefined' && window.location.origin ? window.location.origin : '';
        const bindUrl = `${baseUrl}/checkin?code=${updated.code}&bind=true&t=${Date.now()}`;
        const qrData = await generateQRDataUrl(bindUrl);
        setQrModalMember(updated);
        setQrModalUrl(qrData);
        sounds.playSuccessDing();
      }
    } finally {
      setIsSubmittingRenewal(false);
    }
  };

  // Submit Edit Member
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || isSubmittingEdit) return;

    setIsSubmittingEdit(true);
    try {
      updateMember(editingMember.id, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        age: Number(editForm.age) || undefined,
        residentialArea: editForm.residentialArea.trim() || undefined,
        notes: editForm.notes.trim() || undefined,
      });

      setEditingMember(null);
      sounds.playSuccessDing();
      setActionNotice('تم تحديث بيانات العضو بنجاح');
      setTimeout(() => setActionNotice(null), 3000);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Submit New Member
  const handleNewMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberForm.name.trim() || !newMemberForm.phone.trim() || isSubmittingNewMember) {
      alert('يرجى إدخال اسم العضو ورقم الهاتف');
      return;
    }

    const durationDays = Number(newMemberForm.totalDays);
    const fee = Number(newMemberForm.fee);
    if (isNaN(fee) || fee < 0) {
      alert('تنبيه: قيمة الاشتراك لا يمكن أن تكون سالبة');
      return;
    }
    if (isNaN(durationDays) || durationDays <= 0) {
      alert('تنبيه: مدة الاشتراك يجب أن تكون يوماً واحداً على الأقل');
      return;
    }

    setIsSubmittingNewMember(true);
    try {
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + durationDays * 86400000).toISOString().split('T')[0];
      const code = generateUniqueMemberCode(members);

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
        totalSessions: newMemberForm.sessionCategory === 'gym' ? 0 : (Number(newMemberForm.totalSessions) || 0),
        remainingSessions: newMemberForm.sessionCategory === 'gym' ? 0 : (Number(newMemberForm.totalSessions) || 0),
        active: true,
        notes: newMemberForm.notes || 'تسجيل عضو جديد من دليل وبحث الأعضاء',
      });

      setIsNewMemberModalOpen(false);
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
    } finally {
      setIsSubmittingNewMember(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-[#0e1726] border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
              سجل الأعضاء والاشتراكات
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            دليل وبحث الأعضاء الشامل
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
            ابحث فورياً عن أي لاعب برقم التليفون، الاسم، أو الكود. استعرض خطط الاشتراكات، الأيام والحصص المتبقية، وسدد الاشتراكات واطبع الـ QR الخاص بكل لاعب.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <button
            onClick={() => setIsNewMemberModalOpen(true)}
            className="py-3 px-5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-teal-500/20 transition flex items-center gap-2 cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل عضو جديد</span>
          </button>
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionNotice && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm flex items-center gap-2 animate-scale-up">
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Members */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="text-slate-400 text-xs flex items-center justify-between mb-2">
            <span>إجمالي الأعضاء</span>
            <Users className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono">
            {stats.total}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">متدرب مسجل بالنظام</div>
        </div>

        {/* Active Subscriptions */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/30">
          <div className="text-slate-400 text-xs flex items-center justify-between mb-2">
            <span className="text-emerald-300 font-bold">اشتراكات سارية</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
            {stats.active}
          </div>
          <div className="text-[11px] text-emerald-400/80 mt-1">أيام وحصص صالحة للتمرين</div>
        </div>

        {/* Expired / Needs Renewal */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-rose-500/30">
          <div className="text-slate-400 text-xs flex items-center justify-between mb-2">
            <span className="text-rose-300 font-bold">اشتراكات منتهية</span>
            <UserX className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-400 font-mono">
            {stats.expired}
          </div>
          <div className="text-[11px] text-rose-400/80 mt-1">بحاجة للتجديد أو دفع الحصص</div>
        </div>

        {/* Today's Checkins */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-cyan-500/30">
          <div className="text-slate-400 text-xs flex items-center justify-between mb-2">
            <span className="text-cyan-300 font-bold">زيارات شفت اليوم</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono">
            {stats.todayVisits}
          </div>
          <div className="text-[11px] text-cyan-400/80 mt-1">حضور وتسكين مسجل اليوم</div>
        </div>
      </div>

      {/* Search Bar & Filters */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 space-y-4 shadow-xl">
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute right-4 top-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="ابحث بالاسم، رقم التليفون، كود العضوية، أو المنطقة السكنية..."
            className="w-full bg-slate-950/80 border-2 border-slate-800 rounded-2xl pr-12 pl-4 py-3.5 text-sm font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-400 transition"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="absolute left-4 top-3.5 p-1 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-xs"
            >
              مسح
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 font-bold ml-1">حالة الاشتراك:</span>
            <button
              onClick={() => {
                setStatusFilter('all');
                setCurrentPage(1);
              }}
              className={`py-1.5 px-3 rounded-xl font-bold transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-teal-500 text-slate-950'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              الكل ({members.length})
            </button>
            <button
              onClick={() => {
                setStatusFilter('active');
                setCurrentPage(1);
              }}
              className={`py-1.5 px-3 rounded-xl font-bold transition cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
              }`}
            >
              ساري فقط ({stats.active})
            </button>
            <button
              onClick={() => {
                setStatusFilter('expired');
                setCurrentPage(1);
              }}
              className={`py-1.5 px-3 rounded-xl font-bold transition cursor-pointer ${
                statusFilter === 'expired'
                  ? 'bg-rose-500 text-white'
                  : 'bg-slate-800 text-rose-400 hover:bg-slate-700'
              }`}
            >
              منتهي ({stats.expired})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold ml-1">النشاط:</span>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-400"
            >
              <option value="all">كل الأنشطة</option>
              <option value="gym">🏋️ صالة الجيم</option>
              <option value="private">🎯 تدريب خاص (PT)</option>
              <option value="group">👥 كلاس جماعي</option>
              <option value="massage">💆‍♂️ مساج واستشفاء</option>
              <option value="physio">🩺 علاج طبيعي</option>
            </select>
          </div>
        </div>
      </div>

      {/* Members List Cards (Server-Side Paginated 20/Page) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2 text-xs text-slate-400 font-bold">
          <span>نتائج البحث: {totalCount} عضو (صفحة {currentPage} من {totalPages})</span>
          <span>عرض 20 عضو في الصفحة</span>
        </div>

        {isPageLoading ? (
          <CardsGridSkeleton count={6} />
        ) : pagedMembers.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-3xl space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="text-base font-black text-white">لم يتم العثور على أي لاعبين</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              لا توجد نتائج تطابق بحثك. تأكد من صحة رقم التليفون أو الاسم، أو أضف العضو كلاعب جديد.
            </p>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pagedMembers.map((member) => {
              const history =
                memberSubscriptionHistoryMap[(member.code || '').toUpperCase()] ||
                memberSubscriptionHistoryMap[member.id] ||
                [];
              const subStatus = getSubscriptionStatus(member, history);
              const isActive = subStatus.isActive;
              const isNeverSubscribed = subStatus.status === 'none';

              return (
                <div
                  key={member.id}
                  className={`bg-slate-900/90 border rounded-3xl p-5 shadow-xl transition hover:border-slate-600 flex flex-col justify-between space-y-4 ${
                    isActive
                      ? 'border-slate-800'
                      : isNeverSubscribed
                      ? 'border-sky-500/30 bg-sky-950/10'
                      : 'border-rose-500/30 bg-rose-950/10'
                  }`}
                >
                  {/* Card Header: Avatar, Name, Code */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700 border border-slate-600 flex items-center justify-center text-white font-black text-sm shrink-0 shadow">
                        {member.name.charAt(0) || 'م'}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-black text-white truncate">
                          {member.name}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <span className="font-mono bg-slate-800 px-2 py-0.5 rounded-lg text-slate-300 font-bold">
                            #{member.code}
                          </span>
                          {member.age && (
                            <span>{member.age} سنة</span>
                          )}
                          {member.residentialArea && (
                            <span className="flex items-center gap-0.5 text-slate-400 truncate">
                              <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="truncate">{member.residentialArea}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`text-[10px] font-black px-2.5 py-1 rounded-full shrink-0 border ${
                        isActive
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : isNeverSubscribed
                          ? 'bg-sky-500/15 text-sky-300 border-sky-500/35'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      }`}
                    >
                      {subStatus.badgeText}
                    </span>
                  </div>

                  {/* Phone & Direct Action */}
                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-xs">
                    <div className="flex items-center gap-2 text-slate-300 font-mono font-bold">
                      <Phone className="w-3.5 h-3.5 text-teal-400" />
                      <span>{member.phone || 'بدون رقم هاتف'}</span>
                    </div>
                    {member.phone && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopyPhone(member.phone!)}
                          title="نسخ الرقم"
                          className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                        >
                          {copiedPhone === member.phone ? (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <a
                          href={`https://wa.me/2${member.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          title="محادثة واتساب"
                          className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Subscription Breakdown */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800/60 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">نوع الباقة:</span>
                      <span className="font-bold text-white truncate max-w-[180px]">
                        {member.subscriptionPlan || 'بدون اشتراك نشط'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
                      <div>
                        <span className="text-[10px] text-slate-400 block">الأيام المتبقية:</span>
                        <span className={`font-mono font-black text-sm ${isActive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {subStatus.remainingDays !== undefined ? `${subStatus.remainingDays} يوم` : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">الحصص المتبقية:</span>
                        <span className="font-mono font-black text-xs text-teal-400">
                          {member.sessionCategory === 'gym' || !member.totalSessions
                            ? 'اشتراك مفتوح'
                            : `${member.remainingSessions ?? 0} حصة`}
                        </span>
                      </div>
                    </div>

                    {!isNeverSubscribed && member.startDate && member.endDate && (
                      <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/60 flex items-center justify-between">
                        <span>{subStatus.status === 'expired' ? 'انتهى:' : 'الصلاحية:'}</span>
                        <span className={`font-mono ${subStatus.status === 'expired' ? 'text-rose-300 font-bold' : 'text-slate-300'}`}>
                          {subStatus.status === 'expired' && subStatus.dateFormatted
                            ? subStatus.dateFormatted
                            : `من ${formatDateAr(member.startDate)} إلى ${formatDateAr(member.endDate)}`}
                        </span>
                      </div>
                    )}

                    {member.subscriptionFee !== undefined && member.subscriptionFee > 0 && (
                      <div className="text-[10px] text-slate-400 flex items-center justify-between">
                        <span>الرسوم وطريقة الدفع:</span>
                        <span className="font-mono font-bold text-emerald-300">
                          {formatEGP(member.subscriptionFee)} ({member.paymentMethod === 'instapay' ? 'إنستاباي' : 'كاش'})
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions Grid */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {/* Renew Button */}
                    <button
                      onClick={() => {
                        setRenewalMember(member);
                        setRenewalForm({
                          planName: member.subscriptionPlan || 'اشتراك شهري صالة الجيم (30 يوم)',
                          durationDays: member.totalDays || 30,
                          sessionsCount: member.totalSessions || 0,
                          fee: member.subscriptionFee || 500,
                          paymentMethod: (member.paymentMethod as any) || 'cash',
                          notes: '',
                        });
                      }}
                      className="py-2.5 px-3 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-300 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>تجديد الاشتراك</span>
                    </button>

                    {/* Member Personalized QR */}
                    <button
                      onClick={() => handleShowMemberQR(member)}
                      className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <QrCode className="w-3.5 h-3.5 text-teal-400" />
                      <span>كود الـ QR</span>
                    </button>

                    {/* Quick Direct Check-in */}
                    <button
                      onClick={() => handleDirectCheckIn(member)}
                      className="py-2.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>تسكين بالصالة</span>
                    </button>

                    {/* Edit Member Profile */}
                    <button
                      onClick={() => {
                        setEditingMember(member);
                        setEditForm({
                          name: member.name,
                          phone: member.phone || '',
                          age: member.age || 20,
                          residentialArea: member.residentialArea || '',
                          notes: member.notes || '',
                        });
                      }}
                      className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Edit className="w-3.5 h-3.5 text-cyan-400" />
                      <span>تعديل البيانات</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <PaginationBar
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={20}
            onPageChange={setCurrentPage}
            isLoading={isPageLoading}
            label="عضو"
          />
          </>
        )}
      </div>

      {/* MODAL 1: RENEW SUBSCRIPTION */}
      {renewalMember && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-5 sm:p-7 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl relative animate-scale-up" dir="rtl">
            <button
              onClick={() => setRenewalMember(null)}
              className="absolute top-4 left-4 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-black text-white">تجديد اشتراك اللاعب</h3>
              </div>
              <p className="text-xs text-slate-400">
                اللاعب: <strong className="text-white">{renewalMember.name}</strong> • الكود: <strong className="text-teal-400">#{renewalMember.code}</strong>
              </p>
            </div>

            <form onSubmit={handleRenewalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  نوع باقة الاشتراك:
                </label>
                <input
                  type="text"
                  required
                  value={renewalForm.planName}
                  onChange={(e) => setRenewalForm({ ...renewalForm, planName: e.target.value })}
                  placeholder="مثال: اشتراك شهري صالة الجيم (30 يوم)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    المدة بالأيام:
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={renewalForm.durationDays}
                    onChange={(e) => setRenewalForm({ ...renewalForm, durationDays: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    عدد الحصص (إن وجد):
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={renewalForm.sessionsCount}
                    onChange={(e) => setRenewalForm({ ...renewalForm, sessionsCount: Number(e.target.value) })}
                    placeholder="0 إذا كان تمرين حر"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-teal-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    قيمة التجديد (ج.م):
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={renewalForm.fee}
                    onChange={(e) => setRenewalForm({ ...renewalForm, fee: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    طريقة التحصيل:
                  </label>
                  <select
                    value={renewalForm.paymentMethod}
                    onChange={(e) => setRenewalForm({ ...renewalForm, paymentMethod: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-400"
                  >
                    <option value="cash">💵 نقداً بالدرج (كاش)</option>
                    <option value="instapay">⚡ محفظة إنستاباي</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  ملاحظات إضافية:
                </label>
                <input
                  type="text"
                  value={renewalForm.notes}
                  onChange={(e) => setRenewalForm({ ...renewalForm, notes: e.target.value })}
                  placeholder="ملاحظات اختيارية..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-400"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingRenewal}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-sm shadow-xl shadow-teal-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{isSubmittingRenewal ? 'جارِ تأكيد التجديد وتوريد النقدية...' : 'تأكيد التجديد وتوريد النقدية للدرج وعرض الـ QR'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT MEMBER PROFILE */}
      {editingMember && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-5 sm:p-7 max-w-md w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl relative animate-scale-up" dir="rtl">
            <button
              onClick={() => setEditingMember(null)}
              className="absolute top-4 left-4 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                  <Edit className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-black text-white">تعديل بيانات العضو</h3>
              </div>
              <p className="text-xs text-slate-400">
                الكود: #{editingMember.code}
              </p>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  اسم اللاعب بالكامل:
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  رقم الهاتف:
                </label>
                <input
                  type="tel"
                  required
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-teal-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    السن (العمر):
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={editForm.age}
                    onChange={(e) => setEditForm({ ...editForm, age: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    المنطقة السكنية:
                  </label>
                  <input
                    type="text"
                    value={editForm.residentialArea}
                    onChange={(e) => setEditForm({ ...editForm, residentialArea: e.target.value })}
                    placeholder="مثال: المعادي"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  ملاحظات:
                </label>
                <input
                  type="text"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-400"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingEdit}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-black text-xs shadow-lg shadow-teal-500/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingEdit ? 'جارِ حفظ التعديلات...' : 'حفظ التعديلات'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD NEW MEMBER */}
      {isNewMemberModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-5 sm:p-7 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl relative animate-scale-up" dir="rtl">
            <button
              onClick={() => setIsNewMemberModalOpen(false)}
              className="absolute top-4 left-4 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
                  <Plus className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-black text-white">تسجيل عضو جديد بالكامل</h3>
              </div>
              <p className="text-xs text-slate-400">
                تسجيل العضوية وتوريد الرسوم للخزينة وإصدار كيو آر خاص لربط هاتف المتدرب
              </p>
            </div>

            <form onSubmit={handleNewMemberSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  اسم اللاعب بالكامل:
                </label>
                <input
                  type="text"
                  required
                  value={newMemberForm.name}
                  onChange={(e) => setNewMemberForm({ ...newMemberForm, name: e.target.value })}
                  placeholder="محمد أحمد إبراهيم"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  رقم الهاتف:
                </label>
                <input
                  type="tel"
                  required
                  value={newMemberForm.phone}
                  onChange={(e) => setNewMemberForm({ ...newMemberForm, phone: e.target.value })}
                  placeholder="01012345678"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-teal-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    السن (العمر):
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={90}
                    value={newMemberForm.age}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, age: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    المنطقة السكنية:
                  </label>
                  <input
                    type="text"
                    value={newMemberForm.residentialArea}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, residentialArea: e.target.value })}
                    placeholder="مثال: مدينة نصر"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    النشاط:
                  </label>
                  <select
                    value={newMemberForm.sessionCategory}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, sessionCategory: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-400"
                  >
                    <option value="gym">🏋️ صالة الجيم العامة</option>
                    <option value="private">🎯 تدريب خاص (Private PT)</option>
                    <option value="group">👥 كلاس تدريبي جماعي</option>
                    <option value="massage">💆‍♂️ مساج واستشفاء</option>
                    <option value="physio">🩺 علاج طبيعي</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    خطة الاشتراك:
                  </label>
                  <input
                    type="text"
                    required
                    value={newMemberForm.subscriptionPlan}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, subscriptionPlan: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-400"
                  />
                </div>
              </div>

              <div className={`grid gap-3 ${newMemberForm.sessionCategory !== 'gym' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    المدة بالأيام:
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newMemberForm.totalDays}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, totalDays: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-teal-400"
                  />
                </div>
                {newMemberForm.sessionCategory !== 'gym' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      عدد الحصص المتاحة للباقة:
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={newMemberForm.totalSessions}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, totalSessions: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-teal-400"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    قيمة الاشتراك (ج.م):
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newMemberForm.fee}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, fee: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    طريقة الدفع:
                  </label>
                  <select
                    value={newMemberForm.paymentMethod}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, paymentMethod: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-400"
                  >
                    <option value="cash">💵 نقداً بالدرج (كاش)</option>
                    <option value="instapay">⚡ محفظة إنستاباي</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingNewMember}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-sm shadow-xl shadow-teal-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{isSubmittingNewMember ? 'جارِ حفظ العضوية وتوليد كود الـ QR...' : 'حفظ العضوية وتوليد كود الـ QR الخاص باللاعب'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: PERSONALIZED MEMBER QR CODE DISPLAY */}
      {qrModalMember && qrModalUrl && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#0f172a] border-2 border-emerald-500/50 rounded-3xl p-5 sm:p-7 max-w-sm w-full max-h-[90vh] overflow-y-auto text-center space-y-4 shadow-2xl relative animate-scale-up" dir="rtl">
            <button
              onClick={() => {
                setQrModalMember(null);
                setQrModalUrl('');
              }}
              className="absolute top-4 left-4 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2 border border-emerald-500/40">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white">كيو آر كود ربط الهاتف</h3>
              <p className="text-xs text-slate-300 font-bold">
                اللاعب: <span className="text-emerald-400">{qrModalMember.name}</span>
              </p>
              <div className="text-[11px] text-slate-400 font-mono">
                الكود: #{qrModalMember.code} • {qrModalMember.phone}
              </div>
            </div>

            {/* The QR Image */}
            <div className="p-4 bg-white rounded-2xl shadow-xl inline-block mx-auto">
              <img
                src={qrModalUrl}
                alt="Member QR Code"
                className="w-56 h-56 object-contain block mx-auto"
              />
            </div>

            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs leading-relaxed font-semibold">
              📸 وجّه كاميرا هاتف المتدرب نحو الشاشة لمسح الكود الآن، وسيتم ربط هاتفه تلقائياً وتسكينه فورياً بالصالة!
            </div>

            <div className="flex gap-2">
              <a
                href={qrModalUrl}
                download={`QR-${qrModalMember.name}-${qrModalMember.code}.png`}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل الصورة</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  setQrModalMember(null);
                  setQrModalUrl('');
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition cursor-pointer"
              >
                تم المسح بنجاح
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
