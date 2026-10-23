/**
 * MM9PDY channel location table projection (#1383): flag, unit and slot-aligned positions
 * on the MM9PDY targets only; stock targets get neither.
 */
import { describe, expect, it } from 'vitest';
import { formatExportWarning } from '@core/import-export/exportWarning.ts';
import { newChannel, newRadioBuildForProfile, newZone } from '@core/domain/factories.ts';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import { assemble, type LibrarySlice } from '@core/services/assemble.ts';
import type { Channel } from '@core/models/library.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import { buildRadioWriteProjection } from './radioIoWriteProjection.ts';

const GLASGOW = { lat: 55.852056, lon: -4.259463 };
const EDINBURGH = { lat: 55.9533, lon: -3.1883 };

function fm(id: string, name: string, rxHz: number, over: Partial<Channel> = {}): Channel {
  return {
    ...newChannel('p1', name),
    id,
    rxFrequency: rxHz,
    txFrequency: rxHz,
    power: 100,
    modeProfiles: [
      { mode: 'fm' as const, squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 12.5 },
    ],
    ...over,
  };
}

function library(channels: Channel[], zones: LibrarySlice['zones'] = []): LibrarySlice {
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

function project(profileId: string, lib: LibrarySlice, patch?: (b: RadioBuild) => RadioBuild) {
  const created = newRadioBuildForProfile('p1', profileId);
  const build = patch ? patch(created.build) : created.build;
  const assembled = assemble(build, lib, {
    formatId: created.egress.formatId,
    profileId: created.egress.profileId,
  });
  return buildRadioWriteProjection(assembled, build, lib, created.egress);
}

const channels = (): Channel[] => [
  fm('ch-a', 'Alpha', 145_600_000, { location: GLASGOW, useLocation: true }),
  fm('ch-b', 'Bravo', 145_650_000, { location: EDINBURGH, useLocation: false }),
  fm('ch-c', 'Charlie', 145_700_000),
  fm('ch-d', 'Delta', 433_100_000, { location: EDINBURGH, useLocation: true }),
];

describe.each([
  ['radio-io-at-d890uv-mm9pdy', 'radio-io-at-d890uv'],
  ['radio-io-dm32uv-mm9pdy', 'radio-io-dm32uv'],
])('channel location projection: %s vs %s', (mm9pdyProfile, stockProfile) => {
  it('sets the flag, the km default and slot-aligned positions on MM9PDY', () => {
    const projection = project(mm9pdyProfile, library(channels()));
    expect(projection.organisation.writeChannelLocationTable).toBe(true);
    expect(projection.organisation.channelDistanceUnit).toBe('km');
    const byName = new Map(projection.channels.map((ch) => [ch.wireName, ch]));
    expect(byName.get('Alpha')).toMatchObject({ useLocation: true, location: GLASGOW });
    expect(byName.get('Delta')).toMatchObject({ useLocation: true, location: EDINBURGH });
    expect(byName.get('Bravo')?.location).toBeUndefined();
    expect(byName.get('Charlie')?.location).toBeUndefined();
    for (const [id, slots] of projection.numbersBySourceChannelId) {
      for (const slot of slots) {
        const dto = projection.channels.find((ch) => ch.slotIndex === slot)!;
        const source = channels().find((c) => c.id === id)!;
        if (dto.location) expect(dto.location).toEqual(source.location);
      }
    }
    expect(projection.channelLocations?.counts).toEqual({
      written: 2,
      noPosition: 1,
      useLocationOff: 1,
      overCapacity: 0,
    });
    const info = projection.warnings.filter((w) => w.kind === 'general' && w.severity === 'info');
    expect(info.map(formatExportWarning)).toEqual([
      'Channel positions: 2 written; 1 with Use location off not written. 1 channel has no position.',
    ]);
  });

  it('keeps positions on the right slot after a reorder', () => {
    const projection = project(mm9pdyProfile, library(channels()), (build) => ({
      ...build,
      channelOverrides: [
        { libraryEntityId: 'ch-d', orderOrSlot: 1 },
        { libraryEntityId: 'ch-a', orderOrSlot: 2 },
        { libraryEntityId: 'ch-b', orderOrSlot: 3 },
        { libraryEntityId: 'ch-c', orderOrSlot: 4 },
      ],
    }));
    const aSlot = projection.numbersBySourceChannelId.get('ch-a')![0]!;
    const dSlot = projection.numbersBySourceChannelId.get('ch-d')![0]!;
    expect(projection.channels.find((c) => c.slotIndex === aSlot)?.location).toEqual(GLASGOW);
    expect(projection.channels.find((c) => c.slotIndex === dSlot)?.location).toEqual(EDINBURGH);
  });

  it('writes the miles unit from the build setting', () => {
    const projection = project(mm9pdyProfile, library(channels()), (build) => ({
      ...build,
      exportSettings: { ...build.exportSettings, channelDistanceUnit: 'mi' },
    }));
    expect(projection.organisation.channelDistanceUnit).toBe('mi');
  });

  it('gives a stock target neither the flag nor positions, only the MM9PDY note', () => {
    const projection = project(stockProfile, library(channels()));
    expect(projection.organisation.writeChannelLocationTable).toBeUndefined();
    expect(projection.organisation.channelDistanceUnit).toBeUndefined();
    expect(projection.channels.every((ch) => ch.location === undefined)).toBe(true);
    expect(projection.channels.every((ch) => ch.useLocation === undefined)).toBe(true);
    const info = projection.warnings.filter((w) => w.kind === 'general' && w.severity === 'info');
    expect(info.map(formatExportWarning)).toEqual([
      '2 channels in this build have a position. Positions are not written by this target: the MM9PDY modded firmware target writes them.',
    ]);
  });

  it('pushes no note when no channel has a position', () => {
    const plain = [fm('ch-1', 'One', 145_600_000)];
    for (const profile of [mm9pdyProfile, stockProfile]) {
      const projection = project(profile, library(plain));
      expect(
        projection.warnings.filter((w) => w.severity === 'info' && w.kind === 'general'),
      ).toEqual([]);
    }
  });
});

describe('AT-D890UV AM airband split', () => {
  it('keeps positions aligned to MR slots when airband channels leave the bank', () => {
    const vhf = fm('ch-vhf', 'VHF', 145_500_000, { location: GLASGOW, useLocation: true });
    const airband: Channel = {
      ...newChannel('p1', 'Tower'),
      id: 'ch-air',
      rxFrequency: 118_800_000,
      txFrequency: null,
      forbidTransmit: 'forbid',
      location: EDINBURGH,
      useLocation: true,
      modeProfiles: [defaultModeProfile('am')],
    };
    const uhf = fm('ch-uhf', 'UHF', 433_100_000, { location: EDINBURGH, useLocation: true });
    const zone = {
      ...newZone('p1', 'Mixed'),
      id: 'zone-mixed',
      members: [
        { kind: 'channel' as const, channelId: airband.id },
        { kind: 'channel' as const, channelId: vhf.id },
        { kind: 'channel' as const, channelId: uhf.id },
      ],
    };
    const projection = project(
      'radio-io-at-d890uv-mm9pdy',
      library([airband, vhf, uhf], [zone]),
      (b) => ({
        ...b,
        layout: {
          sections: [
            {
              kind: 'zoneGrouping' as const,
              zones: [{ id: zone.id, name: 'Mixed', channelIds: [airband.id, vhf.id, uhf.id] }],
            },
          ],
        },
      }),
    );
    expect(projection.numbersBySourceChannelId.has('ch-air')).toBe(false);
    const vhfSlot = projection.numbersBySourceChannelId.get('ch-vhf')![0]!;
    const uhfSlot = projection.numbersBySourceChannelId.get('ch-uhf')![0]!;
    expect(projection.channels.find((c) => c.slotIndex === vhfSlot)?.location).toEqual(GLASGOW);
    expect(projection.channels.find((c) => c.slotIndex === uhfSlot)?.location).toEqual(EDINBURGH);
    expect(projection.channelLocations?.counts?.written).toBe(2);
  });
});
