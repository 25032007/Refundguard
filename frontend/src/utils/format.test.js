import { describe, it, expect } from 'vitest';
import { formatPercentage, formatCurrency, formatDate, formatDateTime, formatSignalType } from './format';

describe('format utilities', () => {
  it('formatPercentage formats fractions correctly', () => {
    expect(formatPercentage(0.25)).toBe('25%');
    expect(formatPercentage(1)).toBe('100%');
    expect(formatPercentage(25)).toBe('25%'); // Handles non-fraction percentages if they exist
    expect(formatPercentage(0)).toBe('0%');
    expect(formatPercentage(null)).toBe('—');
  });

  it('formatCurrency formats amounts correctly', () => {
    expect(formatCurrency(1234.5)).toBe('£1,234.50');
    expect(formatCurrency(0)).toBe('£0.00');
    expect(formatCurrency(null)).toBe('—');
  });

  it('formatDate formats dates correctly', () => {
    expect(formatDate('2026-10-01T10:00:00Z')).toMatch(/Oct 1, 2026/);
    expect(formatDate(null)).toBe('—');
  });

  it('formatDateTime formats dates and times correctly', () => {
    expect(formatDateTime('2026-10-01T10:00:00Z')).toMatch(/Oct 1, 2026/);
    expect(formatDateTime(null)).toBe('—');
  });

  it('formatSignalType humanizes signal types', () => {
    expect(formatSignalType('keyword')).toBe('Keyword');
    expect(formatSignalType('unknown_type')).toBe('Unknown_type');
    expect(formatSignalType(null)).toBe('—');
  });
});
