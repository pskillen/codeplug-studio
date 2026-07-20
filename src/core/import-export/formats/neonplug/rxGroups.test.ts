import { describe, expect, it } from 'vitest';
import { newChannel, newRxGroupList, newTalkGroup } from '@core/domain/factories.ts';
import type { Channel, RxGroupList, TalkGroup } from '@core/models/library.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { NEONPLUG_DM32UV_PROFILE } from './profiles.ts';
import { serialiseNeonplugRxGroups } from './rxGroups.ts';
import { serialiseNeonplugCodeplug } from './serialise.ts';

const projectId = '11111111-1111-4111-8111-111111111111';

describe('neonplug/rxGroups', () => {
  it('emits talkGroupIndices as DMR IDs and wires channel rxGroupListId', () => {
    const tg1: TalkGroup = { ...newTalkGroup(projectId, 'Local', 9), id: 'tg-1' };
    const tg2: TalkGroup = { ...newTalkGroup(projectId, 'UK', 2350), id: 'tg-2' };
    const rx: RxGroupList = {
      ...newRxGroupList(projectId, 'Main RX'),
      id: 'rx-1',
      members: [
        { ref: { kind: 'talkGroup', id: 'tg-1' } },
        { ref: { kind: 'talkGroup', id: 'tg-2' } },
      ],
    };
    const ch: Channel = {
      ...newChannel(projectId, 'DMR1'),
      id: 'ch-1',
      rxFrequency: 430_450_000,
      txFrequency: 430_450_000,
      modeProfiles: [
        {
          mode: 'dmr',
          colourCode: 1,
          timeslot: 1,
          dmrId: null,
          contactRef: { kind: 'talkGroup', id: 'tg-1' },
          rxGroupListId: 'rx-1',
        },
      ],
    };

    const assembled: AssembledBuild = {
      buildId: 'b1',
      formatId: 'neonplug',
      profileId: 'neonplug-dm32uv',
      buildName: 'DM32 Neon',
      channels: [{ entity: ch, wireName: 'DMR1' }],
      zones: [],
      talkGroups: [
        { entity: tg1, wireName: 'Local' },
        { entity: tg2, wireName: 'UK' },
      ],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [{ entity: rx, wireName: 'Main RX' }],
      scanLists: [],
    };

    const warnings: string[] = [];
    const { rxGroups, rxGroupIndexById } = serialiseNeonplugRxGroups(
      assembled,
      NEONPLUG_DM32UV_PROFILE,
      { shortenNames: false },
      warnings,
    );

    expect(warnings).toEqual([]);
    expect(rxGroups).toEqual([
      {
        index: 0,
        name: 'Main RX',
        bitmask: 0,
        statusFlag: 0,
        entryFlag: 1,
        validationFlag: 0,
        talkGroupIndices: [9, 2350],
      },
    ]);
    expect(rxGroupIndexById.get('rx-1')).toBe(1);

    const { data } = serialiseNeonplugCodeplug(assembled, {
      exportDate: '2026-07-20T12:00:00.000Z',
      shortenNames: false,
    });
    expect(data.rxGroups).toHaveLength(1);
    expect(data.channels[0]?.rxGroupListId).toBe(1);
    expect(data.channels[0]?.contactId).toBe(1);
  });
});
