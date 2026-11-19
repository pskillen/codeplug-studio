import { describe, expect, it } from 'vitest';
import vectors from '../__fixtures__/mmzo-v1.json';
import { encodeUv5rMiniZoneTable } from './encode.ts';
import { decodeMiniOrder } from './orderDecode.ts';
import { decodeUv5rMiniZoneRead } from './zoneRead.ts';

const zones = [
  { name: 'First', slotIndexes: [40, 3, 998, 7], scanSlotIndexes: [40, 7] },
  { name: 'Second', slotIndexes: [9, 2], scanSlotIndexes: [9, 2] },
];

describe('read Mini zones', () => {
  it('round trips zone order, member order and scan sets', () => {
    const { sector } = encodeUv5rMiniZoneTable({ zones, writeScanSets: true, writeOrder: true });
    expect(decodeUv5rMiniZoneRead(sector)).toEqual({
      kind: 'zones',
      memberOrderFromRadio: true,
      scanSetsFromRadio: true,
      zones: [
        { wireName: 'First', channelNumbers: [41, 4, 999, 8], scanChannelNumbers: [41, 8] },
        { wireName: 'Second', channelNumbers: [10, 3], scanChannelNumbers: [10, 3] },
      ],
    });
  });
  it('falls back to ascending members without scan sets or order', () => {
    const { sector } = encodeUv5rMiniZoneTable({ zones, writeScanSets: false });
    expect(decodeMiniOrder(sector)).toMatchObject({ fromRadio: false });
    expect(decodeUv5rMiniZoneRead(sector)).toEqual({
      kind: 'zones',
      memberOrderFromRadio: false,
      scanSetsFromRadio: false,
      zones: [
        { wireName: 'First', channelNumbers: [4, 8, 41, 999] },
        { wireName: 'Second', channelNumbers: [3, 10] },
      ],
    });
  });
  it('preserves other orders when an order exceeds the available space', () => {
    const vector = vectors.vectors.fallback;
    const input = vector.zones.map((z, i) => ({
      name: z.name,
      slotIndexes: z.slots,
      scanSlotIndexes: [...z.slots]
        .sort((a, b) => a - b)
        .filter((_, j) => !(vector.skipped[i] ?? []).includes(j)),
    }));
    const result = decodeUv5rMiniZoneRead(
      encodeUv5rMiniZoneTable({ zones: input, writeScanSets: true, writeOrder: true }).sector,
    );
    expect(result.kind).toBe('zones');
    if (result.kind !== 'zones') return;
    expect(result.zones.map((z) => z.channelNumbers)).toEqual(
      vector.zones.map((z, i) =>
        ((vector.fallback as readonly number[]).includes(i)
          ? [...z.slots].sort((a, b) => a - b)
          : z.slots
        ).map((slot) => slot + 1),
      ),
    );
  });
  it('accepts an empty table', () => {
    expect(decodeUv5rMiniZoneRead(encodeUv5rMiniZoneTable({ zones: [] }).sector)).toMatchObject({
      kind: 'zones',
      zones: [],
    });
  });
  it('treats invalid tables as none', () => {
    const valid = encodeUv5rMiniZoneTable({ zones }).sector;
    const badMagic = valid.slice();
    badMagic[0] = 0;
    const badCrc = valid.slice();
    badCrc[0x400] ^= 1;
    for (const sector of [new Uint8Array(4096).fill(255), badMagic, badCrc, new Uint8Array(1)]) {
      expect(decodeUv5rMiniZoneRead(sector)).toMatchObject({
        kind: 'none',
        reason: expect.any(String),
      });
      expect(decodeMiniOrder(sector)).toEqual({ reject: 'no table' });
    }
  });
});
