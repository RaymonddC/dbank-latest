import { useEffect, useState } from 'react';

/**
 * Optimistically ticks the displayed balance by applying the daily compound
 * rate per-second between server fetches. The on-chain canonical balance is
 * still authoritative; this just smooths the visual update.
 *
 * L1: pauses the 500ms interval when the tab is hidden (Page Visibility API)
 * to avoid wasted CPU. On focus we sync `now` once so the displayed value
 * jumps to the right value on the next render.
 */
export function useLiveBalance(baseE8s: bigint, anchorMs: number, dailyRate = 1.01): bigint {
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    if (baseE8s === 0n) return;

    let intervalId: number | undefined;
    const start = () => {
      if (intervalId !== undefined) return;
      intervalId = window.setInterval(() => setNow(Date.now()), 500);
    };
    const stop = () => {
      if (intervalId === undefined) return;
      window.clearInterval(intervalId);
      intervalId = undefined;
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        setNow(Date.now()); // catch-up after a long hidden period
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [baseE8s]);

  const elapsedS = Math.max(0, (now - anchorMs) / 1000);
  if (elapsedS === 0 || baseE8s === 0n) return baseE8s;
  const factor = dailyRate ** (elapsedS / 86400);
  const ticked = Number(baseE8s) * factor;
  if (!isFinite(ticked)) return baseE8s;
  return BigInt(Math.round(ticked));
}
