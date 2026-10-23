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
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useGymData } from '../context/GymDataContext';
import { Member, SessionCategory } from '../types';
import { formatDateAr } from '../utils/formatters';
import { sounds } from '../utils/sound';

const STORAGE_MEMBER_ID = 'synapse_member_id';
const STORAGE_AUTH_TOKEN = 'synapse_auth_token';
const STORAGE_PLAYER_IDENTITY = 'synapse_player_identity';

export const PlayerCheckInPage: React.FC = () => {
  const { members, findMemberByCode, performCheckIn, addMember } = useGymData();

  const [inputCode, setInputCode] = useState('');
  const [checkedMember, setCheckedMember] = useState<Member | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [step, setStep] = useState<'loading' | 'unregistered' | 'success'>('loading');
  const [activeTab, setActiveTab] = useState<'link' | 'register'>('link');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New player registration form
  const [newPlayerForm, setNewPlayerForm] = useState({
    name: '',
    phone: '',
    sessionCategory: 'gym' as SessionCategory,
  });

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

    // Trigger celebratory Confetti
    try {
      confetti({
        particleCount: 80,
        spread: 90,
        origin: { y: 0.5 },
        colors: ['#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#f59e0b'],
      });
    } catch {
      // ignore
    }
  };

  // AUTO-CHECKIN ON SCAN ENGINE (Zero-Click Member Authentication)
  useEffect(() => {
    if (autoCheckInAttempted.current) return;

    const executeAutoDetection = async () => {
      // 1. Check if device has stored memberId in localStorage
      const savedMemberId = localStorage.getItem(STORAGE_MEMBER_ID);
      const savedIdentityStr = localStorage.getItem(STORAGE_PLAYER_IDENTITY);

      if (savedMemberId && savedIdentityStr) {
        try {
          const parsed = JSON.parse(savedIdentityStr);
          if (parsed && (parsed.name || parsed.code)) {
            // Check if latest version exists in members context
            const liveMember =
              members.find((m) => m.id === savedMemberId || m.code === parsed.code) ||
              (parsed.code ? findMemberByCode(parsed.code) : undefined);

            const target: Member = liveMember || {
              id: savedMemberId,
              code: parsed.code || Math.floor(100000 + Math.random() * 900000).toString(),
              name: parsed.name,
              phone: parsed.phone || '',
              type: 'member',
              subscriptionPlan: parsed.subscriptionPlan || 'اشتراك عضوية',
              subscriptionFee: 100,
              startDate: new Date().toISOString().split('T')[0],
              endDate: parsed.endDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
              totalDays: parsed.totalDays || 30,
              remainingDays: parsed.remainingDays !== undefined ? parsed.remainingDays : 30,
              totalSessions: parsed.totalSessions !== undefined ? parsed.totalSessions : 12,
              remainingSessions: parsed.remainingSessions !== undefined ? parsed.remainingSessions : 12,
              active: parsed.active !== undefined ? parsed.active : true,
            };

            autoCheckInAttempted.current = true;
            handleExecuteCheckIn(target, true);
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
            autoCheckInAttempted.current = true;
            handleExecuteCheckIn(target, true);
            return;
          }
        }
      } catch {
        // ignore
      }

      // 3. Brand new device (no memberId found) -> show 1-time device linking screen
      autoCheckInAttempted.current = true;
      setStep('unregistered');
    };

    executeAutoDetection();
  }, [members, findMemberByCode]);

  // Handle 1-time device linking with existing membership
  const handleLinkExistingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;

    setIsSubmitting(true);
    setErrorMessage('');

    const clean = inputCode.trim().toUpperCase();

    // 1. Search in local state
    let target =
      findMemberByCode(clean) ||
      members.find((m) => m.phone === clean || m.code.toUpperCase() === clean);

    // 2. Search in backend members directory if not found locally
    if (!target) {
      try {
        const res = await fetch(`/api/members?q=${encodeURIComponent(clean)}`);
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

    setIsSubmitting(false);

    if (target) {
      // Success: Save to device and Auto-Checkin!
      handleExecuteCheckIn(target, false);
    } else {
      setErrorMessage(
        'لم يتم العثور على عضو بهذا الكود أو رقم الهاتف. يمكنك تسجيل لاعب جديد من التاب المجاور.'
      );
      sounds.playCashRegister();
    }
  };

  // Handle instant new player registration & 1-time linking
  const handleNewPlayerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerForm.name.trim() || !newPlayerForm.phone.trim()) {
      setErrorMessage('يرجى إدخال اسم اللاعب ورقم الهاتف');
      return;
    }

    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    const categoryTitle =
      newPlayerForm.sessionCategory === 'private'
        ? 'تدريب خاص (Private PT)'
        : newPlayerForm.sessionCategory === 'group'
        ? 'كلاس تدريبي جماعي'
        : newPlayerForm.sessionCategory === 'massage'
        ? 'جلسة مساج'
        : newPlayerForm.sessionCategory === 'physio'
        ? 'علاج طبيعي'
        : 'اشتراك صالة الجيم العامة';

    const created = addMember({
      name: newPlayerForm.name.trim(),
      phone: newPlayerForm.phone.trim(),
      code: generatedCode,
      subscriptionPlan: categoryTitle,
      subscriptionFee: 100,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      totalDays: 30,
      remainingDays: 30,
      totalSessions: 12,
      remainingSessions: 12,
      active: true,
      type: 'member',
      sessionCategory: newPlayerForm.sessionCategory,
      paymentMethod: 'coach_collected',
    });

    handleExecuteCheckIn(created, false);
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
    setInputCode('');
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
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-center">
                <div className="text-[11px] text-slate-400 mb-1 flex items-center justify-center gap-1 font-bold">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>الأيام المتبقية</span>
                </div>
                <div className="text-2xl font-black font-mono text-emerald-300">
                  {checkedMember.remainingDays} يوم
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  من أصل {checkedMember.totalDays} يوم
                </div>
              </div>

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
            </div>

            {/* Plan Info Card */}
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs space-y-2 text-right">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">نوع الباقة:</span>
                <span className="font-bold text-white">{checkedMember.subscriptionPlan}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">صلاحية الاشتراك:</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{checkedMember.active ? 'ساري وصالح' : 'معلق'}</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">تاريخ الانتهاء:</span>
                <span className="font-mono text-slate-300">{formatDateAr(checkedMember.endDate)}</span>
              </div>
            </div>

            {/* Persistent Auth Status Pill */}
            <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5 pt-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>هذا الهاتف مربوط بعضويتك بشكل دائم لتسجيل الحضور فورياً</span>
            </div>

            {/* Action Buttons: Switch Account / Refresh */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => handleExecuteCheckIn(checkedMember, false)}
                className="w-full py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs transition cursor-pointer border border-slate-700 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>تحديث / تسجيل حضور مجدداً</span>
              </button>

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

        {/* VIEW 3: 1-TIME DEVICE LINKING (FOR NEW PHONES OR AFTER LOGOUT) */}
        {step === 'unregistered' && (
          <div className="bg-[#0f172a]/95 border-2 border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6 animate-scale-up">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                <QrCode className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-white">ربط الهاتف لمرة واحدة فقط</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                اربط هاتفك بعضويتك الآن، ولن تحتاج لإدخال أي بيانات مجدداً! في كل مرة قادمة ستقوم بمسح الكود وسيتم تسجيل حضورك تلقائياً وبدون أي ضغطات (Auto-Checkin).
              </p>
            </div>

            {/* Selector Tabs: Link Existing vs New Member */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('link');
                  setErrorMessage('');
                }}
                className={`py-2 px-3 rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'link'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>عندي اشتراك مسبقاً</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  setErrorMessage('');
                }}
                className={`py-2 px-3 rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'register'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>تسجيل لاعب جديد</span>
              </button>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* TAB 1: ONE-TIME PHONE LINKING */}
            {activeTab === 'link' && (
              <form onSubmit={handleLinkExistingSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    كود العضوية أو رقم الهاتف المسجل:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={inputCode}
                      onChange={(e) => setInputCode(e.target.value)}
                      placeholder="مثال: 102938 أو 01012345678"
                      inputMode="numeric"
                      className="w-full bg-slate-900 border-2 border-emerald-500/40 rounded-2xl px-4 py-3.5 text-center text-sm font-black text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-400 transition tracking-wider"
                      autoFocus
                    />
                    <Search className="w-4 h-4 text-slate-500 absolute left-4 top-4" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/25 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  <UserCheck className="w-5 h-5" />
                  <span>{isSubmitting ? 'جاري التحقق...' : 'ربط الهاتف وتسجيل الحضور فوراً'}</span>
                </button>
              </form>
            )}

            {/* TAB 2: INSTANT VISITOR / NEW PLAYER REGISTER */}
            {activeTab === 'register' && (
              <form onSubmit={handleNewPlayerSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    اسم اللاعب بالكامل:
                  </label>
                  <input
                    type="text"
                    required
                    value={newPlayerForm.name}
                    onChange={(e) => setNewPlayerForm({ ...newPlayerForm, name: e.target.value })}
                    placeholder="مثال: محمد السيد أحمد"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    رقم الهاتف / الواتساب:
                  </label>
                  <input
                    type="tel"
                    required
                    value={newPlayerForm.phone}
                    onChange={(e) => setNewPlayerForm({ ...newPlayerForm, phone: e.target.value })}
                    placeholder="010..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    نوع النشاط المستهدف:
                  </label>
                  <select
                    value={newPlayerForm.sessionCategory}
                    onChange={(e) =>
                      setNewPlayerForm({
                        ...newPlayerForm,
                        sessionCategory: e.target.value as SessionCategory,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                  >
                    <option value="gym">🏋️ صالة الجيم العامة</option>
                    <option value="private">🎯 تدريب خاص (Private PT)</option>
                    <option value="group">👥 كلاس تدريبي جماعي</option>
                    <option value="massage">💆‍♂️ مساج واستشفاء رياضي</option>
                    <option value="physio">🩺 علاج طبيعي وتأهيل</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/25 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <UserPlus className="w-5 h-5" />
                  <span>تسجيل العضوية وتأكيد الحضور بالريسبشن</span>
                </button>
              </form>
            )}

            {/* Quick Informational Pill */}
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] text-center leading-relaxed">
              💡 بعد إتمام هذه الخطوة، سيتعرف الموقع على هاتفك تلقائياً في كل زيارة قادمة فور مسح الكود!
            </div>
          </div>
        )}
      </main>

      {/* Footer Navigation */}
      <footer className="relative z-10 max-w-md mx-auto w-full pb-3 text-center">
        <button
          onClick={() => {
            window.location.href = '/';
          }}
          className="text-xs text-slate-500 hover:text-emerald-400 font-bold transition flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
        >
          <span>الذهاب للوحة تحكم واستقبال الجيم</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </footer>
    </div>
  );
};
