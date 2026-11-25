import React, { useState, useEffect, useMemo } from 'react';
import {
  KeyRound,
  LogOut,
  RefreshCw,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Coffee,
  Banknote,
  Wallet,
  TrendingUp,
  Calendar,
  ShieldCheck,
  Receipt,
} from 'lucide-react';
import { useGymData } from '../context/GymDataContext';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';
import { Coach, TrainerTransaction, POSTransaction } from '../types';
import { formatEGP } from '../utils/formatters';
import { sounds } from '../utils/sound';
import { BrandLogo } from '../components/BrandLogo';

interface CoachPortalPageProps {
  onBackToStaffLogin?: () => void;
}

const STORAGE_COACH_SESSION_KEY = 'synapse_coach_portal_id';

export const CoachPortalPage: React.FC<CoachPortalPageProps> = ({ onBackToStaffLogin }) => {
  const {
    coaches: contextCoaches,
    trainerTransactions: contextTrainerTx,
    transactions: contextPosTx,
  } = useGymData();

  const [codeInput, setCodeInput] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [loggedInCoach, setLoggedInCoach] = useState<Coach | null>(null);
  const [dbTrainerTx, setDbTrainerTx] = useState<TrainerTransaction[] | null>(null);
  const [dbPosTx, setDbPosTx] = useState<POSTransaction[] | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending_debt' | 'repayments' | 'pos'>('all');
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');

  const fetchLiveCoachData = async (coachId: string, showSpinner = true) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      if (isSupabaseConfigured) {
        const [remoteCoaches, remoteTrx, remotePos] = await Promise.all([
          supabaseService.fetchCoaches(),
          supabaseService.fetchTrainerTransactions(),
          supabaseService.fetchPOSTransactions(),
        ]);

        if (remoteCoaches) {
          const freshCoach = remoteCoaches.find((c) => c.id === coachId);
          if (freshCoach) setLoggedInCoach(freshCoach);
        }
        if (remoteTrx) setDbTrainerTx(remoteTrx);
        if (remotePos) setDbPosTx(remotePos);
      }
      setLastSyncedAt(new Date().toLocaleTimeString('ar-EG'));
    } catch {
      // Fallback gracefully to context data
    } finally {
      if (showSpinner) setIsRefreshing(false);
    }
  };

  // Restore session if coach is already logged in during this browser session
  useEffect(() => {
    try {
      const savedId = sessionStorage.getItem(STORAGE_COACH_SESSION_KEY);
      if (savedId) {
        const found = contextCoaches.find((c) => c.id === savedId);
        if (found) {
          setLoggedInCoach(found);
          fetchLiveCoachData(found.id, false);
        }
      }
    } catch {
      // ignore
    }
  }, [contextCoaches]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanCode = codeInput.trim();

    if (!/^\d{5}$/.test(cleanCode)) {
      setError('يرجى إدخال كود الكابتن المكون من 5 أرقام صحيحة');
      return;
    }

    setIsLoading(true);
    try {
      let coachesList = contextCoaches;
      let trxList: TrainerTransaction[] | null = null;
      let posList: POSTransaction[] | null = null;

      if (isSupabaseConfigured) {
        const [remoteCoaches, remoteTrx, remotePos] = await Promise.all([
          supabaseService.fetchCoaches(),
          supabaseService.fetchTrainerTransactions(),
          supabaseService.fetchPOSTransactions(),
        ]);
        if (remoteCoaches && remoteCoaches.length > 0) {
          // Merge codes from context in case DB hasn't been migrated yet
          coachesList = remoteCoaches.map((rc) => {
            if (rc.code) return rc;
            const localMatch = contextCoaches.find((lc) => lc.id === rc.id);
            return localMatch?.code ? { ...rc, code: localMatch.code } : rc;
          });
        }
        if (remoteTrx) trxList = remoteTrx;
        if (remotePos) posList = remotePos;
      }

      const matched = coachesList.find((c) => c.code?.trim() === cleanCode);
      if (!matched) {
        setError('الكود غير صحيح أو غير مسجل. يرجى مراجعة الإدارة للحصول على الكود الخماسي.');
        return;
      }
      if (!matched.active) {
        setError('هذا الحساب موقوف حالياً. يرجى مراجعة الإدارة.');
        return;
      }

      if (trxList) setDbTrainerTx(trxList);
      if (posList) setDbPosTx(posList);
      setLoggedInCoach(matched);
      setLastSyncedAt(new Date().toLocaleTimeString('ar-EG'));
      sessionStorage.setItem(STORAGE_COACH_SESSION_KEY, matched.id);
      sounds.playSuccessDing();
    } catch {
      setError('حدث خطأ أثناء التحقق من الكود، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(STORAGE_COACH_SESSION_KEY);
    setLoggedInCoach(null);
    setCodeInput('');
    setDbTrainerTx(null);
    setDbPosTx(null);
  };

  const allTrainerTx = dbTrainerTx ?? contextTrainerTx;
  const allPosTx = dbPosTx ?? contextPosTx;

  const coachHistory = useMemo(() => {
    if (!loggedInCoach) return [];
    return allTrainerTx
      .filter((t) => t.coach_id === loggedInCoach.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [allTrainerTx, loggedInCoach]);

  const coachPosHistory = useMemo(() => {
    if (!loggedInCoach) return [];
    return allPosTx
      .filter((p) => p.paymentMethod === 'coach_debt' && p.coachId === loggedInCoach.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [allPosTx, loggedInCoach]);

  const stats = useMemo(() => {
    // 1. Pending debt owed BY coach to gym
    const pendingDebt = coachHistory
      .filter((t) => t.status === 'pending' && t.collected_by === 'coach')
      .reduce((acc, t) => acc + (t.gym_share > 0 ? t.gym_share : t.amount), 0);

    // 2. Total repaid BY coach
    const totalRepaid = coachHistory
      .filter((t) => t.type === 'coach_repayment')
      .reduce((acc, t) => acc + t.amount, 0);

    // 3. Total POS charges on coach (all time)
    const totalPosCharges = coachHistory
      .filter((t) => t.type === 'pos_charge')
      .reduce((acc, t) => acc + t.amount, 0);

    // 4. Coach earnings owed BY gym to coach
    const coachEarningsPending = coachHistory
      .filter((t) => t.status === 'pending' && t.collected_by === 'gym' && t.coach_share > 0)
      .reduce((acc, t) => acc + t.coach_share, 0);

    return {
      pendingDebt,
      totalRepaid,
      totalPosCharges,
      coachEarningsPending,
    };
  }, [coachHistory]);

  const filteredHistory = useMemo(() => {
    return coachHistory.filter((t) => {
      if (activeFilter === 'pending_debt') {
        return t.status === 'pending' && t.collected_by === 'coach';
      }
      if (activeFilter === 'repayments') {
        return t.type === 'coach_repayment';
      }
      if (activeFilter === 'pos') {
        return t.type === 'pos_charge';
      }
      return true;
    });
  }, [coachHistory, activeFilter]);

  const getTxBadge = (t: TrainerTransaction) => {
    if (t.type === 'coach_repayment') {
      return {
        label: 'سداد مديونية للجيم',
        color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        icon: <Banknote className="w-3.5 h-3.5" />,
      };
    }
    if (t.type === 'pos_charge') {
      return {
        label: 'مشتريات بار (POS)',
        color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        icon: <Coffee className="w-3.5 h-3.5" />,
      };
    }
    if (t.type === 'physio_charge') {
      return {
        label: 'جلسة علاج طبيعي / مساج',
        color: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        icon: <Receipt className="w-3.5 h-3.5" />,
      };
    }
    if (t.collected_by === 'gym' && t.coach_share > 0) {
      return {
        label: 'مستحقات / أرباح لك',
        color: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
        icon: <TrendingUp className="w-3.5 h-3.5" />,
      };
    }
    return {
      label: t.payer_type || 'تحميل حصة',
      color: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      icon: <Wallet className="w-3.5 h-3.5" />,
    };
  };

  // ─────────────────────────────────────────────────────────────────
  // VIEW 1: COACH 5-DIGIT CODE LOGIN
  // ─────────────────────────────────────────────────────────────────
  if (!loggedInCoach) {
    return (
      <div
        className="min-h-screen bg-[#070b12] flex items-center justify-center p-4 relative overflow-hidden selection:bg-amber-500 selection:text-slate-950"
        dir="rtl"
      >
        <div className="absolute top-1/4 -right-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 -left-24 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          <div className="bg-[#0f172a]/85 backdrop-blur-xl border border-amber-500/30 rounded-3xl p-8 shadow-2xl shadow-black/80 relative">
            {/* Top Brand */}
            <div className="text-center mb-7">
              <BrandLogo size="lg" centered className="mb-4" />

              <h1 className="text-2xl font-black text-white">بوابة الكباتن والمدربين</h1>
              <p className="text-slate-400 text-xs mt-1.5">
                كشف الحساب الشخصي، التحميلات، مشتريات البار، وسجل السدادات
              </p>
            </div>

            <div className="mb-6 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center gap-2.5 text-amber-200">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-[11px] leading-relaxed">
                أدخل كود الكابتن الخاص بك المكون من <strong>5 أرقام</strong> للاطلاع على حسابك وسجلك المالي مباشرة.
              </span>
            </div>

            {error && (
              <div className="mb-5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 text-center">
                  كود الكابتن (5 أرقام)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    required
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    placeholder="•••••"
                    className="w-full bg-slate-900/90 border-2 border-slate-700 focus:border-amber-500 rounded-2xl px-4 py-4 text-center text-2xl font-mono font-black tracking-[0.5em] text-amber-300 placeholder-slate-600 focus:outline-none transition dir-ltr"
                    autoFocus
                  />
                  <KeyRound className="w-5 h-5 text-slate-500 absolute left-4 top-4.5" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || codeInput.length < 5}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span>جارِ التحقق وجلب البيانات...</span>
                ) : (
                  <>
                    <span>عرض كشف الحساب الشخصي</span>
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </>
                )}
              </button>
            </form>

            {onBackToStaffLogin && (
              <div className="mt-6 pt-5 border-t border-slate-800 text-center">
                <button
                  type="button"
                  onClick={onBackToStaffLogin}
                  className="text-xs font-bold text-slate-400 hover:text-teal-400 transition cursor-pointer inline-flex items-center gap-1.5"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>العودة لتسجيل دخول الإدارة وموظفي الاستقبال</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // VIEW 2: COACH FINANCIAL DASHBOARD & HISTORY
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 p-4 sm:p-6 lg:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-[#0f172a] via-[#131d36] to-[#0c1424] border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg">
              {loggedInCoach.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-white">أهلاً كابتن {loggedInCoach.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-xs font-black">
                  كود: #{loggedInCoach.code || '-----'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {loggedInCoach.specialty} {lastSyncedAt ? `• آخر تحديث: ${lastSyncedAt}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => fetchLiveCoachData(loggedInCoach.id, true)}
              disabled={isRefreshing}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 font-bold text-xs flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'جارِ التحديث...' : 'تحديث البيانات'}</span>
            </button>

            <button
              onClick={handleLogout}
              className="py-2.5 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold text-xs flex items-center gap-2 cursor-pointer transition"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل خروج</span>
            </button>
          </div>
        </div>

        {/* 4 Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-3xl bg-[#0f172a] border border-rose-500/30 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400">المتبقي عليك حالياً (مديونية)</span>
              <AlertCircle className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-2xl font-black font-mono text-rose-400">
              {formatEGP(stats.pendingDebt)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">مبالغ محملة لم يتم سدادها بعد</p>
          </div>

          <div className="p-5 rounded-3xl bg-[#0f172a] border border-emerald-500/30 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400">إجمالي ما سددته للجيم</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-black font-mono text-emerald-400">
              {formatEGP(stats.totalRepaid)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">كل الدفعات المسددة كاش / إنستاباي</p>
          </div>

          <div className="p-5 rounded-3xl bg-[#0f172a] border border-amber-500/30 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400">إجمالي تحميلات البار (POS)</span>
              <Coffee className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-2xl font-black font-mono text-amber-300">
              {formatEGP(stats.totalPosCharges)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {coachPosHistory.length} فاتورة مشروبات / بار
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-[#0f172a] border border-teal-500/30 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400">مستحقاتك المعلقة عند الجيم</span>
              <TrendingUp className="w-5 h-5 text-teal-400" />
            </div>
            <div className="text-2xl font-black font-mono text-teal-300">
              {formatEGP(stats.coachEarningsPending)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">أرباح حصص محصلة بالاستقبال</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: 'all', label: `كل السجل (${coachHistory.length})` },
            { id: 'pending_debt', label: 'التحميلات المعلقة عليك' },
            { id: 'pos', label: 'مشتريات البار (POS)' },
            { id: 'repayments', label: 'الفلوس اللي سددتها' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                activeFilter === tab.id
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Detailed History Timeline */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              <span>سجل الحركات التفصيلي (إمتى وإزاي)</span>
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              {filteredHistory.length} حركة
            </span>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              لا توجد حركات مسجلة في هذا التصنيف حتى الآن.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((trx) => {
                const badge = getTxBadge(trx);
                const dateObj = new Date(trx.created_at);
                const formattedDate = dateObj.toLocaleDateString('ar-EG', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                });
                const formattedTime = dateObj.toLocaleTimeString('ar-EG', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                const isRepayment = trx.type === 'coach_repayment';
                const isCoachEarning = trx.collected_by === 'gym' && trx.coach_share > 0;
                const displayAmount = isCoachEarning
                  ? trx.coach_share
                  : trx.gym_share > 0
                  ? trx.gym_share
                  : trx.amount;

                return (
                  <div
                    key={trx.transaction_id}
                    className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${badge.color}`}
                        >
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>

                        {isRepayment ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-[10px] font-bold">
                            ✅ مسدد ({trx.payment_method === 'instapay' ? 'إنستاباي' : 'كاش'})
                          </span>
                        ) : trx.status === 'settled' ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-[10px] font-bold">
                            ✅ تم السداد والتسوية
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 text-[10px] font-bold">
                            ⏳ معلق (غير مسدد)
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-bold text-white">
                        {trx.payer_name || trx.payer_type}
                      </div>

                      {trx.notes && (
                        <div className="text-xs text-slate-400 leading-relaxed">{trx.notes}</div>
                      )}

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formattedDate}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formattedTime}
                        </span>
                        {trx.settled_by && <span>بواسطة: {trx.settled_by}</span>}
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                      <div
                        className={`text-lg font-black font-mono ${
                          isRepayment || isCoachEarning
                            ? 'text-emerald-400'
                            : trx.status === 'settled'
                            ? 'text-slate-400 line-through'
                            : 'text-rose-400'
                        }`}
                      >
                        {formatEGP(displayAmount)}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {isRepayment
                          ? 'مبلغ مسدد'
                          : isCoachEarning
                          ? 'نصيبك من الحصة'
                          : 'قيمة التحميل'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
