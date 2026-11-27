import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  QrCode,
  Search,
  UserCheck,
  Calendar,
  Clock,
  Sparkles,
  Stethoscope,
  Plus,
  AlertCircle,
  CheckCircle2,
  Phone,
  ShieldCheck,
  UserPlus,
  RefreshCw,
  Layers,
  CreditCard,
  Banknote,
  Check,
  Zap,
  X,
  ArrowRight,
  Database,
  Flame,
  Activity,
  HeartHandshake,
  Users,
  Dumbbell,
  Play,
  User,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { useGymData, generateUniqueMemberCode } from '../context/GymDataContext';
import { Member, SessionCategory, Coach, CheckInLog } from '../types';
import { DeskQRCodeModal } from '../components/checkin/DeskQRCodeModal';
import { CheckInModal } from '../components/checkin/CheckInModal';
import { CheckOutSettlementModal } from '../components/CheckOutSettlementModal';
import { formatDateAr, formatEGP, formatArabicDayMonth, getSubscriptionStatus } from '../utils/formatters';
import { generateQRDataUrl } from '../utils/qrGenerator';
import { sounds } from '../utils/sound';
import { LogOut, History } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';
import { PaginationBar } from '../components/PaginationBar';
import { TableRowsSkeleton } from '../components/PageSkeleton';

