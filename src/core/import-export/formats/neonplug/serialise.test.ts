import { describe, expect, it } from 'vitest';
import { newChannel, newRxGroupList, newTalkGroup, newZone } from '@core/domain/factories.ts';
import type { Channel, ChannelModeProfileDMR } from '@core/models/library.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { serialiseNeonplugCodeplug } from './serialise.ts';
import { collectNeonplugExportWarnings } from './warnings.ts';

const projectId = '11111111-1111-4111-8111-111111111111';

function fmChannel(id: string, name: string, rxHz: number): Channel {
  return {
    ...newChannel(projectId, name),
    id,
    rxFrequency: rxHz,
    txFrequency: rxHz,
    modeProfiles: [
      {
        mode: 'fm',
        rxTone: 'none',
        txTone: 'none',
        squelch: null,
        bandwidthKHz: 12.5,
      },
    ],
  };
}

function assembledDm32(channels: Channel[]): AssembledBuild {
  return {
    buildId: 'b1',
    formatId: 'neonplug',
    profileId: 'neonplug-dm32uv',
    buildName: 'DM32 Neon',
    channels: channels.map((entity) => ({ entity, wireName: entity.name })),
    zones: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    scanLists: [],
  };
}

describe('neonplug/serialise', () => {
  it('assigns sequential channel numbers for DM32UV with empty org arrays when unused', () => {
    const ch1 = fmChannel('ch-1', 'Alpha', 145_500_000);
    const ch2 = fmChannel('ch-2', 'Bravo', 433_500_000);
    const { data, content, warnings } = serialiseNeonplugCodeplug(assembledDm32([ch1, ch2]), {
      exportDate: '2026-07-20T12:00:00.000Z',
      shortenNames: false,
    });

    expect(warnings).toEqual([]);
    expect(data.version).toBe('1.0.0');
    expect(data.exportDate).toBe('2026-07-20T12:00:00.000Z');
    expect(data.radioInfo.model).toBe('DP570UV');
    expect(data.channels).toHaveLength(2);
    expect(data.channels[0]?.number).toBe(1);
    expect(data.channels[0]?.name).toBe('Alpha');
    expect(data.channels[1]?.number).toBe(2);
    expect(data.zones).toEqual([]);
    expect(data.contacts).toEqual([]);
    expect(data.scanLists).toEqual([
      {
        name: 'Scan list 1',
        channels: [],
        channelCount: 0,
        ctcScanMode: 0,
        scanTxMode: 0,
      },
    ]);
    expect(data.channels.every((ch) => ch.scanListId === 0)).toBe(true);
    expect(data.rxGroups).toEqual([]);
    expect(data.radioSettings).toBeNull();
    expect(content.includes('\n')).toBe(false);
    expect(JSON.parse(content).channels[0].rxFrequency).toBe(145.5);
  });

  it('uses flat-memory slot numbers for UV5R-Mini and skips blanks', () => {
    const ch1 = fmChannel('ch-1', 'First', 145_500_000);
    const ch2 = fmChannel('ch-2', 'Second', 433_500_000);
    const assembled: AssembledBuild = {
      buildId: 'b2',
      formatId: 'neonplug',
      profileId: 'neonplug-uv5rmini',
      buildName: 'UV5R Neon',
      channels: [
        { entity: ch1, wireName: 'First' },
        { entity: ch2, wireName: 'Second' },
      ],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
      channelMemorySlots: [
        { slot: 1, channelId: null },
        { slot: 2, channelId: 'ch-2' },
        { slot: 5, channelId: 'ch-1' },
      ],
    };

    const { data } = serialiseNeonplugCodeplug(assembled, {
      exportDate: '2026-07-20T12:00:00.000Z',
      shortenNames: false,
    });

    expect(data.radioInfo.model).toBe('UV5R-Mini');
    expect(data.channels.map((c) => c.number)).toEqual([2, 5]);
    expect(data.channels.map((c) => c.name)).toEqual(['Second', 'First']);
  });

  it('truncates long channel names to profile limit', () => {
    const long = fmChannel('ch-1', 'ABCDEFGHIJKLMNOPQRST', 145_500_000);
    const { data, warnings } = serialiseNeonplugCodeplug(assembledDm32([long]), {
      exportDate: '2026-07-20T12:00:00.000Z',
      shortenNames: true,
    });
    expect(data.channels[0]?.name.length).toBeLessThanOrEqual(16);
    expect(warnings.some((w) => /name|truncat|shorten|exceed/i.test(w))).toBe(true);
  });

  it('warns when UV5R channel count exceeds maxMemorySlots', () => {
    const assembled: AssembledBuild = {
      buildId: 'b3',
      formatId: 'neonplug',
      profileId: 'neonplug-uv5rmini',
      buildName: 'UV5R Neon',
      channels: [],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
      channelMemorySlots: Array.from({ length: 1001 }, (_, i) => ({
        slot: i + 1,
        channelId: `ch-${i}`,
      })),
    };
    expect(collectNeonplugExportWarnings(assembled)).toEqual([
      'Truncated 2 channel(s) to fit 999 memory slots for Baofeng UV-5R Mini (NeonPlug).',
    ]);
  });

  it('expands RX-list channels and fans out zone members when expandRxGroupLists is on', () => {
    const tg1 = { ...newTalkGroup(projectId, 'TG1', 101), id: 'tg-1' };
    const tg2 = { ...newTalkGroup(projectId, 'TG2', 102), id: 'tg-2' };
    const rgl = {
      ...newRxGroupList(projectId, 'Local'),
      id: 'rgl-1',
      members: [
        { ref: { kind: 'talkGroup' as const, id: tg1.id } },
        { ref: { kind: 'talkGroup' as const, id: tg2.id } },
      ],
    };
    const channel: Channel = {
      ...newChannel(projectId, 'Glasgow'),
      id: 'ch-1',
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      modeProfiles: [
        {
          mode: 'dmr',
          colourCode: 1,
          timeslot: 1,
          dmrId: null,
          contactRef: null,
          rxGroupListId: rgl.id,
        } satisfies ChannelModeProfileDMR,
      ],
    };
    const zone = {
      ...newZone(projectId, 'West'),
      id: 'zone-1',
      members: [{ kind: 'channel' as const, channelId: channel.id }],
    };

    const assembled: AssembledBuild = {
      buildId: 'b-exp',
      formatId: 'neonplug',
      profileId: 'neonplug-dm32uv',
      buildName: 'Expand',
      channels: [{ entity: channel, wireName: 'Glasgow' }],
      zones: [{ zoneId: zone.id, wireName: 'West', memberChannelIds: [channel.id] }],
      talkGroups: [
        { entity: tg1, wireName: tg1.name },
        { entity: tg2, wireName: tg2.name },
      ],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [{ entity: rgl, wireName: rgl.name }],
      scanLists: [],
      library: {
        channels: [channel],
        zones: [zone],
        talkGroups: [tg1, tg2],
        digitalContacts: [],
        analogContacts: [],
        rxGroupLists: [rgl],
        scanLists: [],
      },
      zoneGrouping: {
        kind: 'zoneGrouping',
        zones: [
          {
            id: zone.id,
            name: 'West',
            channelIds: [channel.id],
            exportScanList: true,
          },
        ],
      },
    };

    const { data } = serialiseNeonplugCodeplug(assembled, {
      exportDate: '2026-07-20T12:00:00.000Z',
      shortenNames: false,
      expandRxGroupLists: true,
      exportScratchChannels: true,
    });

    // 2 TG rows + 1 scratch
    expect(data.channels).toHaveLength(3);
    expect(data.channels.map((c) => c.number)).toEqual([1, 2, 3]);
    expect(data.channels[0]?.rxGroupListId).toBe(0);
    expect(data.channels[0]?.contactId).toBeGreaterThan(0);
    expect(data.channels[2]?.name).toMatch(/Scratch/i);
    expect(data.channels[2]?.rxGroupListId).toBe(1);
    expect(data.zones[0]?.channels).toEqual([1, 2, 3]);
    expect(data.scanLists[0]?.channels).toEqual([1, 2, 3]);
    expect(data.channels.every((c) => c.scanListId === 1)).toBe(true);
  });

  it('emits one lean channel when expandRxGroupLists is false', () => {
    const tg1 = { ...newTalkGroup(projectId, 'TG1', 101), id: 'tg-1' };
    const rgl = {
      ...newRxGroupList(projectId, 'Local'),
      id: 'rgl-1',
      members: [{ ref: { kind: 'talkGroup' as const, id: tg1.id } }],
    };
    const channel: Channel = {
      ...newChannel(projectId, 'Glasgow'),
      id: 'ch-1',
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      modeProfiles: [
        {
          mode: 'dmr',
          colourCode: 1,
          timeslot: 1,
          dmrId: null,
          contactRef: null,
          rxGroupListId: rgl.id,
        } satisfies ChannelModeProfileDMR,
      ],
    };

    const assembled: AssembledBuild = {
      buildId: 'b-lean',
      formatId: 'neonplug',
      profileId: 'neonplug-dm32uv',
      buildName: 'Lean',
      channels: [{ entity: channel, wireName: 'Glasgow' }],
      zones: [],
      talkGroups: [{ entity: tg1, wireName: tg1.name }],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [{ entity: rgl, wireName: rgl.name }],
      scanLists: [],
    };

    const { data } = serialiseNeonplugCodeplug(assembled, {
      exportDate: '2026-07-20T12:00:00.000Z',
      shortenNames: false,
      expandRxGroupLists: false,
      exportScratchChannels: true,
    });

    expect(data.channels).toHaveLength(1);
    expect(data.channels[0]?.name).toBe('Glasgow');
    expect(data.channels[0]?.rxGroupListId).toBe(1);
  });
});
