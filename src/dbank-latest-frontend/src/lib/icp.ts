// Conversion helpers between display ICP (decimal) and on-chain e8s (Nat / bigint).

export const E8S_PER_ICP = 100_000_000n;

export function icpToE8s(icp: number): bigint {
  if (!isFinite(icp) || icp < 0) throw new Error('Amount must be a non-negative number');
  return BigInt(Math.round(icp * 1e8));
}

export function e8sToIcp(e8s: bigint | number): number {
  const n = typeof e8s === 'bigint' ? e8s : BigInt(e8s);
  return Number(n) / 1e8;
}

export function formatIcp(e8s: bigint | number, fractionDigits = 4): string {
  return e8sToIcp(e8s).toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}
