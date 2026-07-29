import { describe, expect, it, vi } from 'vitest';
import {
  newChannel,
  newRadioBuildForProfile,
  newRxGroupList,
  newTalkGroup,
  newZone,
} from '@core/domain/factories.ts';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import {
  extractAtD890uvHydrationFromProtocol,
  mergeChannelsIntoAtD890uvHydration,
} from '@integrations/radio-io/radios/at-d890uv/hydration.ts';
import type { AtD890DownloadCache } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import { createMemoryMap } from '@integrations/radio-io/kit/memoryMap.ts';
import type {
  CloneImageRadio,
  MemoryMap,
  RadioDescriptor,
  RadioSession,
} from '@integrations/radio-io/types.ts';
import { RadioWriteBlockedError, writeBuildToRadio } from './radioIoSession.ts';
import { buildRadioWriteProjection } from './radioIoWriteProjection.ts';
import { assemble } from '@core/services/assemble.ts';

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

describe('AT-D890UV write via hydration merge', () => {
  it('blocks write without hydration', async () => {
    const radio: CloneImageRadio = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      download: vi.fn(),
      upload: vi.fn(),
      decodeChannels: () => [],
      encodeChannels: (img) => img,
      readFirmware: () => undefined,
    };
    const descriptor: RadioDescriptor = {
      modelIds: ['AT-D890UV'],
      label: 'D890',
      supportsBle: false,
      protocolFactory: () => radio,
      capabilities: {
        maxChannels: 4000,
        supportsZones: true,
        supportsScanLists: true,
        analogOnly: false,
      },
      attributionIds: [],
      compatibleProfiles: [{ formatId: 'radio-io', profileId: 'radio-io-at-d890uv' }],
      writeStrategy: 'selective-ranges',
      hydrationRequiredForWrite: true,
      baudRate: 921600,
      hydration: {
        extractHydration: () => {
          throw new Error('unused');
        },
        mergeChannelsIntoHydration: mergeChannelsIntoAtD890uvHydration,
      },
    };
    const session: RadioSession = {
      descriptor,
      pipe: { write: vi.fn(), readExact: vi.fn(), close: vi.fn() },
      radio,
    };
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-at-d890uv');
    await expect(writeBuildToRadio(session, build, egress, emptyLibrary())).rejects.toBeInstanceOf(
      RadioWriteBlockedError,
    );
  });

  it('seeds protocol and uploads merged sparse image', async () => {
    const channelSet = new Uint8Array(0x200);
    const cache: AtD890DownloadCache = {
      blocks: new Map([
        [D890_MAP.LocalInfo, new Uint8Array(0x100).fill(0xff)],
        [D890_MAP.ChannelSet, channelSet],
        [D890_MAP.ZoneSet, new Uint8Array(0x20)],
        [D890_MAP.ZoneHide, new Uint8Array(0x20)],
        [D890_MAP.ZoneAChannel, new Uint8Array(0x200)],
        [D890_MAP.ZoneBChannel, new Uint8Array(0x200)],
        [D890_MAP.ScanListSet, new Uint8Array(0x20)],
        [D890_MAP.TalkgroupSet, new Uint8Array(0x4f0).fill(0xff)],
        [D890_MAP.ReceiveGroupSet, new Uint8Array(0x20)],
        [D890_MAP.RadioIdSet, new Uint8Array(0x20)],
        [D890_MAP.MasterIdData, new Uint8Array(0x40)],
      ]),
    };
    const image = createMemoryMap(0x1000);
    const hydration = extractAtD890uvHydrationFromProtocol(image, cache);

    const upload = vi.fn(async (_img: MemoryMap) => {
      void _img;
    });
    const seedProtocolForUpload = vi.fn();
    const radio: CloneImageRadio = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      download: vi.fn(),
      upload,
      decodeChannels: () => [],
      encodeChannels: (img) => img,
      readFirmware: () => undefined,
    };
    const descriptor: RadioDescriptor = {
      modelIds: ['AT-D890UV'],
      label: 'D890',
      supportsBle: false,
      protocolFactory: () => radio,
      capabilities: {
        maxChannels: 4000,
        supportsZones: true,
        supportsScanLists: true,
        analogOnly: false,
      },
      attributionIds: ['anytone-cps'],
      compatibleProfiles: [{ formatId: 'radio-io', profileId: 'radio-io-at-d890uv' }],
      writeStrategy: 'selective-ranges',
      hydrationRequiredForWrite: true,
      baudRate: 921600,
      hydration: {
        extractHydration: () => hydration,
        mergeChannelsIntoHydration: mergeChannelsIntoAtD890uvHydration,
        seedProtocolForUpload,
      },
    };
    const session: RadioSession = {
      descriptor,
      pipe: { write: vi.fn(), readExact: vi.fn(), close: vi.fn() },
      radio,
    };
    const ch = {
      ...newChannel('p1', 'TEST'),
      id: 'ch-1',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      power: 100,
      modeProfiles: [
        { mode: 'fm' as const, squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 25 },
      ],
    };
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-at-d890uv');
    await writeBuildToRadio(
      session,
      {
        ...build,
        channelOverrides: [{ libraryEntityId: 'ch-1', wireName: 'TEST', orderOrSlot: 1 }],
      },
      { ...egress, hydration },
      emptyLibrary([ch]),
    );
    expect(upload).toHaveBeenCalledTimes(1);
    expect(seedProtocolForUpload).toHaveBeenCalledTimes(1);
  });
});

