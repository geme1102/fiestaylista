import type { Request, Response, NextFunction } from 'express';
import ipaddr from 'ipaddr.js';

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

export function cloudflareIP(req: Request, _res: Response, next: NextFunction): void {
  const connectingIP = req.headers['cf-connecting-ip'];
  const remoteIP = req.ip ?? req.socket.remoteAddress ?? '';

  if (connectingIP && typeof connectingIP === 'string' && isCloudflareIP(remoteIP)) {
    (req as any).ip = connectingIP;
  }

  next();
}

export function trustCloudflare(ip: string): boolean {
  return isCloudflareIP(ip);
}
