import { Coach, GymSession, GymSettings, POSProduct, SubscriptionPlanPreset } from '../types';

/**
 * Smart Dual-Layer Cache (In-Memory Map + localStorage) for Semi-Static Reference Data:
 * - Subscription Plans (باقات الاشتراك)
 * - Coaches Directory (قائمة المدربين)
 * - POS / Bar Products (منتجات الكافيه والبار)
 * - Gym Classes / Sessions (الحصص والجداول)
 * - Gym Settings (إعدادات الجيم والدورة الحالية)
 *
 * Ensures instant tab switching without redundant DB reloads while automatically
 * refreshing whenever mutations or Supabase Realtime updates occur.
 */

const CACHE_PREFIX = 'egyfit_smart_cache_v1:';
const DEFAULT_TTL_MS = 1000 * 60 * 30; // 30 minutes soft TTL

interface CacheEnvelope<T> {
  data: T;
  updatedAt: number;
}

const memoryCache = new Map<string, CacheEnvelope<unknown>>();

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlanPreset[] = [
  { id: 'plan-gym-monthly', name: 'اشتراك شهري صالة الجيم (30 يوم)', durationDays: 30, sessionsCount: 0, fee: 500, category: 'gym' },
  { id: 'plan-gym-quarterly', name: 'اشتراك ربع سنوي (90 يوم)', durationDays: 90, sessionsCount: 0, fee: 1300, category: 'gym' },
  { id: 'plan-gym-semi', name: 'اشتراك نصف سنوي (180 يوم)', durationDays: 180, sessionsCount: 0, fee: 2400, category: 'gym' },
  { id: 'plan-gym-annual', name: 'اشتراك سنوي VIP (365 يوم)', durationDays: 365, sessionsCount: 0, fee: 4500, category: 'gym' },
  { id: 'plan-pt-12', name: 'باقة تدريب خاص 12 حصة (PT)', durationDays: 30, sessionsCount: 12, fee: 1800, category: 'private' },
  { id: 'plan-group-12', name: 'باقة كلاس جماعي 12 حصة', durationDays: 30, sessionsCount: 12, fee: 900, category: 'group' },
];

export const DEFAULT_GYM_SETTINGS: GymSettings = {
  branchName: 'EGYFIT — الفرع الرئيسي',
  currentMonth: new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }),
  defaultTier1Minutes: 90,
  defaultTier2Minutes: 120,
  defaultTier3Minutes: 180,
  updatedAt: new Date().toISOString(),
};

export type SmartCacheKey =
  | 'coaches'
  | 'pos_products'
  | 'gym_sessions'
  | 'subscription_plans'
  | 'gym_settings';

export const smartCache = {
  get<T>(key: SmartCacheKey, ttlMs = DEFAULT_TTL_MS): T | null {
    const memEntry = memoryCache.get(key) as CacheEnvelope<T> | undefined;
    if (memEntry && Date.now() - memEntry.updatedAt < ttlMs) {
      return memEntry.data;
    }

    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CacheEnvelope<T>;
      if (!parsed || typeof parsed.updatedAt !== 'number') return null;
      if (Date.now() - parsed.updatedAt >= ttlMs) {
        return null;
      }
      memoryCache.set(key, parsed);
      return parsed.data;
    } catch {
      return null;
    }
  },

  set<T>(key: SmartCacheKey, data: T): void {
    const envelope: CacheEnvelope<T> = {
      data,
      updatedAt: Date.now(),
    };
    memoryCache.set(key, envelope);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(envelope));
      } catch {
        // Ignore quota errors
      }
    }
  },

  invalidate(key?: SmartCacheKey): void {
    if (key) {
      memoryCache.delete(key);
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.removeItem(`${CACHE_PREFIX}${key}`);
        } catch {
          // ignore
        }
      }
      return;
    }

    memoryCache.clear();
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const keys: SmartCacheKey[] = [
          'coaches',
          'pos_products',
          'gym_sessions',
          'subscription_plans',
          'gym_settings',
        ];
        keys.forEach((k) => localStorage.removeItem(`${CACHE_PREFIX}${k}`));
      } catch {
        // ignore
      }
    }
  },

  getCoaches: (): Coach[] | null => smartCache.get<Coach[]>('coaches'),
  setCoaches: (coaches: Coach[]) => smartCache.set('coaches', coaches),

  getProducts: (): POSProduct[] | null => smartCache.get<POSProduct[]>('pos_products'),
  setProducts: (products: POSProduct[]) => smartCache.set('pos_products', products),

  getSessions: (): GymSession[] | null => smartCache.get<GymSession[]>('gym_sessions'),
  setSessions: (sessions: GymSession[]) => smartCache.set('gym_sessions', sessions),

  getSubscriptionPlans: (): SubscriptionPlanPreset[] =>
    smartCache.get<SubscriptionPlanPreset[]>('subscription_plans') || DEFAULT_SUBSCRIPTION_PLANS,
  setSubscriptionPlans: (plans: SubscriptionPlanPreset[]) =>
    smartCache.set('subscription_plans', plans),

  getGymSettings: (): GymSettings =>
    smartCache.get<GymSettings>('gym_settings') || DEFAULT_GYM_SETTINGS,
  setGymSettings: (settings: GymSettings) => smartCache.set('gym_settings', settings),
};