describe('buildRadioWriteProjection radio-io-at-d890uv', () => {
  it('builds organisation with zones and talk groups', () => {
    const ch = {
      ...newChannel('p1', 'CH1'),
      id: 'ch-1',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      power: 100,
      modeProfiles: [
        { mode: 'fm' as const, squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 25 },
      ],
    };
    const library = emptyLibrary([ch]);
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-at-d890uv');
    const assembled = assemble(build, library);
    const projection = buildRadioWriteProjection(assembled, build, library, egress);
    expect(projection.channels.length).toBeGreaterThan(0);
    expect(projection.organisation.zones).toBeDefined();
    expect(projection.organisation.digitalContacts).toBeUndefined();
  });

  it('projects RX group members as 0-based talkgroup bank slot indices', () => {
    const projectId = 'p1';
    const tgA = { ...newTalkGroup(projectId, 'Local', 91), id: 'tg-a' };
    const tgB = { ...newTalkGroup(projectId, 'Brand', 9), id: 'tg-b' };
    const tgC = { ...newTalkGroup(projectId, 'Scotland', 23_559), id: 'tg-c' };
    const rxList = {
      ...newRxGroupList(projectId, 'Local RGL'),
      id: 'rx-1',
      members: [
        { ref: { kind: 'talkGroup' as const, id: tgA.id } },
        { ref: { kind: 'talkGroup' as const, id: tgB.id } },
        { ref: { kind: 'talkGroup' as const, id: tgC.id } },
      ],
    };
    const library = {
      ...emptyLibrary([]),
      talkGroups: [tgA, tgB, tgC],
      rxGroupLists: [rxList],
    };
    const { build, egress } = newRadioBuildForProfile(projectId, 'radio-io-at-d890uv');
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress);
    expect(projection.organisation.rxGroups).toEqual([
      expect.objectContaining({ memberDigitalIds: [0, 1, 2] }),
    ]);
    expect(projection.organisation.rxGroups?.[0]?.memberDigitalIds).not.toContain(91);
    expect(projection.organisation.rxGroups?.[0]?.memberDigitalIds).not.toContain(23_559);
  });

  it('partitions AM airband out of MR channels, zones, and slot map', () => {
    const vhf = {
      ...newChannel('p1', 'VHF'),
      id: 'ch-vhf',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      power: 100,
      modeProfiles: [
        { mode: 'fm' as const, squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 25 },
      ],
    };
    const airband = {
      ...newChannel('p1', 'Tower'),
      id: 'ch-air',
      rxFrequency: 118_800_000,
      txFrequency: null,
      forbidTransmit: 'forbid' as const,
      modeProfiles: [defaultModeProfile('am')],
    };
    const zone = {
      ...newZone('p1', 'Mixed'),
      id: 'zone-mixed',
      members: [
        { kind: 'channel' as const, channelId: vhf.id },
        { kind: 'channel' as const, channelId: airband.id },
      ],
    };
    const library = { ...emptyLibrary([vhf, airband]), zones: [zone] };
    const { build: baseBuild, egress } = newRadioBuildForProfile('p1', 'radio-io-at-d890uv');
    const build = {
      ...baseBuild,
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [
              {
                id: 'zone-mixed',
                name: 'Mixed',
                channelIds: [vhf.id, airband.id],
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

    expect(projection.channels.every((ch) => ch.rxHz < 108_000_000 || ch.rxHz > 137_000_000)).toBe(
      true,
    );
    expect(projection.numbersBySourceChannelId.has('ch-air')).toBe(false);
    expect(projection.numbersBySourceChannelId.get('ch-vhf')).toEqual([1]);
    expect(projection.organisation.zones).toEqual([
      expect.objectContaining({ wireName: 'Mixed', channelNumbers: [1] }),
    ]);
    expect(projection.organisation.amAirChannels).toEqual([
      expect.objectContaining({ slotIndex: 1, wireName: 'Tower', rxHz: 118_800_000 }),
    ]);
    expect(projection.organisation.amZones).toEqual([
      expect.objectContaining({ wireName: 'Mixed', channelNumbers: [1] }),
    ]);
    expect(projection.warnings.some((w) => w.includes('AM airband') && w.includes('omitted'))).toBe(
      false,
    );
  });

  it('keeps airband-only zones off DMR organisation.zones and on amZones', () => {
    const airband = {
      ...newChannel('p1', 'Tower'),
      id: 'ch-air',
      rxFrequency: 118_800_000,
      txFrequency: null,
      forbidTransmit: 'forbid' as const,
      modeProfiles: [defaultModeProfile('am')],
    };
    const zone = {
      ...newZone('p1', 'AM only'),
      id: 'zone-air',
      members: [{ kind: 'channel' as const, channelId: airband.id }],
    };
    const library = { ...emptyLibrary([airband]), zones: [zone] };
    const { build: baseBuild, egress } = newRadioBuildForProfile('p1', 'radio-io-at-d890uv');
    const build = {
      ...baseBuild,
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [
              {
                id: 'zone-air',
                name: 'AM only',
                channelIds: [airband.id],
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

    expect(projection.organisation.zones?.map((z) => z.wireName)).not.toContain('AM only');
    expect(projection.organisation.amZones).toEqual([
      expect.objectContaining({ wireName: 'AM only', channelNumbers: [1] }),
    ]);
  });

  it('does not create MR scan list or carrier when exportScanList is on an airband-only zone', () => {
    const airband = {
      ...newChannel('p1', 'Tower'),
      id: 'ch-air',
      rxFrequency: 118_800_000,
      txFrequency: null,
      forbidTransmit: 'forbid' as const,
      modeProfiles: [defaultModeProfile('am')],
    };
    const zone = {
      ...newZone('p1', 'AM only'),
      id: 'zone-air',
      members: [{ kind: 'channel' as const, channelId: airband.id }],
    };
    const library = { ...emptyLibrary([airband]), zones: [zone] };
    const { build: baseBuild, egress } = newRadioBuildForProfile('p1', 'radio-io-at-d890uv');
    const build = {
      ...baseBuild,
      exportSettings: { exportZoneDerivedScanLists: true },
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [
              {
                id: 'zone-air',
                name: 'AM only',
                channelIds: [airband.id],
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

    expect(projection.organisation.zones?.map((z) => z.wireName)).not.toContain('AM only');
    expect(projection.organisation.amZones).toEqual([
      expect.objectContaining({ wireName: 'AM only' }),
    ]);
    expect(
      projection.organisation.scanLists?.some((list) => list.wireName.includes('AM only')),
    ).toBe(false);
    expect(projection.channels.some((ch) => ch.wireName.match(/AM only.*Scan/i))).toBe(false);
  });

  it('zone-derived scan on a mixed zone includes DMR-bank members only', () => {
    const vhf = {
      ...newChannel('p1', 'VHF'),
      id: 'ch-vhf',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      power: 100,
      modeProfiles: [
        { mode: 'fm' as const, squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 25 },
      ],
    };
    const airband = {
      ...newChannel('p1', 'Tower'),
      id: 'ch-air',
      rxFrequency: 118_800_000,
      txFrequency: null,
      forbidTransmit: 'forbid' as const,
      modeProfiles: [defaultModeProfile('am')],
    };
    const zone = {
      ...newZone('p1', 'Mixed'),
      id: 'zone-mixed',
      members: [
        { kind: 'channel' as const, channelId: vhf.id },
        { kind: 'channel' as const, channelId: airband.id },
      ],
    };
    const library = { ...emptyLibrary([vhf, airband]), zones: [zone] };
    const { build: baseBuild, egress } = newRadioBuildForProfile('p1', 'radio-io-at-d890uv');
    const build = {
      ...baseBuild,
      exportSettings: { exportZoneDerivedScanLists: true },
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [
              {
                id: 'zone-mixed',
                name: 'Mixed',
                channelIds: [vhf.id, airband.id],
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

    const mixedZone = projection.organisation.zones?.find((z) => z.wireName === 'Mixed');
    expect(mixedZone).toBeTruthy();
    expect([...mixedZone!.channelNumbers].sort()).toEqual([1, 2]);
    const mixedScan = projection.organisation.scanLists?.find((list) =>
      list.wireName.startsWith('Mixed'),
    );
    expect(mixedScan).toBeTruthy();
    expect(mixedScan!.channelNumbers).toEqual([1]);
    expect(projection.numbersBySourceChannelId.has('ch-air')).toBe(false);
  });

  it('retains radio AM bank when airband channels have no zone membership', () => {
    const airband = {
      ...newChannel('p1', 'Tower'),
      id: 'ch-air',
      rxFrequency: 118_800_000,
      txFrequency: null,
      forbidTransmit: 'forbid' as const,
      modeProfiles: [defaultModeProfile('am')],
    };
    const library = emptyLibrary([airband]);
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-at-d890uv');
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress);
    expect(projection.organisation.amAirChannels).toBeUndefined();
    expect(projection.organisation.amZones).toBeUndefined();
    expect(projection.warnings.some((w) => w.includes('no AM zone membership'))).toBe(true);
  });

  it('warns when an AM zone exceeds 32 members', () => {
    const channels = Array.from({ length: 33 }, (_, i) => ({
      ...newChannel('p1', `AM${i + 1}`),
      id: `ch-am-${i}`,
      rxFrequency: 118_000_000 + i * 25_000,
      txFrequency: null,
      forbidTransmit: 'forbid' as const,
      modeProfiles: [defaultModeProfile('am')],
    }));
    const zone = {
      ...newZone('p1', 'BigAir'),
      id: 'zone-air',
      members: channels.map((ch) => ({ kind: 'channel' as const, channelId: ch.id })),
    };
    const library = { ...emptyLibrary(channels), zones: [zone] };
    const { build: baseBuild, egress } = newRadioBuildForProfile('p1', 'radio-io-at-d890uv');
    const build = {
      ...baseBuild,
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [
              {
                id: 'zone-air',
                name: 'BigAir',
                channelIds: channels.map((ch) => ch.id),
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
    expect(projection.organisation.amZones?.[0]?.channelNumbers).toHaveLength(32);
    expect(projection.warnings.some((w) => w.includes('truncated') && w.includes('32'))).toBe(true);
  });

  it('partitions broadcast FM out of MR channels with a warning', () => {
    const vhf = {
      ...newChannel('p1', 'VHF'),
      id: 'ch-vhf',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      power: 100,
      modeProfiles: [
        { mode: 'fm' as const, squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 25 },
      ],
    };
    const broadcast = {
      ...newChannel('p1', 'BBC'),
      id: 'ch-fm',
      rxFrequency: 99_500_000,
      txFrequency: null,
      forbidTransmit: 'forbid' as const,
      modeProfiles: [defaultModeProfile('fm')],
    };
    const library = emptyLibrary([vhf, broadcast]);
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-at-d890uv');
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress);

    expect(projection.channels).toHaveLength(1);
    expect(projection.channels[0]?.wireName).toBe('VHF');
    expect(projection.numbersBySourceChannelId.has('ch-fm')).toBe(false);
    expect(
      projection.warnings.some((w) => w.includes('broadcast FM') && w.includes('omitted')),
    ).toBe(true);
  });

  it('stamps scanAdd (auto_scan) on zone scan carriers only', () => {
    const included = {
      ...newChannel('p1', 'Included'),
      id: 'ch-in',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      power: 100,
      modeProfiles: [
        { mode: 'fm' as const, squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 25 },
      ],
    };
    const excluded = {
      ...newChannel('p1', 'Excluded'),
      id: 'ch-out',
      rxFrequency: 145_600_000,
      txFrequency: 145_600_000,
      power: 100,
      scanInclusion: 'skip' as const,
      modeProfiles: [
        { mode: 'fm' as const, squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 25 },
      ],
    };
    const zone = {
      ...newZone('p1', 'Glasgow'),
      id: 'zone-gla',
      members: [
        { kind: 'channel' as const, channelId: included.id },
        { kind: 'channel' as const, channelId: excluded.id },
      ],
    };
    const library = { ...emptyLibrary([included, excluded]), zones: [zone] };
    const { build: baseBuild, egress } = newRadioBuildForProfile('p1', 'radio-io-at-d890uv');
    const build = {
      ...baseBuild,
      exportSettings: { exportZoneDerivedScanLists: true },
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [
              {
                id: 'zone-gla',
                name: 'Glasgow',
                channelIds: [included.id, excluded.id],
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

    const carrierSlot = projection.organisation.scanLists?.find((list) =>
      list.wireName.startsWith('Glasgow'),
    )?.designatedTxChannel;
    expect(carrierSlot).toBeTypeOf('number');

    const bySlot = new Map(projection.channels.map((ch) => [ch.slotIndex, ch]));
    expect(bySlot.get(carrierSlot!)?.scanAdd).toBe(true);

    const includedSlot = projection.numbersBySourceChannelId.get('ch-in')?.[0];
    const excludedSlot = projection.numbersBySourceChannelId.get('ch-out')?.[0];
    expect(bySlot.get(includedSlot!)?.scanAdd).toBe(false);
    expect(bySlot.get(excludedSlot!)?.scanAdd).toBe(false);
  });

  it('stamps scanAdd false on all channels when zone scan export is disabled', () => {
    const ch = {
      ...newChannel('p1', 'Solo'),
      id: 'ch-1',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      power: 100,
      modeProfiles: [
        { mode: 'fm' as const, squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 25 },
      ],
    };
    const zone = {
      ...newZone('p1', 'Home'),
      id: 'zone-home',
      members: [{ kind: 'channel' as const, channelId: ch.id }],
    };
    const library = { ...emptyLibrary([ch]), zones: [zone] };
    const { build: baseBuild, egress } = newRadioBuildForProfile('p1', 'radio-io-at-d890uv');
    const build = {
      ...baseBuild,
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [
              {
                id: 'zone-home',
                name: 'Home',
                channelIds: [ch.id],
                exportScanList: false,
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

    expect(projection.channels.every((c) => c.scanAdd === false)).toBe(true);
    expect(
      projection.organisation.scanLists?.some((list) => list.designatedTxChannel != null),
    ).toBe(false);
  });
});
