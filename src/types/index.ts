// Types for Synapse Gym SaaS

export type UserRole = 'admin' | 'receptionist';

export interface User {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: UserRole;
  phone?: string;
  createdAt: string;
  active: boolean;
}

export type MemberType = 'member' | 'doctor';
export type SessionCategory = 'private' | 'group' | 'physio' | 'massage' | 'gym';

export interface Member {
  id: string;
  code: string; // 6-digit numeric ID, e.g. '102938'
  name: string;
  phone: string;
  photoUrl?: string;
  type: MemberType;
  subscriptionPlan: string;
  subscriptionFee?: number; // Subscription price in EGP for cash drawer
  paymentMethod?: 'cash' | 'instapay' | 'coach_collected'; // التحصيل: كاش بالجيم أم مع الكابتن أم انستاباي
  collectedByCoachId?: string; // إذا كان الحساب على الكابتن
  paymentStatus?: 'paid' | 'pending_on_coach' | 'unpaid'; // حالة السداد
  sessionCategory?: SessionCategory; // نوع السيشن: برايفت، جروب، علاج طبيعي، جيم
  startDate: string;
  endDate: string;
  totalDays: number;
  remainingDays: number;
  totalSessions: number;
  remainingSessions: number;
  active: boolean;
  assignedSessionId?: string; // For persistent class assignment
  assignedTrainerId?: string;
  notes?: string;
}

export type CoachContractType = 'monthly' | 'percentage' | 'per_session' | 'daily';

export interface Coach {
  id: string;
  name: string;
  phone: string;
  specialty: string;
  paymentType: CoachContractType; // Single Source of Truth Contract Type
  ratePerSession?: number; // Fixed trainer fee per session in EGP (أجر المدرب الثابت للحصة)
  monthlySalary?: number; // Fixed monthly salary in EGP (الراتب الشهري الثابت)
  commissionRate?: number; // Trainer percentage commission in % (نسبة عمولة المدرب)
  currentBalance: number; // "ليه كام"
  totalPaidToday: number;
  monthlySalaryPaidThisMonth?: boolean;
  lastSalaryPaymentDate?: string;
  active: boolean;
}

export interface SessionPlayer {
  id: string;
  memberId: string;
  memberName: string;
  memberCode: string;
  attendedToday: boolean;
  isPhysio: boolean;
  isTemporary?: boolean; // تسكين مؤقت لليوم فقط
}

export interface GymSession {
  id: string;
  title: string;
  sport: string;
  hall: string; // القاعة
  coachIds: string[]; // 1 or 2 coaches
  sessionCategory?: SessionCategory; // نوع السيشن: برايفت، جروب، مساج، إلخ
  price: number; // سعر تذكرة العميل / المتدرب للحصة (Client Ticket Price)
  startTime: string; // e.g. "17:00"
  endTime: string; // e.g. "18:30"
  daysOfWeek: number[]; // 0=Sunday, 1=Monday...
  enrolledPlayerIds: string[]; // Persistent players (تسكين دائم)
  temporaryPlayerIds?: string[]; // Temporary drop-in players for today (تسكين مؤقت)
  completedTodayByCoach?: { [coachId: string]: boolean }; // Checkboxes for coach pay
  notes?: string;
}

export interface PhysioBooking {
  id: string;
  doctorName: string;
  doctorCode: string;
  doctorPhone?: string;
  patientName: string;
  patientCode?: string;
  roomName: string;
  hourlyRate: number; // EGP/hour
  startTime: string; // ISO
  endTime?: string;
  elapsedMinutes: number;
  totalFee: number;
  extraFee?: number; // تكلفة يدوية إضافية إذا تجاوزوا الساعة
  extraFeeReason?: string;
  serviceType?: 'physio' | 'massage'; // علاج طبيعي أم مساج واستشفاء
  status: 'waiting' | 'active' | 'paused' | 'completed' | 'cancelled';
  isPaused?: boolean;
  pausedAt?: string;
  totalPausedSeconds?: number;
  billedTo?: 'patient' | 'doctor' | 'coach';
  paymentMethod?: 'cash' | 'instapay' | 'coach_debt';
  instapayRef?: string;
  chargedToCoachId?: string;
  paid: boolean;
  notes?: string;
}

export interface POSProduct {
  id: string;
  name: string;
  category: 'supplements' | 'drinks' | 'apparel' | 'snacks' | 'other';
  buyPrice: number;
  sellPrice: number;
  stock: number;
  barcode?: string;
  image?: string;
}

