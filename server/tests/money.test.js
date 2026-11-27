import { describe, it, expect } from 'vitest';
import { rupeesToPaise, paiseToRupees, formatINR } from '../src/utils/money.js';

describe('money utils', () => {
  it('converts rupees to paise correctly', () => {
    expect(rupeesToPaise(100)).toBe(10000);
    expect(rupeesToPaise(0.5)).toBe(50);
    expect(rupeesToPaise(999.99)).toBe(99999);
    expect(rupeesToPaise(0)).toBe(0);
  });

  it('handles null/undefined/NaN gracefully', () => {
    expect(rupeesToPaise(null)).toBe(0);
    expect(rupeesToPaise(undefined)).toBe(0);
    expect(rupeesToPaise(NaN)).toBe(0);
  });

  it('converts paise to rupees', () => {
    expect(paiseToRupees(10000)).toBe(100);
    expect(paiseToRupees(50)).toBe(0.5);
  });

  it('formats INR correctly', () => {
    const formatted = formatINR(10000);
    expect(formatted).toContain('100');
    expect(formatted).toContain('₹');
  });

  it('never loses paise in round-trip', () => {
    const testValues = [1, 50, 99, 100, 10000, 999999];
    for (const p of testValues) {
      expect(rupeesToPaise(paiseToRupees(p))).toBe(p);
    }
  });
});
