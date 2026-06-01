import { randomBytes } from 'node:crypto';

export function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return base || 'evento';
}

export function generateUniqueSlug(
  baseSlug: string,
  existingSlugs: Set<string>,
  maxAttempts = 10,
): string {
  if (!existingSlugs.has(baseSlug)) return baseSlug;
  for (let i = 0; i < maxAttempts; i++) {
    const slug = `${baseSlug}-${randomBytes(2).toString('hex')}`;
    if (!existingSlugs.has(slug)) return slug;
  }
  return `${baseSlug}-${randomBytes(4).toString('hex')}`;
}
