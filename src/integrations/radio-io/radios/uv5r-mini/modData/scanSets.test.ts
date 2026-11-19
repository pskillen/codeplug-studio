import { describe, expect, it } from 'vitest';
import vectors from '../__fixtures__/mmzs-v1.json';
import { assertUv5rMiniWriteAllowed } from '../writeInterlock.ts';
import { decodeUv5rMiniZoneTable } from './decode.ts';
import { encodeUv5rMiniZoneTable } from './encode.ts';
import { encodeMiniScanSets } from './scanSets.ts';
import { decodeMiniScanSets } from './scanSetsDecode.ts';

const hex = (bytes: Uint8Array) => [...bytes].map((v) => v.toString(16).padStart(2, '0')).join('');
const fromHex = (value: string) => Uint8Array.from(value.match(/../g)!.map((b) => parseInt(b, 16)));

describe('MMZS golden vectors', () => {
  for (const [name, vector] of Object.entries(vectors.vectors)) {
    it(name, () => {
      const fallback: readonly number[] = vector.fallback;
      const sets = vector.zones.map((zone, i) => {
        const skipped = new Set(vector.skipped[i] ?? []);
        return zone.slots.map((_, j) => !skipped.has(j));
      });
      const result = encodeMiniScanSets(sets, vector.generation);
      expect(result.kinds).toEqual(vector.kinds);
      expect(result.fallback).toEqual(vector.fallback);
      const input = {
        zones: vector.zones.map((z, i) => ({
          name: z.name,
          slotIndexes: z.slots,
          scanSlotIndexes: z.slots.filter((_, j) => sets[i]![j]),
        })),
      };
      const table = encodeUv5rMiniZoneTable(input);
      const encoded = encodeUv5rMiniZoneTable({ ...input, writeScanSets: true });
      const reversed = encodeUv5rMiniZoneTable({
        zones: input.zones.map((zone) => ({
          ...zone,
          slotIndexes: [...zone.slotIndexes].reverse(),
        })),
        writeScanSets: true,
      });
      expect(reversed.frames).toEqual(encoded.frames);
      expect(encoded.frames.slice(0, table.frames.length)).toEqual(table.frames);
      expect(encoded.frames.map((f) => ({ addr: f.address, hex: hex(f.bytes) }))).toEqual(
        vector.frames,
      );
      const rebuilt = new Uint8Array(4096).fill(255);
      for (const frame of encoded.frames) {
        expect(() =>
          assertUv5rMiniWriteAllowed(frame.address, frame.bytes.length, {
            profile: 'mm9pdy',
            operation: 'write',
          }),
        ).not.toThrow();
        expect(frame.address).toBeLessThan(0xd000);
        rebuilt.set(frame.bytes, frame.address - 0xc000);
      }
      const blockFrames = encoded.frames.slice(table.frames.length);
      expect(blockFrames.map((f) => f.address)).toEqual(result.frames.map((f) => f.address));
      expect(blockFrames.every((f) => f.address !== 0xe000 && f.address % 0x1000 !== 0)).toBe(true);
      expect(decodeMiniScanSets(rebuilt)).toEqual({
        kinds: vector.kinds,
        include: sets.map((set, i) => (fallback.includes(i) ? set.map(() => true) : set)),
      });
      const stream = new Uint8Array([
        ...rebuilt.slice(0x40, 0x200),
        ...rebuilt.slice(0x380, 0x400),
      ]);
      expect(hex(stream.slice(0, 22 + vector.length))).toBe(vector.block_hex);
      expect(stream.slice(22 + vector.length).every((b) => b === 255)).toBe(true);
    });
  }
  for (const [name, vector] of Object.entries(vectors.rejects)) {
    it(`table still decodes beside reject ${name}`, () => {
      const sector = encodeUv5rMiniZoneTable({
        zones: vector.zones.map((z) => ({ name: z.name, slotIndexes: z.slots })),
      }).sector;
      const stream = fromHex(vector.stream_hex);
      sector.set(stream.slice(0, 448), 0x40);
      sector.set(stream.slice(448), 0x380);
      expect(decodeMiniScanSets(sector)).toEqual({ reject: vector.reason });
      expect(decodeUv5rMiniZoneTable(sector)).toMatchObject({
        zones: vector.zones.map((z) => ({ name: z.name, slotIndexes: z.slots })),
      });
    });
  }
});
