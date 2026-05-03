// Minimal CSV builder. Quotes any value that contains a comma, quote, CR, or
// LF, doubling embedded quotes per RFC 4180. Newline is CRLF for Excel parity.

export function toCsv(rows: Array<Array<string | number | bigint>>): string {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

function escapeCell(value: string | number | bigint): string {
  const str = typeof value === 'string' ? value : value.toString();
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
