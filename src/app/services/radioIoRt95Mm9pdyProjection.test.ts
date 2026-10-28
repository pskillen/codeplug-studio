import { describe, expect, it } from 'vitest';
import { withExportEligibleDefaults } from '@core/domain/channelTestHelpers.ts';
import { newChannel, newRadioBuildForProfile, newZone } from '@core/domain/factories.ts';
import { upsertOverride } from '@core/domain/formatBuildOverrides.ts';
import { seedZoneGroupingFromLibrary } from '@core/domain/zoneGroupingLayout.ts';
import { formatExportWarning, type ExportWarning } from '@core/import-export/exportWarning.ts';
import type { Channel, Zone } from '@core/models/library.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { assemble } from '@core/services/assemble.ts';
import { buildRadioWriteProjection } from './radioIoWriteProjection.ts';
import { projectRt95Mm9pdy } from './radioIoRt95Mm9pdyProjection.ts';

const MM = 'radio-io-rt95-mm9pdy';

function ch(id: string, name: string, mhz: number, callsign = ''): Channel {
  return withExportEligibleDefaults({
    ...newChannel('p1', name, callsign),
    id,
    rxFrequency: mhz * 1_000_000,
    txFrequency: mhz * 1_000_000,
  });
}

function zone(id: string, name: string, channelIds: string[]): Zone {
  return {
    ...newZone('p1', name),
    id,
    members: channelIds.map((channelId) => ({ kind: 'channel' as const, channelId })),
  };
}

function lib(channels: Channel[], zones: Zone[]): LibrarySlice {
  return {
    channels,
    zones,
    scanLists: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    aprsConfiguration: null,
  };
}

function project(
  profileId: string,
  library: LibrarySlice,
  tweak?: (b: ReturnType<typeof newRadioBuildForProfile>['build']) => void,
) {
  const { build, egress } = newRadioBuildForProfile('p1', profileId);
  if (profileId === MM) build.layout = { sections: [seedZoneGroupingFromLibrary(library)] };
  tweak?.(build);
  const assembled = assemble(build, library, {
    formatId: egress.formatId,
    profileId: egress.profileId,
  });
  const projection = buildRadioWriteProjection(assembled, build, library, egress);
  return { projection, texts: projection.warnings.map(formatExportWarning), build };
}

