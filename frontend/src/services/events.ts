import { apiClient } from './api';
import type { Event, Gift, Photo } from '../types';

interface CreateEventData {
  title: string;
  eventType: string;
  hostPhone?: string;
}

interface UpdateEventData {
  title?: string;
  eventType?: string;
  hostPhone?: string;
  isActive?: boolean;
}

interface UpdateGiftData {
  name?: string;
  isClaimed?: boolean;
  claimedBy?: string;
}

export function getEvents(): Promise<{ events: Event[] }> {
  return apiClient.get<{ events: Event[] }>('/api/events');
}

export function createEvent(data: CreateEventData): Promise<{ event: Event }> {
  return apiClient.post<{ event: Event }>('/api/events', data);
}

export function getEvent(id: string): Promise<{ event: Event; gifts: Gift[]; photos: Photo[] }> {
  return apiClient.get<{ event: Event; gifts: Gift[]; photos: Photo[] }>(`/api/events/${id}`);
}

export function updateEvent(id: string, data: UpdateEventData): Promise<{ event: Event }> {
  return apiClient.put<{ event: Event }>(`/api/events/${id}`, data);
}

export function deleteEvent(id: string): Promise<void> {
  return apiClient.del<void>(`/api/events/${id}`);
}

export function addGift(eventId: string, name: string): Promise<{ gift: Gift }> {
  return apiClient.post<{ gift: Gift }>(`/api/events/${eventId}/gifts`, { name });
}

export function updateGift(eventId: string, giftId: string, data: UpdateGiftData): Promise<{ gift: Gift }> {
  return apiClient.put<{ gift: Gift }>(`/api/events/${eventId}/gifts/${giftId}`, data);
}

export function deleteGift(eventId: string, giftId: string): Promise<void> {
  return apiClient.del<void>(`/api/events/${eventId}/gifts/${giftId}`);
}

export function addPhoto(eventId: string, url: string, caption?: string): Promise<{ photo: Photo }> {
  return apiClient.post<{ photo: Photo }>(`/api/events/${eventId}/photos`, { url, caption });
}

export function deletePhoto(eventId: string, photoId: string): Promise<void> {
  return apiClient.del<void>(`/api/events/${eventId}/photos/${photoId}`);
}

export function uploadPhoto(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient.post<{ url: string }>('/api/upload', formData);
}

export function getEventBySlug(slug: string): Promise<{ event: Event; gifts: Gift[]; photos: Photo[] }> {
  return apiClient.get<{ event: Event; gifts: Gift[]; photos: Photo[] }>(`/api/events/slug/${slug}`);
}
