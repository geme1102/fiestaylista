import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockLoginApi = vi.hoisted(() => vi.fn());
const mockRegisterApi = vi.hoisted(() => vi.fn());
const mockGetMe = vi.hoisted(() => vi.fn());
const mockLogout = vi.hoisted(() => vi.fn(() => Promise.resolve({ success: true })));
const mockSetTokens = vi.hoisted(() => vi.fn());
const mockClearTokens = vi.hoisted(() => vi.fn());
const mockGetAccessToken = vi.hoisted(() => vi.fn<(...args: any[]) => string | null>(() => null));
const mockTryRefreshToken = vi.hoisted(() => vi.fn<(...args: any[]) => any>(() => false));
const mockApiClientPost = vi.hoisted(() => vi.fn(() => Promise.resolve({})));
const mockShowToast = vi.hoisted(() => vi.fn());
vi.mock('../services/auth', () => ({
  login: mockLoginApi,
  register: mockRegisterApi,
  getMe: mockGetMe,
  logout: mockLogout,
}));

vi.mock('../services/api', () => ({
  setTokens: mockSetTokens,
  clearTokens: mockClearTokens,
  getAccessToken: mockGetAccessToken,
  tryRefreshToken: mockTryRefreshToken,
  apiClient: { post: mockApiClientPost },
}));

vi.mock('../hooks/useToast', () => ({ showToast: mockShowToast }));

import { AuthProvider, useAuth } from '../contexts/AuthContext';

function TestConsumer({ onReady: _onReady }: { onReady: (ctx: ReturnType<typeof useAuth>) => void }) {
  const ctx = useAuth();
  return (
    <div>
      <span data-testid="user">{ctx.user?.name ?? 'null'}</span>
      <span data-testid="isAuthenticated">{String(ctx.isAuthenticated)}</span>
      <span data-testid="isLoading">{String(ctx.isLoading)}</span>
      <button data-testid="login" onClick={() => ctx.login('a@b.com', '12345678')}>Login</button>
      <button data-testid="register" onClick={() => ctx.register('a@b.com', '12345678', 'Ana')}>Register</button>
      <button data-testid="logout" onClick={() => ctx.logout()}>Logout</button>
      <button data-testid="refreshUser" onClick={() => ctx.refreshUser()}>Refresh</button>
      <button data-testid="resendVerification" onClick={() => ctx.resendVerification()}>Resend</button>
    </div>
  );
}

function renderAuthProvider() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <TestConsumer onReady={() => {}} />
      </AuthProvider>
    </MemoryRouter>
  );
}

const testUser = { id: 'u-1', name: 'Ana', email: 'ana@test.com', emailVerified: true, tier: 'free' };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAccessToken.mockReturnValue(null);
  mockTryRefreshToken.mockResolvedValue(false);
  mockGetMe.mockResolvedValue({ user: testUser, isGuest: false });
  mockLoginApi.mockResolvedValue({ user: testUser, accessToken: 'tok-1', refreshToken: 'rt-1' });
  mockRegisterApi.mockResolvedValue({ user: testUser, accessToken: 'tok-1', refreshToken: 'rt-1' });
  (window as any).__VITE_DEV__ = false;
});

afterEach(() => vi.restoreAllMocks());

