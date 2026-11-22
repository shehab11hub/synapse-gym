import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle,
  QrCode,
  Search,
  Calendar,
  Clock,
  ShieldCheck,
  UserCheck,
  AlertCircle,
  Dumbbell,
  ArrowRight,
  Zap,
  UserPlus,
  RefreshCw,
  LogOut,
  Sparkles,
  Lock,
  Key,
  X,
  Phone,
} from 'lucide-react';
import { useGymData, generateUniqueMemberCode } from '../context/GymDataContext';
import { useAuth } from '../context/AuthContext';
import { Member, SessionCategory } from '../types';
import { formatDateAr, formatArabicDayMonth, getSubscriptionStatus } from '../utils/formatters';
import { sounds } from '../utils/sound';

const STORAGE_MEMBER_ID = 'synapse_member_id';
const STORAGE_AUTH_TOKEN = 'synapse_auth_token';
const STORAGE_PLAYER_IDENTITY = 'synapse_player_identity';
const STORAGE_CONSUMED_TOKENS = 'synapse_consumed_scan_tokens';

// Helper to determine if current visit is a fresh physical QR scan vs history/bookmark reopen
const isScanFreshAndUnconsumed = (): boolean => {
  try {
    const params = new URLSearchParams(window.location.search);
    const kioskToken = params.get('kioskToken') || params.get('scanToken');
    const timestampStr = params.get('t') || params.get('time');
    const isDesk = params.get('desk') === 'true';

    // If there are no scan query parameters, this is opened from browser history, home screen or refresh
    if (!kioskToken && !timestampStr && !isDesk) {
      return false;
    }

    const consumedRaw = localStorage.getItem(STORAGE_CONSUMED_TOKENS);
    const consumedList: string[] = consumedRaw ? JSON.parse(consumedRaw) : [];

    if (kioskToken && consumedList.includes(kioskToken)) {
      return false; // Token already consumed by a prior scan
    }

    if (timestampStr) {
      const t = Number(timestampStr);
      // Valid for 5 minutes (300,000 ms)
      if (isNaN(t) || Date.now() - t > 300000) {
        return false;
      }
      if (consumedList.includes(`time-${t}`)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
};

const markScanAsConsumed = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const kioskToken = params.get('kioskToken') || params.get('scanToken');
    const timestampStr = params.get('t') || params.get('time');

    const consumedRaw = localStorage.getItem(STORAGE_CONSUMED_TOKENS);
    const consumedList: string[] = consumedRaw ? JSON.parse(consumedRaw) : [];

    if (kioskToken && !consumedList.includes(kioskToken)) {
      consumedList.push(kioskToken);
    }
    if (timestampStr && !consumedList.includes(`time-${timestampStr}`)) {
      consumedList.push(`time-${timestampStr}`);
    }

    const trimmed = consumedList.slice(-50);
    localStorage.setItem(STORAGE_CONSUMED_TOKENS, JSON.stringify(trimmed));

    // Clear query parameters from URL history so re-opening from history has no token!
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  } catch {
    // ignore
  }
};

export const PlayerCheckInPage: React.FC = () => {
  const { members, findMemberByCode, performCheckIn, addMember } = useGymData();
  const { currentUser, login } = useAuth();

  const [phoneInput, setPhoneInput] = useState('');
  const [checkedMember, setCheckedMember] = useState<Member | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [step, setStep] = useState<'loading' | 'unregistered' | 'success' | 'verified_only'>('loading');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Staff Login Modal state (Protected Access to Dashboard)
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [staffUsername, setStaffUsername] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffError, setStaffError] = useState('');
  const [isStaffSubmitting, setIsStaffSubmitting] = useState(false);

  const autoCheckInAttempted = useRef(false);

  // Helper: Persist authentication credentials to device
  const persistMemberAuthentication = (member: Member) => {
    try {
      const authToken =
        member.id +
        '-' +
        Date.now().toString(36) +
        '-' +
        Math.random().toString(36).substring(2, 8);

      localStorage.setItem(STORAGE_MEMBER_ID, member.id);
      localStorage.setItem(STORAGE_AUTH_TOKEN, authToken);
      localStorage.setItem(
        STORAGE_PLAYER_IDENTITY,
        JSON.stringify({
          memberId: member.id,
          id: member.id,
          code: member.code,
          name: member.name,
          phone: member.phone,
          subscriptionPlan: member.subscriptionPlan,
          remainingDays: member.remainingDays,
          remainingSessions: member.remainingSessions,
          endDate: member.endDate,
          active: member.active,
          authToken,
        })
      );
    } catch {
      // ignore
    }
  };

  // Helper: Execute Check-in and transition to Green Success Screen
  const handleExecuteCheckIn = (targetMember: Member, isSilentAuto = false) => {
    setErrorMessage('');

    // Call performCheckIn in context with fallbackMember support
    const res = performCheckIn(targetMember.id, 'qr', targetMember);

    // Persist credentials on mobile device
    persistMemberAuthentication(res.member || targetMember);

    setCheckedMember(res.member || targetMember);
    setStep('success');
    sounds.playSuccessDing();
  };

  // AUTO-CHECKIN ON SCAN ENGINE (Zero-Click Member Authentication with Fresh Scan Protection)
  useEffect(() => {
    if (autoCheckInAttempted.current) return;

    const executeAutoDetection = async () => {
      const isFreshScan = isScanFreshAndUnconsumed();

      // 1. Check if device has stored memberId in localStorage
      const savedMemberId = localStorage.getItem(STORAGE_MEMBER_ID);
      const savedIdentityStr = localStorage.getItem(STORAGE_PLAYER_IDENTITY);

      if (savedMemberId && savedIdentityStr) {
        try {
          const parsed = JSON.parse(savedIdentityStr);
          if (parsed && (parsed.name || parsed.code)) {
            // Check if latest version exists in members context
            const liveMember =
              members.find(
                (m) =>
                  m.id === savedMemberId ||
                  m.code === parsed.code ||
                  (parsed.phone && m.phone === parsed.phone)
              ) || (parsed.code ? findMemberByCode(parsed.code) : undefined);

            const target: Member = liveMember || {
              id: savedMemberId,
              code: parsed.code || Math.floor(100000 + Math.random() * 900000).toString(),
              name: parsed.name,
              phone: parsed.phone || '',
              type: 'member',
              subscriptionPlan: parsed.subscriptionPlan || 'بدون اشتراك نشط',
              subscriptionFee: parsed.subscriptionFee || 0,
              startDate: parsed.startDate || new Date().toISOString().split('T')[0],
              endDate: parsed.endDate || '',
              totalDays: parsed.totalDays || 0,
              remainingDays: parsed.remainingDays !== undefined ? parsed.remainingDays : 0,
              totalSessions: parsed.totalSessions !== undefined ? parsed.totalSessions : 0,
              remainingSessions: parsed.remainingSessions !== undefined ? parsed.remainingSessions : 0,
              active: parsed.active !== undefined ? parsed.active : false,
            };

            if (liveMember) {
              localStorage.setItem(STORAGE_PLAYER_IDENTITY, JSON.stringify(liveMember));
            }

            autoCheckInAttempted.current = true;

            if (isFreshScan) {
              // Real physical scan at the desk -> Execute checkin & consume token
              markScanAsConsumed();
              handleExecuteCheckIn(target, true);
            } else {
              // Opened from history or reload -> Confirm identity only, do NOT trigger checkin!
              setCheckedMember(target);
              setStep('verified_only');
            }
            return;
          }
        } catch {
          // ignore parsing error
        }
      }

      // 2. Check if member code was passed in URL query parameter (?code=... / ?id=...)
      try {
        const params = new URLSearchParams(window.location.search);
        const urlCode = params.get('code') || params.get('memberCode') || params.get('id');
        const isBindOnly = params.get('bind') === 'true';

        if (urlCode) {
          const cleanCode = urlCode.trim().toUpperCase();
          let target =
            findMemberByCode(cleanCode) ||
            members.find((m) => m.code.toUpperCase() === cleanCode || m.phone === cleanCode);

          // If not in local state, query backend directory
          if (!target) {
            try {
              const res = await fetch(`/api/members?q=${encodeURIComponent(cleanCode)}`);
              if (res.ok) {
                const data = await res.json();
                if (data.member) {
                  target = data.member;
                }
              }
            } catch {
              // ignore
            }
          }

          if (target) {
            persistMemberAuthentication(target);
            autoCheckInAttempted.current = true;

            // When scanning with URL code (desk QR or personalized member QR):
            // Check in player immediately so they appear in reception seating!
            markScanAsConsumed();
            handleExecuteCheckIn(target, false);
            if (window.history && window.history.replaceState) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
            return;
          }
        }
      } catch {
        // ignore
      }

      // 3. Brand new device (no memberId found) -> show 1-time phone checkin screen
      autoCheckInAttempted.current = true;
      setStep('unregistered');
    };

    executeAutoDetection();
  }, [members, findMemberByCode]);

  // مزامنة فورية لبيانات اللاعب المعروضة على هاتفه مع أي تعديل يجريه موظف الاستقبال
  useEffect(() => {
    if (checkedMember) {
      const live = members.find(
        (m) =>
          m.id === checkedMember.id ||
          (checkedMember.phone && m.phone === checkedMember.phone) ||
          m.code === checkedMember.code
      );
      if (live) {
        if (
          live.name !== checkedMember.name ||
          live.phone !== checkedMember.phone ||
          live.remainingDays !== checkedMember.remainingDays ||
          live.remainingSessions !== checkedMember.remainingSessions ||
          live.endDate !== checkedMember.endDate ||
          live.subscriptionPlan !== checkedMember.subscriptionPlan
        ) {
          setCheckedMember(live);
          localStorage.setItem(STORAGE_PLAYER_IDENTITY, JSON.stringify(live));
        }
      }
    }
  }, [members, checkedMember]);

  // Handle phone-only checkin & 1-time device linking
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phoneInput.trim();
    if (!cleanPhone) return;

    setIsSubmitting(true);
    setErrorMessage('');

    // 1. Search in local state by phone, normalized digits, or code
    const digitsOnly = cleanPhone.replace(/\D/g, '');
    let target = members.find((m) => {
      if (m.phone === cleanPhone || m.code.toUpperCase() === cleanPhone.toUpperCase()) return true;
      if (digitsOnly.length >= 8 && m.phone) {
        return m.phone.replace(/\D/g, '') === digitsOnly;
      }
      return false;
    });

    // 2. Search in backend members directory if not found locally
    if (!target) {
      try {
        const res = await fetch(`/api/members?q=${encodeURIComponent(cleanPhone)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.member) {
            target = data.member;
          }
        }
      } catch {
        // ignore
      }
    }

    if (target) {
      // Existing member found -> Bind device & check in immediately!
      persistMemberAuthentication(target);
      setIsSubmitting(false);
      markScanAsConsumed();
      handleExecuteCheckIn(target, false);
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } else {
      // New visitor/player -> Create membership record with this phone and check in!
      const generatedCode = generateUniqueMemberCode(members);
      const created = addMember({
        code: generatedCode,
        name: `متدرب جديد (${cleanPhone})`,
        phone: cleanPhone,
        type: 'member',
        subscriptionPlan: 'تمرين حر (غير مسجل اشتراك)',
        subscriptionFee: 0,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        totalDays: 0,
        remainingDays: 0,
        totalSessions: 0,
        remainingSessions: 0,
        active: true,
        sessionCategory: 'gym',
        paymentMethod: undefined,
        paymentStatus: 'unpaid',
        notes: 'تسجيل دخول ذاتي برقم الهاتف فقط',
      });

      persistMemberAuthentication(created);
      setIsSubmitting(false);
      markScanAsConsumed();
      handleExecuteCheckIn(created, false);
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  };

  // Action: Switch Account / Logout from this device
  const handleSwitchAccount = () => {
    try {
      localStorage.removeItem(STORAGE_MEMBER_ID);
      localStorage.removeItem(STORAGE_AUTH_TOKEN);
      localStorage.removeItem(STORAGE_PLAYER_IDENTITY);
    } catch {
      // ignore
    }
    setCheckedMember(null);
    setPhoneInput('');
    setErrorMessage('');
    setStep('unregistered');
    autoCheckInAttempted.current = true;
  };

  return (
    <div
      className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-between p-4 sm:p-6 relative overflow-x-hidden selection:bg-teal-500 selection:text-white"
      dir="rtl"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 max-w-md mx-auto w-full pt-2 sm:pt-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-black tracking-wide text-white flex items-center gap-1.5">
              <span>SYNAPSE GYM</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <p className="text-[11px] text-emerald-400 font-bold">بوابة الحضور الذاتي بالـ QR</p>
          </div>
        </div>

        <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-1">
          <Zap className="w-3 h-3 text-emerald-400" />
          <span>Auto-Checkin</span>
        </span>
      </header>

      {/* Main Interactive View */}
      <main className="relative z-10 max-w-md mx-auto w-full my-auto py-6">
        {/* VIEW 1: LOADING & CHECKING PERSISTENT AUTH */}
        {step === 'loading' && (
          <div className="bg-[#0f172a]/95 border-2 border-emerald-500/30 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin mx-auto" />
            <h2 className="text-base font-black text-white">جاري فحص هوية العضو وتسجيل الحضور تلقائياً...</h2>
            <p className="text-xs text-slate-400">Zero-Click Smart Attendance Flow</p>
          </div>
        )}

        {/* VIEW 2: GREEN SUCCESS SCREEN (AUTO-CHECKIN COMPLETED) */}
        {step === 'success' && checkedMember && (
          <div className="bg-[#0f172a]/95 border-2 border-emerald-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-center space-y-5 animate-scale-up">
            {/* Animated Big Green Checkmark */}
            <div className="relative py-2 flex items-center justify-center">
              <div className="w-28 h-28 rounded-full bg-emerald-500/20 animate-ping absolute inset-0 mx-auto" />
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-2xl shadow-emerald-500/40 relative z-10">
                <CheckCircle className="w-14 h-14 text-slate-950 stroke-[2.5]" />
              </div>
            </div>

            {/* Greeting & Player Identity */}
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold mb-2">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                <span>تم تسجيل حضورك بنجاح!</span>
              </div>
              <h2 className="text-2xl font-black text-white">
                أهلاً بك يا كابتن / {checkedMember.name}
              </h2>
              <div className="flex items-center justify-center gap-3 text-xs text-slate-400 font-mono mt-1">
                <span>الكود: <strong className="text-white">{checkedMember.code}</strong></span>
                {checkedMember.phone && <span>• {checkedMember.phone}</span>}
              </div>
            </div>

            {/* Shift Notification Notice */}
            <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-semibold leading-relaxed">
              ✓ تم إشعار كاونتر الاستقبال بحضورك الآن وظهر اسمك في شاشة التسكين لشفت اليوم تلقائياً.
            </div>

            {/* Subscription Metrics Breakdown */}
            {(() => {
              const subInfo = getSubscriptionStatus(checkedMember);

              if (subInfo.status === 'expired') {
                return (
                  <div className="p-4 rounded-2xl bg-rose-500/15 border-2 border-rose-500/40 text-rose-300 text-center space-y-2.5 animate-scale-up">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 font-bold text-xs border border-rose-500/30">
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                      <span>اشتراكك منتهي الصلاحية</span>
                    </div>
                    <div className="text-sm font-black text-white">
                      ⚠️ انتهى اشتراكك بتاريخ: <span className="text-rose-300">{subInfo.dateFormatted || 'سابقاً'}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      تم تسجيل وصولك وإشعار الاستقبال. يرجى التوجه لموظف الاستقبال الآن لتجديد باقة الاشتراك أو دفع تذكرة يومية لمتابعة تمرينك.
                    </p>
                  </div>
                );
              }

              if (subInfo.status === 'none') {
                return (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-center space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs">
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                      <span>لا يوجد اشتراك نشط حالياً</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      تم تسجيل وصولك بنجاح وظهر اسمك في شاشة الاستقبال. يرجى التوجه لموظف الاستقبال للاشتراك أو التسكين في حصة تدريبية أو تمرين حر.
                    </p>
                    <div className="text-[11px] text-slate-400 pt-1 border-t border-amber-500/20 flex items-center justify-center gap-2">
                      <span className="font-bold text-slate-300">الحالة:</span>
                      <span>عضوية مسجلة - بانتظار التسكين والتفعيل</span>
                    </div>
                  </div>
                );
              }

              const hasDuration = subInfo.status === 'active';
              const hasSessions = (checkedMember.remainingSessions || 0) > 0;

              return (
                <>
                  <div className={`grid ${hasDuration && hasSessions ? 'grid-cols-2' : 'grid-cols-1'} gap-3 pt-1`}>
                    {hasDuration && (
                      <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-center">
                        <div className="text-[11px] text-slate-400 mb-1 flex items-center justify-center gap-1 font-bold">
                          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                          <span>الأيام المتبقية</span>
                        </div>
                        <div className="text-2xl font-black font-mono text-emerald-300">
                          {subInfo.remainingDays ?? checkedMember.remainingDays} يوم
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          من أصل {checkedMember.totalDays} يوم
                        </div>
                      </div>
                    )}

                    {hasSessions && (
                      <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-center">
                        <div className="text-[11px] text-slate-400 mb-1 flex items-center justify-center gap-1 font-bold">
                          <Clock className="w-3.5 h-3.5 text-teal-400" />
                          <span>الحصص المتبقية</span>
                        </div>
                        <div className="text-2xl font-black font-mono text-teal-300">
                          {checkedMember.remainingSessions} حصة
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          من أصل {checkedMember.totalSessions} حصة
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Plan Info Card */}
                  <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs space-y-2 text-right">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">نوع الباقة:</span>
                      <span className="font-bold text-white">{checkedMember.subscriptionPlan || 'اشتراك ساري'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">صلاحية الاشتراك:</span>
                      <span className="font-bold text-emerald-400 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{subInfo.badgeText}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">صلاحية الاشتراك وسريانه:</span>
                      <span className="font-bold text-emerald-300 font-mono text-[11px]">
                        {subInfo.fullText}
                      </span>
                    </div>
                  </div>

                  {/* Upsell for Subscribed Members: Private PT or Massage */}
                  {hasDuration && (
                    <div className="p-3.5 rounded-2xl bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-transparent border border-teal-500/30 text-right space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-black text-teal-300">
                        <Sparkles className="w-4 h-4 text-teal-400" />
                        <span>هل ترغب في جلسة برايفت (PT) أو مساج اليوم؟</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        بصفتك مشتركاً، يمكنك حجز وتسكين حصة تدريب خاصة مع كابتن أو جلسة مساج واستشفاء لدى موظف الاستقبال فوراً.
                      </p>
                    </div>
                  )}
                </>
              );
            })()}

            {/* Persistent Auth Status Pill */}
            <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5 pt-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>هذا الهاتف مربوط بعضويتك بشكل دائم لتسجيل الحضور فورياً</span>
            </div>

            {/* Action Buttons: Switch Account / Refresh */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={handleSwitchAccount}
                className="w-full py-2.5 px-4 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span>تبديل الحساب / تسجيل خروج من هذا الهاتف</span>
              </button>
            </div>
          </div>
        )}

        {/* VIEW 2.5: VERIFIED IDENTITY ONLY (OPENED FROM BROWSER HISTORY - NO CHECK-IN) */}
        {step === 'verified_only' && checkedMember && (
          <div className="bg-[#0f172a]/95 border-2 border-cyan-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-center space-y-5 animate-scale-up">
            {/* Identity Icon */}
            <div className="relative py-2 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-cyan-500/20 flex items-center justify-center border-2 border-cyan-500/40 shadow-xl shadow-cyan-500/20">
                <ShieldCheck className="w-10 h-10 text-cyan-400 stroke-[2.5]" />
              </div>
            </div>

            {/* Greeting & Player Identity */}
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold mb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>تم تأكيد الهوية وحسابك مسجل</span>
              </div>
              <h2 className="text-2xl font-black text-white">
                أهلاً بك يا كابتن / {checkedMember.name}
              </h2>
              <div className="flex items-center justify-center gap-3 text-xs text-slate-400 font-mono mt-1">
                <span>الكود: <strong className="text-white">{checkedMember.code}</strong></span>
                {checkedMember.phone && <span>• {checkedMember.phone}</span>}
              </div>
            </div>

            {/* Crucial Instruction: Physical QR scan required for checkin */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/50 via-slate-900 to-cyan-950/50 border border-cyan-500/40 text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-cyan-300 font-bold text-xs">
                <QrCode className="w-4 h-4 text-cyan-400" />
                <span>لتسجيل الدخول الفعلي وظهورك بالاستقبال:</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed font-semibold">
                يرجى مسح رمز الـ QR الموجود على كاونتر الاستقبال بالصالة لتأكيد حضورك اليوم.
              </p>
              <div className="text-[10px] text-cyan-400/80 pt-1 border-t border-cyan-500/20">
                🔒 حماية الدخول: فتح الصفحة من السجل أو خارج الجيم لا يسجل حضوراً إلا بالمسح الفعلي لكود كاونتر الاستقبال.
              </div>
            </div>

            {/* Subscription Metrics Breakdown */}
            {(() => {
              const subInfo = getSubscriptionStatus(checkedMember);

              if (subInfo.status === 'expired') {
                return (
                  <div className="p-4 rounded-2xl bg-rose-500/15 border-2 border-rose-500/40 text-rose-300 text-center space-y-2.5">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 font-bold text-xs border border-rose-500/30">
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                      <span>اشتراكك منتهي الصلاحية (انتهت الأيام)</span>
                    </div>
                    <div className="text-sm font-black text-white">
                      ⚠️ انتهى اشتراكك بتاريخ: <span className="text-rose-300">{subInfo.dateFormatted || 'سابقاً'}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      انتهت مدة الأيام المحددة للاشتراك وسقطت أي حصص متبقية لانتهاء المدة. يرجى التوجه لموظف الاستقبال لتجديد الاشتراك.
                    </p>
                  </div>
                );
              }

              if (subInfo.status === 'none') {
                return (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-center space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs">
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                      <span>لا يوجد اشتراك نشط حالياً</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      حسابك مسجل. يرجى التوجه لموظف الاستقبال للاشتراك أو التسكين في حصة تدريبية.
                    </p>
                  </div>
                );
              }

              const hasDuration = subInfo.status === 'active';
              const hasSessions = (checkedMember.remainingSessions || 0) > 0;

              return (
                <>
                  <div className={`grid ${hasDuration && hasSessions ? 'grid-cols-2' : 'grid-cols-1'} gap-3 pt-1`}>
                    {hasDuration && (
                      <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-center">
                        <div className="text-[11px] text-slate-400 mb-1 flex items-center justify-center gap-1 font-bold">
                          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                          <span>الأيام المتبقية</span>
                        </div>
                        <div className="text-2xl font-black font-mono text-emerald-300">
                          {subInfo.remainingDays ?? checkedMember.remainingDays} يوم
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          من أصل {checkedMember.totalDays} يوم
                        </div>
                      </div>
                    )}

                    {hasSessions && (
                      <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-center">
                        <div className="text-[11px] text-slate-400 mb-1 flex items-center justify-center gap-1 font-bold">
                          <Clock className="w-3.5 h-3.5 text-teal-400" />
                          <span>الحصص المتبقية</span>
                        </div>
                        <div className="text-2xl font-black font-mono text-teal-300">
                          {checkedMember.remainingSessions} حصة
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          من أصل {checkedMember.totalSessions} حصة
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Plan Info Card */}
                  <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs space-y-2 text-right">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">نوع الباقة:</span>
                      <span className="font-bold text-white">{checkedMember.subscriptionPlan || 'اشتراك ساري'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">صلاحية الاشتراك:</span>
                      <span className="font-bold text-emerald-400 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{subInfo.badgeText}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">سريان الاشتراك:</span>
                      <span className="font-bold text-emerald-300 font-mono text-[11px]">
                        {subInfo.fullText}
                      </span>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Persistent Auth Status Pill */}
            <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5 pt-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>هذا الهاتف مربوط بعضويتك بشكل دائم</span>
            </div>

            {/* Logout button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSwitchAccount}
                className="w-full py-2.5 px-4 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span>تبديل الحساب / تسجيل خروج من هذا الهاتف</span>
              </button>
            </div>
          </div>
        )}

        {/* VIEW 3: WRITE YOUR PHONE NUMBER ONLY (ZERO-FRICTION CHECK-IN) */}
        {step === 'unregistered' && (
          <div className="bg-[#0f172a]/95 border-2 border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6 animate-scale-up">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                <Phone className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-white">تسجيل حضورك بالصالة</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                اكتب رقم تليفونك فقط لتسجيل حضورك وربط هاتفك بعضويتك فورياً
              </p>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 text-right">
                  اكتب رقم تليفونك:
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="01xxxxxxxxx"
                    inputMode="tel"
                    className="w-full bg-slate-900 border-2 border-emerald-500/40 rounded-2xl px-4 py-4 text-center text-lg font-black text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-400 transition tracking-widest"
                    autoFocus
                  />
                  <Phone className="w-5 h-5 text-emerald-400 absolute left-4 top-4.5" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !phoneInput.trim()}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/25 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
              >
                <CheckCircle className="w-5 h-5" />
                <span>{isSubmitting ? 'جاري التحقق والتسجيل...' : 'تأكيد الحضور والدخول للصالة'}</span>
              </button>
            </form>

            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] text-center leading-relaxed">
              💡 بعد إدخال رقمك، سيتعرف الموقع على هاتفك تلقائياً في الزيارات القادمة بمجرد مسح الكود!
            </div>
          </div>
        )}
      </main>

      {/* Footer Navigation Protected for Gym Staff */}
      <footer className="relative z-10 max-w-md mx-auto w-full pb-3 text-center">
        <button
          onClick={() => {
            if (currentUser) {
              window.location.href = '/';
            } else {
              setIsStaffModalOpen(true);
            }
          }}
          className="text-xs text-slate-500 hover:text-emerald-400 font-bold transition flex items-center justify-center gap-1.5 mx-auto cursor-pointer p-2 rounded-xl hover:bg-slate-900/60"
        >
          <Lock className="w-3.5 h-3.5 text-slate-400" />
          <span>بوابة طاقم الإدارة والاستقبال (موظفين فقط)</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </footer>

      {/* Staff Authentication Modal */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-5 sm:p-7 max-w-sm w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl relative animate-scale-up" dir="rtl">
            <button
              onClick={() => {
                setIsStaffModalOpen(false);
                setStaffError('');
              }}
              className="absolute top-4 left-4 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-500/40 text-teal-400 flex items-center justify-center mx-auto mb-2">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-white">تسجيل دخول طاقم العمل</h3>
              <p className="text-xs text-slate-400">
                منطقة محمية خاصة بمدير الجيم وموظفي الاستقبال
              </p>
            </div>

            {staffError && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{staffError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStaffError('');
                setIsStaffSubmitting(true);
                const res = login(staffUsername.trim(), staffPassword.trim());
                setIsStaffSubmitting(false);
                if (res.success) {
                  sounds.playSuccessDing();
                  window.location.href = '/';
                } else {
                  setStaffError(res.error || 'اسم المستخدم أو كلمة المرور غير صحيحة');
                  sounds.playCashRegister();
                }
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  اسم المستخدم:
                </label>
                <input
                  type="text"
                  required
                  value={staffUsername}
                  onChange={(e) => setStaffUsername(e.target.value)}
                  placeholder="اسم المستخدم"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-400"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  كلمة المرور:
                </label>
                <input
                  type="password"
                  required
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-400"
                />
              </div>

              <button
                type="submit"
                disabled={isStaffSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-black text-xs shadow-lg shadow-teal-500/20 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Key className="w-4 h-4" />
                <span>{isStaffSubmitting ? 'جاري التحقق...' : 'دخول لوحة التحكم'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
