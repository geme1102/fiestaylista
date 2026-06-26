import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockUploadWithProgress = vi.fn();

vi.mock('../services/api', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
    put: vi.fn(),
    del: vi.fn(),
    uploadWithProgress: mockUploadWithProgress,
  },
}));

vi.mock('../utils/compressImage', () => ({
  compressImage: (file: File) => Promise.resolve(file),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('events service', () => {
  it('createEvent posts to /api/events with event data', async () => {
    mockPost.mockResolvedValue({ event: { id: '1', title: 'My Event' } });
    const { createEvent } = await import('../services/events');

    const result = await createEvent({ title: 'My Event', eventType: 'wedding' });

    expect(mockPost).toHaveBeenCalledWith('/api/events', {
      title: 'My Event',
      eventType: 'wedding',
    });
    expect(result.event.title).toBe('My Event');
  });

  it('addPhoto posts to /api/events/:id/photos', async () => {
    mockPost.mockResolvedValue({ photo: { id: 'p1', url: 'https://cdn.test/photo.jpg' } });
    const { addPhoto } = await import('../services/events');

    const result = await addPhoto('evt-1', 'https://cdn.test/photo.jpg', 'Caption');

    expect(mockPost).toHaveBeenCalledWith('/api/events/evt-1/photos', {
      url: 'https://cdn.test/photo.jpg',
      caption: 'Caption',
    });
    expect(result.photo.url).toContain('cdn.test');
  });

  it('uploadPhoto uploads via XHR with progress', async () => {
    mockUploadWithProgress.mockResolvedValue({ url: 'https://cdn.test/uploaded.jpg' });
    const { uploadPhoto } = await import('../services/events');
    const file = new File(['data'], 'photo.png', { type: 'image/png' });
    const onProgress = vi.fn();

    const result = await uploadPhoto(file, onProgress);

    expect(mockUploadWithProgress).toHaveBeenCalled();
    expect(result.url).toBe('https://cdn.test/uploaded.jpg');
  });

  it('uploadPhoto falls back to POST when no progress callback', async () => {
    mockPost.mockResolvedValue({ url: 'https://cdn.test/uploaded.jpg' });
    const { uploadPhoto } = await import('../services/events');
    const file = new File(['data'], 'photo.png', { type: 'image/png' });

    const result = await uploadPhoto(file);

    expect(mockPost).toHaveBeenCalled();
    expect(result.url).toBe('https://cdn.test/uploaded.jpg');
  });

  it('getEventBySlug fetches event by slug', async () => {
    mockGet.mockResolvedValue({ event: { id: '1' }, gifts: [], photos: [] });
    const { getEventBySlug } = await import('../services/events');

    const result = await getEventBySlug('mi-evento');

    expect(mockGet).toHaveBeenCalledWith('/api/events/slug/mi-evento');
    expect(result.event.id).toBe('1');
  });
});
