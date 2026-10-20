import React, { createContext, useContext, useState, useEffect } from 'react';
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
} from '../types';

interface GymDataContextType {
  // Members
  members: Member[];
  addMember: (member: Omit<Member, 'id'>) => Member;
  updateMember: (id: string, updates: Partial<Member>) => void;
  toggleMemberAsDoctor: (id: string) => void;
  findMemberByCode: (code: string) => Member | undefined;
  performCheckIn: (memberId: string, method?: 'qr' | 'manual') => { success: boolean; member?: Member; message?: string };

  // Sessions / Classes
  sessions: GymSession[];
  addSession: (session: Omit<GymSession, 'id'>) => void;
  updateSession: (id: string, updates: Partial<GymSession>) => void;
  deleteSession: (id: string) => void;
  assignPlayerToSession: (sessionId: string, memberId: string, isTemporary?: boolean) => void;
  removePlayerFromSession: (sessionId: string, memberId: string) => void;
  toggleSessionCoachCompletion: (sessionId: string, coachId: string) => void;

  // Coaches & Payroll
  coaches: Coach[];
  addCoach: (coach: Omit<Coach, 'id' | 'currentBalance' | 'totalPaidToday'>) => void;
  updateCoach: (id: string, updates: Partial<Coach>) => void;
  settleCoachAccount: (coachId: string, adminUsername: string) => { success: boolean; settledAmount: number };
  payMonthlySalary: (coachId: string, adminUsername: string) => { success: boolean; salaryAmount: number };
  settlementLogs: SettlementLog[];

  // Physiotherapy & Massage
  physioBookings: PhysioBooking[];
  startPhysioSession: (data: {
    doctorName: string;
    doctorCode: string;
    patientName: string;
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
    }
  ) => void;
  assignArrivedMember: (
    checkInLogId: string,
    category: SessionCategory,
    coachId: string,
    sessionId?: string,
    notes?: string,
    paymentDetails?: {
      paymentMode: 'coach_charge' | 'cash_drawer' | 'instapay';
      amount: number;
      roomName?: string;
    }
  ) => void;

  // POS
  products: POSProduct[];
  addProduct: (product: Omit<POSProduct, 'id'>) => void;
  updateProduct: (id: string, updates: Partial<POSProduct>) => void;
  deleteProduct: (id: string) => void;
  transactions: POSTransaction[];
  processSale: (saleData: Omit<POSTransaction, 'id' | 'timestamp'>) => POSTransaction;

  // Expenses & Cash Drawer
  expenses: ExpenseItem[];
  cashInflows: CashInflowItem[];
  addExpense: (expense: Omit<ExpenseItem, 'id' | 'date'>) => ExpenseItem;
  deleteExpense: (id: string) => void;
  addCashInflow: (inflow: Omit<CashInflowItem, 'id' | 'date'>) => CashInflowItem;
  addManualCashMovement: (type: 'deposit' | 'withdrawal', amount: number, title: string, notes?: string) => void;
  getDrawerStats: () => {
    totalCashIn: number;
    totalCashOut: number;
    netCashInDrawer: number;
    todayCashIn: number;
    todayCashOut: number;
    todayNetInDrawer: number;
    totalInstapayIn: number;
    totalPendingOnCoaches: number;
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
  ) => { success: boolean; repaidAmount: number };
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
  startNewMonth: (newMonthName: string) => void;
  exportMasterReportToCSV: (month?: string) => void;
}

// Initial Mock Seed Data
const INITIAL_MEMBERS: Member[] = [
  {
    id: 'mem-101',
    code: 'SYN-101',
    name: 'محمود عبد الرحمن',
    phone: '01011223344',
    type: 'member',
    subscriptionPlan: 'عضوية VIP سنوية + مدرب خاص',
    subscriptionFee: 4500,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    totalDays: 365,
    remainingDays: 142,
    totalSessions: 50,
    remainingSessions: 28,
    active: true,
    assignedSessionId: 'sess-1',
    notes: 'يفضل التدريب المسائي',
  },
  {
    id: 'mem-102',
    code: 'SYN-102',
    name: 'يوسف طارق علام',
    phone: '01144556677',
    type: 'member',
    subscriptionPlan: 'اشتراك شهري لياقة وكروس فيت',
    subscriptionFee: 750,
    startDate: '2026-09-20',
    endDate: '2026-10-20',
    totalDays: 30,
    remainingDays: 7,
    totalSessions: 12,
    remainingSessions: 4,
    active: true,
    assignedSessionId: 'sess-1',
  },
  {
    id: 'mem-103',
    code: 'SYN-103',
    name: 'د. حسام فاروق الشامي',
    phone: '01288990011',
    type: 'doctor',
    subscriptionPlan: 'عضوية أطباء وتأهيل حركي',
    subscriptionFee: 1200,
    startDate: '2026-05-01',
    endDate: '2027-05-01',
    totalDays: 365,
    remainingDays: 200,
    totalSessions: 100,
    remainingSessions: 85,
    active: true,
    notes: 'استشاري إصابات ملاعب وتأهيل',
  },
  {
    id: 'mem-104',
    code: 'SYN-104',
    name: 'كريم سامي رضوان',
    phone: '01599887766',
    type: 'member',
    subscriptionPlan: 'اشتراك ملاكمة ودفاع عن النفس',
    subscriptionFee: 900,
    startDate: '2026-09-01',
    endDate: '2026-11-01',
    totalDays: 60,
    remainingDays: 19,
    totalSessions: 24,
    remainingSessions: 11,
    active: true,
    assignedSessionId: 'sess-2',
  },
  {
    id: 'mem-105',
    code: 'SYN-105',
    name: 'سارة خالد الديب',
    phone: '01066778899',
    type: 'member',
    subscriptionPlan: 'اشتراك سبينينغ ولياقة بدنية',
    subscriptionFee: 650,
    startDate: '2026-10-01',
    endDate: '2026-11-01',
    totalDays: 30,
    remainingDays: 18,
    totalSessions: 16,
    remainingSessions: 10,
    active: true,
    assignedSessionId: 'sess-3',
  },
];

const INITIAL_COACHES: Coach[] = [
  {
    id: 'cch-1',
    name: 'كابتن إسلام سمير',
    phone: '01099887711',
    specialty: 'كروس فيت ولياقة وظيفية',
    paymentType: 'per_session', // بالحصة -> Red tag
    ratePerSession: 150,
    currentBalance: 450,
    totalPaidToday: 0,
    active: true,
  },
  {
    id: 'cch-2',
    name: 'كابتن رامي جمال',
    phone: '01122334455',
    specialty: 'ملاكمة وقتال مختلط',
    paymentType: 'monthly', // بالشهر -> Blue tag
    monthlySalary: 7500,
    currentBalance: 0,
    totalPaidToday: 0,
    monthlySalaryPaidThisMonth: false,
    active: true,
  },
  {
    id: 'cch-5',
    name: 'كابتن هشام القاضي',
    phone: '01022338899',
    specialty: 'مدرب لياقة بدنية عامة وتخسيس',
    paymentType: 'monthly', // بالشهر -> Blue tag
    monthlySalary: 6200,
    currentBalance: 0,
    totalPaidToday: 0,
    monthlySalaryPaidThisMonth: true,
    lastSalaryPaymentDate: '2026-10-01',
    active: true,
  },
  {
    id: 'cch-3',
    name: 'كابتن نادر مصطفى',
    phone: '01233445566',
    specialty: 'كمال أجسام ورفع أثقال',
    paymentType: 'percentage', // بالنسبة
    commissionRate: 35,
    ratePerSession: 100,
    currentBalance: 320,
    totalPaidToday: 0,
    active: true,
  },
  {
    id: 'cch-4',
    name: 'كابتن يوسف حسن',
    phone: '01055667788',
    specialty: 'سبينينغ وكارديو',
    paymentType: 'daily', // يومي
    ratePerSession: 120,
    currentBalance: 240,
    totalPaidToday: 0,
    active: true,
  },
];

