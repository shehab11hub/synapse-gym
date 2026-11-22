import React, { useState } from 'react';
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
} from 'lucide-react';
import { useGymData } from '../context/GymDataContext';
import { GymSession, SessionCategory } from '../types';
import { formatEGP } from '../utils/formatters';

export const SessionsPage: React.FC = () => {
  const {
    sessions,
    coaches,
    members,
    addSession,
    deleteSession,
    startSession,
    endSession,
    removePlayerFromSession,
    toggleSessionCoachCompletion,
    toggleMemberAsDoctor,
  } = useGymData();

  // Add Session modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New Session form (بدون إلزام بتوقيت محدد، زرار بداية ونهاية عند الطلب)
  const [form, setForm] = useState({
    title: '',
    sport: 'كروس فيت',
    hall: 'القاعة الكبرى A',
    sessionCategory: 'group' as SessionCategory,
    coachIds: [] as string[],
    price: 150,
    durationMinutes: 60,
  });

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || form.coachIds.length === 0) {
      alert('يرجى كتابة اسم الحصة واختيار مدرب واحد على الأقل');
      return;
    }

    addSession({
      title: form.title,
      sport: form.sport,
      hall: form.hall,
      sessionCategory: form.sessionCategory,
      coachIds: form.coachIds,
      price: Number(form.price),
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
      price: 150,
      durationMinutes: 60,
    });
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

      {/* Sessions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sessions.map((session) => {
          const isRunning = session.status === 'in-progress';
          const isDone = session.status === 'completed';

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
                    {enrolledPlayers.map((player) => (
                      <div
                        key={player.id}
                        className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between text-xs hover:border-slate-700 transition"
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
                    ))}

                    {/* Temporary Players for Today */}
                    {temporaryPlayers.map((player) => (
                      <div
                        key={`temp-${player.id}`}
                        className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-center justify-between text-xs hover:border-amber-500/50 transition"
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
                          <button
                            onClick={() => removePlayerFromSession(session.id, player.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 rounded transition"
                            title="إلغاء الحضور المؤقت"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-900/30 border border-dashed border-slate-800 text-center text-xs text-slate-500">
                    لا يوجد لاعبين مسكنين بالحصة حالياً. يتم تسكين المتدربين من شاشة الاستقبال بعد سداد الرسوم أو الخصم من الباقة.
                  </div>
                )}
              </div>

              {/* Bottom Footer Actions */}
              <div className="p-6 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
                <span className="text-[11px]">
                  التسكين دائم تلقائياً للحصص القادمة
                </span>
                <button
                  onClick={() => deleteSession(session.id)}
                  className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition"
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
                      سعر تذكرة العميل (Client Ticket) - ج.م
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-teal-500/50 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-400 font-bold font-mono transition"
                    />
                  </div>
                </div>

                {/* Duration & Live Mode info */}
                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">
                      المدة التقديرية للحصة (بالدقائق)
                    </label>
                    <span className="text-[11px] font-bold text-teal-400 bg-teal-500/10 px-2.5 py-0.5 rounded-lg border border-teal-500/20">
                      {form.durationMinutes} دقيقة
                    </span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="180"
                    step="15"
                    value={form.durationMinutes}
                    onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400">
                    💡 <span className="text-teal-300 font-bold">تحكم مباشر:</span> تبدأ الحصة وتنتهي بنقرة زر (بدء الحصة / إنهاء الحصة) بدون أي قيود زمنية جامدة.
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
    </div>
  );
};
