import { describe, expect, it } from 'vitest';
import {
  createRadioCloneHydrationBag,
  createRadioCloneHydrationBagFromBlocks,
  isRadioCloneHydrationBag,
  radioCloneHasSparseBlocks,
  radioCloneImageBytes,
  radioCloneSparseBlockBytes,
} from './radioCloneHydration.ts';

describe('radioCloneHydration', () => {
  it('round-trips bytes through base64 retain', () => {
    const bytes = new Uint8Array([1, 2, 3, 255, 0]);
    const bag = createRadioCloneHydrationBag({
      radioModelId: 'UV5R-Mini',
      imageBytes: bytes,
      firmware: 'FW',
    });
    expect(isRadioCloneHydrationBag(bag)).toBe(true);
    expect(radioCloneImageBytes(bag)).toEqual(bytes);
    expect(bag.retain.imageByteLength).toBe(5);
    expect(radioCloneHasSparseBlocks(bag)).toBe(false);
  });

  it('round-trips sparse blocks', () => {
    const blockA = new Uint8Array(4096);
    blockA[0] = 0x12;
    blockA[0xfff] = 0x12;
    const blockB = new Uint8Array(4096);
    blockB[0xfff] = 0x04;
    const bag = createRadioCloneHydrationBagFromBlocks({
      radioModelId: 'DM-32UV',
      blocks: [
        { address: 0x1000, data: blockA },
        { address: 0x2000, data: blockB },
      ],
      addressBase: 0x1000,
      firmware: 'V1',
    });
    expect(isRadioCloneHydrationBag(bag)).toBe(true);
    expect(radioCloneHasSparseBlocks(bag)).toBe(true);
    expect(bag.retain.imageBase64).toBe('');
    expect(bag.retain.imageByteLength).toBe(8192);
    expect(bag.retain.addressBase).toBe(0x1000);
    const decoded = radioCloneSparseBlockBytes(bag);
    expect(decoded).toHaveLength(2);
    expect(decoded[0]!.address).toBe(0x1000);
    expect(decoded[0]!.data[0]).toBe(0x12);
    expect(decoded[1]!.data[0xfff]).toBe(0x04);
    expect(() => radioCloneImageBytes(bag)).toThrow(/sparse/);
  });

  it('rejects empty contiguous and empty sparse bags', () => {
    expect(
      isRadioCloneHydrationBag({
        formatId: 'radio-clone',
        capturedAt: '2026-01-01T00:00:00.000Z',
        retain: {
          radioModelId: 'x',
          capturedVia: 'web-serial',
          imageBase64: '',
          imageByteLength: 0,
        },
      }),
    ).toBe(false);
  });

  it('rejects neonplug-shaped bags', () => {
    expect(
      isRadioCloneHydrationBag({
        formatId: 'neonplug',
        capturedAt: '2026-01-01T00:00:00.000Z',
        retain: {},
      }),
    ).toBe(false);
  });
});