const INITIAL_SESSIONS: GymSession[] = [
  {
    id: 'sess-1',
    title: 'كروس فيت عالي الشدة (CrossFit Beast)',
    sport: 'كروس فيت',
    hall: 'القاعة الرئيسية A',
    coachIds: ['cch-1', 'cch-3'],
    price: 150,
    startTime: '18:00',
    endTime: '19:30',
    daysOfWeek: [0, 1, 2, 3, 4],
    enrolledPlayerIds: ['mem-101', 'mem-102'],
    completedTodayByCoach: {
      'cch-1': true,
      'cch-3': false,
    },
    notes: 'تدريب رفع أوزان ولياقة مكثفة',
  },
  {
    id: 'sess-2',
    title: 'ملاكمة وتكنيك القتال (Pro Boxing)',
    sport: 'ملاكمة',
    hall: 'حلبة الأبطال B',
    coachIds: ['cch-2'],
    price: 180,
    startTime: '19:30',
    endTime: '21:00',
    daysOfWeek: [1, 3, 5],
    enrolledPlayerIds: ['mem-104'],
    completedTodayByCoach: {
      'cch-2': false,
    },
    notes: 'تمارين لكمات ورشاقة وسرعة رد الفعل',
  },
  {
    id: 'sess-3',
    title: 'سبينينغ وحرق دهون (Spinning Cardio)',
    sport: 'سبينينغ',
    hall: 'قاعة الدراجات الهوائية C',
    coachIds: ['cch-4'],
    price: 120,
    startTime: '10:00',
    endTime: '11:30',
    daysOfWeek: [0, 2, 4],
    enrolledPlayerIds: ['mem-105'],
    completedTodayByCoach: {
      'cch-4': true,
    },
    notes: 'جلسة صباحية مكثفة',
  },
];

const INITIAL_PHYSIO_BOOKINGS: PhysioBooking[] = [
  {
    id: 'physio-1',
    doctorName: 'د. حسام فاروق الشامي',
    doctorCode: 'SYN-103',
    doctorPhone: '01288990011',
    patientName: 'أحمد محمود العوضي',
    roomName: 'عيادة التأهيل الطبي 1',
    hourlyRate: 150,
    startTime: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    elapsedMinutes: 45,
    totalFee: 112.5,
    serviceType: 'physio',
    status: 'active',
    paid: false,
  },
  {
    id: 'massage-waiting-1',
    doctorName: 'كابتن نادر مصطفى',
    doctorCode: 'cch-3',
    patientName: 'سامح حسن عبد ربه',
    patientCode: 'SYN-104',
    roomName: 'غرفة المساج والاستشفاء 1',
    hourlyRate: 180,
    startTime: new Date().toISOString(),
    elapsedMinutes: 0,
    totalFee: 180,
    serviceType: 'massage',
    status: 'waiting',
    paid: false,
    notes: 'تم التسكين من الاستقبال - في انتظار بدء الجلسة',
  },
];

const INITIAL_PRODUCTS: POSProduct[] = [
  {
    id: 'prod-1',
    name: 'واي بروتين جولد ستاندرد (Optimum Whey 2.2kg)',
    category: 'supplements',
    buyPrice: 1500,
    sellPrice: 1950,
    stock: 14,
    barcode: '600101',
  },
  {
    id: 'prod-2',
    name: 'كرياتين مونوهايدرات ميكرونايزد (300g)',
    category: 'supplements',
    buyPrice: 550,
    sellPrice: 750,
    stock: 22,
    barcode: '600102',
  },
  {
    id: 'prod-3',
    name: 'مشروب طاقة ريد بُل (Red Bull 250ml)',
    category: 'drinks',
    buyPrice: 42,
    sellPrice: 65,
    stock: 48,
    barcode: '600103',
  },
  {
    id: 'prod-4',
    name: 'مياه معدنية طبيعية (Nestle 1.5L)',
    category: 'drinks',
    buyPrice: 8,
    sellPrice: 15,
    stock: 120,
    barcode: '600104',
  },
  {
    id: 'prod-5',
    name: 'بروتين بار عضوي بالشوكولاتة (Grenade Carb Killa)',
    category: 'snacks',
    buyPrice: 38,
    sellPrice: 60,
    stock: 35,
    barcode: '600105',
  },
  {
    id: 'prod-6',
    name: 'تيشيرت سينابس جيم الرياضي (Synapse Pro Dry-Fit)',
    category: 'apparel',
    buyPrice: 140,
    sellPrice: 280,
    stock: 18,
    barcode: '600106',
  },
  {
    id: 'prod-7',
    name: 'شيكر رياضي سينابس (Synapse Shaker 700ml)',
    category: 'other',
    buyPrice: 60,
    sellPrice: 120,
    stock: 25,
    barcode: '600107',
  },
];

// Initial realistic Expenses
const INITIAL_EXPENSES: ExpenseItem[] = [
  {
    id: 'exp-1',
    title: 'فاتورة كهرباء شهرية لمكيفات وإضاءة الجيم',
    category: 'electricity',
    amount: 3200,
    date: new Date(Date.now() - 3 * 86400000).toISOString(),
    recordedBy: 'cahmed255u',
    notes: 'العداد التجاري للصالات الثلاث',
    paymentMethod: 'cash',
  },
  {
    id: 'exp-2',
    title: 'فاتورة استهلاك المياه ومرافق الساونا والشاور',
    category: 'water',
    amount: 650,
    date: new Date(Date.now() - 2 * 86400000).toISOString(),
    recordedBy: 'cahmed255u',
    paymentMethod: 'cash',
  },
  {
    id: 'exp-3',
    title: 'صيانة وقائية لأجهزة المشايات الكهربائية والكابلات',
    category: 'maintenance',
    amount: 1400,
    date: new Date(Date.now() - 1 * 86400000).toISOString(),
    recordedBy: 'reception',
    notes: 'تغيير سيور المشاية رقم 2 و 4',
    paymentMethod: 'cash',
  },
  {
    id: 'exp-4',
    title: 'مستلزمات نظافة ومعقمات ومناشف',
    category: 'supplies',
    amount: 450,
    date: new Date().toISOString(),
    recordedBy: 'reception',
    paymentMethod: 'cash',
  },
];

// Initial realistic Inflows (Subscriptions entered into cash drawer)
const INITIAL_INFLOWS: CashInflowItem[] = [
  {
    id: 'inf-1',
    type: 'subscription',
    title: 'اشتراك سنوي VIP نقدي في الخزينة',
    amount: 4500,
    date: new Date(Date.now() - 4 * 86400000).toISOString(),
    memberName: 'محمود عبد الرحمن',
    paymentMethod: 'cash',
    recordedBy: 'cahmed255u',
  },
  {
    id: 'inf-2',
    type: 'subscription',
    title: 'تجديد اشتراك شهري كروس فيت نقدياً بالدرج',
    amount: 750,
    date: new Date().toISOString(),
    memberName: 'يوسف طارق علام',
    paymentMethod: 'cash',
    recordedBy: 'reception',
  },
  {
    id: 'inf-3',
    type: 'subscription',
    title: 'اشتراك شهري سبينينغ بالدرج',
    amount: 650,
    date: new Date().toISOString(),
    memberName: 'سارة خالد الديب',
    paymentMethod: 'cash',
    recordedBy: 'reception',
  },
];

const INITIAL_CHECKIN_LOGS: CheckInLog[] = [
  {
    id: 'chk-1',
    memberId: 'mem-101',
    memberName: 'أحمد محمود العوضي',
    memberCode: 'SYN-101',
    memberType: 'member',
    timestamp: new Date(Date.now() - 12 * 60000).toISOString(),
    method: 'qr',
    subscriptionValid: true,
    seatingStatus: 'unassigned',
  },
  {
    id: 'chk-2',
    memberId: 'mem-102',
    memberName: 'محمد طارق كمال',
    memberCode: 'SYN-102',
    memberType: 'member',
    timestamp: new Date(Date.now() - 32 * 60000).toISOString(),
    method: 'qr',
    subscriptionValid: true,
    seatingStatus: 'assigned',
    assignedCategory: 'group',
    assignedCoachId: 'cch-1',
    assignedCoachName: 'كابتن إسلام سمير',
    assignedSessionTitle: 'كروس فيت عالي الشدة',
  },
];

