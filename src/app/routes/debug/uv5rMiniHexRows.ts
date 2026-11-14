/** Hex text for the UV-5R Mini calibration viewer. */

export const formatHexByte = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
export const formatHexAddress = (n: number) => `0x${n.toString(16).toUpperCase().padStart(4, '0')}`;

const h2 = formatHexByte;
const addr = formatHexAddress;

/**
 * Hex rows that end on 16-byte address boundaries (the first row may be short); a run of two or more full rows that
 * all hold one byte value collapses to one line.
 */
export function hexRows(start: number, bytes: Uint8Array): string[] {
  const out: string[] = [];
  const rowEnd = (i: number) => Math.min(bytes.length, ((start + i) | 15) + 1 - start);
  const uniform = (from: number, to: number, value: number) =>
    to - from === 16 && bytes.subarray(from, to).every((b) => b === value);
  let i = 0;
  while (i < bytes.length) {
    const end = rowEnd(i);
    const fill = bytes[i];
    if (uniform(i, end, fill)) {
      let j = end;
      while (uniform(j, rowEnd(j), fill)) j = rowEnd(j);
      if (j - i > 16) {
        out.push(`${addr(start + i)}–${addr(start + j - 1)}  all ${h2(fill)} (${j - i} bytes)`);
        i = j;
        continue;
      }
    }
    out.push(`${addr(start + i)}  ${Array.from(bytes.subarray(i, end), h2).join(' ')}`);
    i = end;
  }
  return out;
}
