export function getPasswordStrength(pw: string): { score: number; label: string; color: string; textColor: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: 'Débil', color: 'bg-red-500', textColor: 'text-red-500' };
  if (score <= 3) return { score, label: 'Media', color: 'bg-amber-500', textColor: 'text-amber-500' };
  return { score, label: 'Fuerte', color: 'bg-green-500', textColor: 'text-green-500' };
}
