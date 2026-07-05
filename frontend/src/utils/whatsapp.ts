import type { EventType } from '../types';

export type WhatsAppTemplate = 'formal' | 'casual' | 'minimalist';

interface EventShareData {
  title: string;
  slug: string;
  eventType: EventType;
  eventDate?: string | null;
  eventLocation?: string | null;
}

export function suggestTemplate(eventType: EventType): WhatsAppTemplate {
  switch (eventType) {
    case 'WEDDING':
    case 'BAPTISM':
    case 'COMMUNION':
      return 'formal';
    case 'BABY_SHOWER':
    case 'BIRTHDAY':
    case 'HOUSE_WARMING':
      return 'casual';
    default:
      return 'minimalist';
  }
}

function formatWhatsAppDate(dateStr: string): string {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };
  const hasTime = dateStr.includes('T') || dateStr.includes(':');
  if (hasTime) {
    options.hour = 'numeric';
    options.minute = '2-digit';
  }
  return date.toLocaleDateString('es-CO', options);
}

function buildMessage(
  template: WhatsAppTemplate,
  hostName: string,
  event: EventShareData,
  includeLocation: boolean,
): string {
  const url = `https://fiestaylista.com/e/${event.slug}`;
  const dateLine = event.eventDate
    ? `📅 *Fecha:* ${formatWhatsAppDate(event.eventDate)}`
    : null;
  const locLine =
    includeLocation && event.eventLocation
      ? `📍 *Dónde:* ${event.eventLocation}`
      : null;

  switch (template) {
    case 'formal':
      return [
        `Hola, soy *${hostName}* ✉️`,
        '',
        `Tengo el gusto de invitarte a *"${event.title}"*.`,
        '',
        dateLine,
        '',
        'Para ver los detalles del evento y confirmar tu asistencia de forma segura, te comparto el portal oficial:',
        '',
        url,
        '',
        'Será un honor compartir este momento contigo.',
      ].filter(Boolean).join('\n');

    case 'casual':
      return [
        `¡Hola! Soy *${hostName}* 🎉`,
        '',
        `Estoy armando *"${event.title}"* y quiero que estés ahí.`,
        '',
        dateLine?.replace('📅 *Fecha:', '📅 *Cuándo:'),
        locLine,
        '',
        'Entra aquí para ver los detalles y confirmar tu asistencia:',
        '',
        url,
        '',
        '¡Nos vemos! ✨',
      ].filter(Boolean).join('\n');

    case 'minimalist':
      return [
        `Hola, soy *${hostName}*`,
        '',
        `Te invito a *"${event.title}"*`,
        event.eventDate ? `📅 ${formatWhatsAppDate(event.eventDate)}` : null,
        '',
        'Confirma tu asistencia aquí 👇',
        url,
      ].filter(Boolean).join('\n');
  }
}

export function getWhatsAppUrl(
  template: WhatsAppTemplate,
  hostName: string,
  event: EventShareData,
  includeLocation = true,
): string {
  const text = buildMessage(template, hostName || 'el anfitrión', event, includeLocation);
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
