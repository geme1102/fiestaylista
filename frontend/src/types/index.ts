import { EventType, Tier, TierLimits, TIER_LIMITS } from '@shared/types';
export type { EventType, Tier, TierLimits };
export { TIER_LIMITS };

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
  status?: 'active' | 'completed' | 'paused';
  isActive: boolean;
  giftCount?: number;
  photoCount?: number;
  boostedUntil?: string;
  viewCount?: number;
  cashFund?: { collectedAmount: number; targetAmount?: number | null } | null;
  eventDate?: string | null;
  eventLocation?: string | null;
  eventNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Gift {
  id: string;
  eventId: string;
  name: string;
  isClaimed: boolean;
  claimedBy?: string;
  isGroupGift?: boolean;
  createdAt: string;
  claims?: GiftClaim[];
}

export interface GiftClaim {
  id: string;
  giftId: string;
  claimedBy: string;
  message?: string;
  createdAt: string;
}

export interface Photo {
  id: string;
  eventId: string;
  url: string;
  caption?: string;
  isFeatured?: boolean;
  createdAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  tier: Tier;
  status: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing' | 'pending_approval';
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  mpSubscriptionId?: string;
}

export interface ProPayment {
  id: string;
  amount: number;
  interval: 'month' | 'year';
  status: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
  emailSent?: boolean;
}

export interface CashFund {
  id: string;
  eventId: string;
  title: string;
  description?: string;
  targetAmount?: number;
  collectedAmount: number;
  isActive: boolean;
  bankPhone?: string | null;
  bankType?: string | null;
  createdAt: string;
}

export interface CashContribution {
  id: string;
  cashFundId: string;
  contributorName: string;
  message?: string;
  amount: number;
  status: 'promised' | 'paid' | 'cancelled';
  createdAt: string;
}

export const EVENT_LABELS: Record<EventType, string> = {
  BABY_SHOWER: 'Baby Shower',
  WEDDING: 'Boda',
  BIRTHDAY: 'Cumpleaños',
  BAPTISM: 'Bautizo',
  COMMUNION: 'Comunión',
  OTHER: 'Otro',
  HOUSE_WARMING: 'Casa Shower',
};

export const EVENT_ICONS: Record<EventType, string> = {
  BABY_SHOWER: '🍼',
  WEDDING: '💍',
  BIRTHDAY: '🎂',
  BAPTISM: '🕊️',
  COMMUNION: '✨',
  OTHER: '🎊',
  HOUSE_WARMING: '🏠',
};

export const DEFAULT_NOTES: Record<EventType, string> = {
  BABY_SHOWER: '¡Celebremos la llegada del bebé! 🍼',
  WEDDING: '¡Celebremos este amor que nace! 💍',
  BIRTHDAY: '¡A celebrar un año más de vida! 🎂',
  BAPTISM: '¡Bienvenido a la familia de Dios! 🕊️',
  COMMUNION: '¡Un paso importante en tu fe! ✨',
  OTHER: '¡Gracias por acompañarnos! 🎊',
  HOUSE_WARMING: '¡Bienvenidos a nuestro nuevo hogar! 🏠',
};

export const THEME_COLORS: Record<EventType, { primary: string; light: string; dark: string; gradient: string }> = {
  BABY_SHOWER: { primary: '#ec4899', light: '#fdf2f8', dark: '#be185d', gradient: 'from-primary to-primary-container' },
  WEDDING: { primary: '#6366f1', light: '#eef2ff', dark: '#4338ca', gradient: 'from-indigo-400 to-violet-500' },
  BIRTHDAY: { primary: '#f59e0b', light: '#fffbeb', dark: '#d97706', gradient: 'from-amber-400 to-orange-500' },
  BAPTISM: { primary: '#0ea5e9', light: '#f0f9ff', dark: '#0284c7', gradient: 'from-sky-400 to-blue-500' },
  COMMUNION: { primary: '#eab308', light: '#fefce8', dark: '#ca8a04', gradient: 'from-yellow-400 to-amber-500' },
  OTHER: { primary: '#8b5cf6', light: '#f5f3ff', dark: '#7c3aed', gradient: 'from-violet-400 to-purple-500' },
  HOUSE_WARMING: { primary: '#f97316', light: '#fff7ed', dark: '#ea580c', gradient: 'from-orange-400 to-amber-500' },
};
