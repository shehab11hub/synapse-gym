import React, { useState, useEffect, useCallback } from 'react';
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
import { useGymData } from '../context/GymDataContext';
import { Member, SessionCategory, Coach, CheckInLog } from '../types';
import { DeskQRCodeModal } from '../components/checkin/DeskQRCodeModal';
import { CheckInModal } from '../components/checkin/CheckInModal';
import { formatDateAr, formatEGP } from '../utils/formatters';
import { generateQRDataUrl } from '../utils/qrGenerator';

export const ReceptionPage: React.FC = () => {
  const {
    members,
    findMemberByCode,
    performCheckIn,
    cancelCheckIn,
    toggleMemberAsDoctor,
    addMember,
    checkInLogs,
    coaches,
    sessions,
    assignPlayerToSession,
    assignArrivedMember,
  } = useGymData();

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

  // Seating & Routing Modal state
  const [isSeatingModalOpen, setIsSeatingModalOpen] = useState(false);
  const [selectedLogForSeating, setSelectedLogForSeating] = useState<CheckInLog | null>(null);
  const [seatingForm, setSeatingForm] = useState<{
    category: SessionCategory;
    coachId: string;
    sessionId: string;
    roomName: string;
    notes: string;
    paymentMode: 'coach_charge' | 'cash_drawer' | 'instapay';
    amount: number;
  }>({
    category: 'gym',
    coachId: '',
    sessionId: '',
    roomName: 'غرفة المساج والاستشفاء 1',
    notes: '',
    paymentMode: 'coach_charge',
    amount: 100,
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
    code: Math.floor(100000 + Math.random() * 900000).toString(),
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

  // Check-in trigger
  const handleTriggerCheckIn = (member: Member, method: 'qr' | 'manual' = 'manual') => {
    const res = performCheckIn(member.id, method);
    if (res.success && res.member) {
      setCheckedInMember(res.member);
      setIsCheckInModalOpen(true);
      setSelectedMember(res.member);
    }
  };

  // Quick Simulation: Simulate scanning the live rotating Desk QR by a random member
  const handleSimulateDeskQRScan = () => {
    if (members.length === 0) return;
    const randomMember = members[Math.floor(Math.random() * members.length)];
    handleTriggerCheckIn(randomMember, 'qr');
  };

  // Open Seating Modal
  const openSeatingModal = (log: CheckInLog) => {
    setSelectedLogForSeating(log);
    const defaultCoach = log.assignedCoachId || coaches[0]?.id || '';
    const defaultCategory = log.assignedCategory || 'gym';
    const defaultSession = log.assignedSessionId || (sessions[0]?.id || '');
    const defaultAmount =
      log.chargedAmount || getDefaultFeeForCategory(defaultCategory, defaultCoach, defaultSession);

    setSeatingForm({
      category: defaultCategory,
      coachId: defaultCoach,
      sessionId: defaultSession,
      roomName: 'غرفة المساج والاستشفاء 1',
      notes: '',
      paymentMode: log.paymentMode || 'coach_charge',
      amount: defaultAmount,
    });
    setIsSeatingModalOpen(true);
  };

  // Confirm Seating & Routing Action
  const handleConfirmSeating = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLogForSeating) return;

    assignArrivedMember(
      selectedLogForSeating.id,
      seatingForm.category,
      seatingForm.coachId,
      seatingForm.sessionId || undefined,
      seatingForm.notes,
      {
        paymentMode: seatingForm.paymentMode,
        amount: Number(seatingForm.amount) || 0,
        roomName: seatingForm.roomName,
      }
    );

    setIsSeatingModalOpen(false);
    setSelectedLogForSeating(null);
  };

  // Add Member
  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberForm.name || !newMemberForm.code) return;

    const created = addMember({
      name: newMemberForm.name,
      phone: newMemberForm.phone,
      code: newMemberForm.code.toUpperCase(),
      subscriptionPlan: newMemberForm.subscriptionPlan,
      subscriptionFee: Number(newMemberForm.subscriptionFee) || 0,
      paymentMethod: newMemberForm.paymentMethod,
      collectedByCoachId: newMemberForm.collectedByCoachId || undefined,
      sessionCategory: newMemberForm.sessionCategory,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + newMemberForm.totalDays * 86400000).toISOString().slice(0, 10),
      totalDays: Number(newMemberForm.totalDays),
      remainingDays: Number(newMemberForm.totalDays),
      totalSessions: Number(newMemberForm.totalSessions),
      remainingSessions: Number(newMemberForm.totalSessions),
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
      code: Math.floor(100000 + Math.random() * 900000).toString(),
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
                        {log.memberName.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-black text-white">{log.memberName}</div>
                        <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
                          <span>{log.memberCode}</span>
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
                      </div>
                    )}
                  </div>

                  {/* Seating CTA & Cancel Actions */}
                  <div className="flex items-center gap-2">
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
                    {selectedMember.remainingDays} يوم
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    من أصل {selectedMember.totalDays} يوم
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-center">
                  <div className="text-xs text-slate-400 mb-1 flex items-center justify-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>الحصص المتبقية</span>
                  </div>
                  <div className="text-2xl font-black text-cyan-400">
                    {selectedMember.remainingSessions} حصة
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    من أصل {selectedMember.totalSessions} حصة
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-center">
                  <div className="text-xs text-slate-400 mb-1 flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>حالة الاشتراك</span>
                  </div>
                  <div className="text-sm font-bold text-emerald-400 mt-1">
                    {selectedMember.active ? 'ساري وصالح' : 'معلق / منتهي'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    ينتهي: {formatDateAr(selectedMember.endDate)}
                  </div>
                </div>
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

      {/* Today's Live Check-in Log Table */}
      <div className="bg-[#0f172a]/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black text-white">سجل الحضور اليومي الكامل</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
              {checkInLogs.length} حركة تسجيل
            </span>
          </div>
          <span className="text-xs text-slate-400">يتم التحديث لحظياً عند كل مسح</span>
        </div>

        {checkInLogs.length > 0 ? (
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
                {checkInLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center text-xs font-bold">
                        {log.memberName.charAt(0)}
                      </div>
                      <span>{log.memberName}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">{log.memberCode}</td>
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
                      {log.subscriptionValid ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>ساري ومقبول</span>
                        </span>
                      ) : (
                        <span className="text-rose-400 font-bold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>منتهي</span>
                        </span>
                      )}
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
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-500">
            لا توجد تسجيلات حضور حتى الآن لليوم.
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
            <form onSubmit={handleConfirmSeating} className="flex flex-col flex-1 overflow-hidden min-h-0 pt-3">
              <div className="overflow-y-auto flex-1 space-y-4 pr-1 pl-1">
                {/* 1. Activity Category Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">
                    اختر وجهة ونوع نشاط اللاعب الآن:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setSeatingForm((prev) => ({
                          ...prev,
                          category: 'massage',
                          amount: getDefaultFeeForCategory('massage', prev.coachId),
                        }))
                      }
                      className={`p-3 rounded-2xl border text-right transition flex flex-col items-start gap-1 cursor-pointer ${
                        seatingForm.category === 'massage'
                          ? 'bg-purple-500/20 border-purple-500 text-purple-300 font-bold shadow-md shadow-purple-500/10'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-black">
                        <HeartHandshake className="w-4 h-4 text-purple-400 shrink-0" />
                        <span>💆‍♂️ مساج واستشفاء</span>
                      </div>
                      <div className="text-[10px] text-slate-400 leading-relaxed">
                        غرفة المساج (يبدأ بالانتظار ثم عداد الجلسة)
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setSeatingForm((prev) => ({
                          ...prev,
                          category: 'private',
                          amount: getDefaultFeeForCategory('private', prev.coachId),
                        }))
                      }
                      className={`p-3 rounded-2xl border text-right transition flex flex-col items-start gap-1 cursor-pointer ${
                        seatingForm.category === 'private'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow-md shadow-amber-500/10'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-black">
                        <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>🏋️‍♂️ تدريب خاص (برايفت PT)</span>
                      </div>
                      <div className="text-[10px] text-slate-400 leading-relaxed">
                        تمرين فردي مباشر وخاص مع الكابتن
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setSeatingForm((prev) => ({
                          ...prev,
                          category: 'group',
                          amount: getDefaultFeeForCategory('group', prev.coachId, prev.sessionId),
                        }))
                      }
                      className={`p-3 rounded-2xl border text-right transition flex flex-col items-start gap-1 cursor-pointer ${
                        seatingForm.category === 'group'
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold shadow-md shadow-cyan-500/10'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-black">
                        <Users className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>👥 كلاس تدريبي جماعي</span>
                      </div>
                      <div className="text-[10px] text-slate-400 leading-relaxed">
                        حصة جماعية (كروس فيت، سبينينغ، ملاكمة)
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setSeatingForm((prev) => ({
                          ...prev,
                          category: 'gym',
                          amount: getDefaultFeeForCategory('gym', prev.coachId, prev.sessionId),
                        }))
                      }
                      className={`p-3 rounded-2xl border text-right transition flex flex-col items-start gap-1 cursor-pointer ${
                        seatingForm.category === 'gym'
                          ? 'bg-teal-500/20 border-teal-500 text-teal-300 font-bold shadow-md shadow-teal-500/10'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-black">
                        <Dumbbell className="w-4 h-4 text-teal-400 shrink-0" />
                        <span>⚡ صالة الجيم العامة</span>
                      </div>
                      <div className="text-[10px] text-slate-400 leading-relaxed">
                        تمرين حر في أجهزة وأوزان الجيم
                      </div>
                    </button>
                  </div>
                </div>

                {/* 2. Coach Selection (مع كابتن مين) */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    مع كابتن مين (اختيار المدرب المسؤول):
                  </label>
                  <select
                    required
                    value={seatingForm.coachId}
                    onChange={(e) => {
                      const cId = e.target.value;
                      setSeatingForm((prev) => ({
                        ...prev,
                        coachId: cId,
                        amount: prev.amount || getDefaultFeeForCategory(prev.category, cId, prev.sessionId),
                      }));
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="">-- اختر الكابتن --</option>
                    {coaches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.specialty})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Session Selection for Group/Private/Gym */}
                {(seatingForm.category === 'group' ||
                  seatingForm.category === 'private' ||
                  seatingForm.category === 'gym') && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      اختر الحصة التدريبية لتسكين اللاعب بها:
                    </label>
                    <select
                      value={seatingForm.sessionId}
                      onChange={(e) => {
                        const sId = e.target.value;
                        const s = sessions.find((sess) => sess.id === sId);
                        setSeatingForm((prev) => ({
                          ...prev,
                          sessionId: sId,
                          amount: s ? s.price : prev.amount,
                        }));
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                    >
                      <option value="">-- تسكين مباشر مع الكابتن المختار --</option>
                      {sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title} ({s.startTime} - {s.endTime}) - {s.hall || 'القاعة الرئيسية'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 4. Room Name for Massage */}
                {seatingForm.category === 'massage' && (
                  <div className="p-3.5 rounded-2xl bg-purple-950/30 border border-purple-500/30 space-y-2">
                    <div className="text-xs font-bold text-purple-300">
                      غرفة المساج والاستشفاء:
                    </div>
                    <input
                      type="text"
                      value={seatingForm.roomName}
                      onChange={(e) => setSeatingForm({ ...seatingForm, roomName: e.target.value })}
                      placeholder="غرفة المساج والاستشفاء 1"
                      className="w-full bg-slate-900 border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                    <p className="text-[10px] text-purple-300/80">
                      💡 ستظهر الجلسة فوراً في صفحة العلاج الطبيعي والمساج بحالة <strong>"في الانتظار"</strong>، وعند دخول الغرفة يضغط المدرب <strong>"بدء الجلسة"</strong> لتشغيل العداد.
                    </p>
                  </div>
                )}

                {/* 5. PAYMENT HANDLING (التحميل على المدرب أو دفع كاش بالدرج) */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-teal-500/40 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-white flex items-center gap-1.5">
                      <Banknote className="w-4 h-4 text-teal-400" />
                      <span>طريقة المحاسبة (التحميل على المدرب أو الدفع كاش بالدرج):</span>
                    </label>
                    <span className="text-[10px] text-teal-300 font-bold">
                      {seatingForm.paymentMode === 'coach_charge'
                        ? 'تحميل على الكوتش'
                        : seatingForm.paymentMode === 'cash_drawer'
                        ? 'كاش بالدرج'
                        : 'إنستاباي'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    {/* Option 1: تحميل على المدرب */}
                    <button
                      type="button"
                      onClick={() => setSeatingForm({ ...seatingForm, paymentMode: 'coach_charge' })}
                      className={`p-3 rounded-2xl border text-right transition flex flex-col gap-1 cursor-pointer ${
                        seatingForm.paymentMode === 'coach_charge'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500/50 shadow-md shadow-amber-500/10'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-black text-xs flex items-center gap-1.5">
                          <User className="w-4 h-4 text-amber-400" />
                          <span>تحميل على المدرب</span>
                        </span>
                        {seatingForm.paymentMode === 'coach_charge' && (
                          <CheckCircle2 className="w-4 h-4 text-amber-400" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        يضاف على الكوتش كمديونية مستحقة للجيم
                      </p>
                    </button>

                    {/* Option 2: دفع كاش بالدرج */}
                    <button
                      type="button"
                      onClick={() => setSeatingForm({ ...seatingForm, paymentMode: 'cash_drawer' })}
                      className={`p-3 rounded-2xl border text-right transition flex flex-col gap-1 cursor-pointer ${
                        seatingForm.paymentMode === 'cash_drawer'
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/50 shadow-md shadow-emerald-500/10'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-black text-xs flex items-center gap-1.5">
                          <Banknote className="w-4 h-4 text-emerald-400" />
                          <span>دفع كاش بالاستقبال</span>
                        </span>
                        {seatingForm.paymentMode === 'cash_drawer' && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        الفلوس تروح فوراً للمصاريف وإدارة الدرج
                      </p>
                    </button>
                  </div>

                  {/* Amount input & Quick Chips */}
                  <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="w-full sm:w-auto">
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        المبلغ المطلوب تحصيله أو تحميله (ج.م):
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
                          className="w-full sm:w-36 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-black font-mono text-teal-400 focus:outline-none focus:border-teal-500"
                        />
                        <span className="absolute left-2.5 top-2 text-[10px] text-slate-500 font-bold">
                          ج.م
                        </span>
                      </div>
                    </div>

                    {/* Quick Value Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-center">
                      {[80, 100, 150, 180, 200].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setSeatingForm({ ...seatingForm, amount: val })}
                          className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer ${
                            seatingForm.amount === val
                              ? 'bg-teal-500 text-slate-950'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {val} ج.م
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic Feedback Alert */}
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] leading-relaxed">
                    {seatingForm.paymentMode === 'coach_charge' ? (
                      <span className="text-amber-300 font-medium flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>
                          💡 سيتم تحميل <strong>{formatEGP(seatingForm.amount)}</strong> كمديونية على الكابتن المسؤول، وتسمع في صفحة حسابات المدربين والتقرير الشامل بحالة <strong>"تحميل"</strong>.
                        </span>
                      </span>
                    ) : (
                      <span className="text-emerald-300 font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>
                          💵 سيتم توريد <strong>{formatEGP(seatingForm.amount)}</strong> كاش فوراً إلى الخزينة، وتزيد رصيد الدرج في صفحة المصاريف تلقائياً.
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    ملاحظات إضافية (اختياري):
                  </label>
                  <input
                    type="text"
                    value={seatingForm.notes}
                    onChange={(e) => setSeatingForm({ ...seatingForm, notes: e.target.value })}
                    placeholder="مثال: اللاعب يركز على عضلات الظهر اليوم..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Modal Fixed Footer Actions */}
              <div className="flex items-center gap-3 pt-3 mt-2 border-t border-slate-800 shrink-0">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-teal-500/20 transition cursor-pointer"
                >
                  تأكيد التسكين والتوجيه فوراً
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSeatingModalOpen(false);
                    setSelectedLogForSeating(null);
                  }}
                  className="py-3 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">عدد الأيام</label>
                  <input
                    type="number"
                    value={newMemberForm.totalDays}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, totalDays: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">عدد الحصص</label>
                  <input
                    type="number"
                    value={newMemberForm.totalSessions}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, totalSessions: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-teal-500/20"
                >
                  حفظ وتسجيل الاشتراك
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
    </div>
  );
};
