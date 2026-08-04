import { describe, expect, it } from 'vitest';
import { Writable } from 'node:stream';
import pino from 'pino';

// Replica exacta de los paths de redact de src/utils/logger.ts para
// verificar que ningún secreto quede en claro en los logs.
const REDACT_PATHS = [
  'password', '*.password', '*.*.password',
  'token', '*.token', '*.*.token',
  'refreshToken', '*.refreshToken', '*.*.refreshToken',
  'accessToken', '*.accessToken', '*.*.accessToken',
  'resetToken', '*.resetToken', '*.*.resetToken',
  'secret', '*.secret', '*.*.secret',
  'key', '*.key', '*.*.key',
  'apiKey', '*.apiKey', '*.*.apiKey',
  'authorization', 'cookie', 'set-cookie',
  'email', '*.email', '*.*.email',
  'to', '*.to', '*.*.to',
  'payerEmail', '*.payerEmail', '*.*.payerEmail',
  'hostPhone', '*.hostPhone', '*.*.hostPhone',
  'bankPhone', '*.bankPhone', '*.*.bankPhone',
];

function logOnce(payload: Record<string, unknown>): string {
  let out = '';
  const stream = new Writable({ write: (chunk, _enc, cb) => { out += chunk.toString(); cb(); } });
  const l = pino({ redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } }, stream);
  l.info(payload, 'test');
  return out;
}

describe('logger redact', () => {
  it('redacta secretos en el nivel raíz', () => {
    const out = logOnce({
      password: 'VAL_PASSWORD',
      token: 'VAL_TOKEN',
      refreshToken: 'VAL_REFRESH',
      accessToken: 'VAL_ACCESS',
      resetToken: 'VAL_RESET',
      secret: 'VAL_SECRET',
      apiKey: 'VAL_APIKEY',
      payerEmail: 'VAL_PAYER_EMAIL',
      hostPhone: 'VAL_HOST_PHONE',
      bankPhone: 'VAL_BANK_PHONE',
      safe: 'ok',
    });
    for (const secret of ['VAL_PASSWORD', 'VAL_TOKEN', 'VAL_REFRESH', 'VAL_ACCESS', 'VAL_RESET', 'VAL_SECRET', 'VAL_APIKEY', 'VAL_PAYER_EMAIL', 'VAL_HOST_PHONE', 'VAL_BANK_PHONE']) {
      expect(out).not.toContain(secret);
    }
    expect(out).toContain('ok');
  });

  it('redacta secretos anidados a 1 y 2 niveles de profundidad', () => {
    const out = logOnce({
      err: { token: 'VAL_NESTED_TOKEN', apiKey: 'VAL_NESTED_KEY' },
      data: { nested: { refreshToken: 'VAL_DEEP_REFRESH', secret: 'VAL_DEEP_SECRET' } },
    });
    for (const secret of ['VAL_NESTED_TOKEN', 'VAL_NESTED_KEY', 'VAL_DEEP_REFRESH', 'VAL_DEEP_SECRET']) {
      expect(out).not.toContain(secret);
    }
  });

  it('redacta emails en campos to/email a cualquier profundidad', () => {
    const out = logOnce({
      to: 'destinatario@example.com',
      email: 'origen@example.com',
      ctx: { email: 'nested@example.com', payload: { to: 'deep@example.com' } },
      safe: 'ok',
    });
    expect(out).not.toContain('destinatario@example.com');
    expect(out).not.toContain('origen@example.com');
    expect(out).not.toContain('nested@example.com');
    expect(out).not.toContain('deep@example.com');
    expect(out).toContain('ok');
  });

  it('no redacta campos no sensibles', () => {
    const out = logOnce({ eventId: 'abc', message: 'hola', status: 'ok' });
    expect(out).toContain('abc');
    expect(out).toContain('hola');
    expect(out).toContain('ok');
  });
});