export interface POSTransactionItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  totalPrice: number;
}

export interface POSTransaction {
  id: string;
  items: POSTransactionItem[];
  totalAmount: number;
  totalCost: number;
  profit: number;
  paymentMethod: 'cash' | 'card' | 'instapay';
  timestamp: string;
  cashierName: string;
}

export interface CheckInLog {
  id: string;
  memberId: string;
  memberName: string;
  memberCode: string;
  memberType: MemberType;
  timestamp: string;
  method: 'qr' | 'manual';
  subscriptionValid: boolean;
  seatingStatus?: 'unassigned' | 'assigned';
  assignedCategory?: SessionCategory;
  assignedCoachId?: string;
  assignedCoachName?: string;
  assignedSessionId?: string;
  assignedSessionTitle?: string;
  paymentMode?: 'coach_charge' | 'cash_drawer' | 'instapay';
  chargedAmount?: number;
}

export interface SettlementLog {
  id: string;
  coachId: string;
  coachName: string;
  amount: number;
  timestamp: string;
  authorizedBy: string;
}

// UNIFIED TRANSACTIONS LEDGER (DUAL FINANCIAL FLOW ARCHITECTURE)
export type CollectedBy = 'gym' | 'coach';
export type TransactionStatus = 'pending' | 'settled';

export interface TrainerTransaction {
  transaction_id: string; // Unique identifier
  coach_id: string;
  coach_name: string;
  amount: number; // Total transaction amount
  collected_by: CollectedBy; // 'gym' (Flow 1: Gym-Centric) or 'coach' (Flow 2: Coach-Centric)
  payer_type: string; // Source details (e.g. 'حصة خاصة PT', 'اشتراك كلاس', 'دورة تدريبية')
  payer_name?: string; // Player name
  gym_share: number; // Automatically computed gym portion
  coach_share: number; // Automatically computed coach portion
  status: TransactionStatus; // 'pending' | 'settled'
  created_at: string;
  month?: string; // e.g. "أكتوبر 2026"
  type?: 'session_charge' | 'subscription_charge' | 'physio_charge' | 'coach_repayment' | 'salary_payout' | 'general';
  payment_method?: 'cash' | 'card' | 'instapay' | 'coach_collected';
  settled_at?: string;
  settled_by?: string;
  notes?: string;
}

// EXPENSE & CASH DRAWER TYPES
export type ExpenseCategory =
  | 'electricity'     // كهرباء
  | 'water'           // مياه
  | 'maintenance'     // صيانة
  | 'rent'            // إيجار المكان
  | 'trainer_payout'  // حسابات ورواتب المدربين (auto-deducted)
  | 'supplies'        // مشتريات ونظافة وأدوات
  | 'other';          // مصاريف نثرية وأخرى

export interface ExpenseItem {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  recordedBy: string;
  notes?: string;
  paymentMethod: 'cash' | 'card' | 'instapay';
  autoGenerated?: boolean; // True if automatically generated from coach settlement
  relatedEntityId?: string;
}

export interface CashInflowItem {
  id: string;
  type: 'subscription' | 'pos' | 'physio' | 'manual_deposit' | 'coach_settlement';
  title: string;
  amount: number;
  date: string;
  memberName?: string;
  paymentMethod: 'cash' | 'card' | 'instapay';
  recordedBy?: string;
}

// COMPREHENSIVE MASTER REPORT (EXCEL-LIKE SHEET) TYPES
export interface MasterReportEntry {
  id: string;
  month: string; // e.g. "أكتوبر 2026" or "2026-10"
  date: string; // ISO string
  playerName: string;
  playerCode: string;
  amount: number; // قيمة الاشتراك أو الحصة
  coachId?: string;
  coachName: string; // اسم الكابتن المسند
  sessionCategory: SessionCategory; // 'private' | 'group' | 'physio' | 'massage' | 'gym'
  sessionTitle?: string;
  paymentMethod: 'cash' | 'instapay' | 'card' | 'coach_collected'; // طريقة الدفع
  paymentStatus: 'paid' | 'pending_on_coach' | 'unpaid'; // حالة السداد
  notes?: string;
  sourceType: 'subscription' | 'session' | 'physio' | 'manual';
}

export interface MonthlyBillingCycle {
  id: string;
  name: string; // e.g. "أكتوبر 2026"
  startDate: string;
  closedDate?: string;
  isActive: boolean;
  totalCollected: number;
  totalPendingOnCoaches: number;
}
