export const BASE_URL = process.env.VITE_APP_URL || 'http://localhost:5173';

export const ROUTES = {
  landing: '/',
  login: '/login',
  register: '/register',
  pricing: '/pricing',
  dashboard: '/dashboard',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  account: '/account',
  eventAdmin: (id: string) => `/event/${id}`,
  eventGuest: (slug: string) => `/e/${slug}`,
};

export const TIMEOUTS = {
  navigation: 15000,
  element: 10000,
  api: 10000,
  animation: 3000,
};

export const MOCK_USERS = {
  free: {
    id: 'user-free-1',
    email: 'test@fiestaylista.com',
    name: 'Test User',
    tier: 'free' as const,
    emailVerified: true,
    createdAt: new Date().toISOString(),
  },
  pro: {
    id: 'user-pro-1',
    email: 'pro@fiestaylista.com',
    name: 'Pro User',
    tier: 'pro' as const,
    emailVerified: true,
    createdAt: new Date().toISOString(),
  },
  unverified: {
    id: 'user-unverified-1',
    email: 'unverified@fiestaylista.com',
    name: 'Unverified User',
    tier: 'free' as const,
    emailVerified: false,
    createdAt: new Date().toISOString(),
  },
};
