import { describe, expect, it } from 'vitest';
import {
  OPENGD77_CALIBRATION_LENGTH,
  OPENGD77_CALIBRATION_MARKER,
  OPENGD77_CALIBRATION_MARKER_OFFSET,
  decodeOpenGd77Calibration,
} from './calibration.ts';

/** Synthetic buffer: every byte is a distinct-ish function of its offset, plus the marker. */
function golden(): Uint8Array {
  const bytes = new Uint8Array(OPENGD77_CALIBRATION_LENGTH);
  for (let i = 0; i < bytes.length; i++) bytes[i] = ((i * 7 + 3) % 10) | (((i * 3) % 10) << 4);
  bytes.set(OPENGD77_CALIBRATION_MARKER, OPENGD77_CALIBRATION_MARKER_OFFSET);
  return bytes;
}

/** Literal expectation: [id, offset, length]. Written from the source declaration order. */
const EXPECTED: [string, number, number][] = [
  ['vox-level-1', 0x00, 1],
  ['vox-level-10', 0x01, 1],
  ['rx-low-voltage', 0x02, 1],
  ['rx-high-voltage', 0x03, 1],
  ['rssi-120', 0x04, 1],
  ['rssi-70', 0x05, 1],
  ['uhf-oscillator-tune', 0x09, 1],
  ['vhf-oscillator-tune', 0x0c, 1],
  ['uhf-high-power', 0x10, 9],
  ['vhf-high-power', 0x19, 5],
  ['uhf-low-power', 0x20, 9],
  ['vhf-low-power', 0x29, 5],
  ['uhf-rx-tuning', 0x30, 9],
  ['vhf-rx-tuning', 0x39, 5],
  ['uhf-squelch-open-9', 0x40, 9],
  ['uhf-squelch-close-9', 0x50, 9],
  ['uhf-squelch-open-1', 0x60, 9],
  ['uhf-squelch-close-1', 0x70, 9],
  ['uhf-ctcss-67', 0x90, 9],
  ['vhf-ctcss-67', 0x9b, 5],
  ['uhf-ctcss-151', 0xa0, 9],
  ['vhf-ctcss-151', 0xab, 5],
  ['uhf-ctcss-254', 0xb0, 9],
  ['vhf-ctcss-254', 0xbb, 5],
  ['uhf-dcs', 0xd0, 9],
  ['vhf-dcs', 0xdb, 5],
  ['vhf-squelch-open-9', 0xe0, 5],
  ['vhf-squelch-close-9', 0xe5, 5],
  ['vhf-squelch-open-1', 0xea, 5],
  ['vhf-squelch-close-1', 0xef, 5],
  ['uhf-dmr-i-gain', 0x130, 9],
  ['vhf-dmr-i-gain', 0x139, 5],
  ['uhf-dmr-q-gain', 0x140, 9],
  ['vhf-dmr-q-gain', 0x149, 5],
  ['uhf-fm-i-gain', 0x170, 9],
  ['vhf-fm-i-gain', 0x179, 5],
  ['uhf-fm-q-gain', 0x180, 9],
  ['vhf-fm-q-gain', 0x189, 5],
  ['uhf-mid-power', 0x190, 9],
  ['vhf-mid-power', 0x199, 5],
  ['uhf-low-slot-power', 0x1a0, 9],
  ['vhf-low-slot-power', 0x1a9, 5],
  ...Array.from({ length: 10 }, (_, i): [string, number, number] => [
    `vhf-frequency-${i}`,
    0x100 + 4 * i,
    4,
  ]),
  ...Array.from({ length: 18 }, (_, i): [string, number, number] => [
    `uhf-frequency-${i}`,
    0x1b0 + 4 * i,
    4,
  ]),
];

