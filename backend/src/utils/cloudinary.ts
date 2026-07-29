import { config } from '../config.js';

const UPLOAD_FOLDER_PREFIX = 'fiestaylista/';

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
    // res.cloudinary.com/<cloud_name>/...
    if (parts[0] === 'res') {
      return u.pathname.split('/').filter(Boolean)[0] || null;
    }
    // <cloud_name>.cloudinary.com/...
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
