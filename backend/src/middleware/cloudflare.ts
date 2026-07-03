import type { Request, Response, NextFunction } from 'express';
import ipaddr from 'ipaddr.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('CloudflareIP');

const CLOUDFLARE_V4: string[] = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
  '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
  '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
];

const CLOUDFLARE_V6: string[] = [
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32',
  '2405:8100::/32', '2a06:98c0::/29', '2c0f:f250::/22',
];

const cfRanges = [...CLOUDFLARE_V4, ...CLOUDFLARE_V6].map(c => ipaddr.parseCIDR(c));

function isCloudflareIP(ip: string): boolean {
  try {
    const addr = ipaddr.parse(ip);
    return cfRanges.some(([range, bits]) => addr.match(range, bits));
  } catch {
    return false;
  }
}

function isPrivateOrLocal(ip: string): boolean {
  try {
    const addr = ipaddr.parse(ip);
    const range = addr.range();
    return range === 'private' || range === 'loopback' || range === 'linkLocal' || range === 'uniqueLocal';
  } catch {
    return false;
  }
}

// Diagnóstico de "trust proxy": si req.ip termina siendo una IP privada/interna,
// significa que Express no está resolviendo la IP real del cliente detrás del proxy
// (Netlify/Railway). Eso colapsaría el rate-limiting y el límite de SSE por IP.
let lastProxyWarnAt = 0;
const PROXY_WARN_THROTTLE_MS = 60_000;

export function cloudflareIP(req: Request, _res: Response, next: NextFunction): void {
  const connectingIP = req.headers['cf-connecting-ip'];
  const remoteIP = req.ip ?? req.socket.remoteAddress ?? '';

  // Prioridad 1: Cloudflare → directo a Railway (cf-connecting-ip directo)
  if (connectingIP && typeof connectingIP === 'string' && isCloudflareIP(remoteIP)) {
    try { Object.defineProperty(req, 'ip', { value: connectingIP, configurable: true, writable: true, enumerable: true }); } catch {}
    next();
    return;
  }

  // Prioridad 2: Cloudflare → Netlify → Railway
  // Netlify envía x-nf-client-ip con la IP real del cliente
  const netlifyClientIP = req.headers['x-nf-client-ip'];
  if (netlifyClientIP && typeof netlifyClientIP === 'string') {
    try { Object.defineProperty(req, 'ip', { value: netlifyClientIP, configurable: true, writable: true, enumerable: true }); } catch {}
    next();
    return;
  }

  // Prioridad 3: confiar en x-forwarded-for cuando viene de proxy conocido
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor && typeof forwardedFor === 'string') {
    const firstIP = forwardedFor.split(',')[0]?.trim();
    if (firstIP && !isPrivateOrLocal(firstIP)) {
      try { Object.defineProperty(req, 'ip', { value: firstIP, configurable: true, writable: true, enumerable: true }); } catch {}
      next();
      return;
    }
  }

  const resolvedIP = req.ip ?? '';
  if (resolvedIP && isPrivateOrLocal(resolvedIP)) {
    const now = Date.now();
    if (now - lastProxyWarnAt > PROXY_WARN_THROTTLE_MS) {
      lastProxyWarnAt = now;
      log.warn({
        resolvedIP,
        socketRemoteAddress: req.socket.remoteAddress,
        xForwardedFor: req.headers['x-forwarded-for'],
        cfConnectingIp: req.headers['cf-connecting-ip'] ?? null,
        xNfClientIp: req.headers['x-nf-client-ip'] ?? null,
      }, 'req.ip es una IP privada/interna: el rate-limiting y SSE por IP pueden estar colapsados. Revisa el valor de "trust proxy" detrás de tu proxy (Netlify/Railway).');
    }
  }

  next();
}