describe('decodeOpenGd77Calibration', () => {
  it('decodes every row at the source-declared offset', () => {
    const bytes = golden();
    const { rows, markerPresent } = decodeOpenGd77Calibration(bytes, 'mid-low');
    expect(markerPresent).toBe(true);
    expect(rows.map((r) => [r.id, r.offset, r.length]).sort()).toEqual([...EXPECTED].sort());
    for (const row of rows) {
      expect(Array.from(row.raw)).toEqual(
        Array.from(bytes.subarray(row.offset, row.offset + row.length)),
      );
      expect(row.layoutConfidence).toBe('source-declared');
    }
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId['uhf-high-power']!.decoded).toBe(Array.from(bytes.subarray(0x10, 0x19)).join(', '));
    expect(byId['vhf-ctcss-151']!.offset).toBe(0xab);
    expect(byId['rx-low-voltage']!.meaningConfidence).toBe('partly');
    expect(byId['vox-level-1']!.meaningConfidence).toBe('traced');
  });

  it('labels 0x1A0 and the power points by model', () => {
    const bytes = golden();
    const m = decodeOpenGd77Calibration(bytes, 'mid-low');
    const v = decodeOpenGd77Calibration(bytes, 'very-low');
    const label = (d: typeof m, id: string) => d.rows.find((r) => r.id === id)!.label;
    expect(label(m, 'uhf-low-slot-power')).toBe('Mid-low power (10 W point)');
    expect(label(v, 'uhf-low-slot-power')).toBe('Very-low power (250 mW point)');
    expect(label(m, 'uhf-high-power')).toBe('High power (40 W point)');
    expect(label(m, 'uhf-low-power')).toBe('Low power (5 W point)');
    expect(label(m, 'uhf-mid-power')).toBe('Mid power (25 W point)');
    expect(label(v, 'uhf-high-power')).toBe('High power (5 W point)');
    expect(label(v, 'uhf-low-power')).toBe('Low power (1 W point)');
    expect(label(v, 'uhf-mid-power')).toBe('Mid power (2 W point)');
    expect(v.rows.find((r) => r.id === 'uhf-high-power')!.note).toMatch(/scaled from the factory/);
    expect(m.rows.find((r) => r.id === 'uhf-high-power')!.note).toBeUndefined();
    expect(v.rows.find((r) => r.id === 'vhf-low-slot-power')!.note).toMatch(/synthesises/);
    expect(m.unknownRanges).toEqual(v.unknownRanges);
  });

  it('flags the rows OpenGD77 never reads: 20 on the MD-9600, 22 on the DM-1701', () => {
    const named = (d: ReturnType<typeof decodeOpenGd77Calibration>) =>
      d.rows.filter(
        (r) => !r.hasReader && r.group !== 'Frequency points' && !r.id.endsWith('-voltage'),
      );
    expect(named(decodeOpenGd77Calibration(golden(), 'mid-low'))).toHaveLength(20);
    expect(named(decodeOpenGd77Calibration(golden(), 'very-low'))).toHaveLength(22);
    const m = decodeOpenGd77Calibration(golden(), 'mid-low');
    const v = decodeOpenGd77Calibration(golden(), 'very-low');
    expect(m.rows.find((r) => r.id === 'uhf-rx-tuning')!.hasReader).toBe(true);
    expect(v.rows.find((r) => r.id === 'uhf-rx-tuning')!.hasReader).toBe(false);
    for (const r of m.rows.filter((x) => x.id.endsWith('-voltage'))) {
      expect(r.meaningConfidence).toBe('partly');
    }
  });

  it('classifies the 24 unknown ranges (154 bytes) as not used by OpenGD77', () => {
    const d = decodeOpenGd77Calibration(golden(), 'mid-low');
    expect(d.unknownRanges).toHaveLength(24);
    expect(d.unknownRanges.reduce((n, u) => n + u.length, 0)).toBe(154);
    for (const u of d.unknownRanges) {
      expect(u.meaning).toBe('not used by OpenGD77; stock meaning unknown');
    }
  });

  it('counts confidence and bytes', () => {
    const d = decodeOpenGd77Calibration(golden(), 'mid-low');
    const by = (c: string) => d.rows.filter((r) => r.meaningConfidence === c);
    expect(d.rows).toHaveLength(70);
    expect(by('partly')).toHaveLength(30);
    expect(by('unknown')).toHaveLength(0);
    expect(d.rows.reduce((n, r) => n + r.length, 0)).toBe(358);
  });

  it('covers each byte exactly once with rows and unknown ranges', () => {
    const d = decodeOpenGd77Calibration(golden(), 'very-low');
    const count = new Uint8Array(OPENGD77_CALIBRATION_LENGTH);
    for (const r of d.rows) for (let i = 0; i < r.length; i++) count[r.offset + i]!++;
    for (const u of d.unknownRanges) for (let i = 0; i < u.length; i++) count[u.offset + i]!++;
    expect(count.every((n) => n === 1)).toBe(true);
    expect(d.unknownRanges.map((u) => [u.offset, u.length])).toContainEqual([0x79, 23]);
    expect(d.unknownRanges.map((u) => [u.offset, u.length])).toContainEqual([0x1f8, 8]);
  });

  it('decodes frequency points as little-endian BCD in 10 Hz units, in MHz', () => {
    const bytes = golden();
    bytes.set([0x00, 0x25, 0x00, 0x40], 0x100);
    bytes.set([0x1a, 0x00, 0x00, 0x00], 0x104);
    const rows = decodeOpenGd77Calibration(bytes, 'mid-low').rows;
    const get = (id: string) => rows.find((r) => r.id === id)!;
    expect(get('vhf-frequency-0').decoded).toBe('400.02500 MHz');
    expect(get('vhf-frequency-1').decoded).toBe('invalid BCD');
    expect(Array.from(get('vhf-frequency-1').raw)).toEqual([0x1a, 0, 0, 0]);
  });

  it('shows oscillator tune as byte - 128 and keeps the raw byte', () => {
    const bytes = golden();
    bytes[0x09] = 125;
    bytes[0x0c] = 200;
    const rows = decodeOpenGd77Calibration(bytes, 'mid-low').rows;
    const get = (id: string) => rows.find((r) => r.id === id)!;
    expect(get('uhf-oscillator-tune').decoded).toBe('-3 (byte 125 - 128)');
    expect(get('vhf-oscillator-tune').decoded).toBe('72 (byte 200 - 128)');
    expect(Array.from(get('uhf-oscillator-tune').raw)).toEqual([125]);
  });

  it('shows the marker entries as the local marker with their MHz', () => {
    const rows = decodeOpenGd77Calibration(golden(), 'mid-low').rows;
    expect(rows.find((r) => r.id === 'uhf-frequency-0')!.decoded).toBe(
      'OpenGD77 local marker: 400.02500 MHz',
    );
    expect(rows.find((r) => r.id === 'uhf-frequency-1')!.decoded).toBe(
      'OpenGD77 local marker: 400.14500 MHz',
    );
    expect(rows.find((r) => r.id === 'uhf-frequency-2')!.decoded).toMatch(/ MHz$/);
  });

  it('shows raw only when the marker is absent', () => {
    const bytes = golden();
    bytes[OPENGD77_CALIBRATION_MARKER_OFFSET + 3] ^= 0xff;
    const d = decodeOpenGd77Calibration(bytes, 'mid-low');
    expect(d.markerPresent).toBe(false);
    expect(d.rows.every((r) => r.decoded === undefined)).toBe(true);
    expect(d.rows.find((r) => r.id === 'uhf-frequency-0')!.raw).toHaveLength(4);
  });

  it('throws unless the buffer is 512 bytes', () => {
    expect(() => decodeOpenGd77Calibration(new Uint8Array(511), 'mid-low')).toThrow(RangeError);
    expect(() => decodeOpenGd77Calibration(new Uint8Array(513), 'mid-low')).toThrow(RangeError);
  });
});
