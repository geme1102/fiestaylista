import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockPost = vi.fn();
const mockGet = vi.fn();

vi.mock('../services/api', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
    put: vi.fn(),
    del: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('mercadopago service', () => {
  it('createCheckoutSession posts subscription data with defaults', async () => {
    mockPost.mockResolvedValue({ url: 'https://mpago.test/checkout/session_123' });
    const { createCheckoutSession } = await import('../services/mercadopago');

    const result = await createCheckoutSession('pro');

    expect(mockPost).toHaveBeenCalledWith('/api/subscriptions/create-checkout', {
      tier: 'pro',
      interval: 'month',
      successUrl: expect.stringContaining('/dashboard'),
      cancelUrl: expect.stringContaining('/pricing'),
    });
    expect(result.url).toContain('mpago.test');
  });

  it('createCheckoutSession accepts custom interval and urls', async () => {
    mockPost.mockResolvedValue({ url: 'https://mpago.test/custom' });
    const { createCheckoutSession } = await import('../services/mercadopago');

    await createCheckoutSession('pro', 'https://custom.test/success', 'https://custom.test/cancel', 'year', 'tok-abc');

    expect(mockPost).toHaveBeenCalledWith('/api/subscriptions/create-checkout', {
      tier: 'pro',
      interval: 'year',
      successUrl: 'https://custom.test/success',
      cancelUrl: 'https://custom.test/cancel',
      turnstileToken: 'tok-abc',
    });
  });

  it('getCurrentSubscription fetches subscription', async () => {
    mockGet.mockResolvedValue({ subscription: { id: 'sub-1', tier: 'premium' } });
    const { getCurrentSubscription } = await import('../services/mercadopago');

    const result = await getCurrentSubscription();

    expect(mockGet).toHaveBeenCalledWith('/api/subscriptions/current');
    expect(result.subscription?.tier).toBe('premium');
  });
});
