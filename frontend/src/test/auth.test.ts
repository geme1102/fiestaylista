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

describe('auth service', () => {
  it('calls register with email, password, name, and turnstile token', async () => {
    mockPost.mockResolvedValue({ user: { id: '1' } });
    const { register } = await import('../services/auth');

    await register('test@test.com', 'Pass123!', 'Test User', 'turnstile-token');

    expect(mockPost).toHaveBeenCalledWith('/api/auth/register', {
      email: 'test@test.com',
      password: 'Pass123!',
      name: 'Test User',
      turnstileToken: 'turnstile-token',
    });
  });

  it('calls register without turnstile token', async () => {
    mockPost.mockResolvedValue({ user: { id: '1' } });
    const { register } = await import('../services/auth');

    await register('test@test.com', 'Pass123!', 'Test User');

    expect(mockPost).toHaveBeenCalledWith('/api/auth/register', expect.not.objectContaining({
      turnstileToken: expect.anything(),
    }));
  });

  it('calls login with email, password, and turnstile token', async () => {
    mockPost.mockResolvedValue({ user: { id: '1', emailVerified: true } });
    const { login } = await import('../services/auth');

    const result = await login('user@test.com', 'MyPass1!', 'tok-123');

    expect(mockPost).toHaveBeenCalledWith('/api/auth/login', {
      email: 'user@test.com',
      password: 'MyPass1!',
      turnstileToken: 'tok-123',
    }, { skipAuthRedirect: true, skipRefresh: true });
    expect(result.user.emailVerified).toBe(true);
  });

  it('calls getMe and returns user', async () => {
    mockGet.mockResolvedValue({ user: { id: '1', name: 'Test' }, isGuest: false });
    const { getMe } = await import('../services/auth');

    const result = await getMe();

    expect(mockGet).toHaveBeenCalledWith('/api/auth/me', { skipAuthRedirect: true, skipRefresh: true });
    expect(result.user).toEqual({ id: '1', name: 'Test' });
  });
});
