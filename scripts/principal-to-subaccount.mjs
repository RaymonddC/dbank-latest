#!/usr/bin/env node
// principal-to-subaccount.mjs
//
// Given an Internet Computer principal text, prints the Candid blob
// literal payload (\\xHH escapes) for the dbank deposit subaccount —
// i.e. the principal bytes zero-padded to 32 bytes.
//
// Usage:  node scripts/principal-to-subaccount.mjs <principal-text>
// Output:  \xab\xcd...\x00\x00  (no newline, ready to splice into a
//          Candid blob literal: opt blob "<output>")

const text = process.argv[2];
if (!text) {
  console.error('usage: principal-to-subaccount.mjs <principal-text>');
  process.exit(1);
}

// ─── self-contained principal decoder ─────────────────────────────────────
// Principal textual form: lowercase base32 (no padding) of (CRC32 || bytes),
// grouped into hyphenated 5-char blocks. Strip hyphens, base32-decode, drop
// the leading 4 CRC bytes.

const B32_INV = (() => {
  const m = new Map();
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  for (let i = 0; i < alphabet.length; i++) m.set(alphabet[i], i);
  return m;
})();

function base32Decode(s) {
  const clean = s.toLowerCase().replace(/=+$/, '');
  const out = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    const v = B32_INV.get(ch);
    if (v === undefined) throw new Error(`Bad base32 char "${ch}"`);
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

function principalBytes(principalText) {
  const cleaned = principalText.toLowerCase().replace(/-/g, '');
  const decoded = base32Decode(cleaned);
  if (decoded.length < 4) throw new Error('Principal too short');
  // Skip 4-byte CRC32 prefix.
  return decoded.subarray(4);
}

// ─── pad → 32 bytes, format as Candid blob escapes ────────────────────────
const bytes = principalBytes(text);
if (bytes.length > 32) {
  console.error(`Principal is ${bytes.length} bytes, exceeds subaccount size (32).`);
  process.exit(1);
}
const padded = new Uint8Array(32);
padded.set(bytes, 0);

let out = '';
for (const b of padded) out += '\\' + b.toString(16).padStart(2, '0');
process.stdout.write(out);
