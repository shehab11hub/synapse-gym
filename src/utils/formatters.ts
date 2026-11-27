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
  hasHistory: boolean;
  badgeText: string;
  fullText: string;
  color: 'emerald' | 'teal' | 'rose' | 'amber' | 'sky' | 'slate';
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
export function getSubscriptionStatus(
  member?: {
    active?: boolean;
    startDate?: string;
    endDate?: string;
    remainingDays?: number;
    totalDays?: number;
    remainingSessions?: number;
    totalSessions?: number;
    subscriptionPlan?: string;
    subscriptionFee?: number;
  } | null,
  subscriptionHistory?: Array<{
    endDate?: string;
    date?: string;
    totalDays?: number;
    totalSessions?: number;
    fee?: number;
    amount?: number;
  }>
): SubscriptionStatusInfo {
  if (!member) {
    return {
      status: 'none',
      isExpired: false,
      isActive: false,
      hasHistory: false,
      badgeText: '🆕 زائر جديد — غير مشترك من قبل',
      fullText: 'زائر جديد — لم يسبق له الاشتراك في الجيم من قبل',
      color: 'sky',
    };
  }

  const remainingSessions = member.remainingSessions ?? 0;
  const totalDays = member.totalDays ?? 0;
  const totalSessions = member.totalSessions ?? 0;
  const subscriptionFee = member.subscriptionFee ?? 0;

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

  const hasHistoryEntries = Boolean(subscriptionHistory && subscriptionHistory.length > 0);
  const hasLongerEndThanStart = Boolean(
    member.endDate &&
      member.startDate &&
      member.endDate.slice(0, 10) > member.startDate.slice(0, 10)
  );
  const hasPriorSubscription =
    hasHistoryEntries ||
    totalDays > 0 ||
    totalSessions > 0 ||
    subscriptionFee > 0 ||
    hasLongerEndThanStart;

  const lastHistoryEnd =
    subscriptionHistory && subscriptionHistory.length > 0
      ? subscriptionHistory[0].endDate || subscriptionHistory[0].date
      : undefined;
  const effectiveEndDate = member.endDate || lastHistoryEnd;
  const dateFormatted = hasPriorSubscription && effectiveEndDate
    ? formatArabicDayMonth(effectiveEndDate)
    : undefined;

  // 1. Active duration subscription
  if (remainingDays > 0 && !isDatePast && hasPriorSubscription) {
    const sessionsSuffix = totalSessions > 0 ? ` - ${remainingSessions} حصة` : '';
    return {
      status: 'active',
      isExpired: false,
      isActive: true,
      hasHistory: true,
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

  // 2. Active sessions only (no duration expiry or date not past)
  if (totalSessions > 0 && remainingSessions > 0 && !isDatePast) {
    return {
      status: 'active_sessions',
      isExpired: false,
      isActive: true,
      hasHistory: true,
      badgeText: `ساري (${remainingSessions} حصة)`,
      fullText: `اشتراك حصص ساري (متبقي ${remainingSessions} حصة من أصل ${totalSessions || remainingSessions})`,
      color: 'teal',
      dateFormatted,
      remainingSessions,
      remainingDays: Math.max(0, remainingDays),
    };
  }

  // 3. Never subscribed before (New Visitor — no subscription history)
  if (!hasPriorSubscription) {
    return {
      status: 'none',
      isExpired: false,
      isActive: false,
      hasHistory: false,
      badgeText: '🆕 زائر جديد — غير مشترك من قبل',
      fullText: 'زائر جديد — لم يسبق له الاشتراك في الجيم من قبل',
      color: 'sky',
      dateFormatted: undefined,
      remainingDays: 0,
      remainingSessions: 0,
    };
  }

  // 4. Expired subscription (Had a prior subscription, but days or sessions ran out)
  const hasExhaustedSessions = totalSessions > 0 && remainingSessions <= 0;
  return {
    status: 'expired',
    isExpired: true,
    isActive: false,
    hasHistory: true,
    badgeText: '⚠️ اشتراك منتهي',
    fullText: hasExhaustedSessions && !isDatePast
      ? '⚠️ اشتراك منتهي (نفدت جميع الحصص المتاحة)'
      : dateFormatted
      ? `⚠️ اشتراك منتهي — انتهى: ${dateFormatted}`
      : '⚠️ اشتراك منتهي الصلاحية',
    color: 'rose',
    dateFormatted,
    remainingDays: 0,
    remainingSessions,
  };
}
