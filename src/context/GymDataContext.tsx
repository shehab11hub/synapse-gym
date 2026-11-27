import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  Member,
  Coach,
  GymSession,
  PhysioBooking,
  POSProduct,
  POSTransaction,
  CheckInLog,
  SettlementLog,
  ExpenseItem,
  CashInflowItem,
  TrainerTransaction,
  CollectedBy,
  TransactionStatus,
  MasterReportEntry,
  MonthlyBillingCycle,
  SessionCategory,
  YearlyArchive,
  DailyShiftClosing,
  MonthlyArchive,
  PeriodArchive,
  MemberSubscriptionRecord,
  SubscriptionPlanPreset,
  GymSettings,
} from '../types';
import {
  exportMasterReportToXLSX,
  exportDailyShiftToXLSX,
  exportYearlyArchiveToXLSX,
  exportYearlyArchiveToJSON,
  exportPeriodArchiveToXLSX,
  exportPeriodArchiveToJSON,
} from '../utils/excelExport';
import { sounds } from '../utils/sound';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { getSubscriptionStatus } from '../utils/formatters';
import { withDbTimeout, NETWORK_ERROR_MESSAGE, NetworkDbError } from '../utils/network';
import { smartCache, DEFAULT_GYM_SETTINGS } from '../utils/smartCache';

export const generateUniqueMemberCode = (existingMembers: Member[]): string => {
  const existingCodes = new Set(existingMembers.map((m) => m.code?.toUpperCase()));
  let code = '';
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (existingCodes.has(code));
  return code;
};

export const generateUniqueCoachCode = (existingCoaches: Coach[]): string => {
  const existingCodes = new Set(existingCoaches.map((c) => c.code?.trim()));
  let code = '';
  do {
    code = Math.floor(10000 + Math.random() * 90000).toString();
  } while (existingCodes.has(code));
  return code;
};

interface GymDataContextType {
  // System Loading & Network Resilience
  isInitialLoading: boolean;
  networkError: string | null;
  reportNetworkError: (msg?: string) => void;
  clearNetworkError: () => void;

  // Smart Cached Reference Data & Subscription History (O(1) lookup)
  subscriptions: MemberSubscriptionRecord[];
  memberSubscriptionHistoryMap: Record<string, Array<{ endDate?: string; date?: string; totalDays?: number; totalSessions?: number; fee?: number }>>;
  subscriptionPlans: SubscriptionPlanPreset[];
  updateSubscriptionPlans: (plans: SubscriptionPlanPreset[]) => void;
  gymSettings: GymSettings;
  updateGymSettings: (updates: Partial<GymSettings>) => void;

  // Members
  members: Member[];
  addMember: (member: Omit<Member, 'id'>) => Member;
  updateMember: (id: string, updates: Partial<Member>) => void;
  toggleMemberAsDoctor: (id: string) => void;
  findMemberByCode: (code: string) => Member | undefined;
  performCheckIn: (
    memberId: string,
    method?: 'qr' | 'manual',
    fallbackMember?: Partial<Member>
  ) => {
    success: boolean;
    member?: Member;
    message?: string;
    isCheckOut?: boolean;
    requiresSettlement?: boolean;
    checkOutLogId?: string;
    durationMinutes?: number;
    extraFeeDue?: number;
  };
  calculatePlayerCheckOutQuote: (checkInLogId: string) => {
    log: CheckInLog;
    session?: GymSession;
    member?: Member;
    entryTime: string;
    durationMinutes: number;
    tier: 'tier1' | 'tier2' | 'tier3';
    tierLabel: string;
    tierTotalPrice: number;
    paidAtEntry: number;
    extraFeeDue: number;
  } | null;
  completePlayerCheckOut: (
    checkInLogId: string,
    options: {
      paymentMethod: 'cash' | 'instapay' | 'card' | 'coach_debt' | 'package_deduction';
      extraFee: number;
      durationMinutes: number;
      pricingTier: 'tier1' | 'tier2' | 'tier3';
      coachId?: string;
      notes?: string;
      authorizedBy?: string;
    }
  ) => Promise<{ success: boolean; message?: string }>;
  cancelCheckIn: (checkInLogId: string) => { success: boolean };
  clearAllCheckInLogs: () => void;
  renewMemberSubscription: (
    memberId: string,
    planName: string,
    durationDays: number,
    fee: number,
    paymentMethod: 'cash' | 'instapay',
    notes?: string,
    sessionsCount?: number
  ) => Promise<{ success: boolean; member?: Member }>;
  wipeAllDataToCleanSlate: () => void;

  // Sessions / Classes
  sessions: GymSession[];
  addSession: (session: Omit<GymSession, 'id'>) => void;
  updateSession: (id: string, updates: Partial<GymSession>) => void;
  deleteSession: (id: string) => void;
  startSession: (sessionId: string) => void;
  endSession: (sessionId: string) => void;
  assignPlayerToSession: (sessionId: string, memberId: string, isTemporary?: boolean) => void;
  removePlayerFromSession: (sessionId: string, memberId: string) => void;
  toggleSessionCoachCompletion: (sessionId: string, coachId: string) => void;

  // Coaches & Payroll
  coaches: Coach[];
  addCoach: (coach: Omit<Coach, 'id' | 'currentBalance' | 'totalPaidToday'>) => void;
  updateCoach: (id: string, updates: Partial<Coach>) => void;
  settleCoachAccount: (coachId: string, adminUsername: string) => { success: boolean; settledAmount: number };
  payMonthlySalary: (coachId: string, adminUsername: string) => Promise<{ success: boolean; salaryAmount: number }>;
  settlementLogs: SettlementLog[];

  // Physiotherapy & Massage
  physioBookings: PhysioBooking[];
  startPhysioSession: (data: {
    doctorName: string;
    doctorCode: string;
    coachId?: string;
    coachName?: string;
    patientName: string;
    patientCode?: string;
    roomName: string;
    hourlyRate: number;
    serviceType?: 'physio' | 'massage';
    status?: 'waiting' | 'active';
  }) => PhysioBooking;
  beginPhysioSession: (id: string) => void;
  finishPhysioSession: (id: string) => void;
  addExtraFeeToPhysio: (id: string, extraAmount: number, reason?: string) => void;
  completePhysioSession: (id: string) => void;
  pausePhysioSession: (id: string) => void;
  resumePhysioSession: (id: string) => void;
  billPhysioSession: (
    id: string,
    billingData: {
      billedTo: 'patient' | 'doctor' | 'coach';
      paymentMethod: 'cash' | 'instapay' | 'coach_debt';
      instapayRef?: string;
      chargedToCoachId?: string;
      notes?: string;
      totalAmount?: number;
      extraFee?: number;
      extraFeeReason?: string;
    }
  ) => void;
  assignArrivedMember: (
    checkInLogId: string,
    category: SessionCategory,
    coachId: string,
    sessionId?: string,
    notes?: string,
    paymentDetails?: {
      paymentMode?: 'coach_charge' | 'cash_drawer' | 'instapay';
      amount?: number;
      roomName?: string;
      seatingPathway?: 'coach_debt' | 'gym_with_coach_share' | 'gym_direct_no_coach';
      coachShareType?: 'fixed' | 'percentage';
      coachShareValue?: number;
      coachShareAmount?: number;
      gymShareAmount?: number;
    }
  ) => void;

  // POS
  products: POSProduct[];
  addProduct: (product: Omit<POSProduct, 'id'>) => void;
  updateProduct: (id: string, updates: Partial<POSProduct>) => void;
  deleteProduct: (id: string) => void;
  transactions: POSTransaction[];
  processSale: (saleData: Omit<POSTransaction, 'id' | 'timestamp'>) => Promise<POSTransaction>;

  // Expenses & Cash Drawer
  expenses: ExpenseItem[];
  cashInflows: CashInflowItem[];
  addExpense: (expense: Omit<ExpenseItem, 'id' | 'date'>) => Promise<ExpenseItem>;
  deleteExpense: (id: string) => void;
  addCashInflow: (inflow: Omit<CashInflowItem, 'id' | 'date'>) => Promise<CashInflowItem>;
  deleteCashInflow: (id: string) => void;
  addManualCashMovement: (type: 'deposit' | 'withdrawal', amount: number, title: string, notes?: string) => Promise<void>;
  getDrawerStats: () => {
    totalCashIn: number;
    totalCashOut: number;
    netCashInDrawer: number;
    todayCashIn: number;
    todayCashOut: number;
    todayNetInDrawer: number;
    totalInstapayIn: number;
    totalPendingOnCoaches: number;
    totalCoachDues: number;
  };

  // General Stats
  getTodayStats: () => {
    checkInsCount: number;
    posSalesToday: number;
    posProfitToday: number;
    coachesPaidToday: number;
    perSessionCoachesOwed: number;
    totalExpensesToday: number;
    netDrawerToday: number;
  };

  // Recent logs
  checkInLogs: CheckInLog[];

  // DUAL FINANCIAL FLOWS & UNIFIED TRAINER TRANSACTIONS LEDGER
  trainerTransactions: TrainerTransaction[];
  addTrainerTransaction: (data: {
    coach_id: string;
    amount: number;
    collected_by: CollectedBy;
    payer_type: string;
    payer_name?: string;
    gym_share?: number;
    coach_share?: number;
    gym_percentage?: number;
    payment_method?: 'cash' | 'card' | 'instapay' | 'coach_collected';
    notes?: string;
  }) => TrainerTransaction;
  settleCoachPayable: (coachId: string, adminUsername: string, transactionIds?: string[]) => { success: boolean; settledAmount: number };
  collectGymReceivable: (coachId: string, adminUsername: string, transactionIds?: string[]) => { success: boolean; collectedAmount: number };
  netSettleTrainer: (coachId: string, adminUsername: string) => { success: boolean; netAmount: number; type: 'paid_to_coach' | 'collected_from_coach' | 'balanced' };
  getCoachFinancialSummary: (coachId: string) => {
    payableToCoach: number; // مستحقات للمدرب (ليه فلوس)
    receivableFromCoach: number; // مديونية للجيم عند المدرب (عليه فلوس)
    netBalance: number; // صافي الرصيد
    pendingTransactions: TrainerTransaction[];
    settledTransactions: TrainerTransaction[];
  };
  getAllTrainersFinancialSummary: () => {
    totalPayableAllCoaches: number;
    totalReceivableAllCoaches: number;
    totalNetBalance: number;
  };
  repayCoachDebt: (
    coachId: string,
    amount: number,
    paymentMethod?: 'cash' | 'instapay',
    notes?: string,
    authorizedBy?: string
  ) => Promise<{ success: boolean; repaidAmount: number }>;
  addCoachManualMovement: (data: {
    coach_id: string;
    movement_type: 'payout' | 'deposit' | 'charge';
    amount: number;
    reason: string;
    payment_method?: 'cash' | 'instapay';
    authorized_by?: string;
  }) => Promise<{ success: boolean; type: 'payout' | 'deposit' | 'charge' }>;
  getCoachMonthlyBreakdown: (coachId: string, month: string) => {
    currentMonthCharges: number;
    previousCarriedDebt: number;
    currentMonthRepaid: number;
    currentMonthPending: number;
    remainingTotalDebt: number;
    transactions: TrainerTransaction[];
  };

  // COMPREHENSIVE MASTER REPORT & MONTHLY ARCHIVE
  masterReportEntries: MasterReportEntry[];
  billingCycles: MonthlyBillingCycle[];
  currentMonth: string;
  setCurrentMonth: (month: string) => void;
  addMasterReportEntry: (entry: Omit<MasterReportEntry, 'id'>) => void;
  updateMasterReportEntry: (id: string, updates: Partial<MasterReportEntry>) => void;
  deleteMasterReportEntry: (id: string) => void;
  startNewMonth: (newMonthName: string, startDate?: string, endDate?: string) => void;
  monthlyArchives: MonthlyArchive[];
  closeMonthlyBillingCycle: (adminUsername: string, nextMonthName?: string) => { success: boolean; archive?: MonthlyArchive; error?: string };
  exportMasterReportToCSV: (month?: string) => void;
  exportMasterReportXLSX: (month?: string) => Promise<void>;

  // PERIOD ARCHIVES & CLOUD DATA PURGING
  periodArchives: PeriodArchive[];
  archivePeriodAndPurge: (
    periodName: string,
    selectedMonths: string[],
    adminUsername: string
  ) => Promise<{ success: boolean; periodArchive: PeriodArchive }>;

  // YEARLY ARCHIVES & DATA PURGING
  yearlyArchives: YearlyArchive[];
  archiveYear: (yearToArchive: number, adminUsername: string) => YearlyArchive;
  getYearlyArchive: (year: number) => YearlyArchive | undefined;
  purgeActiveLogsForYear: (year: number) => void;
  exportYearlyArchiveXLSX: (year: number) => Promise<void>;
  exportYearlyArchiveJSON: (year: number) => void;

  // DAILY SHIFT CLOSING (تقفيل اليومية والدرج)
  dailyShiftClosings: DailyShiftClosing[];
  getRunningOperations: () => { runningSessions: GymSession[]; runningPhysio: PhysioBooking[]; activeSeatedPlayers: CheckInLog[]; hasRunning: boolean };
  closeDailyShift: (closingData: Omit<DailyShiftClosing, 'id' | 'closedAt'>) => Promise<DailyShiftClosing>;
  getTodayShiftStatus: () => { isClosedToday: boolean; lastClosing?: DailyShiftClosing };
  exportDailyShiftXLSX: (closingId?: string) => Promise<void>;
  isAfterLastClosing: (dateStr?: string) => boolean;
  lastClosingTime: string | null;
}

// Production Clean Slate & Cache Busting
const CURRENT_DATA_VERSION = 'synapse_v5_complete_clean_slate_2026';

const ALL_STORAGE_KEYS = [
  'synapse_members',
  'synapse_sessions',
  'synapse_coaches',
  'synapse_physio',
  'synapse_products',
  'synapse_transactions',
  'synapse_expenses',
  'synapse_cash_inflows',
  'synapse_checkin_logs',
  'synapse_settlement_logs',
  'synapse_trainer_transactions',
  'synapse_master_report',
  'synapse_billing_cycles',
  'synapse_current_month',
  'synapse_monthly_archives',
  'synapse_yearly_archives',
  'synapse_daily_closings',
  'synapse_daily_shift_closings',
];

if (typeof window !== 'undefined') {
  const currentVer = localStorage.getItem('synapse_data_version');
  if (currentVer !== CURRENT_DATA_VERSION) {
    ALL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    localStorage.setItem('synapse_data_version', CURRENT_DATA_VERSION);
    if (isSupabaseConfigured) {
      supabaseService.wipeAllOperationalData().catch(() => {});
    }
  }
}

// Dynamic Current Month Name
const dynamicCurrentMonth = new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });

// Clean Slate Initial Data (Zeroed)
const INITIAL_MEMBERS: Member[] = [];
const INITIAL_SESSIONS: GymSession[] = [];
const INITIAL_COACHES: Coach[] = [];
const INITIAL_PHYSIO_BOOKINGS: PhysioBooking[] = [];
const INITIAL_PRODUCTS: POSProduct[] = [];
const INITIAL_EXPENSES: ExpenseItem[] = [];
const INITIAL_INFLOWS: CashInflowItem[] = [];
const INITIAL_CHECKIN_LOGS: CheckInLog[] = [];
const INITIAL_TRAINER_TRANSACTIONS: TrainerTransaction[] = [];
const INITIAL_MASTER_ENTRIES: MasterReportEntry[] = [];
const INITIAL_BILLING_CYCLES: MonthlyBillingCycle[] = [
  {
    id: `cycle-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    name: dynamicCurrentMonth,
    startDate: new Date().toISOString(),
    isActive: true,
    totalCollected: 0,
    totalPendingOnCoaches: 0,
  },
];

const GymDataContext = createContext<GymDataContextType | undefined>(undefined);

export const GymDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(isSupabaseConfigured);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const reportNetworkError = (msg?: string) => {
    setNetworkError(msg || NETWORK_ERROR_MESSAGE);
  };

  const clearNetworkError = () => {
    setNetworkError(null);
  };

  // Strict Pessimistic DB Write helper (12s timeout + online check)
  const strictDbWrite = async (dbOperation: () => Promise<boolean>): Promise<boolean> => {
    if (!isSupabaseConfigured) return true;
    try {
      const ok = await withDbTimeout(dbOperation(), 12000);
      if (!ok) {
        setNetworkError(NETWORK_ERROR_MESSAGE);
        return false;
      }
      return true;
    } catch {
      setNetworkError(NETWORK_ERROR_MESSAGE);
      return false;
    }
  };

  // Hydrate semi-static reference data immediately from Smart Cache (Memory + localStorage)
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [sessions, setSessions] = useState<GymSession[]>(() => smartCache.getSessions() || INITIAL_SESSIONS);
  const [coaches, setCoaches] = useState<Coach[]>(() => smartCache.getCoaches() || INITIAL_COACHES);
  const [physioBookings, setPhysioBookings] = useState<PhysioBooking[]>(INITIAL_PHYSIO_BOOKINGS);
  const [products, setProducts] = useState<POSProduct[]>(() => smartCache.getProducts() || INITIAL_PRODUCTS);
  const [subscriptions, setSubscriptions] = useState<MemberSubscriptionRecord[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlanPreset[]>(() => smartCache.getSubscriptionPlans());
  const [gymSettings, setGymSettings] = useState<GymSettings>(() => smartCache.getGymSettings());
  const [transactions, setTransactions] = useState<POSTransaction[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>(INITIAL_EXPENSES);
  const [cashInflows, setCashInflows] = useState<CashInflowItem[]>(INITIAL_INFLOWS);
  const [checkInLogs, setCheckInLogs] = useState<CheckInLog[]>(INITIAL_CHECKIN_LOGS);
  const [settlementLogs, setSettlementLogs] = useState<SettlementLog[]>([]);
  const [trainerTransactions, setTrainerTransactions] = useState<TrainerTransaction[]>(INITIAL_TRAINER_TRANSACTIONS);
  const [masterReportEntries, setMasterReportEntries] = useState<MasterReportEntry[]>(INITIAL_MASTER_ENTRIES);
  const [billingCycles, setBillingCycles] = useState<MonthlyBillingCycle[]>(INITIAL_BILLING_CYCLES);
  const [currentMonth, setCurrentMonth] = useState<string>(() => smartCache.getGymSettings().currentMonth || dynamicCurrentMonth);
  const [monthlyArchives, setMonthlyArchives] = useState<MonthlyArchive[]>([]);
  const [yearlyArchives, setYearlyArchives] = useState<YearlyArchive[]>([]);
  const [dailyShiftClosings, setDailyShiftClosings] = useState<DailyShiftClosing[]>([]);
  const [periodArchives, setPeriodArchives] = useState<PeriodArchive[]>([]);

  const updateSubscriptionPlans = (plans: SubscriptionPlanPreset[]) => {
    setSubscriptionPlans(plans);
    smartCache.setSubscriptionPlans(plans);
  };

  const updateGymSettings = (updates: Partial<GymSettings>) => {
    setGymSettings((prev) => {
      const next = { ...prev, ...updates, updatedAt: new Date().toISOString() };
      smartCache.setGymSettings(next);
      return next;
    });
  };

  // Auto-sync Smart Cache whenever semi-static reference data changes (create, edit, delete, realtime)
  useEffect(() => {
    if (coaches.length > 0) smartCache.setCoaches(coaches);
  }, [coaches]);

  useEffect(() => {
    if (products.length > 0) smartCache.setProducts(products);
  }, [products]);

  useEffect(() => {
    if (sessions.length > 0) smartCache.setSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    smartCache.setGymSettings({
      ...DEFAULT_GYM_SETTINGS,
      ...gymSettings,
      currentMonth,
      updatedAt: new Date().toISOString(),
    });
  }, [currentMonth]);

  // Precompute O(1) Member Subscription History Map (eliminates N+1 / O(N*M) scans in UI cards)
  const memberSubscriptionHistoryMap = useMemo(() => {
    const map: Record<
      string,
      Array<{ endDate?: string; date?: string; totalDays?: number; totalSessions?: number; fee?: number }>
    > = {};

    subscriptions.forEach((sub) => {
      const codeKey = (sub.memberCode || '').toUpperCase();
      const idKey = sub.memberId;
      const entry = {
        endDate: sub.endDate,
        date: sub.createdAt,
        totalDays: sub.totalDays,
        totalSessions: sub.totalSessions,
        fee: sub.fee,
      };
      if (codeKey) {
        if (!map[codeKey]) map[codeKey] = [];
        map[codeKey].push(entry);
      }
      if (idKey) {
        if (!map[idKey]) map[idKey] = [];
        map[idKey].push(entry);
      }
    });

    masterReportEntries.forEach((entry) => {
      if (entry.sourceType === 'subscription' && entry.playerCode) {
        const codeKey = entry.playerCode.toUpperCase();
        if (!map[codeKey]) map[codeKey] = [];
        map[codeKey].push({
          date: entry.date,
          fee: entry.amount,
        });
      }
    });

    return map;
  }, [subscriptions, masterReportEntries]);

  // Backend Directory Sync (non-blocking)
  useEffect(() => {
    if (members.length > 0) {
      try {
        fetch('/api/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(members),
        }).catch(() => {});
      } catch {
        // ignore
      }
    }
  }, [members]);

  // INITIAL SUPABASE FULL DATA SYNC & REALTIME LIVE ENGINE
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsInitialLoading(false);
      return;
    }

    const syncFromSupabase = async () => {
      try {
        const [
          remoteMembers,
          remoteCoaches,
          remoteSessions,
          remotePhysio,
          remoteProducts,
          remotePosTx,
          remoteCheckIns,
          remoteTrainerTx,
          remoteExpenses,
          remoteInflows,
          remoteMasterEntries,
          remoteBillingCycles,
          remoteDailyClosings,
          remoteMonthlyArchives,
          remoteYearlyArchives,
          remoteSubscriptions,
        ] = await Promise.all([
          supabaseService.fetchMembers(),
          supabaseService.fetchCoaches(),
          supabaseService.fetchSessions(),
          supabaseService.fetchPhysioBookings(),
          supabaseService.fetchProducts(),
          supabaseService.fetchPOSTransactions(),
          supabaseService.fetchCheckInLogs(),
          supabaseService.fetchTrainerTransactions(),
          supabaseService.fetchExpenses(),
          supabaseService.fetchCashInflows(),
          supabaseService.fetchMasterReportEntries(),
          supabaseService.fetchBillingCycles(),
          supabaseService.fetchDailyShiftClosings(),
          supabaseService.fetchMonthlyArchives(),
          supabaseService.fetchYearlyArchives(),
          supabaseService.fetchSubscriptions(),
        ]);

        if (remoteMembers !== null) setMembers(remoteMembers);
        if (remoteCoaches !== null) {
          const usedCodes = new Set(remoteCoaches.map((c) => c.code?.trim()).filter(Boolean));
          const coachesToBatchUpdate: Coach[] = [];
          const normalizedCoaches = remoteCoaches.map((c) => {
            if (c.code && /^\d{5}$/.test(c.code.trim())) return c;
            let newCode = '';
            do {
              newCode = Math.floor(10000 + Math.random() * 90000).toString();
            } while (usedCodes.has(newCode));
            usedCodes.add(newCode);
            const updatedCoach = { ...c, code: newCode };
            coachesToBatchUpdate.push(updatedCoach);
            return updatedCoach;
          });
          if (coachesToBatchUpdate.length > 0 && isSupabaseConfigured) {
            supabaseService.upsertCoachesBatch(coachesToBatchUpdate).catch(() => {});
          }
          setCoaches(normalizedCoaches);
          smartCache.setCoaches(normalizedCoaches);
        }
        if (remoteSessions !== null) {
          setSessions(remoteSessions);
          smartCache.setSessions(remoteSessions);
        }
        if (remotePhysio !== null) setPhysioBookings(remotePhysio);
        if (remoteProducts !== null) {
          setProducts(remoteProducts);
          smartCache.setProducts(remoteProducts);
        }
        if (remotePosTx !== null) setTransactions(remotePosTx);
        if (remoteCheckIns !== null) setCheckInLogs(remoteCheckIns);
        if (remoteTrainerTx !== null) setTrainerTransactions(remoteTrainerTx);
        if (remoteExpenses !== null) setExpenses(remoteExpenses);
        if (remoteInflows !== null) setCashInflows(remoteInflows);
        if (remoteMasterEntries !== null) setMasterReportEntries(remoteMasterEntries);
        if (remoteBillingCycles !== null) setBillingCycles(remoteBillingCycles);
        if (remoteDailyClosings !== null) setDailyShiftClosings(remoteDailyClosings);
        if (remoteMonthlyArchives !== null) setMonthlyArchives(remoteMonthlyArchives);
        if (remoteYearlyArchives !== null) setYearlyArchives(remoteYearlyArchives);
        if (remoteSubscriptions !== null) setSubscriptions(remoteSubscriptions);
      } catch (err) {
        console.warn('Initial Supabase sync failed:', err);
        setNetworkError(NETWORK_ERROR_MESSAGE);
      } finally {
        setIsInitialLoading(false);
      }
    };

    syncFromSupabase();

    // REALTIME CROSS-DEVICE SYNCHRONIZATION VIA SUPABASE
    let channel: any;
    if (supabase) {
      channel = supabase
        .channel('gym-cross-device-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'check_in_logs' }, async () => {
          const fresh = await supabaseService.fetchCheckInLogs();
          if (fresh !== null) setCheckInLogs(fresh);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, async () => {
          const fresh = await supabaseService.fetchMembers();
          if (fresh !== null) setMembers(fresh);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'coaches' }, async () => {
          const fresh = await supabaseService.fetchCoaches();
          if (fresh !== null) setCoaches(fresh);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'gym_sessions' }, async () => {
          const fresh = await supabaseService.fetchSessions();
          if (fresh !== null) setSessions(fresh);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'physio_bookings' }, async () => {
          const fresh = await supabaseService.fetchPhysioBookings();
          if (fresh !== null) setPhysioBookings(fresh);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, async () => {
          const fresh = await supabaseService.fetchExpenses();
          if (fresh !== null) setExpenses(fresh);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_inflows' }, async () => {
          const fresh = await supabaseService.fetchCashInflows();
          if (fresh !== null) setCashInflows(fresh);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_products' }, async () => {
          const fresh = await supabaseService.fetchProducts();
          if (fresh !== null) setProducts(fresh);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_transactions' }, async () => {
          const fresh = await supabaseService.fetchPOSTransactions();
          if (fresh !== null) setTransactions(fresh);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_shift_closings' }, async () => {
          const fresh = await supabaseService.fetchDailyShiftClosings();
          if (fresh !== null) setDailyShiftClosings(fresh);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trainer_transactions' }, async () => {
          const fresh = await supabaseService.fetchTrainerTransactions();
          if (fresh !== null) setTrainerTransactions(fresh);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'master_report_entries' }, async () => {
          const fresh = await supabaseService.fetchMasterReportEntries();
          if (fresh !== null) setMasterReportEntries(fresh);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, async () => {
          const fresh = await supabaseService.fetchSubscriptions();
          if (fresh !== null) setSubscriptions(fresh);
        })
        .subscribe();
    }

    return () => {
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Polling for mobile check-ins via serverless relay /api/checkin
  useEffect(() => {
    const pollCheckIns = async () => {
      try {
        const res = await fetch('/api/checkin');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.logs) && data.logs.length > 0) {
            setCheckInLogs((prev) => {
              const existingIds = new Set(prev.map((l) => l.id));
              const newItems = data.logs.filter((l: CheckInLog) => !existingIds.has(l.id));
              if (newItems.length > 0) {
                return [...newItems, ...prev];
              }
              return prev;
            });
          }
        }
      } catch {
        // Silently ignore if offline
      }
    };

    const interval = setInterval(pollCheckIns, 3000);
    return () => clearInterval(interval);
  }, []);

  // Live timer for active physio sessions
  useEffect(() => {
    const interval = setInterval(() => {
      setPhysioBookings((prev) =>
        prev.map((booking) => {
          if (booking.status !== 'active' || booking.isPaused) return booking;
          const start = new Date(booking.startTime).getTime();
          const now = Date.now();
          const pausedSec = booking.totalPausedSeconds || 0;
          const elapsedMinutes = Math.max(1, Math.round(((now - start) / 1000 - pausedSec) / 60));
          const extra = booking.extraFee || 0;
          // Minimum charge is 1 full hour (booking.hourlyRate). Any extra beyond 1 hour is added MANUALLY ONLY via extraFee!
          return {
            ...booking,
            elapsedMinutes,
            totalFee: Math.max(booking.hourlyRate, booking.hourlyRate) + extra,
          };
        })
      );
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Members logic
  const addMember = (memberData: Omit<Member, 'id'>) => {
    const finalCode =
      memberData.code && !members.some((m) => m.code.toUpperCase() === memberData.code.trim().toUpperCase())
        ? memberData.code.trim().toUpperCase()
        : generateUniqueMemberCode(members);

    const newMember: Member = {
      ...memberData,
      code: finalCode,
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    setMembers((prev) => [newMember, ...prev]);

    const fee = memberData.subscriptionFee || 0;
    const coach = coaches.find(
      (c) => c.id === memberData.collectedByCoachId || c.id === memberData.assignedTrainerId
    );
    const coachName = coach ? coach.name : 'الكابتن';

    // AUTOMATIC FINANCIAL ROUTING: Cash Drawer vs InstaPay vs Session
    if (fee > 0) {
      if (memberData.paymentMethod === 'coach_collected') {
        // لا يتم تحميل أي مديونية على الكابتن هنا - التحميل يتم حصراً عند بدء وإنهاء الحصة (endSession)
        const newEntry: MasterReportEntry = {
          id: `rep-${Date.now()}`,
          month: currentMonth,
          date: new Date().toISOString(),
          playerName: newMember.name,
          playerCode: newMember.code,
          amount: fee,
          coachId: coach?.id,
          coachName: coachName,
          sessionCategory: memberData.sessionCategory || 'gym',
          sessionTitle: newMember.subscriptionPlan,
          paymentMethod: 'coach_collected',
          paymentStatus: 'paid',
          notes: `اشتراك مع الكابتن ${coachName}`,
          sourceType: 'subscription',
        };
        setMasterReportEntries((prev) => [newEntry, ...prev]);
        if (isSupabaseConfigured) {
          supabaseService.upsertMasterReportEntry(newEntry).catch(() => {});
        }
      } else if (memberData.paymentMethod === 'instapay') {
        const inflow: CashInflowItem = {
          id: `inf-${Date.now()}`,
          type: 'subscription',
          title: `اشتراك انستاباي (${newMember.subscriptionPlan}) - كود: ${newMember.code}`,
          amount: fee,
          date: new Date().toISOString(),
          memberName: newMember.name,
          paymentMethod: 'instapay',
          recordedBy: 'الاستقبال',
        };
        setCashInflows((prev) => [inflow, ...prev]);

        const newEntry: MasterReportEntry = {
          id: `rep-${Date.now()}`,
          month: currentMonth,
          date: new Date().toISOString(),
          playerName: newMember.name,
          playerCode: newMember.code,
          amount: fee,
          coachId: coach?.id,
          coachName: coachName,
          sessionCategory: memberData.sessionCategory || 'gym',
          sessionTitle: newMember.subscriptionPlan,
          paymentMethod: 'instapay',
          paymentStatus: 'paid',
          notes: 'سداد تحويل انستاباي بالاستقبال',
          sourceType: 'subscription',
        };
        setMasterReportEntries((prev) => [newEntry, ...prev]);
      } else {
        // Cash in drawer
        const inflow: CashInflowItem = {
          id: `inf-${Date.now()}`,
          type: 'subscription',
          title: `اشتراك نقدي بالدرج (${newMember.subscriptionPlan}) - كود: ${newMember.code}`,
          amount: fee,
          date: new Date().toISOString(),
          memberName: newMember.name,
          paymentMethod: 'cash',
          recordedBy: 'الاستقبال',
        };
        setCashInflows((prev) => [inflow, ...prev]);

        const newEntry: MasterReportEntry = {
          id: `rep-${Date.now()}`,
          month: currentMonth,
          date: new Date().toISOString(),
          playerName: newMember.name,
          playerCode: newMember.code,
          amount: fee,
          coachId: coach?.id,
          coachName: coachName,
          sessionCategory: memberData.sessionCategory || 'gym',
          sessionTitle: newMember.subscriptionPlan,
          paymentMethod: 'cash',
          paymentStatus: 'paid',
          notes: 'سداد نقدي بالاستقبال',
          sourceType: 'subscription',
        };
        setMasterReportEntries((prev) => [newEntry, ...prev]);
      }
    }

    if (isSupabaseConfigured) {
      supabaseService.upsertMember(newMember).catch(() => {});
    }

    // Record normalized subscription history ONLY when a real subscription was created
    const hasRealSub =
      (newMember.totalDays ?? 0) > 0 ||
      (newMember.totalSessions ?? 0) > 0 ||
      fee > 0;
    if (hasRealSub) {
      const subRec: MemberSubscriptionRecord = {
        id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        memberId: newMember.id,
        memberCode: newMember.code,
        planName: newMember.subscriptionPlan,
        sessionCategory: newMember.sessionCategory,
        startDate: newMember.startDate || new Date().toISOString().slice(0, 10),
        endDate: newMember.endDate || new Date().toISOString().slice(0, 10),
        totalDays: newMember.totalDays || 0,
        totalSessions: newMember.totalSessions || 0,
        fee,
        paymentMethod: newMember.paymentMethod || 'cash',
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      setSubscriptions((prev) => [subRec, ...prev]);
      if (isSupabaseConfigured) {
        supabaseService.insertSubscription(subRec).catch(() => {});
      }
    }

    return newMember;
  };

  const updateMember = (id: string, updates: Partial<Member>) => {
    let updatedTarget: Member | undefined;
    setMembers((prev) => {
      const updated = prev.map((m) => (m.id === id ? { ...m, ...updates } : m));
      updatedTarget = updated.find((m) => m.id === id);
      if (updatedTarget && isSupabaseConfigured) {
        supabaseService.upsertMember(updatedTarget).catch(() => {});
      }
      return updated;
    });

    if (updatedTarget) {
      const target = updatedTarget;
      // مزامنة فورية مع طابور تسجيلات وحضور الاستقبال
      setCheckInLogs((prevLogs) => {
        const nextLogs = prevLogs.map((log) => {
          if (log.memberId === id || log.memberCode === target.code) {
            return {
              ...log,
              memberName: target.name,
              memberCode: target.code,
            };
          }
          return log;
        });
        return nextLogs;
      });

      // مزامنة فورية مع جلسات التأهيل والمساج النشطة
      setPhysioBookings((prevBookings) =>
        prevBookings.map((b) =>
          b.patientCode === target.code
            ? { ...b, patientName: target.name }
            : b
        )
      );
    }
  };

  const toggleMemberAsDoctor = (id: string) => {
    setMembers((prev) => {
      const updated: Member[] = prev.map((m) => {
        if (m.id === id) {
          const newType: Member['type'] = m.type === 'doctor' ? 'member' : 'doctor';
          return { ...m, type: newType };
        }
        return m;
      });
      const target = updated.find((m) => m.id === id);
      if (target && isSupabaseConfigured) {
        supabaseService.upsertMember(target).catch(() => {});
      }
      return updated;
    });
  };

  const renewMemberSubscription = async (
    memberId: string,
    planName: string,
    durationDays: number,
    fee: number,
    paymentMethod: 'cash' | 'instapay',
    notes?: string,
    sessionsCount?: number
  ): Promise<{ success: boolean; member?: Member }> => {
    const member = members.find((m) => m.id === memberId || m.code === memberId);
    if (!member) return { success: false };

    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + durationDays * 86400000).toISOString().split('T')[0];

    const updatedMember: Member = {
      ...member,
      subscriptionPlan: planName,
      subscriptionFee: fee,
      totalDays: durationDays,
      remainingDays: durationDays,
      totalSessions: sessionsCount !== undefined ? sessionsCount : member.totalSessions,
      remainingSessions: sessionsCount !== undefined ? sessionsCount : member.remainingSessions,
      startDate,
      endDate,
      active: true,
      paymentMethod,
      paymentStatus: 'paid',
    };

    // Pessimistic DB Write: Persist member + inflow + master report FIRST
    const memberOk = await strictDbWrite(() => supabaseService.upsertMember(updatedMember));
    if (!memberOk) {
      throw new NetworkDbError(NETWORK_ERROR_MESSAGE);
    }

    if (fee > 0) {
      const inflowTitle = `اشتراك ${paymentMethod === 'cash' ? 'نقدي بالدرج' : 'إنستاباي'} (${planName} - ${durationDays} يوم) - لاعب: ${member.name} (${member.code})`;
      const inflow: CashInflowItem = {
        id: `inf-sub-${Date.now()}`,
        type: 'subscription',
        title: inflowTitle,
        amount: fee,
        date: new Date().toISOString(),
        memberName: member.name,
        paymentMethod: paymentMethod,
        recordedBy: 'الاستقبال',
      };

      const repEntry: MasterReportEntry = {
        id: `rep-${Date.now()}`,
        month: currentMonth,
        date: new Date().toISOString(),
        playerName: member.name,
        playerCode: member.code,
        amount: fee,
        coachId: undefined,
        coachName: 'اشتراك مباشر بالخزينة',
        sessionCategory: 'gym',
        sessionTitle: `${planName} (${durationDays} يوم)`,
        paymentMethod: paymentMethod,
        paymentStatus: 'paid',
        notes: notes || `سداد ${paymentMethod === 'cash' ? 'نقدي بالدرج' : 'تحويل إنستاباي'} بالاستقبال`,
        sourceType: 'subscription',
      };

      const finOk = await strictDbWrite(async () => {
        const [a, b] = await Promise.all([
          supabaseService.insertCashInflow(inflow),
          supabaseService.upsertMasterReportEntry(repEntry),
        ]);
        return a && b;
      });
      if (!finOk) throw new NetworkDbError(NETWORK_ERROR_MESSAGE);

      setCashInflows((prev) => [inflow, ...prev]);
      setMasterReportEntries((prev) => [repEntry, ...prev]);
    }

    setMembers((prev) => prev.map((m) => (m.id === member.id ? updatedMember : m)));

    const subRec: MemberSubscriptionRecord = {
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      memberId: member.id,
      memberCode: member.code,
      planName,
      sessionCategory: member.sessionCategory || 'gym',
      startDate,
      endDate,
      totalDays: durationDays,
      totalSessions: sessionsCount !== undefined ? sessionsCount : member.totalSessions || 0,
      fee,
      paymentMethod,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    setSubscriptions((prev) => [subRec, ...prev]);
    if (isSupabaseConfigured) {
      supabaseService.insertSubscription(subRec).catch(() => {});
    }

    // Update any unassigned checkInLog for this member to be valid
    setCheckInLogs((prev) =>
      prev.map((l) =>
        l.memberId === member.id || l.memberCode === member.code
          ? { ...l, subscriptionValid: true }
          : l
      )
    );

    sounds.playCashRegister();
    return { success: true, member: updatedMember };
  };

  const findMemberByCode = (code: string): Member | undefined => {
    if (!code) return undefined;
    const clean = code.trim().toLowerCase();
    return members.find(
      (m) =>
        m.code.toLowerCase() === clean ||
        m.phone.includes(clean) ||
        m.name.toLowerCase().includes(clean)
    );
  };

  const calculatePlayerCheckOutQuote = (checkInLogId: string) => {
    const log = checkInLogs.find((l) => l.id === checkInLogId);
    if (!log) return null;
    const session = log.assignedSessionId
      ? sessions.find((s) => s.id === log.assignedSessionId)
      : undefined;
    const member = members.find((m) => m.id === log.memberId || m.code === log.memberCode);

    const entryTime = log.sessionStartedAt || log.timestamp;
    const elapsedMs = Math.max(0, Date.now() - new Date(entryTime).getTime());
    const durationMinutes = Math.max(1, Math.round(elapsedMs / 60000));

    const tier1Price = session?.tier1Price ?? session?.price ?? (log.chargedAmount || 0);
    const tier2Price = session?.tier2Price && session.tier2Price > 0 ? session.tier2Price : tier1Price;
    const tier3Price = session?.tier3Price && session.tier3Price > 0 ? session.tier3Price : tier2Price;
    const paidAtEntry = log.chargedAmount && log.chargedAmount > 0 ? log.chargedAmount : tier1Price;

    let tier: 'tier1' | 'tier2' | 'tier3' = 'tier1';
    let tierLabel = 'الشريحة الأولى (0 - 90 دقيقة)';
    let tierTotalPrice = tier1Price;
    let extraFeeDue = 0;

    if (durationMinutes > 120) {
      tier = 'tier3';
      tierLabel = 'الشريحة الثالثة (121 - 180 دقيقة)';
      tierTotalPrice = tier3Price;
      extraFeeDue = Math.max(0, tier3Price - paidAtEntry);
    } else if (durationMinutes > 90) {
      tier = 'tier2';
      tierLabel = 'الشريحة الثانية (91 - 120 دقيقة)';
      tierTotalPrice = tier2Price;
      extraFeeDue = Math.max(0, tier2Price - paidAtEntry);
    }

    return {
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
    };
  };

  const completePlayerCheckOut = async (
    checkInLogId: string,
    options: {
      paymentMethod: 'cash' | 'instapay' | 'card' | 'coach_debt' | 'package_deduction';
      extraFee: number;
      durationMinutes: number;
      pricingTier: 'tier1' | 'tier2' | 'tier3';
      coachId?: string;
      notes?: string;
      authorizedBy?: string;
    }
  ): Promise<{ success: boolean; message?: string }> => {
    const log = checkInLogs.find((l) => l.id === checkInLogId);
    if (!log) return { success: false, message: 'سجل الحضور غير موجود' };

    const nowIso = new Date().toISOString();
    const entryTime = log.sessionStartedAt || log.timestamp;
    const tierLabel =
      options.pricingTier === 'tier3'
        ? 'الشريحة الثالثة (121 - 180 دقيقة)'
        : options.pricingTier === 'tier2'
        ? 'الشريحة الثانية (91 - 120 دقيقة)'
        : 'الشريحة الأولى (0 - 90 دقيقة)';

    const updatedLog: CheckInLog = {
      ...log,
      checkOutStatus: 'checked_out',
      checkOutTime: nowIso,
      durationMinutes: options.durationMinutes,
      pricingTier: options.pricingTier,
      extraFeePaid: options.extraFee,
      extraPaymentMethod: options.paymentMethod,
    };

    // Pessimistic DB Write: Persist check-out log to Supabase FIRST
    const logSaved = await strictDbWrite(() => supabaseService.insertCheckInLog(updatedLog));
    if (!logSaved) {
      return { success: false, message: NETWORK_ERROR_MESSAGE };
    }

    setCheckInLogs((prev) => prev.map((l) => (l.id === checkInLogId ? updatedLog : l)));

    // Remove temporary player from active session list
    if (log.assignedSessionId) {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === log.assignedSessionId) {
            const updatedSess = {
              ...s,
              temporaryPlayerIds: (s.temporaryPlayerIds || []).filter((id) => id !== log.memberId),
            };
            if (isSupabaseConfigured) {
              supabaseService.upsertSession(updatedSess).catch(() => {});
            }
            return updatedSess;
          }
          return s;
        })
      );
    }

    // Update existing master report entry with duration & exit time
    setMasterReportEntries((prev) =>
      prev.map((entry) => {
        if (
          entry.playerName === log.memberName &&
          isAfterLastClosing(entry.date) &&
          entry.sourceType === 'session'
        ) {
          const updatedEntry: MasterReportEntry = {
            ...entry,
            entryTime,
            checkOutTime: nowIso,
            durationMinutes: options.durationMinutes,
            pricingTier: tierLabel,
            extraFeePaid: (entry.extraFeePaid || 0) + options.extraFee,
          };
          if (isSupabaseConfigured) {
            supabaseService.upsertMasterReportEntry(updatedEntry).catch(() => {});
          }
          return updatedEntry;
        }
        return entry;
      })
    );

    // Record extra fee financial movement if > 0 or package deduction
    if (options.extraFee > 0) {
      if (
        options.paymentMethod === 'cash' ||
        options.paymentMethod === 'instapay' ||
        options.paymentMethod === 'card'
      ) {
        const inflow: CashInflowItem = {
          id: `inf-chkout-${Date.now()}`,
          type: 'subscription',
          title: `فرق مدة حصة (${options.durationMinutes} د - ${tierLabel}) - ${log.memberName}`,
          amount: options.extraFee,
          date: nowIso,
          memberName: log.memberName,
          paymentMethod: options.paymentMethod,
          recordedBy: options.authorizedBy || 'الاستقبال',
        };
        setCashInflows((prev) => [inflow, ...prev]);

        const repEntry: MasterReportEntry = {
          id: `rep-chkout-${Date.now()}`,
          month: currentMonth,
          date: nowIso,
          playerName: log.memberName,
          playerCode: log.memberCode,
          amount: options.extraFee,
          coachId: log.assignedCoachId,
          coachName: log.assignedCoachName || 'بدون مدرب',
          sessionCategory: log.assignedCategory || 'group',
          sessionTitle: `فرق مدة خروج: ${log.assignedSessionTitle || 'حصة'}`,
          paymentMethod: options.paymentMethod,
          paymentStatus: 'paid',
          notes: options.notes || `فرق مدة التواجد (${options.durationMinutes} دقيقة) - ${tierLabel}`,
          sourceType: 'session',
          entryTime,
          checkOutTime: nowIso,
          durationMinutes: options.durationMinutes,
          pricingTier: tierLabel,
          extraFeePaid: options.extraFee,
        };
        setMasterReportEntries((prev) => [repEntry, ...prev]);

        if (isSupabaseConfigured) {
          supabaseService.insertCashInflow(inflow).catch(() => {});
          supabaseService.upsertMasterReportEntry(repEntry).catch(() => {});
        }
      } else if (options.paymentMethod === 'coach_debt') {
        const targetCoachId = options.coachId || log.assignedCoachId || coaches[0]?.id || 'COACH-01';
        const targetCoach = coaches.find((c) => c.id === targetCoachId);
        const coachName = targetCoach?.name || log.assignedCoachName || 'الكابتن';

        const debtTrx: TrainerTransaction = {
          transaction_id: `TRX-OUT-${Date.now()}-${targetCoachId}`,
          coach_id: targetCoachId,
          coach_name: coachName,
          amount: options.extraFee,
          collected_by: 'coach',
          payer_type: `فرق مدة حصة (${options.durationMinutes} دقيقة)`,
          payer_name: log.memberName,
          gym_share: options.extraFee,
          coach_share: 0,
          status: 'pending',
          created_at: nowIso,
          month: currentMonth,
          type: 'session_charge',
          payment_method: 'coach_collected',
          notes: options.notes || `تحميل فرق مدة (${options.durationMinutes} د - ${tierLabel}) للاعب ${log.memberName}`,
        };
        setTrainerTransactions((prev) => [debtTrx, ...prev]);

        const repEntry: MasterReportEntry = {
          id: `rep-chkout-${Date.now()}`,
          month: currentMonth,
          date: nowIso,
          playerName: log.memberName,
          playerCode: log.memberCode,
          amount: options.extraFee,
          coachId: targetCoachId,
          coachName,
          sessionCategory: log.assignedCategory || 'group',
          sessionTitle: `فرق مدة خروج (على الكابتن): ${log.assignedSessionTitle || 'حصة'}`,
          paymentMethod: 'coach_debt',
          paymentStatus: 'pending_on_coach',
          notes: options.notes || `تحميل فرق مدة (${options.durationMinutes} دقيقة) على كابتن ${coachName}`,
          sourceType: 'session',
          entryTime,
          checkOutTime: nowIso,
          durationMinutes: options.durationMinutes,
          pricingTier: tierLabel,
          extraFeePaid: options.extraFee,
        };
        setMasterReportEntries((prev) => [repEntry, ...prev]);

        if (isSupabaseConfigured) {
          supabaseService.upsertTrainerTransaction(debtTrx).catch(() => {});
          supabaseService.upsertMasterReportEntry(repEntry).catch(() => {});
        }
      } else if (options.paymentMethod === 'package_deduction') {
        const mem = members.find((m) => m.id === log.memberId);
        if (mem && mem.remainingSessions > 0) {
          updateMember(mem.id, { remainingSessions: Math.max(0, mem.remainingSessions - 1) });
        }
        const repEntry: MasterReportEntry = {
          id: `rep-chkout-${Date.now()}`,
          month: currentMonth,
          date: nowIso,
          playerName: log.memberName,
          playerCode: log.memberCode,
          amount: 0,
          coachId: log.assignedCoachId,
          coachName: log.assignedCoachName || 'بدون مدرب',
          sessionCategory: log.assignedCategory || 'group',
          sessionTitle: `فرق مدة خروج (خصم حصة إضافية): ${log.assignedSessionTitle || 'حصة'}`,
          paymentMethod: 'cash',
          paymentStatus: 'paid',
          notes: `تسوية فرق مدة (${options.durationMinutes} دقيقة - ${tierLabel}) بخصم حصة إضافية من الباقة`,
          sourceType: 'session',
          entryTime,
          checkOutTime: nowIso,
          durationMinutes: options.durationMinutes,
          pricingTier: tierLabel,
          extraFeePaid: 0,
        };
        setMasterReportEntries((prev) => [repEntry, ...prev]);
        if (isSupabaseConfigured) {
          supabaseService.upsertMasterReportEntry(repEntry).catch(() => {});
        }
      }
    }

    return { success: true };
  };

  const performCheckIn = (
    memberId: string,
    method: 'qr' | 'manual' = 'qr',
    fallbackMember?: Partial<Member>
  ) => {
    let member = members.find((m) => m.id === memberId || m.code === memberId);
    if (!member && fallbackMember && (fallbackMember.name || fallbackMember.code)) {
      member = {
        id: memberId || `mem-${Date.now()}`,
        code: fallbackMember.code || generateUniqueMemberCode(members),
        name: fallbackMember.name || 'متدرب جديد',
        phone: fallbackMember.phone || '',
        type: fallbackMember.type || 'member',
        subscriptionPlan: fallbackMember.subscriptionPlan || 'بدون اشتراك نشط',
        subscriptionFee: fallbackMember.subscriptionFee || 0,
        startDate: fallbackMember.startDate || new Date().toISOString().split('T')[0],
        endDate: fallbackMember.endDate || '',
        totalDays: fallbackMember.totalDays || 0,
        remainingDays: fallbackMember.remainingDays !== undefined ? fallbackMember.remainingDays : 0,
        totalSessions: fallbackMember.totalSessions !== undefined ? fallbackMember.totalSessions : 0,
        remainingSessions: fallbackMember.remainingSessions !== undefined ? fallbackMember.remainingSessions : 0,
        active: fallbackMember.active !== undefined ? fallbackMember.active : false,
      };
      setMembers((prev) => [member!, ...prev]);
    }

    if (!member) {
      return { success: false, message: 'عضو غير موجود' };
    }

    // Check if member is ALREADY active inside a session today -> treat as Check-Out Scan!
    const activeSessionLog = checkInLogs.find(
      (l) =>
        (l.memberId === member!.id || l.memberCode === member!.code) &&
        isAfterLastClosing(l.timestamp) &&
        l.seatingStatus === 'assigned' &&
        Boolean(l.assignedSessionId) &&
        l.checkOutStatus !== 'checked_out'
    );

    if (activeSessionLog) {
      const quote = calculatePlayerCheckOutQuote(activeSessionLog.id);
      if (quote && quote.extraFeeDue <= 0 && quote.durationMinutes <= 90) {
        // <= 90 mins (Tier 1): Complete check-out immediately with 0 EGP extra
        completePlayerCheckOut(activeSessionLog.id, {
          paymentMethod: 'cash',
          extraFee: 0,
          durationMinutes: quote.durationMinutes,
          pricingTier: 'tier1',
        });
        return {
          success: true,
          member,
          isCheckOut: true,
          requiresSettlement: false,
          durationMinutes: quote.durationMinutes,
          extraFeeDue: 0,
        };
      } else if (quote) {
        // > 90 mins: flag pending settlement so Reception opens Duration Settlement Modal
        const flaggedLog: CheckInLog = {
          ...activeSessionLog,
          checkOutStatus: 'pending_settlement',
        };
        setCheckInLogs((prev) => prev.map((l) => (l.id === activeSessionLog.id ? flaggedLog : l)));
        if (isSupabaseConfigured) {
          supabaseService.insertCheckInLog(flaggedLog).catch(() => {});
        }
        return {
          success: true,
          member,
          isCheckOut: true,
          requiresSettlement: true,
          checkOutLogId: activeSessionLog.id,
          durationMinutes: quote.durationMinutes,
          extraFeeDue: quote.extraFeeDue,
        };
      }
    }

    // التحقق الدقيق من صلاحية اشتراك اللاعب وحصصه
    const subStatus = getSubscriptionStatus(member);
    const isValid = subStatus.isActive && Boolean(member.active);

    if (isValid && member.remainingSessions > 0) {
      updateMember(member.id, {
        remainingSessions: Math.max(0, member.remainingSessions - 1),
      });
    }

    const log: CheckInLog = {
      id: `chk-${Date.now()}`,
      memberId: member.id,
      memberName: member.name,
      memberCode: member.code,
      memberType: member.type,
      timestamp: new Date().toISOString(),
      method,
      subscriptionValid: isValid,
      seatingStatus: 'unassigned',
    };
    setCheckInLogs((prev) => [log, ...prev.slice(0, 49)]);

    if (isSupabaseConfigured) {
      supabaseService.insertCheckInLog(log).catch(() => {});
    }

    // Broadcast check-in to serverless relay
    try {
      fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log),
      }).catch(() => {});
    } catch {
      // ignore
    }

    return {
      success: true,
      member: {
        ...member,
        remainingSessions: member.remainingSessions > 0 ? member.remainingSessions - 1 : 0,
      },
    };
  };

  // Sessions logic
  const addSession = (sessionData: Omit<GymSession, 'id'>) => {
    const newSession: GymSession = {
      ...sessionData,
      id: `sess-${Date.now()}`,
      completedTodayByCoach: {},
      temporaryPlayerIds: [],
    };
    setSessions((prev) => [...prev, newSession]);
    if (isSupabaseConfigured) {
      supabaseService.upsertSession(newSession).catch(() => {});
    }
  };

  const updateSession = (id: string, updates: Partial<GymSession>) => {
    setSessions((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, ...updates } : s));
      const target = updated.find((s) => s.id === id);
      if (target && isSupabaseConfigured) {
        supabaseService.upsertSession(target).catch(() => {});
      }
      return updated;
    });
  };

  const deleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (isSupabaseConfigured) {
      supabaseService.deleteSession(id).catch(() => {});
    }
  };

  const startSession = (id: string) => {
    setSessions((prev) => {
      const updated = prev.map((s) => {
        if (s.id === id) {
          return {
            ...s,
            status: 'in-progress' as const,
            startedAt: new Date().toISOString(),
            endedAt: undefined,
          };
        }
        return s;
      });
      const target = updated.find((s) => s.id === id);
      if (target && isSupabaseConfigured) {
        supabaseService.upsertSession(target).catch(() => {});
      }
      return updated;
    });
    sounds.playSuccessDing();
  };

  const endSession = (id: string) => {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;

    // 1. حساب عدد الحضور الذين تم تسكينهم صراحة كـ "تحميل مديونية على الكابتن" فقط
    // (المتدربون المسددون بالاستقبال أو أصحاب الاشتراكات السارية لا يتم تحميل قيمتهم كمديونية على الكابتن نهائياً)
    const coachDebtAttendees = checkInLogs.filter(
      (l) => l.assignedSessionId === session.id && l.seatingPathway === 'coach_debt'
    );
    const coachDebtAttendeesCount = coachDebtAttendees.length;
    const sessionTotalRev = coachDebtAttendeesCount * session.price;

    const compMap: { [coachId: string]: boolean } = {};
    const assignedCoaches = coaches.filter((c) => session.coachIds.includes(c.id));
    const coachShareAmount =
      assignedCoaches.length > 1
        ? Math.round(sessionTotalRev / assignedCoaches.length)
        : sessionTotalRev;

    const batchTrainerTxs: TrainerTransaction[] = [];
    const batchMasterEntries: MasterReportEntry[] = [];
    const perSessionCoachUpdates: Coach[] = [];

    assignedCoaches.forEach((coach) => {
      compMap[coach.id] = true;

      // أجر المدرب للحصة إذا كان تعاقده بنظام الحصة (Per Session) - يُضاف لمستحقات الكابتن (له فلوس)
      if (coach.paymentType === 'per_session') {
        const rate = coach.ratePerSession || 150;
        const updatedCoach = { ...coach, currentBalance: coach.currentBalance + rate };
        perSessionCoachUpdates.push(updatedCoach);
        setCoaches((prevCoaches) =>
          prevCoaches.map((c) =>
            c.id === coach.id
              ? {
                  ...c,
                  currentBalance: c.currentBalance + rate,
                }
              : c
          )
        );
      }

      // تحميل المديونية على الكابتن فقط في حال وجود متدربين تم تحصيل قيمتهم بيده خارجياً (seatingPathway === 'coach_debt')
      // ولا يتم إدراج نقدية بالدرج إطلاقاً إلا عند سداد الكابتن الفعلي لاحقاً منعاً للازدواج الحسابي
      if (sessionTotalRev > 0) {
        const newTrx: TrainerTransaction = {
          transaction_id: `TRX-SESS-${Date.now()}-${coach.id}`,
          coach_id: coach.id,
          coach_name: coach.name,
          amount: coachShareAmount,
          collected_by: 'coach',
          payer_type: `حصة ${session.title}`,
          payer_name: `${coachDebtAttendeesCount} متدربين (${session.sport})`,
          gym_share: coachShareAmount,
          coach_share: 0,
          status: 'pending',
          created_at: new Date().toISOString(),
          month: currentMonth,
          type: 'session_charge',
          payment_method: 'coach_collected',
          notes: `تحميل قيمة الحصة بعد اكتمالها (${coachDebtAttendeesCount} متدربين تم تحصيلهم بيد الكابتن × ${session.price} ج.م)`,
        };
        batchTrainerTxs.push(newTrx);

        // إدراج قيد بالتقرير الشامل كمديونية معلقة على الكابتن
        const repEntry: MasterReportEntry = {
          id: `rep-sess-${Date.now()}-${coach.id}`,
          month: currentMonth,
          date: new Date().toISOString(),
          playerName: `${coachDebtAttendeesCount} متدربين (${session.title})`,
          playerCode: `SESS-${session.id.slice(-4)}`,
          amount: coachShareAmount,
          coachId: coach.id,
          coachName: coach.name,
          sessionCategory: session.sessionCategory || 'group',
          sessionTitle: session.title,
          paymentMethod: 'coach_collected',
          paymentStatus: 'pending_on_coach',
          notes: `تحميل مديونية على الكابتن (${coachDebtAttendeesCount} لاعب)`,
          sourceType: 'session',
        };
        batchMasterEntries.push(repEntry);
      }
    });

    if (batchTrainerTxs.length > 0) {
      setTrainerTransactions((prev) => [...batchTrainerTxs, ...prev]);
    }
    if (batchMasterEntries.length > 0) {
      setMasterReportEntries((prev) => [...batchMasterEntries, ...prev]);
    }
    if (isSupabaseConfigured) {
      if (perSessionCoachUpdates.length > 0) {
        supabaseService.upsertCoachesBatch(perSessionCoachUpdates).catch(() => {});
      }
      if (batchTrainerTxs.length > 0) {
        supabaseService.upsertTrainerTransactionsBatch(batchTrainerTxs).catch(() => {});
      }
      if (batchMasterEntries.length > 0) {
        supabaseService.upsertMasterReportEntriesBatch(batchMasterEntries).catch(() => {});
      }
    }

    setSessions((prev) => {
      const updated = prev.map((s) => {
        if (s.id === id) {
          return {
            ...s,
            status: 'completed' as const,
            endedAt: new Date().toISOString(),
            completedTodayByCoach: {
              ...(s.completedTodayByCoach || {}),
              ...compMap,
            },
          };
        }
        return s;
      });
      const target = updated.find((s) => s.id === id);
      if (target && isSupabaseConfigured) {
        supabaseService.upsertSession(target).catch(() => {});
      }
      return updated;
    });
    sounds.playCashRegister();
  };

  const assignPlayerToSession = (sessionId: string, memberId: string, isTemporary = false) => {
    let updatedTarget: GymSession | undefined;
    setSessions((prev) => {
      const updated = prev.map((s) => {
        if (s.id === sessionId) {
          if (isTemporary) {
            const temp = s.temporaryPlayerIds || [];
            if (!temp.includes(memberId)) {
              return {
                ...s,
                temporaryPlayerIds: [...temp, memberId],
              };
            }
          } else {
            if (!s.enrolledPlayerIds.includes(memberId)) {
              return {
                ...s,
                enrolledPlayerIds: [...s.enrolledPlayerIds, memberId],
              };
            }
          }
        }
        return s;
      });
      updatedTarget = updated.find((s) => s.id === sessionId);
      return updated;
    });

    if (updatedTarget && isSupabaseConfigured) {
      supabaseService.upsertSession(updatedTarget).catch(() => {});
    }

    if (!isTemporary) {
      updateMember(memberId, { assignedSessionId: sessionId });
    }
  };

  const removePlayerFromSession = (sessionId: string, memberId: string) => {
    let updatedTarget: GymSession | undefined;
    setSessions((prev) => {
      const updated = prev.map((s) => {
        if (s.id === sessionId) {
          return {
            ...s,
            enrolledPlayerIds: s.enrolledPlayerIds.filter((id) => id !== memberId),
            temporaryPlayerIds: (s.temporaryPlayerIds || []).filter((id) => id !== memberId),
          };
        }
        return s;
      });
      updatedTarget = updated.find((s) => s.id === sessionId);
      return updated;
    });

    if (updatedTarget && isSupabaseConfigured) {
      supabaseService.upsertSession(updatedTarget).catch(() => {});
    }

    updateMember(memberId, { assignedSessionId: undefined });

    // تراجع نظيف وفوري عن حركة الدرج، استحقاقات الكابتن، والتقرير الشامل
    const member = members.find((m) => m.id === memberId);
    const memberName = member?.name;

    const matchedLog = checkInLogs.find(
      (l) =>
        (l.memberId === memberId || (memberName && l.memberName === memberName)) &&
        l.assignedSessionId === sessionId &&
        l.seatingStatus === 'assigned' &&
        isAfterLastClosing(l.timestamp)
    );

    if (matchedLog) {
      const chargedAmount = matchedLog.chargedAmount || 0;
      const coachShare = matchedLog.coachShareAmount || 0;
      const coachId = matchedLog.assignedCoachId;

      // 1. التراجع عن حركة الإيراد بالدرج إن وُجدت
      if (chargedAmount > 0) {
        setCashInflows((prev) => {
          const inflowToRemove = prev.find(
            (inf) =>
              (inf.id.startsWith('inf-seat-') || inf.type === 'subscription') &&
              (inf.memberName === memberName || (memberName && inf.title.includes(memberName))) &&
              isAfterLastClosing(inf.date)
          );
          if (inflowToRemove) {
            if (isSupabaseConfigured) {
              supabaseService.deleteCashInflow(inflowToRemove.id).catch(() => {});
            }
            return prev.filter((inf) => inf.id !== inflowToRemove.id);
          }
          return prev;
        });
      }

      // 2. التراجع عن رصيد واستحقاقات الكابتن المسجلة
      if (coachId && coachShare > 0) {
        setCoaches((prev) =>
          prev.map((c) => {
            if (c.id === coachId) {
              const updatedCoach = {
                ...c,
                currentBalance: Math.max(0, (c.currentBalance || 0) - coachShare),
              };
              if (isSupabaseConfigured) {
                supabaseService.upsertCoach(updatedCoach).catch(() => {});
              }
              return updatedCoach;
            }
            return c;
          })
        );

        setTrainerTransactions((prev) => {
          const trxToRemove = prev.find(
            (t) =>
              t.coach_id === coachId &&
              t.payer_name === memberName &&
              t.coach_share === coachShare &&
              isAfterLastClosing(t.created_at)
          );
          if (trxToRemove) {
            if (isSupabaseConfigured) {
              supabaseService.deleteTrainerTransaction(trxToRemove.transaction_id).catch(() => {});
            }
            return prev.filter((t) => t.transaction_id !== trxToRemove.transaction_id);
          }
          return prev;
        });
      }

      // 3. التراجع عن قيد التقرير الشامل
      if (memberName) {
        setMasterReportEntries((prev) => {
          const entryToRemove = prev.find(
            (e) =>
              e.playerName === memberName &&
              (e.coachId === coachId || !coachId) &&
              isAfterLastClosing(e.date)
          );
          if (entryToRemove) {
            if (isSupabaseConfigured) {
              supabaseService.deleteMasterReportEntry(entryToRemove.id).catch(() => {});
            }
            return prev.filter((e) => e.id !== entryToRemove.id);
          }
          return prev;
        });
      }

      // 4. إعادة حالة سجل الحضور إلى غير مسكن
      setCheckInLogs((prev) =>
        prev.map((l) =>
          l.id === matchedLog.id
            ? {
                ...l,
                seatingStatus: 'unassigned' as const,
                assignedCategory: undefined,
                assignedCoachId: undefined,
                assignedCoachName: undefined,
                assignedSessionId: undefined,
                assignedSessionTitle: undefined,
                paymentMode: undefined,
                seatingPathway: undefined,
                coachShareType: undefined,
                coachShareValue: undefined,
                coachShareAmount: undefined,
                gymShareAmount: undefined,
                chargedAmount: undefined,
              }
            : l
        )
      );

      if (isSupabaseConfigured) {
        supabaseService.insertCheckInLog({
          ...matchedLog,
          seatingStatus: 'unassigned',
          assignedCategory: undefined,
          assignedCoachId: undefined,
          assignedCoachName: undefined,
          assignedSessionId: undefined,
          assignedSessionTitle: undefined,
          paymentMode: undefined,
          seatingPathway: undefined,
          coachShareType: undefined,
          coachShareValue: undefined,
          coachShareAmount: undefined,
          gymShareAmount: undefined,
          chargedAmount: undefined,
        }).catch(() => {});
      }
    }
  };

  const toggleSessionCoachCompletion = (sessionId: string, coachId: string) => {
    setSessions((prev) => {
      const updated = prev.map((s) => {
        if (s.id === sessionId) {
          const currentStatus = !!s.completedTodayByCoach?.[coachId];
          return {
            ...s,
            completedTodayByCoach: {
              ...(s.completedTodayByCoach || {}),
              [coachId]: !currentStatus,
            },
          };
        }
        return s;
      });
      const target = updated.find((s) => s.id === sessionId);
      if (target && isSupabaseConfigured) {
        supabaseService.upsertSession(target).catch(() => {});
      }
      return updated;
    });
  };

  // Coach logic & Automatic Expense Logging on Settlement!
  const addCoach = (coachData: Omit<Coach, 'id' | 'currentBalance' | 'totalPaidToday'>) => {
    const newCoach: Coach = {
      ...coachData,
      id: `cch-${Date.now()}`,
      code: coachData.code && /^\d{5}$/.test(coachData.code.trim())
        ? coachData.code.trim()
        : generateUniqueCoachCode(coaches),
      currentBalance: 0,
      totalPaidToday: 0,
    };
    setCoaches((prev) => [...prev, newCoach]);
    if (isSupabaseConfigured) {
      supabaseService.upsertCoach(newCoach).catch(() => {});
    }
  };

  const updateCoach = (id: string, updates: Partial<Coach>) => {
    setCoaches((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, ...updates } : c));
      const target = updated.find((c) => c.id === id);
      if (target && isSupabaseConfigured) {
        supabaseService.upsertCoach(target).catch(() => {});
      }
      return updated;
    });
  };

  // AUTOMATIC HOOK 1: Settle coach account and automatically deduct in Expenses page & Drawer!
  const settleCoachAccount = (coachId: string, adminUsername: string) => {
    const coach = coaches.find((c) => c.id === coachId);
    if (!coach || coach.currentBalance <= 0) {
      return { success: false, settledAmount: 0 };
    }

    const settled = coach.currentBalance;

    // Reset coach balance and increase today's paid
    setCoaches((prev) =>
      prev.map((c) =>
        c.id === coachId
          ? {
              ...c,
              currentBalance: 0,
              totalPaidToday: c.totalPaidToday + settled,
            }
          : c
      )
    );

    // 1. Settlement log
    const log: SettlementLog = {
      id: `stl-${Date.now()}`,
      coachId: coach.id,
      coachName: coach.name,
      amount: settled,
      timestamp: new Date().toISOString(),
      authorizedBy: adminUsername,
    };
    setSettlementLogs((prev) => [log, ...prev]);

    // 2. AUTOMATIC EXPENSE RECORD: Auto-recorded in Expenses page and deducted from Drawer!
    const autoExpense: ExpenseItem = {
      id: `exp-cch-${Date.now()}`,
      title: `تصفية حساب ومستحقات المدرب: ${coach.name}`,
      category: 'trainer_payout',
      amount: settled,
      date: new Date().toISOString(),
      recordedBy: adminUsername,
      notes: `تصفية حصص اليوم للمدرب ${coach.name} معتمدة بواسطة ${adminUsername}`,
      paymentMethod: 'cash',
      autoGenerated: true,
      relatedEntityId: coach.id,
    };
    setExpenses((prev) => [autoExpense, ...prev]);

    if (isSupabaseConfigured) {
      supabaseService.upsertCoach({
        ...coach,
        currentBalance: 0,
        totalPaidToday: coach.totalPaidToday + settled,
      }).catch(() => {});
      supabaseService.insertExpense(autoExpense).catch(() => {});
    }

    return { success: true, settledAmount: settled };
  };

  // AUTOMATIC HOOK 2: Pay Monthly Salary for monthly coach and log in Expenses!
  const payMonthlySalary = async (coachId: string, adminUsername: string): Promise<{ success: boolean; salaryAmount: number }> => {
    const coach = coaches.find((c) => c.id === coachId);
    if (!coach || coach.paymentType !== 'monthly' || !coach.monthlySalary) {
      return { success: false, salaryAmount: 0 };
    }

    const salary = coach.monthlySalary;
    const updatedCoach: Coach = {
      ...coach,
      monthlySalaryPaidThisMonth: true,
      lastSalaryPaymentDate: new Date().toISOString().slice(0, 10),
      totalPaidToday: coach.totalPaidToday + salary,
    };

    const autoExpense: ExpenseItem = {
      id: `exp-salary-${Date.now()}`,
      title: `صرف الراتب الشهري: ${coach.name}`,
      category: 'trainer_payout',
      amount: salary,
      date: new Date().toISOString(),
      recordedBy: adminUsername,
      notes: `صرف راتب شهر ${new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}`,
      paymentMethod: 'cash',
      autoGenerated: true,
      relatedEntityId: coach.id,
    };

    const ok = await strictDbWrite(async () => {
      const [a, b] = await Promise.all([
        supabaseService.upsertCoach(updatedCoach),
        supabaseService.insertExpense(autoExpense),
      ]);
      return a && b;
    });
    if (!ok) {
      throw new NetworkDbError(NETWORK_ERROR_MESSAGE);
    }

    setCoaches((prev) => prev.map((c) => (c.id === coachId ? updatedCoach : c)));
    setExpenses((prev) => [autoExpense, ...prev]);

    return { success: true, salaryAmount: salary };
  };

  // Physio & Massage logic
  const startPhysioSession = (data: {
    doctorName: string;
    doctorCode: string;
    coachId?: string;
    coachName?: string;
    patientName: string;
    patientCode?: string;
    roomName: string;
    hourlyRate: number;
    serviceType?: 'physio' | 'massage';
    status?: 'waiting' | 'active';
  }) => {
    const isWaiting = data.status === 'waiting';
    const newBooking: PhysioBooking = {
      id: `${data.serviceType || 'physio'}-${Date.now()}`,
      doctorName: data.doctorName,
      doctorCode: data.doctorCode,
      coachId: data.coachId,
      coachName: data.coachName || data.doctorName,
      patientName: data.patientName,
      patientCode: data.patientCode,
      roomName: data.roomName,
      hourlyRate: data.hourlyRate,
      startTime: new Date().toISOString(),
      elapsedMinutes: isWaiting ? 0 : 1,
      totalFee: data.hourlyRate,
      serviceType: data.serviceType || 'physio',
      status: data.status || 'active',
      paid: false,
    };
    setPhysioBookings((prev) => [newBooking, ...prev]);
    if (isSupabaseConfigured) {
      supabaseService.upsertPhysioBooking(newBooking).catch(() => {});
    }
    return newBooking;
  };

  const beginPhysioSession = (id: string) => {
    setPhysioBookings((prev) => {
      const updated = prev.map((b) =>
        b.id === id
          ? {
              ...b,
              status: 'active' as const,
              startTime: new Date().toISOString(),
              elapsedMinutes: 1,
            }
          : b
      );
      const target = updated.find((b) => b.id === id);
      if (target && isSupabaseConfigured) {
        supabaseService.upsertPhysioBooking(target).catch(() => {});
      }
      return updated;
    });
  };

  const finishPhysioSession = (id: string) => {
    setPhysioBookings((prev) => {
      const updated = prev.map((b) =>
        b.id === id
          ? {
              ...b,
              status: 'completed' as const,
              endTime: new Date().toISOString(),
              isPaused: false,
            }
          : b
      );
      const target = updated.find((b) => b.id === id);
      if (target && isSupabaseConfigured) {
        supabaseService.upsertPhysioBooking(target).catch(() => {});
      }
      return updated;
    });
  };

  const completePhysioSession = (id: string) => {
    finishPhysioSession(id);
  };

  const addExtraFeeToPhysio = (id: string, extraAmount: number, reason?: string) => {
    setPhysioBookings((prev) => {
      const updated = prev.map((b) => {
        if (b.id !== id) return b;
        const currentExtra = b.extraFee || 0;
        const newExtra = currentExtra + extraAmount;
        return {
          ...b,
          extraFee: newExtra,
          totalFee: b.totalFee + extraAmount,
          extraFeeReason: reason || b.extraFeeReason || 'تكلفة وقت إضافي (تجاوز الساعة)',
        };
      });
      const target = updated.find((b) => b.id === id);
      if (target && isSupabaseConfigured) {
        supabaseService.upsertPhysioBooking(target).catch(() => {});
      }
      return updated;
    });
  };

  const pausePhysioSession = (id: string) => {
    setPhysioBookings((prev) => {
      const updated = prev.map((b) =>
        b.id === id
          ? {
              ...b,
              isPaused: true,
              pausedAt: new Date().toISOString(),
              status: 'paused' as const,
            }
          : b
      );
      const target = updated.find((b) => b.id === id);
      if (target && isSupabaseConfigured) {
        supabaseService.upsertPhysioBooking(target).catch(() => {});
      }
      return updated;
    });
  };

  const resumePhysioSession = (id: string) => {
    setPhysioBookings((prev) => {
      const updated = prev.map((b) => {
        if (b.id !== id) return b;
        const pausedAtTime = b.pausedAt ? new Date(b.pausedAt).getTime() : Date.now();
        const pauseDurationSec = Math.round((Date.now() - pausedAtTime) / 1000);
        return {
          ...b,
          isPaused: false,
          pausedAt: undefined,
          status: 'active' as const,
          totalPausedSeconds: (b.totalPausedSeconds || 0) + pauseDurationSec,
        };
      });
      const target = updated.find((b) => b.id === id);
      if (target && isSupabaseConfigured) {
        supabaseService.upsertPhysioBooking(target).catch(() => {});
      }
      return updated;
    });
  };

  const billPhysioSession = (
    id: string,
    billingData: {
      billedTo: 'patient' | 'doctor' | 'coach';
      paymentMethod: 'cash' | 'instapay' | 'coach_debt';
      instapayRef?: string;
      chargedToCoachId?: string;
      notes?: string;
      totalAmount?: number;
      extraFee?: number;
      extraFeeReason?: string;
    }
  ) => {
    const booking = physioBookings.find((b) => b.id === id);
    if (!booking) return;

    const extra = billingData.extraFee || 0;
    const finalFee = (billingData.totalAmount !== undefined && billingData.totalAmount > 0)
      ? billingData.totalAmount
      : (booking.totalFee + extra);

    setPhysioBookings((prev) => {
      const updated = prev.map((b) =>
        b.id === id
          ? {
              ...b,
              status: 'completed' as const,
              endTime: new Date().toISOString(),
              isPaused: false,
              billedTo: billingData.billedTo,
              paymentMethod: billingData.paymentMethod,
              instapayRef: billingData.instapayRef,
              chargedToCoachId: billingData.chargedToCoachId,
              extraFee: (b.extraFee || 0) + extra,
              extraFeeReason: billingData.extraFeeReason || b.extraFeeReason,
              totalFee: finalFee,
              paid: billingData.paymentMethod !== 'coach_debt',
              notes: billingData.notes,
            }
          : b
      );
      const target = updated.find((b) => b.id === id);
      if (target && isSupabaseConfigured) {
        supabaseService.upsertPhysioBooking(target).catch(() => {});
      }
      return updated;
    });

    const targetCoach = coaches.find(
      (c) =>
        c.id === billingData.chargedToCoachId ||
        c.id === booking.coachId ||
        c.name.trim().toLowerCase() === (booking.doctorName || '').trim().toLowerCase() ||
        (booking.doctorName && booking.doctorName.trim().toLowerCase().includes(c.name.trim().toLowerCase())) ||
        (booking.doctorName && c.name.trim().toLowerCase().includes(booking.doctorName.trim().toLowerCase()))
    );
    const coachId = targetCoach?.id || billingData.chargedToCoachId || booking.coachId || coaches[0]?.id || 'COACH-01';
    const coachName = targetCoach ? targetCoach.name : (booking.coachName || booking.doctorName || 'الكابتن');
    const serviceLabel = booking.serviceType === 'massage' ? 'مساج واستشفاء' : 'علاج طبيعي';

    if (billingData.paymentMethod === 'cash') {
      const inflow: CashInflowItem = {
        id: `inf-phy-${Date.now()}`,
        type: 'physio',
        title: `إيراد جلسة ${serviceLabel} (${booking.roomName}) - كابتن ${coachName}`,
        amount: finalFee,
        date: new Date().toISOString(),
        memberName: booking.patientName,
        paymentMethod: 'cash',
        recordedBy: 'الاستقبال',
      };
      setCashInflows((prev) => [inflow, ...prev]);
      if (isSupabaseConfigured) {
        supabaseService.insertCashInflow(inflow).catch(() => {});
      }
    } else if (billingData.paymentMethod === 'instapay') {
      const inflow: CashInflowItem = {
        id: `inf-phy-${Date.now()}`,
        type: 'physio',
        title: `تحويل انستاباي جلسة ${serviceLabel} (${booking.roomName}) - كود: ${billingData.instapayRef || 'N/A'} - كابتن ${coachName}`,
        amount: finalFee,
        date: new Date().toISOString(),
        memberName: booking.patientName,
        paymentMethod: 'instapay',
        recordedBy: 'الاستقبال',
      };
      setCashInflows((prev) => [inflow, ...prev]);
      if (isSupabaseConfigured) {
        supabaseService.insertCashInflow(inflow).catch(() => {});
      }
    } else if (billingData.paymentMethod === 'coach_debt') {
      const coachDebtTrx: TrainerTransaction = {
        transaction_id: `TRX-PHY-${Date.now()}-${coachId.slice(-4)}`,
        coach_id: coachId,
        coach_name: coachName,
        amount: finalFee,
        collected_by: 'coach',
        payer_type: `جلسة ${serviceLabel}`,
        payer_name: booking.patientName,
        gym_share: finalFee,
        coach_share: 0,
        status: 'pending',
        created_at: new Date().toISOString(),
        month: currentMonth,
        type: 'physio_charge',
        payment_method: 'coach_collected',
        notes: billingData.notes || `مديونية جلسة ${serviceLabel} (${booking.roomName}) محملة على الكابتن`,
      };

      setTrainerTransactions((prev) => [coachDebtTrx, ...prev]);

      if (targetCoach) {
        setCoaches((prev) =>
          prev.map((c) =>
            c.id === targetCoach.id
              ? {
                  ...c,
                  currentBalance: (c.currentBalance || 0) - finalFee,
                }
              : c
          )
        );
      }

      if (isSupabaseConfigured) {
        supabaseService.upsertTrainerTransaction(coachDebtTrx).catch(() => {});
        if (targetCoach) {
          supabaseService.upsertCoach({
            ...targetCoach,
            currentBalance: (targetCoach.currentBalance || 0) - finalFee,
          }).catch(() => {});
        }
      }
    }

    // Auto record into Master Report!
    const newEntry: MasterReportEntry = {
      id: `rep-phy-${Date.now()}`,
      month: currentMonth,
      date: new Date().toISOString(),
      playerName: booking.patientName,
      playerCode: booking.patientCode || 'PHY-PATIENT',
      amount: finalFee,
      coachId: coachId,
      coachName: coachName,
      sessionCategory: booking.serviceType === 'massage' ? 'massage' : 'physio',
      sessionTitle: `جلسة ${serviceLabel} (${booking.roomName})`,
      paymentMethod: billingData.paymentMethod === 'coach_debt' ? 'coach_collected' : billingData.paymentMethod,
      paymentStatus: billingData.paymentMethod === 'coach_debt' ? 'pending_on_coach' : 'paid',
      notes: billingData.notes || `حساب: ${billingData.billedTo === 'patient' ? 'اللاعب' : 'الكوتش'}`,
      sourceType: 'physio',
    };
    setMasterReportEntries((prev) => [newEntry, ...prev]);

    if (isSupabaseConfigured) {
      supabaseService.upsertMasterReportEntry(newEntry).catch(() => {});
    }
  };

  const assignArrivedMember = (
    checkInLogId: string,
    category: SessionCategory,
    coachId: string,
    sessionId?: string,
    notes?: string,
    paymentDetails?: {
      paymentMode?: 'coach_charge' | 'cash_drawer' | 'instapay';
      amount?: number;
      roomName?: string;
      seatingPathway?: 'coach_debt' | 'gym_with_coach_share' | 'gym_direct_no_coach';
      coachShareType?: 'fixed' | 'percentage';
      coachShareValue?: number;
      coachShareAmount?: number;
      gymShareAmount?: number;
    }
  ) => {
    const pathway = paymentDetails?.seatingPathway || (category === 'gym' ? 'gym_direct_no_coach' : 'coach_debt');
    const coach = coaches.find((c) => c.id === coachId);
    const coachName = coach ? coach.name : (pathway === 'gym_direct_no_coach' ? 'بدون مدرب' : 'الكابتن');
    const log = checkInLogs.find((l) => l.id === checkInLogId);
    const member = members.find((m) => m.id === log?.memberId);
    const matchingSession = sessionId
      ? sessions.find((s) => s.id === sessionId)
      : undefined;

    let feeAmount = paymentDetails?.amount ?? 0;
    const coachShareAmount = paymentDetails?.coachShareAmount ?? 0;
    const gymShareAmount = paymentDetails?.gymShareAmount ?? Math.max(0, feeAmount - coachShareAmount);

    const activityTitle =
      pathway === 'gym_direct_no_coach'
        ? 'تمرين حر بالجيم (اشتراك عام / بدون مدرب)'
        : matchingSession?.title || 'حصة تدريبية مع الكابتن';

    const effectivePaymentMode =
      pathway === 'coach_debt'
        ? 'coach_charge'
        : paymentDetails?.paymentMode || 'cash_drawer';

    const sessionStartedAt = pathway !== 'gym_direct_no_coach' ? new Date().toISOString() : undefined;
    const checkOutStatus = pathway !== 'gym_direct_no_coach' ? ('active' as const) : undefined;

    // 1. Update CheckIn Log with seating details & payment status
    setCheckInLogs((prev) =>
      prev.map((l) => {
        if (l.id === checkInLogId) {
          const updatedLog: CheckInLog = {
            ...l,
            seatingStatus: 'assigned',
            assignedCategory: category,
            assignedCoachId: pathway === 'gym_direct_no_coach' ? undefined : coachId,
            assignedCoachName: coachName,
            assignedSessionId: pathway === 'gym_direct_no_coach' ? undefined : (sessionId || matchingSession?.id),
            assignedSessionTitle: activityTitle,
            paymentMode: effectivePaymentMode,
            seatingPathway: pathway,
            coachShareType: paymentDetails?.coachShareType,
            coachShareValue: paymentDetails?.coachShareValue,
            coachShareAmount: coachShareAmount,
            gymShareAmount: gymShareAmount,
            chargedAmount: feeAmount,
            sessionStartedAt: l.sessionStartedAt || sessionStartedAt,
            checkOutStatus: checkOutStatus,
          };
          if (isSupabaseConfigured) {
            supabaseService.insertCheckInLog(updatedLog).catch(() => {});
          }
          return updatedLog;
        }
        return l;
      })
    );

    if (!member) return;

    const effectivePaymentMethod: 'cash' | 'instapay' =
      paymentDetails?.paymentMode === 'instapay' ? 'instapay' : 'cash';

    // 2. FINANCIAL FLOW: Cash to Drawer / InstaPay / Coach Dues
    if (pathway === 'coach_debt') {
      // المسار 1: الحساب على الكابتن
      // لا يتم خصم أو إضافة شيء بالدرج الآن. التحميل الفعلي يتم تلقائياً فقط عند بدء وإنهاء الحصة (endSession)
    } else if (pathway === 'gym_with_coach_share') {
      // المسار 2: اللاعب دفع للجيم بالاستقبال مع نسبة أو قيمة ثابتة للكابتن (الكابتن ليه فلوس)
      if (feeAmount > 0) {
        // أ. توريد المبلغ للدرج / حساب إنستاباي
        const cashInflowItem: CashInflowItem = {
          id: `inf-seat-${Date.now()}`,
          type: 'subscription',
          title: `${effectivePaymentMethod === 'instapay' ? 'تحصيل إنستاباي' : 'تحصيل كاش بالاستقبال'} (حصة: ${activityTitle}) - متدرب: ${member.name} مع كابتن ${coachName}`,
          amount: feeAmount,
          date: new Date().toISOString(),
          memberName: member.name,
          paymentMethod: effectivePaymentMethod,
          recordedBy: 'الاستقبال',
        };
        setCashInflows((prev) => [cashInflowItem, ...prev]);

        // ب. تسجيل استحقاق الكابتن كمعاملة دائنة (الكابتن ليه فلوس)
        if (coach && coachShareAmount > 0) {
          const coachEarningsTrx: TrainerTransaction = {
            transaction_id: `TRX-EARN-${Date.now()}-${coach.id}`,
            coach_id: coach.id,
            coach_name: coach.name,
            amount: feeAmount,
            collected_by: 'gym',
            payer_type: `حصة ${activityTitle}`,
            payer_name: member.name,
            gym_share: gymShareAmount,
            coach_share: coachShareAmount,
            status: 'pending',
            created_at: new Date().toISOString(),
            month: currentMonth,
            type: 'session_charge',
            payment_method: effectivePaymentMethod,
            notes: `مستحقات كابتن ${coach.name} عن تسكين متدرب (${member.name}) بالاستقبال (${effectivePaymentMethod === 'instapay' ? 'إنستاباي' : 'كاش'} - نصيب الكابتن: ${coachShareAmount} ج.م)`,
          };
          setTrainerTransactions((prev) => [coachEarningsTrx, ...prev]);

          // زيادة رصيد الكابتن (له فلوس في حسابه)
          setCoaches((prev) =>
            prev.map((c) =>
              c.id === coach.id
                ? { ...c, currentBalance: c.currentBalance + coachShareAmount }
                : c
            )
          );

          if (isSupabaseConfigured) {
            supabaseService.upsertTrainerTransaction(coachEarningsTrx).catch(() => {});
          }
        }

        // ج. إدراج قيد بالتقرير الشامل
        const repEntry: MasterReportEntry = {
          id: `rep-seat-${Date.now()}`,
          month: currentMonth,
          date: new Date().toISOString(),
          playerName: member.name,
          playerCode: member.code,
          amount: feeAmount,
          coachId: coach?.id,
          coachName: coachName,
          sessionCategory: category,
          sessionTitle: `${activityTitle} (تحصيل جيم - مستحق للكابتن: ${coachShareAmount} ج.م)`,
          paymentMethod: effectivePaymentMethod,
          paymentStatus: 'paid',
          notes: `محصل بالاستقبال (${effectivePaymentMethod === 'instapay' ? 'إنستاباي' : 'كاش'}): ${feeAmount} ج.م | نصيب الكابتن: ${coachShareAmount} ج.م | صافي الجيم: ${gymShareAmount} ج.م`,
          sourceType: 'session',
        };
        setMasterReportEntries((prev) => [repEntry, ...prev]);

        if (isSupabaseConfigured) {
          supabaseService.insertCashInflow(cashInflowItem).catch(() => {});
          supabaseService.upsertMasterReportEntry(repEntry).catch(() => {});
        }
      }
    } else if (pathway === 'gym_direct_no_coach') {
      // المسار 3: تمرين حر أو اشتراك عام للجيم فقط بدون مدرب
      if (feeAmount > 0) {
        const cashInflowItem: CashInflowItem = {
          id: `inf-seat-${Date.now()}`,
          type: 'subscription',
          title: `${effectivePaymentMethod === 'instapay' ? 'تحصيل إنستاباي' : 'تحصيل كاش'} تمرين حر / تذكرة مباشرة بالاستقبال - متدرب: ${member.name}`,
          amount: feeAmount,
          date: new Date().toISOString(),
          memberName: member.name,
          paymentMethod: effectivePaymentMethod,
          recordedBy: 'الاستقبال',
        };
        setCashInflows((prev) => [cashInflowItem, ...prev]);

        const repEntry: MasterReportEntry = {
          id: `rep-seat-${Date.now()}`,
          month: currentMonth,
          date: new Date().toISOString(),
          playerName: member.name,
          playerCode: member.code,
          amount: feeAmount,
          coachId: undefined,
          coachName: 'اشتراك مباشر / تمرين حر',
          sessionCategory: 'gym',
          sessionTitle: 'تمرين حر بالصالة العامة (بدون مدرب)',
          paymentMethod: effectivePaymentMethod,
          paymentStatus: 'paid',
          notes: `سداد فوري ${effectivePaymentMethod === 'instapay' ? 'تحويل إنستاباي' : 'كاش بالدرج'} لحساب الجيم مباشرة`,
          sourceType: 'subscription',
        };
        setMasterReportEntries((prev) => [repEntry, ...prev]);

        if (isSupabaseConfigured) {
          supabaseService.insertCashInflow(cashInflowItem).catch(() => {});
          supabaseService.upsertMasterReportEntry(repEntry).catch(() => {});
        }
      }
    }

    // 3. التسكين الفعلي في الحصة المحددة (إذا كان المسار 1 أو 2)
    if (pathway !== 'gym_direct_no_coach') {
      const targetSessId = sessionId || matchingSession?.id;
      if (targetSessId) {
        assignPlayerToSession(targetSessId, member.id, true);
      }
    }

    // 4. إذا كانت الجلسة مساج أو علاج طبيعي، يتم إنشاء جلسة انتظار في قسم التأهيل والمساج تلقائياً
    if (category === 'massage' || category === 'physio') {
      const room = paymentDetails?.roomName || (category === 'massage' ? 'غرفة المساج والاستشفاء 1' : 'عيادة التأهيل الطبي 1');
      startPhysioSession({
        doctorName: coachName,
        doctorCode: coach?.id || 'DOC-01',
        coachId: coach?.id,
        coachName: coachName,
        patientName: member.name,
        patientCode: member.code,
        roomName: room,
        hourlyRate: (feeAmount > 0 ? feeAmount : coach?.ratePerSession) || 180,
        serviceType: category === 'massage' ? 'massage' : 'physio',
        status: 'waiting',
      });
    }
  };

  // POS logic
  const addProduct = (prodData: Omit<POSProduct, 'id'>) => {
    const newProd: POSProduct = {
      ...prodData,
      id: `prod-${Date.now()}`,
    };
    setProducts((prev) => [...prev, newProd]);
    if (isSupabaseConfigured) {
      supabaseService.upsertProduct(newProd).catch(() => {});
    }
  };

  const updateProduct = (id: string, updates: Partial<POSProduct>) => {
    setProducts((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, ...updates } : p));
      const target = updated.find((p) => p.id === id);
      if (target && isSupabaseConfigured) {
        supabaseService.upsertProduct(target).catch(() => {});
      }
      return updated;
    });
  };

  const deleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    if (isSupabaseConfigured) {
      supabaseService.deleteProduct(id).catch(() => {});
    }
  };

  const processSale = async (saleData: Omit<POSTransaction, 'id' | 'timestamp'>): Promise<POSTransaction> => {
    const newTx: POSTransaction = {
      ...saleData,
      id: `tx-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };

    // Pessimistic DB Write: Persist POS transaction to Supabase FIRST
    const txOk = await strictDbWrite(() => supabaseService.insertPOSTransaction(newTx));
    if (!txOk) {
      throw new NetworkDbError(NETWORK_ERROR_MESSAGE);
    }

    // Prepare side-effect records and persist to Supabase BEFORE updating state
    if (saleData.paymentMethod === 'cash' || saleData.paymentMethod === 'instapay') {
      const inflow: CashInflowItem = {
        id: `inf-pos-${Date.now()}`,
        type: 'pos',
        title: `مبيعات ${saleData.paymentMethod === 'instapay' ? 'إنستاباي' : 'كاش'} بالمتجر - فاتورة #${newTx.id.slice(-4)}`,
        amount: newTx.totalAmount,
        date: new Date().toISOString(),
        paymentMethod: saleData.paymentMethod,
        recordedBy: saleData.cashierName,
      };
      const inflowOk = await strictDbWrite(() => supabaseService.insertCashInflow(inflow));
      if (!inflowOk) throw new NetworkDbError(NETWORK_ERROR_MESSAGE);
      setCashInflows((prev) => [inflow, ...prev]);
    } else if (saleData.paymentMethod === 'coach_debt' && saleData.coachId) {
      const targetCoach = coaches.find((c) => c.id === saleData.coachId);
      const coachName = targetCoach?.name || saleData.coachName || 'الكابتن';
      const itemsSummary = saleData.items
        .map((i) => `${i.quantity}× ${i.productName}`)
        .join('، ');
      const extraNote = saleData.notes?.trim() ? ` (${saleData.notes.trim()})` : '';

      const posDebtTrx: TrainerTransaction = {
        transaction_id: `TRX-POS-${Date.now()}-${saleData.coachId}`,
        coach_id: saleData.coachId,
        coach_name: coachName,
        amount: newTx.totalAmount,
        collected_by: 'coach',
        payer_type: 'مشتريات بار / بوفيه (POS)',
        payer_name: itemsSummary,
        gym_share: newTx.totalAmount,
        coach_share: 0,
        status: 'pending',
        created_at: newTx.timestamp,
        month: currentMonth,
        type: 'pos_charge',
        payment_method: 'coach_collected',
        notes: `تحميل بار (#${newTx.id.slice(-4)}): ${itemsSummary}${extraNote} - بواسطة: ${saleData.cashierName}`,
      };

      const repEntry: MasterReportEntry = {
        id: `rep-pos-${Date.now()}`,
        month: currentMonth,
        date: newTx.timestamp,
        playerName: saleData.notes?.trim() ? `بار (${saleData.notes.trim()})` : 'مبيعات البار (POS)',
        playerCode: targetCoach?.code || saleData.coachId,
        amount: newTx.totalAmount,
        coachId: saleData.coachId,
        coachName,
        sessionCategory: 'gym',
        sessionTitle: `تحميل بار POS: ${itemsSummary}`,
        paymentMethod: 'coach_debt',
        paymentStatus: 'pending_on_coach',
        notes: `تحميل مشتريات بار على كابتن ${coachName} | ${itemsSummary}${extraNote}`,
        sourceType: 'pos',
      };

      const debtOk = await strictDbWrite(async () => {
        const [a, b] = await Promise.all([
          supabaseService.upsertTrainerTransaction(posDebtTrx),
          supabaseService.upsertMasterReportEntry(repEntry),
        ]);
        return a && b;
      });
      if (!debtOk) throw new NetworkDbError(NETWORK_ERROR_MESSAGE);

      setTrainerTransactions((prev) => [posDebtTrx, ...prev]);
      setMasterReportEntries((prev) => [repEntry, ...prev]);
    }

    // Update stock & POS transaction state after DB confirmation
    setProducts((prev) => {
      const updated = prev.map((p) => {
        const bought = saleData.items.find((item) => item.productId === p.id);
        if (bought) {
          const newP = {
            ...p,
            stock: Math.max(0, p.stock - bought.quantity),
          };
          if (isSupabaseConfigured) {
            supabaseService.upsertProduct(newP).catch(() => {});
          }
          return newP;
        }
        return p;
      });
      return updated;
    });

    setTransactions((prev) => [newTx, ...prev]);
    return newTx;
  };

  // Expenses & Drawer Methods (Accounting for literally every single pound!)
  const addExpense = async (expData: Omit<ExpenseItem, 'id' | 'date'>): Promise<ExpenseItem> => {
    const newExp: ExpenseItem = {
      ...expData,
      id: `exp-${Date.now()}`,
      date: new Date().toISOString(),
    };
    const ok = await strictDbWrite(() => supabaseService.insertExpense(newExp));
    if (!ok) {
      throw new NetworkDbError(NETWORK_ERROR_MESSAGE);
    }
    setExpenses((prev) => [newExp, ...prev]);
    return newExp;
  };

  const deleteExpense = (id: string) => {
    const target = expenses.find((e) => e.id === id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    if (isSupabaseConfigured) {
      supabaseService.deleteExpense(id).catch(() => {});
    }

    // تراجع نظيف عن رصيد الكابتن إذا كان المصروف سلفة أو دفعة نقدية مسجلة له
    if (target && (target.category === 'trainer_payout' || (target.title && target.title.includes('كابتن')))) {
      const matchedCoach = coaches.find(
        (c) =>
          target.title.includes(c.name) ||
          (target.notes && target.notes.includes(c.name)) ||
          target.relatedEntityId === c.id
      );
      if (matchedCoach) {
        setCoaches((prev) =>
          prev.map((c) => {
            if (c.id === matchedCoach.id) {
              const updated = {
                ...c,
                currentBalance: (c.currentBalance || 0) + target.amount,
                totalPaidToday: Math.max(0, (c.totalPaidToday || 0) - target.amount),
              };
              if (isSupabaseConfigured) {
                supabaseService.upsertCoach(updated).catch(() => {});
              }
              return updated;
            }
            return c;
          })
        );
      }
    }
  };

  const deleteCashInflow = (id: string) => {
    setCashInflows((prev) => prev.filter((inf) => inf.id !== id));
    if (isSupabaseConfigured) {
      supabaseService.deleteCashInflow(id).catch(() => {});
    }
  };

  const addCashInflow = async (infData: Omit<CashInflowItem, 'id' | 'date'>): Promise<CashInflowItem> => {
    const newInf: CashInflowItem = {
      ...infData,
      id: `inf-${Date.now()}`,
      date: new Date().toISOString(),
    };
    const ok = await strictDbWrite(() => supabaseService.insertCashInflow(newInf));
    if (!ok) {
      throw new NetworkDbError(NETWORK_ERROR_MESSAGE);
    }
    setCashInflows((prev) => [newInf, ...prev]);
    return newInf;
  };

  // Manual cash movement (تسوية عهدة: إيداع نقدي أو سحب شخصي من الدرج)
  const addManualCashMovement = async (
    type: 'deposit' | 'withdrawal',
    amount: number,
    title: string,
    notes?: string
  ): Promise<void> => {
    const reasonText = (title || '').trim();
    if (type === 'deposit') {
      const inflow: CashInflowItem = {
        id: `inf-manual-${Date.now()}`,
        type: 'manual_deposit',
        title: `[تسوية عهدة - إيداع بالدرج]: ${reasonText || 'إيداع نقدي بالخزينة'}`,
        amount,
        date: new Date().toISOString(),
        paymentMethod: 'cash',
        recordedBy: 'الاستقبال',
      };
      const ok = await strictDbWrite(() => supabaseService.insertCashInflow(inflow));
      if (!ok) throw new NetworkDbError(NETWORK_ERROR_MESSAGE);
      setCashInflows((prev) => [inflow, ...prev]);
    } else {
      const expense: ExpenseItem = {
        id: `exp-manual-${Date.now()}`,
        title: `[تسوية عهدة - سحب من الدرج]: ${reasonText || 'سحب نقدي من الدرج'}`,
        category: 'other',
        amount,
        date: new Date().toISOString(),
        notes: notes || reasonText,
        paymentMethod: 'cash',
        recordedBy: 'الاستقبال',
      };
      const ok = await strictDbWrite(() => supabaseService.insertExpense(expense));
      if (!ok) throw new NetworkDbError(NETWORK_ERROR_MESSAGE);
      setExpenses((prev) => [expense, ...prev]);
    }
  };

  const lastClosing = dailyShiftClosings.length > 0 ? dailyShiftClosings[0] : null;
  const lastClosingTime = lastClosing ? lastClosing.closedAt : null;

  const isAfterLastClosing = (dateStr?: string) => {
    if (!dateStr) return false;
    if (!lastClosingTime) return true;
    return new Date(dateStr).getTime() > new Date(lastClosingTime).getTime();
  };

  // Calculate Net Cash Drawer ("صافي النقدية في الدرج بالجنيه - كل جنيه محسوب")
  const getDrawerStats = () => {
    // Only Cash items affect the physical cash drawer
    const totalCashIn = cashInflows
      .filter((inf) => inf.paymentMethod === 'cash')
      .reduce((acc, inf) => acc + inf.amount, 0);

    const totalCashOut = expenses
      .filter((exp) => exp.paymentMethod === 'cash')
      .reduce((acc, exp) => acc + exp.amount, 0);

    const netCashInDrawer = totalCashIn - totalCashOut;

    // Active shift movements (resets immediately after daily shift closing)
    const todayCashIn = cashInflows
      .filter((inf) => inf.paymentMethod === 'cash' && isAfterLastClosing(inf.date))
      .reduce((acc, inf) => acc + inf.amount, 0);

    const todayCashOut = expenses
      .filter((exp) => exp.paymentMethod === 'cash' && isAfterLastClosing(exp.date))
      .reduce((acc, exp) => acc + exp.amount, 0);

    const todayNetInDrawer = todayCashIn - todayCashOut;

    // Physical Drawer Balance: resets immediately to 0.00 after daily shift closing is audited
    const activeDrawerCash = todayNetInDrawer;

    // InstaPay Ledger Total
    const totalInstapayIn = cashInflows
      .filter((inf) => inf.paymentMethod === 'instapay')
      .reduce((acc, inf) => acc + inf.amount, 0);

    // Total Pending Receivables on Coaches (فلوس عند الكباتن مستحقة للجيم - تحصيل يدوي خارجي)
    const pendingTrx = trainerTransactions.filter((t) => t.status === 'pending');
    const totalPendingOnCoaches = pendingTrx
      .filter((t) => t.collected_by === 'coach')
      .reduce((acc, t) => acc + t.gym_share, 0);

    // Total Coach Dues on Gym (مستحقات وأرباح الكباتن التزام على الجيم - تحصيل استقبل الجيم)
    const totalCoachDues = pendingTrx
      .filter((t) => t.collected_by === 'gym' && t.coach_share > 0)
      .reduce((acc, t) => acc + t.coach_share, 0);

    return {
      totalCashIn,
      totalCashOut,
      netCashInDrawer: activeDrawerCash, // متصفر تلقائياً بعد كل تقفيل يومية
      todayCashIn,
      todayCashOut,
      todayNetInDrawer,
      totalInstapayIn,
      totalPendingOnCoaches,
      totalCoachDues,
    };
  };

  // Overall Stats
  const getTodayStats = () => {
    const todayStr = new Date().toISOString().slice(0, 10);

    const checkInsToday = checkInLogs.filter(
      (c) => c.timestamp.startsWith(todayStr) && isAfterLastClosing(c.timestamp)
    ).length;

    const todayTxs = transactions.filter((t) =>
      t.timestamp.startsWith(todayStr)
    );

    const posSalesToday = todayTxs.reduce((acc, t) => acc + t.totalAmount, 0);
    const posProfitToday = todayTxs.reduce((acc, t) => acc + t.profit, 0);

    const coachesPaidToday = coaches.reduce((acc, c) => acc + c.totalPaidToday, 0);

    const perSessionCoachesOwed = coaches
      .filter((c) => c.paymentType === 'per_session')
      .reduce((acc, c) => acc + c.currentBalance, 0);

    const totalExpensesToday = expenses
      .filter((e) => e.date.startsWith(todayStr))
      .reduce((acc, e) => acc + e.amount, 0);

    const { todayNetInDrawer } = getDrawerStats();

    return {
      checkInsCount: checkInsToday,
      posSalesToday,
      posProfitToday,
      coachesPaidToday,
      perSessionCoachesOwed,
      totalExpensesToday,
      netDrawerToday: todayNetInDrawer,
    };
  };

  // DUAL FINANCIAL FLOWS IMPLEMENTATION
  const addTrainerTransaction = (data: {
    coach_id: string;
    amount: number;
    collected_by: CollectedBy;
    payer_type: string;
    payer_name?: string;
    gym_share?: number;
    coach_share?: number;
    gym_percentage?: number;
    payment_method?: 'cash' | 'card' | 'instapay' | 'coach_collected';
    notes?: string;
  }) => {
    const coach = coaches.find((c) => c.id === data.coach_id);
    const coachName = coach ? coach.name : 'مدرب';

    let gym_share = data.gym_share;
    let coach_share = data.coach_share;

    if (gym_share === undefined || coach_share === undefined) {
      const gymPct =
        data.gym_percentage !== undefined
          ? data.gym_percentage
          : coach?.paymentType === 'percentage'
          ? (100 - (coach.commissionRate || 35))
          : 50;
      gym_share = Math.round((data.amount * gymPct) / 100);
      coach_share = data.amount - gym_share;
    }

    const newTrx: TrainerTransaction = {
      transaction_id: `TRX-${Math.floor(1000 + Math.random() * 9000)}`,
      coach_id: data.coach_id,
      coach_name: coachName,
      amount: data.amount,
      collected_by: data.collected_by,
      payer_type: data.payer_type,
      payer_name: data.payer_name,
      gym_share,
      coach_share,
      status: 'pending',
      created_at: new Date().toISOString(),
      payment_method: data.payment_method || 'cash',
      notes: data.notes,
    };

    setTrainerTransactions((prev) => [newTrx, ...prev]);

    if (data.collected_by === 'gym' && (data.payment_method === 'cash' || !data.payment_method)) {
      const inflow: CashInflowItem = {
        id: `inf-trx-${Date.now()}`,
        type: 'subscription',
        title: `تحصيل تدريب خاص بالجيم (${data.payer_type}) - ${coachName}`,
        amount: data.amount,
        date: new Date().toISOString(),
        memberName: data.payer_name,
        paymentMethod: 'cash',
        recordedBy: 'الاستقبال',
      };
      setCashInflows((prev) => [inflow, ...prev]);
    }

    return newTrx;
  };

  const settleCoachPayable = (coachId: string, adminUsername: string, transactionIds?: string[]) => {
    const coach = coaches.find((c) => c.id === coachId);
    if (!coach) return { success: false, settledAmount: 0 };

    const targetTrx = trainerTransactions.filter((t) => {
      if (t.coach_id !== coachId || t.status !== 'pending' || t.collected_by !== 'gym') return false;
      if (transactionIds && transactionIds.length > 0) return transactionIds.includes(t.transaction_id);
      return true;
    });

    if (targetTrx.length === 0) return { success: false, settledAmount: 0 };

    const totalToPay = targetTrx.reduce((acc, t) => acc + t.coach_share, 0);

    setTrainerTransactions((prev) =>
      prev.map((t) =>
        targetTrx.some((target) => target.transaction_id === t.transaction_id)
          ? {
              ...t,
              status: 'settled',
              settled_at: new Date().toISOString(),
              settled_by: adminUsername,
            }
          : t
      )
    );

    const autoExpense: ExpenseItem = {
      id: `exp-payable-${Date.now()}`,
      title: `صرف مستحقات تدريب (Flow 1) للمدرب: ${coach.name}`,
      category: 'trainer_payout',
      amount: totalToPay,
      date: new Date().toISOString(),
      recordedBy: adminUsername,
      notes: `تسوية ${targetTrx.length} معاملة مسددة بالاستقبال لصالح المدرب ${coach.name}`,
      paymentMethod: 'cash',
      autoGenerated: true,
      relatedEntityId: coach.id,
    };
    setExpenses((prev) => [autoExpense, ...prev]);

    setCoaches((prev) =>
      prev.map((c) => (c.id === coachId ? { ...c, totalPaidToday: c.totalPaidToday + totalToPay } : c))
    );

    return { success: true, settledAmount: totalToPay };
  };

  const collectGymReceivable = (coachId: string, adminUsername: string, transactionIds?: string[]) => {
    const coach = coaches.find((c) => c.id === coachId);
    if (!coach) return { success: false, collectedAmount: 0 };

    const targetTrx = trainerTransactions.filter((t) => {
      if (t.coach_id !== coachId || t.status !== 'pending' || t.collected_by !== 'coach') return false;
      if (transactionIds && transactionIds.length > 0) return transactionIds.includes(t.transaction_id);
      return true;
    });

    if (targetTrx.length === 0) return { success: false, collectedAmount: 0 };

    const totalToCollect = targetTrx.reduce((acc, t) => acc + t.gym_share, 0);

    setTrainerTransactions((prev) =>
      prev.map((t) =>
        targetTrx.some((target) => target.transaction_id === t.transaction_id)
          ? {
              ...t,
              status: 'settled',
              settled_at: new Date().toISOString(),
              settled_by: adminUsername,
            }
          : t
      )
    );

    const inflow: CashInflowItem = {
      id: `inf-receivable-${Date.now()}`,
      type: 'manual_deposit',
      title: `توريد مستحقات الجيم (Flow 2) من المدرب: ${coach.name}`,
      amount: totalToCollect,
      date: new Date().toISOString(),
      memberName: `كابتن / ${coach.name}`,
      paymentMethod: 'cash',
      recordedBy: adminUsername,
    };
    setCashInflows((prev) => [inflow, ...prev]);

    return { success: true, collectedAmount: totalToCollect };
  };

  const netSettleTrainer = (coachId: string, adminUsername: string) => {
    const coach = coaches.find((c) => c.id === coachId);
    if (!coach) return { success: false, netAmount: 0, type: 'balanced' as const };

    const summary = getCoachFinancialSummary(coachId);
    const net = summary.netBalance;

    setTrainerTransactions((prev) =>
      prev.map((t) =>
        t.coach_id === coachId && t.status === 'pending'
          ? {
              ...t,
              status: 'settled',
              settled_at: new Date().toISOString(),
              settled_by: adminUsername,
            }
          : t
      )
    );

    if (net > 0) {
      const autoExpense: ExpenseItem = {
        id: `exp-net-${Date.now()}`,
        title: `تصفية صافي مستحقات المدرب: ${coach.name}`,
        category: 'trainer_payout',
        amount: net,
        date: new Date().toISOString(),
        recordedBy: adminUsername,
        notes: `صافي بعد مقاصة ما للجيم وما للمدرب`,
        paymentMethod: 'cash',
        autoGenerated: true,
        relatedEntityId: coach.id,
      };
      setExpenses((prev) => [autoExpense, ...prev]);
      setCoaches((prev) =>
        prev.map((c) => (c.id === coachId ? { ...c, totalPaidToday: c.totalPaidToday + net } : c))
      );
      return { success: true, netAmount: net, type: 'paid_to_coach' as const };
    } else if (net < 0) {
      const absNet = Math.abs(net);
      const inflow: CashInflowItem = {
        id: `inf-net-${Date.now()}`,
        type: 'manual_deposit',
        title: `تحصيل صافي مديونية من المدرب: ${coach.name}`,
        amount: absNet,
        date: new Date().toISOString(),
        memberName: `كابتن / ${coach.name}`,
        paymentMethod: 'cash',
        recordedBy: adminUsername,
      };
      setCashInflows((prev) => [inflow, ...prev]);
      return { success: true, netAmount: absNet, type: 'collected_from_coach' as const };
    }

    return { success: true, netAmount: 0, type: 'balanced' as const };
  };

  const getCoachFinancialSummary = (coachId: string) => {
    const coachTrx = trainerTransactions.filter((t) => t.coach_id === coachId);
    const pending = coachTrx.filter((t) => t.status === 'pending');
    const settled = coachTrx.filter((t) => t.status === 'settled');

    const payableToCoach = pending
      .filter((t) => t.collected_by === 'gym')
      .reduce((acc, t) => acc + t.coach_share, 0);

    const receivableFromCoach = pending
      .filter((t) => t.collected_by === 'coach')
      .reduce((acc, t) => acc + t.gym_share, 0);

    const netBalance = payableToCoach - receivableFromCoach;

    return {
      payableToCoach,
      receivableFromCoach,
      netBalance,
      pendingTransactions: pending,
      settledTransactions: settled,
    };
  };

  const getAllTrainersFinancialSummary = () => {
    const pending = trainerTransactions.filter((t) => t.status === 'pending');

    const totalPayableAllCoaches = pending
      .filter((t) => t.collected_by === 'gym')
      .reduce((acc, t) => acc + t.coach_share, 0);

    const totalReceivableAllCoaches = pending
      .filter((t) => t.collected_by === 'coach')
      .reduce((acc, t) => acc + t.gym_share, 0);

    const totalNetBalance = totalPayableAllCoaches - totalReceivableAllCoaches;

    return {
      totalPayableAllCoaches,
      totalReceivableAllCoaches,
      totalNetBalance,
    };
  };

  const repayCoachDebt = async (
    coachId: string,
    amount: number,
    paymentMethod: 'cash' | 'instapay' = 'cash',
    notes?: string,
    authorizedBy = 'الاستقبال'
  ): Promise<{ success: boolean; repaidAmount: number }> => {
    const coach = coaches.find((c) => c.id === coachId);
    if (!coach || amount <= 0) return { success: false, repaidAmount: 0 };

    const nowIso = new Date().toISOString();
    const repaymentTrx: TrainerTransaction = {
      transaction_id: `REP-${Date.now()}`,
      coach_id: coachId,
      coach_name: coach.name,
      amount: amount,
      collected_by: 'gym',
      payer_type: 'إيداع سداد تحميل',
      payer_name: `كابتن ${coach.name}`,
      gym_share: amount,
      coach_share: 0,
      status: 'settled',
      created_at: nowIso,
      settled_at: nowIso,
      settled_by: authorizedBy,
      month: currentMonth,
      type: 'coach_repayment',
      payment_method: paymentMethod,
      notes: notes || `سداد ${amount} ج.م من المديونية المستحقة على كابتن ${coach.name}`,
    };

    const inflowItem: CashInflowItem = {
      id: `inf-cch-rep-${Date.now()}`,
      type: 'coach_settlement',
      title: `إيداع سداد تحميل - كابتن ${coach.name}`,
      amount: amount,
      date: nowIso,
      memberName: coach.name,
      paymentMethod: paymentMethod,
      recordedBy: authorizedBy,
    };

    // Compute updated trainer transactions & master report entries to persist
    let remaining = amount;
    const modifiedTrainerTrx: TrainerTransaction[] = [];
    const nextTrainerTrx = trainerTransactions.map((t) => {
      if (t.coach_id === coachId && t.status === 'pending' && remaining > 0) {
        const share = t.gym_share !== undefined && t.gym_share > 0 ? t.gym_share : t.amount;
        if (remaining >= share) {
          remaining -= share;
          const upd: TrainerTransaction = {
            ...t,
            status: 'settled',
            settled_at: nowIso,
            settled_by: authorizedBy,
          };
          modifiedTrainerTrx.push(upd);
          return upd;
        } else {
          const left = share - remaining;
          remaining = 0;
          const upd: TrainerTransaction = {
            ...t,
            gym_share: left,
          };
          modifiedTrainerTrx.push(upd);
          return upd;
        }
      }
      return t;
    });

    let repRemaining = amount;
    const modifiedMasterEntries: MasterReportEntry[] = [];
    const nextMasterEntries = masterReportEntries.map((entry) => {
      if (entry.coachId === coachId && entry.paymentStatus === 'pending_on_coach' && repRemaining > 0) {
        if (repRemaining >= entry.amount) {
          repRemaining -= entry.amount;
          const upd: MasterReportEntry = {
            ...entry,
            paymentStatus: 'paid',
            notes: entry.notes ? `${entry.notes} (تم السداد)` : 'تم السداد',
          };
          modifiedMasterEntries.push(upd);
          return upd;
        }
      }
      return entry;
    });

    // Pessimistic DB Write FIRST (Batched to avoid N+1 requests)
    const ok = await strictDbWrite(async () => {
      const results = await Promise.all([
        supabaseService.upsertTrainerTransactionsBatch([repaymentTrx, ...modifiedTrainerTrx]),
        supabaseService.insertCashInflow(inflowItem),
        ...(modifiedMasterEntries.length > 0
          ? [supabaseService.upsertMasterReportEntriesBatch(modifiedMasterEntries)]
          : []),
      ]);
      return results.every(Boolean);
    });
    if (!ok) {
      throw new NetworkDbError(NETWORK_ERROR_MESSAGE);
    }

    setTrainerTransactions([repaymentTrx, ...nextTrainerTrx]);
    setMasterReportEntries(nextMasterEntries);
    setCoaches((prev) =>
      prev.map((c) =>
        c.id === coachId
          ? { ...c, currentBalance: (c.currentBalance || 0) + amount }
          : c
      )
    );
    setCashInflows((prev) => [inflowItem, ...prev]);

    return { success: true, repaidAmount: amount };
  };

  // MANUAL COACH MOVEMENT (تسجيل حركة يدوية لحساب الكابتن مع ربط الدرج والمصاريف)
  const addCoachManualMovement = async (data: {
    coach_id: string;
    movement_type: 'payout' | 'deposit' | 'charge';
    amount: number;
    reason: string;
    payment_method?: 'cash' | 'instapay';
    authorized_by?: string;
  }): Promise<{ success: boolean; type: 'payout' | 'deposit' | 'charge' }> => {
    const coach = coaches.find((c) => c.id === data.coach_id);
    const coachName = coach ? coach.name : 'مدرب';
    const authUser = data.authorized_by || 'الاستقبال';
    const method = data.payment_method || 'cash';
    const nowIso = new Date().toISOString();

    if (data.movement_type === 'payout') {
      const newExp: ExpenseItem = {
        id: `exp-coach-${Date.now()}`,
        title: `صرف مستحقات/سلفة كابتن ${coachName}: ${data.reason}`,
        category: 'trainer_payout',
        amount: data.amount,
        date: nowIso,
        recordedBy: authUser,
        notes: `حركة يدوية بحساب الكابتن - السبب: ${data.reason}`,
        paymentMethod: method,
        autoGenerated: false,
        relatedEntityId: data.coach_id,
      };
      const newTrx: TrainerTransaction = {
        transaction_id: `TRX-PAY-${Date.now()}`,
        coach_id: data.coach_id,
        coach_name: coachName,
        amount: data.amount,
        collected_by: 'gym',
        payer_type: `صرف يدوي (${data.reason})`,
        payer_name: coachName,
        gym_share: 0,
        coach_share: data.amount,
        status: 'settled',
        created_at: nowIso,
        settled_at: nowIso,
        settled_by: authUser,
        payment_method: method,
        month: currentMonth,
        notes: data.reason,
      };

      const ok = await strictDbWrite(async () => {
        const calls: Promise<boolean>[] = [
          supabaseService.insertExpense(newExp),
          supabaseService.upsertTrainerTransaction(newTrx),
        ];
        if (coach) {
          calls.push(supabaseService.upsertCoach({ ...coach, totalPaidToday: coach.totalPaidToday + data.amount }));
        }
        const results = await Promise.all(calls);
        return results.every(Boolean);
      });
      if (!ok) throw new NetworkDbError(NETWORK_ERROR_MESSAGE);

      setExpenses((prev) => [newExp, ...prev]);
      setCoaches((prev) =>
        prev.map((c) => (c.id === data.coach_id ? { ...c, totalPaidToday: c.totalPaidToday + data.amount } : c))
      );
      setTrainerTransactions((prev) => [newTrx, ...prev]);

      return { success: true, type: 'payout' as const };
    } else if (data.movement_type === 'deposit') {
      const inflow: CashInflowItem = {
        id: `inf-coach-${Date.now()}`,
        type: 'coach_settlement',
        title: `توريد وسداد من كابتن ${coachName}: ${data.reason}`,
        amount: data.amount,
        date: nowIso,
        memberName: coachName,
        paymentMethod: method,
        recordedBy: authUser,
      };
      const newTrx: TrainerTransaction = {
        transaction_id: `TRX-DEP-${Date.now()}`,
        coach_id: data.coach_id,
        coach_name: coachName,
        amount: data.amount,
        collected_by: 'gym',
        payer_type: `توريد وسداد يدوي (${data.reason})`,
        payer_name: `كابتن ${coachName}`,
        gym_share: data.amount,
        coach_share: 0,
        status: 'settled',
        created_at: nowIso,
        settled_at: nowIso,
        settled_by: authUser,
        payment_method: method,
        month: currentMonth,
        type: 'coach_repayment',
        notes: data.reason,
      };

      const ok = await strictDbWrite(async () => {
        const [a, b] = await Promise.all([
          supabaseService.insertCashInflow(inflow),
          supabaseService.upsertTrainerTransaction(newTrx),
        ]);
        return a && b;
      });
      if (!ok) throw new NetworkDbError(NETWORK_ERROR_MESSAGE);

      setCashInflows((prev) => [inflow, ...prev]);

      let remaining = data.amount;
      setTrainerTransactions((prev) => {
        const updated = prev.map((t) => {
          if (
            t.coach_id === data.coach_id &&
            t.collected_by === 'coach' &&
            t.status === 'pending' &&
            remaining > 0
          ) {
            if (remaining >= t.gym_share) {
              remaining -= t.gym_share;
              return {
                ...t,
                status: 'settled' as const,
                settled_at: nowIso,
                settled_by: authUser,
              };
            } else {
              const left = t.gym_share - remaining;
              remaining = 0;
              return {
                ...t,
                gym_share: left,
              };
            }
          }
          return t;
        });
        return [newTrx, ...updated];
      });

      return { success: true, type: 'deposit' as const };
    } else {
      const newTrx: TrainerTransaction = {
        transaction_id: `TRX-CHG-${Date.now()}`,
        coach_id: data.coach_id,
        coach_name: coachName,
        amount: data.amount,
        collected_by: 'coach',
        payer_type: `تحميل يدوي: ${data.reason}`,
        payer_name: coachName,
        gym_share: data.amount,
        coach_share: 0,
        status: 'pending',
        created_at: nowIso,
        payment_method: 'coach_collected',
        month: currentMonth,
        notes: data.reason,
      };
      const repEntry: MasterReportEntry = {
        id: `rep-coach-chg-${Date.now()}`,
        month: currentMonth,
        date: nowIso,
        playerName: `تسوية كابتن ${coachName}`,
        playerCode: coach?.id || 'COACH',
        amount: data.amount,
        coachId: data.coach_id,
        coachName: coachName,
        sessionCategory: 'private',
        sessionTitle: `تحميل يدوي (${data.reason})`,
        paymentMethod: 'coach_collected',
        paymentStatus: 'pending_on_coach',
        notes: data.reason,
        sourceType: 'manual',
      };

      const ok = await strictDbWrite(async () => {
        const [a, b] = await Promise.all([
          supabaseService.upsertTrainerTransaction(newTrx),
          supabaseService.upsertMasterReportEntry(repEntry),
        ]);
        return a && b;
      });
      if (!ok) throw new NetworkDbError(NETWORK_ERROR_MESSAGE);

      setTrainerTransactions((prev) => [newTrx, ...prev]);
      setMasterReportEntries((prev) => [repEntry, ...prev]);

      return { success: true, type: 'charge' as const };
    }
  };

  const getCoachMonthlyBreakdown = (coachId: string, month: string) => {
    const isAll = month === 'all';
    const targetMonth = isAll ? currentMonth : month;

    const allCoachTrx = trainerTransactions.filter((t) => t.coach_id === coachId);

    // 1. Current month charges (Flow 2: collected_by === 'coach')
    const currentMonthCharges = allCoachTrx
      .filter(
        (t) =>
          t.collected_by === 'coach' &&
          t.type !== 'coach_repayment' &&
          (isAll || t.month === targetMonth || (!t.month && targetMonth === currentMonth))
      )
      .reduce((sum, t) => sum + (t.status === 'pending' ? t.gym_share : t.amount), 0);

    // 2. Previous carried-over debt (unsettled pending debt from previous months)
    const previousCarriedDebt = isAll
      ? 0
      : allCoachTrx
          .filter(
            (t) =>
              t.collected_by === 'coach' &&
              t.status === 'pending' &&
              t.month &&
              t.month !== targetMonth
          )
          .reduce((sum, t) => sum + t.gym_share, 0);

    // 3. Current month repayments deposited by coach
    const currentMonthRepaid = allCoachTrx
      .filter(
        (t) =>
          t.type === 'coach_repayment' &&
          (isAll || t.month === targetMonth || (!t.month && targetMonth === currentMonth))
      )
      .reduce((sum, t) => sum + t.amount, 0);

    // 4. Remaining current month pending debt
    const currentMonthPending = Math.max(0, currentMonthCharges - currentMonthRepaid);

    // Total outstanding debt = (previous carried debt + current month charges) - current month repaid
    const remainingTotalDebt = Math.max(0, (previousCarriedDebt + currentMonthCharges) - currentMonthRepaid);

    return {
      currentMonthCharges,
      previousCarriedDebt,
      currentMonthRepaid,
      currentMonthPending,
      remainingTotalDebt,
      transactions: allCoachTrx.filter(
        (t) => isAll || t.month === targetMonth || (!t.month && targetMonth === currentMonth)
      ),
    };
  };

  // Master Report Operations & Month-End Cycle Roll-over
  const addMasterReportEntry = (entry: Omit<MasterReportEntry, 'id'>) => {
    const newEntry: MasterReportEntry = {
      ...entry,
      id: `rep-${Date.now()}`,
    };
    setMasterReportEntries((prev) => [newEntry, ...prev]);
    if (isSupabaseConfigured) {
      supabaseService.upsertMasterReportEntry(newEntry).catch(() => {});
    }
  };

  const updateMasterReportEntry = (id: string, updates: Partial<MasterReportEntry>) => {
    setMasterReportEntries((prev) => {
      const updated = prev.map((e) => (e.id === id ? { ...e, ...updates } : e));
      const target = updated.find((e) => e.id === id);
      if (target && isSupabaseConfigured) {
        supabaseService.upsertMasterReportEntry(target).catch(() => {});
      }
      return updated;
    });
  };

  const deleteMasterReportEntry = (id: string) => {
    setMasterReportEntries((prev) => prev.filter((e) => e.id !== id));
    if (isSupabaseConfigured) {
      supabaseService.deleteMasterReportEntry(id).catch(() => {});
    }
  };

  const startNewMonth = (newMonthName: string, startDate?: string, endDate?: string) => {
    // 1. Close current cycle
    setBillingCycles((prev) =>
      prev.map((c) =>
        c.name === currentMonth
          ? { ...c, isActive: false, closedDate: new Date().toISOString() }
          : c
      )
    );

    // 2. Add new active cycle
    const newCycle: MonthlyBillingCycle = {
      id: `cycle-${Date.now()}`,
      name: newMonthName,
      startDate: startDate || new Date().toISOString().slice(0, 10),
      endDate: endDate || undefined,
      isActive: true,
      totalCollected: 0,
      totalPendingOnCoaches: 0,
    };
    setBillingCycles((prev) => [newCycle, ...prev]);

    // 3. Set current active month
    setCurrentMonth(newMonthName);

    if (isSupabaseConfigured) {
      supabaseService.upsertBillingCycle(newCycle).catch(() => {});
    }
  };

  const getNextMonthName = (current: string): string => {
    const arabicMonths = [
      'يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    const parts = current.trim().split(' ');
    const mName = parts[0];
    let year = parts[1] ? parseInt(parts[1], 10) : new Date().getFullYear();
    const idx = arabicMonths.indexOf(mName);
    if (idx === -1) {
      const nextIdx = (new Date().getMonth() + 1) % 12;
      return `${arabicMonths[nextIdx]} ${year}`;
    }
    const nextIdx = (idx + 1) % 12;
    if (nextIdx === 0) {
      year += 1;
    }
    return `${arabicMonths[nextIdx]} ${year}`;
  };

  // تقفيل الشهر وأرشفة البيانات وترحيل مديونيات الكباتن للشهر الجديد
  const closeMonthlyBillingCycle = (adminUsername: string, nextMonthName?: string) => {
    const targetNextMonth = nextMonthName || getNextMonthName(currentMonth);

    // 1. حساب مديونية كل مدرب متبقية لنهاية الشهر
    const coachDebtCarryOver = coaches.map((coach) => {
      const breakdown = getCoachMonthlyBreakdown(coach.id, currentMonth);
      return {
        coachId: coach.id,
        coachName: coach.name,
        remainingDebt: breakdown.remainingTotalDebt,
      };
    });

    // 2. أخذ لقطة كاملة لبيانات الشهر المؤرشف للحفظ أوفلاين
    const monthEntries = masterReportEntries.filter((e) => !e.month || e.month === currentMonth);
    const monthExpenses = expenses;
    const monthInflows = cashInflows;
    const monthPos = transactions;
    const monthTrainerTrx = trainerTransactions.filter((t) => !t.month || t.month === currentMonth);

    const totalRev = monthEntries.reduce((s, e) => s + e.amount, 0);
    const totalExp = monthExpenses.reduce((s, e) => s + e.amount, 0);

    const archive: MonthlyArchive = {
      id: `month-archive-${Date.now()}`,
      month: currentMonth,
      closedAt: new Date().toISOString(),
      closedBy: adminUsername,
      totalRevenue: totalRev,
      totalExpenses: totalExp,
      netProfit: totalRev - totalExp,
      totalPosCash: monthPos.reduce((s, t) => s + t.totalAmount, 0),
      masterEntriesSnapshot: monthEntries,
      expensesSnapshot: monthExpenses,
      cashInflowsSnapshot: monthInflows,
      trainerTransactionsSnapshot: monthTrainerTrx,
      posTransactionsSnapshot: monthPos,
      coachDebtCarryOver,
    };

    setMonthlyArchives((prev) => [archive, ...prev.filter((a) => a.month !== currentMonth)]);

    // 3. ترحيل أي مديونية متبقية على المدربين إلى الشهر الجديد كرصيد افتتاحي
    const carriedTransactions: TrainerTransaction[] = [];
    coachDebtCarryOver.forEach((c) => {
      if (c.remainingDebt > 0) {
        carriedTransactions.push({
          transaction_id: `trx-carry-${c.coachId}-${Date.now()}`,
          coach_id: c.coachId,
          coach_name: c.coachName,
          amount: c.remainingDebt,
          gym_share: c.remainingDebt,
          coach_share: 0,
          collected_by: 'coach',
          payer_type: 'coach_debt',
          payer_name: c.coachName,
          payment_method: 'coach_collected',
          status: 'pending',
          month: targetNextMonth,
          created_at: new Date().toISOString(),
          notes: `[مديونية مرحلة من شهر ${currentMonth}] - رصيد افتتاحي مستحق للجيم`,
        });
      }
    });

    // 4. تحديث سجل حركات المدربين ببدء الشهر الجديد نظيفاً مع الحفاظ على المديونيات المرحلة
    setTrainerTransactions((prev) => [
      ...carriedTransactions,
      ...prev,
    ]);

    // 5. تصفير المدفوع اليوم والراتب الشهري للمدربين للشهر الجديد
    setCoaches((prev) =>
      prev.map((c) => ({
        ...c,
        totalPaidToday: 0,
        monthlySalaryPaidThisMonth: false,
      }))
    );

    // 6. بدء الدورة الشهرية الجديدة
    startNewMonth(targetNextMonth);

    if (isSupabaseConfigured) {
      supabaseService.insertMonthlyArchive(archive).catch(() => {});
      supabaseService.clearSettledTrainerTransactions().catch(() => {});
      carriedTransactions.forEach((t) => {
        supabaseService.upsertTrainerTransaction(t).catch(() => {});
      });
    }

    return { success: true, archive };
  };


  const cancelCheckIn = (checkInLogId: string) => {
    const log = checkInLogs.find((l) => l.id === checkInLogId);
    if (!log) return { success: false };

    // 1. If remainingSessions was deducted, restore it
    if (log.memberId) {
      setMembers((prev) =>
        prev.map((m) => {
          if (m.id === log.memberId) {
            return {
              ...m,
              remainingSessions: m.remainingSessions + 1,
            };
          }
          return m;
        })
      );
    }

    // 2. If member was placed in a session, remove them
    if (log.assignedSessionId && log.memberId) {
      removePlayerFromSession(log.assignedSessionId, log.memberId);
    }

    // 3. If member was placed in physio or massage, remove the booking
    if (log.assignedCategory === 'massage' || log.assignedCategory === 'physio') {
      setPhysioBookings((prev) =>
        prev.filter((b) => !(b.patientCode === log.memberCode || b.patientName === log.memberName))
      );
    }

    // 4. If a coach debt transaction was created for this check-in / seating, remove it
    setTrainerTransactions((prev) =>
      prev.filter(
        (t) =>
          !(
            t.payer_name === log.memberName &&
            (t.notes?.includes(log.memberCode) || t.payer_type.includes('تسكين'))
          )
      )
    );

    // 5. If a cash drawer inflow was created, remove it
    setCashInflows((prev) =>
      prev.filter(
        (inf) =>
          !(
            inf.memberName === log.memberName &&
            inf.title.includes('تسكين')
          )
      )
    );

    // 6. If Master Report entry was created for this seating, remove it
    setMasterReportEntries((prev) =>
      prev.filter(
        (rep) =>
          !(
            (rep.playerCode === log.memberCode || rep.playerName === log.memberName) &&
            rep.id.startsWith('rep-seat-')
          )
      )
    );

    // 7. Remove the checkInLog itself from state immediately
    setCheckInLogs((prev) => prev.filter((l) => l.id !== checkInLogId));

    // 8. Delete from Supabase if configured so refresh will NOT restore it
    if (isSupabaseConfigured) {
      supabaseService.deleteCheckInLog(checkInLogId).catch(() => {});
    }

    // 9. Delete from serverless relay /api/checkin if available
    try {
      fetch(`/api/checkin?id=${checkInLogId}`, { method: 'DELETE' }).catch(() => {});
    } catch {
      // ignore
    }

    return { success: true };
  };

  const clearAllCheckInLogs = () => {
    setCheckInLogs([]);
    if (isSupabaseConfigured) {
      supabaseService.clearAllCheckInLogs().catch(() => {});
    }
  };

  const wipeAllDataToCleanSlate = () => {
    setMembers([]);
    setSessions([]);
    setCoaches([]);
    setPhysioBookings([]);
    setProducts([]);
    setTransactions([]);
    setExpenses([]);
    setCashInflows([]);
    setCheckInLogs([]);
    setSettlementLogs([]);
    setTrainerTransactions([]);
    setMasterReportEntries([]);
    setMonthlyArchives([]);
    setYearlyArchives([]);
    setDailyShiftClosings([]);
    setSubscriptions([]);
    smartCache.invalidate();
    const freshCycle: MonthlyBillingCycle = {
      id: `cycle-${Date.now()}`,
      name: dynamicCurrentMonth,
      startDate: new Date().toISOString(),
      isActive: true,
      totalCollected: 0,
      totalPendingOnCoaches: 0,
    };
    setBillingCycles([freshCycle]);
    setCurrentMonth(dynamicCurrentMonth);
    ALL_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem('synapse_data_version', CURRENT_DATA_VERSION);
    if (isSupabaseConfigured) {
      supabaseService.wipeAllOperationalData().catch(() => {});
    }
  };

  const exportMasterReportToCSV = (filterMonth?: string) => {
    const targetMonth = filterMonth || currentMonth;
    const entries = masterReportEntries.filter(
      (e) => !targetMonth || targetMonth === 'all' || e.month === targetMonth
    );

    // 1. Separate regular direct subscriptions vs coach-collected sessions
    const directEntries = entries.filter((e) => e.paymentMethod !== 'coach_collected');
    const coachEntries = entries.filter((e) => e.paymentMethod === 'coach_collected');

    // 2. Expenses and Repayments
    const currentExpenses = expenses;
    const coachRepayments = cashInflows.filter((i) => i.type === 'coach_settlement');

    // Calculate totals
    const directTotal = directEntries.reduce((s, e) => s + e.amount, 0);
    const coachDebtTotal = coachEntries.reduce((s, e) => s + e.amount, 0);
    const repaymentsTotal = coachRepayments.reduce((s, e) => s + e.amount, 0);
    const expensesTotal = currentExpenses.reduce((s, e) => s + e.amount, 0);
    const netCashInDrawer = directTotal + repaymentsTotal - expensesTotal;

    // UTF-8 BOM so Excel opens Arabic correctly
    let csv = '\uFEFF';

    // Header Title
    csv += '========================================================================\n';
    csv += `SYNAPSE GYM SaaS - التقرير المالي والتشغيلي الشامل لشهر: ${targetMonth}\n`;
    csv += `تاريخ التصدير: ${new Date().toLocaleDateString('ar-EG')} - الفرع الرئيسي\n`;
    csv += '========================================================================\n\n';

    // SECTION 1: Direct Subscriptions & Paid Players (at top)
    csv += '### 1. الاشتراكات العادية والمدفوعات المباشرة بالخزينة (سداد فوري) ###\n';
    csv += 'اسم اللاعب,كود اللاعب,نوع التمرين,السعر (ج.م),الحالة,الكابتن المسؤول,طريقة الدفع,التاريخ\n';
    directEntries.forEach((e) => {
      const catLabel =
        e.sessionCategory === 'private' ? 'تدريب خاص' : e.sessionCategory === 'group' ? 'كلاس جماعي' : e.sessionCategory === 'physio' ? 'علاج طبيعي' : e.sessionCategory === 'massage' ? 'مساج' : 'جيم عام';
      const statusLabel = e.paymentStatus === 'paid' ? 'مدفوع بالخزينة' : 'غير مسدد';
      const methodLabel = e.paymentMethod === 'instapay' ? 'إنستاباي' : e.paymentMethod === 'card' ? 'فيزا' : 'كاش بالدرج';
      csv += `"${e.playerName}","${e.playerCode || ''}","${catLabel}",${e.amount},"${statusLabel}","${e.coachName || 'اشتراك عام'}","${methodLabel}","${new Date(e.date).toLocaleDateString('ar-EG')}"\n`;
    });
    csv += `إجمالي الاشتراكات المباشرة,,,"${directTotal} ج.م",,,,\n\n`;

    // SECTION 2: Players Grouped by Coach with Status: تحميل
    csv += '### 2. تفصيل لاعبي الكباتن وحالات التحميل (مجمعة لكل كابتن) ###\n';
    csv += 'الكابتن المسؤول,اسم اللاعب,كود اللاعب,نوع التمرين,السعر (ج.م),الحالة,بيان الحصة,التاريخ\n';
    coaches.forEach((c) => {
      const thisCoachPlayers = coachEntries.filter((e) => e.coachId === c.id || e.coachName === c.name);
      if (thisCoachPlayers.length > 0) {
        thisCoachPlayers.forEach((e) => {
          const catLabel =
            e.sessionCategory === 'private' ? 'تدريب خاص' : e.sessionCategory === 'group' ? 'كلاس جماعي' : e.sessionCategory === 'physio' ? 'علاج طبيعي' : e.sessionCategory === 'massage' ? 'مساج' : 'جيم عام';
          csv += `"${c.name}","${e.playerName}","${e.playerCode || ''}","${catLabel}",${e.amount},"تحميل (مديونية على الكابتن)","${e.sessionTitle || '-'}","${new Date(e.date).toLocaleDateString('ar-EG')}"\n`;
        });
        const cTotal = thisCoachPlayers.reduce((s, p) => s + p.amount, 0);
        csv += `"-- إجمالي تحميل ${c.name} --",,,,"${cTotal} ج.م",,,\n`;
      }
    });
    csv += `إجمالي مديونيات التحميل على الكباتن,,,,"${coachDebtTotal} ج.م",,,\n\n`;

    // SECTION 3: Operating Expenses (المصاريف والمبلغ)
    csv += '### 3. جدول المصاريف التشغيلية (مسحوبة من صفحة المصاريف) ###\n';
    csv += 'المصاريف,المبلغ (ج.م),التصنيف,طريقة السداد,التاريخ\n';
    currentExpenses.forEach((exp) => {
      csv += `"${exp.title}",${exp.amount},"${exp.category}","${exp.paymentMethod}","${new Date(exp.date).toLocaleDateString('ar-EG')}"\n`;
    });
    csv += `إجمالي المصاريف التشغيلية,"${expensesTotal} ج.م",,,\n\n`;

    // SECTION 4: Coach Debt Repayments / Deposits (إيداع تحميل والمبلغ)
    csv += '### 4. جدول إيداعات سداد التحميل من الكباتن (موردة للدرج) ###\n';
    csv += 'إيداع تحميل,المبلغ (ج.م),طريقة التوريد,التاريخ\n';
    coachRepayments.forEach((rep) => {
      csv += `"${rep.title}",${rep.amount},"${rep.paymentMethod}","${new Date(rep.date).toLocaleDateString('ar-EG')}"\n`;
    });
    csv += `إجمالي إيداعات سداد التحميل,"${repaymentsTotal} ج.م",,\n\n`;

    // SECTION 5: Grand Consolidated Totals
    csv += '========================================================================\n';
    csv += '### 5. الملخص المالي الختامي الشامل وصافي النقدية ###\n';
    csv += `إجمالي الاشتراكات المباشرة المحصلة بالخزينة:,"${directTotal} ج.م"\n`;
    csv += `إجمالي التحميلات والمديونيات على الكباتن:,"${coachDebtTotal} ج.م"\n`;
    csv += `إجمالي إيداعات سداد التحميل المستلمة من الكباتن:,"${repaymentsTotal} ج.م"\n`;
    csv += `إجمالي المصاريف التشغيلية المنصرفة:,"${expensesTotal} ج.م"\n`;
    csv += `صافي النقدية الفعلي بالدرج:,"${netCashInDrawer} ج.م"\n`;
    csv += '========================================================================\n';

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `synapse_master_report_${targetMonth.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // EXCEL XLSX MASTER REPORT EXPORT (.xlsx)
  const exportMasterReportXLSX = async (filterMonth?: string) => {
    const targetMonth = filterMonth || currentMonth;
    const entries = masterReportEntries.filter(
      (e) => !targetMonth || targetMonth === 'all' || e.month === targetMonth
    );
    const coachRepayments = cashInflows.filter((i) => i.type === 'coach_settlement');

    const directEntries = entries.filter((e) => e.paymentMethod !== 'coach_collected');
    const coachEntries = entries.filter((e) => e.paymentMethod === 'coach_collected');

    const directTotal = directEntries.reduce((s, e) => s + e.amount, 0);
    const coachDebtTotal = coachEntries.reduce((s, e) => s + e.amount, 0);
    const repaymentsTotal = coachRepayments.reduce((s, e) => s + e.amount, 0);
    const expensesTotal = expenses.reduce((s, e) => s + e.amount, 0);
    const netCash = directTotal + repaymentsTotal - expensesTotal;

    await exportMasterReportToXLSX({
      selectedMonth: targetMonth,
      entries,
      expenses,
      repayments: coachRepayments,
      cashInflows,
      posTransactions: transactions,
      coaches,
      totalDirectRevenue: directTotal,
      totalCoachDebtRevenue: coachDebtTotal,
      grandTotalPlayerRevenue: directTotal + coachDebtTotal,
      totalExpensesAmount: expensesTotal,
      totalRepaymentsAmount: repaymentsTotal,
      netPeriodCash: netCash,
    });
  };

  // YEARLY DATA ARCHIVING ARCHITECTURE
  const archiveYear = (yearToArchive: number, adminUsername: string): YearlyArchive => {
    const yearStr = String(yearToArchive);

    const checkInsSnapshot = checkInLogs.filter((l) => l.timestamp.startsWith(yearStr));
    const masterEntriesSnapshot = masterReportEntries.filter(
      (e) => e.date?.startsWith(yearStr) || e.month?.includes(yearStr)
    );
    const expensesSnapshot = expenses.filter((e) => e.date.startsWith(yearStr));
    const inflowsSnapshot = cashInflows.filter((i) => i.date.startsWith(yearStr));

    const directSubs = masterEntriesSnapshot
      .filter((e) => e.paymentMethod !== 'coach_collected')
      .reduce((sum, e) => sum + e.amount, 0);

    const coachDebtsLoaded = masterEntriesSnapshot
      .filter((e) => e.paymentMethod === 'coach_collected')
      .reduce((sum, e) => sum + e.amount, 0);

    const coachSettlements = inflowsSnapshot
      .filter((i) => i.type === 'coach_settlement')
      .reduce((sum, i) => sum + i.amount, 0);

    const totalExp = expensesSnapshot.reduce((sum, e) => sum + e.amount, 0);
    const totalRev = inflowsSnapshot.reduce((sum, i) => sum + i.amount, 0);
    const netProf = totalRev - totalExp;

    const monthNames = [
      'يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];

    const monthlyStats = monthNames.map((name, idx) => {
      const monthPrefix = `${yearStr}-${String(idx + 1).padStart(2, '0')}`;
      const mRev = inflowsSnapshot
        .filter((i) => i.date.startsWith(monthPrefix))
        .reduce((sum, i) => sum + i.amount, 0);
      const mExp = expensesSnapshot
        .filter((e) => e.date.startsWith(monthPrefix))
        .reduce((sum, e) => sum + e.amount, 0);
      const mCheckIns = checkInsSnapshot.filter((l) => l.timestamp.startsWith(monthPrefix)).length;

      return {
        monthName: name,
        monthIndex: idx + 1,
        revenue: mRev,
        expenses: mExp,
        netProfit: mRev - mExp,
        checkInsCount: mCheckIns,
      };
    });

    const newArchive: YearlyArchive = {
      id: `archive-${yearToArchive}-${Date.now()}`,
      year: yearToArchive,
      archivedAt: new Date().toISOString(),
      archivedBy: adminUsername,
      totalRevenue: totalRev,
      totalExpenses: totalExp,
      netProfit: netProf,
      totalCheckIns: checkInsSnapshot.length,
      totalDirectSubscriptions: directSubs,
      totalCoachDebtsLoaded: coachDebtsLoaded,
      totalCoachSettlements: coachSettlements,
      monthlyStats,
      checkInLogsSnapshot: checkInsSnapshot,
      masterEntriesSnapshot,
      expensesSnapshot,
      cashInflowsSnapshot: inflowsSnapshot,
    };

    setYearlyArchives((prev) => [newArchive, ...prev.filter((a) => a.year !== yearToArchive)]);

    // 3. تفريغ البيانات النشطة (Purge Active Logs): مسح أسطر الحضور والعمليات القديمة
    setCheckInLogs((prev) => prev.filter((l) => !l.timestamp.startsWith(yearStr)));

    if (isSupabaseConfigured) {
      supabaseService.insertYearlyArchive(newArchive).catch(() => {});
    }

    return newArchive;
  };

  const getYearlyArchive = (year: number) => {
    return yearlyArchives.find((a) => a.year === year);
  };

  const purgeActiveLogsForYear = (year: number) => {
    const yearStr = String(year);
    setCheckInLogs((prev) => prev.filter((l) => !l.timestamp.startsWith(yearStr)));
  };

  const exportYearlyArchiveXLSX = async (year: number) => {
    let archive = yearlyArchives.find((a) => a.year === year);
    if (!archive) {
      archive = archiveYear(year, 'الإدارة');
    }
    await exportYearlyArchiveToXLSX(archive);
  };

  const exportYearlyArchiveJSON = (year: number) => {
    let archive = yearlyArchives.find((a) => a.year === year);
    if (!archive) {
      archive = archiveYear(year, 'الإدارة');
    }
    exportYearlyArchiveToJSON(archive);
  };

  // PERIOD ARCHIVE & CLOUD STORAGE PURGING
  const archivePeriodAndPurge = async (
    periodName: string,
    selectedMonths: string[],
    adminUsername: string
  ): Promise<{ success: boolean; periodArchive: PeriodArchive }> => {
    if (!selectedMonths || selectedMonths.length === 0) {
      throw new Error('يرجى تحديد شهر واحد على الأقل للأرشفة والتفريغ');
    }

    // 1. Gather all data belonging to the selected months
    const targetEntries = masterReportEntries.filter((e) => selectedMonths.includes(e.month));
    const targetExpenses = expenses.filter((exp) =>
      selectedMonths.some((m) => exp.notes?.includes(m) || exp.title?.includes(m))
    );
    const targetInflows = cashInflows.filter((inf) =>
      selectedMonths.some((m) => inf.title?.includes(m))
    );
    const targetTrainerTx = trainerTransactions.filter((t) => t.month && selectedMonths.includes(t.month));

    const totalRev = targetEntries.reduce((s, e) => s + e.amount, 0);
    const totalExp = targetExpenses.reduce((s, e) => s + e.amount, 0);
    const netProf = totalRev - totalExp;

    const payload = {
      periodName,
      selectedMonths,
      archivedAt: new Date().toISOString(),
      archivedBy: adminUsername,
      masterEntries: targetEntries,
      expenses: targetExpenses,
      cashInflows: targetInflows,
      trainerTransactions: targetTrainerTx,
    };

    // 2. Download full Excel (.xlsx) and JSON archives to local machine
    await exportPeriodArchiveToXLSX(payload);
    exportPeriodArchiveToJSON(payload);

    // 3. Purge from local state & cache
    setMasterReportEntries((prev) => prev.filter((e) => !selectedMonths.includes(e.month)));
    setTrainerTransactions((prev) => prev.filter((t) => !t.month || !selectedMonths.includes(t.month)));
    setMonthlyArchives((prev) => prev.filter((m) => !selectedMonths.includes(m.month)));
    setBillingCycles((prev) => prev.filter((c) => c.isActive || !selectedMonths.includes(c.name)));

    // 4. Purge from Supabase cloud database if configured
    if (isSupabaseConfigured) {
      await supabaseService.purgeDataForMonths(selectedMonths);
    }

    // 5. Record period archive metadata
    const periodArchiveRecord: PeriodArchive = {
      id: `period-${Date.now()}`,
      periodName,
      selectedMonths,
      archivedAt: new Date().toISOString(),
      archivedBy: adminUsername,
      totalRevenue: totalRev,
      totalExpenses: totalExp,
      netProfit: netProf,
      recordsCount: targetEntries.length + targetExpenses.length + targetTrainerTx.length,
    };

    setPeriodArchives((prev) => [periodArchiveRecord, ...prev]);

    return { success: true, periodArchive: periodArchiveRecord };
  };

  // Check for any currently running sessions, physiotherapy, or players still inside active sessions
  const getRunningOperations = () => {
    const runningSessions = sessions.filter((s) => s.status === 'in-progress');
    const runningPhysio = physioBookings.filter(
      (p) => p.status === 'active' || p.status === 'paused'
    );
    const activeSeatedPlayers = checkInLogs.filter(
      (l) =>
        isAfterLastClosing(l.timestamp) &&
        l.seatingStatus === 'assigned' &&
        Boolean(l.assignedSessionId) &&
        l.checkOutStatus !== 'checked_out'
    );
    return {
      runningSessions,
      runningPhysio,
      activeSeatedPlayers,
      hasRunning:
        runningSessions.length > 0 ||
        runningPhysio.length > 0 ||
        activeSeatedPlayers.length > 0,
    };
  };

  // DAILY SHIFT CLOSING (تقفيل اليومية والدرج)
  const closeDailyShift = async (closingData: Omit<DailyShiftClosing, 'id' | 'closedAt'>): Promise<DailyShiftClosing> => {
    const running = getRunningOperations();
    if (running.hasRunning) {
      const runningNames = [
        ...running.runningSessions.map((s) => `حصة: ${s.title}`),
        ...running.runningPhysio.map((p) => `جلسة تأهيل: ${p.patientName} (${p.roomName})`),
        ...running.activeSeatedPlayers.map((l) => `لاعب لم يسجل خروج: ${l.memberName}`),
      ].join('، ');
      throw new Error(`لا يمكن تقفيل اليومية! يوجد عمليات أو لاعبون لم يسجلوا خروج بعد: ${runningNames}`);
    }

    // Month expiration check:
    const activeCycle = billingCycles.find((c) => c.isActive);
    if (activeCycle?.endDate) {
      const shiftDay = closingData.closingDayDate || closingData.date;
      if (shiftDay > activeCycle.endDate) {
        throw new Error(
          `يرجى بدء شهر جديد أولاً! لقد انتهت الفترة المحددة للشهر الحالي (${activeCycle.name} الممتدة حتى ${activeCycle.endDate}). يجب تقفيل وبدء شهر جديد أولاً قبل إقفال اليومية.`
        );
      }
    }

    const todayCoachEarnings =
      closingData.totalCoachEarningsToday !== undefined
        ? closingData.totalCoachEarningsToday
        : trainerTransactions
            .filter(
              (t) =>
                t.created_at?.startsWith(closingData.date) &&
                t.collected_by === 'gym' &&
                t.coach_share > 0
            )
            .reduce((sum, t) => sum + t.coach_share, 0);

    const newClosing: DailyShiftClosing = {
      ...closingData,
      totalCoachEarningsToday: todayCoachEarnings,
      id: `shift-close-${Date.now()}`,
      closedAt: new Date().toISOString(),
    };

    // Pessimistic DB Write: Persist daily shift closing to Supabase FIRST
    const ok = await strictDbWrite(() => supabaseService.insertDailyShiftClosing(newClosing));
    if (!ok) {
      throw new NetworkDbError(NETWORK_ERROR_MESSAGE);
    }

    setDailyShiftClosings((prev) => [newClosing, ...prev]);

    // Handle discrepancy audit log
    if (newClosing.difference && newClosing.difference !== 0) {
      if (newClosing.difference < 0) {
        const deficitExpense: ExpenseItem = {
          id: `exp-deficit-${Date.now()}`,
          title: `عجز نقدية مقيد بتقفيل وردية ${newClosing.date}`,
          category: 'other',
          amount: Math.abs(newClosing.difference),
          date: new Date().toISOString(),
          recordedBy: newClosing.closedBy,
          notes: `تسوية عجز جرد فعلي للوردية`,
          paymentMethod: 'cash',
          autoGenerated: true,
        };
        setExpenses((prev) => [deficitExpense, ...prev]);
        if (isSupabaseConfigured) {
          supabaseService.insertExpense(deficitExpense).catch(() => {});
        }
      } else {
        const surplusInflow: CashInflowItem = {
          id: `inf-surplus-${Date.now()}`,
          type: 'manual_deposit',
          title: `فائض نقدية مقيد بتقفيل وردية ${newClosing.date}`,
          amount: newClosing.difference,
          date: new Date().toISOString(),
          paymentMethod: 'cash',
          recordedBy: newClosing.closedBy,
        };
        setCashInflows((prev) => [surplusInflow, ...prev]);
        if (isSupabaseConfigured) {
          supabaseService.insertCashInflow(surplusInflow).catch(() => {});
        }
      }
    }

    // 1. تصفير ومسح طابور وحضور وتسجيلات الاستقبال بالكامل لتبدأ اليومية الجديدة نظيفة
    setCheckInLogs([]);

    // 2. إعادة ضبط كافة الحصص لوضع الاستعداد (idle) وإفراغ التسكين المؤقت لليوم ومزامنتها في Supabase
    const resetSessions = sessions.map((s) => ({
      ...s,
      status: 'idle' as const,
      startedAt: undefined,
      endedAt: undefined,
      completedTodayByCoach: {},
      temporaryPlayerIds: [],
    }));
    setSessions(resetSessions);

    // 3. تصفير ومسح جدول جلسات العلاج الطبيعي والمساج المنتهية والمحاسب عليها بعد ترحيلها
    setPhysioBookings((prev) => prev.filter((b) => b.status !== 'completed'));

    if (isSupabaseConfigured) {
      supabaseService.clearAllCheckInLogs().catch(() => {});
      supabaseService.clearCheckInLogsForDate(newClosing.date).catch(() => {});
      supabaseService.clearCompletedPhysioBookings().catch(() => {});
      if (resetSessions.length > 0) {
        supabaseService.upsertSessionsBatch(resetSessions).catch(() => {});
      }
    }

    return newClosing;
  };

  const getTodayShiftStatus = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayClosings = dailyShiftClosings.filter((c) => c.date === todayStr);
    return {
      isClosedToday: todayClosings.length > 0,
      lastClosing: todayClosings[0],
    };
  };

  const exportDailyShiftXLSX = async (closingId?: string) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const targetClosing = closingId
      ? dailyShiftClosings.find((c) => c.id === closingId)
      : dailyShiftClosings[0];

    const fallbackClosing: DailyShiftClosing = targetClosing || {
      id: `shift-${Date.now()}`,
      date: todayStr,
      closedAt: new Date().toISOString(),
      closedBy: 'الاستقبال',
      totalDirectCash: 0,
      totalRepayments: 0,
      totalPosCash: 0,
      totalPhysioCash: 0,
      totalExpenses: 0,
      expectedNetDrawerCash: 0,
      actualCountedCash: 0,
      difference: 0,
      totalCoachDebtsLoadedToday: 0,
    };

    const closingDate = fallbackClosing.closingDayDate || fallbackClosing.date;
    const nextDate = fallbackClosing.nextDayDate;

    const matchesDate = (d?: string) => {
      if (!d) return false;
      return d.startsWith(closingDate) || (nextDate ? d.startsWith(nextDate) : false);
    };

    const todayEntries = masterReportEntries.filter((e) => matchesDate(e.date));
    const todayExpenses = expenses.filter((e) => matchesDate(e.date));
    const todayInflows = cashInflows.filter((i) => matchesDate(i.date));
    const todayTransactions = transactions.filter((t) => matchesDate(t.timestamp));
    const todayTrainerTransactions = trainerTransactions.filter((t) => matchesDate(t.created_at));
    const todayCheckInLogs = checkInLogs.filter((l) => matchesDate(l.timestamp));

    await exportDailyShiftToXLSX(
      fallbackClosing,
      todayEntries,
      todayExpenses,
      todayInflows,
      todayTransactions,
      todayTrainerTransactions,
      todayCheckInLogs,
      coaches
    );
  };

  return (
    <GymDataContext.Provider
      value={{
        isInitialLoading,
        networkError,
        reportNetworkError,
        clearNetworkError,
        subscriptions,
        memberSubscriptionHistoryMap,
        subscriptionPlans,
        updateSubscriptionPlans,
        gymSettings,
        updateGymSettings,
        members,
        cancelCheckIn,
        clearAllCheckInLogs,
        renewMemberSubscription,
        wipeAllDataToCleanSlate,
        addMember,
        updateMember,
        toggleMemberAsDoctor,
        findMemberByCode,
        performCheckIn,
        calculatePlayerCheckOutQuote,
        completePlayerCheckOut,
        sessions,
        addSession,
        updateSession,
        deleteSession,
        startSession,
        endSession,
        assignPlayerToSession,
        removePlayerFromSession,
        toggleSessionCoachCompletion,
        coaches,
        addCoach,
        updateCoach,
        settleCoachAccount,
        payMonthlySalary,
        settlementLogs,
        physioBookings,
        startPhysioSession,
        beginPhysioSession,
        finishPhysioSession,
        addExtraFeeToPhysio,
        completePhysioSession,
        pausePhysioSession,
        resumePhysioSession,
        billPhysioSession,
        assignArrivedMember,
        products,
        addProduct,
        updateProduct,
        deleteProduct,
        transactions,
        processSale,
        expenses,
        cashInflows,
        addExpense,
        deleteExpense,
        addCashInflow,
        deleteCashInflow,
        addManualCashMovement,
        getDrawerStats,
        getTodayStats,
        checkInLogs,
        trainerTransactions,
        addTrainerTransaction,
        settleCoachPayable,
        collectGymReceivable,
        netSettleTrainer,
        getCoachFinancialSummary,
        getAllTrainersFinancialSummary,
        repayCoachDebt,
        addCoachManualMovement,
        getCoachMonthlyBreakdown,
        masterReportEntries,
        billingCycles,
        currentMonth,
        setCurrentMonth,
        addMasterReportEntry,
        updateMasterReportEntry,
        deleteMasterReportEntry,
        startNewMonth,
        monthlyArchives,
        closeMonthlyBillingCycle,
        exportMasterReportToCSV,
        exportMasterReportXLSX,
        periodArchives,
        archivePeriodAndPurge,
        yearlyArchives,
        archiveYear,
        getYearlyArchive,
        purgeActiveLogsForYear,
        exportYearlyArchiveXLSX,
        exportYearlyArchiveJSON,
        dailyShiftClosings,
        getRunningOperations,
        closeDailyShift,
        getTodayShiftStatus,
        exportDailyShiftXLSX,
        isAfterLastClosing,
        lastClosingTime,
      }}
    >
      {children}
    </GymDataContext.Provider>
  );
};

export const useGymData = () => {
  const ctx = useContext(GymDataContext);
  if (!ctx) throw new Error('useGymData must be used within GymDataProvider');
  return ctx;
};