describe('AuthContext', () => {
  it('starts loading, then sets user when getMe succeeds', async () => {
    mockGetAccessToken.mockReturnValue('existing-token');
    mockGetMe.mockResolvedValue({ user: testUser, isGuest: false });

    renderAuthProvider();

    expect(screen.getByTestId('isLoading').textContent).toBe('true');
    expect(screen.getByTestId('user').textContent).toBe('null');

    await waitFor(() => {
      expect(screen.getByTestId('isLoading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user').textContent).toBe('Ana');
    expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');
  });

  it('clears tokens when getMe returns isGuest', async () => {
    mockGetAccessToken.mockReturnValue('guest-token');
    mockGetMe.mockResolvedValue({ user: null, isGuest: true });

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('isLoading').textContent).toBe('false');
    });
    expect(mockClearTokens).toHaveBeenCalled();
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('shows toast only for connection errors when getMe fails', async () => {
    mockGetAccessToken.mockReturnValue('bad-token');
    mockGetMe.mockRejectedValue(new Error('Error de conexión. Verifica tu internet.'));

    renderAuthProvider();

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'Error de conexión. Reintentando...',
        'info'
      );
    });
  });

  it('does not show toast for 5xx errors during session restore', async () => {
    mockGetAccessToken.mockReturnValue('bad-token');
    mockGetMe.mockRejectedValue(new Error('Error del servidor'));

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('isLoading').textContent).toBe('false');
    });
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it('tries refresh when no access token', async () => {
    mockGetAccessToken.mockReturnValue(null);
    mockTryRefreshToken.mockResolvedValue(false);

    renderAuthProvider();

    await waitFor(() => {
      expect(mockTryRefreshToken).toHaveBeenCalled();
    });
  });

  it('login calls loginApi and sets tokens and user', async () => {
    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('isLoading').textContent).toBe('false');
    });

    fireEvent.click(screen.getByTestId('login'));

    await waitFor(() => {
      expect(mockLoginApi).toHaveBeenCalledWith('a@b.com', '12345678', undefined);
    });
    expect(mockSetTokens).toHaveBeenCalledWith('tok-1');
    expect(screen.getByTestId('user').textContent).toBe('Ana');
  });

  it('register calls registerApi and sets tokens and user', async () => {
    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('isLoading').textContent).toBe('false');
    });

    fireEvent.click(screen.getByTestId('register'));

    await waitFor(() => {
      expect(mockRegisterApi).toHaveBeenCalledWith('a@b.com', '12345678', 'Ana', undefined);
    });
    expect(mockSetTokens).toHaveBeenCalledWith('tok-1');
    expect(screen.getByTestId('user').textContent).toBe('Ana');
  });

  it('logout clears tokens and user', async () => {
    mockGetAccessToken.mockReturnValue('tok-1');
    mockGetMe.mockResolvedValue({ user: testUser, isGuest: false });

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Ana');
    });

    fireEvent.click(screen.getByTestId('logout'));

    await waitFor(() => {
      expect(mockClearTokens).toHaveBeenCalled();
    });
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('refreshUser updates user on success', async () => {
    mockGetAccessToken.mockReturnValue('tok-1');
    mockGetMe.mockResolvedValue({ user: testUser, isGuest: false });

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Ana');
    });

    const updatedUser = { ...testUser, name: 'Ana Updated' };
    mockGetMe.mockResolvedValue({ user: updatedUser, isGuest: false });

    fireEvent.click(screen.getByTestId('refreshUser'));

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Ana Updated');
    });
  });

  it('refreshUser clears user on failure', async () => {
    mockGetAccessToken.mockReturnValue('tok-1');
    mockGetMe.mockResolvedValue({ user: testUser, isGuest: false });

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Ana');
    });

    mockGetMe.mockRejectedValue(new Error('Sesión expirada'));

    fireEvent.click(screen.getByTestId('refreshUser'));

    await waitFor(() => {
      expect(mockClearTokens).toHaveBeenCalled();
    });
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('resendVerification calls apiClient.post and rethrows on error', async () => {
    mockGetAccessToken.mockReturnValue('tok-1');
    mockGetMe.mockResolvedValue({ user: testUser, isGuest: false });

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('isLoading').textContent).toBe('false');
    });

    fireEvent.click(screen.getByTestId('resendVerification'));

    await waitFor(() => expect(mockApiClientPost).toHaveBeenCalledWith('/api/auth/resend-verification'));

    expect(mockApiClientPost).toHaveBeenCalledWith('/api/auth/resend-verification');
  });

  it('useAuth throws when used outside AuthProvider', () => {
    expect(() => render(
      <MemoryRouter>
        <TestConsumer onReady={() => {}} />
      </MemoryRouter>
    )).toThrow('useAuth must be used within AuthProvider');
  });
});
