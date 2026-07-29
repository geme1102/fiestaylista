import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../config.js', () => ({
  config: {
    NODE_ENV: 'test',
    CLOUDINARY_CLOUD_NAME: 'demo',
  },
}));

vi.mock('cloudinary', () => ({
  v2: {
    uploader: {
      destroy: vi.fn(),
    },
  },
}));

import { getPublicIdFromUrl, getCloudNameFromUrl, isOwnCloudinaryUrl, destroyWithRetry, UPLOAD_FOLDER } from '../utils/cloudinary.js';

let mockDestroy: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  const { v2: cloudinary } = await import('cloudinary');
  mockDestroy = vi.mocked(cloudinary.uploader.destroy);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('UPLOAD_FOLDER', () => {
  it('is fiestaylista', () => {
    expect(UPLOAD_FOLDER).toBe('fiestaylista');
  });
});

describe('getPublicIdFromUrl', () => {
  it('extracts public ID from standard Cloudinary URL', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/v123456/fiestaylista/event/abc123.jpg';
    expect(getPublicIdFromUrl(url)).toBe('fiestaylista/event/abc123');
  });

  it('extracts public ID without version', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/fiestaylista/photo.jpg';
    expect(getPublicIdFromUrl(url)).toBe('fiestaylista/photo');
  });

  it('returns null for non-Cloudinary URL', () => {
    expect(getPublicIdFromUrl('https://example.com/photo.jpg')).toBeNull();
  });

  it('returns null for invalid URL', () => {
    expect(getPublicIdFromUrl('not-a-url')).toBeNull();
  });
});

describe('getCloudNameFromUrl', () => {
  it('extracts cloud name from res.cloudinary.com URL', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/v1/photo.jpg';
    expect(getCloudNameFromUrl(url)).toBe('demo');
  });

  it('extracts cloud name from subdomain URL', () => {
    const url = 'https://demo.cloudinary.com/image/upload/v1/photo.jpg';
    expect(getCloudNameFromUrl(url)).toBe('demo');
  });

  it('returns null for non-Cloudinary URL', () => {
    expect(getCloudNameFromUrl('https://example.com/photo.jpg')).toBeNull();
  });
});

describe('isOwnCloudinaryUrl', () => {
  it('returns true for own cloud + prefix', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/v1/fiestaylista/event/abc.jpg';
    expect(isOwnCloudinaryUrl(url)).toBe(true);
  });

  it('returns false for different cloud name', () => {
    const url = 'https://res.cloudinary.com/other/image/upload/v1/fiestaylista/event/abc.jpg';
    expect(isOwnCloudinaryUrl(url)).toBe(false);
  });

  it('returns false for non-matching prefix', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/v1/other/photo.jpg';
    expect(isOwnCloudinaryUrl(url)).toBe(false);
  });

  it('returns false for non-Cloudinary URL', () => {
    expect(isOwnCloudinaryUrl('https://example.com/photo.jpg')).toBe(false);
  });
});

describe('destroyWithRetry', () => {
  it('returns true on successful destroy', async () => {
    mockDestroy.mockResolvedValueOnce({ result: 'ok' });

    const result = await destroyWithRetry('fiestaylista/event/abc123');

    expect(result).toBe(true);
    expect(mockDestroy).toHaveBeenCalledTimes(1);
    expect(mockDestroy).toHaveBeenCalledWith('fiestaylista/event/abc123');
  });

  it('retries on timeout and returns true on second attempt', async () => {
    mockDestroy
      .mockRejectedValueOnce(new Error('Cloudinary destroy timed out'))
      .mockResolvedValueOnce({ result: 'ok' });

    const promise = destroyWithRetry('test-public-id', { timeout: 1000, maxRetries: 2 });
    await vi.advanceTimersByTimeAsync(1000);

    const result = await promise;
    expect(result).toBe(true);
    expect(mockDestroy).toHaveBeenCalledTimes(2);
  });

  it('returns false after exhausting all retries', async () => {
    mockDestroy.mockRejectedValue(new Error('Network error'));

    const promise = destroyWithRetry('test-public-id', { timeout: 500, maxRetries: 2 });
    await vi.advanceTimersByTimeAsync(1000);

    const result = await promise;
    expect(result).toBe(false);
    expect(mockDestroy).toHaveBeenCalledTimes(2);
  });

  it('uses default timeout and maxRetries when not specified', async () => {
    mockDestroy.mockResolvedValueOnce({ result: 'ok' });

    const result = await destroyWithRetry('test-public-id');

    expect(result).toBe(true);
    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });
});
