import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const useTurnstileMock = vi.hoisted(() => vi.fn());
vi.mock('../hooks/useTurnstile', () => ({
  useTurnstile: (...args: unknown[]) => useTurnstileMock(...args),
  waitForTurnstile: async () => null,
}));

import GiftCard from '../components/GiftCard';

const groupGift = {
  id: '3',
  eventId: 'event-1',
  name: 'Cuna',
  isClaimed: false,
  isGroupGift: true,
  createdAt: new Date().toISOString(),
};

describe('GiftCard - Turnstile bajo demanda (D1-C3)', () => {
  beforeEach(() => {
    useTurnstileMock.mockClear();
    useTurnstileMock.mockReturnValue({
      containerRef: { current: null },
      token: null,
      ready: true,
      reset: vi.fn(),
      error: null,
    });
  });

  it('el hook corre desactivado ({ enabled: false }) con el form de claim cerrado', () => {
    render(<GiftCard gift={groupGift} />);
    expect(useTurnstileMock).toHaveBeenLastCalledWith({ enabled: false });
  });

  it('el hook se activa ({ enabled: true }) al abrir el form de claim grupal', () => {
    render(<GiftCard gift={groupGift} />);
    fireEvent.click(screen.getByText('Unirme al grupo'));
    expect(useTurnstileMock).toHaveBeenLastCalledWith({ enabled: true });
  });
});
