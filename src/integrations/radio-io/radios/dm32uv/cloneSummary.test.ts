/**
 * DM-32UV clone summary tests.
 */

import { describe, expect, it } from 'vitest';
import { createRadioCloneHydrationBagFromBlocks } from '@core/models/radioCloneHydration.ts';
import { DM32_METADATA } from './constants.ts';
import { makeEmptyBlock, makeFirstChannelBlock } from './__fixtures__/scriptedPipe.ts';
import { summariseDm32uvClone } from './cloneSummary.ts';
import { settingsRetainPreview } from './retainPreview.ts';

describe('summariseDm32uvClone', () => {
  it('summarises sparse blocks with retain groups and written-from-build manifest', () => {
    const channelBlock = makeFirstChannelBlock(2);
    const settingsBlock = makeEmptyBlock(DM32_METADATA.VFO_SETTINGS);
    settingsBlock[0x01] = 0x48; // 'H'
    settingsBlock[0x02] = 0x69; // 'i'
    settingsBlock[0x1e] = 2;
    settingsBlock[0x40] = 1;

    const bag = createRadioCloneHydrationBagFromBlocks({
      radioModelId: 'DM-32UV',
      blocks: [
        { address: 0x1000, data: channelBlock },
        { address: 0x2000, data: settingsBlock },
      ],
      addressBase: 0x1000,
      firmware: 'DM32.TEST.001',
      capturedVia: 'web-serial',
    });

    const summary = summariseDm32uvClone(bag);
    expect(summary.radioModelId).toBe('DM-32UV');
    expect(summary.firmware).toBe('DM32.TEST.001');
    expect(summary.writtenFromBuild).toContain('Channels');
    expect(summary.writtenFromBuild).toContain('Zones');
    expect(summary.onRadioCounts.occupiedChannels).toBe(0);
    expect(summary.retainGroups.some((g) => g.label === 'Radio settings')).toBe(true);
    expect(summary.retainGroups.some((g) => g.label === 'Channel bank (first)')).toBe(false);
    expect(summary.settingsRetain.some((r) => r.label === 'GPS')).toBe(true);
    expect(summary.requiredBlocks.some((r) => r.label === 'Radio settings' && r.present)).toBe(
      true,
    );
  });
});

describe('settingsRetainPreview', () => {
  it('excludes APRS-only offsets from retain rows', () => {
    const block = makeEmptyBlock(DM32_METADATA.VFO_SETTINGS);
    block[0x301] = 5;
    block[0x302] = 1;
    const rows = settingsRetainPreview(block);
    expect(rows.some((r) => r.label.toLowerCase().includes('aprs'))).toBe(false);
    expect(rows.some((r) => r.label.toLowerCase().includes('beacon'))).toBe(false);
  });
});
