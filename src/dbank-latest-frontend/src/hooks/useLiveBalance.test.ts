import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLiveBalance } from './useLiveBalance';

describe('useLiveBalance', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the base when no time has elapsed', () => {
    const now = Date.now();
    const { result } = renderHook(() => useLiveBalance(100_000_000n, now));
    expect(result.current).toBe(100_000_000n);
  });

  it('returns the base when balance is zero', () => {
    const now = Date.now();
    const { result } = renderHook(() => useLiveBalance(0n, now - 60_000));
    expect(result.current).toBe(0n);
  });

  it('grows the balance after time elapses', () => {
    const start = Date.now();
    vi.setSystemTime(start);

    const { result } = renderHook(() => useLiveBalance(100_000_000n, start));
    const initial = result.current;

    act(() => {
      vi.setSystemTime(start + 60_000); // +60s
      vi.advanceTimersByTime(600); // > one tick interval
    });

    expect(result.current).toBeGreaterThan(initial);
  });

  it('grows by approximately 1% over a full day', () => {
    const start = Date.now();
    vi.setSystemTime(start);
    const base = 100_000_000n;
    const { result, rerender } = renderHook(
      ({ baseE8s, anchorMs }: { baseE8s: bigint; anchorMs: number }) => useLiveBalance(baseE8s, anchorMs),
      { initialProps: { baseE8s: base, anchorMs: start } },
    );

    act(() => {
      vi.setSystemTime(start + 86_400_000); // +1 day
      vi.advanceTimersByTime(600);
    });
    rerender({ baseE8s: base, anchorMs: start });

    const grown = Number(result.current);
    const expected = Number(base) * 1.01;
    expect(Math.abs(grown - expected)).toBeLessThan(Number(base) * 0.0005);
  });
});
