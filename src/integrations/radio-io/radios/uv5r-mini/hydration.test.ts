import { describe, expect, it } from 'vitest';
import { isRadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import { memoryMapFromBytes } from '../../kit/memoryMap.ts';
import { createSyntheticImageBase } from './__fixtures__/syntheticImage.ts';
import { encodeChannelsIntoImage } from './channelCodec.ts';
import {
  extractUv5rMiniHydration,
  mergeChannelsIntoUv5rMiniHydration,
  memoryMapFromUv5rMiniHydration,
} from './hydration.ts';

describe('UV-5R Mini hydration', () => {
  it('round-trips image through cpsWireHydration-shaped bag', () => {
    const source = createSyntheticImageBase();
    source[0x8040] = 0x42;
    const map = memoryMapFromBytes(source);
    const bag = extractUv5rMiniHydration(map, { sourceFileName: 'web-serial' });
    expect(isRadioCloneHydrationBag(bag)).toBe(true);
    expect(bag.formatId).toBe('radio-clone');
    expect(bag.retain.radioModelId).toBe('UV5R-Mini');
    expect(bag.retain.firmware).toBe('UV5RMINI-TEST');

    const restored = memoryMapFromUv5rMiniHydration(bag);
    expect(restored.bytes[0x8040]).toBe(0x42);
  });

  it('merges channels without wiping settings bytes', () => {
    const source = createSyntheticImageBase();
    source[0x8040] = 0x99;
    const bag = extractUv5rMiniHydration(memoryMapFromBytes(source));
    const merged = mergeChannelsIntoUv5rMiniHydration(bag, [
      {
        slotIndex: 1,
        empty: false,
        wireName: 'HYDR',
        rxHz: 145_500_000,
        txHz: 145_500_000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'FM',
      },
    ]);
    expect(merged.bytes[0x8040]).toBe(0x99);
    // Channel name starts at offset 20
    expect(String.fromCharCode(...merged.bytes.subarray(20, 24))).toBe('HYDR');
  });

  it('encode into image then hydrate still keeps firmware', () => {
    const source = createSyntheticImageBase();
    encodeChannelsIntoImage(source, [
      {
        slotIndex: 5,
        empty: false,
        wireName: 'FIVE',
        rxHz: 146_520_000,
        txHz: 146_520_000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 20,
        bandwidth: 'NFM',
      },
    ]);
    const bag = extractUv5rMiniHydration(memoryMapFromBytes(source));
    expect(bag.retain.firmware).toBe('UV5RMINI-TEST');
  });
});
