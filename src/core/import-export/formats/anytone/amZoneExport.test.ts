import { describe, expect, it } from 'vitest';
import { newChannel, newFormatBuild, newZone } from '@core/domain/factories.ts';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import { exportBuildAll } from '@core/services/exportBuild.ts';
import { assemble } from '@core/services/assemble.ts';
import type { Channel, Zone } from '@core/models/library.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import { AM_ZONE_HEADERS } from './columns.ts';
import { resolveAnytoneExportFileNames, serialiseAmZonesCsv } from './serialise.ts';

const PROJECT_ID = 'proj-amzone-export';

function dmrChannel(name: string) {
  return {
    ...newChannel(PROJECT_ID, name),
    rxFrequency: 430_000_000,
    txFrequency: 430_000_000,
    modeProfiles: [defaultModeProfile('dmr')],
  };
}

function airbandChannel(name: string): Channel {
  return {
    ...newChannel(PROJECT_ID, name),
    rxFrequency: 118_800_000,
    txFrequency: null,
    forbidTransmit: 'forbid',
    modeProfiles: [defaultModeProfile('am')],
  };
}

function libraryWithZones(channels: Channel[], zones: Zone[]): LibrarySlice {
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
    ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv', 'AM zone export'),
    layout: { sections: [] },
    channelOverrides: library.channels.map((ch) => ({
      libraryEntityId: ch.id,
      wireName: ch.name,
    })),
    zoneOverrides: library.zones.map((z) => ({
      libraryEntityId: z.id,
      wireName: z.name,
    })),
  };
}

function csvBodyRows(csv: string): string[] {
  return csv.trim().split(/\r?\n/).slice(1);
}

describe('anytone AMZone export', () => {
  it('omits AMZone.CSV when no airband zone members', () => {
    const ch = dmrChannel('DMR 1');
    const zone = {
      ...newZone(PROJECT_ID, 'DMR Zone'),
      members: [{ kind: 'channel' as const, channelId: ch.id }],
    };
    const library = libraryWithZones([ch], [zone]);
    const build = anytoneBuild(library);
    const assembled = assemble(build, library);

    expect(resolveAnytoneExportFileNames(assembled)).not.toContain('AMZone.CSV');
    const result = exportBuildAll({ build, library });
    expect(result.files['AMZone.CSV']).toBeUndefined();
  });

  it('emits AMZone.CSV for airband-only zones and omits them from DMRZone', () => {
    const air = airbandChannel('Tower');
    const zone = {
      ...newZone(PROJECT_ID, 'AM Zone'),
      members: [{ kind: 'channel' as const, channelId: air.id }],
    };
    const library = libraryWithZones([air], [zone]);
    const build = anytoneBuild(library);
    const assembled = assemble(build, library);

    expect(resolveAnytoneExportFileNames(assembled)).toContain('AMZone.CSV');
    const result = exportBuildAll({ build, library });
    expect(result.files['AMZone.CSV']).toBeDefined();
    expect(csvBodyRows(result.files['DMRZone.CSV']!)).toHaveLength(0);
    expect(result.files['AMZone.CSV']!).toContain('Tower');
    expect(result.files['AMZone.CSV']!).toContain('AM Zone');
  });

  it('splits mixed zones across DMRZone and AMZone without airband in DMR', () => {
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
    const build = anytoneBuild(library);
    const result = exportBuildAll({ build, library });

    const dmrZoneCsv = result.files['DMRZone.CSV']!;
    const amZoneCsv = result.files['AMZone.CSV']!;
    expect(dmrZoneCsv).toContain('DMR 1');
    expect(dmrZoneCsv).not.toContain('Tower');
    expect(amZoneCsv).toContain('Tower');
    expect(amZoneCsv).not.toContain('DMR 1');
    expect(amZoneCsv).toContain('Mixed Zone');
  });

  it('serialises AMZone with confirmed 5-column headers', () => {
    const air = airbandChannel('Tower');
    const zone = {
      ...newZone(PROJECT_ID, 'AM Zone'),
      members: [{ kind: 'channel' as const, channelId: air.id }],
    };
    const library = libraryWithZones([air], [zone]);
    const assembled = assemble(anytoneBuild(library), library);
    const csv = serialiseAmZonesCsv(assembled);
    const header = csv.split(/\r?\n/)[0]!;
    for (const col of AM_ZONE_HEADERS) {
      expect(header).toContain(`"${col}"`);
    }
    expect(csv).toContain('"AM Zone","Tower","Tower","Tower"');
  });
});
