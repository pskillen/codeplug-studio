import { describe, expect, it } from 'vitest';
import { newChannel, newFormatBuild, newZone } from '@core/domain/factories.ts';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import { assemble } from '@core/services/assemble.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import { partitionAnytoneZones } from './zonePartition.ts';

const PROJECT_ID = 'proj-zone-partition';

function dmrChannel(name: string) {
  return {
    ...newChannel(PROJECT_ID, name),
    rxFrequency: 430_000_000,
    txFrequency: 430_000_000,
    modeProfiles: [defaultModeProfile('dmr')],
  };
}

function airbandChannel(name: string) {
  return {
    ...newChannel(PROJECT_ID, name),
    rxFrequency: 118_800_000,
    txFrequency: null,
    forbidTransmit: true,
    modeProfiles: [defaultModeProfile('am')],
  };
}

function libraryWithZones(
  channels: ReturnType<typeof dmrChannel>[],
  zones: ReturnType<typeof newZone>[],
): LibrarySlice {
  return {
    channels,
    zones,
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    scanLists: [],
  };
}

function anytoneBuild(library: LibrarySlice): FormatBuild {
  return {
    ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv', 'Zone partition'),
    layout: { sections: [] },
    channelOverrides: library.channels.map((ch) => ({
      libraryEntityId: ch.id,
      wireName: ch.name,
    })),
  };
}

describe('partitionAnytoneZones', () => {
  it('keeps non-airband-only zones on DMR side only', () => {
    const ch = dmrChannel('DMR 1');
    const zone = {
      ...newZone(PROJECT_ID, 'DMR Zone'),
      members: [{ kind: 'channel' as const, channelId: ch.id }],
    };
    const library = libraryWithZones([ch], [zone]);
    const assembled = assemble(anytoneBuild(library), library);

    const { dmrZones, amZones } = partitionAnytoneZones(assembled);
    expect(dmrZones).toHaveLength(1);
    expect(dmrZones[0]!.memberChannelIds).toEqual([ch.id]);
    expect(amZones).toHaveLength(0);
  });

  it('keeps airband-only zones on AM side only', () => {
    const ch = airbandChannel('Tower');
    const zone = {
      ...newZone(PROJECT_ID, 'AM Zone'),
      members: [{ kind: 'channel' as const, channelId: ch.id }],
    };
    const library = libraryWithZones([ch], [zone]);
    const assembled = assemble(anytoneBuild(library), library);

    const { dmrZones, amZones } = partitionAnytoneZones(assembled);
    expect(dmrZones).toHaveLength(0);
    expect(amZones).toHaveLength(1);
    expect(amZones[0]!.memberChannelIds).toEqual([ch.id]);
  });

  it('splits mixed zones across DMR and AM projections', () => {
    const dmr = dmrChannel('DMR 1');
    const air = airbandChannel('Tower');
    const zone = {
      ...newZone(PROJECT_ID, 'Mixed Zone'),
      members: [
        { kind: 'channel' as const, channelId: dmr.id },
        { kind: 'channel' as const, channelId: air.id },
      ],
    };
    const library = libraryWithZones([dmr, air], [zone]);
    const assembled = assemble(anytoneBuild(library), library);

    const { dmrZones, amZones } = partitionAnytoneZones(assembled);
    expect(dmrZones).toHaveLength(1);
    expect(amZones).toHaveLength(1);
    expect(dmrZones[0]!.zoneId).toBe(amZones[0]!.zoneId);
    expect(dmrZones[0]!.memberChannelIds).toEqual([dmr.id]);
    expect(amZones[0]!.memberChannelIds).toEqual([air.id]);
  });
});
