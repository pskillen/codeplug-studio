import { formatExportWarning } from '@core/import-export/exportWarning.ts';
import { describe, expect, it } from 'vitest';
import {
  newChannel,
  newRadioBuildForProfile,
  newRxGroupList,
  newTalkGroup,
} from '@core/domain/factories.ts';
import { assemble, type AssembledChannel, type LibrarySlice } from '@core/services/assemble.ts';
import type { ChannelModeProfileDMR } from '@core/models/library.ts';
import { expandAllMxNChannels } from '@core/import-export/channelExpansion/mxnExpandAll.ts';
import { expandAllAnytoneChannelsForExport } from '@core/services/anytoneChannelExpansion.ts';
import {
  assembledChannelsToRadioDtos,
  assembledChannelsToRadioDtosWithWarnings,
  expandAssembledChannelsToRadioDtos,
} from './radioIoChannelMap.ts';
import { openGd77DroppedModesWarning } from '@core/import-export/opengd77ExportModes.ts';
import { channelToneToRadioTone } from '@app/lib/channelFields/channelToneToRadioTone.ts';

describe('channelToneToRadioTone', () => {
  it.each([
    ['none', { kind: 'none' }],
    ['103.5', { kind: 'ctcss', hz: 103.5 }],
    ['100', { kind: 'ctcss', hz: 100 }],
    ['100.0', { kind: 'ctcss', hz: 100 }],
    ['D023N', { kind: 'dcs', code: 23, polarity: 'N' }],
    ['D023P', { kind: 'dcs', code: 23, polarity: 'I' }],
    ['D023I', { kind: 'dcs', code: 23, polarity: 'I' }],
  ] as const)('maps %s', (tone, expected) => {
    expect(channelToneToRadioTone(tone)).toEqual(expected);
  });
});

