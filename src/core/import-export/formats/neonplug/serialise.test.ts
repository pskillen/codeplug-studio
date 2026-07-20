import { describe, expect, it } from 'vitest';
import { newChannel } from '@core/domain/factories.ts';
import type { Channel } from '@core/models/library.ts';
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
    expect(data.scanLists).toEqual([]);
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
});
