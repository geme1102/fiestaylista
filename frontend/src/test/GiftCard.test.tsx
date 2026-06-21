import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GiftCard from '../components/GiftCard';

const unclaimedGift = {
  id: '1',
  eventId: 'event-1',
  name: 'Set de Ollas',
  isClaimed: false,
  createdAt: new Date().toISOString(),
};

const claimedGift = {
  id: '2',
  eventId: 'event-1',
  name: 'Batidora',
  isClaimed: true,
  claimedBy: 'María Pérez',
  createdAt: new Date().toISOString(),
};

describe('GiftCard', () => {
  it('debería renderizar un regalo no apartado', () => {
    render(<GiftCard gift={unclaimedGift} />);
    expect(screen.getByText('Set de Ollas')).toBeInTheDocument();
    expect(screen.queryByText('María Pérez')).not.toBeInTheDocument();
  });

  it('debería mostrar "Alguien ya apartó" para invitados', () => {
    render(<GiftCard gift={claimedGift} />);
    expect(screen.getByText('Alguien ya apartó este regalo')).toBeInTheDocument();
  });

  it('debería mostrar quién apartó el regalo solo para admin', () => {
    render(<GiftCard gift={claimedGift} isAdmin />);
    expect(screen.getByText('María Pérez')).toBeInTheDocument();
  });

  it('debería llamar a onClaim al hacer click en "Regalar este detalle"', () => {
    const onClaim = vi.fn();
    render(<GiftCard gift={unclaimedGift} onClaim={onClaim} />);
    const claimBtn = screen.getByRole('button', { name: /regalar este detalle/i });
    fireEvent.click(claimBtn);
    expect(onClaim).toHaveBeenCalledWith('1', 'Set de Ollas');
  });

  it('debería mostrar botón de liberar para admin', () => {
    const onFree = vi.fn();
    render(<GiftCard gift={claimedGift} onFree={onFree} isAdmin />);
    expect(screen.getByRole('button', { name: /liberar/i })).toBeInTheDocument();
  });

  it('debería llamar a onDelete con el id del regalo', () => {
    const onDelete = vi.fn();
    render(<GiftCard gift={unclaimedGift} onDelete={onDelete} isAdmin />);
    const deleteBtn = screen.getByTitle('Eliminar regalo');
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith('1');
  });

  it('debería deshabilitar botón cuando está en proceso de claim', () => {
    render(<GiftCard gift={unclaimedGift} claimingId="1" onClaim={vi.fn()} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
