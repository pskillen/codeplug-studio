import { describe, expect, it } from 'vitest';
import vectors from '../__fixtures__/mmd1-sections-v1.json';
import { encodeRt95ModData, Rt95ModDataError } from './encode.ts';

const image = new Uint8Array(200 * 32).fill(0xff);
for (const channel of vectors.channels) {
  image.set(
    Uint8Array.from(channel.record.match(/../g)!.map((byte) => parseInt(byte, 16))),
    channel.index * 32,
  );
}

describe('RT95 section encoder vectors', () => {
  for (const vector of vectors.encode) {
    it(vector.id, () => {
      const input = {
        zones: vector.zones.map((z) => ({
          name: z.name,
          channelIndexes: z.channel_indexes,
          ...('scan_indexes' in z && z.scan_indexes !== undefined
            ? { scanIndexes: z.scan_indexes }
            : {}),
        })),
        descriptions: vector.descriptions.map((d) => ({
          channelIndex: d.channel_index,
          text: d.text,
        })),
        writeSections: vector.sections,
      };
      const result = encodeRt95ModData(input, image);
      expect(result.zoneGeneration).toBe(parseInt(vector.zone_generation, 16));
      expect(result.descriptionGeneration).toBe(parseInt(vector.description_generation, 16));
      expect(
        result.blocks.map((b) => ({
          address: `0x${b.address.toString(16).toUpperCase().padStart(4, '0')}`,
          hex: Array.from(b.bytes, (n) => n.toString(16).toUpperCase().padStart(2, '0')).join(''),
        })),
      ).toEqual(vector.blocks);
      const info = Object.fromEntries(
        Object.entries(result.sections ?? {}).map(([key, value]) => [
          key,
          {
            ...value,
            generation: `0x${value.generation.toString(16).toUpperCase().padStart(4, '0')}`,
          },
        ]),
      );
      expect(info).toEqual(vector.section_info);
      if (!vector.sections)
        expect(encodeRt95ModData({ ...input, writeSections: undefined }, image)).toEqual(result);
    });
  }
  it('fills the order capacity exactly, skips one byte over and tries later zones', () => {
    const descending = (n: number) => Array.from({ length: n }, (_, i) => n - i - 1);
    const zones = [200, 200, 200, 200, 200, 200, 46, 2, 2].map((n, i) => ({
      name: `Z${i}`,
      channelIndexes: descending(n),
    }));
    const result = encodeRt95ModData({ zones, descriptions: [], writeSections: true }, image);
    expect(result.sections?.MMDO.length).toBe(1260);
    expect(result.sections?.MMDO.fallback).toEqual([7, 8]);
    zones[6] = { name: 'Z6', channelIndexes: descending(47) };
    const over = encodeRt95ModData({ zones, descriptions: [], writeSections: true }, image);
    expect(over.sections?.MMDO.fallback).toEqual([6]);
    expect(over.sections?.MMDO.kinds.slice(6)).toEqual([0, 1, 1]);
  });
  it('rejects duplicate members and scan non-members only with sections', () => {
    for (const zone of [
      { name: 'Z', channelIndexes: [1, 1] },
      { name: 'Z', channelIndexes: [1], scanIndexes: [2] },
    ]) {
      expect(() =>
        encodeRt95ModData({ zones: [zone], descriptions: [], writeSections: true }, image),
      ).toThrow(Rt95ModDataError);
      expect(() => encodeRt95ModData({ zones: [zone], descriptions: [] }, image)).not.toThrow();
    }
  });
});
