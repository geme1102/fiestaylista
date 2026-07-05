import type { Event, Gift, Photo, Subscription } from '../../src/types';

export const MOCK_EVENT: Event & { id: string; slug: string } = {
  id: 'event-1',
  userId: 'user-free-1',
  title: 'Baby Shower de María',
  eventType: 'BABY_SHOWER',
  slug: 'baby-shower-maria',
  isActive: true,
  giftCount: 2,
  photoCount: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const MOCK_EVENTS_LIST = [
  MOCK_EVENT,
  {
    ...MOCK_EVENT,
    id: 'event-2',
    title: 'Boda de Juan y Ana',
    eventType: 'WEDDING' as const,
    slug: 'boda-juan-ana',
    giftCount: 5,
    photoCount: 3,
    cashFund: { collectedAmount: 150000, isActive: true },
  },
];

export const MOCK_GIFTS: Gift[] = [
  { id: 'gift-1', eventId: 'event-1', name: 'Juego de Sábanas', isClaimed: false, createdAt: new Date().toISOString() },
  { id: 'gift-2', eventId: 'event-1', name: 'Pañales', isClaimed: true, claimedBy: 'Ana Pérez', createdAt: new Date().toISOString() },
];

export const MOCK_PHOTOS: Photo[] = [
  { id: 'photo-1', eventId: 'event-1', url: 'https://picsum.photos/400/300', caption: 'Decoración', createdAt: new Date().toISOString() },
];

export const MOCK_CONTRIBUTIONS = [
  { id: 'contrib-1', cashFundId: 'cf-1', eventId: 'event-1', contributorName: 'Carlos López', amount: 50000, message: '¡Felicidades!', status: 'completed' as const, createdAt: new Date().toISOString() },
  { id: 'contrib-2', cashFundId: 'cf-1', eventId: 'event-1', contributorName: 'María García', amount: 100000, message: 'Muchas bendiciones', status: 'completed' as const, createdAt: new Date().toISOString() },
];

export const MOCK_MESSAGES = [
  { id: 'msg-1', eventId: 'event-1', authorName: 'Ana Pérez', content: '¡Felicidades! Qué emoción', createdAt: new Date().toISOString() },
  { id: 'msg-2', eventId: 'event-1', authorName: 'Luis Gómez', content: 'Los quiero mucho', createdAt: new Date().toISOString() },
];

export const MOCK_GROUP_GIFT = {
  ...MOCK_GIFTS[0],
  id: 'gift-3',
  name: 'Cuna para bebé',
  isGroupGift: true as const,
  targetAmount: 300000,
  collectedAmount: 120000,
};

export const MOCK_SUBSCRIPTION: Subscription = {
  id: 'sub-1',
  userId: 'user-pro-1',
  tier: 'pro',
  status: 'active',
  currentPeriodStart: new Date().toISOString(),
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
};
