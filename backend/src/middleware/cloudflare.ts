import type { Request, Response, NextFunction } from 'express';
import ipaddr from 'ipaddr.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('TrustProxy');

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

let lastProxyWarnAt = 0;
const PROXY_WARN_THROTTLE_MS = 60_000;

export function cloudflareIP(req: Request, _res: Response, next: NextFunction): void {
  const socketIP = req.socket.remoteAddress ?? '';
  const expressIP = req.ip ?? '';

  // Prioridad 1: Cloudflare directo (cf-connecting-ip validado por IP de Cloudflare)
  const connectingIP = req.headers['cf-connecting-ip'];
  if (connectingIP && typeof connectingIP === 'string' && isCloudflareIP(socketIP)) {
    try { Object.defineProperty(req, 'ip', { value: connectingIP, configurable: true, writable: true, enumerable: true }); } catch {}
    next();
    return;
  }

  // Prioridad 2: Netlify proxy — x-nf-client-ip es la IP real del cliente.
  // Con trust proxy=1, Express ya resuelve req.ip desde X-Forwarded-For.
  // x-nf-client-ip de Netlify es más confiable que el leftmost XFF.
  const netlifyClientIP = req.headers['x-nf-client-ip'];
  if (netlifyClientIP && typeof netlifyClientIP === 'string' && !isPrivateOrLocal(netlifyClientIP) && netlifyClientIP !== expressIP) {
    try { Object.defineProperty(req, 'ip', { value: netlifyClientIP, configurable: true, writable: true, enumerable: true }); } catch {}
    next();
    return;
  }

  // Express ya resolvió req.ip via trust proxy=1.
  // Si la IP resolvida es privada/local, el proxy está mal configurado.
  if (expressIP && isPrivateOrLocal(expressIP)) {
    const now = Date.now();
    if (now - lastProxyWarnAt > PROXY_WARN_THROTTLE_MS) {
      lastProxyWarnAt = now;
      log.warn({
        resolvedIP: expressIP,
        socketRemoteAddress: socketIP,
        xForwardedFor: req.headers['x-forwarded-for'] ?? null,
        xNfClientIp: req.headers['x-nf-client-ip'] ?? null,
      }, 'req.ip es una IP privada/interna — trust proxy puede estar mal configurado. Rate-limiting y SSE por IP pueden colapsar.');
    }
  }

  next();
}
