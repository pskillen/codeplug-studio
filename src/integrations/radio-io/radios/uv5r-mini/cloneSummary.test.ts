import { describe, expect, it } from 'vitest';
import { createRadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import { UV5R_MINI_MEM_TOTAL } from './constants.ts';
import { summariseUv5rMiniClone } from './cloneSummary.ts';

describe('summariseUv5rMiniClone', () => {
  it('summarises an empty synthetic image', () => {
    const image = new Uint8Array(UV5R_MINI_MEM_TOTAL);
    image.fill(0xff);
    const bag = createRadioCloneHydrationBag({
      radioModelId: 'UV5R-Mini',
      imageBytes: image,
      firmware: 'TEST-FW',
    });
    const summary = summariseUv5rMiniClone(bag);
    expect(summary.radioModelId).toBe('UV5R-Mini');
    expect(summary.firmware).toBe('TEST-FW');
    expect(summary.imageByteLength).toBe(UV5R_MINI_MEM_TOTAL);
    expect(summary.occupiedChannelCount).toBe(0);
    expect(summary.regions.length).toBeGreaterThanOrEqual(4);
    expect(summary.regions.some((r) => r.label === 'Radio settings')).toBe(true);
  });
});
