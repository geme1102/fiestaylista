import { apiClient } from './api';
import { compressImage } from '../utils/compressImage';
import type { Event, Gift, Photo } from '../types';

interface CreateEventData {
  title: string;
  eventType: string;
  hostPhone?: string;
  eventNote?: string;
}

export function createEvent(data: CreateEventData): Promise<{ event: Event }> {
  return apiClient.post<{ event: Event }>('/api/events', data);
}

export function addPhoto(eventId: string, url: string, caption?: string): Promise<{ photo: Photo }> {
  return apiClient.post<{ photo: Photo }>(`/api/events/${eventId}/photos`, { url, caption });
}

export async function uploadPhoto(file: File, onProgress?: (pct: number) => void): Promise<{ url: string }> {
  const compressed = await compressImage(file);
  const formData = new FormData();
  const ext = file.type === 'image/png' ? '.png' : '.jpg';
  formData.append('file', compressed, file.name.replace(/\.[^.]+$/, ext));
  if (onProgress) {
    return apiClient.uploadWithProgress<{ url: string }>('/api/upload', formData, onProgress);
  }
  return apiClient.post<{ url: string }>('/api/upload', formData);
}

export function getEventBySlug(slug: string, signal?: AbortSignal): Promise<{ event: Event; gifts: Gift[]; photos: Photo[] }> {
  return apiClient.get<{ event: Event; gifts: Gift[]; photos: Photo[] }>(`/api/events/slug/${slug}`, { signal });
}
