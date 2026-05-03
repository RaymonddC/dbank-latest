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
  if ('ledgerUnreachable' in err) {
    const m = (err as { ledgerUnreachable: { message: string } }).ledgerUnreachable.message;
    return `Ledger unreachable: ${m}`;
  }
  if ('ledgerError' in err) {
    return describeLedgerError((err as { ledgerError: unknown }).ledgerError);
  }
  return 'Transfer failed';
}

function describeLedgerError(err: unknown): string {
  if (typeof err !== 'object' || err === null) return 'Ledger transfer failed';
  if ('BadFee' in err) {
    const exp = (err as { BadFee: { expected_fee: bigint } }).BadFee.expected_fee;
    return `Bad ledger fee — ledger expects ${e8sToIcp(exp)} ICP`;
  }
  if ('BadBurn' in err) {
    const min = (err as { BadBurn: { min_burn_amount: bigint } }).BadBurn.min_burn_amount;
    return `Burn amount below ledger minimum (${e8sToIcp(min)} ICP)`;
  }
  if ('InsufficientFunds' in err) {
    const bal = (err as { InsufficientFunds: { balance: bigint } }).InsufficientFunds.balance;
    return `Ledger reports insufficient funds (have ${e8sToIcp(bal)} ICP at the deposit subaccount)`;
  }
  if ('TooOld' in err) return 'Transfer rejected: created_at_time is too old';
  if ('CreatedInFuture' in err) return 'Transfer rejected: created_at_time is in the future';
  if ('Duplicate' in err) {
    const dup = (err as { Duplicate: { duplicate_of: bigint } }).Duplicate.duplicate_of;
    return `Duplicate of block index ${dup.toString()}`;
  }
  if ('TemporarilyUnavailable' in err) return 'Ledger temporarily unavailable — please retry';
  if ('GenericError' in err) {
    const g = (err as { GenericError: { error_code: bigint; message: string } }).GenericError;
    return `Ledger error ${g.error_code.toString()}: ${g.message}`;
  }
  return 'Ledger transfer failed';
}
