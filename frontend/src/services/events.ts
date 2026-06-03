import { apiClient } from './api';
import type { Event, Gift, Photo } from '../types';

interface CreateEventData {
  title: string;
  eventType: string;
  hostPhone?: string;
}

export function createEvent(data: CreateEventData): Promise<{ event: Event }> {
  return apiClient.post<{ event: Event }>('/api/events', data);
}

export function addPhoto(eventId: string, url: string, caption?: string): Promise<{ photo: Photo }> {
  return apiClient.post<{ photo: Photo }>(`/api/events/${eventId}/photos`, { url, caption });
}

export function uploadPhoto(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient.post<{ url: string }>('/api/upload', formData);
}

export function getEventBySlug(slug: string): Promise<{ event: Event; gifts: Gift[]; photos: Photo[] }> {
  return apiClient.get<{ event: Event; gifts: Gift[]; photos: Photo[] }>(`/api/events/slug/${slug}`);
}
