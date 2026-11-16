import { describe, expect, it } from 'vitest';
import { diffBytes, hexHunks, type CompareSection } from './index.ts';

const zeros = (n: number) => new Array<number>(n).fill(0);
const withBytes = (n: number, ...at: number[]) => {
  const out = zeros(n);
  for (const i of at) out[i] = 1;
  return out;
};
const section = (a: number[], b: number[], base = 0): CompareSection => {
  const x = Uint8Array.from(a);
  const y = Uint8Array.from(b);
  return { id: 's', label: 'S', kind: 'compared', base, a: x, b: y, ...diffBytes(x, y, base) };
};
const rowsOf = (hunks: ReturnType<typeof hexHunks>) =>
  hunks.flatMap((h) => (h.kind === 'rows' ? h.rows : []));

describe('hexHunks', () => {
  it('is one identical separator when nothing changed', () => {
    expect(hexHunks(section(zeros(64), zeros(64)), { context: 1 })).toEqual([
      { kind: 'identical', start: 0, end: 63, rows: 4 },
    ]);
  });

  it('keeps the changed row with context and separates the rest', () => {
    const hunks = hexHunks(section(zeros(160), withBytes(160, 5 * 16 + 3)), { context: 1 });
    expect(hunks.map((h) => h.kind)).toEqual(['identical', 'rows', 'identical']);
    expect(hunks[0]).toEqual({ kind: 'identical', start: 0, end: 63, rows: 4 });
    expect(rowsOf(hunks).map((r) => [r.address, r.changed])).toEqual([
      [64, 0],
      [80, 1],
      [96, 0],
    ]);
    expect(hunks[2]).toEqual({ kind: 'identical', start: 112, end: 159, rows: 3 });
  });

  it('merges hunks whose context touches', () => {
    const hunks = hexHunks(section(zeros(160), withBytes(160, 16, 48)), { context: 1 });
    expect(hunks.filter((h) => h.kind === 'rows')).toHaveLength(1);
  });

  it('uses absolute 16-byte boundaries and short first rows', () => {
    const hunks = hexHunks(section(zeros(40), withBytes(40, 0), 0x3b08), { context: 0 });
    expect(rowsOf(hunks)).toEqual([{ address: 0x3b00, offset: 0, length: 8, changed: 1 }]);
    expect(hunks[1]).toEqual({ kind: 'identical', start: 0x3b10, end: 0x3b2f, rows: 2 });
  });

  it('counts a run that spans rows per row and compares the shared length only', () => {
    const s = section(zeros(32), new Array<number>(24).fill(1));
    const rows = rowsOf(hexHunks(s, { context: 0 }));
    expect(rows.map((r) => [r.length, r.changed])).toEqual([
      [16, 16],
      [8, 8],
    ]);
  });
});
