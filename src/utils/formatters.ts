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

  const remainingDays = member.remainingDays ?? 0;
  const remainingSessions = member.remainingSessions ?? 0;
  const totalDays = member.totalDays ?? 0;
  const totalSessions = member.totalSessions ?? 0;

  let isDatePast = false;
  if (member.endDate) {
    const end = new Date(member.endDate);
    if (!isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      isDatePast = end.getTime() < Date.now();
    }
  }

  const dateFormatted = member.endDate ? formatArabicDayMonth(member.endDate) : '';

  // 1. Expired subscription
  if ((totalDays > 0 && remainingDays <= 0) || (member.endDate && isDatePast)) {
    return {
      status: 'expired',
      isExpired: true,
      isActive: false,
      badgeText: 'اشتراك منتهي',
      fullText: dateFormatted
        ? `اشتراك منتهي (انتهى بتاريخ ${dateFormatted})`
        : 'اشتراك اللاعب منتهي الصلاحية',
      color: 'rose',
      dateFormatted,
      remainingDays: 0,
      remainingSessions,
    };
  }

  // 2. Active duration subscription
  if (remainingDays > 0 && !isDatePast) {
    return {
      status: 'active',
      isExpired: false,
      isActive: true,
      badgeText: `ساري (${remainingDays} يوم)`,
      fullText: dateFormatted
        ? `اشتراك ساري حتى ${dateFormatted} (متبقي ${remainingDays} يوم)`
        : `اشتراك ساري (متبقي ${remainingDays} يوم)`,
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
