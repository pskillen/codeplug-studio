import { describe, expect, it } from 'vitest';

import {
  diffUv5rMiniChannels,
  formatUv5rMiniChannelChange,
  formatUv5rMiniSpecialSlot,
  UV5R_MINI_CHANNEL_FIELDS,
} from './channelDiff.ts';

const SIZE = 32;
const at = (slot: number) => (slot - 1) * SIZE;

/** A synthetic live record: made-up BCD frequencies, no tones, flags zero, a test name. */
function record(name: string): Uint8Array {
  const r = new Uint8Array(SIZE);
  r.set([0x00, 0x00, 0x00, 0x10], 0); // RX 100.00000 MHz (synthetic)
  r.set([0x00, 0x00, 0x00, 0x10], 4);
  r[12] = 0x01;
  const bytes = new TextEncoder().encode(name);
  r.set(bytes.subarray(0, 12), 20);
  return r;
}

/** A 64 KiB read with every channel slot empty, and slots 1–3 live. */
function base(): Uint8Array {
  const img = new Uint8Array(0x10000);
  img.fill(0xff, 0, 999 * SIZE);
  img.set(record('TEST A'), at(1));
  img.set(record('TEST B'), at(2));
  img.set(record('TEST C'), at(3));
  return img;
}

describe('diffUv5rMiniChannels', () => {
  it('reports nothing for identical reads, and both special slots as identical', () => {
    const d = diffUv5rMiniChannels(base(), base());
    expect(d.changes).toEqual([]);
    expect(d.unchangedCount).toBe(997);
    expect(d.special.map(formatUv5rMiniSpecialSlot)).toEqual([
      'Slot 248 (0x1EE0–0x1EFF, special data): identical',
      'Slot 249 (0x1F00–0x1F1F, special data): identical',
    ]);
  });

  it.each(UV5R_MINI_CHANNEL_FIELDS.map((f) => [f.label, f] as const))(
    'names a change to %s and only that field',
    (_label, field) => {
      const b = base();
      const mask = field.mask ?? 0xff;
      b[at(2) + field.offset + field.length - 1] ^= mask & -mask; // lowest bit of the field's last byte
      const d = diffUv5rMiniChannels(base(), b);
      expect(d.unchangedCount).toBe(996);
      expect(d.changes).toHaveLength(1);
      const c = d.changes[0]!;
      expect(c.slot).toBe(2);
      expect(c.kind).toBe('changed');
      expect(c.fields).toEqual([field.label]);
      expect(c.unmodelledUnchanged).toBe(field.modelled);
    },
  );

  it('says which fields changed and that the unmodelled bytes were kept', () => {
    const b = base();
    b.set(record('TEST Z'), at(2));
    b[at(2) + 10] = 0x5e; // TX tone
    const [c] = diffUv5rMiniChannels(base(), b).changes;
    expect(formatUv5rMiniChannelChange(c!)).toBe(
      'Slot 2 "TEST Z" (was "TEST B"): TX tone, name changed; unmodelled bytes and bits of +0x0C..+0x13 unchanged',
    );
  });

  it('says only the unmodelled bytes and bits were kept when power changed', () => {
    const b = base();
    b[at(2) + 14] ^= 0x01; // +0x0E bit 0: power, inside +0x0C..+0x13
    const [c] = diffUv5rMiniChannels(base(), b).changes;
    expect(c!.fields).toEqual(['power']);
    expect(formatUv5rMiniChannelChange(c!)).toBe(
      'Slot 2 "TEST B": power changed; unmodelled bytes and bits of +0x0C..+0x13 unchanged',
    );
  });

  it('leaves out the unchanged note when an unmodelled byte changed', () => {
    const b = base();
    b[at(3) + 13] = 0x02; // PTT ID
    const [c] = diffUv5rMiniChannels(base(), b).changes;
    expect(formatUv5rMiniChannelChange(c!)).toBe('Slot 3 "TEST C": PTT ID changed');
  });

  it('reports a slot going from empty to filled and back', () => {
    const b = base();
    b.set(record('TEST NEW'), at(37));
    b.fill(0xff, at(1), at(1) + SIZE);
    const d = diffUv5rMiniChannels(base(), b);
    expect(d.changes.map((c) => [c.slot, c.kind])).toEqual([
      [1, 'emptied'],
      [37, 'filled'],
    ]);
    expect(d.changes.map(formatUv5rMiniChannelChange)).toEqual([
      'Slot 1: emptied (was "TEST A")',
      'Slot 37: filled "TEST NEW"',
    ]);
    expect(d.unchangedCount).toBe(995);
  });

  it('reports bytes that change inside a slot empty in both reads', () => {
    const b = base();
    b[at(50) + 25] = 0x41;
    const [c] = diffUv5rMiniChannels(base(), b).changes;
    expect(c!.kind).toBe('emptyChanged');
    expect(formatUv5rMiniChannelChange(c!)).toBe('Slot 50: empty in both reads; differs in name');
  });

  it('keeps slots 248 and 249 out of the channel list and reports them on their own', () => {
    const b = base();
    b[at(248) + 0x10] = 0x00;
    b[at(248) + 0x1f] = 0x00;
    b[at(249)] = 0x00;
    const d = diffUv5rMiniChannels(base(), b);
    expect(d.changes).toEqual([]);
    expect(d.unchangedCount).toBe(997);
    expect(d.special.map(formatUv5rMiniSpecialSlot)).toEqual([
      'Slot 248 (0x1EE0–0x1EFF, special data): 2 bytes differ at +0x10 +0x1F',
      'Slot 249 (0x1F00–0x1F1F, special data): 1 byte differs at +0x00',
    ]);
  });
});
