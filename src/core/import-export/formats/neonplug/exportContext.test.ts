import { describe, expect, it } from 'vitest';
import { newChannel } from '@core/domain/factories.ts';
import type { Channel } from '@core/models/library.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import {
  buildDm32uvChannelNumberMap,
  buildUv5rminiChannelNumberMap,
  channelNumbersForMembers,
  resolveContactBookId,
  resolveRxGroupListId,
} from './exportContext.ts';

const projectId = '11111111-1111-4111-8111-111111111111';

function fmChannel(id: string, name: string): Channel {
  return {
    ...newChannel(projectId, name),
    id,
    rxFrequency: 145_500_000,
    txFrequency: 145_500_000,
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

describe('neonplug/exportContext', () => {
  it('builds sequential DM32UV channel numbers truncated at maxChannels', () => {
    const channels = [
      fmChannel('ch-1', 'A'),
      fmChannel('ch-2', 'B'),
      fmChannel('ch-3', 'C'),
    ];
    const map = buildDm32uvChannelNumberMap(assembledDm32(channels), 2);
    expect([...map.entries()]).toEqual([
      ['ch-1', 1],
      ['ch-2', 2],
    ]);
  });

  it('builds UV5R slot numbers from memory slots', () => {
    const ch1 = fmChannel('ch-1', 'First');
    const ch2 = fmChannel('ch-2', 'Second');
    const assembled: AssembledBuild = {
      ...assembledDm32([ch1, ch2]),
      profileId: 'neonplug-uv5rmini',
      channelMemorySlots: [
        { slot: 1, channelId: null },
        { slot: 2, channelId: 'ch-2' },
        { slot: 5, channelId: 'ch-1' },
      ],
    };
    const map = buildUv5rminiChannelNumberMap(assembled, 999);
    expect(map.get('ch-2')).toBe(2);
    expect(map.get('ch-1')).toBe(5);
  });

  it('resolves contact book and RX list FKs', () => {
    const contacts = new Map([
      ['tg-1', 1],
      ['dc-1', 2],
    ]);
    expect(resolveContactBookId({ kind: 'talkGroup', id: 'tg-1' }, contacts)).toBe(1);
    expect(resolveContactBookId({ kind: 'digitalContact', id: 'dc-1' }, contacts)).toBe(2);
    expect(resolveContactBookId(null, contacts)).toBe(0);
    expect(resolveContactBookId({ kind: 'talkGroup', id: 'missing' }, contacts)).toBe(0);

    const rx = new Map([['rx-1', 1]]);
    expect(resolveRxGroupListId('rx-1', rx)).toBe(1);
    expect(resolveRxGroupListId(null, rx)).toBe(0);
  });

  it('maps member UUIDs to unique ordered channel numbers', () => {
    const numbers = channelNumbersForMembers(['ch-1', 'ch-2', 'ch-1', 'missing'], new Map([
      ['ch-1', 1],
      ['ch-2', 3],
    ]));
    expect(numbers).toEqual([1, 3]);
  });
});
