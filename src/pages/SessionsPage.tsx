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
  UserPlus,
  Trash2,
  Stethoscope,
} from 'lucide-react';
import { useGymData } from '../context/GymDataContext';
import { GymSession, SessionCategory } from '../types';
import { formatEGP, formatTime12h, isSessionActiveNow } from '../utils/formatters';

export const SessionsPage: React.FC = () => {
  const {
    sessions,
    coaches,
    members,
    addSession,
    deleteSession,
    assignPlayerToSession,
    removePlayerFromSession,
    toggleSessionCoachCompletion,
    toggleMemberAsDoctor,
  } = useGymData();

  // Add Session modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedSessionForEnroll, setSelectedSessionForEnroll] = useState<string | null>(null);

  // Time simulation toggle (Allows user to preview active vs inactive states easily)
  const [forceActiveDemo, setForceActiveDemo] = useState<boolean | null>(null);

  // New Session form
  const [form, setForm] = useState({
    title: '',
    sport: 'كروس فيت',
    hall: 'القاعة الكبرى A',
    sessionCategory: 'group' as SessionCategory,
    coachIds: [] as string[],
    price: 150,
    startTime: '18:00',
    endTime: '19:30',
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
      startTime: form.startTime,
      endTime: form.endTime,
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
      startTime: '18:00',
      endTime: '19:30',
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
            <h2 className="text-xl font-black text-white">جدول الحصص والتمارين اليومية</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold">
              {sessions.length} حصص
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            الحصص غير النشطة في الوقت الحالي تظهر بتأثير <span className="text-white font-bold underline">الأبيض والأسود</span>، بينما النشطة تظهر بألوانها الطبيعية
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Demo toggle for active/inactive */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-2 rounded-2xl text-xs text-slate-300">
            <span className="text-[11px] text-slate-400">معاينة التأثير:</span>
            <button
              onClick={() => setForceActiveDemo(null)}
              className={`px-2 py-1 rounded-lg transition text-[10px] font-bold ${
                forceActiveDemo === null ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}
            >
              الوقت الحقيقي
            </button>
            <button
              onClick={() => setForceActiveDemo(true)}
              className={`px-2 py-1 rounded-lg transition text-[10px] font-bold ${
                forceActiveDemo === true ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}
            >
              الكل نشط
            </button>
            <button
              onClick={() => setForceActiveDemo(false)}
              className={`px-2 py-1 rounded-lg transition text-[10px] font-bold ${
                forceActiveDemo === false ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              الكل أبيض وأسود
            </button>
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
          // Check if session is currently active based on real time or demo toggle
          const isRealActive = isSessionActiveNow(session.startTime, session.endTime);
          const isActive = forceActiveDemo !== null ? forceActiveDemo : isRealActive;

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
                isActive
                  ? 'bg-gradient-to-b from-[#0f1d33] to-[#0c1626] border-teal-500/40 shadow-xl shadow-teal-500/10'
                  : 'bg-[#0f172a]/60 border-slate-800/80 grayscale contrast-125 opacity-75 hover:grayscale-0 hover:opacity-100'
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
                      {isActive ? (
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                          حصة نشطة حالياً (Active)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          غير نشطة حالياً (أبيض وأسود)
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

                {/* Info row: Hall & Time */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span className="truncate">{session.hall}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>
                      {formatTime12h(session.startTime)} - {formatTime12h(session.endTime)}
                    </span>
                  </div>
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
                  <button
                    onClick={() => setSelectedSessionForEnroll(session.id)}
                    className="text-[11px] font-bold text-teal-400 hover:text-teal-300 flex items-center gap-1"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>تسكين لاعب (دائم / مؤقت)</span>
                  </button>
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
                    لم يتم تسكين لاعبين بعد. اضغط "تسكين لاعب" لإضافته بصفة دائمة أو مؤقتة لحصة اليوم.
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-teal-400" />
              <span>إضافة كلاس / حصة تدريبية جديدة</span>
            </h3>

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم الحصة</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="مثال: كروس فيت مكثف، كيك بوكسينغ"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">نوع الرياضة</label>
                  <input
                    type="text"
                    value={form.sport}
                    onChange={(e) => setForm({ ...form, sport: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">القاعة أو الصالة</label>
                  <input
                    type="text"
                    value={form.hall}
                    onChange={(e) => setForm({ ...form, hall: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Session Category Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  تصنيف ونوع السيشن (Session Category):
                </label>
                <select
                  value={form.sessionCategory}
                  onChange={(e) => setForm({ ...form, sessionCategory: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 font-bold"
                >
                  <option value="group">كلاس جماعي (Group Class)</option>
                  <option value="private">تدريب خاص (Private PT)</option>
                  <option value="physio">علاج طبيعي وتأهيل (Physio)</option>
                  <option value="massage">مساج واستشفاء (Massage)</option>
                  <option value="gym">اشتراك جيم عام (Gym)</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  يسمع هذا التصنيف تلقائياً في التقرير الشامل وإحصائيات المنصة
                </p>
              </div>

              {/* Price on outside (CLIENT TICKET PRICE) */}
              <div>
                <label className="block text-xs font-bold text-teal-300 mb-1">
                  سعر تذكرة العميل (Client Ticket Price) - EGP
                </label>
                <input
                  type="number"
                  required
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-teal-500/50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-400 font-bold font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  المبلغ الذي يدفعه العضو/اللاعب لحضور الكلاس (مستقل تماماً ومنفصل عن أجر وحسابات المدربين)
                </p>
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">وقت البدء</label>
                  <input
                    type="time"
                    required
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">وقت الانتهاء</label>
                  <input
                    type="time"
                    required
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Select 1 or 2 coaches */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  اختر المدربين للحصة (مدرب أو مدربين اثنين):
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1">
                  {coaches.map((c) => {
                    const isSelected = form.coachIds.includes(c.id);
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => handleCoachSelect(c.id)}
                        className={`p-2 rounded-xl text-right text-xs transition border flex items-center justify-between ${
                          isSelected
                            ? 'bg-teal-500/20 border-teal-500 text-teal-300 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span>{c.name}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs"
                >
                  حفظ الحصة
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="py-3 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enroll Player Modal (التسكين الدائم vs التسكين المؤقت لليوم) */}
      {selectedSessionForEnroll && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-base font-black text-white mb-1">
              تسكين لاعب بالحصة (دائم أو مؤقت لحضور اليوم)
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              اختر نوع التسكين: <span className="text-teal-300 font-bold">تسكين دائم</span> لتثبيت اللاعب في الحصة كل أسبوع، أو <span className="text-amber-300 font-bold">تسكين مؤقت</span> لحصة اليوم فقط بدون تغيير جدوله
            </p>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {members.map((m) => {
                const targetSession = sessions.find((s) => s.id === selectedSessionForEnroll);
                const isPermanent = targetSession?.enrolledPlayerIds.includes(m.id);
                const isTemp = (targetSession?.temporaryPlayerIds || []).includes(m.id);

                return (
                  <div
                    key={m.id}
                    className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>{m.name}</span>
                        {m.type === 'doctor' && (
                          <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1 rounded">
                            طبيب
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {m.code} | متبقي: {m.remainingSessions} حصة
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isPermanent ? (
                        <span className="text-teal-400 font-bold text-[11px] bg-teal-500/10 px-2 py-1 rounded-lg border border-teal-500/20">
                          مسجل دائم
                        </span>
                      ) : isTemp ? (
                        <span className="text-amber-300 font-bold text-[11px] bg-amber-500/15 px-2 py-1 rounded-lg border border-amber-500/30">
                          مسجل مؤقت
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              assignPlayerToSession(selectedSessionForEnroll, m.id, false);
                              setSelectedSessionForEnroll(null);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-[11px] transition shadow"
                          >
                            تسكين دائم
                          </button>
                          <button
                            onClick={() => {
                              assignPlayerToSession(selectedSessionForEnroll, m.id, true);
                              setSelectedSessionForEnroll(null);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 font-bold text-[11px] transition"
                          >
                            مؤقت اليوم
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setSelectedSessionForEnroll(null)}
              className="w-full mt-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
