import { apiClient } from './api';
import { compressImage } from '../utils/compressImage';
import type { Event, Gift, Photo } from '../types';

interface CreateEventData {
  title: string;
  eventType: string;
  hostPhone?: string;
  eventNote?: string;
  idempotencyKey?: string;
}

export function createEvent(data: CreateEventData): Promise<{ event: Event }> {
  return apiClient.post<{ event: Event }>('/api/events', data);
}

// A5: key de idempotencia por intento de creación. El llamador decide su
// ciclo de vida: generarla una vez por visita/modal y reusarla en los
// reintentos para que el server devuelva el mismo evento en vez de duplicar.
export function newIdempotencyKey(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // Fallback UUID v4 (entornos sin crypto.randomUUID, p.ej. tests antiguos)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
