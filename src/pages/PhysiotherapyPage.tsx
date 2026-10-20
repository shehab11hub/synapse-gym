import React, { useState } from 'react';
import {
  Activity,
  Clock,
  DollarSign,
  Plus,
  Play,
  Pause,
  CheckCircle,
  Stethoscope,
  Sparkles,
  QrCode,
  Building,
  User,
  AlertCircle,
  Receipt,
  Smartphone,
  CreditCard,
  Banknote,
  ArrowUpRight,
  HeartHandshake,
  Timer,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useGymData } from '../context/GymDataContext';
import { PhysioBooking } from '../types';
import { formatEGP } from '../utils/formatters';
import { sounds } from '../utils/sound';

export const PhysiotherapyPage: React.FC = () => {
  const {
    physioBookings,
    startPhysioSession,
    beginPhysioSession,
    finishPhysioSession,
    addExtraFeeToPhysio,
    pausePhysioSession,
    resumePhysioSession,
    billPhysioSession,
    members,
    coaches,
  } = useGymData();

  // Filter members marked as doctors
  const doctorsList = members.filter((m) => m.type === 'doctor');

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedBookingForCheckout, setSelectedBookingForCheckout] = useState<PhysioBooking | null>(null);
  const [selectedBookingForReceipt, setSelectedBookingForReceipt] = useState<PhysioBooking | null>(null);

  // Manual Extra Fee / Overtime Modal state
  const [isExtraFeeModalOpen, setIsExtraFeeModalOpen] = useState(false);
  const [selectedBookingForExtraFee, setSelectedBookingForExtraFee] = useState<PhysioBooking | null>(null);
  const [manualExtraAmount, setManualExtraAmount] = useState<number>(50);
  const [manualExtraReason, setManualExtraReason] = useState<string>('تجاوز وقت الجلسة أكثر من ساعة (وقت إضافي)');

  // Checkout form state
  const [checkoutMode, setCheckoutMode] = useState<'player_cash' | 'doctor_cash' | 'instapay' | 'coach_debt'>('player_cash');
  const [instapayRef, setInstapayRef] = useState('');
  const [selectedCoachForDebt, setSelectedCoachForDebt] = useState(coaches[0]?.id || '');
  const [checkoutNotes, setCheckoutNotes] = useState('');

  // New Booking Form
  const [form, setForm] = useState({
    doctorName: '',
    doctorCode: '',
    patientName: '',
    roomName: 'عيادة التأهيل الطبي 1',
    hourlyRate: 150,
    serviceType: 'physio' as 'physio' | 'massage',
  });

  const handleStartBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.doctorName || !form.patientName) {
      alert('يرجى ملء بيانات الطبيب والمريض');
      return;
    }

    startPhysioSession({
      doctorName: form.doctorName,
      doctorCode: form.doctorCode || 'DOC-01',
      patientName: form.patientName,
      roomName: form.roomName,
      hourlyRate: Number(form.hourlyRate),
      serviceType: form.serviceType,
      status: 'active',
    });

    sounds.playSuccessDing();
    setIsNewModalOpen(false);
    setForm({
      doctorName: '',
      doctorCode: '',
      patientName: '',
      roomName: 'عيادة التأهيل الطبي 1',
      hourlyRate: 150,
      serviceType: 'physio',
    });
  };

  const handleQuickDoctorScan = (doc: typeof members[0]) => {
    startPhysioSession({
      doctorName: doc.name,
      doctorCode: doc.code,
      patientName: 'مريض جلسة تأهيل',
      roomName: 'عيادة التأهيل الطبي 1',
      hourlyRate: 150,
      serviceType: 'physio',
      status: 'active',
    });
    sounds.playSuccessDing();
  };

  const openCheckoutModal = (booking: PhysioBooking) => {
    setSelectedBookingForCheckout(booking);
    setCheckoutMode('player_cash');
    setInstapayRef('');
    setCheckoutNotes('');
    const matchingCoach = coaches.find((c) => c.name.includes(booking.doctorName));
    if (matchingCoach) {
      setSelectedCoachForDebt(matchingCoach.id);
    } else if (coaches[0]) {
      setSelectedCoachForDebt(coaches[0].id);
    }
  };

  const openExtraFeeModal = (booking: PhysioBooking) => {
    setSelectedBookingForExtraFee(booking);
    setManualExtraAmount(50);
    setManualExtraReason('تجاوز وقت الجلسة ساعة كاملة (وقت إضافي)');
    setIsExtraFeeModalOpen(true);
  };

  const handleConfirmExtraFee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingForExtraFee) return;

    addExtraFeeToPhysio(
      selectedBookingForExtraFee.id,
      Number(manualExtraAmount) || 0,
      manualExtraReason
    );
    sounds.playCashRegister();
    setIsExtraFeeModalOpen(false);
    setSelectedBookingForExtraFee(null);
  };

  const handleConfirmCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingForCheckout) return;

    if (checkoutMode === 'instapay' && !instapayRef.trim()) {
      alert('يرجى إدخال كود أو رقم تحويل انستاباي للتحقق والتأكيد');
      return;
    }

    if (checkoutMode === 'player_cash') {
      billPhysioSession(selectedBookingForCheckout.id, {
        billedTo: 'patient',
        paymentMethod: 'cash',
        notes: checkoutNotes || 'سداد نقدي بالاستقبال من اللاعب',
      });
    } else if (checkoutMode === 'doctor_cash') {
      billPhysioSession(selectedBookingForCheckout.id, {
        billedTo: 'doctor',
        paymentMethod: 'cash',
        notes: checkoutNotes || 'سداد نقدي مباشر من الطبيب/الكوتش بالاستقبال',
      });
    } else if (checkoutMode === 'instapay') {
      billPhysioSession(selectedBookingForCheckout.id, {
        billedTo: 'patient',
        paymentMethod: 'instapay',
        instapayRef: instapayRef.trim(),
        notes: checkoutNotes || `تحويل انستاباي - كود: ${instapayRef.trim()}`,
      });
    } else if (checkoutMode === 'coach_debt') {
      billPhysioSession(selectedBookingForCheckout.id, {
        billedTo: 'coach',
        paymentMethod: 'coach_debt',
        chargedToCoachId: selectedCoachForDebt,
        notes: checkoutNotes || 'تحميل على حساب الكابتن كمديونية للجيم تسدد بنهاية الشهر',
      });
    }

    sounds.playCashRegister();
    const settledBooking = {
      ...selectedBookingForCheckout,
      paid: checkoutMode !== 'coach_debt',
      paymentMethod: checkoutMode === 'coach_debt' ? ('coach_debt' as const) : checkoutMode === 'instapay' ? ('instapay' as const) : ('cash' as const),
    };
    setSelectedBookingForCheckout(null);
    setSelectedBookingForReceipt(settledBooking);
  };

  const waitingBookings = physioBookings.filter((b) => b.status === 'waiting');
  const activeBookings = physioBookings.filter((b) => b.status === 'active' || b.status === 'paused');
  const completedBookings = physioBookings.filter((b) => b.status === 'completed');

  // Calculate live stats
  const totalPhysioRevToday = completedBookings.reduce((acc, b) => acc + b.totalFee, 0);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner & Stats */}
      <div className="bg-gradient-to-r from-[#17153a] via-[#1b1740] to-[#12102e] border border-purple-500/20 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
            <Stethoscope className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">تأجير غرف العلاج الطبيعي والمساج</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                محاسبة بالساعة وبنظام المديونيات
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              إيقاف واستئناف العداد، بدء الجلسات المسكنة من الاستقبال، إضافة تكلفة يدوية عند تجاوز الساعة، وحساب المبلغ المراد تحصيله
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-center">
            <div className="text-[10px] text-slate-400">إيراد التأجير المنفذ اليوم</div>
            <div className="text-lg font-black text-purple-300">{formatEGP(totalPhysioRevToday)}</div>
          </div>

          <button
            onClick={() => setIsNewModalOpen(true)}
            className="py-3 px-5 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-purple-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>حجز غرفة جديدة (Start Physio/Massage)</span>
          </button>
        </div>
      </div>

      {/* 1. WAITING SESSIONS FROM RECEPTION (جلسات مساج وتأهيل في الانتظار تم تسكينهم من الاستقبال) */}
      {waitingBookings.length > 0 && (
        <div className="bg-gradient-to-br from-[#1d1435] via-[#16112d] to-[#0f0c20] border-2 border-purple-500/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping"></span>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <HeartHandshake className="w-5 h-5 text-purple-400" />
                <span>جلسات مساج وتأهيل في الانتظار (تم تسكينهم من شاشة الاستقبال)</span>
              </h3>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono">
              {waitingBookings.length} في الانتظار
            </span>
          </div>
          <p className="text-xs text-slate-300 mb-5">
            هؤلاء اللاعبين تم توجيههم من موظف الاستقبال وهم جاهزون للدخول. اضغط <strong className="text-emerald-400 font-bold">"بدء الجلسة"</strong> فور دخول اللاعب الغرفة لبدء تشغيل العداد الفعلي.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {waitingBookings.map((b) => (
              <div
                key={b.id}
                className="p-5 rounded-2xl bg-slate-900/90 border border-purple-500/40 flex flex-col justify-between shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {b.roomName}
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      في الانتظار (لم يبدأ العداد)
                    </span>
                  </div>

                  <h4 className="text-sm font-black text-white flex items-center gap-1.5 mb-1">
                    <span>{b.serviceType === 'massage' ? '💆‍♂️ جلسة مساج' : '🩺 علاج طبيعي'}:</span>
                    <span className="text-purple-300">{b.patientName}</span>
                  </h4>
                  <p className="text-xs text-slate-400 mb-3">
                    مع المدرب / الدكتور: <strong className="text-white">{b.doctorName}</strong>
                  </p>

                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs flex justify-between items-center mb-4">
                    <span className="text-slate-400">سعر الساعة المعتمد:</span>
                    <span className="font-bold text-emerald-400 font-mono">{formatEGP(b.hourlyRate)}</span>
                  </div>
                </div>

                {/* THE START SESSION BUTTON */}
                <button
                  type="button"
                  onClick={() => {
                    beginPhysioSession(b.id);
                    sounds.playSuccessDing();
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>بدء الجلسة الآن وتشغيل العداد</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Doctor QR Scan Bar */}
      <div className="bg-[#0f172a]/90 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-black text-white">
              أطباء العلاج الطبيعي المسجلين (دخول سريع للغرفة)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            ({doctorsList.length} أطباء متاحين)
          </span>
        </div>

        {doctorsList.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {doctorsList.map((doc) => (
              <div
                key={doc.id}
                className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5 text-purple-400" />
                    <span>{doc.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{doc.code}</div>
                </div>

                <button
                  onClick={() => handleQuickDoctorScan(doc)}
                  className="px-2.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500 text-purple-300 hover:text-white font-bold text-[11px] border border-purple-500/30 transition flex items-center gap-1"
                >
                  <Play className="w-3 h-3" />
                  <span>دخول الغرفة والبدء</span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-900/40 text-center text-xs text-slate-500">
            لا يوجد حالياً أعضاء مصنفين كأطباء علاج طبيعي. يمكنك تحويل أي شخص لطبيب من صفحة الاستقبال!
          </div>
        )}
      </div>

      {/* Active Sessions with Live Timers, Pause/Resume, & Extra Fee */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span>الغرف المشغولة حالياً (العداد والمبلغ المراد تحصيله)</span>
          </h3>
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            {activeBookings.length} غرف قيد التشغيل
          </span>
        </div>

        {activeBookings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeBookings.map((booking) => {
              const hours = Math.floor(booking.elapsedMinutes / 60);
              const mins = booking.elapsedMinutes % 60;
              const isPaused = booking.status === 'paused' || booking.isPaused;
              const baseCalculatedFee = booking.totalFee - (booking.extraFee || 0);

              return (
                <div
                  key={booking.id}
                  className={`p-6 rounded-3xl border shadow-xl relative overflow-hidden transition ${
                    isPaused
                      ? 'bg-gradient-to-b from-[#241a10] to-[#17100b] border-amber-500/40'
                      : 'bg-gradient-to-b from-[#181335] to-[#120f26] border-purple-500/40 shadow-purple-500/10'
                  }`}
                >
                  {/* Top line with Status badge */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {booking.roomName}
                        </span>
                        {isPaused ? (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                            <Pause className="w-3 h-3" />
                            موقوف مؤقتاً
                          </span>
                        ) : (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                            العداد نشط
                          </span>
                        )}
                        {booking.serviceType === 'massage' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                            مساج
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-black text-white mt-1.5">
                        {booking.doctorName}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        اللاعب / المريض: <span className="text-slate-200 font-bold">{booking.patientName}</span>
                      </p>
                    </div>

                    <div className="text-left">
                      <div className="text-[10px] text-slate-400">سعر الساعة</div>
                      <div className="text-sm font-black text-purple-300">
                        {formatEGP(booking.hourlyRate)}
                      </div>
                    </div>
                  </div>

                  {/* STOPWATCH COUNTER & PAUSE/RESUME BUTTON */}
                  <div className="my-5 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-center relative">
                    <div className="text-xs text-slate-400 mb-1 flex items-center justify-center gap-1.5">
                      <Clock className={`w-4 h-4 text-purple-400 ${!isPaused ? 'animate-spin' : ''}`} />
                      <span>الوقت المستغرق حتى اللحظة</span>
                    </div>

                    <div className="text-3xl font-black font-mono text-purple-200 tracking-wider">
                      {hours > 0 ? `${hours} ساعة و ` : ''}
                      {mins} دقيقة
                    </div>

                    <div className="mt-2 text-xs font-bold text-slate-400 flex items-center justify-center gap-1">
                      <span>بدأت الجلسة الساعة:</span>
                      <span className="text-slate-200 font-mono">
                        {new Date(booking.startTime).toLocaleTimeString('ar-EG', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </span>
                    </div>

                    {/* Pause / Resume & Finish Session Controls */}
                    <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-center gap-2 flex-wrap">
                      {isPaused ? (
                        <button
                          onClick={() => resumePhysioSession(booking.id)}
                          className="py-1.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>استئناف العداد</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => pausePhysioSession(booking.id)}
                          className="py-1.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 font-bold text-xs flex items-center gap-1.5 transition"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          <span>إيقاف الوقت مؤقتاً</span>
                        </button>
                      )}

                      {/* Finish Session when Coach Finishes */}
                      <button
                        onClick={() => {
                          finishPhysioSession(booking.id);
                          sounds.playSuccessDing();
                        }}
                        className="py-1.5 px-3 rounded-xl bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/40 font-bold text-xs flex items-center gap-1.5 transition"
                        title="إنهاء الجلسة واكتمال المدرب"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>إنهاء واكتمال المدرب</span>
                      </button>
                    </div>
                  </div>

                  {/* PROMINENT AMOUNT DUE BOX (الرقم المراد تحصيله + تكلفة يدوية إضافية) */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 to-indigo-950/40 border border-purple-500/30 space-y-2 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-purple-300 flex items-center gap-1">
                          <DollarSign className="w-4 h-4 text-purple-400" />
                          <span>المبلغ المراد تحصيله الآن:</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          الأجر الأساسي ({booking.elapsedMinutes} دقيقة): {formatEGP(baseCalculatedFee)}
                        </div>
                      </div>
                      <div className="text-2xl font-black text-white font-mono">
                        {formatEGP(booking.totalFee)}
                      </div>
                    </div>

                    {/* Show Overtime / Extra Fee badge if added */}
                    {booking.extraFee && booking.extraFee > 0 ? (
                      <div className="pt-2 border-t border-purple-500/20 flex items-center justify-between text-xs text-amber-300 font-bold">
                        <span>تكلفة إضافية يدوية ({booking.extraFeeReason || 'تجاوز ساعة'}):</span>
                        <span className="font-mono">+{formatEGP(booking.extraFee)}</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Dual Action Buttons: Add Manual Overtime Fee + Checkout */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* ADD MANUAL EXTRA FEE BUTTON (لو عدّوا ساعة أكتب الإضافة يدوياً) */}
                    <button
                      type="button"
                      onClick={() => openExtraFeeModal(booking)}
                      className="py-3 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs border border-amber-500/30 flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-amber-400" />
                      <span>إضافة تكلفة يدوية (تجاوز ساعة)</span>
                    </button>

                    {/* Checkout & Bill Action Button */}
                    <button
                      onClick={() => openCheckoutModal(booking)}
                      className="py-3 px-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>محاسبة الجلسة</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 rounded-3xl bg-[#0f172a]/60 border border-dashed border-slate-800 text-center text-xs text-slate-500">
            لا توجد جلسات علاج طبيعي نشطة في الغرف حالياً. اضغط "حجز غرفة جديدة" أو امسح كود الطبيب.
          </div>
        )}
      </div>

      {/* Completed Sessions Table */}
      <div className="bg-[#0f172a]/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <h3 className="text-base font-black text-white mb-4">سجل الجلسات المنتهية والمحاسب عليها</h3>

        {completedBookings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-3 px-4 font-bold">الطبيب / الكابتن</th>
                  <th className="py-3 px-4 font-bold">اللاعب / المريض</th>
                  <th className="py-3 px-4 font-bold">الغرفة</th>
                  <th className="py-3 px-4 font-bold">المدة</th>
                  <th className="py-3 px-4 font-bold">تكلفة إضافية</th>
                  <th className="py-3 px-4 font-bold">المبلغ المستحق</th>
                  <th className="py-3 px-4 font-bold">طريقة السداد / التحصيل</th>
                  <th className="py-3 px-4 font-bold">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {completedBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-bold text-white">{b.doctorName}</td>
                    <td className="py-3 px-4 text-slate-300">{b.patientName}</td>
                    <td className="py-3 px-4 text-slate-400">{b.roomName}</td>
                    <td className="py-3 px-4 font-mono text-purple-300">
                      {b.elapsedMinutes} دقيقة
                    </td>
                    <td className="py-3 px-4 font-mono text-amber-300">
                      {b.extraFee ? `+${formatEGP(b.extraFee)}` : '-'}
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-400">
                      {formatEGP(b.totalFee)}
                    </td>
                    <td className="py-3 px-4">
                      {b.paymentMethod === 'coach_debt' ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                          محمل كمديونية على الكابتن
                        </span>
                      ) : b.paymentMethod === 'instapay' ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
                          انستاباي ({b.instapayRef || 'معتمد'})
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                          نقداً بالاستقبال
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {b.paymentMethod === 'coach_debt' ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold">
                          تسوية آخر الشهر
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                          تم الدفع بالخزينة
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 text-center text-xs text-slate-500">
            لم تنته أي جلسة بعد لليوم.
          </div>
        )}
      </div>

      {/* MANUAL EXTRA FEE / OVERTIME MODAL (إضافة تكلفة يدوية لو عدّوا ساعة) */}
      {isExtraFeeModalOpen && selectedBookingForExtraFee && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-amber-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setIsExtraFeeModalOpen(false);
                setSelectedBookingForExtraFee(null);
              }}
              className="absolute top-5 left-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400">
                <Plus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">إضافة تكلفة يدوية (تجاوز الساعة)</h3>
                <p className="text-xs text-slate-400">
                  الجلسة: {selectedBookingForExtraFee.roomName} - {selectedBookingForExtraFee.patientName}
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmExtraFee} className="space-y-4">
              {/* Current Status */}
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">المدة الحالية:</span>
                  <span className="font-mono text-purple-300 font-bold">{selectedBookingForExtraFee.elapsedMinutes} دقيقة</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">الحساب الحالي:</span>
                  <span className="font-mono text-white font-bold">{formatEGP(selectedBookingForExtraFee.totalFee)}</span>
                </div>
              </div>

              {/* Extra Amount Input */}
              <div>
                <label className="block text-xs font-bold text-amber-300 mb-1">
                  المبلغ الإضافي المراد إضافته يدوياً (ج.م):
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={manualExtraAmount}
                  onChange={(e) => setManualExtraAmount(Number(e.target.value))}
                  placeholder="50"
                  className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-amber-400"
                />

                {/* Quick Chips */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] text-slate-400">مبالغ سريعة:</span>
                  {[50, 100, 150].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setManualExtraAmount(amt)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-[11px] text-slate-300 hover:bg-amber-500 hover:text-slate-950 font-bold transition"
                    >
                      +{amt} ج.م
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason Input */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  سبب الإضافة (ملاحظة تظهر في الفاتورة):
                </label>
                <input
                  type="text"
                  value={manualExtraReason}
                  onChange={(e) => setManualExtraReason(e.target.value)}
                  placeholder="مثال: تجاوز وقت الجلسة أكثر من ساعة (وقت إضافي للمدرب)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Total After Extra */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex justify-between items-center text-xs">
                <span className="font-bold text-slate-300">الإجمالي الجديد بعد الإضافة:</span>
                <span className="text-base font-black text-amber-300 font-mono">
                  {formatEGP(selectedBookingForExtraFee.totalFee + (Number(manualExtraAmount) || 0))}
                </span>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  إضافة التكلفة وتحديث الفاتورة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsExtraFeeModalOpen(false);
                    setSelectedBookingForExtraFee(null);
                  }}
                  className="py-3 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Checkout Modal (محاسبة الجلسة المراد تحصيلها: كاش لاعب، كاش كوتش، انستاباي، أو مديونية لآخر الشهر) */}
      {selectedBookingForCheckout && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-purple-500/40 rounded-3xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-lg font-black text-white mb-1 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-purple-400" />
              <span>محاسبة وإنهاء جلسة العلاج الطبيعي والمساج</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              اختر طريقة السداد: نقداً من اللاعب، أو من الكوتش، أو عبر انستاباي، أو كمديونية على الكابتن لآخر الشهر
            </p>

            <form onSubmit={handleConfirmCheckout} className="space-y-4">
              {/* Summary Cards */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">الطبيب / الكابتن:</span>
                  <span className="font-bold text-white">{selectedBookingForCheckout.doctorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">المريض / اللاعب:</span>
                  <span className="font-bold text-white">{selectedBookingForCheckout.patientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">المدة الفعلية:</span>
                  <span className="font-mono text-purple-300 font-bold">{selectedBookingForCheckout.elapsedMinutes} دقيقة</span>
                </div>

                {/* Extra Fee Breakdown if present */}
                {selectedBookingForCheckout.extraFee && selectedBookingForCheckout.extraFee > 0 ? (
                  <div className="flex justify-between text-amber-300">
                    <span>تكلفة إضافية (تجاوز ساعة / وقت إضافي):</span>
                    <span className="font-mono font-bold">+{formatEGP(selectedBookingForCheckout.extraFee)}</span>
                  </div>
                ) : null}

                <div className="flex justify-between border-t border-slate-800 pt-2 font-bold items-center">
                  <span className="text-slate-200">المبلغ المراد تحصيله النهائي:</span>
                  <span className="text-xl font-black text-emerald-400 font-mono">
                    {formatEGP(selectedBookingForCheckout.totalFee)}
                  </span>
                </div>
              </div>

              {/* Mode Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">طريقة تسوية الحساب:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckoutMode('player_cash')}
                    className={`p-3 rounded-2xl border text-right transition ${
                      checkoutMode === 'player_cash'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-black mb-1">
                      <Banknote className="w-4 h-4 text-emerald-400" />
                      <span>كاش من اللاعب</span>
                    </div>
                    <div className="text-[10px] text-slate-400">سداد فوري يضاف لدرج الخزينة</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCheckoutMode('doctor_cash')}
                    className={`p-3 rounded-2xl border text-right transition ${
                      checkoutMode === 'doctor_cash'
                        ? 'bg-purple-500/20 border-purple-500 text-purple-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-black mb-1">
                      <User className="w-4 h-4 text-purple-400" />
                      <span>كاش من الطبيب/الكوتش</span>
                    </div>
                    <div className="text-[10px] text-slate-400">دفع الكوتش مباشرة الآن للخزينة</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCheckoutMode('instapay')}
                    className={`p-3 rounded-2xl border text-right transition ${
                      checkoutMode === 'instapay'
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-black mb-1">
                      <Smartphone className="w-4 h-4 text-cyan-400" />
                      <span>تحويل انستاباي</span>
                    </div>
                    <div className="text-[10px] text-slate-400">سداد إلكتروني مع كود التحويل</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCheckoutMode('coach_debt')}
                    className={`p-3 rounded-2xl border text-right transition ${
                      checkoutMode === 'coach_debt'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-black mb-1">
                      <ArrowUpRight className="w-4 h-4 text-amber-400" />
                      <span>تحميل على الكابتن لآخر الشهر</span>
                    </div>
                    <div className="text-[10px] text-slate-400">مديونية تسدد عند تصفية الحساب</div>
                  </button>
                </div>
              </div>

              {/* Specific inputs based on checkoutMode */}
              {checkoutMode === 'instapay' && (
                <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 space-y-2">
                  <label className="block text-xs font-bold text-cyan-300">
                    رقم أو كود تحويل انستاباي (Reference Code):
                  </label>
                  <input
                    type="text"
                    required
                    value={instapayRef}
                    onChange={(e) => setInstapayRef(e.target.value)}
                    placeholder="مثال: IP-998823 أو اسم المحول"
                    className="w-full bg-slate-900 border border-cyan-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                  <p className="text-[10px] text-cyan-300/80">
                    سيتم تأكيد الإيداع في سجل تحويلات انستاباي فور الحفظ.
                  </p>
                </div>
              )}

              {checkoutMode === 'coach_debt' && (
                <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 space-y-2">
                  <label className="block text-xs font-bold text-amber-300">
                    اختر الكابتن / الطبيب لتحميل المديونية عليه:
                  </label>
                  <select
                    value={selectedCoachForDebt}
                    onChange={(e) => setSelectedCoachForDebt(e.target.value)}
                    className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {coaches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.specialty})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-amber-300/80">
                    💡 سيتم إضافة {formatEGP(selectedBookingForCheckout.totalFee)} تلقائياً كمديونية على الكابتن (عليه فلوس للجيم)، وتظل معلقة حتى يتم تحصيلها وتصفيتها.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">ملاحظات إضافية (اختياري)</label>
                <input
                  type="text"
                  value={checkoutNotes}
                  onChange={(e) => setCheckoutNotes(e.target.value)}
                  placeholder="ملاحظات على الجلسة أو السداد..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-slate-950 font-black text-xs shadow-lg transition"
                >
                  {checkoutMode === 'instapay'
                    ? 'تأكيد الدفع انستاباي وإصدار الفاتورة'
                    : checkoutMode === 'coach_debt'
                    ? 'تحميل المديونية على الكابتن لآخر الشهر'
                    : 'تأكيد استلام الكاش وإنهاء الجلسة'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBookingForCheckout(null)}
                  className="py-3 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Booking Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-purple-400" />
              <span>بدء جلسة وتأجير غرفة علاج طبيعي / مساج</span>
            </h3>

            <form onSubmit={handleStartBooking} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">نوع الخدمة</label>
                <select
                  value={form.serviceType}
                  onChange={(e) => setForm({ ...form, serviceType: e.target.value as 'physio' | 'massage' })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="physio">تأهيل وعلاج طبيعي (Physio)</option>
                  <option value="massage">مساج واستشفاء رياضي (Massage)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم الطبيب أو المدرب</label>
                <input
                  type="text"
                  required
                  value={form.doctorName}
                  onChange={(e) => setForm({ ...form, doctorName: e.target.value })}
                  placeholder="مثال: د. حسام فاروق"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم المريض أو اللاعب</label>
                <input
                  type="text"
                  required
                  value={form.patientName}
                  onChange={(e) => setForm({ ...form, patientName: e.target.value })}
                  placeholder="اسم اللاعب"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">اسم الغرفة</label>
                  <input
                    type="text"
                    value={form.roomName}
                    onChange={(e) => setForm({ ...form, roomName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">سعر الساعة (EGP)</label>
                  <input
                    type="number"
                    value={form.hourlyRate}
                    onChange={(e) => setForm({ ...form, hourlyRate: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs"
                >
                  بدء الجلسة وتشغيل العداد
                </button>
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="py-3 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {selectedBookingForReceipt && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-3">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-white">إيصال تأجير غرفة علاج طبيعي / مساج</h3>
            <p className="text-xs text-slate-400 mt-1">تم إنهاء الجلسة واستلام المبلغ</p>

            <div className="my-5 p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-right space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">الطبيب / المدرب:</span>
                <span className="font-bold text-white">{selectedBookingForReceipt.doctorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">المريض / اللاعب:</span>
                <span className="font-bold text-white">{selectedBookingForReceipt.patientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">المدة:</span>
                <span className="font-mono text-purple-300">{selectedBookingForReceipt.elapsedMinutes} دقيقة</span>
              </div>
              {selectedBookingForReceipt.extraFee && selectedBookingForReceipt.extraFee > 0 ? (
                <div className="flex justify-between text-amber-300">
                  <span>تكلفة إضافية (تجاوز ساعة):</span>
                  <span className="font-mono font-bold">+{formatEGP(selectedBookingForReceipt.extraFee)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-slate-800 pt-2 font-bold">
                <span className="text-slate-200">الإجمالي النهائي:</span>
                <span className="text-emerald-400 text-sm">{formatEGP(selectedBookingForReceipt.totalFee)}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedBookingForReceipt(null)}
              className="w-full py-2.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs"
            >
              تم
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
