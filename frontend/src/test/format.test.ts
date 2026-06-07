import { describe, it, expect } from 'vitest';
import { formatCOP, formatDate, validateRedirectUrl } from '../utils/format';

describe('formatCOP', () => {
  it('formats integer amount', () => {
    const result = formatCOP(50000);
    expect(result).toContain('50');
    expect(result).toContain('000');
  });

  it('handles zero', () => {
    expect(formatCOP(0)).toBe('$0');
  });

  it('handles null', () => {
    expect(formatCOP(null)).toBe('$0');
  });

  it('handles undefined', () => {
    expect(formatCOP(undefined)).toBe('$0');
  });

  it('handles NaN', () => {
    expect(formatCOP(NaN)).toBe('$0');
  });
});

describe('formatDate', () => {
  it('formats valid date string', () => {
    const result = formatDate('2024-06-15T00:00:00Z');
    expect(result).toContain('junio');
    expect(result).toContain('2024');
  });

  it('returns original string for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});

describe('validateRedirectUrl', () => {
  it('accepts valid mercadopago URL', () => {
    expect(validateRedirectUrl('https://www.mercadopago.com.co/pay/abc123')).toBe('https://www.mercadopago.com.co/pay/abc123');
  });

  it('accepts mpago.la short URL', () => {
    expect(validateRedirectUrl('https://mpago.la/abc123')).toBe('https://mpago.la/abc123');
  });

  it('rejects arbitrary URL', () => {
    expect(validateRedirectUrl('https://evil.com/phish')).toBe('');
  });

  it('rejects javascript protocol', () => {
    expect(validateRedirectUrl('javascript:alert(1)')).toBe('');
  });

  it('rejects empty string', () => {
    expect(validateRedirectUrl('')).toBe('');
  });
});
