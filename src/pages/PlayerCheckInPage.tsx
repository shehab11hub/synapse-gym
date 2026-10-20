import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle,
  QrCode,
  Search,
  Calendar,
  Clock,
  ShieldCheck,
  Sparkles,
  UserCheck,
  AlertCircle,
  Dumbbell,
  ArrowRight,
  Zap,
  UserPlus,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useGymData } from '../context/GymDataContext';
import { Member, SessionCategory } from '../types';
import { formatDateAr } from '../utils/formatters';
import { sounds } from '../utils/sound';

export const PlayerCheckInPage: React.FC = () => {
  const { members, findMemberByCode, performCheckIn, addMember } = useGymData();

  const [inputCode, setInputCode] = useState('');
  const [checkedMember, setCheckedMember] = useState<Member | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [step, setStep] = useState<'loading' | 'unregistered' | 'checkmark' | 'details'>('loading');
  const [activeTab, setActiveTab] = useState<'link' | 'register'>('link');
  const [isZeroClick, setIsZeroClick] = useState(false);

  // New member quick register form
  const [newPlayerForm, setNewPlayerForm] = useState({
    name: '',
    phone: '',
    sessionCategory: 'gym' as SessionCategory,
  });

  const checkInAttemptedRef = useRef(false);

  const handleExecuteCheckIn = (targetMember: Member, fromAuto = false) => {
    setErrorMessage('');
    const res = performCheckIn(targetMember.id, 'qr');

    if (res.success && res.member) {
      // Save identity to phone so every future scan is Zero-Click!
      try {
        localStorage.setItem(
          'synapse_player_identity',
          JSON.stringify({
            id: targetMember.id,
            code: targetMember.code,
            name: targetMember.name,
            phone: targetMember.phone,
          })
        );
      } catch {
        // ignore
      }

      setCheckedMember(res.member);
      setIsZeroClick(fromAuto);
      setStep('checkmark');
      sounds.playSuccessDing();

      // Trigger Confetti effect
      try {
        confetti({
          particleCount: 80,
          spread: 90,
          origin: { y: 0.5 },
          colors: ['#14b8a6', '#10b981', '#06b6d4', '#f59e0b', '#ffffff'],
        });
      } catch {
        // Ignore
      }

      // Transition to details after 1.8s
      setTimeout(() => {
        setStep('details');
      }, 1800);
    } else {
      setErrorMessage(res.message || 'حدث خطأ أثناء تسجيل الحضور');
      setStep('unregistered');
    }
  };

  // Zero-Click Flow Auto-Detection on Page Load
  useEffect(() => {
    if (checkInAttemptedRef.current) return;

    try {
      const params = new URLSearchParams(window.location.search);
      const urlCode = params.get('code') || params.get('memberCode') || params.get('id');

      let targetMember: Member | undefined;

      // 1. Check if member code is passed in URL query
      if (urlCode) {
        targetMember = findMemberByCode(urlCode.trim().toUpperCase());
        if (!targetMember) {
          targetMember = members.find(
            (m) =>
              m.id === urlCode ||
              m.code.toUpperCase() === urlCode.trim().toUpperCase() ||
              m.phone === urlCode.trim()
          );
        }
      }

      // 2. If not in URL, check stored identity on this phone (Zero-Click Mobile Scan)
      if (!targetMember) {
        const saved = localStorage.getItem('synapse_player_identity');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed?.code || parsed?.id || parsed?.phone) {
              targetMember =
                findMemberByCode(parsed.code) ||
                members.find(
                  (m) =>
                    m.id === parsed.id ||
                    m.code === parsed.code ||
                    (parsed.phone && m.phone === parsed.phone)
                );
            }
          } catch {
            // ignore
          }
        }
      }

      // If recognized -> ZERO-CLICK instant checkin!
      if (targetMember) {
        checkInAttemptedRef.current = true;
        handleExecuteCheckIn(targetMember, true);
      } else {
        // First time / unrecognized -> Show clean registration / linking screen
        setStep('unregistered');
      }
    } catch {
      setStep('unregistered');
    }
  }, [members, findMemberByCode]);

  // Handle manual linking of existing membership
  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;

    const cleaned = inputCode.trim().toUpperCase();
    let found = findMemberByCode(cleaned);

    if (!found) {
      found = members.find((m) => m.phone === cleaned || m.code.toUpperCase() === cleaned);
    }

    if (found) {
      handleExecuteCheckIn(found, false);
    } else {
      setErrorMessage('لم يتم العثور على عضو بهذا الكود أو رقم الهاتف. يمكنك تسجيل لاعب جديد من التاب المجاور.');
      sounds.playCashRegister();
    }
  };

  // Handle quick visitor / new player registration
  const handleNewPlayerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerForm.name.trim() || !newPlayerForm.phone.trim()) {
      setErrorMessage('يرجى كتابة الاسم ورقم الهاتف بالكامل');
      return;
    }

    const generatedCode = `SYN-${Math.floor(100 + Math.random() * 900)}`;
    const categoryName =
      newPlayerForm.sessionCategory === 'private'
        ? 'تدريب خاص (Private PT)'
        : newPlayerForm.sessionCategory === 'group'
        ? 'كلاس جماعي'
        : newPlayerForm.sessionCategory === 'massage'
        ? 'جلسة مساج'
        : newPlayerForm.sessionCategory === 'physio'
        ? 'علاج طبيعي'
        : 'اشتراك صالة الجيم';

    const created = addMember({
      name: newPlayerForm.name.trim(),
      phone: newPlayerForm.phone.trim(),
      code: generatedCode,
      subscriptionPlan: categoryName,
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

  const handleForgetDevice = () => {
    try {
      localStorage.removeItem('synapse_player_identity');
    } catch {
      // ignore
    }
    setCheckedMember(null);
    setInputCode('');
    setStep('unregistered');
    setIsZeroClick(false);
  };

  const handleGoToAdmin = () => {
    window.location.href = '/';
  };

  return (
    <div
      className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-between p-4 sm:p-6 relative overflow-x-hidden selection:bg-teal-500 selection:text-white"
      dir="rtl"
    >
      {/* Background ambient glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Brand Header */}
      <header className="relative z-10 max-w-md mx-auto w-full pt-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-teal-500/20">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-black tracking-wide text-white flex items-center gap-1.5">
              <span>SYNAPSE GYM</span>
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
            </div>
            <p className="text-[11px] text-teal-400 font-bold">بوابة الحضور الذكي السريع</p>
          </div>
        </div>

        <span className="text-[10px] font-mono px-2 py-1 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-300 flex items-center gap-1">
          <Zap className="w-3 h-3 text-teal-400" />
          <span>Zero-Click Scan</span>
        </span>
      </header>

      {/* Main Interactive Screen */}
      <main className="relative z-10 max-w-md mx-auto w-full my-auto py-6">
        {/* STEP: LOADING INITIAL DETECTION */}
        {step === 'loading' && (
          <div className="bg-[#0f172a]/95 border-2 border-teal-500/30 rounded-3xl p-8 shadow-2xl backdrop-blur-xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full border-4 border-teal-500 border-t-transparent animate-spin mx-auto" />
            <h2 className="text-base font-bold text-white">جاري التعرف التلقائي على هاتف العضو...</h2>
            <p className="text-xs text-slate-400">Zero-Click Check-in Flow</p>
          </div>
        )}

        {/* STEP 1: UNREGISTERED / FIRST-TIME SCAN FALLBACK */}
        {step === 'unregistered' && (
          <div className="bg-[#0f172a]/95 border-2 border-teal-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6 animate-scale-up">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-teal-500/20 border border-teal-500/40 text-teal-400 flex items-center justify-center mx-auto shadow-inner">
                <QrCode className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-white">عضوية غير مسجلة - تسجيل لاعب جديد</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                تم مسح الكود الذكي بنجاح! لم يتم التعرف على عضويتك تلقائياً على هذا الهاتف بعد.
                اربط هاتفك مرة واحدة فقط ليتم تسجيل حضورك تلقائياً وبدون أي ضغطات في كل مرة قادمة!
              </p>
            </div>

            {/* Selector Tabs: Link vs New Member */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('link');
                  setErrorMessage('');
                }}
                className={`py-2 px-3 rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'link'
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
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
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
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
              <form onSubmit={handleLinkSubmit} className="space-y-4">
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
                      placeholder="مثال: SYN-101 أو 01012345678"
                      className="w-full bg-slate-900 border-2 border-teal-500/40 rounded-2xl px-4 py-3.5 text-center text-sm font-black text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-teal-400 transition tracking-wider"
                      autoFocus
                    />
                    <Search className="w-4 h-4 text-slate-500 absolute left-4 top-4" />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-sm shadow-xl shadow-teal-500/25 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <UserCheck className="w-5 h-5" />
                  <span>ربط هاتفي وتسجيل الحضور فوراً</span>
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
                    placeholder="مثال: أحمد محمد علي"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-400"
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
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-teal-400"
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
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-400"
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
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-black text-sm shadow-xl shadow-teal-500/25 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <UserPlus className="w-5 h-5" />
                  <span>تسجيل العضوية وتأكيد الحضور بالريسبشن</span>
                </button>
              </form>
            )}

            {/* Quick Helper Note */}
            <div className="p-3 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-300 text-[11px] text-center leading-relaxed">
              💡 بعد إتمام هذه الخطوة، سيتعرف الموقع على هاتفك تلقائياً في كل زيارة قادمة فور مسح الكود!
            </div>
          </div>
        )}

        {/* STEP 2: BIG GREEN CHECKMARK POPUP (ZERO-CLICK SUCCESS) */}
        {step === 'checkmark' && checkedMember && (
          <div className="bg-[#0f172a]/95 border-2 border-emerald-500/50 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl text-center space-y-6 animate-scale-up">
            <div className="relative py-4 flex items-center justify-center">
              <div className="w-32 h-32 rounded-full bg-emerald-500/20 animate-ping absolute inset-0 mx-auto" />
              <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-2xl shadow-emerald-500/50 relative z-10">
                <CheckCircle className="w-16 h-16 text-slate-950 stroke-[2.5]" />
              </div>
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold mb-2">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isZeroClick ? 'تحضير فوري تلقائي (Zero-Click)' : 'تم التحضير بنجاح'}</span>
              </div>
              <h2 className="text-2xl font-black text-white">أهلاً بك يا كابتن!</h2>
              <p className="text-lg font-bold text-emerald-400 mt-1">
                {checkedMember.name}
              </p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                كود العضوية: {checkedMember.code}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
              ✓ تم إشعار موظف الاستقبال بحضورك الآن وظهر اسمك في شاشة التسكين الفورية!
            </div>

            <button
              onClick={() => setStep('details')}
              className="w-full py-3 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition cursor-pointer"
            >
              <span>عرض تفاصيل ومتبقي اشتراكك الآن</span>
              <Sparkles className="w-4 h-4 text-teal-400" />
            </button>
          </div>
        )}

        {/* STEP 3: SUBSCRIPTION DETAILS & REMAINING DAYS/SESSIONS */}
        {step === 'details' && checkedMember && (
          <div className="bg-[#0f172a]/95 border-2 border-teal-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center mx-auto mb-2">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-black text-white">معلومات اشتراكك الحالي</h2>
              <p className="text-xs text-slate-400 font-mono">
                {checkedMember.code} - {checkedMember.name}
              </p>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center">
                <div className="text-xs text-slate-400 mb-1 flex items-center justify-center gap-1 font-bold">
                  <Calendar className="w-3.5 h-3.5 text-teal-400" />
                  <span>الأيام المتبقية</span>
                </div>
                <div className="text-2xl font-black font-mono text-teal-300">
                  {checkedMember.remainingDays} يوم
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  من أصل {checkedMember.totalDays} يوم
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center">
                <div className="text-xs text-slate-400 mb-1 flex items-center justify-center gap-1 font-bold">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>الحصص المتبقية</span>
                </div>
                <div className="text-2xl font-black font-mono text-cyan-300">
                  {checkedMember.remainingSessions} حصة
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  من أصل {checkedMember.totalSessions} حصة
                </div>
              </div>
            </div>

            {/* Plan Info Card */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">خطة الاشتراك:</span>
                <span className="font-bold text-white">{checkedMember.subscriptionPlan}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">حالة الاشتراك:</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{checkedMember.active ? 'ساري ونشط' : 'معلق'}</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">تاريخ انتهاء الصلاحية:</span>
                <span className="font-mono text-slate-300">
                  {formatDateAr(checkedMember.endDate)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <button
                onClick={() => setStep('unregistered')}
                className="w-full py-3 px-4 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs transition cursor-pointer shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>تسجيل حضور لاعب آخر (Scan Another)</span>
              </button>

              <button
                onClick={handleForgetDevice}
                className="w-full py-2 px-3 rounded-xl bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-rose-300 font-bold text-[11px] transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>إلغاء ربط هذا الهاتف بحسابي (تسجيل الخروج)</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer Navigation */}
      <footer className="relative z-10 max-w-md mx-auto w-full pb-4 text-center">
        <button
          onClick={handleGoToAdmin}
          className="text-xs text-slate-500 hover:text-teal-400 font-bold transition flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
        >
          <span>الدخول للوحة إدارة الجيم والاستقبال</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </footer>
    </div>
  );
};
