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
    console.warn(`[config] Variable opcional no configurada: ${key} — la funcionalidad asociada no estará disponible`);
  }
}

function failConfig(reason: string): never {
  console.error(`[config] ERROR CRÍTICO: ${reason}`);
  console.error('[config] El servidor no puede iniciar. Corrige las variables de entorno y reinicia.');
  process.exit(1);
}

const DEFAULT_JWT_SECRETS = [
  'change-this-to-a-random-secret-at-least-32-chars',
  'change-this-to-another-random-secret',
];

function validateConfig(): void {
  // Validaciones críticas — detienen el servidor
  if (!process.env.DATABASE_URL) {
    failConfig('DATABASE_URL no está configurada');
  }
  if (!process.env.DATABASE_URL.startsWith('postgresql://')) {
    failConfig('DATABASE_URL debe comenzar con postgresql://');
  }

  // Detectar Neon y verificar PgBouncer para escalabilidad horizontal
  try {
    const dbHost = new URL(process.env.DATABASE_URL).hostname;
    const isNeon = dbHost.endsWith('.neon.tech');
    const hasPooler = dbHost.includes('-pooler') || process.env.DATABASE_URL.includes('pgbouncer=true');
    if (isNeon && !hasPooler) {
      console.warn('[config] ════════════════════════════════════════════════════════════');
      console.warn('[config]  DATABASE_URL apunta a Neon sin PgBouncer configurado.');
      console.warn('[config]  Para escalar a múltiples instancias Railway, agrega:');
      console.warn('[config]    ?pgbouncer=true al final de DATABASE_URL');
      console.warn('[config]  O usa el host -pooler de Neon.');
      console.warn('[config] ════════════════════════════════════════════════════════════');
    }
  } catch {} // Si la URL es inválida, el failConfig de abajo lo atrapa

  if (!process.env.JWT_SECRET) {
    failConfig('JWT_SECRET no está configurado');
  }
  if (!process.env.JWT_REFRESH_SECRET) {
    failConfig('JWT_REFRESH_SECRET no está configurado');
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    failConfig('JWT_SECRET debe tener al menos 32 caracteres');
  }
  if (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length < 32) {
    failConfig('JWT_REFRESH_SECRET debe tener al menos 32 caracteres');
  }

  if (DEFAULT_JWT_SECRETS.includes(process.env.JWT_SECRET || '')) {
    failConfig('JWT_SECRET debe cambiarse del valor por defecto');
  }
  if (DEFAULT_JWT_SECRETS.includes(process.env.JWT_REFRESH_SECRET || '')) {
    failConfig('JWT_REFRESH_SECRET debe cambiarse del valor por defecto');
  }

  const secrets = [process.env.JWT_SECRET, process.env.JWT_REFRESH_SECRET];
  if (new Set(secrets).size !== secrets.length) {
    failConfig('JWT_SECRET y JWT_REFRESH_SECRET deben ser diferentes entre sí');
  }

  // Validar NODE_ENV
  if (!process.env.NODE_ENV) {
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
      process.env.NODE_ENV = 'production';
    } else {
      console.warn('[config] NODE_ENV no configurado, usando "development". ¡No usar en producción!');
      process.env.NODE_ENV = 'development';
    }
  }

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) failConfig('MERCADO_PAGO_ACCESS_TOKEN no está configurado');
    if (!process.env.MERCADO_PAGO_WEBHOOK_SECRET) failConfig('MERCADO_PAGO_WEBHOOK_SECRET no está configurado');
    if (!process.env.RESEND_API_KEY) failConfig('RESEND_API_KEY no está configurado');
    if (!process.env.FROM_EMAIL) failConfig('FROM_EMAIL no está configurado');
    warnConfig('RESEND_WEBHOOK_SECRET', process.env.RESEND_WEBHOOK_SECRET);
    warnConfig('TURNSTILE_SECRET_KEY', process.env.TURNSTILE_SECRET_KEY);
    if (!process.env.BACKEND_URL && !process.env.RAILWAY_PUBLIC_DOMAIN) {
      failConfig('BACKEND_URL no está configurado y no hay RAILWAY_PUBLIC_DOMAIN');
    }
    if (process.env.BACKEND_URL && !process.env.BACKEND_URL.startsWith('http://') && !process.env.BACKEND_URL.startsWith('https://')) {
      failConfig('BACKEND_URL debe comenzar con http:// o https://');
    }
    if (!process.env.FRONTEND_URL) failConfig('FRONTEND_URL no está configurado');
    if (!process.env.FRONTEND_URL.startsWith('http://') && !process.env.FRONTEND_URL.startsWith('https://')) {
      failConfig('FRONTEND_URL debe comenzar con http:// o https://');
    }


    // Recordatorio de infraestructura (Netlify/Railway — Cloudflare NO proxy del dominio):
    // - SSL del frontend: certificados automáticos de Netlify sobre fiestaylista.com.
    // - SSL de la API: dominio público de Railway (*.up.railway.app).
    // - Cloudflare se usa SOLO para Turnstile (CAPTCHA), no como CDN/proxy.
    // - Si el proyecto Railway se renombra, actualizar netlify.toml (redirect /api/*)
    //   y el CSP connect-src, además de BACKEND_URL.
    console.warn('[config] ════════════════════════════════════════════════════════════');
    console.warn('[config]  SSL/HTTPS gestionado por Netlify (frontend) y Railway (API).');
    console.warn('[config]  Cloudflare solo participa como Turnstile (CAPTCHA).');
    console.warn('[config]  Si Railway se renombra: actualizar netlify.toml, CSP, BACKEND_URL.');
    console.warn('[config] ════════════════════════════════════════════════════════════');

    const cloudKeys = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'] as const;
    const present = cloudKeys.filter(k => process.env[k]);
    if (present.length > 0 && present.length < cloudKeys.length) {
      const missing = cloudKeys.filter(k => !process.env[k]);
      failConfig(`Cloudinary configurado parcialmente. Faltan: ${missing.join(', ')}`);
    }

    warnConfig('MERCADO_PAGO_PRO_MONTHLY_PLAN_ID', process.env.MERCADO_PAGO_PRO_MONTHLY_PLAN_ID);
    warnConfig('MERCADO_PAGO_PRO_YEARLY_PLAN_ID', process.env.MERCADO_PAGO_PRO_YEARLY_PLAN_ID);
    warnConfig('MERCADO_PAGO_PRO_PLUS_MONTHLY_PLAN_ID', process.env.MERCADO_PAGO_PRO_PLUS_MONTHLY_PLAN_ID);
  }
}