// Seed Data for Dual Financial Flows Unified Transactions
const INITIAL_TRAINER_TRANSACTIONS: TrainerTransaction[] = [
  // Carried-Over Debt from Previous Month (September 2026) -> ترحيل مديونية الشهر السابق
  {
    transaction_id: 'TRX-099',
    coach_id: 'cch-1',
    coach_name: 'كابتن إسلام سمير',
    amount: 800,
    collected_by: 'coach',
    payer_type: 'مديونية مرحلة من الشهر السابق (حصة كروس فيت سبتمبر)',
    payer_name: 'حساب شهر سبتمبر 2026',
    gym_share: 800, // Gym Receivable carried over!
    coach_share: 0,
    status: 'pending',
    created_at: '2026-09-28T14:00:00.000Z',
    month: 'سبتمبر 2026',
    type: 'session_charge',
    payment_method: 'coach_collected',
    notes: 'مديونية مرحلة من شهر سبتمبر 2026 لم تسدد بعد',
  },
  // Flow 1: Gym-Centric (Paid to Gym -> Coach Payable: مستحقات للمدرب / ليه فلوس)
  {
    transaction_id: 'TRX-101',
    coach_id: 'cch-1',
    coach_name: 'كابتن إسلام سمير',
    amount: 1500,
    collected_by: 'gym',
    payer_type: 'باقة تدريب خاصة 6 حصص PT',
    payer_name: 'محمود عبد الرحمن',
    gym_share: 750,
    coach_share: 750, // Coach Payable
    status: 'pending',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    month: 'أكتوبر 2026',
    type: 'subscription_charge',
    payment_method: 'cash',
    notes: 'تم الدفع بالاستقبال نقداً - نسبة المدرب 50%',
  },
  // Flow 2: Coach-Centric (Paid to Coach -> Gym Receivable: مديونية للجيم عند المدرب / عليه فلوس)
  {
    transaction_id: 'TRX-102',
    coach_id: 'cch-1',
    coach_name: 'كابتن إسلام سمير',
    amount: 1000,
    collected_by: 'coach',
    payer_type: 'حصة تدريب وتغذية خاصة',
    payer_name: 'يوسف طارق علام',
    gym_share: 400, // Gym Receivable
    coach_share: 600,
    status: 'pending',
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    month: 'أكتوبر 2026',
    type: 'session_charge',
    payment_method: 'coach_collected',
    notes: 'تحميل مباشر على الكابتن - اللاعب دفع للمدرب',
  },
  // Flow 1: Gym-Centric (Paid to Gym)
  {
    transaction_id: 'TRX-103',
    coach_id: 'cch-2',
    coach_name: 'كابتن رامي جمال',
    amount: 800,
    collected_by: 'gym',
    payer_type: 'حصة ملاكمة مكثفة فردية',
    payer_name: 'كريم سامي رضوان',
    gym_share: 480,
    coach_share: 320, // Coach Payable
    status: 'pending',
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    month: 'أكتوبر 2026',
    type: 'session_charge',
    payment_method: 'instapay',
    notes: 'سداد تحويل انستاباي لحساب الجيم',
  },
  // Flow 2: Coach-Centric (Paid to Coach)
  {
    transaction_id: 'TRX-104',
    coach_id: 'cch-4',
    coach_name: 'كابتن يوسف حسن',
    amount: 600,
    collected_by: 'coach',
    payer_type: 'جلسة سبينينغ خاصة',
    payer_name: 'سارة خالد الديب',
    gym_share: 200, // Gym Receivable (remaining)
    coach_share: 400,
    status: 'pending',
    created_at: new Date().toISOString(),
    month: 'أكتوبر 2026',
    type: 'session_charge',
    payment_method: 'coach_collected',
    notes: 'استلام مباشر من المتدربة - متبقي 200 ج.م بعد سداد جزئي',
  },
  // Repayment record from Coach (سداد جزئي من مديونية الكابتن)
  {
    transaction_id: 'REP-101',
    coach_id: 'cch-4',
    coach_name: 'كابتن يوسف حسن',
    amount: 200,
    collected_by: 'gym',
    payer_type: 'إيداع سداد تحميل',
    payer_name: 'كابتن يوسف حسن',
    gym_share: 200,
    coach_share: 0,
    status: 'settled',
    created_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    settled_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    settled_by: 'الاستقبال',
    month: 'أكتوبر 2026',
    type: 'coach_repayment',
    payment_method: 'cash',
    notes: 'سداد جزئي بقيمة 200 ج.م نقداً بالدرج من مديونية الحصص',
  },
  // Settled Transaction
  {
    transaction_id: 'TRX-105',
    coach_id: 'cch-3',
    coach_name: 'كابتن نادر مصطفى',
    amount: 1200,
    collected_by: 'gym',
    payer_type: 'اشتراك شهري كمال أجسام خاص',
    payer_name: 'عمر الشريف',
    gym_share: 720,
    coach_share: 480,
    status: 'settled',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    settled_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    settled_by: 'cahmed255u',
    month: 'أكتوبر 2026',
    type: 'subscription_charge',
    payment_method: 'cash',
    notes: 'تمت التسوية بنجاح وصرف مستحقات المدرب',
  },
];

const INITIAL_MASTER_ENTRIES: MasterReportEntry[] = [
  // 1. Regular Subscriptions & Direct Gym Cash (Always at the top)
  {
    id: 'rep-sub-1',
    month: 'أكتوبر 2026',
    date: new Date(Date.now() - 5 * 86400000).toISOString(),
    playerName: 'أحمد محمود العوضي',
    playerCode: 'SYN-106',
    amount: 600,
    coachName: 'اشتراك عام بالخزينة',
    sessionCategory: 'gym',
    sessionTitle: 'اشتراك شهري لياقة عامة (خزينة الجيم)',
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    notes: 'اشتراك عادي مسدد نقداً بالخزينة',
    sourceType: 'subscription',
  },
  {
    id: 'rep-sub-2',
    month: 'أكتوبر 2026',
    date: new Date(Date.now() - 3 * 86400000).toISOString(),
    playerName: 'محمد طارق كمال',
    playerCode: 'SYN-107',
    amount: 750,
    coachName: 'اشتراك عام بالخزينة',
    sessionCategory: 'gym',
    sessionTitle: 'اشتراك شهري حديد وأجهزة',
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    notes: 'سداد فوري بالدرج',
    sourceType: 'subscription',
  },
  // 2. Players grouped by Coach (With Status: تحميل / معلق على الكابتن)
  {
    id: 'rep-1',
    month: 'أكتوبر 2026',
    date: new Date(Date.now() - 4 * 86400000).toISOString(),
    playerName: 'محمود عبد الرحمن',
    playerCode: 'SYN-101',
    amount: 4500,
    coachId: 'cch-1',
    coachName: 'كابتن إسلام سمير',
    sessionCategory: 'private',
    sessionTitle: 'باقة تدريب خاصة 6 حصص PT',
    paymentMethod: 'coach_collected',
    paymentStatus: 'pending_on_coach',
    notes: 'تحميل على الكابتن - مستلم من المتدرب',
    sourceType: 'subscription',
  },
  {
    id: 'rep-2',
    month: 'أكتوبر 2026',
    date: new Date(Date.now() - 2 * 86400000).toISOString(),
    playerName: 'يوسف طارق علام',
    playerCode: 'SYN-102',
    amount: 1000,
    coachId: 'cch-1',
    coachName: 'كابتن إسلام سمير',
    sessionCategory: 'private',
    sessionTitle: 'كورس تأهيل وتغذية مع المدرب',
    paymentMethod: 'coach_collected',
    paymentStatus: 'pending_on_coach',
    notes: 'اللاعب دفع للكابتن مباشرة - مديونية على الكابتن لحين التوريد',
    sourceType: 'session',
  },
  {
    id: 'rep-3',
    month: 'أكتوبر 2026',
    date: new Date(Date.now() - 1 * 86400000).toISOString(),
    playerName: 'كريم سامي رضوان',
    playerCode: 'SYN-104',
    amount: 900,
    coachId: 'cch-2',
    coachName: 'كابتن رامي جمال',
    sessionCategory: 'group',
    sessionTitle: 'اشتراك ملاكمة ودفاع عن النفس',
    paymentMethod: 'instapay',
    paymentStatus: 'paid',
    notes: 'تحويل انستاباي لحساب الجيم',
    sourceType: 'subscription',
  },
  {
    id: 'rep-4',
    month: 'أكتوبر 2026',
    date: new Date().toISOString(),
    playerName: 'سارة خالد الديب',
    playerCode: 'SYN-105',
    amount: 650,
    coachId: 'cch-4',
    coachName: 'كابتن يوسف حسن',
    sessionCategory: 'group',
    sessionTitle: 'اشتراك شهري سبينينغ',
    paymentMethod: 'coach_collected',
    paymentStatus: 'pending_on_coach',
    notes: 'مع الكابتن - يحاسب في نهاية الشهر',
    sourceType: 'subscription',
  },
  {
    id: 'rep-5',
    month: 'أكتوبر 2026',
    date: new Date().toISOString(),
    playerName: 'أحمد محمود العوضي',
    playerCode: 'SYN-106',
    amount: 150,
    coachId: 'cch-5',
    coachName: 'د. حسام فاروق الشامي',
    sessionCategory: 'physio',
    sessionTitle: 'جلسة تأهيل وعلاج طبيعي',
    paymentMethod: 'coach_collected',
    paymentStatus: 'pending_on_coach',
    notes: 'جلسة علاج طبيعي - محملة على حساب الدكتور',
    sourceType: 'physio',
  },
];

