import { describe, expect, it } from 'vitest';
import { newChannel, newRadioBuildForProfile } from '@core/domain/factories.ts';
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
});
