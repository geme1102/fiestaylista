import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockResendSend = vi.hoisted(() => vi.fn());

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({ emails: { send: mockResendSend } })),
}));

vi.mock('../config.js', () => ({
  config: {
    JWT_SECRET: 'test-secret-32-characters-minimum!!!',
    FRONTEND_URL: 'https://fiestaylista.com',
    BACKEND_URL: 'https://api.fiestaylista.com',
    FROM_EMAIL: 'soporte@fiestaylista.com',
    RESEND_API_KEY: 're_test_key',
  },
}));

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn() },
}));

vi.mock('../db/schema.js', () => ({
  emailSuppressions: {},
}));

vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), fatal: vi.fn(), debug: vi.fn() }),
}));

vi.mock('../utils/sanitize.js', () => ({
  stripHtmlToText: (html: string) => html,
  escapeHtml: (s: string) => s,
}));

import { sendVerificationEmail, sendReminderEmail } from '../services/email.js';
import { createUnsubscribeToken, recoverEmailFromToken } from '../utils/unsubscribeToken.js';

async function mockSuppressionQuery(rows: { id: string }[]) {
  const { db } = await import('../db/index.js');
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as any);
  return db;
}

describe('sendEmail — supresión (F7)', () => {  beforeEach(() => {
    vi.resetAllMocks();
    mockResendSend.mockResolvedValue({ id: 'email-1' });
  });

  it('F7: los transaccionales (verification/password_reset) se envían aunque haya supresión', async () => {
    await mockSuppressionQuery([{ id: 's-1' }]);

    await sendVerificationEmail('user@test.com', 'verify-token');

    expect(mockResendSend).toHaveBeenCalledTimes(1);
    const payload = mockResendSend.mock.calls[0][0];
    expect(payload.to).toBe('user@test.com');
    expect(payload.headers).toEqual({});
    expect(payload.html).not.toContain('unsubscribe');
  });

  it('F7: un email no-transaccional con supresión previa NO se envía', async () => {
    await mockSuppressionQuery([{ id: 's-1' }]);

    await sendReminderEmail('user@test.com', 'Mi Evento', 'mi-evento', 3);

    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it('F7: sin supresión, el email no-transaccional se envía con footer y header de baja tokenizados', async () => {
    await mockSuppressionQuery([]);

    await sendReminderEmail('user@test.com', 'Mi Evento', 'mi-evento', 3);

    expect(mockResendSend).toHaveBeenCalledTimes(1);
    const payload = mockResendSend.mock.calls[0][0];
    expect(payload.html).toContain('/unsubscribe?token=');
    expect(payload.html).toContain('https://api.fiestaylista.com/unsubscribe?token=');
    expect(payload.html).not.toContain('href="https://fiestaylista.com/unsubscribe');
    const headerUrl = payload.headers['List-Unsubscribe'] as string;
    expect(headerUrl).toContain('https://api.fiestaylista.com/unsubscribe?token=');
    const token = headerUrl.split('token=')[1];
    expect(recoverEmailFromToken(token)).toBe('user@test.com');
  });
});

describe('unsubscribeToken', () => {
  it('crea y recupera el email del token (misma lógica en email y ruta)', () => {
    const token = createUnsubscribeToken('otro@test.com');
    expect(recoverEmailFromToken(token)).toBe('otro@test.com');
  });

  it('rechaza tokens corruptos o de otro secreto', () => {
    expect(recoverEmailFromToken('abc')).toBeNull();
    expect(recoverEmailFromToken('aaa.bbb')).toBeNull();
    expect(recoverEmailFromToken(createUnsubscribeToken('a@b.com').slice(0, -2))).toBeNull();
  });
});
