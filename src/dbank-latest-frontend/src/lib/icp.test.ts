import { describe, expect, it } from 'vitest';
import { icpToE8s, e8sToIcp, formatIcp, E8S_PER_ICP } from './icp';

describe('icp conversions', () => {
  describe('icpToE8s', () => {
    it('converts whole ICP to e8s', () => {
      expect(icpToE8s(1)).toBe(100_000_000n);
      expect(icpToE8s(2.5)).toBe(250_000_000n);
    });

    it('rounds at the e8 boundary', () => {
      // 0.123456789 → rounded to 0.12345679 → 12_345_679 e8s
      expect(icpToE8s(0.123456789)).toBe(12_345_679n);
    });

    it('throws on negative or non-finite', () => {
      expect(() => icpToE8s(-1)).toThrow();
      expect(() => icpToE8s(NaN)).toThrow();
      expect(() => icpToE8s(Infinity)).toThrow();
    });

    it('handles zero', () => {
      expect(icpToE8s(0)).toBe(0n);
    });
  });

  describe('e8sToIcp', () => {
    it('converts e8s back to ICP', () => {
      expect(e8sToIcp(100_000_000n)).toBe(1);
      expect(e8sToIcp(50_000n)).toBeCloseTo(0.0005, 8);
    });

    it('accepts number input', () => {
      expect(e8sToIcp(100_000_000)).toBe(1);
    });
  });

  describe('icpToE8s ↔ e8sToIcp roundtrip', () => {
    it('roundtrips reasonable values', () => {
      const values = [0.5, 1, 2.5, 100, 0.0005, 0.001];
      for (const v of values) {
        expect(e8sToIcp(icpToE8s(v))).toBeCloseTo(v, 8);
      }
    });
  });

  describe('formatIcp', () => {
    it('formats with 4 decimals by default', () => {
      const formatted = formatIcp(150_000_000n);
      expect(formatted).toMatch(/^1[.,]5000$/);
    });

    it('honours custom fractionDigits', () => {
      const formatted = formatIcp(150_000_000n, 2);
      expect(formatted).toMatch(/^1[.,]50$/);
    });
  });

  describe('E8S_PER_ICP', () => {
    it('is 100_000_000', () => {
      expect(E8S_PER_ICP).toBe(100_000_000n);
    });
  });
});
