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
