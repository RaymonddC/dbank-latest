import { describe, expect, it } from 'vitest';
import { Principal } from '@icp-sdk/core/principal';
import { encodeIcrc1Account, decodeIcrc1Account, crc32, base32EncodeNoPadLower } from './icrc1';

describe('crc32', () => {
  it('matches known IEEE 802.3 vectors', () => {
    // CRC32("") = 0
    expect(crc32(new Uint8Array(0))).toBe(0);
    // CRC32("123456789") = 0xCBF43926 (RFC 1952 / standard test vector)
    const ascii = new TextEncoder().encode('123456789');
    expect(crc32(ascii)).toBe(0xcbf43926);
  });
});

describe('base32EncodeNoPadLower', () => {
  it('encodes empty input to empty', () => {
    expect(base32EncodeNoPadLower(new Uint8Array(0))).toBe('');
  });

  it('encodes a single byte to 2 base32 chars (no pad)', () => {
    expect(base32EncodeNoPadLower(new Uint8Array([0xff]))).toBe('74');
  });

  it('encodes 5 bytes to 8 chars (RFC 4648 vector "fooba")', () => {
    // 0x66 0x6f 0x6f 0x62 0x61 = 40 bits = 8 base32 symbols, no padding.
    const bytes = new TextEncoder().encode('fooba');
    expect(base32EncodeNoPadLower(bytes)).toBe('mzxw6ytb');
  });

  it('encodes 6 bytes (RFC 4648 vector "foobar") to 10 chars without padding', () => {
    const bytes = new TextEncoder().encode('foobar');
    expect(base32EncodeNoPadLower(bytes)).toBe('mzxw6ytboi');
  });
});

describe('encodeIcrc1Account / decodeIcrc1Account', () => {
  const owner = Principal.fromText('rrkah-fqaaa-aaaaa-aaaaq-cai');

  it('owner-only when subaccount is null', () => {
    expect(encodeIcrc1Account({ owner, subaccount: null })).toBe(owner.toText());
  });

  it('owner-only when subaccount is all zeros', () => {
    expect(encodeIcrc1Account({ owner, subaccount: new Uint8Array(32) })).toBe(owner.toText());
  });

  it('produces <owner>-<checksum>.<hex> when subaccount is non-zero', () => {
    const sub = new Uint8Array(32);
    sub[31] = 1; // subaccount = 0x000…001
    const text = encodeIcrc1Account({ owner, subaccount: sub });
    expect(text).toMatch(new RegExp(`^${owner.toText()}-[a-z2-7]+\\.1$`));
  });

  it('roundtrips through decode (owner-only)', () => {
    const text = encodeIcrc1Account({ owner, subaccount: null });
    const decoded = decodeIcrc1Account(text);
    expect(decoded.owner.toText()).toBe(owner.toText());
    expect(decoded.subaccount).toBeNull();
  });

  it('roundtrips through decode (with subaccount)', () => {
    const sub = new Uint8Array(32);
    sub[28] = 0xde;
    sub[29] = 0xad;
    sub[30] = 0xbe;
    sub[31] = 0xef;
    const text = encodeIcrc1Account({ owner, subaccount: sub });
    const decoded = decodeIcrc1Account(text);
    expect(decoded.owner.toText()).toBe(owner.toText());
    expect(decoded.subaccount).toEqual(sub);
  });

  it('decode rejects bad checksum', () => {
    expect(() => decodeIcrc1Account(`${owner.toText()}-aaaaaaaa.1`)).toThrow(/checksum/);
  });

  it('decode rejects malformed string', () => {
    expect(() => decodeIcrc1Account(`not-a-principal-aaaaa.x`)).toThrow();
  });

  it('decode trims surrounding whitespace', () => {
    const text = encodeIcrc1Account({ owner, subaccount: null });
    expect(decodeIcrc1Account(`  ${text}\n`).owner.toText()).toBe(owner.toText());
  });

  it('decode rejects internal whitespace', () => {
    expect(() => decodeIcrc1Account(`${owner.toText()} extra`)).toThrow(/whitespace/);
    expect(() => decodeIcrc1Account(`${owner.toText()}-aaa\nbbb.1`)).toThrow(/whitespace/);
  });
});
