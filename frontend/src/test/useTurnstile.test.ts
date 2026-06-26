import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';

let mockTurnstile: {
  render: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key');
  vi.useFakeTimers();
  mockTurnstile = {
    render: vi.fn(() => 'widget-1'),
    reset: vi.fn(),
    remove: vi.fn(),
    execute: vi.fn(),
  };
  window.turnstile = mockTurnstile as unknown as Window['turnstile'];
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  delete (window as any).turnstile;
  vi.restoreAllMocks();
});

function setContainerRef(result: { current: { containerRef: React.RefObject<HTMLDivElement | null> } }) {
  (result.current as any).containerRef.current = document.createElement('div');
}

describe('useTurnstile', () => {
  it('returns ready=true immediately when no SITE_KEY', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    const { useTurnstile } = await import('../hooks/useTurnstile');

    const { result } = renderHook(() => useTurnstile());

    expect(result.current.ready).toBe(true);
  });

  it('polls for window.turnstile and renders widget', async () => {
    window.turnstile = undefined as unknown as Window['turnstile'];
    const { useTurnstile } = await import('../hooks/useTurnstile');

    const { result } = renderHook(() => useTurnstile());
    expect(result.current.ready).toBe(false);

    window.turnstile = mockTurnstile as unknown as Window['turnstile'];
    setContainerRef(result);
    act(() => { vi.advanceTimersByTime(200); });

    expect(result.current.ready).toBe(true);
    expect(mockTurnstile.render).toHaveBeenCalledWith(
      result.current.containerRef.current,
      expect.objectContaining({ sitekey: 'test-site-key' })
    );
  });

  it('sets token via callback', async () => {
    const { useTurnstile } = await import('../hooks/useTurnstile');
    const { result } = renderHook(() => useTurnstile());

    setContainerRef(result);
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.ready).toBe(true);

    const renderOptions = mockTurnstile.render.mock.calls[0][1];
    act(() => { renderOptions.callback('turnstile-token-abc'); });

    expect(result.current.token).toBe('turnstile-token-abc');
    expect(result.current.error).toBeNull();
  });

  it('resets widget on expired-callback', async () => {
    const { useTurnstile } = await import('../hooks/useTurnstile');
    const { result } = renderHook(() => useTurnstile());

    setContainerRef(result);
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.ready).toBe(true);

    const renderOptions = mockTurnstile.render.mock.calls[0][1];
    act(() => { renderOptions.callback('tok-1'); });
    expect(result.current.token).toBe('tok-1');

    act(() => { renderOptions['expired-callback'](); });

    expect(result.current.token).toBeNull();
    expect(mockTurnstile.reset).toHaveBeenCalledWith('widget-1');
  });

  it('shows error after 50 failed polling attempts', async () => {
    window.turnstile = undefined as unknown as Window['turnstile'];
    const { useTurnstile } = await import('../hooks/useTurnstile');
    const { result } = renderHook(() => useTurnstile());

    act(() => { vi.advanceTimersByTime(200 * 51); });

    expect(result.current.ready).toBe(true);
    expect(result.current.error).toContain('bloqueador');
    expect(mockTurnstile.render).not.toHaveBeenCalled();
  });

  it('reset clears token and re-renders after timeout', async () => {
    const { useTurnstile } = await import('../hooks/useTurnstile');
    const { result } = renderHook(() => useTurnstile());

    setContainerRef(result);
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.ready).toBe(true);

    act(() => { result.current.reset(); });

    expect(result.current.token).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.ready).toBe(false);
    expect(mockTurnstile.reset).toHaveBeenCalledWith('widget-1');

    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.ready).toBe(true);
  });

  it('cleanup removes turnstile widget on unmount', async () => {
    const { useTurnstile } = await import('../hooks/useTurnstile');
    const { result, unmount } = renderHook(() => useTurnstile());

    setContainerRef(result);
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.ready).toBe(true);

    unmount();

    expect(mockTurnstile.remove).toHaveBeenCalledWith('widget-1');
  });

  it('stops polling and clears interval on unmount', async () => {
    window.turnstile = undefined as unknown as Window['turnstile'];
    const { useTurnstile } = await import('../hooks/useTurnstile');
    const { unmount } = renderHook(() => useTurnstile());

    unmount();
    act(() => { vi.advanceTimersByTime(200 * 60); });
    expect(mockTurnstile.render).not.toHaveBeenCalled();
  });
});
