export function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

export function sanitize(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim();
}

export function sanitizeAndStrip(input: string): string {
  return stripHtml(sanitize(input));
}
