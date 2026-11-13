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
    expect(bag.retain.firmware).toBeUndefined();

    const restored = memoryMapFromUv5rMiniHydration(bag);
    expect(restored.bytes[0x8040]).toBe(0x42);
  });

  it('clears orphan channels not in the projection', () => {
    const source = createSyntheticImageBase();
    encodeChannelsIntoImage(source, [
      {
        slotIndex: 3,
        empty: false,
        wireName: 'ORPH',
        rxHz: 146_520_000,
        txHz: 146_520_000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'FM',
      },
    ]);
    const bag = extractUv5rMiniHydration(memoryMapFromBytes(source));
    const merged = mergeChannelsIntoUv5rMiniHydration(bag, [
      {
        slotIndex: 1,
        empty: false,
        wireName: 'KEEP',
        rxHz: 145_500_000,
        txHz: 145_500_000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'FM',
      },
    ]);
    const slot3Offset = (3 - 1) * 32;
    expect(merged.bytes.subarray(slot3Offset, slot3Offset + 32).every((b) => b === 0xff)).toBe(
      true,
    );
    expect(String.fromCharCode(...merged.bytes.subarray(20, 24))).toBe('KEEP');
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

  it('reads no firmware string from live slots 248 and 249', () => {
    const source = createSyntheticImageBase();
    encodeChannelsIntoImage(
      source,
      [248, 249].map((slotIndex) => ({
        slotIndex,
        empty: false,
        wireName: `SLOT${slotIndex}`,
        rxHz: 146_520_000,
        txHz: 146_520_000,
        rxTone: { kind: 'none' as const },
        txTone: { kind: 'none' as const },
        powerPercent: 20,
        bandwidth: 'NFM' as const,
      })),
    );
    const bag = extractUv5rMiniHydration(memoryMapFromBytes(source));
    expect(bag.retain.firmware).toBeUndefined();
  });
});
