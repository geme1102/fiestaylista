import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

// F7 (auditoría): token one-click unsubscribe compartido entre services/email.ts
// (generación) y routes/unsubscribe.ts (verificación) — antes la lógica HMAC
// estaba duplicada en ambos archivos (riesgo de drift).
// Formato: <hmac-sha256 hex>.<email base64url>. El HMAC usa el email como clave
// y JWT_SECRET como mensaje: el secreto nunca viaja en el token, solo quien lo
// conoce puede generar/verificar tokens válidos.

function safeHmacEqual(received: string, expected: string): boolean {
  try {
    const a = Buffer.from(received, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || a.length === 0) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function createUnsubscribeToken(email: string): string {
  const emailB64 = Buffer.from(email).toString('base64url');
  const hmac = createHmac('sha256', email).update(config.JWT_SECRET).digest('hex');
  return `${hmac}.${emailB64}`;
}

export function recoverEmailFromToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [hmacFragment, emailB64] = parts;
    const email = Buffer.from(emailB64, 'base64url').toString('utf-8');
    const expectedHmac = createHmac('sha256', email).update(config.JWT_SECRET).digest('hex');
    if (!safeHmacEqual(hmacFragment, expectedHmac)) return null;
    return email;
  } catch {
    return null;
  }
}