describe('assembledChannelsToRadioDtos', () => {
  it('maps wire name, slot, Hz, and NFM bandwidth', () => {
    const projectId = 'p1';
    const { build: baseBuild, egress } = newRadioBuildForProfile(projectId, 'radio-io-uv5r-mini');
    const entity = {
      ...newChannel(projectId, 'Library Name'),
      id: 'ch-1',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      power: 20,
      modeProfiles: [
        {
          mode: 'fm' as const,
          squelch: null,
          rxTone: '88.5',
          txTone: 'none',
          bandwidthKHz: 12.5,
        },
      ],
    };
    // Wire-name override is looked up from `build.channelOverrides` by resolveWireNames —
    // not from the AssembledChannel's own `wireNameOverride` (which `assemble()` would have
    // folded from the same override, but this test constructs the row directly).
    const build = {
      ...baseBuild,
      channelOverrides: [{ libraryEntityId: 'ch-1', wireName: 'WIRE12' }],
    };
    const row: AssembledChannel = {
      entity,
      wireName: 'WIRE12',
      wireNameOverride: 'WIRE12',
      orderOrSlot: 7,
    };
    const dtos = assembledChannelsToRadioDtos([row], build, egress);
    expect(dtos).toHaveLength(1);
    expect(dtos[0]).toMatchObject({
      slotIndex: 7,
      wireName: 'WIRE12',
      rxHz: 145_500_000,
      powerPercent: 20,
      bandwidth: 'NFM',
      rxTone: { kind: 'ctcss', hz: 88.5 },
    });
  });

  it('maps explicit 25 kHz FM bandwidth to wide FM', () => {
    const projectId = 'p1';
    const { build, egress } = newRadioBuildForProfile(projectId, 'radio-io-opengd77-1701');
    const entity = {
      ...newChannel(projectId, 'Wide'),
      id: 'ch-wide-bw',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      modeProfiles: [
        {
          mode: 'fm' as const,
          squelch: null,
          rxTone: 'none',
          txTone: 'none',
          bandwidthKHz: 25,
        },
      ],
    };
    const row: AssembledChannel = { entity, wireName: 'WIDE', orderOrSlot: 1 };
    const dtos = assembledChannelsToRadioDtos([row], build, egress);
    expect(dtos[0]?.bandwidth).toBe('FM');
  });

  it('defaults null bandwidth to NFM on OpenGD77 projection', () => {
    const projectId = 'p1';
    const { build, egress } = newRadioBuildForProfile(projectId, 'radio-io-opengd77-1701');
    const entity = {
      ...newChannel(projectId, 'Analog'),
      id: 'ch-null-bw',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      modeProfiles: [
        {
          mode: 'fm' as const,
          squelch: null,
          rxTone: 'none',
          txTone: 'none',
          bandwidthKHz: null,
        },
      ],
    };
    const row: AssembledChannel = { entity, wireName: 'ANALOG', orderOrSlot: 1 };
    const dtos = assembledChannelsToRadioDtos([row], build, egress);
    expect(dtos[0]?.bandwidth).toBe('NFM');
  });

  it('shortens long names to the radio-io profile nameLimit', () => {
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-uv5r-mini');
    const entity = {
      ...newChannel('p1', 'Very Long Channel Name Indeed'),
      id: 'ch-long',
      rxFrequency: 145_000_000,
      txFrequency: 145_000_000,
      modeProfiles: [
        { mode: 'fm' as const, squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 25 },
      ],
    };
    const row: AssembledChannel = {
      entity,
      wireName: 'Very Long Channel Name Indeed',
    };
    const dtos = assembledChannelsToRadioDtos([row], build, egress);
    expect(dtos[0]?.wireName.length).toBeLessThanOrEqual(12);
  });

  it('bumps colliding orderOrSlot to match CHIRP CSV slot resolver', () => {
    const projectId = 'p1';
    const { build, egress } = newRadioBuildForProfile(projectId, 'radio-io-uv21');
    const mkRow = (id: string, name: string, orderOrSlot: number): AssembledChannel => ({
      entity: {
        ...newChannel(projectId, name),
        id,
        rxFrequency: 145_500_000,
        txFrequency: 145_500_000,
        modeProfiles: [
          {
            mode: 'fm' as const,
            squelch: null,
            rxTone: 'none',
            txTone: 'none',
            bandwidthKHz: 12.5,
          },
        ],
      },
      wireName: name,
      orderOrSlot,
    });
    const rows = [mkRow('ch-a', 'A', 3), mkRow('ch-b', 'B', 3)];
    const dtos = assembledChannelsToRadioDtos(rows, build, egress);
    expect(dtos.map((d) => d.slotIndex).sort()).toEqual([3, 4]);
    const byName = Object.fromEntries(dtos.map((d) => [d.wireName, d.slotIndex]));
    expect(byName.A).toBe(3);
    expect(byName.B).toBe(4);
  });

  it('maps AM mode profile to FM wide bandwidth (CHIRP frequency-implied AM)', () => {
    const projectId = 'p1';
    const { build, egress } = newRadioBuildForProfile(projectId, 'radio-io-uv21');
    const entity = {
      ...newChannel(projectId, 'Airband'),
      id: 'ch-am',
      rxFrequency: 121_500_000,
      txFrequency: 121_500_000,
      modeProfiles: [
        {
          mode: 'am' as const,
          squelch: null,
          rxTone: 'none',
          txTone: 'none',
          bandwidthKHz: null,
        },
      ],
    };
    const row: AssembledChannel = { entity, wireName: 'Airband', orderOrSlot: 1 };
    const dtos = assembledChannelsToRadioDtos([row], build, egress);
    expect(dtos[0]?.bandwidth).toBe('FM');
  });

  it('omits AM channels for RT95 after assemble eligibility filtering', () => {
    const projectId = 'p1';
    const { build, egress } = newRadioBuildForProfile(projectId, 'radio-io-rt95');
    const entity = {
      ...newChannel(projectId, 'Tower'),
      id: 'ch-am',
      rxFrequency: 118_800_000,
      txFrequency: 118_800_000,
      modeProfiles: [
        {
          mode: 'am' as const,
          squelch: null,
          rxTone: 'none',
          txTone: 'none',
          bandwidthKHz: null,
        },
      ],
    };
    const library: LibrarySlice = {
      channels: [entity],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    expect(assembled.channels).toHaveLength(0);
    const { dtos } = expandAssembledChannelsToRadioDtos(assembled, build, library, egress);
    expect(dtos).toEqual([]);
  });

  it('skips channels without RX frequency', () => {
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-uv5r-mini');
    const entity = {
      ...newChannel('p1', 'Empty'),
      id: 'ch-2',
      rxFrequency: null,
      modeProfiles: [],
    };
    expect(assembledChannelsToRadioDtos([{ entity, wireName: 'X' }], build, egress)).toEqual([]);
  });

  it('maps forbidTransmit to rxOnly for UV-5R Mini', () => {
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-uv5r-mini');
    const entity = {
      ...newChannel('p1', 'Listen'),
      id: 'ch-rx',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      forbidTransmit: 'forbid' as const,
      modeProfiles: [
        { mode: 'fm' as const, squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 25 },
      ],
    };
    const dtos = assembledChannelsToRadioDtos([{ entity, wireName: 'Listen' }], build, egress);
    expect(dtos[0]?.rxOnly).toBe(true);
  });

  it('drops non-DMR digital modes for OpenGD77 serial projection', () => {
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-opengd77-1701');
    const entity = {
      ...newChannel('p1', 'Repeater'),
      id: 'ch-mix',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
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
        { mode: 'ysf' as const, dgId: null, wiresDtmfId: '' },
      ],
    };
    const { dtos, warnings } = assembledChannelsToRadioDtosWithWarnings(
      [{ entity, wireName: 'Repeater' }],
      build,
      egress,
    );
    expect(dtos).toHaveLength(2);
    expect(dtos.map((d) => d.wireName).sort()).toEqual(['Repeater-D', 'Repeater-F']);
    expect(dtos.map((d) => d.mode).sort()).toEqual(['analog', 'digital']);
    expect(warnings.map((w) => formatExportWarning(w))).toContain(
      openGd77DroppedModesWarning('Repeater', ['ysf']),
    );
  });

  it('expands dual-mode FM+DMR to -F and -D wire rows via expandAssembledChannelsToRadioDtos', () => {
    const projectId = 'p1';
    const { build, egress } = newRadioBuildForProfile(projectId, 'radio-io-opengd77-1701');
    const entity = {
      ...newChannel(projectId, 'DualMode'),
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
    };
    const library: LibrarySlice = {
      channels: [entity],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const { dtos } = expandAssembledChannelsToRadioDtos(assembled, build, library, egress);
    expect(dtos).toHaveLength(2);
    expect(dtos.map((d) => d.wireName).sort()).toEqual(['DualMode-D', 'DualMode-F']);
    expect(dtos.map((d) => d.mode).sort()).toEqual(['analog', 'digital']);
  });

  it('keeps full channel name under limit when abbreviation is set (no eager abbrev)', () => {
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-opengd77-md9600');
    const entity = {
      ...newChannel('p1', 'hotspot'),
      abbreviation: 'Hspt',
      id: 'ch-hotspot',
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      modeProfiles: [
        {
          mode: 'fm' as const,
          squelch: null,
          rxTone: 'none',
          txTone: 'none',
          bandwidthKHz: 12.5,
        },
      ],
    };
    const dtos = assembledChannelsToRadioDtos([{ entity, wireName: 'hotspot' }], build, egress);
    expect(dtos[0]?.wireName).toBe('hotspot');
  });

  it('omits YSF-only channels from OpenGD77 serial projection', () => {
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-opengd77-1701');
    const entity = {
      ...newChannel('p1', 'Fusion only'),
      id: 'ch-ysf',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      modeProfiles: [{ mode: 'ysf' as const, dgId: null, wiresDtmfId: '' }],
    };
    const { dtos, warnings } = assembledChannelsToRadioDtosWithWarnings(
      [{ entity, wireName: 'Fusion only' }],
      build,
      egress,
    );
    expect(dtos).toEqual([]);
    expect(
      warnings.some(
        (w) =>
          formatExportWarning(w).includes('Fusion only') && formatExportWarning(w).includes('ysf'),
      ),
    ).toBe(true);
  });

  it('projects repeater vs DMO onto RadioChannelDto for D890 serial', () => {
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-at-d890uv');
    const dmrProfile = {
      mode: 'dmr' as const,
      colourCode: 1,
      timeslot: 1 as const,
      dmrId: 1234567,
      contactRef: null,
      rxGroupListId: null,
    } satisfies ChannelModeProfileDMR;
    const repeater = {
      ...newChannel('p1', 'GB7GL'),
      id: 'ch-rpt',
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      modeProfiles: [dmrProfile],
    };
    const simplex = {
      ...newChannel('p1', 'Hspt'),
      id: 'ch-dmo',
      rxFrequency: 438_800_000,
      txFrequency: 438_800_000,
      modeProfiles: [dmrProfile],
    };
    const analog = {
      ...newChannel('p1', 'FM'),
      id: 'ch-fm',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      modeProfiles: [
        { mode: 'fm' as const, squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 12.5 },
      ],
    };
    expect(
      assembledChannelsToRadioDtos([{ entity: repeater, wireName: 'GB7GL' }], build, egress)[0]
        ?.dmrOperatingMode,
    ).toBe('repeater');
    expect(
      assembledChannelsToRadioDtos([{ entity: simplex, wireName: 'Hspt' }], build, egress)[0]
        ?.dmrOperatingMode,
    ).toBe('dmo-simplex');
    expect(
      assembledChannelsToRadioDtos([{ entity: analog, wireName: 'FM' }], build, egress)[0]
        ?.dmrOperatingMode,
    ).toBeUndefined();
  });

  it('copies channel location and useLocation for OpenGD77 serial projection', () => {
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-opengd77-1701');
    const entity = {
      ...newChannel('p1', 'Edinburgh'),
      id: 'ch-edin',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      location: { lat: 55.9533, lon: -3.1883 },
      useLocation: true,
      modeProfiles: [
        {
          mode: 'fm' as const,
          squelch: null,
          rxTone: 'none',
          txTone: 'none',
          bandwidthKHz: 12.5,
        },
      ],
    };
    const dtos = assembledChannelsToRadioDtos([{ entity, wireName: 'Edinburgh' }], build, egress);
    expect(dtos[0]?.location).toEqual({ lat: 55.9533, lon: -3.1883 });
    expect(dtos[0]?.useLocation).toBe(true);
  });
});

describe('expandAssembledChannelsToRadioDtos — MxN', () => {
  const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

  function dmrLibrary(): {
    channel: ReturnType<typeof newChannel>;
    library: LibrarySlice;
  } {
    const tg1 = newTalkGroup(PROJECT_ID, 'Scotland', 950);
    const tg2 = newTalkGroup(PROJECT_ID, 'Local', 9);
    const rgl = {
      ...newRxGroupList(PROJECT_ID, 'Scotland'),
      members: [
        { ref: { kind: 'talkGroup' as const, id: tg1.id } },
        { ref: { kind: 'talkGroup' as const, id: tg2.id } },
      ],
    };
    const channel = {
      ...newChannel(PROJECT_ID, 'Glasgow'),
      callsign: 'GB7GL',
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      modeProfiles: [
        {
          mode: 'dmr',
          colourCode: 1,
          timeslot: 1,
          dmrId: 1234567,
          contactRef: null,
          rxGroupListId: rgl.id,
        } satisfies ChannelModeProfileDMR,
      ],
    };
    return {
      channel,
      library: {
        channels: [channel],
        zones: [],
        talkGroups: [tg1, tg2],
        digitalContacts: [],
        analogContacts: [],
        rxGroupLists: [rgl],
        scanLists: [],
      },
    };
  }

  it('expands to the same wire names as expandAllMxNChannels when MxN is on', () => {
    const { channel, library } = dmrLibrary();
    const { build, egress } = newRadioBuildForProfile(PROJECT_ID, 'radio-io-dm32uv');
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const expected = expandAllMxNChannels({
      assembled,
      library,
      radioTargetId: build.radioTargetId,
      options: {
        expandRxGroupLists: true,
        exportScratchChannels: true,
        profileId: egress.profileId,
      },
    });
    const { dtos } = expandAssembledChannelsToRadioDtos(assembled, build, library, egress);
    expect(dtos.map((d) => d.wireName)).toEqual(expected.map((row) => row.wireName));
    expect(dtos.length).toBeGreaterThan(1);
    expect(channel.id).toBe(assembled.channels[0]?.entity.id);
    expect(dtos.every((d) => d.dmrOperatingMode === 'repeater')).toBe(true);
  });

  it('stays lean 1:1 when expandRxGroupLists is off', () => {
    const { library } = dmrLibrary();
    const { build, egress } = newRadioBuildForProfile(PROJECT_ID, 'radio-io-dm32uv');
    const buildOff = {
      ...build,
      exportSettings: { ...build.exportSettings, expandRxGroupLists: false },
    };
    const assembled = assemble(buildOff, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const { dtos } = expandAssembledChannelsToRadioDtos(assembled, buildOff, library, egress);
    expect(dtos).toHaveLength(1);
  });

  it('does not fan out for non-MxN radio-io (UV-5R Mini)', () => {
    const projectId = 'p1';
    const { build, egress } = newRadioBuildForProfile(projectId, 'radio-io-uv5r-mini');
    const entity = {
      ...newChannel(projectId, 'Simple'),
      id: 'ch-1',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      modeProfiles: [
        { mode: 'fm' as const, squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 25 },
      ],
    };
    const library: LibrarySlice = {
      channels: [entity],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const { dtos } = expandAssembledChannelsToRadioDtos(assembled, build, library, egress);
    expect(dtos).toHaveLength(1);
  });
});

describe('expandAssembledChannelsToRadioDtos — Anytone AT-D890UV site wire names', () => {
  const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

  function leanAnytoneLibrary(channelName: string) {
    const tg = newTalkGroup(PROJECT_ID, 'Scotland', 950);
    const rgl = {
      ...newRxGroupList(PROJECT_ID, 'Scotland'),
      members: [{ ref: { kind: 'talkGroup' as const, id: tg.id } }],
    };
    const channel = {
      ...newChannel(PROJECT_ID, channelName),
      callsign: 'GB7GL',
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      modeProfiles: [
        {
          mode: 'dmr',
          colourCode: 1,
          timeslot: 1,
          dmrId: 1234567,
          contactRef: null,
          rxGroupListId: rgl.id,
        } satisfies ChannelModeProfileDMR,
      ],
    };
    return {
      channel,
      library: {
        channels: [channel],
        zones: [],
        talkGroups: [tg],
        digitalContacts: [],
        analogContacts: [],
        rxGroupLists: [rgl],
        scanLists: [],
      },
    };
  }

  function anytoneLeanBuild() {
    const { build, egress } = newRadioBuildForProfile(PROJECT_ID, 'radio-io-at-d890uv');
    return {
      build: {
        ...build,
        exportSettings: {
          ...build.exportSettings,
          expandRxGroupLists: false,
          shortenNames: true,
        },
      },
      egress,
    };
  }

  it('shortens lean site wire names to match CSV export', () => {
    const longName = 'Really Long Repeater Site Name';
    const { library } = leanAnytoneLibrary(longName);
    const { build, egress } = anytoneLeanBuild();
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const csvRows = expandAllAnytoneChannelsForExport(assembled, library, {
      expandRxGroupLists: false,
      shortenNames: true,
      profileId: 'anytone-at-d890uv',
    });
    const { dtos } = expandAssembledChannelsToRadioDtos(assembled, build, library, egress);
    expect(csvRows).toHaveLength(1);
    expect(csvRows[0]?.rowKind).toBe('lean');
    expect(dtos).toHaveLength(1);
    expect(dtos[0]?.wireName).toBe(csvRows[0]?.wireName);
    expect(dtos[0]?.wireName.length).toBeLessThanOrEqual(16);
    expect(dtos[0]?.wireName).not.toContain(longName);
  });

  it('sanitises non-ASCII lean site wire names like CSV export', () => {
    const { library } = leanAnytoneLibrary('Café Nïce');
    const { build, egress } = anytoneLeanBuild();
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const csvRows = expandAllAnytoneChannelsForExport(assembled, library, {
      expandRxGroupLists: false,
      shortenNames: true,
      profileId: 'anytone-at-d890uv',
    });
    const { dtos } = expandAssembledChannelsToRadioDtos(assembled, build, library, egress);
    expect(dtos[0]?.wireName).toBe(csvRows[0]?.wireName);
    expect(dtos[0]?.wireName).not.toMatch(/[^\x20-\x7E]/);
    expect(dtos[0]?.wireName).not.toContain('é');
    expect(dtos[0]?.wireName).not.toContain('ï');
  });

  it('matches CSV fan-out wire names on talk-group rows', () => {
    const tg1 = newTalkGroup(PROJECT_ID, 'Scotland', 950);
    const tg2 = newTalkGroup(PROJECT_ID, 'Local', 9);
    const rgl = {
      ...newRxGroupList(PROJECT_ID, 'Scotland'),
      members: [
        { ref: { kind: 'talkGroup' as const, id: tg1.id } },
        { ref: { kind: 'talkGroup' as const, id: tg2.id } },
      ],
    };
    const channel = {
      ...newChannel(PROJECT_ID, 'Glasgow'),
      callsign: 'GB7GL',
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      modeProfiles: [
        {
          mode: 'dmr',
          colourCode: 1,
          timeslot: 1,
          dmrId: 1234567,
          contactRef: null,
          rxGroupListId: rgl.id,
        } satisfies ChannelModeProfileDMR,
      ],
    };
    const library: LibrarySlice = {
      channels: [channel],
      zones: [],
      talkGroups: [tg1, tg2],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [rgl],
      scanLists: [],
    };
    const { build, egress } = newRadioBuildForProfile(PROJECT_ID, 'radio-io-at-d890uv');
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const csvRows = expandAllAnytoneChannelsForExport(assembled, library, {
      expandRxGroupLists: true,
      exportScratchChannels: true,
      profileId: 'anytone-at-d890uv',
    });
    const { dtos } = expandAssembledChannelsToRadioDtos(assembled, build, library, egress);
    expect(dtos.map((d) => d.wireName)).toEqual(csvRows.map((row) => row.wireName));
    expect(dtos.length).toBeGreaterThan(1);
    expect(channel.id).toBe(assembled.channels[0]?.entity.id);
  });
});
