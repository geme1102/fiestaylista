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

describe('cashFund service', () => {
  it('getCashFund fetches fund for event', async () => {
    mockGet.mockResolvedValue({ cashFund: { id: 'cf-1', isActive: true }, promisedTotal: 0 });
    const { getCashFund } = await import('../services/cashFund');

    const result = await getCashFund('evt-1');

    expect(mockGet).toHaveBeenCalledWith('/api/events/evt-1/cash-fund');
    expect(result.cashFund?.id).toBe('cf-1');
  });

  it('getContributions fetches contributions for fund', async () => {
    mockGet.mockResolvedValue({ contributions: [{ id: 'ct-1', amount: 50000 }] });
    const { getContributions } = await import('../services/cashFund');

    const result = await getContributions('cf-1');

    expect(mockGet).toHaveBeenCalledWith('/api/cash-fund/cf-1/contributions', { skipAuthRedirect: true });
    expect(result.contributions).toHaveLength(1);
  });

  it('boostEvent posts to /api/events/:id/boost without body', async () => {
    mockPost.mockResolvedValue({ ok: true });
    const { boostEvent } = await import('../services/cashFund');

    await boostEvent('evt-1');

    expect(mockPost).toHaveBeenCalledWith('/api/events/evt-1/boost');
  });

  it('createPromise posts promise to /api/cash-fund/promise', async () => {
    mockPost.mockResolvedValue({ contribution: { id: 'c-1', amount: 100000 }, cashFund: { id: 'cf-1', collectedAmount: 100000 } });
    const { createPromise } = await import('../services/cashFund');

    const result = await createPromise({
      cashFundId: 'cf-1',
      contributorName: 'Juan',
      amount: 100000,
    });

    expect(mockPost).toHaveBeenCalledWith('/api/cash-fund/promise', {
      cashFundId: 'cf-1',
      contributorName: 'Juan',
      amount: 100000,
    });
    expect(result.contribution.amount).toBe(100000);
  });
});
