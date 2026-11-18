import { describe, expect, it } from 'vitest';
import vectors from '../__fixtures__/mmzo-v1.json';
import { assertUv5rMiniWriteAllowed } from '../writeInterlock.ts';
import { encodeUv5rMiniZoneTable, encodeUv5rMiniZoneWrite } from './encode.ts';
import { encodeMiniOrder } from './order.ts';
import { decodeMiniOrder } from './orderDecode.ts';
import { fillMiniScanSets } from './scanSets.ts';

const hex = (bytes: Uint8Array) => [...bytes].map((v) => v.toString(16).padStart(2, '0')).join('');

describe('MMZO golden vectors', () => {
  for (const [name, vector] of Object.entries(vectors.vectors)) {
    it(name, () => {
      const sets = vector.zones.map((zone, i) => {
        const skipped = new Set(vector.skipped[i] ?? []);
        return [...zone.slots].sort((a, b) => a - b).map((_, j) => !skipped.has(j));
      });
      const filled = fillMiniScanSets(sets);
      const order = encodeMiniOrder(
        vector.zones.map((z) => z.slots),
        Math.ceil(filled.bits.length / 8),
        vector.generation,
      );
      expect(order.kinds).toEqual(vector.kinds);
      expect(order.fallback).toEqual(vector.fallback);
      const encoded = encodeUv5rMiniZoneWrite({
        zones: vector.zones.map((z, i) => ({
          name: z.name,
          slotIndexes: z.slots,
          scanSlotIndexes: [...z.slots].sort((a, b) => a - b).filter((_, j) => sets[i]![j]),
        })),
      });
      expect(encoded.frames.map((f) => ({ addr: f.address, hex: hex(f.bytes) }))).toEqual(
        vector.frames,
      );
      expect(decodeMiniOrder(encoded.sector)).toMatchObject({ fromRadio: name !== 'no_room' });
      expect(decodeMiniOrder(encoded.sector)).toHaveProperty(
        'slots',
        vector.zones.map((z, i) =>
          (vector.fallback as readonly number[]).includes(i)
            ? [...z.slots].sort((a, b) => a - b)
            : z.slots,
        ),
      );
      for (const frame of encoded.frames)
        expect(() =>
          assertUv5rMiniWriteAllowed(frame.address, frame.bytes.length, {
            profile: 'mm9pdy',
            operation: 'write',
          }),
        ).not.toThrow();
    });
  }
  for (const [name, vector] of Object.entries(vectors.rejects)) {
    it(`reject ${name} falls back to slot order`, () => {
      const sector = encodeUv5rMiniZoneTable({
        zones: vector.zones.map((z) => ({ name: z.name, slotIndexes: z.slots })),
      }).sector;
      const stream = Uint8Array.from(vector.stream_hex.match(/../g)!.map((b) => parseInt(b, 16)));
      sector.set(stream.slice(0, 448), 0x40);
      sector.set(stream.slice(448), 0x380);
      expect(decodeMiniOrder(sector)).toHaveProperty(
        'slots',
        vector.zones.map((z) => [...z.slots].sort((a, b) => a - b)),
      );
    });
  }
});
