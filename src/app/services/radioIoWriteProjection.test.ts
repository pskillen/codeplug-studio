import { describe, expect, it } from 'vitest';
import {
  newChannel,
  newDigitalContact,
  newRadioBuildForProfile,
  newRxGroupList,
  newTalkGroup,
  newZone,
} from '@core/domain/factories.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { assemble } from '@core/services/assemble.ts';
import { encodeDm32ChannelRecord } from '@integrations/radio-io/radios/dm32uv/channelCodec.ts';
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

function uv5rFlatMemoryBuild(
  baseBuild: ReturnType<typeof newRadioBuildForProfile>['build'],
  channelIds: string[],
) {
  return {
    ...baseBuild,
    layout: {
      sections: [{ kind: 'flatMemory' as const, channelIds, scanFlags: {} }],
    },
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

  it('prepends each zone’s own scan carrier and first-wins scanListId for shared members', () => {
    const shared = {
      ...newChannel('p1', 'Hotspot'),
      id: 'ch-shared',
      rxFrequency: 433_000_000,
      txFrequency: 433_000_000,
    };
    const onlyHome = {
      ...newChannel('p1', 'HomeOnly'),
      id: 'ch-home',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
    };
    const onlyWalk = {
      ...newChannel('p1', 'WalkOnly'),
      id: 'ch-walk',
      rxFrequency: 145_600_000,
      txFrequency: 145_600_000,
    };
    const homeZone = {
      ...newZone('p1', 'Home Shack'),
      id: 'zone-home',
      members: [
        { kind: 'channel' as const, channelId: 'ch-home' },
        { kind: 'channel' as const, channelId: 'ch-shared' },
      ],
    };
    const walkZone = {
      ...newZone('p1', 'Morning Walk'),
      id: 'zone-walk',
      members: [
        { kind: 'channel' as const, channelId: 'ch-walk' },
        { kind: 'channel' as const, channelId: 'ch-shared' },
      ],
    };
    const library = {
      ...emptyLibrary([shared, onlyHome, onlyWalk]),
      zones: [homeZone, walkZone],
    };
    const { build: baseBuild, egress } = newRadioBuildForProfile('p1', 'radio-io-dm32uv');
    const build = {
      ...baseBuild,
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [
              {
                id: 'zone-home',
                name: 'Home Shack',
                channelIds: ['ch-home', 'ch-shared'],
                exportScanList: true,
              },
              {
                id: 'zone-walk',
                name: 'Morning Walk',
                channelIds: ['ch-walk', 'ch-shared'],
                exportScanList: true,
              },
            ],
          },
        ],
      },
    };
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress);
    const zones = projection.organisation.zones ?? [];
    const home = zones.find((z) => z.wireName.startsWith('Home'));
    const walk = zones.find((z) => z.wireName.startsWith('Morning'));
    expect(home).toBeTruthy();
    expect(walk).toBeTruthy();

    const bySlot = new Map(projection.channels.map((c) => [c.slotIndex, c]));
    const homeCarrier = home!.channelNumbers[0]!;
    const walkCarrier = walk!.channelNumbers[0]!;
    expect(bySlot.get(homeCarrier)?.wireName).toMatch(/Home.*Scan/i);
    expect(bySlot.get(walkCarrier)?.wireName).toMatch(/Morn.*Scan|Walk.*Scan/i);
    expect(bySlot.get(homeCarrier)?.bandwidth).toBe('NFM');
    expect(bySlot.get(walkCarrier)?.bandwidth).toBe('NFM');
    expect(homeCarrier).not.toBe(walkCarrier);
    expect(walk!.channelNumbers[0]).not.toBe(homeCarrier);

    expect(bySlot.get(homeCarrier)?.scanListId).toBe(1);
    expect(bySlot.get(walkCarrier)?.scanListId).toBe(2);

    const sharedNums = projection.numbersBySourceChannelId.get('ch-shared') ?? [];
    expect(sharedNums.length).toBeGreaterThan(0);
    // First zone (Home) wins scanListId for the shared hotspot — not Morning Walk’s list.
    expect(bySlot.get(sharedNums[0]!)?.scanListId).toBe(1);

    const homeRec = encodeDm32ChannelRecord(bySlot.get(homeCarrier)!);
    const walkRec = encodeDm32ChannelRecord(bySlot.get(walkCarrier)!);
    expect((homeRec[0x19]! >> 2) & 0x0f).toBe(1);
    expect((walkRec[0x19]! >> 2) & 0x0f).toBe(2);
    expect(homeRec[0x19]! & 0x80).toBe(0x00); // NFM (narrow)
    expect(homeRec[0x19]! & 0x40).toBe(0x40); // scanAdd
  });

  it('stamps UV-5R Mini scanAdd from effective scan inclusion', () => {
    const skipLib = {
      ...newChannel('p1', 'Skip'),
      id: 'ch-skip',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      scanInclusion: 'skip' as const,
    };
    const defaultLib = {
      ...newChannel('p1', 'Default'),
      id: 'ch-default',
      rxFrequency: 145_600_000,
      txFrequency: 145_600_000,
      scanInclusion: 'default' as const,
    };
    const overrideLib = {
      ...newChannel('p1', 'Override'),
      id: 'ch-override',
      rxFrequency: 145_700_000,
      txFrequency: 145_700_000,
      scanInclusion: 'default' as const,
    };
    const library = emptyLibrary([skipLib, defaultLib, overrideLib]);
    const { build: baseBuild, egress } = newRadioBuildForProfile('p1', 'radio-io-uv5r-mini');
    const build = uv5rFlatMemoryBuild(baseBuild, ['ch-skip', 'ch-default', 'ch-override']);
    const buildWithScan = {
      ...build,
      exportSettings: { defaultScanInclusion: 'scan' as const },
      channelOverrides: [{ libraryEntityId: 'ch-override', scanInclusion: 'alwaysScan' as const }],
    };
    const assembled = assemble(buildWithScan, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, buildWithScan, library, egress);
    const bySlot = new Map(projection.channels.map((c) => [c.slotIndex, c]));
    const skipSlot = projection.numbersBySourceChannelId.get('ch-skip')?.[0];
    const defaultSlot = projection.numbersBySourceChannelId.get('ch-default')?.[0];
    const overrideSlot = projection.numbersBySourceChannelId.get('ch-override')?.[0];
    expect(bySlot.get(skipSlot!)?.scanAdd).toBe(false);
    expect(bySlot.get(defaultSlot!)?.scanAdd).toBe(true);
    expect(bySlot.get(overrideSlot!)?.scanAdd).toBe(true);
  });

  it('stamps UV-21Pro V2 scanAdd from effective scan inclusion', () => {
    const ch = {
      ...newChannel('p1', 'ScanMe'),
      id: 'ch-scan',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      scanInclusion: 'default' as const,
    };
    const library = emptyLibrary([ch]);
    const { build: baseBuild, egress } = newRadioBuildForProfile('p1', 'radio-io-uv21');
    const build = {
      ...uv5rFlatMemoryBuild(baseBuild, ['ch-scan']),
      exportSettings: { defaultScanInclusion: 'scan' as const },
    };
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress);
    expect(projection.channels[0]?.scanAdd).toBe(true);
  });

  it('uses radio-io default skip when build omits defaultScanInclusion', () => {
    const ch = {
      ...newChannel('p1', 'A'),
      id: 'ch-a',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      scanInclusion: 'default' as const,
    };
    const library = emptyLibrary([ch]);
    const { build: baseBuild, egress } = newRadioBuildForProfile('p1', 'radio-io-uv5r-mini');
    const build = uv5rFlatMemoryBuild(baseBuild, ['ch-a']);
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress);
    expect(projection.channels[0]?.scanAdd).toBe(false);
  });

  it('warns and truncates talk groups beyond DM-32UV quick-contact cap', () => {
    const projectId = 'p1';
    const talkGroups = Array.from({ length: 801 }, (_, i) =>
      newTalkGroup(projectId, `TG${i}`, 1000 + i),
    );
    const library = {
      ...emptyLibrary([]),
      talkGroups,
    };
    const { build, egress } = newRadioBuildForProfile(projectId, 'radio-io-dm32uv');
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress);
    expect(projection.organisation.talkGroups).toHaveLength(800);
    expect(projection.organisation.talkGroups?.every((tg) => tg.callType === 0x04)).toBe(true);
    expect(projection.warnings.some((w) => /801 talk group/.test(w) && /800/.test(w))).toBe(true);
  });

  it('warns and truncates digital contacts beyond DM-32UV address-book cap', () => {
    const projectId = 'p1';
    const digitalContacts = Array.from({ length: 251 }, (_, i) =>
      newDigitalContact(projectId, `DC${i}`, 2000 + i),
    );
    const library = {
      ...emptyLibrary([]),
      digitalContacts,
    };
    const { build, egress } = newRadioBuildForProfile(projectId, 'radio-io-dm32uv');
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress);
    expect(projection.organisation.digitalContacts).toHaveLength(250);
    expect(projection.warnings.some((w) => /251 digital contact/.test(w) && /250/.test(w))).toBe(
      true,
    );
  });

  it('projects operator radio IDs and channel bank indices from ModeProfile.dmrId', () => {
    const projectId = 'p1';
    const ch = {
      ...newChannel(projectId, 'Repeater'),
      id: 'ch-dmr',
      callsign: 'MM9PDY',
      rxFrequency: 439_000_000,
      txFrequency: 430_000_000,
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 1 as const,
          dmrId: 2_351_123,
          contactRef: null,
          rxGroupListId: null,
        },
      ],
    };
    const library = emptyLibrary([ch]);
    const { build, egress } = newRadioBuildForProfile(projectId, 'radio-io-dm32uv');
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress);
    expect(projection.organisation.radioIds).toEqual([
      { index: 0, dmrId: 2_351_123, name: 'MM9PDY' },
    ]);
    expect(projection.channels[0]?.dmrRadioIdIndex).toBe(0);
    const encoded = encodeDm32ChannelRecord(projection.channels[0]!);
    expect(encoded[0x2b]).toBe(0);
  });

  it('projects DM-32 RX group members as DMR IDs', () => {
    const projectId = 'p1';
    const tgA = { ...newTalkGroup(projectId, 'Local', 91), id: 'tg-a' };
    const tgB = { ...newTalkGroup(projectId, 'Brand', 9), id: 'tg-b' };
    const rxList = {
      ...newRxGroupList(projectId, 'Local RGL'),
      id: 'rx-1',
      members: [
        { ref: { kind: 'talkGroup' as const, id: tgA.id } },
        { ref: { kind: 'talkGroup' as const, id: tgB.id } },
      ],
    };
    const library = {
      ...emptyLibrary([]),
      talkGroups: [tgA, tgB],
      rxGroupLists: [rxList],
    };
    const { build, egress } = newRadioBuildForProfile(projectId, 'radio-io-dm32uv');
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress);
    expect(projection.organisation.rxGroups?.[0]?.memberDigitalIds).toEqual([91, 9]);
  });
});