describe('RT95 MM9PDY projection', () => {
  it('numbers channels in zone order and flattens a channel in two zones to one number', () => {
    const a = ch('a', 'Alpha', 145.5);
    const b = ch('b', 'Bravo', 145.6);
    const c = ch('c', 'Charlie', 145.7);
    const library = lib(
      [a, b, c],
      [zone('z1', 'First', ['c', 'a']), zone('z2', 'Second', ['a', 'b'])],
    );
    const { projection } = project(MM, library);
    expect(projection.numbersBySourceChannelId.get('c')).toEqual([1]);
    expect(projection.numbersBySourceChannelId.get('a')).toEqual([2]);
    expect(projection.numbersBySourceChannelId.get('b')).toEqual([3]);
    expect(projection.organisation.writeRt95ModData).toBe(true);
    expect(projection.organisation.zones).toEqual([
      { wireName: 'First', channelNumbers: [1, 2] },
      { wireName: 'Second', channelNumbers: [2, 3] },
    ]);
  });

  it('keeps a pinned channel in its slot', () => {
    const a = ch('a', 'Alpha', 145.5);
    const b = ch('b', 'Bravo', 145.6);
    const library = lib([a, b], [zone('z1', 'First', ['a', 'b'])]);
    const { projection } = project(MM, library, (build) => {
      build.channelOverrides = upsertOverride(build.channelOverrides, 'b', { orderOrSlot: 5 });
    });
    expect(projection.numbersBySourceChannelId.get('b')).toEqual([5]);
  });

  it('writes the Callsign as the radio name and the Name as the description', () => {
    const a = ch('a', 'Calling ch', 145.5, 'TEST01');
    const library = lib([a], [zone('z1', 'Local', ['a'])]);
    const { projection } = project(MM, library);
    expect(projection.channels[0]).toMatchObject({ wireName: 'TEST01', description: 'Calling ch' });
  });

  it('leaves the description empty when it equals the radio name, and honours the override', () => {
    const a = ch('a', 'TEST01', 145.5);
    const b = ch('b', 'Bravo', 145.6);
    const library = lib([a, b], [zone('z1', 'Local', ['a', 'b'])]);
    const { projection } = project(MM, library, (build) => {
      build.channelOverrides = upsertOverride(build.channelOverrides, 'b', {
        wireDescription: 'Fixed text',
      });
    });
    expect(projection.channels[0]?.description).toBeUndefined();
    expect(projection.channels[1]?.description).toBe('Fixed text');
  });

  it('warns for 33 zones and writes 32', () => {
    const channels = Array.from({ length: 33 }, (_, i) => ch(`c${i}`, `C${i}`, 145 + i / 100));
    const zones = channels.map((c, i) => zone(`z${i}`, `Z${i}`, [c.id]));
    const { projection, texts } = project(MM, lib(channels, zones));
    expect(projection.organisation.zones).toHaveLength(32);
    expect(texts.some((t) => t.includes('1 zones were not written'))).toBe(true);
  });

  it('drops a zone with no channels on the radio and warns', () => {
    const warnings: ExportWarning[] = [];
    const a = ch('a', 'Alpha', 145.5);
    const library = lib([a], []);
    const { build, egress } = newRadioBuildForProfile('p1', MM);
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const out = projectRt95Mm9pdy({
      channels: [],
      zones: [
        { wireName: 'Local', channelNumbers: [1] },
        { wireName: 'Empty', channelNumbers: [] },
      ],
      assembled,
      build,
      library,
      numbersBySourceChannelId: new Map(),
      maxZones: 32,
      warnings,
    });
    expect(out.zones.map((z) => z.wireName)).toEqual(['Local']);
    expect(warnings.map(formatExportWarning).some((t) => t.includes('"Empty"'))).toBe(true);
  });

  it('notes channel-number order for a zone whose members are not ascending, and unzoned channels', () => {
    const a = ch('a', 'Alpha', 145.5);
    const b = ch('b', 'Bravo', 145.6);
    const c = ch('c', 'Charlie', 145.7);
    const library = lib(
      [a, b, c],
      [zone('z1', 'First', ['a', 'b']), zone('z2', 'Second', ['b', 'a'])],
    );
    const { projection, texts } = project(MM, library);
    expect(projection.organisation.zones?.[1]?.channelNumbers).toEqual([1, 2]);
    expect(texts.some((t) => t.includes('Second') && t.includes('channel-number order'))).toBe(
      true,
    );
    expect(texts.some((t) => t.includes('1 channels are only in All channels'))).toBe(true);
  });

  it('warns once that per-zone scan choices are ignored', () => {
    const a = ch('a', 'Alpha', 145.5);
    const b = ch('b', 'Bravo', 145.6);
    const z = zone('z1', 'Local', ['a', 'b']);
    z.members = [
      { kind: 'channel', channelId: 'a', includeInScanList: 'skip' },
      { kind: 'channel', channelId: 'b', includeInScanList: 'include' },
    ];
    const { texts } = project(MM, lib([a, b], [z]));
    expect(texts.filter((t) => t.includes('per-zone scan choices')).length).toBe(1);
  });

  it('warns about a space in a radio name', () => {
    const a = ch('a', 'Alpha', 145.5, 'GB3 GL');
    const { texts } = project(MM, lib([a], [zone('z1', 'Local', ['a'])]));
    expect(texts.some((t) => t.includes('zero width'))).toBe(true);
  });

  it('replaces characters the radio cannot show and warns', () => {
    const a = ch('a', 'Rock_Ch', 145.5, 'T1');
    const { projection, texts } = project(MM, lib([a], [zone('z1', 'Local', ['a'])]));
    expect(projection.channels[0]?.description).toBe('Rock-Ch');
    expect(texts.some((t) => t.includes('replaced with "-"'))).toBe(true);
  });

  it('leaves the stock RT95 projection without mod data, zones or descriptions', () => {
    const a = ch('a', 'Calling ch', 145.5, 'TEST01');
    const library = lib([a], [zone('z1', 'Local', ['a'])]);
    const { projection } = project('radio-io-rt95', library);
    expect(projection.organisation).toEqual({});
    expect(projection.organisation.writeRt95ModData).toBeUndefined();
    expect(projection.channels[0]?.description).toBeUndefined();
    expect(projection.channels[0]?.wireName).not.toBe('TEST01');
  });
});
