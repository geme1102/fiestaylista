import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config.js', () => ({
  config: {
    NODE_ENV: 'test',
    CLOUDINARY_CLOUD_NAME: 'demo',
  },
}));

vi.mock('../db/index.js', () => ({
  db: {
    transaction: vi.fn(),
    select: vi.fn(),
    delete: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    set: vi.fn(),
    for: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
    orderBy: vi.fn(),
    update: vi.fn(),
  },
  sql: vi.fn(),
}));

vi.mock('../db/schema.js', () => ({
  photos: { id: 'photos.id', eventId: 'photos.event_id', url: 'photos.url', caption: 'photos.caption', createdAt: 'photos.created_at' },
  events: { id: 'events.id', userId: 'events.user_id' },
  users: { id: 'users.id', tier: 'users.tier' },
}));

vi.mock('cloudinary', () => ({
  v2: {
    uploader: {
      destroy: vi.fn(),
    },
  },
}));

import { db } from '../db/index.js';
import { addPhoto, deletePhoto, getEventPhotos } from '../services/photo.js';

function mockTransaction(cb: (tx: any) => any) {
  return cb(mockTx);
}

let mockTx: any;

beforeEach(() => {
  vi.clearAllMocks();

  mockTx = {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn(),
    for: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  };
});

describe('addPhoto', () => {
  it('throws ValidationError for invalid URL', async () => {
    (db.transaction as any).mockImplementation(mockTransaction);

    await expect(addPhoto('evt-1', 'not-a-url')).rejects.toThrow(
      'La URL de la foto no es válida',
    );
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when event does not exist', async () => {
    (db.transaction as any).mockImplementation(mockTransaction);

    mockTx.where
      .mockReturnValueOnce(mockTx)
      .mockReturnValueOnce(mockTx);
    mockTx.limit
      .mockResolvedValueOnce([])
      .mockResolvedValue([]);

    await expect(addPhoto('evt-1', 'https://example.com/photo.jpg')).rejects.toThrow(
      'Evento no encontrado',
    );
  });

  it('throws ValidationError when photo limit exceeded', async () => {
    (db.transaction as any).mockImplementation(mockTransaction);

    mockTx.where
      .mockReturnValueOnce(mockTx)
      .mockReturnValueOnce(mockTx)
      .mockResolvedValueOnce([{ count: 3 }]);
    mockTx.limit
      .mockResolvedValueOnce([{ userId: 'user-1', isActive: true }])
      .mockResolvedValueOnce([{ tier: 'free' }])
      .mockResolvedValue([]);

    await expect(addPhoto('evt-1', 'https://example.com/photo.jpg')).rejects.toThrow(
      'Has alcanzado el límite de 0 fotos por evento en tu plan free',
    );
  });

  it('inserts photo when limit not reached', async () => {
    (db.transaction as any).mockImplementation(mockTransaction);

    mockTx.where
      .mockReturnValueOnce(mockTx)
      .mockReturnValueOnce(mockTx)
      .mockResolvedValueOnce([{ count: 1 }]);
    mockTx.limit
      .mockResolvedValueOnce([{ userId: 'user-1', isActive: true }])
      .mockResolvedValueOnce([{ tier: 'pro' }])
      .mockResolvedValue([]);
    mockTx.returning
      .mockResolvedValueOnce([{ id: 'photo-1', eventId: 'evt-1', url: 'https://example.com/photo.jpg' }])
      .mockResolvedValue([]);

    const photo = await addPhoto('evt-1', 'https://example.com/photo.jpg', 'Mi foto');

    expect(photo).toEqual({ id: 'photo-1', eventId: 'evt-1', url: 'https://example.com/photo.jpg' });
    expect(mockTx.insert).toHaveBeenCalled();
    expect(mockTx.values).toHaveBeenCalledWith({
      eventId: 'evt-1',
      url: 'https://example.com/photo.jpg',
      caption: 'Mi foto',
    });
  });

  it('allows pro users more photos', async () => {
    (db.transaction as any).mockImplementation(mockTransaction);

    mockTx.where
      .mockReturnValueOnce(mockTx)
      .mockReturnValueOnce(mockTx)
      .mockResolvedValueOnce([{ count: 10 }]);
    mockTx.limit
      .mockResolvedValueOnce([{ userId: 'user-1', isActive: true }])
      .mockResolvedValueOnce([{ tier: 'pro' }])
      .mockResolvedValue([]);
    mockTx.returning
      .mockResolvedValueOnce([{ id: 'photo-1', eventId: 'evt-1', url: 'https://example.com/photo.jpg' }])
      .mockResolvedValue([]);

    const photo = await addPhoto('evt-1', 'https://example.com/photo.jpg');

    expect(photo.id).toBe('photo-1');
  });
});

describe('deletePhoto', () => {
  beforeEach(() => {
    (db.update as any).mockReturnThis();
    (db as any).set.mockReturnThis();
    (db as any).where.mockReturnThis();
  });

  it('throws NotFoundError when photo not found', async () => {
    (db as any).returning.mockResolvedValueOnce([]);

    await expect(deletePhoto('photo-1')).rejects.toThrow('Foto no encontrada');
  });

  it('deletes photo and returns success', async () => {
    (db as any).returning.mockResolvedValueOnce([{
      id: 'photo-1',
      url: 'https://example.com/photo.jpg',
    }]);

    const result = await deletePhoto('photo-1');

    expect(result).toEqual({ success: true });
  });

  it('calls cloudinary destroy for cloudinary URLs', async () => {
    (db as any).returning.mockResolvedValueOnce([{
      id: 'photo-1',
      url: 'https://res.cloudinary.com/demo/image/upload/v1/fiestaylista/event/abc123.jpg',
    }]);

    const { v2: cloudinary } = await import('cloudinary');
    const result = await deletePhoto('photo-1');
    expect(result).toEqual({ success: true });
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('fiestaylista/event/abc123');
  });
});

describe('getEventPhotos', () => {
  it('returns photos for event', async () => {
    const mockPhotos = [
      { id: 'p1', eventId: 'evt-1', url: 'https://example.com/1.jpg' },
      { id: 'p2', eventId: 'evt-1', url: 'https://example.com/2.jpg' },
    ];
    (db as any).select.mockReturnThis();
    (db as any).from.mockReturnThis();
    (db as any).where.mockReturnThis();
    (db as any).orderBy.mockReturnThis();
    (db as any).limit.mockResolvedValueOnce(mockPhotos);

    const result = await getEventPhotos('evt-1');
    expect(result.photos).toEqual(mockPhotos);
    expect(result.hasMore).toBe(false);
  });
});
