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

function requireConfig(key: string, value: string | undefined): asserts value is string {
  if (!value) {
    throw new Error(`Variable de entorno requerida: ${key}`);
  }
}

const DEFAULT_JWT_SECRETS = [
  'change-this-to-a-random-secret-at-least-32-chars',
  'change-this-to-another-random-secret',
];

function validateConfig(): void {
  requireConfig('DATABASE_URL', process.env.DATABASE_URL);
  requireConfig('JWT_SECRET', process.env.JWT_SECRET);
  requireConfig('JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET);
  requireConfig('JWT_GUEST_SECRET', process.env.JWT_GUEST_SECRET);

  if (DEFAULT_JWT_SECRETS.includes(process.env.JWT_SECRET || '')) {
    throw new Error('Variable de entorno requerida: JWT_SECRET debe cambiarse del valor por defecto');
  }
  if (DEFAULT_JWT_SECRETS.includes(process.env.JWT_REFRESH_SECRET || '')) {
    throw new Error('Variable de entorno requerida: JWT_REFRESH_SECRET debe cambiarse del valor por defecto');
  }
  if (DEFAULT_JWT_SECRETS.includes(process.env.JWT_GUEST_SECRET || '')) {
    throw new Error('Variable de entorno requerida: JWT_GUEST_SECRET debe cambiarse del valor por defecto');
  }

  const secrets = [process.env.JWT_SECRET, process.env.JWT_REFRESH_SECRET, process.env.JWT_GUEST_SECRET];
  if (new Set(secrets).size !== secrets.length) {
    throw new Error('JWT_SECRET, JWT_REFRESH_SECRET y JWT_GUEST_SECRET deben ser diferentes entre sí');
  }

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    requireConfig('MERCADO_PAGO_ACCESS_TOKEN', process.env.MERCADO_PAGO_ACCESS_TOKEN);
    requireConfig('MERCADO_PAGO_WEBHOOK_SECRET', process.env.MERCADO_PAGO_WEBHOOK_SECRET);
    requireConfig('MERCADO_PAGO_PRO_MONTHLY_PLAN_ID', process.env.MERCADO_PAGO_PRO_MONTHLY_PLAN_ID);
    requireConfig('MERCADO_PAGO_PRO_YEARLY_PLAN_ID', process.env.MERCADO_PAGO_PRO_YEARLY_PLAN_ID);
    requireConfig('RESEND_API_KEY', process.env.RESEND_API_KEY);
    requireConfig('FROM_EMAIL', process.env.FROM_EMAIL);
    requireConfig('TURNSTILE_SECRET_KEY', process.env.TURNSTILE_SECRET_KEY);
  }
}

validateConfig();

export const config = {
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
  JWT_GUEST_SECRET: process.env.JWT_GUEST_SECRET!,
  MERCADO_PAGO_ACCESS_TOKEN: process.env.MERCADO_PAGO_ACCESS_TOKEN || '',
  MERCADO_PAGO_WEBHOOK_SECRET: process.env.MERCADO_PAGO_WEBHOOK_SECRET || '',
  MERCADO_PAGO_PRO_MONTHLY_PLAN_ID: process.env.MERCADO_PAGO_PRO_MONTHLY_PLAN_ID ?? '',
  MERCADO_PAGO_PRO_YEARLY_PLAN_ID: process.env.MERCADO_PAGO_PRO_YEARLY_PLAN_ID ?? '',
  BACKEND_URL: process.env.BACKEND_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${process.env.PORT || '3001'}`),
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ?? '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ?? '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ?? '',
  FROM_EMAIL: process.env.FROM_EMAIL || '',
  BOOST_PRICE_CENTS: parseInt(process.env.BOOST_PRICE_CENTS || '10000', 10),
  CONTRIBUTION_EXPIRY_HOURS: parseInt(process.env.CONTRIBUTION_EXPIRY_HOURS || '24', 10),
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY || '',
} as const;

const isProduction = config.NODE_ENV === 'production';

if (isProduction && (config.BACKEND_URL.includes('localhost') || config.FRONTEND_URL.includes('localhost'))) {
  const missing: string[] = [];
  if (config.BACKEND_URL.includes('localhost')) missing.push('BACKEND_URL');
  if (config.FRONTEND_URL.includes('localhost')) missing.push('FRONTEND_URL');
  console.error(`[config] ERROR: En producción las siguientes variables deben configurarse en Railway:`);
  missing.forEach(v => console.error(`[config]   - ${v}`));
  console.error(`[config] El servidor se detiene para evitar fallos silenciosos.`);
  process.exit(1);
}
