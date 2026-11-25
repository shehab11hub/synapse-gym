import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Users,
  Dumbbell,
  MapPin,
  Tag,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Trash2,
  Stethoscope,
  Play,
  Square,
  RotateCcw,
  X,
  LogOut,
  Settings,
} from 'lucide-react';
import { useGymData } from '../context/GymDataContext';
import { GymSession, SessionCategory } from '../types';
import { formatEGP } from '../utils/formatters';
import { CheckOutSettlementModal } from '../components/CheckOutSettlementModal';
import { sounds } from '../utils/sound';

const formatElapsedHMS = (startIso: string, nowMs: number): string => {
  const diffSec = Math.max(0, Math.floor((nowMs - new Date(startIso).getTime()) / 1000));
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const SessionsPage: React.FC = () => {
  const {
    sessions,
    coaches,
    members,
    checkInLogs,
    isAfterLastClosing,
    addSession,
    updateSession,
    deleteSession,
    startSession,
    endSession,
    removePlayerFromSession,
    toggleSessionCoachCompletion,
    toggleMemberAsDoctor,
    calculatePlayerCheckOutQuote,
    completePlayerCheckOut,
  } = useGymData();

  // Live 1-second clock for individual per-player timers (HH:MM:SS)
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Add Session modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Edit Session Settings & Tiers modal state
  const [editingSession, setEditingSession] = useState<GymSession | null>(null);
  const [editTierForm, setEditTierForm] = useState({
    title: '',
    sport: '',
    hall: '',
    tier1Price: 150,
    tier2Price: 200,
    tier3Price: 300,
  });

  // Check-Out Settlement Modal state
  const [settlementLogId, setSettlementLogId] = useState<string | null>(null);
  const [checkOutNotice, setCheckOutNotice] = useState<string | null>(null);

  // New Session form (بدون إلزام بتوقيت محدد، زرار بداية ونهاية عند الطلب)
  const [form, setForm] = useState({
    title: '',
    sport: 'كروس فيت',
    hall: 'القاعة الكبرى A',
    sessionCategory: 'group' as SessionCategory,
    coachIds: [] as string[],
    tier1Price: 150,
    tier2Price: 200,
    tier3Price: 300,
  });

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || form.coachIds.length === 0) {
      alert('يرجى كتابة اسم الحصة واختيار مدرب واحد على الأقل');
      return;
    }

    const t1 = Math.max(0, Number(form.tier1Price) || 0);
    const t2 = Math.max(0, Number(form.tier2Price) || 0);
    const t3 = Math.max(0, Number(form.tier3Price) || 0);

    addSession({
      title: form.title,
      sport: form.sport,
      hall: form.hall,
      sessionCategory: form.sessionCategory,
      coachIds: form.coachIds,
      price: t1,
      tier1Price: t1,
      tier2Price: t2,
      tier3Price: t3,
      status: 'idle',
      daysOfWeek: [0, 1, 2, 3, 4],
      enrolledPlayerIds: [],
      temporaryPlayerIds: [],
    });

    setIsAddModalOpen(false);
    setForm({
      title: '',
      sport: 'كروس فيت',
      hall: 'القاعة الكبرى A',
      sessionCategory: 'group',
      coachIds: [],
      tier1Price: 150,
      tier2Price: 200,
      tier3Price: 300,
    });
  };

  const openEditSessionModal = (session: GymSession) => {
    setEditingSession(session);
    setEditTierForm({
      title: session.title,
      sport: session.sport,
      hall: session.hall,
      tier1Price: session.tier1Price ?? session.price ?? 150,
      tier2Price: session.tier2Price ?? 200,
      tier3Price: session.tier3Price ?? 300,
    });
  };

  const handleSaveEditSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession) return;
    const t1 = Math.max(0, Number(editTierForm.tier1Price) || 0);
    const t2 = Math.max(0, Number(editTierForm.tier2Price) || 0);
    const t3 = Math.max(0, Number(editTierForm.tier3Price) || 0);

    updateSession(editingSession.id, {
      title: editTierForm.title.trim() || editingSession.title,
      sport: editTierForm.sport.trim() || editingSession.sport,
      hall: editTierForm.hall.trim() || editingSession.hall,
      price: t1,
      tier1Price: t1,
      tier2Price: t2,
      tier3Price: t3,
    });
    sounds.playSuccessDing();
    setEditingSession(null);
  };

  const handlePlayerCheckOut = async (logId: string) => {
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
          setCheckOutNotice(
            `✅ تم تسجيل خروج ${quote.log.memberName} (${quote.durationMinutes} دقيقة - الشريحة الأولى) بدون رسوم إضافية`
          );
          setTimeout(() => setCheckOutNotice(null), 5000);
        }
      } catch (err: any) {
        alert(err?.message || 'تعذر الاتصال بقاعدة البيانات');
      }
    } else {
      setSettlementLogId(logId);
    }
  };

  const handleCoachSelect = (coachId: string) => {
    if (form.coachIds.includes(coachId)) {
      setForm({
        ...form,
        coachIds: form.coachIds.filter((id) => id !== coachId),
      });
    } else {
      if (form.coachIds.length >= 2) {
        alert('يمكنك اختيار مدربين اثنين كحد أقصى للحصة الواحدة');
        return;
      }
      setForm({
        ...form,
        coachIds: [...form.coachIds, coachId],
      });
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Header & Add Session Button */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#0f172a]/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-white">جدول الحصص والتمارين (بدء وإنهاء عند الطلب)</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold">
              {sessions.length} حصص
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            بدء وإنهاء الحصص يدويًا بنقرة زر واحدة دون تقيد بمواعيد ساعات محددة — الحصص الجارية تمنع تقفيل اليومية حتى إنهائها
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Active Tracker Badges */}
          <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-2xl text-xs">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>جارية الآن: {sessions.filter((s) => s.status === 'in-progress').length}</span>
            </div>
            <span className="text-slate-600">|</span>
            <div className="text-slate-400 font-medium">
              <span>مكتملة: {sessions.filter((s) => s.status === 'completed').length}</span>
            </div>
          </div>

          {/* Add Session Button */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="py-3 px-5 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-teal-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة حصة جديدة (Add Session)</span>
          </button>
        </div>
      </div>

      {/* Check-Out Notification Banner */}
      {checkOutNotice && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-black flex items-center justify-between animate-scale-up">
          <span>{checkOutNotice}</span>
          <button
            onClick={() => setCheckOutNotice(null)}
            className="p-1 text-emerald-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sessions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sessions.map((session) => {
          const isRunning = session.status === 'in-progress';
          const isDone = session.status === 'completed';

          // Helper: get active check-in log for a player inside this session today
          const getActiveLog = (memberId: string) =>
            checkInLogs.find(
              (l) =>
                l.memberId === memberId &&
                l.assignedSessionId === session.id &&
                l.seatingStatus === 'assigned' &&
                l.checkOutStatus !== 'checked_out' &&
                isAfterLastClosing(l.timestamp)
            );

          const tier1 = session.tier1Price ?? session.price ?? 0;
          const tier2 = session.tier2Price ?? tier1;
          const tier3 = session.tier3Price ?? tier2;

          // Assigned coaches
          const assignedCoaches = coaches.filter((c) => session.coachIds.includes(c.id));

          // Enrolled players (Permanent & Temporary)
          const enrolledPlayers = members.filter((m) =>
            session.enrolledPlayerIds.includes(m.id)
          );
          const temporaryPlayers = members.filter((m) =>
            (session.temporaryPlayerIds || []).includes(m.id)
          );
          const totalPlayersCount = enrolledPlayers.length + temporaryPlayers.length;

          const categoryLabel =
            session.sessionCategory === 'private'
              ? 'تدريب خاص PT'
              : session.sessionCategory === 'physio'
              ? 'علاج طبيعي وتأهيل'
              : session.sessionCategory === 'massage'
              ? 'مساج واستشفاء'
              : 'كلاس جماعي';

          return (
            <div
              key={session.id}
              className={`rounded-3xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                isRunning
                  ? 'bg-gradient-to-b from-[#0f1d33] to-[#0c1626] border-emerald-500/60 shadow-xl shadow-emerald-500/15 ring-1 ring-emerald-500/30'
                  : isDone
                  ? 'bg-[#0f172a]/90 border-slate-700/80'
                  : 'bg-[#0f172a]/60 border-slate-800/80 opacity-90 hover:opacity-100'
              }`}
            >
              {/* Top Card Bar with Price on Outside */}
              <div className="p-6 pb-4 border-b border-slate-800/80">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-teal-400 border border-teal-500/30">
                        {session.sport}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {categoryLabel}
                      </span>
                      {isRunning ? (
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5 animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                          <span>حصة جارية الآن (قيد التدريب)</span>
                        </span>
                      ) : isDone ? (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-blue-400" />
                          <span>تم إتمام الحصة اليوم</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          في انتظار البدء
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-black text-white mt-1.5">{session.title}</h3>
                  </div>

                  {/* PRICE DISPLAYED PROMINENTLY ON THE OUTSIDE (CLIENT TICKET PRICE) */}
                  <div className="text-left shrink-0">
                    <div className="text-[10px] text-slate-400">تذكرة العميل (Client Ticket)</div>
                    <div className="text-xl font-black text-teal-300">
                      {formatEGP(session.price)}
                    </div>
                  </div>
                </div>

                {/* Info row: Hall & Start/End Info */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span className="truncate">{session.hall}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>
                      {isRunning && session.startedAt
                        ? `بدأت: ${new Date(session.startedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`
                        : isDone && session.endedAt
                        ? `انتهت: ${new Date(session.endedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`
                        : 'جاهزة للبدء بنقرة زر'}
                    </span>
                  </div>
                </div>

                {/* START / END SESSION ACTION BUTTONS */}
                <div className="mt-3">
                  {isRunning ? (
                    <button
                      onClick={() => endSession(session.id)}
                      className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-600 hover:from-rose-600 hover:to-amber-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-500/25 transition cursor-pointer"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      <span>إنهاء الحصة الآن (End Session)</span>
                    </button>
                  ) : isDone ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>تم تنفيذ الحصة بالكامل</span>
                      </div>
                      <button
                        onClick={() => startSession(session.id)}
                        className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                        title="إعادة بدء جولة جديدة"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>إعادة بدء</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startSession(session.id)}
                      className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 transition cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>بدء الحصة الآن (Start Session)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Coaches Section (1 or 2 coaches) */}
              <div className="p-6 py-4 border-b border-slate-800/80 bg-slate-900/40">
                <div className="text-xs font-bold text-slate-400 mb-2 flex items-center justify-between">
                  <span>المدربين المسؤولين (محدد {assignedCoaches.length} مدرب):</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {assignedCoaches.map((c) => (
                    <div
                      key={c.id}
                      className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-300 font-bold text-xs flex items-center justify-center">
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{c.name}</div>
                          <div className="text-[10px] text-slate-400">{c.specialty}</div>
                        </div>
                      </div>

                      {/* Completed today checkbox for coach payroll integration */}
                      <button
                        onClick={() => toggleSessionCoachCompletion(session.id, c.id)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition flex items-center gap-1 ${
                          session.completedTodayByCoach?.[c.id]
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                        title="تأكيد إتمام الحصة لحساب مستحقات المدرب"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{session.completedTodayByCoach?.[c.id] ? 'تم الإتمام' : 'لم تنفذ'}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Enrolled Players (Permanent & Temporary Assignment) */}
              <div className="p-6 py-4 flex-1">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                    <Users className="w-3.5 h-3.5 text-teal-400" />
                    <span>اللاعبين بالحصة ({totalPlayersCount} لاعب - {enrolledPlayers.length} دائم + {temporaryPlayers.length} مؤقت)</span>
                  </div>
                </div>

                {totalPlayersCount > 0 ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {/* Permanent Players */}
                    {enrolledPlayers.map((player) => {
                      const activeLog = getActiveLog(player.id);
                      const timerStart = activeLog ? (activeLog.sessionStartedAt || activeLog.timestamp) : null;
                      return (
                      <div
                        key={player.id}
                        className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs hover:border-slate-700 transition"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
                            {player.code}
                          </span>
                          <span className="font-bold text-white">{player.name}</span>
                          <span className="text-[9px] bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded border border-teal-500/30 font-bold">
                            تسكين دائم
                          </span>
                          {player.type === 'doctor' && (
                            <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 rounded border border-purple-500/30">
                              طبيب
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {timerStart && (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-black px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              <Clock className="w-3 h-3 animate-pulse" />
                              <span>{formatElapsedHMS(timerStart, nowMs)}</span>
                            </span>
                          )}
                          {activeLog && (
                            <button
                              onClick={() => handlePlayerCheckOut(activeLog.id)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 font-black text-[10px] transition flex items-center gap-1 cursor-pointer"
                            >
                              <LogOut className="w-3 h-3" />
                              <span>تسجيل خروج</span>
                            </button>
                          )}
                          <span className="text-[10px] text-teal-400 font-medium">
                            متبقي: {player.remainingSessions} حصة
                          </span>
                          <button
                            onClick={() => removePlayerFromSession(session.id, player.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 rounded transition"
                            title="إلغاء التسكين في هذه الحصة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      );
                    })}

                    {/* Temporary Players for Today */}
                    {temporaryPlayers.map((player) => {
                      const activeLog = getActiveLog(player.id);
                      const timerStart = activeLog ? (activeLog.sessionStartedAt || activeLog.timestamp) : null;
                      return (
                      <div
                        key={`temp-${player.id}`}
                        className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs hover:border-amber-500/50 transition"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] bg-amber-900/40 px-1.5 py-0.5 rounded text-amber-300">
                            {player.code}
                          </span>
                          <span className="font-bold text-amber-200">{player.name}</span>
                          <span className="text-[9px] bg-amber-500/25 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/40 font-black">
                            مؤقت (اليوم فقط)
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {timerStart && (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-black px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              <Clock className="w-3 h-3 animate-pulse" />
                              <span>{formatElapsedHMS(timerStart, nowMs)}</span>
                            </span>
                          )}
                          {activeLog && (
                            <button
                              onClick={() => handlePlayerCheckOut(activeLog.id)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 font-black text-[10px] transition flex items-center gap-1 cursor-pointer"
                            >
                              <LogOut className="w-3 h-3" />
                              <span>تسجيل خروج</span>
                            </button>
                          )}
                          <button
                            onClick={() => removePlayerFromSession(session.id, player.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 rounded transition"
                            title="إلغاء الحضور المؤقت"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-900/30 border border-dashed border-slate-800 text-center text-xs text-slate-500">
                    لا يوجد لاعبين مسكنين بالحصة حالياً. يتم تسكين المتدربين من شاشة الاستقبال بعد سداد الرسوم أو الخصم من الباقة.
                  </div>
                )}

                {/* 3-Tier Duration Pricing Pill Strip */}
                <div className="mt-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                  <span className="text-slate-400 font-bold">شرائح المدة:</span>
                  <div className="flex items-center gap-2 flex-wrap font-mono">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                      0-90د: {formatEGP(tier1)}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      91-120د: {formatEGP(tier2)}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                      121-180د: {formatEGP(tier3)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Footer Actions */}
              <div className="p-6 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
                <button
                  onClick={() => openEditSessionModal(session)}
                  className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Settings className="w-3.5 h-3.5 text-teal-400" />
                  <span>إعدادات وتسعير الشرائح</span>
                </button>
                <button
                  onClick={() => deleteSession(session.id)}
                  className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition cursor-pointer"
                  title="حذف الحصة"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Session Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
          <div className="bg-[#0f172a] border border-slate-700/80 rounded-3xl max-w-2xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-[#0f172a]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">إضافة كلاس / حصة تدريبية جديدة</h3>
                  <p className="text-xs text-slate-400 mt-0.5">حدد بيانات الحصة والمدربين المسؤولين وسعر التذكرة</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form onSubmit={handleCreateSession} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم الحصة أو الكلاس *</label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="مثال: كروس فيت مكثف، كيك بوكسينغ، يوجا صباحية"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-500 transition"
                  />
                </div>

                {/* Sport & Hall */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">نوع الرياضة / النشاط</label>
                    <input
                      type="text"
                      value={form.sport}
                      onChange={(e) => setForm({ ...form, sport: e.target.value })}
                      placeholder="كروس فيت، لياقة، فنون قتال"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">القاعة أو الصالة</label>
                    <input
                      type="text"
                      value={form.hall}
                      onChange={(e) => setForm({ ...form, hall: e.target.value })}
                      placeholder="القاعة الرئيسية A"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-500 transition"
                    />
                  </div>
                </div>

                {/* Session Category & Ticket Price */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      تصنيف السيشن (Session Category)
                    </label>
                    <select
                      value={form.sessionCategory}
                      onChange={(e) => setForm({ ...form, sessionCategory: e.target.value as any })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 font-bold transition"
                    >
                      <option value="group">كلاس جماعي (Group Class)</option>
                      <option value="private">تدريب خاص (Private PT)</option>
                      <option value="physio">علاج طبيعي وتأهيل (Physio)</option>
                      <option value="massage">مساج واستشفاء (Massage)</option>
                      <option value="gym">اشتراك جيم عام (Gym)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-teal-300 mb-1.5">
                      السعر الأساسي (0 - 90 دقيقة) - ج.م
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={form.tier1Price}
                      onChange={(e) => setForm({ ...form, tier1Price: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-teal-500/50 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-400 font-bold font-mono transition"
                    />
                  </div>
                </div>

                {/* 3-Tier Duration Pricing Section */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      <span>تسعير الحصة حسب مدة التواجد (الشرائح الثلاث):</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-emerald-300 mb-1">
                        0 - 90 دقيقة (ساعة ونصف)
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={form.tier1Price}
                        onChange={(e) => setForm({ ...form, tier1Price: Number(e.target.value) })}
                        className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-amber-300 mb-1">
                        91 - 120 دقيقة (ساعتين)
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={form.tier2Price}
                        onChange={(e) => setForm({ ...form, tier2Price: Number(e.target.value) })}
                        className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-rose-300 mb-1">
                        121 - 180 دقيقة (3 ساعات)
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={form.tier3Price}
                        onChange={(e) => setForm({ ...form, tier3Price: Number(e.target.value) })}
                        className="w-full bg-slate-950 border border-rose-500/40 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-rose-400"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    💡 يبدأ عداد وقت فردي لكل لاعب عند التسكين، وعند تسجيل الخروج يُحسب الفرق تلقائياً بناءً على مدة تواجده.
                  </p>
                </div>

                {/* Coach Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-300">
                      اختر المدربين المسؤولين (مدرب أو مدربين اثنين):
                    </label>
                    <span className="text-[10px] text-slate-400">
                      تم اختيار {form.coachIds.length} كابتن
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1 bg-slate-950/40 rounded-2xl border border-slate-800/80">
                    {coaches.map((c) => {
                      const isSelected = form.coachIds.includes(c.id);
                      return (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => handleCoachSelect(c.id)}
                          className={`p-2.5 rounded-xl text-right text-xs transition border flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-teal-500/20 border-teal-500/80 text-teal-300 font-bold shadow-sm'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                            <div>
                              <div className="font-bold">{c.name}</div>
                              <div className="text-[10px] text-slate-500">{c.specialty}</div>
                            </div>
                          </div>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:p-5 border-t border-slate-800 bg-[#0f172a] shrink-0 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="py-2.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-6 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-teal-500/20 transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>حفظ وإضافة الحصة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Session Settings & 3-Tier Pricing Modal */}
      {editingSession && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
          <div className="bg-[#0f172a] border border-amber-500/40 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">تعديل إعدادات وتسعير الحصة</h3>
                  <p className="text-[11px] text-slate-400">{editingSession.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSession(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSession} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم الحصة</label>
                <input
                  type="text"
                  required
                  value={editTierForm.title}
                  onChange={(e) => setEditTierForm({ ...editTierForm, title: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">النشاط الرياضي</label>
                  <input
                    type="text"
                    value={editTierForm.sport}
                    onChange={(e) => setEditTierForm({ ...editTierForm, sport: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">القاعة</label>
                  <input
                    type="text"
                    value={editTierForm.hall}
                    onChange={(e) => setEditTierForm({ ...editTierForm, hall: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/90 border border-amber-500/30 space-y-3">
                <div className="text-xs font-black text-amber-300">تسعير الحصة حسب مدة التواجد:</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-300 mb-1">
                      0 - 90 دقيقة (أساسي)
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editTierForm.tier1Price}
                      onChange={(e) => setEditTierForm({ ...editTierForm, tier1Price: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-amber-300 mb-1">
                      91 - 120 دقيقة
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editTierForm.tier2Price}
                      onChange={(e) => setEditTierForm({ ...editTierForm, tier2Price: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-rose-300 mb-1">
                      121 - 180 دقيقة
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editTierForm.tier3Price}
                      onChange={(e) => setEditTierForm({ ...editTierForm, tier3Price: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-rose-500/40 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs cursor-pointer"
                >
                  حفظ التعديلات في قاعدة البيانات
                </button>
                <button
                  type="button"
                  onClick={() => setEditingSession(null)}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer"
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
        onCompleted={(msg) => {
          setCheckOutNotice(msg);
          setTimeout(() => setCheckOutNotice(null), 5000);
        }}
      />
    </div>
  );
};
