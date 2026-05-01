import { e8sToIcp } from './icp';

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function describeTransferError(err: unknown): string {
  if (typeof err !== 'object' || err === null) return 'Transfer failed';
  if ('invalidAmount' in err) return 'Amount must be greater than zero';
  if ('amountTooLarge' in err) {
    const max = (err as { amountTooLarge: { max: bigint } }).amountTooLarge.max;
    return `Amount exceeds the per-transaction cap (${e8sToIcp(max)} ICP)`;
  }
  if ('belowFee' in err) {
    const fee = (err as { belowFee: { fee: bigint } }).belowFee.fee;
    return `Amount must be greater than the network fee (${e8sToIcp(fee)} ICP)`;
  }
  if ('insufficientFunds' in err) {
    const { balance, required } = (err as {
      insufficientFunds: { balance: bigint; required: bigint };
    }).insufficientFunds;
    return `Insufficient funds: balance ${e8sToIcp(balance)} ICP, required ${e8sToIcp(required)} ICP (incl. fee)`;
  }
  if ('rateLimited' in err) {
    const wait = Number((err as { rateLimited: { retryAfterNs: bigint } }).rateLimited.retryAfterNs) / 1_000_000;
    return `Slow down — try again in ${Math.max(1, Math.round(wait))} ms`;
  }
  return 'Transfer failed';
}
