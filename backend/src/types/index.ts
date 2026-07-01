import type { Request } from 'express';
export type { EventType, Tier, EventStatus, CashContributionStatus, SubscriptionStatus, TierLimits } from '@shared/types.js';
export { TIER_LIMITS, TIER_ORDER, EVENT_TYPES } from '@shared/types.js';

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
