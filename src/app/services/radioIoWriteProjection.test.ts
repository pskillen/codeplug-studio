import { describe, expect, it } from 'vitest';
import {
  newChannel,
  newRadioBuildForProfile,
  newTalkGroup,
  newZone,
} from '@core/domain/factories.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { assemble } from '@core/services/assemble.ts';
import { buildRadioWriteProjection } from './radioIoWriteProjection.ts';

function emptyLibrary(channels: LibrarySlice['channels'] = []): LibrarySlice {
  return {
    channels,
    zones: [],
    scanLists: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    aprsConfiguration: null,
  };
}

describe('buildRadioWriteProjection', () => {
  it('maps channels and source→number map for radio-io-dm32uv', () => {
    const ch = {
      ...newChannel('p1', 'A'),
      id: 'ch-a',
      rxFrequency: 145_000_000,
      txFrequency: 145_000_000,
    };
    const library = emptyLibrary([ch]);
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-dm32uv');
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress);
    expect(projection.channels.length).toBeGreaterThanOrEqual(1);
    expect(projection.numbersBySourceChannelId.get('ch-a')).toEqual([1]);
    expect(projection.organisation.zones).toEqual([]);
    expect(projection.organisation.scanLists).toHaveLength(1);
    expect(projection.organisation.scanLists?.[0]?.wireName).toBe('Scan list 1');
  });

  it('maps channels, zones, and contacts for radio-io-opengd77-1701', () => {
    const ch = {
      ...newChannel('p1', 'A'),
      id: 'ch-a',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
    };
    const zone = {
      ...newZone('p1', 'Local'),
      id: 'zone-a',
      members: [{ kind: 'channel' as const, channelId: 'ch-a' }],
    };
    const tg = { ...newTalkGroup('p1', 'TG91', 91), id: 'tg-91' };
    const library = {
      ...emptyLibrary([ch]),
      zones: [zone],
      talkGroups: [tg],
    };
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-opengd77-1701');
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress);
    expect(projection.channels.length).toBeGreaterThanOrEqual(1);
    expect(projection.channels[0]?.wireName).toBeTruthy();
    expect(projection.numbersBySourceChannelId.get('ch-a')).toEqual([1]);
    expect(projection.organisation.scanLists).toBeUndefined();
    expect(projection.organisation.talkGroups).toEqual([
      expect.objectContaining({ index: 1, digitalId: 91, callType: 0 }),
    ]);
    expect(projection.organisation.zones).toEqual([
      expect.objectContaining({ wireName: 'Local', channelNumbers: [1] }),
    ]);
  });
});
