import type { Request } from 'express';

export interface JwtPayload {
  userId: string;
  email: string;
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

export type EventType = 'BABY_SHOWER' | 'WEDDING' | 'BIRTHDAY' | 'BAPTISM' | 'COMMUNION';
export type Tier = 'free' | 'pro';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing';

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
  free: { maxEvents: 2, maxGiftsPerEvent: 10, maxPhotosPerEvent: 3, allowPhotoUpload: true, customDomain: false, analytics: false, cashFundCommission: 5 },
  pro: { maxEvents: 20, maxGiftsPerEvent: 50, maxPhotosPerEvent: 15, allowPhotoUpload: true, customDomain: false, analytics: true, cashFundCommission: 5 },
};

export const TIER_ORDER: Record<Tier, number> = {
  free: 0,
  pro: 1,
};

export const EVENT_TYPES: EventType[] = ['BABY_SHOWER', 'WEDDING', 'BIRTHDAY', 'BAPTISM', 'COMMUNION'];