validateConfig();

export const config = {
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || '',
  MERCADO_PAGO_ACCESS_TOKEN: process.env.MERCADO_PAGO_ACCESS_TOKEN || '',
  MERCADO_PAGO_WEBHOOK_SECRET: process.env.MERCADO_PAGO_WEBHOOK_SECRET || '',
  BACKEND_URL: (process.env.BACKEND_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${process.env.PORT || '3001'}`)).replace(/\/+$/, '').trim(),
  FRONTEND_URL: (() => {
    const raw = (process.env.FRONTEND_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://fiestaylista.com` : 'http://localhost:5173')).trim();
    if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
      failConfig(`FRONTEND_URL="${raw}" debe comenzar con http:// o https://`);
    }
    return raw;
  })(),
  PORT: (() => { const p = parseInt(process.env.PORT || '3001', 10); return Number.isNaN(p) ? 3001 : p; })(),
  NODE_ENV: process.env.NODE_ENV as string,
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
  PRO_PLUS_YEARLY_PRICE_CENTS: parseInt(process.env.PRO_PLUS_YEARLY_PRICE_CENTS || '1098900', 10),
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
  PRO_PLUS_MONTHLY_CHECKOUT_URL: process.env.PRO_PLUS_MONTHLY_CHECKOUT_URL || (
    process.env.MERCADO_PAGO_PRO_PLUS_MONTHLY_PLAN_ID
      ? `https://www.mercadopago.com.co/subscriptions/checkout?preapproval_plan_id=${process.env.MERCADO_PAGO_PRO_PLUS_MONTHLY_PLAN_ID}`
      : ''
  ),
  PRO_MONTHLY_PLAN_ID: process.env.MERCADO_PAGO_PRO_MONTHLY_PLAN_ID || '',
  PRO_YEARLY_PLAN_ID: process.env.MERCADO_PAGO_PRO_YEARLY_PLAN_ID || '',
  PRO_PLUS_MONTHLY_PLAN_ID: process.env.MERCADO_PAGO_PRO_PLUS_MONTHLY_PLAN_ID || '',
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY || '',
  SENTRY_DSN: process.env.SENTRY_DSN || '',
  DB_POOL_MAX: parseInt(process.env.DB_POOL_MAX || '5', 10),
  CLUSTER_WORKERS: parseInt(process.env.CLUSTER_WORKERS || '0', 10),
  PAYMENT_RATE_LIMIT: parseInt(process.env.PAYMENT_RATE_LIMIT || '10', 10),
  WEBHOOK_RATE_LIMIT: parseInt(process.env.WEBHOOK_RATE_LIMIT || '600', 10),
  API_RATE_LIMIT: parseInt(process.env.API_RATE_LIMIT || '200', 10),
} as const;
