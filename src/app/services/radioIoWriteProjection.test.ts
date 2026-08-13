import { describe, expect, it } from 'vitest';
import {
  newChannel,
  newDigitalContact,
  newFormatBuild,
  newRadioBuildForProfile,
  newRxGroupList,
  newTalkGroup,
  newZone,
} from '@core/domain/factories.ts';
import { seedZoneGroupingFromLibrary } from '@core/domain/zoneGroupingLayout.ts';
import { withExportEligibleDefaults } from '@core/domain/channelTestHelpers.ts';
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
    const ch = withExportEligibleDefaults({
      ...newChannel('p1', 'A'),
      id: 'ch-a',
      rxFrequency: 145_000_000,
      txFrequency: 145_000_000,
    });
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
    const ch = withExportEligibleDefaults({
      ...newChannel('p1', 'A'),
      id: 'ch-a',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
    });
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
      expect.objectContaining({ index: 1, digitalId: 91, callType: 0, timeSlotOverride: 1 }),
    ]);
    expect(projection.organisation.zones).toEqual([
      expect.objectContaining({ wireName: 'Local', channelNumbers: [1] }),
    ]);
  });

  it('maps channels, zones, and contacts for radio-io-opengd77-md9600', () => {
    const ch = withExportEligibleDefaults({
      ...newChannel('p1', 'A'),
      id: 'ch-a',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      power: 63,
    });
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
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-opengd77-md9600');
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress);
    expect(projection.channels.length).toBeGreaterThanOrEqual(1);
    expect(projection.channels[0]?.powerPercent).toBe(63);
    expect(projection.organisation.zones).toEqual([
      expect.objectContaining({ wireName: 'Local', channelNumbers: [1] }),
    ]);
  });

  it('stamps OpenGD77 skipScan and skipZoneScan from effective scan inclusion', () => {
    const skipLib = withExportEligibleDefaults({
      ...newChannel('p1', 'Skip'),
      id: 'ch-skip',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      scanInclusion: 'skip' as const,
    });
    const scanLib = withExportEligibleDefaults({
      ...newChannel('p1', 'Scan'),
      id: 'ch-scan',
      rxFrequency: 145_600_000,
      txFrequency: 145_600_000,
      scanInclusion: 'alwaysScan' as const,
    });
    const library = emptyLibrary([skipLib, scanLib]);
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-opengd77-1701');
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress);
    const bySlot = new Map(projection.channels.map((c) => [c.slotIndex, c]));
    const skipSlot = projection.numbersBySourceChannelId.get('ch-skip')?.[0];
    const scanSlot = projection.numbersBySourceChannelId.get('ch-scan')?.[0];
    const skipDto = bySlot.get(skipSlot!);
    const scanDto = bySlot.get(scanSlot!);
    expect(skipDto?.skipScan).toBe(true);
    expect(skipDto?.skipZoneScan).toBe(true);
    expect(scanDto?.skipScan).toBe(false);
    expect(scanDto?.skipZoneScan).toBe(false);
  });

  it('stamps OpenGD77 default scan inclusion as scan when build omits export default', () => {
    const defaultLib = withExportEligibleDefaults({
      ...newChannel('p1', 'DefaultScan'),
      id: 'ch-default',
      rxFrequency: 145_700_000,
      txFrequency: 145_700_000,
      scanInclusion: 'default' as const,
    });
    const library = emptyLibrary([defaultLib]);
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-opengd77-1701');
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress);
    const slot = projection.numbersBySourceChannelId.get('ch-default')?.[0];
    const dto = projection.channels.find((c) => c.slotIndex === slot);
    expect(dto?.skipScan).toBe(false);
    expect(dto?.skipZoneScan).toBe(false);
  });

  it('stamps OpenGD77 skipScan from build scanInclusionOverride over library', () => {
    const lib = withExportEligibleDefaults({
      ...newChannel('p1', 'Override'),
      id: 'ch-override',
      rxFrequency: 145_800_000,
      txFrequency: 145_800_000,
      scanInclusion: 'skip' as const,
    });
    const library = emptyLibrary([lib]);
    const { build: baseBuild, egress } = newRadioBuildForProfile('p1', 'radio-io-opengd77-md9600');
    const build = {
      ...baseBuild,
      channelOverrides: [{ libraryEntityId: 'ch-override', scanInclusion: 'alwaysScan' as const }],
    };
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress);
    const slot = projection.numbersBySourceChannelId.get('ch-override')?.[0];
    const dto = projection.channels.find((c) => c.slotIndex === slot);
    expect(dto?.skipScan).toBe(false);
    expect(dto?.skipZoneScan).toBe(false);
  });

  it('fans out dual-mode zone members to both expanded serial slots', () => {
    const dual = withExportEligibleDefaults({
      ...newChannel('p1', 'DualMode'),
      id: 'ch-dual',
      rxFrequency: 430_850_000,
      txFrequency: 438_450_000,
      modeProfiles: [
        {
          mode: 'fm' as const,
          squelch: null,
          rxTone: 'none',
          txTone: 'none',
          bandwidthKHz: 12.5,
        },
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 1 as const,
          dmrId: 123,
          contactRef: null,
          rxGroupListId: null,
        },
      ],
    });
    const zone = {
      ...newZone('p1', 'Local'),
      id: 'zone-1',
      members: [{ kind: 'channel' as const, channelId: 'ch-dual' }],
    };
    const library = {
      ...emptyLibrary([dual]),
      zones: [zone],
    };
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-opengd77-md9600');
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress);
    expect(projection.channels).toHaveLength(2);
    const zoneDto = projection.organisation.zones?.[0];
    expect(zoneDto?.channelNumbers).toEqual([1, 2]);
  });

  it('prepends each zone’s own scan carrier; shared members do not get zone-derived scanListId', () => {
    const shared = withExportEligibleDefaults({
      ...newChannel('p1', 'Hotspot'),
      id: 'ch-shared',
      rxFrequency: 433_000_000,
      txFrequency: 433_000_000,
    });
    const onlyHome = withExportEligibleDefaults({
      ...newChannel('p1', 'HomeOnly'),
      id: 'ch-home',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
    });
    const onlyWalk = withExportEligibleDefaults({
      ...newChannel('p1', 'WalkOnly'),
      id: 'ch-walk',
      rxFrequency: 145_600_000,
      txFrequency: 145_600_000,
    });
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
    expect(bySlot.get(sharedNums[0]!)?.scanListId).toBeUndefined();

    const homeRec = encodeDm32ChannelRecord(bySlot.get(homeCarrier)!);
    const walkRec = encodeDm32ChannelRecord(bySlot.get(walkCarrier)!);
    expect((homeRec[0x19]! >> 2) & 0x0f).toBe(1);
    expect((walkRec[0x19]! >> 2) & 0x0f).toBe(2);
    expect(homeRec[0x19]! & 0x80).toBe(0x00); // NFM (narrow)
    expect(homeRec[0x19]! & 0x40).toBe(0x40); // scanAdd
  });

  it('stamps UV-5R Mini scanAdd from effective scan inclusion', () => {
    const skipLib = withExportEligibleDefaults({
      ...newChannel('p1', 'Skip'),
      id: 'ch-skip',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      scanInclusion: 'skip' as const,
    });
    const defaultLib = withExportEligibleDefaults({
      ...newChannel('p1', 'Default'),
      id: 'ch-default',
      rxFrequency: 145_600_000,
      txFrequency: 145_600_000,
      scanInclusion: 'default' as const,
    });
    const overrideLib = withExportEligibleDefaults({
      ...newChannel('p1', 'Override'),
      id: 'ch-override',
      rxFrequency: 145_700_000,
      txFrequency: 145_700_000,
      scanInclusion: 'default' as const,
    });
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
    const ch = withExportEligibleDefaults({
      ...newChannel('p1', 'ScanMe'),
      id: 'ch-scan',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      scanInclusion: 'default' as const,
    });
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

  it('stamps RT95 scanAdd from effective scan inclusion', () => {
    const ch = withExportEligibleDefaults({
      ...newChannel('p1', 'ScanMe'),
      id: 'ch-scan',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      scanInclusion: 'default' as const,
    });
    const library = emptyLibrary([ch]);
    const { build: baseBuild, egress } = newRadioBuildForProfile('p1', 'radio-io-rt95');
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
    const ch = withExportEligibleDefaults({
      ...newChannel('p1', 'A'),
      id: 'ch-a',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      scanInclusion: 'default' as const,
    });
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

  it('caps zone-derived scan lists at channel scanListId hardware limit', () => {
    const projectId = 'p1';
    const pairs = Array.from({ length: 20 }, (_, i) => {
      const ch = withExportEligibleDefaults({
        ...newChannel(projectId, `Ch${i}`),
        id: `ch-${i}`,
        rxFrequency: 145_500_000,
        txFrequency: 145_500_000,
      });
      const zone = {
        ...newZone(projectId, `Zone${String(i).padStart(2, '0')}`),
        id: `zone-${i}`,
        members: [{ kind: 'channel' as const, channelId: ch.id }],
      };
      return { ch, zone };
    });
    const channels = pairs.map((p) => p.ch);
    const zones = pairs.map((p) => p.zone);
    const build = newFormatBuild(projectId, 'radio-io-dm32uv', 'DM32');
    const layout = seedZoneGroupingFromLibrary({
      channels,
      zones,
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    });
    layout.zones = layout.zones.map((entry) => ({
      ...entry,
      exportScanList: true,
      scanCarrierFrequencyHz: 145_500_000,
    }));
    build.layout = { sections: [layout] };
    const library = {
      ...emptyLibrary(channels),
      zones,
    };
    const { egress } = newRadioBuildForProfile(projectId, 'radio-io-dm32uv');
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress);
    expect(projection.organisation.scanLists).toHaveLength(15);
    expect(
      projection.warnings.some((w) => w.includes('channel scanListId supports at most 15')),
    ).toBe(true);
  });

  it('warns and truncates RX group lists beyond DM-32UV cap', () => {
    const projectId = 'p1';
    const rxGroupLists = Array.from({ length: 40 }, (_, i) => ({
      ...newRxGroupList(projectId, `RX${i}`),
      id: `rx-${i}`,
    }));
    const library = {
      ...emptyLibrary([]),
      rxGroupLists,
    };
    const { build, egress } = newRadioBuildForProfile(projectId, 'radio-io-dm32uv');
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress);
    expect(projection.organisation.rxGroups).toHaveLength(32);
    expect(projection.warnings.some((w) => /40 RX group list/.test(w) && /32/.test(w))).toBe(true);
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
    const ch = withExportEligibleDefaults({
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
    });
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

  it('projects OpenGD77 talk-group timeslot clones and RX bank indices', () => {
    const projectId = 'p1';
    const tg = { ...newTalkGroup(projectId, 'Scotland', 2355), id: 'tg-scot' };
    const rxList = {
      ...newRxGroupList(projectId, 'Scotland'),
      id: 'rx-1',
      members: [
        { ref: { kind: 'talkGroup' as const, id: tg.id }, timeSlotOverride: 2 as const },
        { ref: { kind: 'talkGroup' as const, id: tg.id }, timeSlotOverride: 1 as const },
      ],
    };
    const ch = withExportEligibleDefaults({
      ...newChannel(projectId, 'Glasgow'),
      id: 'ch-1',
      rxFrequency: 430_125_000,
      txFrequency: 430_125_000,
      primaryMode: 'dmr',
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 1 as const,
          dmrId: null,
          contactRef: { kind: 'talkGroup' as const, id: tg.id },
          rxGroupListId: rxList.id,
        },
      ],
    });
    const zone = {
      ...newZone(projectId, 'Local'),
      id: 'zone-a',
      members: [{ kind: 'channel' as const, channelId: ch.id }],
    };
    const library = {
      ...emptyLibrary([ch]),
      zones: [zone],
      talkGroups: [tg],
      rxGroupLists: [rxList],
    };
    const { build, egress } = newRadioBuildForProfile(projectId, 'radio-io-opengd77-1701');
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress);
    expect(projection.organisation.talkGroups?.map((row) => row.timeSlotOverride).sort()).toEqual([
      1, 2,
    ]);
    expect(projection.organisation.rxGroups?.[0]?.memberDigitalIds).toEqual([2, 1]);
    expect(projection.channels[0]?.txContactId).toBe(1);
  });

  it('throws when export limits are missing for the egress profile', () => {
    const ch = withExportEligibleDefaults(newChannel('p1', 'A'));
    const library = emptyLibrary([ch]);
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-dm32uv');
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    expect(() =>
      buildRadioWriteProjection(assembled, build, library, {
        ...egress,
        formatId: 'dm32',
      }),
    ).toThrow(/Missing export limits/);
  });

  it('honours build exportSettings for talk-group abbreviation on Web Serial write', () => {
    const ch = withExportEligibleDefaults({
      ...newChannel('p1', 'A'),
      id: 'ch-a',
      rxFrequency: 145_000_000,
      txFrequency: 145_000_000,
      modeProfiles: [
        {
          mode: 'dmr',
          colourCode: 1,
          timeslot: 1,
          dmrId: 1234567,
          contactRef: { kind: 'talkGroup', id: 'tg-long' },
          rxGroupListId: null,
        },
      ],
    });
    const tg = {
      ...newTalkGroup('p1', 'Scotland West Region', 23559),
      id: 'tg-long',
      abbreviation: 'Scot West',
    };
    const library = {
      ...emptyLibrary([ch]),
      talkGroups: [tg],
    };
    const { build: baseBuild, egress } = newRadioBuildForProfile('p1', 'radio-io-dm32uv');
    const withAbbrev = {
      ...baseBuild,
      exportSettings: { shortenNames: true, useTalkGroupAbbreviation: true },
    };
    const withoutAbbrev = {
      ...baseBuild,
      exportSettings: { shortenNames: true, useTalkGroupAbbreviation: false },
    };
    const assembledWith = assemble(withAbbrev, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const assembledWithout = assemble(withoutAbbrev, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });

    const projWith = buildRadioWriteProjection(assembledWith, withAbbrev, library, egress);
    const projWithout = buildRadioWriteProjection(assembledWithout, withoutAbbrev, library, egress);

    expect(projWith.organisation.talkGroups?.[0]?.wireName).toBe('Scot West');
    expect(projWithout.organisation.talkGroups?.[0]?.wireName).not.toBe('Scot West');
    expect(projWithout.organisation.talkGroups?.[0]?.wireName.length).toBeLessThanOrEqual(16);
  });

  it('projects directory radio IDs for DM-32 digital ID list Write', () => {
    const ch = withExportEligibleDefaults({
      ...newChannel('p1', 'A'),
      id: 'ch-a',
      rxFrequency: 145_000_000,
      txFrequency: 145_000_000,
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 1 as const,
          dmrId: 999,
          contactRef: null,
          rxGroupListId: null,
        },
      ],
    });
    const library = emptyLibrary([ch]);
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-dm32uv');
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress, {
      dualBank: {
        mode: 'digitalIdList',
        options: { includeLibraryContacts: false, includeDigitalIdDirectory: true },
        directorySlice: {
          radioIds: [{ index: 0, dmrId: 4242, name: 'DirUser' }],
          digitalContacts: [],
        },
      },
    });
    expect(projection.organisation.radioIds).toEqual([{ index: 0, dmrId: 4242, name: 'DirUser' }]);
    expect(projection.organisation.digitalContacts).toBeUndefined();
    expect(projection.organisation.radioIds?.some((r) => r.dmrId === 999)).toBe(false);
  });

  it('omits DM-32 digitalContacts when library contacts are off so the address book is not wiped', () => {
    const dc = { ...newDigitalContact('p1', 'Alice', 1001, 'dmr'), id: 'dc-1' };
    const library = { ...emptyLibrary(), digitalContacts: [dc] };
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-dm32uv');
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress, {
      dualBank: {
        mode: 'codeplug',
        options: { includeLibraryContacts: false, includeDigitalIdDirectory: false },
      },
    });
    expect(projection.organisation.digitalContacts).toBeUndefined();
  });

  it('omits library digital contacts when dual-bank toggle is off', () => {
    const dc = { ...newDigitalContact('p1', 'Alice', 1001, 'dmr'), id: 'dc-1' };
    const library = { ...emptyLibrary(), digitalContacts: [dc] };
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-opengd77-1701');
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress, {
      dualBank: {
        mode: 'codeplug',
        options: { includeLibraryContacts: false, includeDigitalIdDirectory: true },
        directorySlice: {
          radioIds: [],
          digitalContacts: [
            {
              wireName: 'Dir',
              digitalId: 2002,
              callsign: 'D1',
              city: '',
              province: '',
              country: '',
              remark: '',
            },
          ],
        },
      },
    });
    expect(projection.organisation.digitalContacts).toEqual([
      expect.objectContaining({ digitalId: 2002, wireName: 'Dir' }),
    ]);
    expect(projection.organisation.digitalContacts?.some((c) => c.digitalId === 1001)).toBe(false);
  });

  it('uses digitalContactExportNameMode for OpenGD77 library contact wire names', () => {
    const contact = {
      ...newDigitalContact('p1', 'Ada Lovelace', 1234567),
      id: 'dc-1',
      callsign: 'M7ABC',
    };
    const library = {
      ...emptyLibrary(),
      digitalContacts: [contact],
    };
    const { build: base, egress } = newRadioBuildForProfile('p1', 'radio-io-opengd77-1701');
    const build = {
      ...base,
      exportUnlinkedDigitalContacts: true,
      exportSettings: { digitalContactExportNameMode: 'callsign' as const },
    };
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress);
    expect(projection.organisation.digitalContacts).toEqual([
      expect.objectContaining({ digitalId: 1234567, wireName: 'M7ABC' }),
    ]);
  });
});
