import React, { useState, useEffect } from 'react';
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
  ChevronLeft,
  Dumbbell,
  ArrowRight,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useGymData } from '../context/GymDataContext';
import { Member } from '../types';
import { formatDateAr } from '../utils/formatters';
import { sounds } from '../utils/sound';

export const PlayerCheckInPage: React.FC = () => {
  const { members, findMemberByCode, performCheckIn } = useGymData();

  const [inputCode, setInputCode] = useState('');
  const [checkedMember, setCheckedMember] = useState<Member | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [step, setStep] = useState<'scan' | 'checkmark' | 'details'>('scan');
  const [kioskToken, setKioskToken] = useState<string>('');

  // Extract kioskToken from URL query params
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('kioskToken') || params.get('token') || '';
      setKioskToken(token);
    } catch {
      // Ignore
    }
  }, []);

  const handleExecuteCheckIn = (targetMember: Member) => {
    setErrorMessage('');
    const res = performCheckIn(targetMember.id, 'qr');

    if (res.success && res.member) {
      setCheckedMember(res.member);
      setStep('checkmark');
      sounds.playSuccessDing();

      // Trigger Confetti effect
      try {
        confetti({
          particleCount: 70,
          spread: 80,
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
    }
  };

  const handleSubmitCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;

    // Search by code or phone
    const cleaned = inputCode.trim().toUpperCase();
    let found = findMemberByCode(cleaned);

    if (!found) {
      found = members.find((m) => m.phone === cleaned || m.code.toUpperCase() === cleaned);
    }

    if (found) {
      handleExecuteCheckIn(found);
    } else {
      setErrorMessage('لم يتم العثور على عضو بهذا الكود أو رقم الهاتف. برجاء مراجعة الاستقبال');
      sounds.playCashRegister();
    }
  };

  const handleReset = () => {
    setInputCode('');
    setCheckedMember(null);
    setErrorMessage('');
    setStep('scan');
  };

  const handleGoToAdmin = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden selection:bg-teal-500 selection:text-white" dir="rtl">
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
            <p className="text-[11px] text-teal-400 font-bold">بوابة تسجيل حضور اللاعبين الذكية</p>
          </div>
        </div>

        {kioskToken && (
          <span className="text-[10px] font-mono px-2 py-1 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-300">
            متصل بالمكتب ✓
          </span>
        )}
      </header>

      {/* Main Interactive Screen */}
      <main className="relative z-10 max-w-md mx-auto w-full my-auto py-6">
        {/* STEP 1: SCAN & CODE ENTRY FORM */}
        {step === 'scan' && (
          <div className="bg-[#0f172a]/95 border-2 border-teal-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-teal-500/20 border border-teal-500/40 text-teal-400 flex items-center justify-center mx-auto shadow-inner">
                <QrCode className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-white">تسجيل الدخول عبر كود المكتب</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                تم مسح الكود الذكي بنجاح! أدخل كود عضويتك المسجل بالجيم لتأكيد حضورك وعرض تفاصيل اشتراكك.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmitCode} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  كود العضوية أو رقم الهاتف:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    placeholder="مثال: SYN-101 أو 010..."
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
                <span>تأكيد تسجيل الحضور وعرض الاشتراك</span>
              </button>
            </form>

            {/* Quick Demo Selector for Registered Members */}
            <div className="pt-4 border-t border-slate-800 space-y-2.5">
              <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
                <span>أو اختر حسابك للمعاينة الفورية:</span>
                <span className="text-[10px] text-teal-400">({members.length} متدرب مسجل)</span>
              </div>

              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                {members.slice(0, 5).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleExecuteCheckIn(m)}
                    className="p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-teal-500/40 text-right transition flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-teal-500/10 group-hover:bg-teal-500 text-teal-400 group-hover:text-slate-950 flex items-center justify-center font-bold text-xs transition">
                        {m.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{m.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{m.code}</div>
                      </div>
                    </div>
                    <span className="text-[10px] text-teal-400 font-bold group-hover:translate-x-[-2px] transition flex items-center gap-0.5">
                      <span>تسجيل</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: BIG GREEN CHECKMARK POPUP (FIRST STEP OF REQUIREMENT) */}
        {step === 'checkmark' && checkedMember && (
          <div className="bg-[#0f172a]/95 border-2 border-emerald-500/50 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl text-center space-y-6 animate-scale-up">
            <div className="relative py-4 flex items-center justify-center">
              <div className="w-32 h-32 rounded-full bg-emerald-500/20 animate-ping absolute inset-0 mx-auto" />
              <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-2xl shadow-emerald-500/50 relative z-10">
                <CheckCircle className="w-16 h-16 text-slate-950 stroke-[2.5]" />
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-black text-white">تم تسجيل حضورك بنجاح!</h2>
              <p className="text-sm font-bold text-emerald-400 mt-1">
                أهلاً بك يا كابتن / {checkedMember.name}
              </p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                كود العضو: {checkedMember.code}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
              ✓ تم إشعار موظف الاستقبال بحضورك الآن، جاري تحويلك لعرض متبقي اشتراكك...
            </div>

            <button
              onClick={() => setStep('details')}
              className="w-full py-3 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition cursor-pointer"
            >
              <span>عرض تفاصيل الاشتراك والمتبقي الآن</span>
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
              <p className="text-xs text-slate-400 font-mono">{checkedMember.code} - {checkedMember.name}</p>
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
                <span className="font-mono text-slate-300">{formatDateAr(checkedMember.endDate)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2.5 pt-2">
              <button
                onClick={handleReset}
                className="w-full py-3.5 px-4 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs transition cursor-pointer shadow-lg shadow-teal-500/20"
              >
                تسجيل حضور لاعب آخر (Scan Again)
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