const INITIAL_BILLING_CYCLES: MonthlyBillingCycle[] = [
  {
    id: 'cycle-2026-10',
    name: 'أكتوبر 2026',
    startDate: '2026-10-01',
    isActive: true,
    totalCollected: 7050,
    totalPendingOnCoaches: 1800,
  },
  {
    id: 'cycle-2026-09',
    name: 'سبتمبر 2026',
    startDate: '2026-09-01',
    closedDate: '2026-09-30',
    isActive: false,
    totalCollected: 38200,
    totalPendingOnCoaches: 0,
  },
];

const GymDataContext = createContext<GymDataContextType | undefined>(undefined);

export const GymDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Members
  const [members, setMembers] = useState<Member[]>(() => {
    const saved = localStorage.getItem('synapse_members');
    return saved ? JSON.parse(saved) : INITIAL_MEMBERS;
  });

  // Sessions
  const [sessions, setSessions] = useState<GymSession[]>(() => {
    const saved = localStorage.getItem('synapse_sessions');
    return saved ? JSON.parse(saved) : INITIAL_SESSIONS;
  });

  // Coaches
  const [coaches, setCoaches] = useState<Coach[]>(() => {
    const saved = localStorage.getItem('synapse_coaches');
    return saved ? JSON.parse(saved) : INITIAL_COACHES;
  });

  // Physio
  const [physioBookings, setPhysioBookings] = useState<PhysioBooking[]>(() => {
    const saved = localStorage.getItem('synapse_physio');
    return saved ? JSON.parse(saved) : INITIAL_PHYSIO_BOOKINGS;
  });

  // Products
  const [products, setProducts] = useState<POSProduct[]>(() => {
    const saved = localStorage.getItem('synapse_products');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  // Transactions
  const [transactions, setTransactions] = useState<POSTransaction[]>(() => {
    const saved = localStorage.getItem('synapse_transactions');
    return saved ? JSON.parse(saved) : [];
  });

  // Expenses
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => {
    const saved = localStorage.getItem('synapse_expenses');
    return saved ? JSON.parse(saved) : INITIAL_EXPENSES;
  });

  // Cash Inflows
  const [cashInflows, setCashInflows] = useState<CashInflowItem[]>(() => {
    const saved = localStorage.getItem('synapse_cash_inflows');
    return saved ? JSON.parse(saved) : INITIAL_INFLOWS;
  });

  // CheckIn Logs
  const [checkInLogs, setCheckInLogs] = useState<CheckInLog[]>(() => {
    const saved = localStorage.getItem('synapse_checkin_logs');
    return saved ? JSON.parse(saved) : INITIAL_CHECKIN_LOGS;
  });

  // Settlement Logs
  const [settlementLogs, setSettlementLogs] = useState<SettlementLog[]>(() => {
    const saved = localStorage.getItem('synapse_settlement_logs');
    return saved ? JSON.parse(saved) : [];
  });

  // Trainer Transactions (Unified Master Ledger)
  const [trainerTransactions, setTrainerTransactions] = useState<TrainerTransaction[]>(() => {
    const saved = localStorage.getItem('synapse_trainer_transactions');
    return saved ? JSON.parse(saved) : INITIAL_TRAINER_TRANSACTIONS;
  });

  // Comprehensive Master Report
  const [masterReportEntries, setMasterReportEntries] = useState<MasterReportEntry[]>(() => {
    const saved = localStorage.getItem('synapse_master_report');
    return saved ? JSON.parse(saved) : INITIAL_MASTER_ENTRIES;
  });

  // Billing Cycles
  const [billingCycles, setBillingCycles] = useState<MonthlyBillingCycle[]>(() => {
    const saved = localStorage.getItem('synapse_billing_cycles');
    return saved ? JSON.parse(saved) : INITIAL_BILLING_CYCLES;
  });

  // Current Month
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    const saved = localStorage.getItem('synapse_current_month');
    return saved ? saved : 'أكتوبر 2026';
  });

  // Persistence effects
  useEffect(() => {
    localStorage.setItem('synapse_members', JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    localStorage.setItem('synapse_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('synapse_coaches', JSON.stringify(coaches));
  }, [coaches]);

  useEffect(() => {
    localStorage.setItem('synapse_physio', JSON.stringify(physioBookings));
  }, [physioBookings]);

  useEffect(() => {
    localStorage.setItem('synapse_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('synapse_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('synapse_expenses', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem('synapse_cash_inflows', JSON.stringify(cashInflows));
  }, [cashInflows]);

  useEffect(() => {
    localStorage.setItem('synapse_checkin_logs', JSON.stringify(checkInLogs));
  }, [checkInLogs]);

  useEffect(() => {
    localStorage.setItem('synapse_settlement_logs', JSON.stringify(settlementLogs));
  }, [settlementLogs]);

  useEffect(() => {
    localStorage.setItem('synapse_trainer_transactions', JSON.stringify(trainerTransactions));
  }, [trainerTransactions]);

  useEffect(() => {
    localStorage.setItem('synapse_master_report', JSON.stringify(masterReportEntries));
  }, [masterReportEntries]);

  useEffect(() => {
    localStorage.setItem('synapse_billing_cycles', JSON.stringify(billingCycles));
  }, [billingCycles]);

  useEffect(() => {
    localStorage.setItem('synapse_current_month', currentMonth);
  }, [currentMonth]);

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
          const fee = Math.round((elapsedMinutes / 60) * booking.hourlyRate * 10) / 10;
          const extra = booking.extraFee || 0;
          return {
            ...booking,
            elapsedMinutes,
            totalFee: Math.max(booking.hourlyRate * 0.25, fee) + extra,
          };
        })
      );
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Members logic
  const addMember = (memberData: Omit<Member, 'id'>) => {
    const newMember: Member = {
      ...memberData,
      id: `mem-${Date.now()}`,
    };
    setMembers((prev) => [newMember, ...prev]);

    const fee = memberData.subscriptionFee || 0;
    const coach = coaches.find(
      (c) => c.id === memberData.collectedByCoachId || c.id === memberData.assignedTrainerId
    );
    const coachName = coach ? coach.name : 'الكابتن';

    // AUTOMATIC FINANCIAL ROUTING: Cash Drawer vs Coach Debt vs InstaPay
    if (fee > 0) {
      if (memberData.paymentMethod === 'coach_collected') {
        // Player paid the Coach directly -> Gym Receivable from Coach (عليه فلوس للجيم)!
        if (coach) {
          const newTrx: TrainerTransaction = {
            transaction_id: `TRX-${Math.floor(1000 + Math.random() * 9000)}`,
            coach_id: coach.id,
            coach_name: coach.name,
            amount: fee,
            collected_by: 'coach',
            payer_type: `اشتراك لاعب (${newMember.subscriptionPlan})`,
            payer_name: newMember.name,
            gym_share: fee, // Gym's membership fee owed by the coach
            coach_share: 0,
            status: 'pending',
            created_at: new Date().toISOString(),
            payment_method: 'cash',
            notes: `اشتراك تم تحصيله بواسطة الكابتن ${coach.name} - مديونية لحين توريد الكابتن للجيم`,
          };
          setTrainerTransactions((prev) => [newTrx, ...prev]);
        }

        // Auto add to Master Report
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
          paymentStatus: 'pending_on_coach',
          notes: `محصل مع الكابتن ${coachName} - مطلوب توريده للجيم`,
          sourceType: 'subscription',
        };
        setMasterReportEntries((prev) => [newEntry, ...prev]);
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

    return newMember;
  };

  const updateMember = (id: string, updates: Partial<Member>) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
    );
  };

  const toggleMemberAsDoctor = (id: string) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const newType = m.type === 'doctor' ? 'member' : 'doctor';
          return { ...m, type: newType };
        }
        return m;
      })
    );
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

  const performCheckIn = (memberId: string, method: 'qr' | 'manual' = 'qr') => {
    const member = members.find((m) => m.id === memberId);
    if (!member) {
      return { success: false, message: 'عضو غير موجود' };
    }

    const hasDays = member.remainingDays > 0;
    const hasSessions = member.remainingSessions > 0;
    const isValid = member.active && (hasDays || hasSessions);

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
  };

  const updateSession = (id: string, updates: Partial<GymSession>) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const deleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const assignPlayerToSession = (sessionId: string, memberId: string, isTemporary = false) => {
    setSessions((prev) =>
      prev.map((s) => {
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
      })
    );
    if (!isTemporary) {
      updateMember(memberId, { assignedSessionId: sessionId });
    }
  };

  const removePlayerFromSession = (sessionId: string, memberId: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === sessionId) {
          return {
            ...s,
            enrolledPlayerIds: s.enrolledPlayerIds.filter((id) => id !== memberId),
            temporaryPlayerIds: (s.temporaryPlayerIds || []).filter((id) => id !== memberId),
          };
        }
        return s;
      })
    );
    updateMember(memberId, { assignedSessionId: undefined });
  };

  const toggleSessionCoachCompletion = (sessionId: string, coachId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    const coach = coaches.find((c) => c.id === coachId);
    if (!session || !coach) return;

    const currentStatus = !!session.completedTodayByCoach?.[coachId];
    const newStatus = !currentStatus;

    const attendeesCount = Math.max(
      1,
      session.enrolledPlayerIds.length + (session.temporaryPlayerIds?.length || 0)
    );
    const sessionTotalRev = attendeesCount * session.price;

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === sessionId) {
          return {
            ...s,
            completedTodayByCoach: {
              ...(s.completedTodayByCoach || {}),
              [coachId]: newStatus,
            },
          };
        }
        return s;
      })
    );

    if (newStatus) {
      // 1. FULL SESSION CHARGE ON COACH (مديونية للجيم عند المدرب / تحميل كامل)
      const newTrx: TrainerTransaction = {
        transaction_id: `TRX-SESS-${Date.now()}`,
        coach_id: coach.id,
        coach_name: coach.name,
        amount: sessionTotalRev,
        collected_by: 'coach',
        payer_type: `حصة ${session.title}`,
        payer_name: `${attendeesCount} متدربين (${session.sport})`,
        gym_share: sessionTotalRev,
        coach_share: 0,
        status: 'pending',
        created_at: new Date().toISOString(),
        month: currentMonth,
        type: 'session_charge',
        payment_method: 'coach_collected',
        notes: `تحميل قيمة الحصة بالكامل (${attendeesCount} متدربين × ${session.price} ج.م) على كابتن ${coach.name}`,
      };
      setTrainerTransactions((prev) => [newTrx, ...prev]);

      // 2. Automatically log to Cash Drawer & Expenses page
      const inflowRecord: CashInflowItem = {
        id: `inf-cch-${Date.now()}`,
        type: 'coach_settlement',
        title: `تحميل على كابتن ${coach.name} مبلغ ${sessionTotalRev} ج.م (حصة: ${session.title}) اليوم`,
        amount: sessionTotalRev,
        date: new Date().toISOString(),
        memberName: coach.name,
        paymentMethod: 'cash',
        recordedBy: 'السيستم التلقائي',
      };
      setCashInflows((prev) => [inflowRecord, ...prev]);

      // 3. Automatically add to Master Report
      const allPlayerIds = [
        ...session.enrolledPlayerIds,
        ...(session.temporaryPlayerIds || []),
      ];
      const targetPids = allPlayerIds.length > 0 ? allPlayerIds : ['mem-sample'];
      const repEntries: MasterReportEntry[] = targetPids.map((pid, idx) => {
        const playerObj = members.find((m) => m.id === pid);
        return {
          id: `rep-sess-${Date.now()}-${idx}`,
          month: currentMonth,
          date: new Date().toISOString(),
          playerName: playerObj ? playerObj.name : `متدرب (${idx + 1})`,
          playerCode:
            playerObj ? playerObj.code : `SYN-${Math.floor(100 + Math.random() * 900)}`,
          amount: session.price,
          coachId: coach.id,
          coachName: coach.name,
          sessionCategory: session.sessionCategory || 'group',
          sessionTitle: session.title,
          paymentMethod: 'coach_collected',
          paymentStatus: 'pending_on_coach',
          notes: `تحميل على كابتن ${coach.name}`,
          sourceType: 'session',
        };
      });
      setMasterReportEntries((prev) => [...repEntries, ...prev]);
    } else {
      // Revert matching pending charge
      setTrainerTransactions((prev) =>
        prev.filter(
          (t) =>
            !(
              t.coach_id === coach.id &&
              t.type === 'session_charge' &&
              t.payer_type.includes(session.title)
            )
        )
      );
      setCashInflows((prev) =>
        prev.filter(
          (inf) =>
            !(
              inf.memberName === coach.name &&
              inf.title.includes(session.title)
            )
        )
      );
    }
  };

  // Coach logic & Automatic Expense Logging on Settlement!
  const addCoach = (coachData: Omit<Coach, 'id' | 'currentBalance' | 'totalPaidToday'>) => {
    const newCoach: Coach = {
      ...coachData,
      id: `cch-${Date.now()}`,
      currentBalance: 0,
      totalPaidToday: 0,
    };
    setCoaches((prev) => [...prev, newCoach]);
  };

  const updateCoach = (id: string, updates: Partial<Coach>) => {
    setCoaches((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
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

    return { success: true, settledAmount: settled };
  };

  // AUTOMATIC HOOK 2: Pay Monthly Salary for monthly coach and log in Expenses!
  const payMonthlySalary = (coachId: string, adminUsername: string) => {
    const coach = coaches.find((c) => c.id === coachId);
    if (!coach || coach.paymentType !== 'monthly' || !coach.monthlySalary) {
      return { success: false, salaryAmount: 0 };
    }

    const salary = coach.monthlySalary;

    setCoaches((prev) =>
      prev.map((c) =>
        c.id === coachId
          ? {
              ...c,
              monthlySalaryPaidThisMonth: true,
              lastSalaryPaymentDate: new Date().toISOString().slice(0, 10),
              totalPaidToday: c.totalPaidToday + salary,
            }
          : c
      )
    );

    // Log expense
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
    setExpenses((prev) => [autoExpense, ...prev]);

    return { success: true, salaryAmount: salary };
  };

  // Physio & Massage logic
  const startPhysioSession = (data: {
    doctorName: string;
    doctorCode: string;
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
    return newBooking;
  };

  const beginPhysioSession = (id: string) => {
    setPhysioBookings((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              status: 'active',
              startTime: new Date().toISOString(),
              elapsedMinutes: 1,
            }
          : b
      )
    );
  };

  const finishPhysioSession = (id: string) => {
    setPhysioBookings((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              status: 'completed',
              endTime: new Date().toISOString(),
              isPaused: false,
            }
          : b
      )
    );
  };

  const completePhysioSession = (id: string) => {
    finishPhysioSession(id);
  };

  const addExtraFeeToPhysio = (id: string, extraAmount: number, reason?: string) => {
    setPhysioBookings((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const currentExtra = b.extraFee || 0;
        const newExtra = currentExtra + extraAmount;
        return {
          ...b,
          extraFee: newExtra,
          totalFee: b.totalFee + extraAmount,
          extraFeeReason: reason || b.extraFeeReason || 'تكلفة وقت إضافي (تجاوز الساعة)',
        };
      })
    );
  };

  const pausePhysioSession = (id: string) => {
    setPhysioBookings((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              isPaused: true,
              pausedAt: new Date().toISOString(),
              status: 'paused',
            }
          : b
      )
    );
  };

  const resumePhysioSession = (id: string) => {
    setPhysioBookings((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const pausedAtTime = b.pausedAt ? new Date(b.pausedAt).getTime() : Date.now();
        const pauseDurationSec = Math.round((Date.now() - pausedAtTime) / 1000);
        return {
          ...b,
          isPaused: false,
          pausedAt: undefined,
          status: 'active',
          totalPausedSeconds: (b.totalPausedSeconds || 0) + pauseDurationSec,
        };
      })
    );
  };

  const billPhysioSession = (
    id: string,
    billingData: {
      billedTo: 'patient' | 'doctor' | 'coach';
      paymentMethod: 'cash' | 'instapay' | 'coach_debt';
      instapayRef?: string;
      chargedToCoachId?: string;
      notes?: string;
    }
  ) => {
    const booking = physioBookings.find((b) => b.id === id);
    if (!booking) return;

    setPhysioBookings((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              status: 'completed',
              endTime: new Date().toISOString(),
              isPaused: false,
              billedTo: billingData.billedTo,
              paymentMethod: billingData.paymentMethod,
              instapayRef: billingData.instapayRef,
              chargedToCoachId: billingData.chargedToCoachId,
              paid: billingData.paymentMethod !== 'coach_debt',
              notes: billingData.notes,
            }
          : b
      )
    );

    // If paid cash -> record to Cash Drawer
    if (billingData.paymentMethod === 'cash') {
      const inflow: CashInflowItem = {
        id: `inf-phy-${Date.now()}`,
        type: 'physio',
        title: `إيراد جلسة علاج طبيعي (${booking.roomName}) - ${booking.doctorName}`,
        amount: booking.totalFee,
        date: new Date().toISOString(),
        memberName: booking.patientName,
        paymentMethod: 'cash',
        recordedBy: 'الاستقبال',
      };
      setCashInflows((prev) => [inflow, ...prev]);
    } else if (billingData.paymentMethod === 'instapay') {
      const inflow: CashInflowItem = {
        id: `inf-phy-${Date.now()}`,
        type: 'physio',
        title: `تحويل انستاباي جلسة علاج طبيعي (${booking.roomName}) - كود: ${billingData.instapayRef || 'N/A'}`,
        amount: booking.totalFee,
        date: new Date().toISOString(),
        memberName: booking.patientName,
        paymentMethod: 'instapay',
        recordedBy: 'الاستقبال',
      };
      setCashInflows((prev) => [inflow, ...prev]);
    } else if (billingData.paymentMethod === 'coach_debt') {
      // SMART SYSTEM: Automatically charge to coach/doctor balance as receivable (عليه فلوس للجيم)!
      const targetCoach =
        coaches.find((c) => c.id === billingData.chargedToCoachId) ||
        coaches.find((c) => c.name.includes(booking.doctorName)) ||
        coaches[0];

      if (targetCoach) {
        const newTrx: TrainerTransaction = {
          transaction_id: `TRX-${Math.floor(1000 + Math.random() * 9000)}`,
          coach_id: targetCoach.id,
          coach_name: targetCoach.name,
          amount: booking.totalFee,
          collected_by: 'coach',
          payer_type: `جلسة علاج طبيعي (${booking.roomName}) - مريض: ${booking.patientName}`,
          payer_name: booking.patientName,
          gym_share: booking.totalFee,
          coach_share: 0,
          status: 'pending',
          created_at: new Date().toISOString(),
          payment_method: 'cash',
          notes: `تحميل مديونية علاج طبيعي على حساب الدكتور/الكابتن ${targetCoach.name} - تسدد بنهاية الشهر`,
        };
        setTrainerTransactions((prev) => [newTrx, ...prev]);
      }
    }

    // Auto record into Master Report!
    const repCoach = coaches.find((c) => c.id === billingData.chargedToCoachId);
    const newEntry: MasterReportEntry = {
      id: `rep-${Date.now()}`,
      month: currentMonth,
      date: new Date().toISOString(),
      playerName: booking.patientName,
      playerCode: booking.patientCode || 'PHY-PATIENT',
      amount: booking.totalFee,
      coachId: billingData.chargedToCoachId,
      coachName: repCoach ? repCoach.name : booking.doctorName,
      sessionCategory: 'physio',
      sessionTitle: `جلسة علاج طبيعي (${booking.roomName})`,
      paymentMethod: billingData.paymentMethod === 'coach_debt' ? 'coach_collected' : billingData.paymentMethod,
      paymentStatus: billingData.paymentMethod === 'coach_debt' ? 'pending_on_coach' : 'paid',
      notes: billingData.notes || `حساب: ${billingData.billedTo === 'patient' ? 'اللاعب' : 'الكوتش/الدكتور'}`,
      sourceType: 'physio',
    };
    setMasterReportEntries((prev) => [newEntry, ...prev]);
  };

  const assignArrivedMember = (
    checkInLogId: string,
    category: SessionCategory,
    coachId: string,
    sessionId?: string,
    notes?: string,
    paymentDetails?: {
      paymentMode: 'coach_charge' | 'cash_drawer' | 'instapay';
      amount: number;
      roomName?: string;
    }
  ) => {
    const coach = coaches.find((c) => c.id === coachId);
    const coachName = coach ? coach.name : 'الكابتن';
    const log = checkInLogs.find((l) => l.id === checkInLogId);
    const member = members.find((m) => m.id === log?.memberId);
    const matchingSession = sessionId
      ? sessions.find((s) => s.id === sessionId)
      : sessions.find((s) => s.coachIds.includes(coachId));

    const paymentMode = paymentDetails?.paymentMode || 'coach_charge';

    // Compute fee amount
    let feeAmount = paymentDetails?.amount;
    if (feeAmount === undefined || feeAmount <= 0) {
      if (category === 'massage') {
        feeAmount = coach?.ratePerSession || 180;
      } else if (category === 'physio') {
        feeAmount = 150;
      } else if (matchingSession) {
        feeAmount = matchingSession.price || 100;
      } else if (category === 'private') {
        feeAmount = coach?.ratePerSession || 200;
      } else {
        feeAmount = 80;
      }
    }

    const activityTitle =
      category === 'massage'
        ? 'جلسة مساج واستشفاء'
        : category === 'physio'
        ? 'جلسة علاج طبيعي'
        : matchingSession?.title || (category === 'private' ? 'تدريب خاص (Private PT)' : 'تمرين جيم عام');

    // 1. Update CheckIn Log with seating details & payment status
    setCheckInLogs((prev) =>
      prev.map((l) =>
        l.id === checkInLogId
          ? {
              ...l,
              seatingStatus: 'assigned',
              assignedCategory: category,
              assignedCoachId: coachId,
              assignedCoachName: coachName,
              assignedSessionId: sessionId || matchingSession?.id,
              assignedSessionTitle: activityTitle,
              paymentMode,
              chargedAmount: feeAmount,
            }
          : l
      )
    );

    if (!member) return;

    // 2. FINANCIAL FLOW: Charge to Coach vs Cash to Drawer
    if (paymentMode === 'coach_charge') {
      // Flow A: تحميل على المدرب (مديونية مستحقة على الكابتن للجيم)
      const newTrx: TrainerTransaction = {
        transaction_id: `TRX-${Date.now()}`,
        coach_id: coachId,
        coach_name: coachName,
        amount: feeAmount,
        collected_by: 'coach',
        payer_type: `تسكين ${activityTitle}`,
        payer_name: member.name,
        gym_share: feeAmount, // full session charge in boutique gym model
        coach_share: 0,
        status: 'pending',
        created_at: new Date().toISOString(),
        month: currentMonth,
        type: category === 'massage' || category === 'physio' ? 'physio_charge' : 'session_charge',
        payment_method: 'coach_collected',
        notes: `تحميل تسكين اللاعب ${member.name} (${member.code}) على كابتن ${coachName}`,
      };
      setTrainerTransactions((prev) => [newTrx, ...prev]);

      // Automatically register to Cash Drawer & Expenses list as debt notice
      const inflowRecord: CashInflowItem = {
        id: `inf-cch-${Date.now()}`,
        type: 'coach_settlement',
        title: `تحميل على كابتن ${coachName} مبلغ ${feeAmount} ج.م (تسكين: ${member.name} - ${activityTitle}) اليوم`,
        amount: feeAmount,
        date: new Date().toISOString(),
        memberName: coachName,
        paymentMethod: 'cash',
        recordedBy: 'الاستقبال',
      };
      setCashInflows((prev) => [inflowRecord, ...prev]);

      // Automatically add to Master Report with status: تحميل
      const repEntry: MasterReportEntry = {
        id: `rep-seat-${Date.now()}`,
        month: currentMonth,
        date: new Date().toISOString(),
        playerName: member.name,
        playerCode: member.code,
        amount: feeAmount,
        coachId: coachId,
        coachName: coachName,
        sessionCategory: category,
        sessionTitle: activityTitle,
        paymentMethod: 'coach_collected',
        paymentStatus: 'pending_on_coach',
        notes: `تحميل تسكين على كابتن ${coachName}`,
        sourceType: category === 'massage' || category === 'physio' ? 'physio' : 'session',
      };
      setMasterReportEntries((prev) => [repEntry, ...prev]);
    } else if (paymentMode === 'cash_drawer') {
      // Flow B: دفع نقدي (كاش بالدرج) -> يذهب فوراً لصفحة المصاريف وإدارة الدرج
      const cashInflowItem: CashInflowItem = {
        id: `inf-seat-${Date.now()}`,
        type: category === 'massage' || category === 'physio' ? 'physio' : 'subscription',
        title: `تحصيل كاش بالاستقبال - تسكين ${member.name} (${activityTitle})`,
        amount: feeAmount,
        date: new Date().toISOString(),
        memberName: member.name,
        paymentMethod: 'cash',
        recordedBy: 'الاستقبال',
      };
      setCashInflows((prev) => [cashInflowItem, ...prev]);

      // Add to Master Report as Direct Subscription / Immediate Cash at the top
      const repEntry: MasterReportEntry = {
        id: `rep-seat-${Date.now()}`,
        month: currentMonth,
        date: new Date().toISOString(),
        playerName: member.name,
        playerCode: member.code,
        amount: feeAmount,
        coachId: coachId,
        coachName: coachName || 'اشتراك عام بالخزينة',
        sessionCategory: category,
        sessionTitle: `${activityTitle} (سداد فوري كاش بالدرج)`,
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        notes: `سداد فوري كاش بالاستقبال (مورد للدرج)`,
        sourceType: category === 'massage' || category === 'physio' ? 'physio' : 'session',
      };
      setMasterReportEntries((prev) => [repEntry, ...prev]);
    } else if (paymentMode === 'instapay') {
      // Flow C: إنستاباي
      const instaInflow: CashInflowItem = {
        id: `inf-seat-insta-${Date.now()}`,
        type: category === 'massage' || category === 'physio' ? 'physio' : 'subscription',
        title: `تحصيل إنستاباي بالاستقبال - تسكين ${member.name} (${activityTitle})`,
        amount: feeAmount,
        date: new Date().toISOString(),
        memberName: member.name,
        paymentMethod: 'instapay',
        recordedBy: 'الاستقبال',
      };
      setCashInflows((prev) => [instaInflow, ...prev]);

      const repEntry: MasterReportEntry = {
        id: `rep-seat-${Date.now()}`,
        month: currentMonth,
        date: new Date().toISOString(),
        playerName: member.name,
        playerCode: member.code,
        amount: feeAmount,
        coachId: coachId,
        coachName: coachName,
        sessionCategory: category,
        sessionTitle: `${activityTitle} (تحويل إنستاباي)`,
        paymentMethod: 'instapay',
        paymentStatus: 'paid',
        notes: `مسدد عبر إنستاباي`,
        sourceType: category === 'massage' || category === 'physio' ? 'physio' : 'session',
      };
      setMasterReportEntries((prev) => [repEntry, ...prev]);
    }

    // 3. Perform Placement into Target Module (Massage, Physio, or Session)
    if (category === 'massage') {
      const newMassage: PhysioBooking = {
        id: `massage-${Date.now()}`,
        doctorName: coachName,
        doctorCode: coach?.id || 'CCH',
        patientName: member.name,
        patientCode: member.code,
        roomName: paymentDetails?.roomName || 'غرفة المساج والاستشفاء 1',
        hourlyRate: feeAmount,
        startTime: new Date().toISOString(),
        elapsedMinutes: 0,
        totalFee: feeAmount,
        serviceType: 'massage',
        status: 'waiting',
        paid: paymentMode !== 'coach_charge',
        billedTo: paymentMode === 'coach_charge' ? 'coach' : 'patient',
        chargedToCoachId: paymentMode === 'coach_charge' ? coachId : undefined,
        paymentMethod: paymentMode === 'coach_charge' ? 'coach_debt' : paymentMode === 'cash_drawer' ? 'cash' : 'instapay',
        notes: notes || (paymentMode === 'coach_charge' ? `تحميل على كابتن ${coachName}` : 'مسدد بالاستقبال'),
      };
      setPhysioBookings((prev) => [newMassage, ...prev]);
    } else if (category === 'physio') {
      const newPhysio: PhysioBooking = {
        id: `physio-${Date.now()}`,
        doctorName: coachName,
        doctorCode: coach?.id || 'DOC',
        patientName: member.name,
        patientCode: member.code,
        roomName: paymentDetails?.roomName || 'عيادة التأهيل الطبي 1',
        hourlyRate: feeAmount,
        startTime: new Date().toISOString(),
        elapsedMinutes: 0,
        totalFee: feeAmount,
        serviceType: 'physio',
        status: 'waiting',
        paid: paymentMode !== 'coach_charge',
        billedTo: paymentMode === 'coach_charge' ? 'coach' : 'patient',
        chargedToCoachId: paymentMode === 'coach_charge' ? coachId : undefined,
        paymentMethod: paymentMode === 'coach_charge' ? 'coach_debt' : paymentMode === 'cash_drawer' ? 'cash' : 'instapay',
        notes: notes || (paymentMode === 'coach_charge' ? `تحميل على كابتن ${coachName}` : 'مسدد بالاستقبال'),
      };
      setPhysioBookings((prev) => [newPhysio, ...prev]);
    } else if (category === 'group' || category === 'private' || category === 'gym') {
      if (sessionId) {
        assignPlayerToSession(sessionId, member.id, true);
      } else if (matchingSession) {
        assignPlayerToSession(matchingSession.id, member.id, true);
      }
    }
  };

  // POS logic
  const addProduct = (prodData: Omit<POSProduct, 'id'>) => {
    const newProd: POSProduct = {
      ...prodData,
      id: `prod-${Date.now()}`,
    };
    setProducts((prev) => [...prev, newProd]);
  };

  const updateProduct = (id: string, updates: Partial<POSProduct>) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const deleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const processSale = (saleData: Omit<POSTransaction, 'id' | 'timestamp'>) => {
    const newTx: POSTransaction = {
      ...saleData,
      id: `tx-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };

    setProducts((prev) =>
      prev.map((p) => {
        const bought = saleData.items.find((item) => item.productId === p.id);
        if (bought) {
          return {
            ...p,
            stock: Math.max(0, p.stock - bought.quantity),
          };
        }
        return p;
      })
    );

    setTransactions((prev) => [newTx, ...prev]);

    // If sale was cash, log inflow to drawer
    if (saleData.paymentMethod === 'cash') {
      const inflow: CashInflowItem = {
        id: `inf-pos-${Date.now()}`,
        type: 'pos',
        title: `مبيعات كاش بالمتجر - فاتورة #${newTx.id.slice(-4)}`,
        amount: newTx.totalAmount,
        date: new Date().toISOString(),
        paymentMethod: 'cash',
        recordedBy: saleData.cashierName,
      };
      setCashInflows((prev) => [inflow, ...prev]);
    }

    return newTx;
  };

  // Expenses & Drawer Methods (Accounting for literally every single pound!)
  const addExpense = (expData: Omit<ExpenseItem, 'id' | 'date'>) => {
    const newExp: ExpenseItem = {
      ...expData,
      id: `exp-${Date.now()}`,
      date: new Date().toISOString(),
    };
    setExpenses((prev) => [newExp, ...prev]);
    return newExp;
  };

  const deleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const addCashInflow = (infData: Omit<CashInflowItem, 'id' | 'date'>) => {
    const newInf: CashInflowItem = {
      ...infData,
      id: `inf-${Date.now()}`,
      date: new Date().toISOString(),
    };
    setCashInflows((prev) => [newInf, ...prev]);
    return newInf;
  };

  // Manual cash movement (إيداع نقدي أو سحب شخصي من الدرج)
  const addManualCashMovement = (
    type: 'deposit' | 'withdrawal',
    amount: number,
    title: string,
    notes?: string
  ) => {
    if (type === 'deposit') {
      const inflow: CashInflowItem = {
        id: `inf-manual-${Date.now()}`,
        type: 'manual_deposit',
        title: title || 'إيداع نقدي إضافي بالخزينة',
        amount,
        date: new Date().toISOString(),
        paymentMethod: 'cash',
        recordedBy: 'المدير العام',
      };
      setCashInflows((prev) => [inflow, ...prev]);
    } else {
      const expense: ExpenseItem = {
        id: `exp-manual-${Date.now()}`,
        title: title || 'سحب نقدي / مسحوبات شخصية من الدرج',
        category: 'other',
        amount,
        date: new Date().toISOString(),
        notes,
        paymentMethod: 'cash',
        recordedBy: 'المدير العام',
      };
      setExpenses((prev) => [expense, ...prev]);
    }
  };

  // Calculate Net Cash Drawer ("صافي النقدية في الدرج بالجنيه - كل جنيه محسوب")
  const getDrawerStats = () => {
    const todayStr = new Date().toISOString().slice(0, 10);

    // Only Cash items affect the physical cash drawer
    const totalCashIn = cashInflows
      .filter((inf) => inf.paymentMethod === 'cash')
      .reduce((acc, inf) => acc + inf.amount, 0);

    const totalCashOut = expenses
      .filter((exp) => exp.paymentMethod === 'cash')
      .reduce((acc, exp) => acc + exp.amount, 0);

    const netCashInDrawer = totalCashIn - totalCashOut;

    // Today's movements
    const todayCashIn = cashInflows
      .filter((inf) => inf.paymentMethod === 'cash' && inf.date.startsWith(todayStr))
      .reduce((acc, inf) => acc + inf.amount, 0);

    const todayCashOut = expenses
      .filter((exp) => exp.paymentMethod === 'cash' && exp.date.startsWith(todayStr))
      .reduce((acc, exp) => acc + exp.amount, 0);

    const todayNetInDrawer = todayCashIn - todayCashOut;

    // InstaPay Ledger Total
    const totalInstapayIn = cashInflows
      .filter((inf) => inf.paymentMethod === 'instapay')
      .reduce((acc, inf) => acc + inf.amount, 0);

    // Total Pending Receivables on Coaches (فلوس عند الكباتن مستحقة للجيم)
    const pendingTrx = trainerTransactions.filter((t) => t.status === 'pending');
    const totalPendingOnCoaches = pendingTrx
      .filter((t) => t.collected_by === 'coach')
      .reduce((acc, t) => acc + t.gym_share, 0);

    return {
      totalCashIn,
      totalCashOut,
      netCashInDrawer,
      todayCashIn,
      todayCashOut,
      todayNetInDrawer,
      totalInstapayIn,
      totalPendingOnCoaches,
    };
  };

  // Overall Stats
  const getTodayStats = () => {
    const todayStr = new Date().toISOString().slice(0, 10);

    const checkInsToday = checkInLogs.filter((c) =>
      c.timestamp.startsWith(todayStr)
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

  const repayCoachDebt = (
    coachId: string,
    amount: number,
    paymentMethod: 'cash' | 'instapay' = 'cash',
    notes?: string,
    authorizedBy = 'الاستقبال'
  ) => {
    const coach = coaches.find((c) => c.id === coachId);
    if (!coach || amount <= 0) return { success: false, repaidAmount: 0 };

    // Record repayment in Trainer Transactions
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
      created_at: new Date().toISOString(),
      settled_at: new Date().toISOString(),
      settled_by: authorizedBy,
      month: currentMonth,
      type: 'coach_repayment',
      payment_method: paymentMethod,
      notes: notes || `سداد ${amount} ج.م من المديونية المستحقة على كابتن ${coach.name}`,
    };

    // Update pending receivable transactions if available
    let remaining = amount;
    setTrainerTransactions((prev) => {
      const updated = prev.map((t) => {
        if (
          t.coach_id === coachId &&
          t.collected_by === 'coach' &&
          t.status === 'pending' &&
          remaining > 0
        ) {
          if (remaining >= t.gym_share) {
            remaining -= t.gym_share;
            return {
              ...t,
              status: 'settled' as const,
              settled_at: new Date().toISOString(),
              settled_by: authorizedBy,
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
      return [repaymentTrx, ...updated];
    });

    // Automatically record into Cash Inflow / Cash Drawer
    const inflowItem: CashInflowItem = {
      id: `inf-cch-rep-${Date.now()}`,
      type: 'coach_settlement',
      title: `إيداع سداد تحميل - كابتن ${coach.name}`,
      amount: amount,
      date: new Date().toISOString(),
      memberName: coach.name,
      paymentMethod: paymentMethod,
      recordedBy: authorizedBy,
    };
    setCashInflows((prev) => [inflowItem, ...prev]);

    return { success: true, repaidAmount: amount };
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
    const currentMonthPending = allCoachTrx
      .filter(
        (t) =>
          t.collected_by === 'coach' &&
          t.status === 'pending' &&
          (isAll || t.month === targetMonth || (!t.month && targetMonth === currentMonth))
      )
      .reduce((sum, t) => sum + t.gym_share, 0);

    // Total outstanding debt = previous carried debt + current month pending
    const remainingTotalDebt = previousCarriedDebt + currentMonthPending;

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
  };

  const updateMasterReportEntry = (id: string, updates: Partial<MasterReportEntry>) => {
    setMasterReportEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
    );
  };

  const deleteMasterReportEntry = (id: string) => {
    setMasterReportEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const startNewMonth = (newMonthName: string) => {
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
      startDate: new Date().toISOString(),
      isActive: true,
      totalCollected: 0,
      totalPendingOnCoaches: 0,
    };
    setBillingCycles((prev) => [newCycle, ...prev]);

    // 3. Set current active month
    setCurrentMonth(newMonthName);
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

  return (
    <GymDataContext.Provider
      value={{
        members,
        addMember,
        updateMember,
        toggleMemberAsDoctor,
        findMemberByCode,
        performCheckIn,
        sessions,
        addSession,
        updateSession,
        deleteSession,
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
        getCoachMonthlyBreakdown,
        masterReportEntries,
        billingCycles,
        currentMonth,
        setCurrentMonth,
        addMasterReportEntry,
        updateMasterReportEntry,
        deleteMasterReportEntry,
        startNewMonth,
        exportMasterReportToCSV,
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
