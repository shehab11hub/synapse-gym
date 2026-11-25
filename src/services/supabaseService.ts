import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { withDbTimeout } from '../utils/network';
import {
  User,
  Member,
  Coach,
  GymSession,
  PhysioBooking,
  POSProduct,
  POSTransaction,
  CheckInLog,
  TrainerTransaction,
  ExpenseItem,
  CashInflowItem,
  MasterReportEntry,
  MonthlyBillingCycle,
  DailyShiftClosing,
  MonthlyArchive,
  YearlyArchive,
} from '../types';

async function execWithTimeout<T>(op: PromiseLike<T>): Promise<T> {
  return withDbTimeout(op);
}

export const supabaseService = {
  // ─── USERS ────────────────────────────────────────────────────
  async fetchUsers(): Promise<User[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase.from('users').select('*');
      if (error) return null;
      return (data || []).map((u: any) => ({
        id: u.id,
        username: u.username,
        password: u.password,
        name: u.name,
        role: u.role,
        phone: u.phone,
        createdAt: u.created_at,
        active: u.active,
      }));
    } catch {
      return null;
    }
  },

  async upsertUser(user: User): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { error } = await supabase.from('users').upsert({
        id: user.id,
        username: user.username,
        password: user.password,
        name: user.name,
        role: user.role,
        phone: user.phone,
        active: user.active,
        updated_at: new Date().toISOString(),
      });
      return !error;
    } catch {
      return false;
    }
  },

  async deleteUser(id: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { error } = await supabase.from('users').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  },

  // ─── MEMBERS ──────────────────────────────────────────────────
  async fetchMembers(): Promise<Member[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase.from('members').select('*');
      if (error) {
        console.error('Supabase fetchMembers error:', error);
        return null;
      }
      return (data || []).map((m: any) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        phone: m.phone,
        age: m.age ? Number(m.age) : undefined,
        residentialArea: m.residential_area || undefined,
        photoUrl: m.photo_url,
        type: m.type,
        subscriptionPlan: m.subscription_plan,
        subscriptionFee: Number(m.subscription_fee || 0),
        paymentMethod: m.payment_method,
        collectedByCoachId: m.collected_by_coach_id,
        paymentStatus: m.payment_status,
        sessionCategory: m.session_category,
        startDate: m.start_date,
        endDate: m.end_date,
        totalDays: m.total_days,
        remainingDays: m.remaining_days,
        totalSessions: m.total_sessions,
        remainingSessions: m.remaining_sessions,
        active: m.active,
        assignedSessionId: m.assigned_session_id,
        assignedTrainerId: m.assigned_trainer_id,
        notes: m.notes,
      }));
    } catch (e) {
      console.error('Supabase fetchMembers exception:', e);
      return null;
    }
  },

  async upsertMember(member: Member): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { error } = await execWithTimeout(supabase.from('members').upsert({
        id: member.id,
        code: member.code,
        name: member.name,
        phone: member.phone,
        age: member.age ?? null,
        residential_area: member.residentialArea ?? null,
        photo_url: member.photoUrl,
        type: member.type,
        subscription_plan: member.subscriptionPlan,
        subscription_fee: member.subscriptionFee ?? 0,
        payment_method: member.paymentMethod,
        collected_by_coach_id: member.collectedByCoachId,
        payment_status: member.paymentStatus,
        session_category: member.sessionCategory,
        start_date: member.startDate,
        end_date: member.endDate,
        total_days: member.totalDays,
        remaining_days: member.remainingDays,
        total_sessions: member.totalSessions,
        remaining_sessions: member.remainingSessions,
        active: member.active,
        assigned_session_id: member.assignedSessionId,
        assigned_trainer_id: member.assignedTrainerId,
        notes: member.notes,
        updated_at: new Date().toISOString(),
      }));
      return !error;
    } catch (e) {
      console.error('Supabase upsertMember exception:', e);
      return false;
    }
  },

  async deleteMember(id: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { error } = await supabase.from('members').delete().eq('id', id);
      return !error;
    } catch (e) {
      return false;
    }
  },

  // ─── COACHES ──────────────────────────────────────────────────
  async fetchCoaches(): Promise<Coach[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase.from('coaches').select('*');
      if (error) return null;
      return (data || []).map((c: any) => ({
        id: c.id,
        code: c.code || undefined,
        name: c.name,
        phone: c.phone,
        specialty: c.specialty,
        paymentType: c.payment_type,
        ratePerSession: Number(c.rate_per_session || 0),
        monthlySalary: Number(c.monthly_salary || 0),
        commissionRate: Number(c.commission_rate || 0),
        currentBalance: Number(c.current_balance || 0),
        totalPaidToday: Number(c.total_paid_today || 0),
        monthlySalaryPaidThisMonth: c.monthly_salary_paid_this_month,
        lastSalaryPaymentDate: c.last_salary_payment_date,
        active: c.active,
      }));
    } catch {
      return null;
    }
  },

  async upsertCoach(coach: Coach): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const payload: Record<string, any> = {
        id: coach.id,
        name: coach.name,
        phone: coach.phone,
        specialty: coach.specialty,
        payment_type: coach.paymentType,
        rate_per_session: coach.ratePerSession ?? 0,
        monthly_salary: coach.monthlySalary ?? 0,
        commission_rate: coach.commissionRate ?? 0,
        current_balance: coach.currentBalance ?? 0,
        total_paid_today: coach.totalPaidToday ?? 0,
        monthly_salary_paid_this_month: coach.monthlySalaryPaidThisMonth ?? false,
        last_salary_payment_date: coach.lastSalaryPaymentDate,
        active: coach.active,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('coaches').upsert({
        ...payload,
        ...(coach.code ? { code: coach.code } : {}),
      });
      if (error && coach.code) {
        // Fallback if 'code' column hasn't been added to Supabase yet
        const retry = await supabase.from('coaches').upsert(payload);
        return !retry.error;
      }
      return !error;
    } catch {
      return false;
    }
  },

  // ─── SESSIONS ─────────────────────────────────────────────────
  async fetchSessions(): Promise<GymSession[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase.from('gym_sessions').select('*');
      if (error) return null;
      return (data || []).map((s: any) => ({
        id: s.id,
        title: s.title,
        sport: s.sport,
        hall: s.hall,
        coachIds: s.coach_ids || [],
        sessionCategory: s.session_category,
        price: Number(s.price || 0),
        tier1Price: s.tier1_price !== undefined && s.tier1_price !== null ? Number(s.tier1_price) : Number(s.price || 0),
        tier2Price: s.tier2_price !== undefined && s.tier2_price !== null ? Number(s.tier2_price) : undefined,
        tier3Price: s.tier3_price !== undefined && s.tier3_price !== null ? Number(s.tier3_price) : undefined,
        startTime: s.start_time,
        endTime: s.end_time,
        status: s.status || 'idle',
        startedAt: s.started_at,
        endedAt: s.ended_at,
        daysOfWeek: s.days_of_week || [],
        enrolledPlayerIds: s.enrolled_player_ids || [],
        temporaryPlayerIds: s.temporary_player_ids || [],
        completedTodayByCoach: s.completed_today_by_coach || {},
        notes: s.notes,
      }));
    } catch {
      return null;
    }
  },

  async upsertSession(session: GymSession): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const basePayload = {
        id: session.id,
        title: session.title,
        sport: session.sport,
        hall: session.hall,
        coach_ids: session.coachIds,
        session_category: session.sessionCategory,
        price: session.price,
        start_time: session.startTime,
        end_time: session.endTime,
        status: session.status || 'idle',
        started_at: session.startedAt,
        ended_at: session.endedAt,
        days_of_week: session.daysOfWeek,
        enrolled_player_ids: session.enrolledPlayerIds,
        temporary_player_ids: session.temporaryPlayerIds,
        completed_today_by_coach: session.completedTodayByCoach,
        notes: session.notes,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('gym_sessions').upsert({
        ...basePayload,
        tier1_price: session.tier1Price ?? session.price ?? 0,
        tier2_price: session.tier2Price ?? 0,
        tier3_price: session.tier3Price ?? 0,
      });
      if (error) {
        const retry = await supabase.from('gym_sessions').upsert(basePayload);
        return !retry.error;
      }
      return !error;
    } catch {
      return false;
    }
  },

  async deleteSession(id: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { error } = await supabase.from('gym_sessions').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  },

  // ─── PHYSIO BOOKINGS ──────────────────────────────────────────
  async fetchPhysioBookings(): Promise<PhysioBooking[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase.from('physio_bookings').select('*');
      if (error) return null;
      return (data || []).map((p: any) => ({
        id: p.id,
        doctorName: p.doctor_name,
        doctorCode: p.doctor_code,
        doctorPhone: p.doctor_phone,
        patientName: p.patient_name,
        patientCode: p.patient_code,
        roomName: p.room_name,
        hourlyRate: Number(p.hourly_rate || 0),
        startTime: p.start_time,
        endTime: p.end_time,
        elapsedMinutes: Number(p.elapsed_minutes || 0),
        totalFee: Number(p.total_fee || 0),
        extraFee: Number(p.extra_fee || 0),
        extraFeeReason: p.extra_fee_reason,
        serviceType: p.service_type || 'physio',
        status: p.status || 'waiting',
        isPaused: p.is_paused,
        pausedAt: p.paused_at,
        totalPausedSeconds: Number(p.total_paused_seconds || 0),
        billedTo: p.billed_to,
        paymentMethod: p.payment_method,
        instapayRef: p.instapay_ref,
        chargedToCoachId: p.charged_to_coach_id,
        paid: p.paid,
        notes: p.notes,
      }));
    } catch {
      return null;
    }
  },

  async upsertPhysioBooking(booking: PhysioBooking): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { error } = await supabase.from('physio_bookings').upsert({
        id: booking.id,
        doctor_name: booking.doctorName,
        doctor_code: booking.doctorCode,
        doctor_phone: booking.doctorPhone,
        patient_name: booking.patientName,
        patient_code: booking.patientCode,
        room_name: booking.roomName,
        hourly_rate: booking.hourlyRate,
        start_time: booking.startTime,
        end_time: booking.endTime,
        elapsed_minutes: booking.elapsedMinutes,
        total_fee: booking.totalFee,
        extra_fee: booking.extraFee,
        extra_fee_reason: booking.extraFeeReason,
        service_type: booking.serviceType,
        status: booking.status,
        is_paused: booking.isPaused,
        paused_at: booking.pausedAt,
        total_paused_seconds: booking.totalPausedSeconds,
        billed_to: booking.billedTo,
        payment_method: booking.paymentMethod,
        instapay_ref: booking.instapayRef,
        charged_to_coach_id: booking.chargedToCoachId,
        paid: booking.paid,
        notes: booking.notes,
      });
      return !error;
    } catch {
      return false;
    }
  },

  async clearCompletedPhysioBookings(): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { error } = await supabase.from('physio_bookings').delete().eq('status', 'completed');
      return !error;
    } catch {
      return false;
    }
  },

  // ─── POS PRODUCTS ─────────────────────────────────────────────
  async fetchProducts(): Promise<POSProduct[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase.from('pos_products').select('*');
      if (error) return null;
      return (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        buyPrice: Number(p.buy_price || 0),
        sellPrice: Number(p.sell_price || 0),
        stock: Number(p.stock || 0),
        lowStockThreshold: Number(p.low_stock_threshold || 5),
        barcode: p.barcode,
        image: p.image,
      }));
    } catch {
      return null;
    }
  },

  async upsertProduct(product: POSProduct): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { error } = await supabase.from('pos_products').upsert({
        id: product.id,
        name: product.name,
        category: product.category,
        buy_price: product.buyPrice,
        sell_price: product.sellPrice,
        stock: product.stock,
        low_stock_threshold: product.lowStockThreshold ?? 5,
        barcode: product.barcode,
        image: product.image,
        updated_at: new Date().toISOString(),
      });
      return !error;
    } catch {
      return false;
    }
  },

  async deleteProduct(id: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { error } = await supabase.from('pos_products').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  },

  // ─── POS TRANSACTIONS ─────────────────────────────────────────
  async fetchPOSTransactions(): Promise<POSTransaction[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase.from('pos_transactions').select('*');
      if (error) return null;
      return (data || []).map((t: any) => ({
        id: t.id,
        items: t.items || [],
        totalAmount: Number(t.total_amount || 0),
        totalCost: Number(t.total_cost || 0),
        profit: Number(t.profit || 0),
        paymentMethod: t.payment_method,
        coachId: t.coach_id || undefined,
        coachName: t.coach_name || undefined,
        notes: t.notes || undefined,
        timestamp: t.timestamp,
        cashierName: t.cashier_name,
      }));
    } catch {
      return null;
    }
  },

  async insertPOSTransaction(t: POSTransaction): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const basePayload = {
        id: t.id,
        items: t.items,
        total_amount: t.totalAmount,
        total_cost: t.totalCost,
        profit: t.profit,
        payment_method: t.paymentMethod,
        timestamp: t.timestamp,
        cashier_name: t.cashierName,
      };
      const { error } = await supabase.from('pos_transactions').insert({
        ...basePayload,
        ...(t.coachId ? { coach_id: t.coachId } : {}),
        ...(t.coachName ? { coach_name: t.coachName } : {}),
        ...(t.notes ? { notes: t.notes } : {}),
      });
      if (error && (t.coachId || t.coachName || t.notes)) {
        const retry = await supabase.from('pos_transactions').insert(basePayload);
        return !retry.error;
      }
      return !error;
    } catch {
      return false;
    }
  },

  // ─── CHECK IN LOGS ────────────────────────────────────────────
  async fetchCheckInLogs(): Promise<CheckInLog[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase.from('check_in_logs').select('*');
      if (error) return null;
      return (data || []).map((l: any) => ({
        id: l.id,
        memberId: l.member_id,
        memberName: l.member_name,
        memberCode: l.member_code,
        memberType: l.member_type,
        timestamp: l.timestamp,
        method: l.method,
        subscriptionValid: l.subscription_valid,
        seatingStatus: l.seating_status,
        assignedCategory: l.assigned_category,
        assignedCoachId: l.assigned_coach_id,
        assignedCoachName: l.assigned_coach_name,
        assignedSessionId: l.assigned_session_id,
        assignedSessionTitle: l.assigned_session_title,
        paymentMode: l.payment_mode,
        chargedAmount: Number(l.charged_amount || 0),
        sessionStartedAt: l.session_started_at || undefined,
        checkOutTime: l.check_out_time || undefined,
        durationMinutes: l.duration_minutes !== undefined && l.duration_minutes !== null ? Number(l.duration_minutes) : undefined,
        pricingTier: l.pricing_tier || undefined,
        extraFeePaid: l.extra_fee_paid !== undefined && l.extra_fee_paid !== null ? Number(l.extra_fee_paid) : 0,
        extraPaymentMethod: l.extra_payment_method || undefined,
        checkOutStatus: l.check_out_status || undefined,
      }));
    } catch {
      return null;
    }
  },

  async insertCheckInLog(l: CheckInLog): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const basePayload = {
        id: l.id,
        member_id: l.memberId,
        member_name: l.memberName,
        member_code: l.memberCode,
        member_type: l.memberType,
        timestamp: l.timestamp,
        method: l.method,
        subscription_valid: l.subscriptionValid,
        seating_status: l.seatingStatus,
        assigned_category: l.assignedCategory,
        assigned_coach_id: l.assignedCoachId,
        assigned_coach_name: l.assignedCoachName,
        assigned_session_id: l.assignedSessionId,
        assigned_session_title: l.assignedSessionTitle,
        payment_mode: l.paymentMode,
        charged_amount: l.chargedAmount ?? 0,
      };
      const { error } = await supabase.from('check_in_logs').upsert({
        ...basePayload,
        session_started_at: l.sessionStartedAt ?? null,
        check_out_time: l.checkOutTime ?? null,
        duration_minutes: l.durationMinutes ?? 0,
        pricing_tier: l.pricingTier ?? null,
        extra_fee_paid: l.extraFeePaid ?? 0,
        extra_payment_method: l.extraPaymentMethod ?? null,
        check_out_status: l.checkOutStatus ?? null,
      });
      if (error) {
        const retry = await supabase.from('check_in_logs').upsert(basePayload);
        return !retry.error;
      }
      return !error;
    } catch {
      return false;
    }
  },

  async deleteCheckInLog(id: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { error } = await supabase.from('check_in_logs').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  },

  async clearAllCheckInLogs(): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { error } = await supabase.from('check_in_logs').delete().not('id', 'is', null);
      if (error) {
        console.error('Supabase clearAllCheckInLogs error:', error);
        const fallback = await supabase.from('check_in_logs').delete().neq('id', '');
        return !fallback.error;
      }
      return true;
    } catch (e) {
      console.error('Supabase clearAllCheckInLogs exception:', e);
      return false;
    }
  },

  async clearCheckInLogsForDate(datePrefix: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { error } = await supabase
        .from('check_in_logs')
        .delete()
        .gte('timestamp', `${datePrefix}T00:00:00`)
        .lte('timestamp', `${datePrefix}T23:59:59`);
      return !error;
    } catch {
      return false;
    }
  },

  // ─── TRAINER TRANSACTIONS ─────────────────────────────────────
  async fetchTrainerTransactions(): Promise<TrainerTransaction[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase.from('trainer_transactions').select('*');
      if (error) return null;
      return (data || []).map((t: any) => ({
        transaction_id: t.transaction_id,
        coach_id: t.coach_id,
        coach_name: t.coach_name,
        amount: Number(t.amount || 0),
        collected_by: t.collected_by,
        payer_type: t.payer_type,
        payer_name: t.payer_name,
        gym_share: Number(t.gym_share || 0),
        coach_share: Number(t.coach_share || 0),
        status: t.status,
        created_at: t.created_at,
        month: t.month,
        type: t.type,
        payment_method: t.payment_method,
        settled_at: t.settled_at,
        settled_by: t.settled_by,
        notes: t.notes,
      }));
    } catch {
      return null;
    }
  },

  async upsertTrainerTransaction(t: TrainerTransaction): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { error } = await supabase.from('trainer_transactions').upsert({
        transaction_id: t.transaction_id,
        coach_id: t.coach_id,
        coach_name: t.coach_name,
        amount: t.amount,
        collected_by: t.collected_by,
        payer_type: t.payer_type,
        payer_name: t.payer_name,
        gym_share: t.gym_share,
        coach_share: t.coach_share,
        status: t.status,
        created_at: t.created_at,
        month: t.month,
        type: t.type,
        payment_method: t.payment_method,
        settled_at: t.settled_at,
        settled_by: t.settled_by,
        notes: t.notes,
      });
      return !error;
    } catch {
      return false;
    }
  },

  async deleteTrainerTransaction(transactionId: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { error } = await supabase.from('trainer_transactions').delete().eq('transaction_id', transactionId);
      return !error;
    } catch {
      return false;
    }
  },

  async clearSettledTrainerTransactions(): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { error } = await supabase.from('trainer_transactions').delete().eq('status', 'settled');
      return !error;
    } catch {
      return false;
    }
  },

  // ─── EXPENSES ─────────────────────────────────────────────────
  async fetchExpenses(): Promise<ExpenseItem[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase.from('expenses').select('*');
      if (error) return null;
      return (data || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        amount: Number(e.amount || 0),
        date: e.date,
        recordedBy: e.recorded_by,
        notes: e.notes,
        paymentMethod: e.payment_method || 'cash',
        autoGenerated: e.auto_generated,
        relatedEntityId: e.related_entity_id,
      }));
    } catch {
      return null;
    }
  },

  async insertExpense(e: ExpenseItem): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { error } = await execWithTimeout(supabase.from('expenses').upsert({
        id: e.id,
        title: e.title,
        category: e.category,
        amount: e.amount,
        date: e.date,
        recorded_by: e.recordedBy,
        notes: e.notes,
        payment_method: e.paymentMethod,
        auto_generated: e.autoGenerated ?? false,
        related_entity_id: e.relatedEntityId,
      }));
      return !error;
    } catch {
      return false;
    }
  },

  async deleteExpense(id: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  },

  // ─── CASH INFLOWS ─────────────────────────────────────────────
  async fetchCashInflows(): Promise<CashInflowItem[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase.from('cash_inflows').select('*');
      if (error) return null;
      return (data || []).map((i: any) => ({
        id: i.id,
        type: i.type,
        title: i.title,
        amount: Number(i.amount || 0),
        date: i.date,
        memberName: i.member_name,
        paymentMethod: i.payment_method || 'cash',
        recordedBy: i.recorded_by,
      }));
    } catch {
      return null;
    }
  },

  async insertCashInflow(i: CashInflowItem): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { error } = await execWithTimeout(supabase.from('cash_inflows').upsert({
        id: i.id,
        type: i.type,
        title: i.title,
        amount: i.amount,
        date: i.date,
        member_name: i.memberName,
        payment_method: i.paymentMethod,
        recorded_by: i.recordedBy,
      }));
      return !error;
    } catch {
      return false;
    }
  },

  async deleteCashInflow(id: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { error } = await supabase.from('cash_inflows').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  },

  // ─── MASTER REPORT ENTRIES ────────────────────────────────────
  async fetchMasterReportEntries(): Promise<MasterReportEntry[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase.from('master_report_entries').select('*');
      if (error) return null;
      return (data || []).map((m: any) => ({
        id: m.id,
        month: m.month,
        date: m.date,
        playerName: m.player_name,
        playerCode: m.player_code,
        amount: Number(m.amount || 0),
        coachId: m.coach_id,
        coachName: m.coach_name,
        sessionCategory: m.session_category,
        sessionTitle: m.session_title,
        paymentMethod: m.payment_method,
        paymentStatus: m.payment_status,
        notes: m.notes,
        sourceType: m.source_type,
        entryTime: m.entry_time || undefined,
        checkOutTime: m.check_out_time || undefined,
        durationMinutes: m.duration_minutes !== undefined && m.duration_minutes !== null ? Number(m.duration_minutes) : undefined,
        pricingTier: m.pricing_tier || undefined,
        extraFeePaid: m.extra_fee_paid !== undefined && m.extra_fee_paid !== null ? Number(m.extra_fee_paid) : 0,
      }));
    } catch {
      return null;
    }
  },

  async upsertMasterReportEntry(entry: MasterReportEntry): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const basePayload = {
        id: entry.id,
        month: entry.month,
        date: entry.date,
        player_name: entry.playerName,
        player_code: entry.playerCode,
        amount: entry.amount,
        coach_id: entry.coachId,
        coach_name: entry.coachName,
        session_category: entry.sessionCategory,
        session_title: entry.sessionTitle,
        payment_method: entry.paymentMethod,
        payment_status: entry.paymentStatus,
        notes: entry.notes,
        source_type: entry.sourceType,
      };
      const { error } = await supabase.from('master_report_entries').upsert({
        ...basePayload,
        entry_time: entry.entryTime ?? null,
        check_out_time: entry.checkOutTime ?? null,
        duration_minutes: entry.durationMinutes ?? null,
        pricing_tier: entry.pricingTier ?? null,
        extra_fee_paid: entry.extraFeePaid ?? 0,
      });
      if (error) {
        const retry = await supabase.from('master_report_entries').upsert(basePayload);
        return !retry.error;
      }
      return !error;
    } catch {
      return false;
    }
  },

  async deleteMasterReportEntry(id: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { error } = await supabase.from('master_report_entries').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  },

  // ─── BILLING CYCLES ───────────────────────────────────────────
  async fetchBillingCycles(): Promise<MonthlyBillingCycle[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase.from('monthly_billing_cycles').select('*');
      if (error) return null;
      return (data || []).map((b: any) => ({
        id: b.id,
        name: b.name,
        startDate: b.start_date,
        closedDate: b.closed_date,
        isActive: b.is_active,
        totalCollected: Number(b.total_collected || 0),
        totalPendingOnCoaches: Number(b.total_pending_on_coaches || 0),
      }));
    } catch {
      return null;
    }
  },

  async upsertBillingCycle(b: MonthlyBillingCycle): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { error } = await supabase.from('monthly_billing_cycles').upsert({
        id: b.id,
        name: b.name,
        start_date: b.startDate,
        closed_date: b.closedDate,
        is_active: b.isActive,
        total_collected: b.totalCollected,
        total_pending_on_coaches: b.totalPendingOnCoaches,
      });
      return !error;
    } catch {
      return false;
    }
  },

  // ─── DAILY SHIFT CLOSINGS ─────────────────────────────────────
  async fetchDailyShiftClosings(): Promise<DailyShiftClosing[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase.from('daily_shift_closings').select('*');
      if (error) return null;
      return (data || []).map((c: any) => ({
        id: c.id,
        date: c.date,
        closingDayDate: c.closing_day_date || undefined,
        nextDayDate: c.next_day_date || undefined,
        shiftDateLabel: c.shift_date_label || undefined,
        closedAt: c.closed_at,
        closedBy: c.closed_by,
        totalDirectCash: Number(c.total_direct_cash || 0),
        totalRepayments: Number(c.total_repayments || 0),
        totalPosCash: Number(c.total_pos_cash || 0),
        totalPhysioCash: Number(c.total_physio_cash || 0),
        totalExpenses: Number(c.total_expenses || 0),
        expectedNetDrawerCash: Number(c.expected_net_drawer_cash || 0),
        actualCountedCash: Number(c.actual_counted_cash || 0),
        difference: Number(c.difference || 0),
        totalCoachDebtsLoadedToday: Number(c.total_coach_debts_loaded_today || 0),
        totalCoachEarningsToday: Number(c.total_coach_earnings_today || 0),
        notes: c.notes,
      }));
    } catch {
      return null;
    }
  },

  async insertDailyShiftClosing(c: DailyShiftClosing): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { error } = await supabase.from('daily_shift_closings').upsert({
        id: c.id,
        date: c.date,
        closing_day_date: c.closingDayDate || null,
        next_day_date: c.nextDayDate || null,
        shift_date_label: c.shiftDateLabel || null,
        closed_at: c.closedAt,
        closed_by: c.closedBy,
        total_direct_cash: c.totalDirectCash,
        total_repayments: c.totalRepayments,
        total_pos_cash: c.totalPosCash,
        total_physio_cash: c.totalPhysioCash,
        total_expenses: c.totalExpenses,
        expected_net_drawer_cash: c.expectedNetDrawerCash,
        actual_counted_cash: c.actualCountedCash ?? 0,
        difference: c.difference ?? 0,
        total_coach_debts_loaded_today: c.totalCoachDebtsLoadedToday,
        total_coach_earnings_today: c.totalCoachEarningsToday ?? 0,
        notes: c.notes,
      });
      return !error;
    } catch {
      return false;
    }
  },

  // ─── MONTHLY ARCHIVES ─────────────────────────────────────────
  async fetchMonthlyArchives(): Promise<MonthlyArchive[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase.from('monthly_archives').select('*');
      if (error) return null;
      return (data || []).map((a: any) => ({
        id: a.id,
        month: a.month,
        closedAt: a.closed_at,
        closedBy: a.closed_by,
        totalRevenue: Number(a.total_revenue || 0),
        totalExpenses: Number(a.total_expenses || 0),
        netProfit: Number(a.net_profit || 0),
        totalPosCash: Number(a.total_pos_cash || 0),
        masterEntriesSnapshot: a.master_entries_snapshot || [],
        expensesSnapshot: a.expenses_snapshot || [],
        cashInflowsSnapshot: a.cash_inflows_snapshot || [],
        trainerTransactionsSnapshot: a.trainer_transactions_snapshot || [],
        posTransactionsSnapshot: a.pos_transactions_snapshot || [],
        coachDebtCarryOver: a.coach_debt_carry_over || [],
      }));
    } catch {
      return null;
    }
  },

  async insertMonthlyArchive(a: MonthlyArchive): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { error } = await supabase.from('monthly_archives').upsert({
        id: a.id,
        month: a.month,
        closed_at: a.closedAt,
        closed_by: a.closedBy,
        total_revenue: a.totalRevenue,
        total_expenses: a.totalExpenses,
        net_profit: a.netProfit,
        total_pos_cash: a.totalPosCash,
        master_entries_snapshot: a.masterEntriesSnapshot,
        expenses_snapshot: a.expensesSnapshot,
        cash_inflows_snapshot: a.cashInflowsSnapshot,
        trainer_transactions_snapshot: a.trainerTransactionsSnapshot,
        pos_transactions_snapshot: a.posTransactionsSnapshot,
        coach_debt_carry_over: a.coachDebtCarryOver,
      });
      return !error;
    } catch {
      return false;
    }
  },

  // ─── YEARLY ARCHIVES ──────────────────────────────────────────
  async fetchYearlyArchives(): Promise<YearlyArchive[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase.from('yearly_archives').select('*');
      if (error) return null;
      return (data || []).map((y: any) => ({
        id: y.id,
        year: Number(y.year),
        archivedAt: y.archived_at,
        archivedBy: y.archived_by,
        totalRevenue: Number(y.total_revenue || 0),
        totalExpenses: Number(y.total_expenses || 0),
        netProfit: Number(y.net_profit || 0),
        totalCheckIns: Number(y.total_check_ins || 0),
        totalDirectSubscriptions: Number(y.total_direct_subscriptions || 0),
        totalCoachDebtsLoaded: Number(y.total_coach_debts_loaded || 0),
        totalCoachSettlements: Number(y.total_coach_settlements || 0),
        monthlyStats: y.monthly_stats || [],
        checkInLogsSnapshot: y.check_in_logs_snapshot || [],
        masterEntriesSnapshot: y.master_entries_snapshot || [],
        expensesSnapshot: y.expenses_snapshot || [],
        cashInflowsSnapshot: y.cash_inflows_snapshot || [],
      }));
    } catch {
      return null;
    }
  },

  async insertYearlyArchive(y: YearlyArchive): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { error } = await supabase.from('yearly_archives').upsert({
        id: y.id,
        year: y.year,
        archived_at: y.archivedAt,
        archived_by: y.archivedBy,
        total_revenue: y.totalRevenue,
        total_expenses: y.totalExpenses,
        net_profit: y.netProfit,
        total_check_ins: y.totalCheckIns,
        total_direct_subscriptions: y.totalDirectSubscriptions,
        total_coach_debts_loaded: y.totalCoachDebtsLoaded,
        total_coach_settlements: y.totalCoachSettlements,
        monthly_stats: y.monthlyStats,
        check_in_logs_snapshot: y.checkInLogsSnapshot,
        master_entries_snapshot: y.masterEntriesSnapshot,
        expenses_snapshot: y.expensesSnapshot,
        cash_inflows_snapshot: y.cashInflowsSnapshot,
      });
      return !error;
    } catch {
      return false;
    }
  },

  // ─── PERIOD ARCHIVE & CLOUD STORAGE PURGING ───────────────────
  async purgeDataForMonths(months: string[]): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase || !months || months.length === 0) return false;
    try {
      // 1. Delete master report entries for these months
      await supabase.from('master_report_entries').delete().in('month', months);
      // 2. Delete trainer transactions for these months
      await supabase.from('trainer_transactions').delete().in('month', months);
      // 3. Delete monthly archives for these months
      await supabase.from('monthly_archives').delete().in('month', months);
      return true;
    } catch (e) {
      console.warn('Purge data for months error in Supabase:', e);
      return false;
    }
  },

  // ─── COMPLETE OPERATIONAL DATA WIPE (RESET DATABASE TO ZERO) ──
  async wipeAllOperationalData(): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const tables = [
        'checkin_logs',
        'trainer_transactions',
        'pos_transactions',
        'physio_bookings',
        'cash_inflows',
        'expenses',
        'master_report_entries',
        'daily_shift_closings',
        'monthly_archives',
        'yearly_archives',
        'sessions',
        'members',
        'coaches',
        'products',
        'billing_cycles',
      ];
      for (const table of tables) {
        if (table === 'trainer_transactions') {
          await supabase.from(table).delete().neq('transaction_id', '___NEVER_MATCH___');
        } else {
          await supabase.from(table).delete().neq('id', '___NEVER_MATCH___');
        }
      }
      return true;
    } catch (err) {
      console.warn('Wipe all operational data error:', err);
      return false;
    }
  },
};
