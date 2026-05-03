import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
  it('joins simple cells with commas and CRLF', () => {
    expect(toCsv([['a', 'b'], ['c', 'd']])).toBe('a,b\r\nc,d');
  });

  it('quotes cells containing commas', () => {
    expect(toCsv([['a,b', 'c']])).toBe('"a,b",c');
  });

  it('escapes embedded quotes by doubling them', () => {
    expect(toCsv([['he said "hi"']])).toBe('"he said ""hi"""');
  });

  it('quotes cells containing newlines', () => {
    expect(toCsv([['line1\nline2']])).toBe('"line1\nline2"');
    expect(toCsv([['line1\r\nline2']])).toBe('"line1\r\nline2"');
  });

  it('coerces numbers and bigints', () => {
    expect(toCsv([[1, 2n, 'x']])).toBe('1,2,x');
  });

  it('handles empty input', () => {
    expect(toCsv([])).toBe('');
  });
});
