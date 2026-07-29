import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Cloudinary');

export const UPLOAD_FOLDER = 'fiestaylista';
const UPLOAD_FOLDER_PREFIX = UPLOAD_FOLDER + '/';

export function getPublicIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('cloudinary.com')) return null;

    const match = u.pathname.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function getCloudNameFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('cloudinary.com')) return null;
    const parts = u.hostname.split('.');
    if (parts[0] === 'res') {
      return u.pathname.split('/').filter(Boolean)[0] || null;
    }
    if (parts.length >= 3) {
      return parts[0] || null;
    }
    return null;
  } catch {
    return null;
  }
}

export function isOwnCloudinaryUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('cloudinary.com')) return false;

    const cloudName = getCloudNameFromUrl(url);
    const configuredCloud = config.CLOUDINARY_CLOUD_NAME;
    if (configuredCloud && cloudName && cloudName !== configuredCloud) return false;

    const publicId = getPublicIdFromUrl(url);
    if (!publicId || !publicId.startsWith(UPLOAD_FOLDER_PREFIX)) return false;

    return true;
  } catch {
    return false;
  }
}

export async function destroyWithRetry(
  publicId: string,
  options?: { timeout?: number; maxRetries?: number }
): Promise<boolean> {
  const timeout = options?.timeout ?? 10000;
  const maxRetries = options?.maxRetries ?? 2;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      let timer: ReturnType<typeof setTimeout>;
      await Promise.race([
        cloudinary.uploader.destroy(publicId),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Cloudinary destroy timed out')), timeout);
        }),
      ]).finally(() => clearTimeout(timer!));
      return true;
    } catch (err) {
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 1000));
      } else {
        log.error({ err, publicId }, 'Error eliminando de Cloudinary tras retry:');
        return false;
      }
    }
  }
  return false;
}
