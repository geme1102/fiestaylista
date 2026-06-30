import type { Request } from 'express';

export interface JwtPayload {
  userId: string;
  email: string;
  isGuest?: boolean;
  type?: 'access';
}

export interface GuestJwtPayload extends JwtPayload {
  isGuest: true;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export interface AppRequest extends Request {
  requestId: string;
  rawBody?: string;
  user?: JwtPayload;
}

export type EventType = 'BABY_SHOWER' | 'WEDDING' | 'BIRTHDAY' | 'BAPTISM' | 'COMMUNION' | 'OTHER' | 'HOUSE_WARMING';
export type Tier = 'free' | 'pro' | 'pro_plus';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing' | 'pending_approval';
export type EventStatus = 'active' | 'completed' | 'paused';
export type CashContributionStatus = 'promised' | 'paid' | 'cancelled';

export interface TierLimits {
  maxEvents: number;
  maxGiftsPerEvent: number;
  maxPhotosPerEvent: number;
}

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: { maxEvents: 1, maxGiftsPerEvent: 15, maxPhotosPerEvent: 3 },
  pro: { maxEvents: 1, maxGiftsPerEvent: 100, maxPhotosPerEvent: 20 },
  pro_plus: { maxEvents: 3, maxGiftsPerEvent: 100, maxPhotosPerEvent: 20 },
};

export const TIER_ORDER: Record<Tier, number> = {
  free: 0,
  pro: 1,
  pro_plus: 2,
};

export const EVENT_TYPES: EventType[] = ['BABY_SHOWER', 'WEDDING', 'BIRTHDAY', 'BAPTISM', 'COMMUNION', 'OTHER', 'HOUSE_WARMING'];
