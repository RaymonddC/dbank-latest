import { useEffect, useState } from 'react';

/**
 * Optimistically ticks the displayed balance by applying the daily compound
 * rate per-second between server fetches. The on-chain canonical balance is
 * still authoritative; this just smooths the visual update.
 */
export function useLiveBalance(baseE8s: bigint, anchorMs: number, dailyRate = 1.01): bigint {
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    if (baseE8s === 0n) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [baseE8s]);

  const elapsedS = Math.max(0, (now - anchorMs) / 1000);
  if (elapsedS === 0 || baseE8s === 0n) return baseE8s;
  const factor = dailyRate ** (elapsedS / 86400);
  const ticked = Number(baseE8s) * factor;
  if (!isFinite(ticked)) return baseE8s;
  return BigInt(Math.round(ticked));
}
