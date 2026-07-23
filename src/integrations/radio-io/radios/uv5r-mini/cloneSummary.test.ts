import { describe, expect, it } from 'vitest';
import { createRadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import { UV5R_MINI_MEM_TOTAL, UV5R_MINI_SETTINGS_OFFSET } from './constants.ts';
import { summariseUv5rMiniClone } from './cloneSummary.ts';
import { createSyntheticImageBase } from './__fixtures__/syntheticImage.ts';
import { UV5R_MINI_WRITTEN_FROM_BUILD_LABELS } from './writeRole.ts';

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
    expect(summary.onRadioCounts.occupiedChannels).toBe(0);
    expect(summary.onRadioCounts.emptyChannelSlots).toBe(999);
    expect(summary.writtenFromBuild).toEqual([...UV5R_MINI_WRITTEN_FROM_BUILD_LABELS]);
    expect(summary.retainGroups.map((g) => g.label)).toEqual([
      'VFO A',
      'VFO B',
      'Radio settings',
      'ANI',
      'PTT ID',
      'Upcode',
      'Downcode',
    ]);
    expect(summary.retainGroups.some((g) => g.label === 'Channel memories')).toBe(false);
    expect(summary.settingsRetain.length).toBeGreaterThan(0);
    expect(summary.ancillaryRetain.rows.some((r) => r.label === 'VFO A')).toBe(true);
  });

  it('decodes settings from known bytes in synthetic image', () => {
    const image = createSyntheticImageBase();
    image[UV5R_MINI_SETTINGS_OFFSET] = 2; // squelch index 2 -> "2"
    image[UV5R_MINI_SETTINGS_OFFSET + 4] = 1; // dual watch On
    const bag = createRadioCloneHydrationBag({
      radioModelId: 'UV5R-Mini',
      imageBytes: image,
    });
    const summary = summariseUv5rMiniClone(bag);
    const squelch = summary.settingsRetain.find((r) => r.label === 'Squelch');
    const dualWatch = summary.settingsRetain.find((r) => r.label === 'Dual watch');
    expect(squelch?.value).toBe('2');
    expect(dualWatch?.value).toBe('On');
  });
});
