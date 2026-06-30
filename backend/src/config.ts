import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {}
}

loadEnv();

function warnConfig(key: string, value: string | undefined): void {
  if (!value) {
    console.error(`[config] Variable de entorno no configurada: ${key} — la funcionalidad asociada no estará disponible`);
  }
}

const DEFAULT_JWT_SECRETS = [
  'change-this-to-a-random-secret-at-least-32-chars',
  'change-this-to-another-random-secret',
];

function validateConfig(): void {
  warnConfig('DATABASE_URL', process.env.DATABASE_URL);
  warnConfig('JWT_SECRET', process.env.JWT_SECRET);
  warnConfig('JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET);
  warnConfig('JWT_GUEST_SECRET', process.env.JWT_GUEST_SECRET);

  if (DEFAULT_JWT_SECRETS.includes(process.env.JWT_SECRET || '')) {
    console.error('[config] JWT_SECRET debe cambiarse del valor por defecto');
  }
  if (DEFAULT_JWT_SECRETS.includes(process.env.JWT_REFRESH_SECRET || '')) {
    console.error('[config] JWT_REFRESH_SECRET debe cambiarse del valor por defecto');
  }
  if (DEFAULT_JWT_SECRETS.includes(process.env.JWT_GUEST_SECRET || '')) {
    console.error('[config] JWT_GUEST_SECRET debe cambiarse del valor por defecto');
  }

  const secrets = [process.env.JWT_SECRET, process.env.JWT_REFRESH_SECRET, process.env.JWT_GUEST_SECRET];
  if (new Set(secrets).size !== secrets.length) {
    console.error('[config] JWT_SECRET, JWT_REFRESH_SECRET y JWT_GUEST_SECRET deben ser diferentes entre sí');
  }

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    warnConfig('MERCADO_PAGO_ACCESS_TOKEN', process.env.MERCADO_PAGO_ACCESS_TOKEN);
    warnConfig('MERCADO_PAGO_WEBHOOK_SECRET', process.env.MERCADO_PAGO_WEBHOOK_SECRET);
    warnConfig('RESEND_API_KEY', process.env.RESEND_API_KEY);
    warnConfig('FROM_EMAIL', process.env.FROM_EMAIL);
    warnConfig('TURNSTILE_SECRET_KEY', process.env.TURNSTILE_SECRET_KEY);
    warnConfig('BACKEND_URL', process.env.BACKEND_URL);
    warnConfig('FRONTEND_URL', process.env.FRONTEND_URL);
    if (process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_SECRET) {
      warnConfig('CLOUDINARY_CLOUD_NAME', process.env.CLOUDINARY_CLOUD_NAME);
      warnConfig('CLOUDINARY_API_KEY', process.env.CLOUDINARY_API_KEY);
      warnConfig('CLOUDINARY_API_SECRET', process.env.CLOUDINARY_API_SECRET);
    }
  }
}

validateConfig();

export const config = {
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || '',
  JWT_GUEST_SECRET: process.env.JWT_GUEST_SECRET || '',
  MERCADO_PAGO_ACCESS_TOKEN: process.env.MERCADO_PAGO_ACCESS_TOKEN || '',
  MERCADO_PAGO_WEBHOOK_SECRET: process.env.MERCADO_PAGO_WEBHOOK_SECRET || '',
  BACKEND_URL: (process.env.BACKEND_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${process.env.PORT || '3001'}`)).replace(/\/+$/, '').trim(),
  FRONTEND_URL: (process.env.FRONTEND_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN.replace('backend', 'frontend')}` : 'http://localhost:5173')).trim(),
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ?? '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ?? '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ?? '',
  FROM_EMAIL: process.env.FROM_EMAIL || '',
  PRO_MONTHLY_PRICE_CENTS: parseInt(process.env.PRO_MONTHLY_PRICE_CENTS || '59900', 10),
  PRO_YEARLY_PRICE_CENTS: parseInt(process.env.PRO_YEARLY_PRICE_CENTS || '660000', 10),
  PRO_PLUS_MONTHLY_PRICE_CENTS: parseInt(process.env.PRO_PLUS_MONTHLY_PRICE_CENTS || '99900', 10),
  PRO_MONTHLY_CHECKOUT_URL: process.env.PRO_MONTHLY_CHECKOUT_URL || (
    process.env.MERCADO_PAGO_PRO_MONTHLY_PLAN_ID
      ? `https://www.mercadopago.com.co/subscriptions/checkout?preapproval_plan_id=${process.env.MERCADO_PAGO_PRO_MONTHLY_PLAN_ID}`
      : ''
  ),
  PRO_YEARLY_CHECKOUT_URL: process.env.PRO_YEARLY_CHECKOUT_URL || (
    process.env.MERCADO_PAGO_PRO_YEARLY_PLAN_ID
      ? `https://www.mercadopago.com.co/subscriptions/checkout?preapproval_plan_id=${process.env.MERCADO_PAGO_PRO_YEARLY_PLAN_ID}`
      : ''
  ),
  PRO_PLUS_MONTHLY_CHECKOUT_URL: process.env.PRO_PLUS_MONTHLY_CHECKOUT_URL || (process.env.MERCADO_PAGO_PRO_PLUS_LINK_URL || ''),
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY || '',
  SENTRY_DSN: process.env.SENTRY_DSN || '',
  DB_POOL_MAX: parseInt(process.env.DB_POOL_MAX || '25', 10),
  CLUSTER_WORKERS: parseInt(process.env.CLUSTER_WORKERS || '0', 10),
  PAYMENT_RATE_LIMIT: parseInt(process.env.PAYMENT_RATE_LIMIT || '10', 10),
  WEBHOOK_RATE_LIMIT: parseInt(process.env.WEBHOOK_RATE_LIMIT || '300', 10),
  API_RATE_LIMIT: parseInt(process.env.API_RATE_LIMIT || '200', 10),
} as const;
