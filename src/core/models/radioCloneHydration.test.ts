import { describe, expect, it } from 'vitest';
import {
  createRadioCloneHydrationBag,
  isRadioCloneHydrationBag,
  radioCloneImageBytes,
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
