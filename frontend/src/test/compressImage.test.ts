import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compressImage } from '../utils/compressImage';

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockCanvas() {
  const ctx = { drawImage: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
    (cb: (b: Blob | null) => void) => cb(new Blob()),
  );
  return ctx;
}

describe('compressImage', () => {
  it('returns original file for GIF', async () => {
    const file = new File([''], 'test.gif', { type: 'image/gif' });
    const result = await compressImage(file);
    expect(result).toBe(file);
  });

  it('resizes image when larger than MAX_DIMENSION', async () => {
    const img = new Image();
    img.width = 2400;
    img.height = 1200;
    vi.spyOn(window, 'Image').mockImplementation(() => img);
    mockCanvas();

    const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });
    const promise = compressImage(file);

    img.onload!(new Event('load'));

    const result = await promise;
    expect(result).toBeInstanceOf(Blob);
  });

  it('keeps image unchanged when smaller than MAX_DIMENSION', async () => {
    const img = new Image();
    img.width = 800;
    img.height = 600;
    vi.spyOn(window, 'Image').mockImplementation(() => img);
    const ctx = mockCanvas();

    const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });
    const promise = compressImage(file);

    img.onload!(new Event('load'));

    await promise;
    expect(ctx.drawImage).toHaveBeenCalledWith(img, 0, 0, 800, 600);
  });

  it('rejects when canvas context is null', async () => {
    const img = new Image();
    vi.spyOn(window, 'Image').mockImplementation(() => img);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });
    const promise = compressImage(file);

    img.onload!(new Event('load'));

    await expect(promise).rejects.toThrow('No se pudo crear el contexto del canvas');
  });

  it('rejects when image fails to load', async () => {
    const img = new Image();
    vi.spyOn(window, 'Image').mockImplementation(() => img);

    const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });
    const promise = compressImage(file);

    img.onerror!(new Event('error'));

    await expect(promise).rejects.toThrow('Error al cargar la imagen');
  });

  it('revokes blob URL after processing', async () => {
    const img = new Image();
    vi.spyOn(window, 'Image').mockImplementation(() => img);
    mockCanvas();

    const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });
    const promise = compressImage(file);

    img.onload!(new Event('load'));

    await promise;
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });

  it('rejects when toBlob returns null', async () => {
    const img = new Image();
    vi.spyOn(window, 'Image').mockImplementation(() => img);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      (cb: (b: Blob | null) => void) => cb(null),
    );

    const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });
    const promise = compressImage(file);

    img.onload!(new Event('load'));

    await expect(promise).rejects.toThrow('Error al comprimir la imagen');
  });
});
