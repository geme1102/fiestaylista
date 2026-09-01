import type { EventType } from '@shared/types';
export type {
  EventType,
  Tier,
  TierLimits,
  SubscriptionStatus,
  EventStatus,
  CashContributionStatus,
  User,
  Event,
  Gift,
  GiftClaim,
  Photo,
  Subscription,
  ProPayment,
  AuthResponse,
  CashFund,
  CashContribution,
  Guest,
  Message,
} from '@shared/types';
export { TIER_LIMITS, TIER_ORDER } from '@shared/types';

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
  BIRTHDAY: { primary: '#f59e0b', light: '#fffbeb', dark: '#b45309', gradient: 'from-amber-400 to-orange-500' },
  BAPTISM: { primary: '#0ea5e9', light: '#f0f9ff', dark: '#0369a1', gradient: 'from-sky-400 to-blue-500' },
  COMMUNION: { primary: '#eab308', light: '#fefce8', dark: '#a16207', gradient: 'from-yellow-400 to-amber-500' },
  OTHER: { primary: '#8b5cf6', light: '#f5f3ff', dark: '#6d28d9', gradient: 'from-violet-400 to-purple-500' },
  HOUSE_WARMING: { primary: '#f97316', light: '#fff7ed', dark: '#c2410c', gradient: 'from-orange-400 to-amber-500' },
};
