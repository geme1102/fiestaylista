import type { EventType } from '../types';
import { THEME_COLORS } from '../types';

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function formatDate(date: string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return `${d.getDate()} de ${MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
}

export function getEventTypeColor(type: EventType): string {
  return THEME_COLORS[type]?.primary ?? '#ec4899';
}

export function getEventTypeGradient(type: EventType): string {
  return THEME_COLORS[type]?.gradient ?? 'from-pink-400 to-rose-500';
}

export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
}
