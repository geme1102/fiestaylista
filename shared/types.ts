export type EventType = 'BABY_SHOWER' | 'WEDDING' | 'BIRTHDAY' | 'BAPTISM' | 'COMMUNION' | 'OTHER' | 'HOUSE_WARMING';
export type Tier = 'free' | 'pro' | 'pro_plus';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing' | 'pending_approval' | 'expired';
export type EventStatus = 'active' | 'completed' | 'paused';
export type CashContributionStatus = 'promised' | 'paid' | 'cancelled';

export interface TierLimits {
  maxEvents: number;
  maxGiftsPerEvent: number;
  maxPhotosPerEvent: number;
}

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: { maxEvents: 1, maxGiftsPerEvent: 10, maxPhotosPerEvent: 0 },
  pro: { maxEvents: 1, maxGiftsPerEvent: 100, maxPhotosPerEvent: 20 },
  pro_plus: { maxEvents: 3, maxGiftsPerEvent: 100, maxPhotosPerEvent: 20 },
};

export const EVENT_TYPES: EventType[] = ['BABY_SHOWER', 'WEDDING', 'BIRTHDAY', 'BAPTISM', 'COMMUNION', 'OTHER', 'HOUSE_WARMING'];

export const TIER_ORDER: Record<Tier, number> = {
  free: 0,
  pro: 1,
  pro_plus: 2,
};

export interface User {
  id: string;
  email: string;
  name: string;
  tier: Tier;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  welcomeTutorialCompleted: boolean;
  createdAt: string;
}

export interface Event {
  id: string;
  userId: string;
  title: string;
  eventType: EventType;
  hostPhone?: string;
  slug: string;
  status?: EventStatus;
  isActive: boolean;
  giftCount?: number;
  photoCount?: number;
  viewCount?: number;
  cashFund?: { collectedAmount: number; targetAmount?: number | null } | null;
  eventDate?: string | null;
  eventLocation?: string | null;
  eventNote?: string | null;
  ownerTier?: Tier;
  frozenAt?: string | null;
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
  status: SubscriptionStatus;
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
  status: CashContributionStatus;
  createdAt: string;
}

export interface Guest {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isConfirmed: boolean;
  companions: number;
  dietaryRestrictions: string | null;
  message: string | null;
  createdAt: string;
}

export interface Message {
  id: string;
  authorName: string;
  message: string;
  createdAt: string;
}
