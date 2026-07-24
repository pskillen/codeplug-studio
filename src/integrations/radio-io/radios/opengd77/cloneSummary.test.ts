/**
 * OpenGD77 clone summary tests.
 */

import { describe, expect, it } from 'vitest';
import { createRadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import { OPENUV380_IMAGE_SIZE, OPENUV380_OFFSET } from './constants.ts';
import { encodeChannelsIntoImage } from './channelCodec.ts';
import { encodeContactsIntoImage } from './contactCodec.ts';
import { extractOpenGd77Hydration } from './hydration.ts';
import { createOpenUv380Image, writeAbs } from './memory.ts';
import { encodeZonesIntoImage } from './zoneCodec.ts';
import { summariseOpenGd77Clone } from './cloneSummary.ts';
import { settingsRetainPreview } from './retainPreview.ts';

describe('summariseOpenGd77Clone', () => {
  it('summarises occupied channels, zones, contacts, and write gaps', () => {
    const image = createOpenUv380Image();
    encodeContactsIntoImage(image, [{ index: 1, wireName: 'TG91', digitalId: 91, callType: 0 }]);
    encodeChannelsIntoImage(image, [
      {
        slotIndex: 1,
        empty: false,
        wireName: 'CH1',
        rxHz: 145_500_000,
        txHz: 145_500_000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'NFM',
        mode: 'digital',
        txContactId: 1,
      },
    ]);
    encodeZonesIntoImage(image, [{ wireName: 'Local', channelNumbers: [1] }]);

    const settings = new Uint8Array(0x90);
    settings.fill(0xff);
    const call = new TextEncoder().encode('MM9PDY');
    settings.set(call, 0x60);
    settings[0x68] = 1;
    settings[0x69] = 0;
    settings[0x6a] = 0;
    settings[0x6b] = 0;
    writeAbs(image, OPENUV380_OFFSET.settings, settings);

    const bag = extractOpenGd77Hydration(image, { firmware: 'R20240101000000' });
    const summary = summariseOpenGd77Clone(bag);
    expect(summary.radioModelId).toBe('DM-1701');
    expect(summary.firmware).toBe('R20240101000000');
    expect(summary.onRadioCounts.occupiedChannels).toBe(1);
    expect(summary.onRadioCounts.zoneCount).toBe(1);
    expect(summary.onRadioCounts.contactCount).toBe(1);
    expect(summary.writtenFromBuild).toContain('Channels');
    expect(summary.writtenFromBuild).toContain('Zones');
    expect(summary.dtmfContactsWriteGap).toMatch(/DTMF contacts stay/);
    expect(summary.aprsWriteGap).toMatch(/FM APRS systems stay/);
    expect(summary.retainGroups.some((g) => g.label === 'General settings')).toBe(true);
    expect(summary.settingsRetain.some((r) => r.label === 'Callsign' && r.value === 'MM9PDY')).toBe(
      true,
    );
  });

  it('returns empty settings preview when general settings are blank', () => {
    const bytes = new Uint8Array(OPENUV380_IMAGE_SIZE);
    bytes.fill(0xff);
    const bag = createRadioCloneHydrationBag({
      radioModelId: 'DM-1701',
      imageBytes: bytes,
    });
    const image = createOpenUv380Image();
    expect(settingsRetainPreview(image)).toEqual([]);
    expect(summariseOpenGd77Clone(bag).onRadioCounts.occupiedChannels).toBe(0);
  });
});
