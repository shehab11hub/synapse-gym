import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  X,
  Banknote,
  Smartphone,
  CreditCard,
  UserCheck,
  Package,
  AlertCircle,
} from 'lucide-react';
import { useGymData } from '../context/GymDataContext';
import { useAuth } from '../context/AuthContext';
import { formatEGP } from '../utils/formatters';
import { sounds } from '../utils/sound';

interface CheckOutSettlementModalProps {
  checkInLogId: string | null;
  onClose: () => void;
  onCompleted?: (msg: string) => void;
}

export const CheckOutSettlementModal: React.FC<CheckOutSettlementModalProps> = ({
  checkInLogId,
  onClose,
  onCompleted,
}) => {
  const { calculatePlayerCheckOutQuote, completePlayerCheckOut, coaches } = useGymData();
  const { currentUser } = useAuth();

  const [paymentMethod, setPaymentMethod] = useState<
    'cash' | 'instapay' | 'card' | 'coach_debt' | 'package_deduction'
  >('cash');
  const [selectedCoachId, setSelectedCoachId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const quote = checkInLogId ? calculatePlayerCheckOutQuote(checkInLogId) : null;

  useEffect(() => {
    if (quote) {
      setSelectedCoachId(quote.log.assignedCoachId || coaches[0]?.id || '');
      setPaymentMethod('cash');
      setNotes('');
    }
  }, [checkInLogId]);

  if (!checkInLogId || !quote) return null;

  const {
    log,
    session,
    member,
    entryTime,
    durationMinutes,
    tier,
    tierLabel,
    tierTotalPrice,
    paidAtEntry,
    extraFeeDue,
  } = quote;

  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  const durationFormatted =
    hours > 0 ? `${hours} ساعة و ${mins} دقيقة (${durationMinutes} دقيقة)` : `${durationMinutes} دقيقة`;

  const canDeductPackage = Boolean(member && (member.remainingSessions || 0) > 0);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (extraFeeDue > 0 && paymentMethod === 'coach_debt' && !selectedCoachId) {
      alert('يرجى اختيار الكابتن لتحميل فرق المدة عليه');
      return;
    }

    if (extraFeeDue > 0 && paymentMethod === 'package_deduction' && !canDeductPackage) {
      alert('عفواً، لا يوجد رصيد حصص كافٍ في باقة اللاعب لخصم حصة إضافية');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await completePlayerCheckOut(log.id, {
        paymentMethod,
        extraFee: extraFeeDue,
        durationMinutes,
        pricingTier: tier,
        coachId: paymentMethod === 'coach_debt' ? selectedCoachId : undefined,
        notes: notes.trim() || undefined,
        authorizedBy: currentUser?.name || 'الاستقبال',
      });

      if (res.success) {
        sounds.playCashRegister();
        onCompleted?.(
          extraFeeDue > 0
            ? `✅ تم تسجيل خروج ${log.memberName} (${durationMinutes} دقيقة) وتحصيل فرق ${formatEGP(extraFeeDue)}`
            : `✅ تم تسجيل خروج ${log.memberName} (${durationMinutes} دقيقة) بدون رسوم إضافية`
        );
        onClose();
      } else if (res.message) {
        alert(res.message);
      }
    } catch (err: any) {
      alert(err?.message || 'تعذر الاتصال بقاعدة البيانات أو الإنترنت ضعيف جداً.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4"
      dir="rtl"
    >
      <div className="bg-[#0f172a] border border-amber-500/40 rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col p-5 sm:p-6 shadow-2xl overflow-hidden animate-scale-up">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">تسوية خروج اللاعب وحساب المدة</h3>
              <p className="text-[11px] text-slate-400">
                {log.memberName} (#{log.memberCode}) • {session?.title || log.assignedSessionTitle || 'حصة تدريبية'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="overflow-y-auto flex-1 space-y-4 pt-4 pr-1 custom-scrollbar">
          {/* Duration & Tier Summary */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">وقت الدخول:</span>
              <span className="font-mono font-bold text-slate-200">
                {new Date(entryTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">إجمالي مدة البقاء داخل الحصة:</span>
              <span className="font-black text-amber-300 font-mono">{durationFormatted}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">الشريحة الزمنية المستحقة:</span>
              <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-[11px]">
                {tierLabel}
              </span>
            </div>
          </div>

          {/* Pricing Breakdown */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-[#11192e] border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>سعر الشريحة المستحقة من إعدادات الحصة:</span>
              <span className="font-mono font-bold">{formatEGP(tierTotalPrice)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>المدفوع مسبقاً عند الدخول (الشريحة الأولى):</span>
              <span className="font-mono">- {formatEGP(paidAtEntry)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-800">
              <span className="font-black text-white text-sm">فرق السعر الإضافي المستحق الآن:</span>
              <span
                className={`text-xl font-black font-mono ${
                  extraFeeDue > 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {formatEGP(extraFeeDue)}
              </span>
            </div>
          </div>

          {extraFeeDue > 0 ? (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-300">
                اختر طريقة تحصيل فرق السعر ({formatEGP(extraFeeDue)}):
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                    paymentMethod === 'cash'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>كاش بالدرج</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('instapay')}
                  className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                    paymentMethod === 'instapay'
                      ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>إنستاباي</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                    paymentMethod === 'card'
                      ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>فيزا / بطاقة</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('coach_debt')}
                  className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                    paymentMethod === 'coach_debt'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>تحميل على الكابتن</span>
                </button>

                <button
                  type="button"
                  disabled={!canDeductPackage}
                  onClick={() => setPaymentMethod('package_deduction')}
                  className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-1.5 cursor-pointer transition col-span-2 sm:col-span-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                    paymentMethod === 'package_deduction'
                      ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  <span>
                    خصم حصة إضافية من الباقة{' '}
                    {member ? `(متبقي: ${member.remainingSessions})` : ''}
                  </span>
                </button>
              </div>

              {paymentMethod === 'coach_debt' && (
                <div>
                  <label className="block text-xs font-bold text-amber-300 mb-1">
                    الكابتن المسؤول عن المديونية:
                  </label>
                  <select
                    value={selectedCoachId}
                    onChange={(e) => setSelectedCoachId(e.target.value)}
                    className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white font-bold"
                  >
                    {coaches
                      .filter((c) => c.active)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  ملاحظات (اختياري):
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="تفاصيل تسوية وقت الخروج..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>مدة التواجد ضمن الشريحة الأولى أو بدون فرق سعر مستحق.</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-black text-xs shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'جارِ التسجيل...'
                  : extraFeeDue > 0
                  ? `تأكيد الخروج وتحصيل ${formatEGP(extraFeeDue)}`
                  : 'تأكيد تسجيل الخروج الآن'}
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-700"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
