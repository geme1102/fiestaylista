export type EventType = 'BABY_SHOWER' | 'WEDDING' | 'BIRTHDAY' | 'BAPTISM' | 'COMMUNION';
export type Tier = 'free' | 'pro';

export interface User {
  id: string;
  email: string;
  name: string;
  tier: Tier;
  emailVerified: boolean;
  createdAt: string;
}

export interface Event {
  id: string;
  userId: string;
  title: string;
  eventType: EventType;
  hostPhone?: string;
  slug: string;
  isActive: boolean;
  giftCount?: number;
  photoCount?: number;
  boostedUntil?: string;
  cashFund?: { collectedAmount: number; targetAmount?: number | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Gift {
  id: string;
  eventId: string;
  name: string;
  isClaimed: boolean;
  claimedBy?: string;
  createdAt: string;
}

export interface Photo {
  id: string;
  eventId: string;
  url: string;
  caption?: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  tier: Tier;
  status: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing' | 'incomplete_expired';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  mpSubscriptionId?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface CashFund {
  id: string;
  eventId: string;
  title: string;
  description?: string;
  targetAmount?: number;
  collectedAmount: number;
  isActive: boolean;
  createdAt: string;
}

export interface CashContribution {
  id: string;
  cashFundId: string;
  contributorName: string;
  message?: string;
  amount: number;
  status: string;
  createdAt: string;
}

export interface TierLimits {
  maxEvents: number;
  maxGiftsPerEvent: number;
  maxPhotosPerEvent: number;
  allowPhotoUpload: boolean;
  customDomain: boolean;
  analytics: boolean;
  cashFundCommission: number;
}

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: { maxEvents: 1, maxGiftsPerEvent: 20, maxPhotosPerEvent: 5, allowPhotoUpload: false, customDomain: false, analytics: false, cashFundCommission: 4 },
  pro: { maxEvents: 20, maxGiftsPerEvent: 500, maxPhotosPerEvent: 200, allowPhotoUpload: true, customDomain: false, analytics: true, cashFundCommission: 2 },
};

export const EVENT_LABELS: Record<EventType, string> = {
  BABY_SHOWER: 'Baby Shower',
  WEDDING: 'Boda',
  BIRTHDAY: 'Cumpleaños',
  BAPTISM: 'Bautizo',
  COMMUNION: 'Comunión',
};

export const EVENT_ICONS: Record<EventType, string> = {
  BABY_SHOWER: '🍼',
  WEDDING: '💍',
  BIRTHDAY: '🎂',
  BAPTISM: '🕊️',
  COMMUNION: '✨',
};

export const THEME_COLORS: Record<EventType, { primary: string; light: string; dark: string; gradient: string }> = {
  BABY_SHOWER: { primary: '#ec4899', light: '#fdf2f8', dark: '#be185d', gradient: 'from-pink-400 to-rose-500' },
  WEDDING: { primary: '#6366f1', light: '#eef2ff', dark: '#4338ca', gradient: 'from-indigo-400 to-violet-500' },
  BIRTHDAY: { primary: '#f59e0b', light: '#fffbeb', dark: '#d97706', gradient: 'from-amber-400 to-orange-500' },
  BAPTISM: { primary: '#0ea5e9', light: '#f0f9ff', dark: '#0284c7', gradient: 'from-sky-400 to-blue-500' },
  COMMUNION: { primary: '#eab308', light: '#fefce8', dark: '#ca8a04', gradient: 'from-yellow-400 to-amber-500' },
};
