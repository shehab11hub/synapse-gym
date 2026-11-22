// Utility formatters for Egyptian Pound and Arabic dates/times

export function formatEGP(amount: number): string {
  return `${amount.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} ج.م`;
}

export function formatTime12h(time24: string): string {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const period = h >= 12 ? 'م' : 'ص';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${period}`;
}

export function isSessionActiveNow(startTime: string, endTime: string): boolean {
  try {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = startTime.split(':').map(Number);
    const startMinutes = startH * 60 + (startM || 0);

    const [endH, endM] = endTime.split(':').map(Number);
    const endMinutes = endH * 60 + (endM || 0);

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } catch {
    return false;
  }
}

export function formatDateAr(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a date string into clear Arabic phrasing:
 * e.g. "يوم 15 شهر نوفمبر 2026"
 */
export function formatArabicDayMonth(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const months = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `يوم ${day} شهر ${month} ${year}`;
  } catch {
    return dateStr;
  }
}

export interface SubscriptionStatusInfo {
  status: 'active' | 'active_sessions' | 'expired' | 'none';
  isExpired: boolean;
  isActive: boolean;
  badgeText: string;
  fullText: string;
  color: 'emerald' | 'teal' | 'rose' | 'amber' | 'slate';
  dateFormatted?: string;
  remainingDays?: number;
  remainingSessions?: number;
}

/**
 * Calculate dynamic remaining days strictly based on difference between
 * end_date midnight and today's midnight on device local time.
 * Math.max(0, Math.ceil((endDateMidnight - todayMidnight) / 86400000))
 */
export function calculateRemainingDays(endDate?: string): number {
  if (!endDate) return 0;
  try {
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    const [y, m, d] = endDate.slice(0, 10).split('-').map(Number);
    let endMidnight: number;
    if (y && m && d) {
      endMidnight = new Date(y, m - 1, d).getTime();
    } else {
      const parsed = new Date(endDate);
      if (isNaN(parsed.getTime())) return 0;
      endMidnight = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
    }

    const diffDays = Math.ceil((endMidnight - todayMidnight) / 86400000);
    return Math.max(0, diffDays);
  } catch {
    return 0;
  }
}

/**
 * Comprehensive evaluator for member subscription state:
 * Clearly indicates if subscription is active until [Day X Month Y],
 * expired on [Day X Month Y], or player has no subscription.
 */
export function getSubscriptionStatus(member?: {
  active?: boolean;
  endDate?: string;
  remainingDays?: number;
  totalDays?: number;
  remainingSessions?: number;
  totalSessions?: number;
  subscriptionPlan?: string;
} | null): SubscriptionStatusInfo {
  if (!member) {
    return {
      status: 'none',
      isExpired: false,
      isActive: false,
      badgeText: 'بدون اشتراك نشط',
      fullText: 'اللاعب غير مسجل بأي اشتراك نشط حالياً',
      color: 'amber',
    };
  }

  const remainingSessions = member.remainingSessions ?? 0;
  const totalDays = member.totalDays ?? 0;
  const totalSessions = member.totalSessions ?? 0;

  let remainingDays = member.remainingDays ?? 0;
  let isDatePast = false;

  if (member.endDate) {
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    const [y, m, d] = member.endDate.slice(0, 10).split('-').map(Number);
    let endMidnight: number;
    if (y && m && d) {
      endMidnight = new Date(y, m - 1, d).getTime();
    } else {
      const parsed = new Date(member.endDate);
      endMidnight = isNaN(parsed.getTime()) ? 0 : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
    }

    if (endMidnight > 0) {
      const diffDays = Math.ceil((endMidnight - todayMidnight) / 86400000);
      remainingDays = Math.max(0, diffDays);
      isDatePast = diffDays <= 0;
    }
  }

  const dateFormatted = member.endDate ? formatArabicDayMonth(member.endDate) : '';

  // 1. Expired subscription (If days ended, any unconsumed sessions are forfeit)
  const hasExpiredDays = (totalDays > 0 && remainingDays <= 0) || (Boolean(member.endDate) && isDatePast);
  if (hasExpiredDays) {
    return {
      status: 'expired',
      isExpired: true,
      isActive: false,
      badgeText: 'اشتراك منتهي (انتهت الأيام)',
      fullText: dateFormatted
        ? `اشتراك منتهي (انتهت مدة الأيام في ${dateFormatted}${remainingSessions > 0 ? ` وسقطت ${remainingSessions} حصة متبقية` : ''})`
        : `اشتراك منتهي الصلاحية (انتهت الأيام${remainingSessions > 0 ? ` وسقطت ${remainingSessions} حصة متبقية` : ''})`,
      color: 'rose',
      dateFormatted,
      remainingDays: 0,
      remainingSessions,
    };
  }

  // 1b. Expired subscription (If session-based package has exhausted all sessions)
  const hasExhaustedSessions = totalSessions > 0 && remainingSessions <= 0;
  if (hasExhaustedSessions) {
    return {
      status: 'expired',
      isExpired: true,
      isActive: false,
      badgeText: 'اشتراك منتهي (نفدت الحصص)',
      fullText: 'اشتراك منتهي (تم استهلاك جميع الحصص 0 متبقية - يتطلب التجديد أو دفع تمرينة)',
      color: 'rose',
      dateFormatted,
      remainingDays: Math.max(0, remainingDays),
      remainingSessions: 0,
    };
  }

  // 2. Active duration subscription
  if (remainingDays > 0 && !isDatePast) {
    const sessionsSuffix = totalSessions > 0 ? ` - ${remainingSessions} حصة` : '';
    return {
      status: 'active',
      isExpired: false,
      isActive: true,
      badgeText: `ساري (${remainingDays} يوم${sessionsSuffix})`,
      fullText: dateFormatted
        ? `اشتراك ساري حتى ${dateFormatted} (متبقي ${remainingDays} يوم${sessionsSuffix})`
        : `اشتراك ساري (متبقي ${remainingDays} يوم${sessionsSuffix})`,
      color: 'emerald',
      dateFormatted,
      remainingDays,
      remainingSessions,
    };
  }

  // 3. Active sessions only (no duration)
  if (remainingSessions > 0) {
    return {
      status: 'active_sessions',
      isExpired: false,
      isActive: true,
      badgeText: `ساري (${remainingSessions} حصة)`,
      fullText: `اشتراك حصص ساري (متبقي ${remainingSessions} حصة من أصل ${totalSessions || remainingSessions})`,
      color: 'teal',
      remainingSessions,
      remainingDays: 0,
    };
  }

  // 4. No active subscription
  return {
    status: 'none',
    isExpired: false,
    isActive: false,
    badgeText: 'بدون اشتراك نشط',
    fullText: 'اللاعب بدون اشتراك نشط حالياً',
    color: 'amber',
  };
}
