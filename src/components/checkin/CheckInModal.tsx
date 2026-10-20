import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  Calendar,
  Clock,
  Activity,
  Award,
  AlertCircle,
  UserCheck,
  Stethoscope,
  X,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Member } from '../../types';
import { sounds } from '../../utils/sound';
import { formatDateAr } from '../../utils/formatters';

interface CheckInModalProps {
  member: Member | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleDoctor: (memberId: string) => void;
}

export const CheckInModal: React.FC<CheckInModalProps> = ({
  member,
  isOpen,
  onClose,
  onToggleDoctor,
}) => {
  // Step 1: 'checkmark' (علامة صح خضراء كبيرة), Step 2: 'details' (تفاصيل الاشتراك والمتبقي)
  const [step, setStep] = useState<'checkmark' | 'details'>('checkmark');

  useEffect(() => {
    if (isOpen && member) {
      setStep('checkmark');
      sounds.playSuccessDing();

      // Trigger confetti
      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#14b8a6', '#10b981', '#06b6d4', '#ffffff'],
        });
      } catch {
        // Ignore
      }

      // Automatically transition from big checkmark to subscription details after 1.6s
      const timer = setTimeout(() => {
        setStep('details');
      }, 1600);

      return () => clearTimeout(timer);
    }
  }, [isOpen, member]);

  if (!isOpen || !member) return null;

  const isExpired = member.remainingDays <= 0 && member.remainingSessions <= 0;
  const isExpiringSoon = member.remainingDays <= 7 && member.remainingDays > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-slate-700/90 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative transition-all duration-300">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 transition z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* STEP 1: BIG GREEN CHECKMARK POPUP */}
        {step === 'checkmark' && (
          <div className="p-10 flex flex-col items-center justify-center text-center animate-scale-up">
            <div className="relative mb-6">
              <div className="w-32 h-32 rounded-full bg-emerald-500/20 flex items-center justify-center animate-ping absolute inset-0"></div>
              <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-xl shadow-emerald-500/40 relative z-10 glow-teal">
                <CheckCircle className="w-20 h-20 text-slate-950 stroke-[2.5]" />
              </div>
            </div>

            <h2 className="text-2xl font-black text-white mb-2">تم تسجيل الحضور بنجاح!</h2>
            <p className="text-sm text-emerald-400 font-bold mb-1">
              أهلاً بك يا كابتن / {member.name}
            </p>
            <p className="text-xs text-slate-400 font-mono">كود العضو: {member.code}</p>

            <button
              onClick={() => setStep('details')}
              className="mt-6 px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold text-xs flex items-center gap-2 border border-slate-700 transition"
            >
              <span>عرض تفاصيل ومتبقي الاشتراك الآن</span>
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            </button>
          </div>
        )}

        {/* STEP 2: SUBSCRIPTION DETAILS & REMAINING DAYS / SESSIONS */}
        {step === 'details' && (
          <div className="p-6">
            {/* Header info */}
            <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-slate-800">
              <div className="w-14 h-14 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 text-2xl font-black">
                {member.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white">{member.name}</h3>
                  {member.type === 'doctor' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                      <Stethoscope className="w-3 h-3" />
                      طبيب علاج طبيعي
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                  <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                    {member.code}
                  </span>
                  <span>{member.phone}</span>
                </div>
              </div>
            </div>

            {/* Subscription Status Highlight */}
            <div
              className={`p-4 rounded-2xl border mb-5 ${
                isExpired
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  : isExpiringSoon
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-teal-500/10 border-teal-500/30 text-teal-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold">باقة الاشتراك الحالية:</span>
                <span className="text-xs font-bold font-mono">
                  {isExpired ? 'الاشتراك منتهي' : isExpiringSoon ? 'أوشك على الانتهاء' : 'نشط وساري'}
                </span>
              </div>
              <div className="text-base font-extrabold text-white">
                {member.subscriptionPlan}
              </div>
            </div>

            {/* Counters: Remaining Days & Remaining Sessions */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {/* Remaining Days */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-teal-400" />
                  <span>الأيام المتبقية</span>
                </div>
                <div
                  className={`text-3xl font-black ${
                    member.remainingDays <= 5 ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {member.remainingDays}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  من إجمالي {member.totalDays} يوم
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  ينتهي: {formatDateAr(member.endDate)}
                </div>
              </div>

              {/* Remaining Sessions */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mb-1">
                  <Award className="w-3.5 h-3.5 text-cyan-400" />
                  <span>الحصص المتبقية</span>
                </div>
                <div
                  className={`text-3xl font-black ${
                    member.remainingSessions <= 2 ? 'text-amber-400' : 'text-cyan-400'
                  }`}
                >
                  {member.remainingSessions}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  من إجمالي {member.totalSessions} حصة
                </div>
                <div className="text-[10px] text-emerald-400 mt-1">
                  تم خصم حصة اليوم
                </div>
              </div>
            </div>

            {/* Quick Action: Toggle as Doctor / Physiotherapist */}
            <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200">
                    تحويل إلى طبيب علاج طبيعي
                  </div>
                  <div className="text-[10px] text-slate-400">
                    لتسجيله في صفحة غرف وتأجير العلاج الطبيعي
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onToggleDoctor(member.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  member.type === 'doctor'
                    ? 'bg-purple-500 text-white shadow-md shadow-purple-500/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                {member.type === 'doctor' ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>طبيب معتمد</span>
                  </>
                ) : (
                  <span>تعيين كطبيب</span>
                )}
              </button>
            </div>

            {/* Bottom Button */}
            <button
              onClick={onClose}
              className="w-full py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs transition"
            >
              تمت المراجعة وإغلاق النافذة
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