const formatElapsedHMS = (startIso: string, nowMs: number): string => {
  const diffSec = Math.max(0, Math.floor((nowMs - new Date(startIso).getTime()) / 1000));
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const ReceptionPage: React.FC = () => {
  const {
    members,
    findMemberByCode,
    performCheckIn,
    calculatePlayerCheckOutQuote,
    completePlayerCheckOut,
    cancelCheckIn,
    clearAllCheckInLogs,
    toggleMemberAsDoctor,
    addMember,
    checkInLogs,
    coaches,
    sessions,
    assignPlayerToSession,
    assignArrivedMember,
    renewMemberSubscription,
    memberSubscriptionHistoryMap,
  } = useGymData();

  // Precomputed O(1) lookups to avoid N+1 / O(N*M) scans inside queue & log maps
  const { membersById, membersByCode } = useMemo(() => {
    const byId = new Map<string, Member>();
    const byCode = new Map<string, Member>();
    members.forEach((m) => {
      if (m.id) byId.set(m.id, m);
      if (m.code) byCode.set(m.code.toUpperCase(), m);
    });
    return { membersById: byId, membersByCode: byCode };
  }, [members]);

  const resolveMemberAndSubInfo = useCallback(
    (memberId?: string, memberCode?: string) => {
      const m =
        (memberId ? membersById.get(memberId) : undefined) ||
        (memberCode ? membersByCode.get(memberCode.toUpperCase()) : undefined);
      const history = m
        ? memberSubscriptionHistoryMap[(m.code || '').toUpperCase()] ||
          memberSubscriptionHistoryMap[m.id] ||
          []
        : [];
      return { member: m, subInfo: getSubscriptionStatus(m, history) };
    },
    [membersById, membersByCode, memberSubscriptionHistoryMap]
  );

  // Historical Check-In / Check-Out Archive Tab State (Server-side Pagination: 20 per page)
  const [logViewTab, setLogViewTab] = useState<'live' | 'history'>('live');
  const [historyLogs, setHistoryLogs] = useState<CheckInLog[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);
  const [historySearch, setHistorySearch] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('');
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const loadHistoricalCheckIns = useCallback(
    async (page: number, search: string, dateFilter: string) => {
      setIsHistoryLoading(true);
      try {
        if (isSupabaseConfigured) {
          const res = await supabaseService.fetchCheckInLogsPaginated({
            page,
            pageSize: 20,
            search,
            dateFilter,
          });
          if (res) {
            setHistoryLogs(res.data);
            setHistoryTotalCount(res.count);
            setHistoryTotalPages(res.totalPages);
            setHistoryPage(res.page);
            return;
          }
        }
        // Fallback local pagination if offline
        const q = search.trim().toLowerCase();
        const filtered = checkInLogs.filter((l) => {
          const matchesSearch =
            !q ||
            l.memberName.toLowerCase().includes(q) ||
            l.memberCode.toLowerCase().includes(q) ||
            (l.assignedCoachName || '').toLowerCase().includes(q) ||
            (l.assignedSessionTitle || '').toLowerCase().includes(q);
          const matchesDate = !dateFilter || l.timestamp.startsWith(dateFilter);
          return matchesSearch && matchesDate;
        });
        const total = filtered.length;
        const pages = Math.max(1, Math.ceil(total / 20));
        const safePage = Math.min(page, pages);
        setHistoryLogs(filtered.slice((safePage - 1) * 20, safePage * 20));
        setHistoryTotalCount(total);
        setHistoryTotalPages(pages);
        setHistoryPage(safePage);
      } finally {
        setIsHistoryLoading(false);
      }
    },
    [checkInLogs]
  );

  useEffect(() => {
    if (logViewTab !== 'history') return;
    const timer = setTimeout(() => {
      loadHistoricalCheckIns(historyPage, historySearch, historyDateFilter);
    }, 250);
    return () => clearTimeout(timer);
  }, [logViewTab, historyPage, historySearch, historyDateFilter, loadHistoricalCheckIns]);

  const [settlementLogId, setSettlementLogId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCancelCheckIn = (logId: string, memberName: string) => {
    if (
      window.confirm(
        `هل أنت متأكد من إلغاء تحضير اللاعب (${memberName}) وحذفه من الحصة؟\nسيتم استرجاع رصيد الحصص وإلغاء أي مديونية أو تحصيل تم تسجيله.`
      )
    ) {
      cancelCheckIn(logId);
    }
  };

  // Search input for manual entry
  const [searchCode, setSearchCode] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // Dynamic Desk QR Code that rotates every 2 minutes (120 seconds)
  const [deskQrUrl, setDeskQrUrl] = useState<string>('');
  const [deskQrToken, setDeskQrToken] = useState<string>('');
  const [qrSecondsLeft, setQrSecondsLeft] = useState<number>(120);

  // Modals state
  const [isDeskQRModalOpen, setIsDeskQRModalOpen] = useState(false);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [checkedInMember, setCheckedInMember] = useState<Member | null>(null);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);

  // Seating & Routing Modal state (3 Distinct Business Pathways)
  const [isSeatingModalOpen, setIsSeatingModalOpen] = useState(false);
  const [selectedLogForSeating, setSelectedLogForSeating] = useState<CheckInLog | null>(null);
  const [isSubmittingSeating, setIsSubmittingSeating] = useState(false);
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);
  const [seatingForm, setSeatingForm] = useState<{
    pathway: 'coach_debt' | 'gym_with_coach_share' | 'gym_direct_no_coach';
    sessionId: string;
    coachId: string;
    amount: number;
    coachShareType: 'fixed' | 'percentage';
    coachShareValue: number;
    paymentMode: 'coach_charge' | 'cash_drawer' | 'instapay';
    isDirectPaid: boolean;
    notes: string;
    directEntryType: 'existing_sub' | 'single_pass' | 'new_subscription';
    subPlanName: string;
    subDurationDays: number;
    subFee: number;
    subPaymentMethod: 'cash' | 'instapay';
    isSubAlreadyRenewed?: boolean;
  }>({
    pathway: 'coach_debt',
    sessionId: '',
    coachId: '',
    amount: 100,
    coachShareType: 'fixed',
    coachShareValue: 50,
    paymentMode: 'coach_charge',
    isDirectPaid: false,
    notes: '',
    directEntryType: 'existing_sub',
    subPlanName: 'اشتراك شهري صالة الجيم',
    subDurationDays: 30,
    subFee: 500,
    subPaymentMethod: 'cash',
    isSubAlreadyRenewed: false,
  });

  const getDefaultFeeForCategory = (cat: SessionCategory, coachId?: string, sessId?: string) => {
    if (cat === 'massage') {
      const c = coaches.find((co) => co.id === coachId);
      return c?.ratePerSession || 180;
    }
    if (cat === 'physio') return 150;
    if (sessId) {
      const s = sessions.find((sess) => sess.id === sessId);
      if (s) return s.price;
    }
    if (cat === 'private') {
      const c = coaches.find((co) => co.id === coachId);
      return c?.ratePerSession || 200;
    }
    return 80;
  };

  // New member form
  const [newMemberForm, setNewMemberForm] = useState({
    name: '',
    phone: '',
    code: generateUniqueMemberCode(members),
    subscriptionPlan: 'اشتراك شهري لياقة عامة',
    subscriptionFee: 500,
    paymentMethod: 'coach_collected' as 'cash' | 'coach_collected' | 'instapay',
    collectedByCoachId: '',
    sessionCategory: 'gym' as SessionCategory,
    assignedSessionId: '',
    isTemporaryEnrollment: false,
    totalDays: 30,
    totalSessions: 12,
    type: 'member' as 'member' | 'doctor',
  });

  // 1. Dynamic Reception Desk QR Generator & 2-Minute Rotation Engine
  const rotateDeskQR = useCallback(() => {
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    const token = `SYN-CHECKIN-${Date.now().toString(36).toUpperCase()}-${randomHex}`;
    setDeskQrToken(token);
    setQrSecondsLeft(120);

    const checkInUrl = `${window.location.origin}/checkin?kioskToken=${token}&t=${Date.now()}`;
    generateQRDataUrl(checkInUrl).then(setDeskQrUrl);
  }, []);

  useEffect(() => {
    rotateDeskQR();
    const interval = setInterval(() => {
      setQrSecondsLeft((prev) => {
        if (prev <= 1) {
          rotateDeskQR();
          return 120;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [rotateDeskQR]);

  // Manual search trigger
  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchCode.trim()) return;

    const found = findMemberByCode(searchCode);
    if (found) {
      setSelectedMember(found);
    } else {
      setSelectedMember(null);
      alert('لم يتم العثور على لاعب أو طبيب بهذا الكود');
    }
  };

  // Check-in / Check-out trigger
  const handleTriggerCheckIn = (member: Member, method: 'qr' | 'manual' = 'manual') => {
    const res = performCheckIn(member.id, method);
    if (res.success && res.isCheckOut) {
      if (res.requiresSettlement && res.checkOutLogId) {
        sounds.playBeep();
        setSettlementLogId(res.checkOutLogId);
      } else {
        sounds.playSuccessDing();
        alert(`✅ تم تسجيل خروج اللاعب ${member.name} بنجاح (المدة: ${res.durationMinutes || 0} دقيقة - الشريحة الأولى بدون رسوم إضافية).`);
      }
      return;
    }

    if (res.success && res.member) {
      setCheckedInMember(res.member);
      setIsCheckInModalOpen(true);
      setSelectedMember(res.member);
    }
  };

  const handleManualCheckOut = async (logId: string) => {
    const quote = calculatePlayerCheckOutQuote(logId);
    if (!quote) return;

    if (quote.durationMinutes <= 90 && quote.extraFeeDue <= 0) {
      try {
        const res = await completePlayerCheckOut(logId, {
          paymentMethod: 'cash',
          extraFee: 0,
          durationMinutes: quote.durationMinutes,
          pricingTier: 'tier1',
        });
        if (res.success) {
          sounds.playSuccessDing();
          alert(`✅ تم تسجيل خروج ${quote.log.memberName} (${quote.durationMinutes} دقيقة - الشريحة الأولى) بدون رسوم إضافية.`);
        }
      } catch (err: any) {
        alert(err?.message || 'تعذر الاتصال بقاعدة البيانات');
      }
    } else {
      setSettlementLogId(logId);
    }
  };

  // Quick Simulation: Simulate scanning the live rotating Desk QR by a random real registered member
  const handleSimulateDeskQRScan = () => {
    const validMembers = members.filter((m) => m.type === 'member');
    const pool = validMembers.length > 0 ? validMembers : members;
    if (pool.length === 0) {
      alert('لا يوجد أعضاء مسجلين في دليل الأعضاء بـ Supabase حتى الآن. يرجى تسجيل عضو أولاً لتجربة المحاكاة.');
      return;
    }
    const randomMember = pool[Math.floor(Math.random() * pool.length)];
    handleTriggerCheckIn(randomMember, 'qr');
  };

  // Open Seating Modal (3 Pathways Architecture)
  const openSeatingModal = (log: CheckInLog) => {
    setSelectedLogForSeating(log);
    const defaultSession = log.assignedSessionId || (sessions[0]?.id || '');
    const sess = sessions.find((s) => s.id === defaultSession) || sessions[0];
    const defaultCoach = log.assignedCoachId || sess?.coachIds[0] || coaches[0]?.id || '';
    const initialPrice = sess?.price || 100;
    const coachObj = coaches.find((c) => c.id === defaultCoach);
    const initialCoachShare = coachObj?.ratePerSession || 50;

    const targetMember = members.find(
      (m) => m.id === log.memberId || m.code === log.memberCode
    );
    const subInfo = getSubscriptionStatus(targetMember);
    const hasActiveSub = subInfo.isActive;

    const initialPathway = log.seatingPathway || (sessions.length > 0 ? 'coach_debt' : 'gym_direct_no_coach');

    setSeatingForm({
      pathway: initialPathway,
      sessionId: sess?.id || defaultSession || '',
      coachId: defaultCoach || '',
      amount: initialPrice,
      coachShareType: coachObj?.paymentType === 'percentage' ? 'percentage' : 'fixed',
      coachShareValue: coachObj?.paymentType === 'percentage' ? (coachObj.commissionRate || 40) : initialCoachShare,
      paymentMode: initialPathway === 'coach_debt' ? 'coach_charge' : 'cash_drawer',
      isDirectPaid: !hasActiveSub,
      notes: '',
      directEntryType: hasActiveSub ? 'existing_sub' : 'new_subscription',
      subPlanName: 'اشتراك شهري صالة الجيم',
      subDurationDays: 30,
      subFee: 500,
      subPaymentMethod: 'cash',
      isSubAlreadyRenewed: false,
    });
    setIsSeatingModalOpen(true);
  };

  // Confirm Seating & Routing Action
  const handleConfirmSeating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLogForSeating || isSubmittingSeating) return;

    const targetMember = members.find(
      (m) => m.id === selectedLogForSeating.memberId || m.code === selectedLogForSeating.memberCode
    );
    const subInfo = getSubscriptionStatus(targetMember);

    // 1. منع التسكين المجاني قطعياً في حال انتهاء الاشتراك أو نفاد رصيد الحصص (0 حصة)
    if (seatingForm.pathway === 'gym_direct_no_coach' && seatingForm.directEntryType === 'existing_sub') {
      if (!subInfo.isActive || subInfo.isExpired || (targetMember && (targetMember.totalSessions || 0) > 0 && (targetMember.remainingSessions || 0) <= 0)) {
        alert('⚠️ تنبيه: اشتراك اللاعب منتهي أو نفدت حصصه بالكامل (0 حصة متبقية)! لا يمكن التسكين المجاني كاشتراك قائم. يرجى اختيار تجديد الاشتراك أو تحصيل تذكرة تمرينة يومية.');
        return;
      }
    }

    if (seatingForm.pathway === 'gym_direct_no_coach' && seatingForm.directEntryType === 'single_pass') {
      const passAmount = Number(seatingForm.amount);
      if (isNaN(passAmount) || passAmount <= 0) {
        alert('تنبيه: يرجى تحديد سعر التذكرة اليومية (أكبر من 0)');
        return;
      }
    }

    if (seatingForm.pathway === 'gym_direct_no_coach' && seatingForm.directEntryType === 'new_subscription' && !seatingForm.isSubAlreadyRenewed) {
      const subFee = Number(seatingForm.subFee);
      const subDays = Number(seatingForm.subDurationDays);
      if (isNaN(subFee) || subFee <= 0) {
        alert('تنبيه: يرجى إدخال قيمة الاشتراك الجديد (أكبر من 0)');
        return;
      }
      if (isNaN(subDays) || subDays <= 0) {
        alert('تنبيه: مدة الاشتراك يجب أن تكون يوماً واحداً على الأقل');
        return;
      }
    }

    if (seatingForm.pathway === 'gym_with_coach_share') {
      const sessionPrice = Number(seatingForm.amount);
      if (isNaN(sessionPrice) || sessionPrice <= 0) {
        alert('تنبيه: يرجى تحديد المبلغ المدفوع للحصة بالاستقبال (أكبر من 0)، أو اختيار مسار التحميل على الكابتن إذا كان الدفع مؤجلاً.');
        return;
      }
    }

    setIsSubmittingSeating(true);
    try {
      // If subscribing right now from the modal in Pathway 3 (and not already triggered via button)
      if (
        seatingForm.pathway === 'gym_direct_no_coach' &&
        seatingForm.directEntryType === 'new_subscription' &&
        !seatingForm.isSubAlreadyRenewed
      ) {
        await renewMemberSubscription(
          selectedLogForSeating.memberId,
          seatingForm.subPlanName,
          Number(seatingForm.subDurationDays) || 30,
          Number(seatingForm.subFee) || 0,
          seatingForm.subPaymentMethod,
          `اشتراك صالة من نافذة التسكين والتوجيه (${seatingForm.subPlanName})`
        );
      }

      let targetCoachId = seatingForm.coachId;
      let targetSessionId = seatingForm.sessionId;
      let category: SessionCategory = 'group';

      if (seatingForm.pathway === 'gym_direct_no_coach') {
        targetCoachId = '';
        targetSessionId = '';
        category = 'gym';
      } else {
        const sess = sessions.find((s) => s.id === seatingForm.sessionId);
        if (sess && sess.coachIds.length > 0) {
          targetCoachId = sess.coachIds[0];
        }
        if (!targetCoachId && coaches.length > 0) {
          targetCoachId = coaches[0].id;
        }
      }

      const totalPaid = Number(seatingForm.amount) || 0;
      let coachShare = 0;
      if (seatingForm.pathway === 'gym_with_coach_share') {
        if (seatingForm.coachShareType === 'fixed') {
          coachShare = Math.min(totalPaid, Number(seatingForm.coachShareValue) || 0);
        } else {
          const pct = Number(seatingForm.coachShareValue) || 0;
          coachShare = Math.round((totalPaid * pct) / 100);
        }
      }
      const gymShare = Math.max(0, totalPaid - coachShare);

      // If new subscription was created, renewMemberSubscription already recorded the payment in cashInflows and reports.
      // For single pass, assignArrivedMember records the fee. For existing subscription, 0 is charged.
      const paidAmount =
        seatingForm.pathway === 'coach_debt'
          ? 0
          : seatingForm.pathway === 'gym_direct_no_coach'
          ? (seatingForm.directEntryType === 'single_pass' ? totalPaid : 0)
          : totalPaid;

      assignArrivedMember(
        selectedLogForSeating.id,
        category,
        targetCoachId,
        targetSessionId || undefined,
        seatingForm.notes,
        {
          seatingPathway: seatingForm.pathway,
          paymentMode:
            seatingForm.pathway === 'coach_debt'
              ? 'coach_charge'
              : (seatingForm.paymentMode === 'instapay' ? 'instapay' : 'cash_drawer'),
          amount: paidAmount,
          coachShareType: seatingForm.coachShareType,
          coachShareValue: Number(seatingForm.coachShareValue) || 0,
          coachShareAmount: coachShare,
          gymShareAmount: gymShare,
        }
      );

      setIsSeatingModalOpen(false);
      setSelectedLogForSeating(null);
    } finally {
      setIsSubmittingSeating(false);
    }
  };

  // Add Member
  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberForm.name.trim() || !newMemberForm.code.trim() || isSubmittingMember) return;

    const fee = Number(newMemberForm.subscriptionFee);
    const totalDays = Number(newMemberForm.totalDays);
    if (isNaN(fee) || fee < 0) {
      alert('تنبيه: قيمة الاشتراك لا يمكن أن تكون سالبة');
      return;
    }
    if (isNaN(totalDays) || totalDays <= 0) {
      alert('تنبيه: مدة الاشتراك يجب أن تكون يوماً واحداً على الأقل');
      return;
    }

    setIsSubmittingMember(true);
    try {
      const created = addMember({
        name: newMemberForm.name.trim(),
        phone: newMemberForm.phone.trim(),
        code: newMemberForm.code.trim().toUpperCase(),
        subscriptionPlan: newMemberForm.subscriptionPlan,
        subscriptionFee: fee || 0,
        paymentMethod: newMemberForm.paymentMethod,
        collectedByCoachId: newMemberForm.collectedByCoachId || undefined,
        sessionCategory: newMemberForm.sessionCategory,
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date(Date.now() + totalDays * 86400000).toISOString().slice(0, 10),
        totalDays,
        remainingDays: totalDays,
        totalSessions: newMemberForm.sessionCategory === 'gym' ? 0 : (Number(newMemberForm.totalSessions) || 0),
        remainingSessions: newMemberForm.sessionCategory === 'gym' ? 0 : (Number(newMemberForm.totalSessions) || 0),
        type: newMemberForm.type,
        active: true,
      });

      if (newMemberForm.assignedSessionId) {
        assignPlayerToSession(
          newMemberForm.assignedSessionId,
          created.id,
          newMemberForm.isTemporaryEnrollment
        );
      }

      setIsAddMemberModalOpen(false);
      setSelectedMember(created);
      setNewMemberForm({
        name: '',
        phone: '',
        code: generateUniqueMemberCode(members),
        subscriptionPlan: 'اشتراك شهري لياقة عامة',
        subscriptionFee: 500,
        paymentMethod: 'coach_collected',
        collectedByCoachId: '',
        sessionCategory: 'gym',
        assignedSessionId: '',
        isTemporaryEnrollment: false,
        totalDays: 30,
        totalSessions: 12,
        type: 'member',
      });
    } finally {
      setIsSubmittingMember(false);
    }
  };

  const minutesLeft = Math.floor(qrSecondsLeft / 60);
  const secondsLeft = qrSecondsLeft % 60;
  const timerText = `${String(minutesLeft).padStart(2, '0')}:${String(secondsLeft).padStart(2, '0')}`;
  const rotationProgress = ((120 - qrSecondsLeft) / 120) * 100;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Action Banner */}
      <div className="bg-gradient-to-r from-[#0d1e38] via-[#0f1d31] to-[#091528] border border-teal-500/20 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
            <QrCode className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">مكتب الاستقبال وإدارة الحضور والتسكين</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                سينابس جيم الذكي
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              تسجيل الحضور عبر الكيو آر الحي المتغير تلقائياً كل دقيقتين، وتسكين وتوجيه اللاعبين فورياً للحصص والمساج
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Desk Stand Modal Button */}
          <button
            onClick={() => setIsDeskQRModalOpen(true)}
            className="flex-1 md:flex-none py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-teal-400" />
            <span>طباعة استاند الكيو آر</span>
          </button>

          {/* Add New Member Button */}
          <button
            onClick={() => setIsAddMemberModalOpen(true)}
            className="flex-1 md:flex-none py-3 px-5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>تسجيل لاعب جديد</span>
          </button>
        </div>
      </div>

      {/* DYNAMIC RECEPTION DESK QR CODE STAND (Visible directly on the page, rotates every 2 minutes) */}
      <div className="bg-gradient-to-br from-[#0c1a2f] via-[#0f172a] to-[#0a1324] border-2 border-teal-500/40 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        {/* Glow corner */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
          {/* Right column: Stand Details & Live Timer */}
          <div className="flex-1 space-y-4 text-right">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-xs font-black uppercase tracking-wider text-teal-300 px-3 py-1 rounded-full bg-teal-500/15 border border-teal-500/30">
                كيو آر كود مكتب الاستقبال الحي (مباشر)
              </span>
              <span className="text-xs font-mono font-bold text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700">
                كود الأمان: {deskQrToken}
              </span>
            </div>

            <h3 className="text-2xl font-black text-white">
              امسح الكود الآن بهاتفك لتسجيل الحضور الفوري
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
              هذا الرمز معروض مباشرة على شاشة الاستقبال أمام اللاعبين عند دخولهم، <strong className="text-teal-300 font-bold">ويتغير تلقائياً كل دقيقتين (120 ثانية)</strong> لضمان حضور اللاعب شخصياً داخل الجيم والتعرف الدقيق عليه عبر الـ API.
            </p>

            {/* Countdown Bar & Timer */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2 max-w-md">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5 font-bold">
                  <Clock className="w-4 h-4 text-teal-400" />
                  <span>الوقت المتبقي حتى تجديد الكود التلقائي:</span>
                </span>
                <span className="text-base font-black font-mono text-teal-400 animate-pulse">
                  {timerText}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-teal-500 to-cyan-400 h-full transition-all duration-1000 rounded-full"
                  style={{ width: `${100 - rotationProgress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>دورة التجديد: دقيقتان (120 ثانية)</span>
                <button
                  type="button"
                  onClick={rotateDeskQR}
                  className="text-teal-400 hover:text-teal-300 font-bold flex items-center gap-1 transition"
                  title="تجديد الكود فورياً"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>تحديث الكود يدوياً الآن</span>
                </button>
              </div>
            </div>

            {/* Quick Action Simulation for testing phone scan */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSimulateDeskQRScan}
                className="py-2.5 px-5 rounded-xl bg-teal-500/20 hover:bg-teal-500 text-teal-300 hover:text-slate-950 font-black text-xs border border-teal-500/40 transition flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Sparkles className="w-4 h-4" />
                <span>محاكاة مسح الكود بهاتف لاعب عشوائي فوراً</span>
              </button>
            </div>
          </div>

          {/* Left column: High-Tech QR Screen Card */}
          <div className="bg-slate-950/80 border-2 border-teal-500/40 rounded-3xl p-5 shadow-2xl flex flex-col items-center justify-center text-center max-w-xs w-full">
            <div className="text-[11px] font-black tracking-widest text-teal-400 uppercase mb-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-400"></span>
              SYNAPSE LIVE DESK QR
            </div>

            {/* The Actual QR Code Box */}
            <div className="p-3 bg-white rounded-2xl shadow-xl border-4 border-teal-500/30">
              {deskQrUrl ? (
                <img
                  src={deskQrUrl}
                  alt="Dynamic Desk QR Code"
                  className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-lg"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-slate-600 font-bold text-xs">
                  جاري توليد الكود الذكي...
                </div>
              )}
            </div>

            <div className="mt-3 text-center">
              <div className="text-xs font-bold text-white flex items-center justify-center gap-1">
                <span>وجه كاميرا الهاتف نحو الكود</span>
              </div>
              <div className="text-[10px] text-teal-300/80 mt-0.5 font-mono">
                كود نشط صالح لمدة دقيقتين
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LIVE ARRIVED MEMBERS & SEATING / ROUTING QUEUE (طابور وصول وتسكين اللاعبين الحاضرين اليوم) */}
      <div className="bg-[#0f172a]/95 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
                <Users className="w-4 h-4" />
              </div>
              <h3 className="text-base font-black text-white">
                اللاعبين الحاضرين بالاستقبال اليوم (طابور التسكين والتوجيه)
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold">
                {checkInLogs.length} حاضرين
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              اضغط على أي لاعب وافد لتسكينه فورياً: مساج واستشفاء، كلاس جماعي، تدريب خاص (برايفت)، أو صالة الجيم العامة مع اختيار الكابتن
            </p>
          </div>

          {checkInLogs.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('هل أنت متأكد من تفريغ طابور الحضور لليوم بالكامل ومسح جميع الوافدين؟\nسيتم مسح الطابور نظيفاً لبدء استقبال جديد.')) {
                  clearAllCheckInLogs();
                }
              }}
              className="py-2 px-3.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>تفريغ الطابور بالكامل</span>
            </button>
          )}
        </div>

        {checkInLogs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {checkInLogs.map((log) => {
              const isAssigned = log.seatingStatus === 'assigned';
              const logTime = new Date(log.timestamp).toLocaleTimeString('ar-EG', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              });

              const { member: matchingMember, subInfo } = resolveMemberAndSubInfo(log.memberId, log.memberCode);
              const displayName = matchingMember?.name || log.memberName;
              const displayCode = matchingMember?.code || log.memberCode;

              return (
                <div
                  key={log.id}
                  className={`p-4 rounded-2xl border transition relative overflow-hidden flex flex-col justify-between ${
                    isAssigned
                      ? 'bg-slate-900/80 border-slate-800 hover:border-teal-500/30'
                      : 'bg-gradient-to-br from-[#1a1824] to-[#11101b] border-amber-500/40 shadow-lg shadow-amber-500/5'
                  }`}
                >
                  <div>
                    {/* Top Status & Time */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>وصل: {logTime}</span>
                      </div>

                      {isAssigned ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>تم التسكين</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                          <span>في انتظار التسكين</span>
                        </span>
                      )}
                    </div>

                    {/* Member Details */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-500 flex items-center justify-center text-slate-950 font-black text-sm">
                        {displayName.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-black text-white">{displayName}</div>
                        <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
                          <span>{displayCode}</span>
                          {log.method === 'qr' ? (
                            <span className="text-[10px] text-teal-400 bg-teal-500/10 px-1.5 py-0.2 rounded">
                              كيو آر كود
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded">
                              يدوي
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Subscription Status & Expiration Alert (3 Accurate States) */}
                    {subInfo.status === 'expired' ? (
                      <div className="mb-3 p-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-bold flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>⚠️ اشتراك منتهي</span>
                        </div>
                        {subInfo.dateFormatted && (
                          <span className="text-[10px] text-rose-300 font-mono">
                            انتهى: {subInfo.dateFormatted}
                          </span>
                        )}
                      </div>
                    ) : subInfo.status === 'none' ? (
                      <div className="mb-3 p-2 rounded-xl bg-sky-500/15 border border-sky-500/35 text-sky-300 text-[11px] font-bold flex items-center gap-1.5">
                        <span>🆕 زائر جديد — غير مشترك من قبل</span>
                      </div>
                    ) : (
                      <div className="mb-3 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2 text-[10px] font-bold">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                            {subInfo.badgeText}
                          </span>
                          {matchingMember?.subscriptionPlan && (
                            <span className="text-emerald-200 truncate">
                              {matchingMember.subscriptionPlan}
                            </span>
                          )}
                        </div>
                        {subInfo.dateFormatted && (
                          <span className="text-slate-300 font-mono shrink-0">
                            حتى: {subInfo.dateFormatted}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Current Placement Details if assigned */}
                    {isAssigned && (
                      <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 mb-3 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">النشاط:</span>
                          <span className="font-bold text-teal-300">
                            {log.assignedCategory === 'massage'
                              ? '💆‍♂️ مساج واستشفاء'
                              : log.assignedCategory === 'physio'
                              ? '🩺 علاج طبيعي'
                              : log.assignedCategory === 'private'
                              ? '🏋️‍♂️ تدريب خاص (Private PT)'
                              : log.assignedCategory === 'group'
                              ? '👥 كلاس تدريبي جماعي'
                              : '⚡ صالة الجيم العامة'}
                          </span>
                        </div>
                        {log.assignedCoachName && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">الكابتن:</span>
                            <span className="font-bold text-white">{log.assignedCoachName}</span>
                          </div>
                        )}
                        {log.assignedSessionTitle && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">الحصة:</span>
                            <span className="text-slate-300 truncate max-w-[150px]">
                              {log.assignedSessionTitle}
                            </span>
                          </div>
                        )}
                        {/* Financial Mode Badge */}
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80">
                          <span className="text-slate-400 text-[10px]">الحساب:</span>
                          {log.paymentMode === 'coach_charge' ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>تحميل على الكابتن ({formatEGP(log.chargedAmount || 0)})</span>
                            </span>
                          ) : log.paymentMode === 'cash_drawer' ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                              <Banknote className="w-3 h-3 text-emerald-400" />
                              <span>كاش بالدرج ({formatEGP(log.chargedAmount || 0)})</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                              <Smartphone className="w-3 h-3 text-purple-400" />
                              <span>إنستاباي ({formatEGP(log.chargedAmount || 0)})</span>
                            </span>
                          )}
                        </div>

                        {/* Individual Timer / Check-Out Status */}
                        {log.assignedSessionId && (
                          <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80">
                            <span className="text-slate-400 text-[10px]">مدة التواجد:</span>
                            {log.checkOutStatus === 'checked_out' ? (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-teal-500/15 text-teal-300 border border-teal-500/30">
                                ✅ تم الخروج ({log.durationMinutes || 0} د{log.extraFeePaid ? ` • فرق +${formatEGP(log.extraFeePaid)}` : ''})
                              </span>
                            ) : (
                              <span className="text-[11px] font-mono font-black px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                <Clock className="w-3 h-3 animate-pulse" />
                                <span>{formatElapsedHMS(log.sessionStartedAt || log.timestamp, nowMs)}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Seating CTA, Check-Out & Cancel Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {isAssigned && log.assignedSessionId && log.checkOutStatus !== 'checked_out' ? (
                      <button
                        type="button"
                        onClick={() => handleManualCheckOut(log.id)}
                        className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          log.checkOutStatus === 'pending_settlement'
                            ? 'bg-rose-500 hover:bg-rose-400 text-white animate-pulse shadow-lg shadow-rose-500/30'
                            : 'bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40'
                        }`}
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>
                          {log.checkOutStatus === 'pending_settlement'
                            ? 'طلب خروج (تسوية فرق المدة)'
                            : 'تسجيل خروج اللاعب'}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openSeatingModal(log)}
                        className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          isAssigned
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                            : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-lg shadow-amber-500/20'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>{isAssigned ? 'تعديل التوجيه والتسكين' : 'تسكين وتوجيه اللاعب الآن'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCancelCheckIn(log.id, log.memberName)}
                      title="إلغاء التحضير وحذف من الحصة"
                      className="p-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 transition cursor-pointer flex items-center justify-center shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-slate-900/40 text-center text-xs text-slate-500 border border-dashed border-slate-800">
            لم يحضر أي لاعب حتى الآن اليوم. عند قيام أي لاعب بمسح الكيو آر بالأعلى يظهر اسمه هنا فورياً للتسكين والتوجيه.
          </div>
        )}
      </div>

      {/* Main Grid: Manual Entry & Simulator + Live Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Manual Search Input & QR Simulation Pill (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* 1. Manual Search Card */}
          <div className="bg-[#0f172a]/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Search className="w-4 h-4 text-teal-400" />
                <span>البحث والإدخال اليدوي لكود اللاعب</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                Manual Scan
              </span>
            </div>

            <form onSubmit={handleSearch} className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  placeholder="اكتب كود اللاعب (مثال: 102938) أو الهاتف"
                  inputMode="numeric"
                  className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3.5 pl-12 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition dir-ltr"
                />
                <button
                  type="submit"
                  className="absolute left-2.5 top-2.5 p-2 bg-teal-500 text-slate-950 rounded-xl hover:bg-teal-400 transition"
                  title="بحث"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </form>

            {/* Quick Member Codes Chips */}
            <div className="mt-4 pt-4 border-t border-slate-800/80">
              <div className="text-[11px] font-bold text-slate-400 mb-2">أكواد سريعة للتجربة:</div>
              <div className="flex flex-wrap gap-1.5">
                {members.slice(0, 4).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSearchCode(m.code);
                      setSelectedMember(m);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-[11px] font-mono text-slate-300 border border-slate-700/60 transition"
                  >
                    {m.code} - {m.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. QR Scan Simulator (Simulate member walking in and scanning desk QR) */}
          <div className="bg-[#0f172a]/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>محاكي مسح الكيو آر كود (تجربة هاتف العضو)</span>
              </h3>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              اختر أي عضو لمحاكاة قيامه بمسح الكيو آر كود الموجود على المكتب بهاتفه:
            </p>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-teal-500/40 flex items-center justify-between transition"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-teal-400 font-bold text-xs">
                      {m.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{m.name}</span>
                        {m.type === 'doctor' && (
                          <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded border border-purple-500/30">
                            طبيب
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{m.code}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleTriggerCheckIn(m, 'qr')}
                    className="px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500 text-teal-300 hover:text-slate-950 font-bold text-xs border border-teal-500/30 transition flex items-center gap-1"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>مسح وتأكيد</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Member Details Card & Status (7 Cols) */}
        <div className="lg:col-span-7">
          {selectedMember ? (
            <div className="bg-[#0f172a]/90 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-400 p-0.5">
                    <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center text-teal-300 font-black text-xl">
                      {selectedMember.name.charAt(0)}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-white">{selectedMember.name}</h3>
                      {selectedMember.type === 'doctor' ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                          <Stethoscope className="w-3.5 h-3.5" />
                          طبيب علاج طبيعي
                        </span>
                      ) : (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                          لاعب مسجل
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                      <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                        كود: {selectedMember.code}
                      </span>
                      <span>هاتف: {selectedMember.phone}</span>
                    </div>
                  </div>
                </div>

                {/* Direct Action: Toggle as Doctor */}
                <button
                  type="button"
                  onClick={() => {
                    toggleMemberAsDoctor(selectedMember.id);
                    setSelectedMember({
                      ...selectedMember,
                      type: selectedMember.type === 'doctor' ? 'member' : 'doctor',
                    });
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    selectedMember.type === 'doctor'
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                      : 'bg-slate-800 hover:bg-purple-600/20 text-purple-300 border border-purple-500/30'
                  }`}
                  title="الضغط هنا يغير حالته ليظهر في صفحة العلاج الطبيعي"
                >
                  <Stethoscope className="w-4 h-4" />
                  <span>
                    {selectedMember.type === 'doctor' ? 'معين كطبيب (نشط)' : 'تحويل كطبيب علاج طبيعي'}
                  </span>
                </button>
              </div>

              {/* Subscription details breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-center">
                  <div className="text-xs text-slate-400 mb-1 flex items-center justify-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-teal-400" />
                    <span>الأيام المتبقية</span>
                  </div>
                  <div className="text-2xl font-black text-teal-400">
                    {getSubscriptionStatus(selectedMember).remainingDays ?? selectedMember.remainingDays} يوم
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    من أصل {selectedMember.totalDays} يوم
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-center">
                  <div className="text-xs text-slate-400 mb-1 flex items-center justify-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{selectedMember.sessionCategory === 'gym' || !selectedMember.totalSessions ? 'نظام الحصص' : 'الحصص المتبقية'}</span>
                  </div>
                  <div className="text-xl font-black text-cyan-400">
                    {selectedMember.sessionCategory === 'gym' || !selectedMember.totalSessions
                      ? 'اشتراك مفتوح'
                      : `${selectedMember.remainingSessions ?? 0} حصة`}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {selectedMember.sessionCategory === 'gym' || !selectedMember.totalSessions
                      ? 'حضور يومي بدون تقييد بالحصص'
                      : `من أصل ${selectedMember.totalSessions} حصة`}
                  </div>
                </div>

                {(() => {
                  const selectedSub = resolveMemberAndSubInfo(selectedMember.id, selectedMember.code).subInfo;
                  return (
                    <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-center">
                      <div className="text-xs text-slate-400 mb-1 flex items-center justify-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>حالة الاشتراك</span>
                      </div>
                      <div
                        className={`text-sm font-bold mt-1 ${
                          selectedSub.status === 'expired'
                            ? 'text-rose-400'
                            : selectedSub.status === 'none'
                            ? 'text-sky-300'
                            : 'text-emerald-400'
                        }`}
                      >
                        {selectedSub.status === 'none'
                          ? '🆕 زائر جديد — غير مشترك من قبل'
                          : selectedSub.status === 'expired'
                          ? '⚠️ اشتراك منتهي'
                          : 'ساري وصالح'}
                      </div>
                      {selectedSub.status === 'expired' && selectedSub.dateFormatted && (
                        <div className="text-[10px] text-rose-300 mt-1">
                          انتهى: {selectedSub.dateFormatted}
                        </div>
                      )}
                      {selectedSub.isActive && selectedSub.dateFormatted && (
                        <div className="text-[10px] text-slate-400 mt-1">
                          ينتهي: {selectedSub.dateFormatted}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Plan Card */}
              <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 mb-6">
                <div className="text-xs text-slate-400 font-semibold mb-1">نوع الباقة المشترك بها:</div>
                <div className="text-base font-extrabold text-white">
                  {selectedMember.subscriptionPlan}
                </div>
                {selectedMember.notes && (
                  <div className="text-xs text-slate-400 mt-2 bg-slate-850 p-2 rounded-lg">
                    ملاحظات: {selectedMember.notes}
                  </div>
                )}
              </div>

              {/* Big Check-in Button */}
              <button
                onClick={() => handleTriggerCheckIn(selectedMember, 'manual')}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-base shadow-xl shadow-teal-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserCheck className="w-5 h-5" />
                <span>تسجيل حضور اللاعب الآن (إظهار علامة الصح وتحديث المتبقي)</span>
              </button>
            </div>
          ) : (
            <div className="bg-[#0f172a]/60 border border-dashed border-slate-800 rounded-3xl p-12 text-center h-full flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-500 mb-4">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-300">لم يتم اختيار لاعب بعد</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                اكتب كود اللاعب في خانة البحث على اليمين أو اختر أحد الأعضاء من المحاكي لعرض كافة بياناته ومتبقي اشتراكه
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Today's Live Check-in Log Table & Historical Paginated Check-In/Out Archive */}
      <div className="bg-[#0f172a]/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black text-white">
              {logViewTab === 'live' ? 'سجل الحضور اليومي الكامل (الحي)' : 'سجل الحضور والانصراف السابق'}
            </h3>
            {logViewTab === 'live' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                {checkInLogs.length} حركة تسجيل
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-2xl text-xs">
            <button
              type="button"
              onClick={() => setLogViewTab('live')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                logViewTab === 'live'
                  ? 'bg-teal-500 text-slate-950 font-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>السجل الحي لليوم (الكل ظاهر)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLogViewTab('history');
                setHistoryPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                logViewTab === 'history'
                  ? 'bg-teal-500 text-slate-950 font-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>السجل السابق (20/صفحة)</span>
            </button>
          </div>
        </div>

        {logViewTab === 'live' ? (
          checkInLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-3 px-4 font-bold">الاسم</th>
                  <th className="py-3 px-4 font-bold">كود العضو</th>
                  <th className="py-3 px-4 font-bold">طريقة الدخول</th>
                  <th className="py-3 px-4 font-bold">حالة التسكين</th>
                  <th className="py-3 px-4 font-bold">وقت الدخول</th>
                  <th className="py-3 px-4 font-bold">حالة الاشتراك</th>
                  <th className="py-3 px-4 font-bold">إجراء التسكين</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {checkInLogs.map((log) => {
                  const { member: mMember, subInfo } = resolveMemberAndSubInfo(log.memberId, log.memberCode);
                  const dispName = mMember?.name || log.memberName;
                  const dispCode = mMember?.code || log.memberCode;
                  return (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center text-xs font-bold">
                          {dispName.charAt(0)}
                        </div>
                        <span>{dispName}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">{dispCode}</td>
                    <td className="py-3 px-4">
                      {log.method === 'qr' ? (
                        <span className="px-2 py-0.5 rounded-md bg-teal-500/15 text-teal-300 border border-teal-500/30 font-medium">
                          سكان كيو آر
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                          إدخال يدوي
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {log.seatingStatus === 'assigned' ? (
                        <div className="space-y-1">
                          <span className="text-teal-400 font-semibold block">
                            مسكن: {log.assignedCategory === 'massage' ? 'مساج' : log.assignedCategory === 'physio' ? 'علاج طبيعي' : log.assignedCategory === 'private' ? 'برايفت' : log.assignedCategory === 'group' ? 'كلاس' : 'جيم'} ({log.assignedCoachName})
                          </span>
                          {log.paymentMode === 'coach_charge' ? (
                            <span className="text-[10px] text-amber-300 font-bold bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded inline-flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 text-amber-400" />
                              <span>تحميل على الكابتن ({formatEGP(log.chargedAmount || 0)})</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-300 font-bold bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded inline-flex items-center gap-1">
                              <Banknote className="w-2.5 h-2.5 text-emerald-400" />
                              <span>كاش بالدرج ({formatEGP(log.chargedAmount || 0)})</span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-amber-400 font-semibold animate-pulse">
                          في انتظار التسكين
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {new Date(log.timestamp).toLocaleTimeString('ar-EG', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </td>
                    <td className="py-3 px-4">
                      {(() => {
                        if (subInfo.status === 'expired') {
                          return (
                            <div className="space-y-0.5">
                              <span className="text-rose-400 font-black text-xs flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>⚠️ اشتراك منتهي</span>
                              </span>
                              {subInfo.dateFormatted && (
                                <span className="text-[10px] text-rose-300 font-bold block">
                                  انتهى: {subInfo.dateFormatted}
                                </span>
                              )}
                            </div>
                          );
                        }

                        if (subInfo.status === 'active') {
                          return (
                            <div className="space-y-0.5">
                              <span className="text-emerald-400 font-black text-xs flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span>ساري ({subInfo.remainingDays} يوم)</span>
                              </span>
                              {subInfo.dateFormatted && (
                                <span className="text-[10px] text-emerald-300 font-bold block">
                                  حتى: {subInfo.dateFormatted}
                                </span>
                              )}
                            </div>
                          );
                        }

                        if (subInfo.status === 'active_sessions') {
                          return (
                            <div className="space-y-0.5">
                              <span className="text-teal-400 font-black text-xs flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 shrink-0" />
                                <span>ساري بالحصة</span>
                              </span>
                              <span className="text-[10px] text-teal-300 font-bold block">
                                متبقي {subInfo.remainingSessions} حصة
                              </span>
                            </div>
                          );
                        }

                        return (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/35 text-sky-300 font-bold text-[11px]">
                            🆕 زائر جديد — غير مشترك من قبل
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openSeatingModal(log)}
                          className="px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500 text-teal-300 hover:text-slate-950 font-bold text-[11px] transition"
                        >
                          {log.seatingStatus === 'assigned' ? 'تعديل' : 'تسكين الآن'}
                        </button>
                        <button
                          onClick={() => handleCancelCheckIn(log.id, log.memberName)}
                          title="إلغاء التحضير وحذف"
                          className="p-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-500">
              لا توجد تسجيلات حضور حتى الآن لليوم.
            </div>
          )
        ) : (
          /* SERVER-SIDE PAGINATED HISTORICAL CHECK-IN / CHECK-OUT LOG */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => {
                    setHistorySearch(e.target.value);
                    setHistoryPage(1);
                  }}
                  placeholder="ابحث في قاعدة البيانات باسم اللاعب، الكود، الكابتن، أو الحصة..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 pl-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              </div>
              <input
                type="date"
                value={historyDateFilter}
                onChange={(e) => {
                  setHistoryDateFilter(e.target.value);
                  setHistoryPage(1);
                }}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-teal-500"
              />
              {historyDateFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setHistoryDateFilter('');
                    setHistoryPage(1);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-bold cursor-pointer"
                >
                  كل التواريخ
                </button>
              )}
            </div>

            {isHistoryLoading ? (
              <TableRowsSkeleton rows={6} cols={6} />
            ) : historyLogs.length > 0 ? (
              <>
                <div className="overflow-x-auto rounded-2xl border border-slate-800">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-400">
                        <th className="py-3 px-4 font-bold">اللاعب</th>
                        <th className="py-3 px-4 font-bold">الكود</th>
                        <th className="py-3 px-4 font-bold">التاريخ والدخول</th>
                        <th className="py-3 px-4 font-bold">الانصراف والمدة</th>
                        <th className="py-3 px-4 font-bold">النشاط والكابتن</th>
                        <th className="py-3 px-4 font-bold">المبلغ المحصل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {historyLogs.map((hLog) => (
                        <tr key={hLog.id} className="hover:bg-slate-800/30 transition">
                          <td className="py-3 px-4 font-bold text-white">{hLog.memberName}</td>
                          <td className="py-3 px-4 font-mono text-cyan-400">{hLog.memberCode}</td>
                          <td className="py-3 px-4 font-mono text-slate-300">
                            {new Date(hLog.timestamp).toLocaleString('ar-EG')}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-300">
                            {hLog.checkOutTime ? (
                              <span>
                                {new Date(hLog.checkOutTime).toLocaleTimeString('ar-EG', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                                {hLog.durationMinutes ? ` (${hLog.durationMinutes} د)` : ''}
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {hLog.assignedSessionTitle || hLog.assignedCategory || '—'}
                            {hLog.assignedCoachName ? ` (${hLog.assignedCoachName})` : ''}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                            {formatEGP((hLog.chargedAmount || 0) + (hLog.extraFeePaid || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <PaginationBar
                  currentPage={historyPage}
                  totalPages={historyTotalPages}
                  totalCount={historyTotalCount}
                  pageSize={20}
                  onPageChange={setHistoryPage}
                  isLoading={isHistoryLoading}
                  label="سجل حضور وانصراف"
                />
              </>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500">
                لا توجد سجلات حضور وانصراف مطابقة للبحث.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Desk QR Modal for Print */}
      <DeskQRCodeModal
        isOpen={isDeskQRModalOpen}
        onClose={() => setIsDeskQRModalOpen(false)}
      />

      {/* 2-Step Check-in Modal (Big Green Checkmark -> Details) */}
      <CheckInModal
        member={checkedInMember}
        isOpen={isCheckInModalOpen}
        onClose={() => setIsCheckInModalOpen(false)}
        onToggleDoctor={(id) => toggleMemberAsDoctor(id)}
      />

      {/* SEATING & ROUTING MODAL (تسكين وتوجيه اللاعب: مساج / برايفت / كلاس / جيم + اختيار الكابتن) */}
      {isSeatingModalOpen && selectedLogForSeating && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto" dir="rtl">
          <div className="bg-[#0f172a] border border-teal-500/40 rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl relative max-h-[88vh] flex flex-col my-auto overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-teal-500/20 text-teal-400">
                  <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">تسكين وتوجيه اللاعب بالصالة</h3>
                  <p className="text-xs text-teal-300 font-bold">
                    اللاعب: {selectedLogForSeating.memberName} ({selectedLogForSeating.memberCode})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsSeatingModalOpen(false);
                  setSelectedLogForSeating(null);
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            {(() => {
              const { member: targetMember, subInfo } = resolveMemberAndSubInfo(
                selectedLogForSeating.memberId,
                selectedLogForSeating.memberCode
              );
              const isSubscribed = subInfo.isActive;

              return (
                <form onSubmit={handleConfirmSeating} className="flex flex-col flex-1 overflow-hidden min-h-0 pt-3">
                  <div className="overflow-y-auto flex-1 space-y-4 pr-1 pl-1">
                    {/* Member Status Badge */}
                    {subInfo.status === 'active' && (
                      <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-1.5 animate-scale-up">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-black text-emerald-300">
                              اشتراك ساري: {targetMember?.subscriptionPlan || 'اشتراك صالة'}
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                            متبقي {subInfo.remainingDays} يوم
                          </span>
                        </div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>📅 صلاحية الاشتراك:</span>
                          <span className="text-emerald-300 font-extrabold">{subInfo.fullText}</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed pt-0.5">
                          ✓ يمكن للمتدرب الدخول لتمرين حر مجاناً باشتراكه، أو يمكنك تسكينه في حصة خاصة / برايفت / مساج مع اختيار طريقة الحساب (على الكابتن أو بالاستقبال مع نسبة للكابتن).
                        </p>
                      </div>
                    )}

                    {subInfo.status === 'active_sessions' && (
                      <div className="p-3.5 rounded-2xl bg-teal-950/40 border border-teal-500/40 space-y-1 animate-scale-up">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-teal-400" />
                            <span className="text-xs font-black text-teal-300">
                              اشتراك حصص ساري: {targetMember?.subscriptionPlan}
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-teal-300 bg-teal-500/20 px-2.5 py-0.5 rounded-full border border-teal-500/30">
                            متبقي {subInfo.remainingSessions} حصة
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          ✓ {subInfo.fullText}
                        </p>
                      </div>
                    )}

                    {subInfo.status === 'expired' && (
                      <div className="p-3.5 rounded-2xl bg-rose-950/40 border-2 border-rose-500/50 space-y-1.5 animate-scale-up">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-400" />
                            <span className="text-xs font-black text-rose-300">
                              ⚠️ تنبيه: اشتراك اللاعب منتهي!
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-rose-300 bg-rose-500/20 px-2.5 py-0.5 rounded-full border border-rose-500/40">
                            منتهي الصلاحية
                          </span>
                        </div>
                        <div className="text-xs font-bold text-white">
                          اللاعب انتهى اشتراكه بتاريخ: <strong className="text-rose-300 font-extrabold">{subInfo.dateFormatted || 'سابقاً'}</strong>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          يرجى عمل وتفعيل اشتراك جديد للاعب الآن من مسار "تمرين حر" بالأسفل أو تحصيل تذكرة يومية، أو تسكينه في حصة كابتن.
                        </p>
                      </div>
                    )}

                    {subInfo.status === 'none' && (
                      <div className="p-3.5 rounded-2xl bg-sky-950/40 border border-sky-500/40 space-y-1 animate-scale-up">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-sky-300">
                              🆕 زائر جديد — غير مشترك من قبل
                            </span>
                          </div>
                          <span className="text-[11px] text-sky-300 font-bold bg-sky-500/20 px-2.5 py-0.5 rounded-full border border-sky-500/30">
                            زائر جديد
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          لم يسبق لهذا الزائر الاشتراك في الجيم من قبل. يمكن عمل وتفعيل اشتراك جديد فوراً من خيار "تمرين حر" بالأسفل وتوريد المبلغ بالدرج أو إنستاباي.
                        </p>
                      </div>
                    )}

                    {/* 1. The 3 Primary Pathways Selector */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-2.5">
                        اختر مسار توجيه اللاعب والمحاسبة المالية (3 مسارات رئيسية):
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Pathway 1: Coach Debt */}
                        <button
                          type="button"
                          onClick={() =>
                            setSeatingForm((prev) => ({
                              ...prev,
                              pathway: 'coach_debt',
                              sessionId: prev.sessionId || (sessions[0]?.id || ''),
                              coachId: prev.sessionId
                                ? sessions.find((s) => s.id === prev.sessionId)?.coachIds[0] || prev.coachId
                                : sessions[0]?.coachIds[0] || prev.coachId,
                            }))
                          }
                          className={`p-3.5 rounded-2xl border text-right transition flex flex-col justify-between gap-2 cursor-pointer ${
                            seatingForm.pathway === 'coach_debt'
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/50'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                              <Flame className="w-5 h-5" />
                            </div>
                            <div className="text-xs font-black">1. الحساب على الكابتن</div>
                          </div>
                          <div className="text-[11px] text-slate-400 leading-relaxed">
                            اللاعب داخل حصة مع الكابتن، والفلوس تتحمل كمديونية على الكابتن بعد نهاية الحصة.
                          </div>
                        </button>

                        {/* Pathway 2: Gym Collected with Coach Share */}
                        <button
                          type="button"
                          onClick={() =>
                            setSeatingForm((prev) => ({
                              ...prev,
                              pathway: 'gym_with_coach_share',
                              sessionId: prev.sessionId || (sessions[0]?.id || ''),
                              coachId: prev.sessionId
                                ? sessions.find((s) => s.id === prev.sessionId)?.coachIds[0] || prev.coachId
                                : sessions[0]?.coachIds[0] || prev.coachId,
                              amount: prev.amount || (sessions[0]?.price || 150),
                            }))
                          }
                          className={`p-3.5 rounded-2xl border text-right transition flex flex-col justify-between gap-2 cursor-pointer ${
                            seatingForm.pathway === 'gym_with_coach_share'
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/50'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                              <Banknote className="w-5 h-5" />
                            </div>
                            <div className="text-xs font-black">2. الدفع للجيم (للكابتن نسبة)</div>
                          </div>
                          <div className="text-[11px] text-slate-400 leading-relaxed">
                            اللاعب يدفع للجيم بالاستقبال، وللكابتن نسبة أو قيمة ثابتة (الكابتن ليه فلوس).
                          </div>
                        </button>

                        {/* Pathway 3: Direct Gym / No Coach */}
                        <button
                          type="button"
                          onClick={() =>
                            setSeatingForm((prev) => ({
                              ...prev,
                              pathway: 'gym_direct_no_coach',
                              sessionId: '',
                              coachId: '',
                              amount: isSubscribed ? 0 : 80,
                            }))
                          }
                          className={`p-3.5 rounded-2xl border text-right transition flex flex-col justify-between gap-2 cursor-pointer ${
                            seatingForm.pathway === 'gym_direct_no_coach'
                              ? 'bg-teal-500/20 border-teal-500 text-teal-300 font-bold shadow-lg shadow-teal-500/10 ring-1 ring-teal-500/50'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 shrink-0">
                              <Dumbbell className="w-5 h-5" />
                            </div>
                            <div className="text-xs font-black">3. تمرين حر (بدون مدرب)</div>
                          </div>
                          <div className="text-[11px] text-slate-400 leading-relaxed">
                            اللاعب يتمرن مع نفسه بصالة الجيم (اشتراك ساري أو دفع مباشر)، 100% للجيم بدون كابتن.
                          </div>
                        </button>
                      </div>
                    </div>

                {/* Details Section for Pathway 1: Coach Debt */}
                {seatingForm.pathway === 'coach_debt' && (
                  <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-3 animate-scale-up">
                    <label className="block text-xs font-black text-amber-300 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-amber-400" />
                      <span>اختر الحصة التدريبية لتسكين اللاعب بها:</span>
                    </label>

                    {sessions.length > 0 ? (
                      <select
                        required
                        value={seatingForm.sessionId}
                        onChange={(e) => {
                          const sId = e.target.value;
                          const targetSess = sessions.find((s) => s.id === sId);
                          const targetCoach = targetSess?.coachIds[0]
                            ? coaches.find((c) => c.id === targetSess.coachIds[0])
                            : coaches[0];
                          setSeatingForm((prev) => ({
                            ...prev,
                            sessionId: sId,
                            coachId: targetCoach?.id || prev.coachId,
                            amount: targetSess?.price || prev.amount,
                          }));
                        }}
                        className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3.5 py-3 text-xs font-bold text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                      >
                        <option value="">-- اضغط لاختيار الحصة المجدولة --</option>
                        {sessions.map((s) => {
                          const coachNames = s.coachIds
                            .map((cid) => coaches.find((c) => c.id === cid)?.name)
                            .filter(Boolean)
                            .join('، ');
                          return (
                            <option key={s.id} value={s.id}>
                              {s.title} ({s.sport}) {coachNames ? `- كابتن: ${coachNames}` : ''} {s.hall ? `[${s.hall}]` : ''} - سعر التذكرة: {s.price} ج.م
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-amber-300">
                        لا توجد حصص مضافة حالياً. يرجى إضافة حصص جديدة من صفحة الحصص أولاً.
                      </div>
                    )}

                    {seatingForm.sessionId && (
                      <div className="p-3 rounded-xl bg-slate-900/80 border border-amber-500/20 text-xs text-slate-300 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">الحصة المحددة:</span>
                          <span className="font-bold text-amber-300">
                            {sessions.find((s) => s.id === seatingForm.sessionId)?.title}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">الكابتن المسؤول:</span>
                          <span className="font-bold text-white">
                            {coaches.find((c) => c.id === seatingForm.coachId)?.name || 'الكابتن المسؤول'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">قيمة تذكرة الحصة:</span>
                          <span className="font-bold text-teal-400">
                            {formatEGP(sessions.find((s) => s.id === seatingForm.sessionId)?.price || 0)}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        سيتم تسكين اللاعب فوراً في الحصة ويظهر اسمه بصفحة الحصص، والتحميل المالي كمديونية على الكابتن يُحسب تلقائياً فقط عند بدء وإنهاء الحصة رسمياً.
                      </span>
                    </div>
                  </div>
                )}

                {/* Details Section for Pathway 2: Gym Collected with Coach Share */}
                {seatingForm.pathway === 'gym_with_coach_share' && (
                  <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-4 animate-scale-up">
                    <div>
                      <label className="block text-xs font-black text-emerald-300 mb-1.5 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-emerald-400" />
                        <span>اختر الحصة التدريبية:</span>
                      </label>
                      <select
                        required
                        value={seatingForm.sessionId}
                        onChange={(e) => {
                          const sId = e.target.value;
                          const targetSess = sessions.find((s) => s.id === sId);
                          const targetCoach = targetSess?.coachIds[0]
                            ? coaches.find((c) => c.id === targetSess.coachIds[0])
                            : coaches[0];
                          const newPrice = targetSess?.price || 150;
                          setSeatingForm((prev) => ({
                            ...prev,
                            sessionId: sId,
                            coachId: targetCoach?.id || prev.coachId,
                            amount: newPrice,
                            coachShareType: targetCoach?.paymentType === 'percentage' ? 'percentage' : prev.coachShareType,
                            coachShareValue:
                              targetCoach?.paymentType === 'percentage'
                                ? targetCoach.commissionRate || 40
                                : targetCoach?.ratePerSession || 50,
                          }));
                        }}
                        className="w-full bg-slate-900 border border-emerald-500/40 rounded-xl px-3.5 py-3 text-xs font-bold text-white focus:outline-none focus:border-emerald-400 cursor-pointer"
                      >
                        <option value="">-- اضغط لاختيار الحصة من القائمة --</option>
                        {sessions.map((s) => {
                          const coachNames = s.coachIds
                            .map((cid) => coaches.find((c) => c.id === cid)?.name)
                            .filter(Boolean)
                            .join('، ');
                          return (
                            <option key={s.id} value={s.id}>
                              {s.title} ({s.sport}) {coachNames ? `- كابتن: ${coachNames}` : ''} - سعر: {s.price} ج.م
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Amount Paid at Reception */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          المبلغ المطلوب تحصيله بالاستقبال (ج.م):
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            required
                            value={seatingForm.amount}
                            onChange={(e) =>
                              setSeatingForm({ ...seatingForm, amount: Number(e.target.value) })
                            }
                            className="w-full bg-slate-900 border border-emerald-500/40 rounded-xl px-3 py-2 text-xs font-black font-mono text-emerald-400 focus:outline-none focus:border-emerald-400"
                          />
                          <span className="absolute left-2.5 top-2 text-[10px] text-slate-500 font-bold">
                            ج.م
                          </span>
                        </div>
                      </div>

                      {/* Payment Method: Cash vs InstaPay */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          طريقة التحصيل بالاستقبال:
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSeatingForm({ ...seatingForm, paymentMode: 'cash_drawer' })}
                            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                              seatingForm.paymentMode !== 'instapay'
                                ? 'bg-emerald-500 text-slate-950 border-emerald-500 font-black shadow'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                          >
                            <Banknote className="w-3.5 h-3.5" />
                            <span>كاش بالدرج</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSeatingForm({ ...seatingForm, paymentMode: 'instapay' })}
                            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                              seatingForm.paymentMode === 'instapay'
                                ? 'bg-indigo-500 text-white border-indigo-500 font-black shadow'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>إنستاباي</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Coach Share Calculation Method */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        طريقة حساب نصيب ومستحقات الكابتن:
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSeatingForm({ ...seatingForm, coachShareType: 'fixed', coachShareValue: 50 })}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                            seatingForm.coachShareType === 'fixed'
                              ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}
                        >
                          قيمة ثابتة (ج.م)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSeatingForm({ ...seatingForm, coachShareType: 'percentage', coachShareValue: 40 })}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                            seatingForm.coachShareType === 'percentage'
                              ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}
                        >
                          نسبة مئوية (%)
                        </button>
                      </div>
                      <div className="mt-1.5 relative">
                        <input
                          type="number"
                          min="0"
                          max={seatingForm.coachShareType === 'percentage' ? 100 : undefined}
                          required
                          value={seatingForm.coachShareValue}
                          onChange={(e) =>
                            setSeatingForm({
                              ...seatingForm,
                              coachShareValue: Number(e.target.value),
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-400"
                        />
                        <span className="absolute left-2.5 top-1.5 text-[10px] text-slate-500 font-bold">
                          {seatingForm.coachShareType === 'percentage' ? '%' : 'ج.م'}
                        </span>
                      </div>
                    </div>

                    {/* Instant Live Split Preview */}
                    {(() => {
                      const totalPaid = Number(seatingForm.amount) || 0;
                      const coachCut =
                        seatingForm.coachShareType === 'fixed'
                          ? Math.min(totalPaid, Number(seatingForm.coachShareValue) || 0)
                          : Math.round((totalPaid * (Number(seatingForm.coachShareValue) || 0)) / 100);
                      const gymCut = Math.max(0, totalPaid - coachCut);

                      return (
                        <div className="p-3 rounded-xl bg-slate-900/90 border border-emerald-500/30 text-xs space-y-1.5">
                          <div className="text-[11px] font-black text-emerald-400 mb-1">
                            ملخص التوزيع المالي الفوري للحركة:
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-300">
                              {seatingForm.paymentMode === 'instapay' ? '📱 إجمالي تحويل إنستاباي:' : '💵 إجمالي الكاش الوارد للدرج:'}
                            </span>
                            <span className="font-bold text-emerald-300">{formatEGP(totalPaid)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-300">👤 نصيب ومستحقات الكابتن (له فلوس):</span>
                            <span className="font-bold text-amber-300">{formatEGP(coachCut)}</span>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                            <span className="text-slate-300">🏢 صافي إيراد الجيم:</span>
                            <span className="font-bold text-teal-400">{formatEGP(gymCut)}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Details Section for Pathway 3: Direct Gym / No Coach */}
                {seatingForm.pathway === 'gym_direct_no_coach' && (
                  <div className="p-4 rounded-2xl bg-teal-950/20 border border-teal-500/30 space-y-4 animate-scale-up">
                    <label className="block text-xs font-black text-teal-300">
                      طبيعة اشتراك أو دخول اللاعب للصالة:
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Choice 1: Existing Subscription */}
                      <button
                        type="button"
                        onClick={() =>
                          setSeatingForm((prev) => ({
                            ...prev,
                            directEntryType: 'existing_sub',
                            isDirectPaid: false,
                            amount: 0,
                          }))
                        }
                        className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between gap-1 ${
                          seatingForm.directEntryType === 'existing_sub'
                            ? 'bg-teal-500/20 border-teal-500 text-teal-300 font-bold ring-1 ring-teal-500/50'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-black">1. باشتراكه الساري</div>
                        <div className="text-[10px] text-slate-400">0.00 ج.م كاش (مخصوم من اشتراكه)</div>
                      </button>

                      {/* Choice 2: Single Pass */}
                      <button
                        type="button"
                        onClick={() =>
                          setSeatingForm((prev) => ({
                            ...prev,
                            directEntryType: 'single_pass',
                            isDirectPaid: true,
                            amount: prev.amount > 0 ? prev.amount : 80,
                          }))
                        }
                        className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between gap-1 ${
                          seatingForm.directEntryType === 'single_pass'
                            ? 'bg-teal-500/20 border-teal-500 text-teal-300 font-bold ring-1 ring-teal-500/50'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-black">2. تذكرة يومية / Single</div>
                        <div className="text-[10px] text-slate-400">دخول لمرة واحدة اليوم</div>
                      </button>

                      {/* Choice 3: New / Renew Subscription */}
                      <button
                        type="button"
                        onClick={() =>
                          setSeatingForm((prev) => ({
                            ...prev,
                            directEntryType: 'new_subscription',
                            isDirectPaid: true,
                            amount: prev.subFee || 500,
                          }))
                        }
                        className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between gap-1 ${
                          seatingForm.directEntryType === 'new_subscription'
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold ring-1 ring-emerald-500/50 shadow-md shadow-emerald-500/10'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-black flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-emerald-400" />
                          <span>3. عمل / تجديد اشتراك</span>
                        </div>
                        <div className="text-[10px] text-slate-400">تفعيل اشتراك فوري وتوريد للمالية</div>
                      </button>
                    </div>

                    {/* Section for Single Pass */}
                    {seatingForm.directEntryType === 'single_pass' && (
                      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-teal-500/20 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-300 mb-1">
                              سعر التذكرة اليومية (ج.م):
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                required
                                value={seatingForm.amount}
                                onChange={(e) =>
                                  setSeatingForm({ ...seatingForm, amount: Number(e.target.value) })
                                }
                                className="w-full bg-slate-900 border border-teal-500/40 rounded-xl px-3 py-2 text-xs font-black font-mono text-teal-400 focus:outline-none focus:border-teal-400"
                              />
                              <span className="absolute left-2.5 top-2 text-[10px] text-slate-500 font-bold">
                                ج.م
                              </span>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-300 mb-1">
                              طريقة التحصيل:
                            </label>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSeatingForm({ ...seatingForm, paymentMode: 'cash_drawer' })}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                                  seatingForm.paymentMode !== 'instapay'
                                    ? 'bg-teal-500 text-slate-950 border-teal-500 font-black'
                                    : 'bg-slate-900 text-slate-400 border-slate-800'
                                }`}
                              >
                                <Banknote className="w-3.5 h-3.5" />
                                <span>كاش بالدرج</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSeatingForm({ ...seatingForm, paymentMode: 'instapay' })}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                                  seatingForm.paymentMode === 'instapay'
                                    ? 'bg-indigo-500 text-white border-indigo-500 font-black'
                                    : 'bg-slate-900 text-slate-400 border-slate-800'
                                }`}
                              >
                                <Smartphone className="w-3.5 h-3.5" />
                                <span>إنستاباي</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Section for New / Renew Subscription */}
                    {seatingForm.directEntryType === 'new_subscription' && (
                      <div className="p-4 rounded-xl bg-slate-900/90 border border-emerald-500/40 space-y-3.5">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4" />
                            <span>بيانات الاشتراك وتفاصيل التحصيل المالي:</span>
                          </div>
                          {seatingForm.isSubAlreadyRenewed && (
                            <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              <span>تم التحصيل والتفعيل مسبقاً</span>
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Plan Name */}
                          <div>
                            <label className="block text-[11px] font-bold text-slate-300 mb-1">
                              اسم الباقة / نوع الاشتراك:
                            </label>
                            <input
                              type="text"
                              required
                              value={seatingForm.subPlanName}
                              onChange={(e) => setSeatingForm({ ...seatingForm, subPlanName: e.target.value })}
                              placeholder="مثال: اشتراك شهري صالة الجيم"
                              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-emerald-400"
                            />
                          </div>

                          {/* Duration Days */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-bold text-slate-300">
                                المدة (بالأيام):
                              </label>
                              <div className="flex items-center gap-1">
                                {[30, 60, 90].map((d) => (
                                  <button
                                    key={d}
                                    type="button"
                                    onClick={() => setSeatingForm({ ...seatingForm, subDurationDays: d })}
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                                      seatingForm.subDurationDays === d
                                        ? 'bg-emerald-500 text-slate-950'
                                        : 'bg-slate-800 text-slate-400 hover:text-white'
                                    }`}
                                  >
                                    {d} يوم
                                  </button>
                                ))}
                              </div>
                            </div>
                            <input
                              type="number"
                              min="1"
                              required
                              value={seatingForm.subDurationDays}
                              onChange={(e) =>
                                setSeatingForm({ ...seatingForm, subDurationDays: Number(e.target.value) })
                              }
                              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-400"
                            />
                          </div>

                          {/* Subscription Fee */}
                          <div>
                            <label className="block text-[11px] font-bold text-slate-300 mb-1">
                              سعر الاشتراك المطلوب تحصيله (ج.م):
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                required
                                value={seatingForm.subFee}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setSeatingForm({ ...seatingForm, subFee: val, amount: val });
                                }}
                                className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl px-3 py-2 text-xs font-black font-mono text-emerald-400 focus:outline-none focus:border-emerald-400"
                              />
                              <span className="absolute left-2.5 top-2 text-[10px] text-slate-500 font-bold">
                                ج.م
                              </span>
                            </div>
                          </div>

                          {/* Payment Method: Cash vs InstaPay */}
                          <div>
                            <label className="block text-[11px] font-bold text-slate-300 mb-1">
                              طريقة تحصيل الاشتراك:
                            </label>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSeatingForm({ ...seatingForm, subPaymentMethod: 'cash' })}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                                  seatingForm.subPaymentMethod === 'cash'
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-500 font-black shadow-md'
                                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                <Banknote className="w-3.5 h-3.5" />
                                <span>كاش بالدرج</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSeatingForm({ ...seatingForm, subPaymentMethod: 'instapay' })}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                                  seatingForm.subPaymentMethod === 'instapay'
                                    ? 'bg-indigo-500 text-white border-indigo-500 font-black shadow-md'
                                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                <Smartphone className="w-3.5 h-3.5" />
                                <span>إنستاباي (InstaPay)</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Action Button: تم التحصيل وتفعيل الاشتراك فوراً */}
                        <div className="pt-2 border-t border-slate-800 flex items-center gap-3">
                          <button
                            type="button"
                            disabled={seatingForm.isSubAlreadyRenewed}
                            onClick={async () => {
                              if (!selectedLogForSeating) return;
                              try {
                                await renewMemberSubscription(
                                  selectedLogForSeating.memberId,
                                  seatingForm.subPlanName,
                                  Number(seatingForm.subDurationDays) || 30,
                                  Number(seatingForm.subFee) || 0,
                                  seatingForm.subPaymentMethod,
                                  `اشتراك صالة فوري من شاشة التسكين (${seatingForm.subPlanName})`
                                );
                                setSeatingForm((prev) => ({ ...prev, isSubAlreadyRenewed: true }));
                                sounds.playCashRegister();
                                alert(`✓ تم تسجيل تحصيل مبلغ ${formatEGP(seatingForm.subFee)} بنجاح (${seatingForm.subPaymentMethod === 'cash' ? 'كاش بالدرج' : 'تحويل إنستاباي'}) وتفعيل اشتراك ${seatingForm.subDurationDays} يوم للاعب! وتم ترحيل الحركة للتقرير واليومية.`);
                              } catch (err: any) {
                                alert(err?.message || 'تعذر الاتصال بقاعدة البيانات');
                              }
                            }}
                            className={`flex-1 py-2.5 px-4 rounded-xl font-black text-xs transition cursor-pointer flex items-center justify-center gap-2 ${
                              seatingForm.isSubAlreadyRenewed
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40 cursor-not-allowed opacity-80'
                                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/20'
                            }`}
                          >
                            {seatingForm.isSubAlreadyRenewed ? (
                              <>
                                <Check className="w-4 h-4" />
                                <span>تم التحصيل وتفعيل الاشتراك بنجاح ✓</span>
                              </>
                            ) : (
                              <>
                                <Banknote className="w-4 h-4" />
                                <span>تم التحصيل وتفعيل الاشتراك ({formatEGP(seatingForm.subFee)})</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-[11px] text-teal-200">
                      💡 تمرين حر بأجهزة وأوزان الجيم لحساب الجيم مباشرة بدون أي مدرب، وتُسجل كافة الإيرادات مباشرة بحسابات اليومية والتقارير الشهرية.
                    </div>
                  </div>
                )}

                {/* Optional Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    ملاحظات إضافية (اختياري):
                  </label>
                  <input
                    type="text"
                    value={seatingForm.notes}
                    onChange={(e) => setSeatingForm({ ...seatingForm, notes: e.target.value })}
                    placeholder="أي ملاحظات خاصة بالتسكين..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Modal Fixed Footer Actions */}
              <div className="flex items-center gap-3 pt-4 mt-3 border-t border-slate-800 shrink-0">
                <button
                  type="submit"
                  disabled={isSubmittingSeating}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-teal-500/20 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmittingSeating ? 'جارِ تأكيد التسكين والتوجيه...' : 'تأكيد التسكين والتوجيه فوراً'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSeatingModalOpen(false);
                    setSelectedLogForSeating(null);
                  }}
                  className="py-3 px-5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          );
        })()}
          </div>
        </div>
      )}


      {/* Add New Member Modal */}
      {isAddMemberModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-black text-white mb-2 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-teal-400" />
              <span>تسجيل عضو / لاعب جديد (اشتراك الجيم)</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              يمكنك ربط الاشتراك بالكابتن المحصّل أو الخزينة مع تحديد نوع الجلسة والتسكين
            </p>

            <form onSubmit={handleCreateMember} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">الاسم الكامل للاعب</label>
                <input
                  type="text"
                  required
                  value={newMemberForm.name}
                  onChange={(e) => setNewMemberForm({ ...newMemberForm, name: e.target.value })}
                  placeholder="مثال: أحمد عبد الله"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">كود العضو</label>
                  <input
                    type="text"
                    required
                    value={newMemberForm.code}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, code: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-teal-500 dir-ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">رقم الهاتف</label>
                  <input
                    type="text"
                    value={newMemberForm.phone}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, phone: e.target.value })}
                    placeholder="010..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 dir-ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">خطة الاشتراك</label>
                  <input
                    type="text"
                    value={newMemberForm.subscriptionPlan}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, subscriptionPlan: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">قيمة الاشتراك (ج.م)</label>
                  <input
                    type="number"
                    min="0"
                    value={newMemberForm.subscriptionFee}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, subscriptionFee: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-teal-400 font-bold focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Financial Collection Flow (Small Gym Model) */}
              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-white flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-teal-300">
                    <Banknote className="w-4 h-4" />
                    <span>طريقة تحصيل الاشتراك (حسابات الكباتن والدرج):</span>
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <label
                    className={`p-2.5 rounded-xl border text-center cursor-pointer transition flex flex-col items-center gap-1 ${
                      newMemberForm.paymentMethod === 'coach_collected'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="coach_collected"
                      checked={newMemberForm.paymentMethod === 'coach_collected'}
                      onChange={() => setNewMemberForm({ ...newMemberForm, paymentMethod: 'coach_collected' })}
                      className="sr-only"
                    />
                    <span>مع الكابتن</span>
                    <span className="text-[9px] opacity-80">(مديونية للجيم)</span>
                  </label>

                  <label
                    className={`p-2.5 rounded-xl border text-center cursor-pointer transition flex flex-col items-center gap-1 ${
                      newMemberForm.paymentMethod === 'cash'
                        ? 'bg-teal-500/20 border-teal-500 text-teal-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cash"
                      checked={newMemberForm.paymentMethod === 'cash'}
                      onChange={() => setNewMemberForm({ ...newMemberForm, paymentMethod: 'cash' })}
                      className="sr-only"
                    />
                    <span>خزينة الجيم</span>
                    <span className="text-[9px] opacity-80">(نقداً بالدرج)</span>
                  </label>

                  <label
                    className={`p-2.5 rounded-xl border text-center cursor-pointer transition flex flex-col items-center gap-1 ${
                      newMemberForm.paymentMethod === 'instapay'
                        ? 'bg-purple-500/20 border-purple-500 text-purple-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="instapay"
                      checked={newMemberForm.paymentMethod === 'instapay'}
                      onChange={() => setNewMemberForm({ ...newMemberForm, paymentMethod: 'instapay' })}
                      className="sr-only"
                    />
                    <span>إنستاباي</span>
                    <span className="text-[9px] opacity-80">(محفظة إلكترونية)</span>
                  </label>
                </div>

                {newMemberForm.paymentMethod === 'coach_collected' && (
                  <div>
                    <label className="block text-xs font-bold text-amber-300 mb-1">
                      اختر الكابتن المحصّل (سيتم تحميل المبلغ كمديونية عليه):
                    </label>
                    <select
                      value={newMemberForm.collectedByCoachId}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, collectedByCoachId: e.target.value })}
                      required={newMemberForm.paymentMethod === 'coach_collected'}
                      className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value="">-- اختر الكابتن الذي استلم الاشتراك من اللاعب --</option>
                      {coaches.map((t: Coach) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.specialty})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Activity Category & Session Placement */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">نوع النشاط (القسم)</label>
                  <select
                    value={newMemberForm.sessionCategory}
                    onChange={(e) =>
                      setNewMemberForm({
                        ...newMemberForm,
                        sessionCategory: e.target.value as SessionCategory,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="gym">جيم عام (Gym)</option>
                    <option value="private">تدريب خاص (Private PT)</option>
                    <option value="group">كلاس جماعي (Group Class)</option>
                    <option value="physio">علاج طبيعي وتأهيل (Physio)</option>
                    <option value="massage">مساج واستشفاء (Massage)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">التصنيف الأساسي</label>
                  <select
                    value={newMemberForm.type}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, type: e.target.value as 'member' | 'doctor' })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="member">لاعب عادي (كلاسات وتدريب)</option>
                    <option value="doctor">طبيب علاج طبيعي</option>
                  </select>
                </div>
              </div>

              {/* Optional Session Enrollment with Permanent vs Temporary */}
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  تسكين اللاعب في حصة حالية (اختياري):
                </label>
                <select
                  value={newMemberForm.assignedSessionId}
                  onChange={(e) => setNewMemberForm({ ...newMemberForm, assignedSessionId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="">-- بدون تسكين الآن --</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.startTime} - {s.endTime})
                    </option>
                  ))}
                </select>

                {newMemberForm.assignedSessionId && (
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-slate-400">طبيعة التسكين:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setNewMemberForm({ ...newMemberForm, isTemporaryEnrollment: false })}
                        className={`px-3 py-1 rounded-lg font-bold transition ${
                          !newMemberForm.isTemporaryEnrollment
                            ? 'bg-teal-500 text-slate-950'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        تسكين دائم
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewMemberForm({ ...newMemberForm, isTemporaryEnrollment: true })}
                        className={`px-3 py-1 rounded-lg font-bold transition ${
                          newMemberForm.isTemporaryEnrollment
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        مؤقت لليوم
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className={`grid gap-3 ${newMemberForm.sessionCategory !== 'gym' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">عدد الأيام</label>
                  <input
                    type="number"
                    value={newMemberForm.totalDays}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, totalDays: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                {newMemberForm.sessionCategory !== 'gym' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">عدد الحصص المتاحة</label>
                    <input
                      type="number"
                      min="1"
                      value={newMemberForm.totalSessions}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, totalSessions: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  disabled={isSubmittingMember}
                  className="flex-1 py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingMember ? 'جارِ حفظ وتسجيل الاشتراك...' : 'حفظ وتسجيل الاشتراك'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddMemberModalOpen(false)}
                  className="py-3 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-700"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Check-Out Duration Settlement Modal */}
      <CheckOutSettlementModal
        checkInLogId={settlementLogId}
        onClose={() => setSettlementLogId(null)}
        onCompleted={(msg) => alert(msg)}
      />
    </div>
  );
};
