// ICRC-1 textual encoding for `(owner, subaccount)` accounts.
// Reference: https://github.com/dfinity/ICRC-1/blob/main/standards/ICRC-1/TextualEncoding.md
//
// Format:
//   if subaccount is omitted or all-zeros: <owner-textual>
//   else: <owner-textual>-<base32(crc32(owner_bytes ++ subaccount))>.<hex(subaccount_no_leading_zeros)>

import { Principal } from '@icp-sdk/core/principal';

export interface IcrcAccount {
  owner: Principal;
  subaccount?: Uint8Array | null;
}

export function encodeIcrc1Account(acc: IcrcAccount): string {
  const ownerText = acc.owner.toText();
  const sub = normalizeSubaccount(acc.subaccount);
  if (sub === null || isAllZeros(sub)) return ownerText;

  const ownerBytes = acc.owner.toUint8Array();
  const crcBytes = u32ToBeBytes(crc32(concat(ownerBytes, sub)));
  const checksum = base32EncodeNoPadLower(crcBytes);
  const subHex = hexNoLeadingZeros(sub);
  return `${ownerText}-${checksum}.${subHex}`;
}

export function decodeIcrc1Account(text: string): IcrcAccount {
  const dashIdx = text.lastIndexOf('-');
  const dotIdx = text.lastIndexOf('.');
  // No checksum / subaccount section → owner-only.
  if (dotIdx === -1) {
    return { owner: Principal.fromText(text), subaccount: null };
  }
  if (dashIdx === -1 || dashIdx > dotIdx) {
    throw new Error('Malformed ICRC-1 account string');
  }
  const ownerText = text.slice(0, dashIdx);
  const checksum = text.slice(dashIdx + 1, dotIdx);
  const subHex = text.slice(dotIdx + 1);
  if (!/^[0-9a-f]*$/.test(subHex)) throw new Error('Subaccount must be lower-case hex');
  if (subHex.length === 0 || subHex.length > 64) throw new Error('Subaccount hex length out of range');

  const owner = Principal.fromText(ownerText);
  const sub = padSubaccount(hexDecode(subHex));
  const expectedCrcBytes = u32ToBeBytes(crc32(concat(owner.toUint8Array(), sub)));
  const expected = base32EncodeNoPadLower(expectedCrcBytes);
  if (expected !== checksum) {
    throw new Error('Bad ICRC-1 checksum');
  }
  return { owner, subaccount: sub };
}

// ─── helpers ──────────────────────────────────────────────────────────────

function normalizeSubaccount(sub: Uint8Array | null | undefined): Uint8Array | null {
  if (sub === null || sub === undefined) return null;
  if (sub.length === 32) return sub;
  if (sub.length > 32) throw new Error('Subaccount too long');
  return padSubaccount(sub);
}

function padSubaccount(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(32);
  out.set(bytes, 32 - bytes.length);
  return out;
}

function isAllZeros(bytes: Uint8Array): boolean {
  for (let i = 0; i < bytes.length; i++) if (bytes[i] !== 0) return false;
  return true;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function u32ToBeBytes(n: number): Uint8Array {
  const out = new Uint8Array(4);
  out[0] = (n >>> 24) & 0xff;
  out[1] = (n >>> 16) & 0xff;
  out[2] = (n >>> 8) & 0xff;
  out[3] = n & 0xff;
  return out;
}

function hexNoLeadingZeros(bytes: Uint8Array): string {
  let firstNonZero = 0;
  while (firstNonZero < bytes.length && bytes[firstNonZero] === 0) firstNonZero++;
  if (firstNonZero === bytes.length) return '';
  let s = '';
  for (let i = firstNonZero; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, '0');
  }
  // Trim a single leading 0 nibble on the first byte if present.
  if (s.startsWith('0')) s = s.slice(1);
  return s;
}

function hexDecode(hex: string): Uint8Array {
  const padded = hex.length % 2 === 1 ? '0' + hex : hex;
  const out = new Uint8Array(padded.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// CRC-32 (IEEE 802.3 polynomial 0xEDB88320), standard table-less impl.
export function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (~crc) >>> 0;
}

// RFC 4648 base32, lowercase alphabet, no padding.
const B32 = 'abcdefghijklmnopqrstuvwxyz234567';

export function base32EncodeNoPadLower(buf: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += B32[(value << (5 - bits)) & 31];
  }
  return out;
}
