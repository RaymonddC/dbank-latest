import { describe, expect, it } from 'vitest';
import { describeTransferError, errorMessage } from './transferErrors';

describe('describeTransferError', () => {
  it('handles invalidAmount', () => {
    expect(describeTransferError({ invalidAmount: null })).toBe('Amount must be greater than zero');
  });

  it('handles amountTooLarge with the cap', () => {
    expect(describeTransferError({ amountTooLarge: { max: 100_000_000_000_000_000n } })).toContain(
      'exceeds the per-transaction cap',
    );
  });

  it('handles belowFee with fee value', () => {
    const msg = describeTransferError({ belowFee: { fee: 50_000n } });
    expect(msg).toContain('greater than the network fee');
    expect(msg).toContain('0.0005');
  });

  it('handles insufficientFunds with balance and required', () => {
    const msg = describeTransferError({
      insufficientFunds: { balance: 100_000_000n, required: 200_000_000n },
    });
    expect(msg).toContain('Insufficient funds');
    expect(msg).toContain('1');
    expect(msg).toContain('2');
  });

  it('handles rateLimited with wait time', () => {
    const msg = describeTransferError({ rateLimited: { retryAfterNs: 50_000_000n } });
    expect(msg).toContain('Slow down');
    expect(msg).toMatch(/50 ms/);
  });

  it('falls back for unknown shapes', () => {
    expect(describeTransferError({ totallyNew: null })).toBe('Transfer failed');
    expect(describeTransferError(null)).toBe('Transfer failed');
    expect(describeTransferError(42)).toBe('Transfer failed');
  });

  it('handles ledgerUnreachable', () => {
    const msg = describeTransferError({ ledgerUnreachable: { message: 'agent error: 502' } });
    expect(msg).toContain('Ledger unreachable');
    expect(msg).toContain('502');
  });

  describe('ledgerError variants', () => {
    it('BadFee surfaces the expected fee', () => {
      const msg = describeTransferError({ ledgerError: { BadFee: { expected_fee: 10_000n } } });
      expect(msg).toMatch(/Bad ledger fee/);
      expect(msg).toContain('0.0001');
    });

    it('InsufficientFunds surfaces the on-ledger balance', () => {
      const msg = describeTransferError({ ledgerError: { InsufficientFunds: { balance: 50_000n } } });
      expect(msg).toMatch(/insufficient funds/i);
      expect(msg).toContain('0.0005');
    });

    it('TooOld', () => {
      expect(describeTransferError({ ledgerError: { TooOld: null } })).toMatch(/too old/);
    });

    it('CreatedInFuture', () => {
      expect(
        describeTransferError({ ledgerError: { CreatedInFuture: { ledger_time: 0n } } }),
      ).toMatch(/future/);
    });

    it('Duplicate references the original block', () => {
      const msg = describeTransferError({ ledgerError: { Duplicate: { duplicate_of: 12345n } } });
      expect(msg).toMatch(/Duplicate/);
      expect(msg).toContain('12345');
    });

    it('TemporarilyUnavailable', () => {
      expect(
        describeTransferError({ ledgerError: { TemporarilyUnavailable: null } }),
      ).toMatch(/temporarily unavailable/i);
    });

    it('GenericError surfaces code and message', () => {
      const msg = describeTransferError({
        ledgerError: { GenericError: { error_code: 7n, message: 'whoops' } },
      });
      expect(msg).toMatch(/Ledger error 7/);
      expect(msg).toContain('whoops');
    });
  });
});

describe('errorMessage', () => {
  it('extracts Error.message', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('coerces non-Errors via String()', () => {
    expect(errorMessage('plain string')).toBe('plain string');
    expect(errorMessage(42)).toBe('42');
    expect(errorMessage(null)).toBe('null');
  });
});
