import { describe, expect, it } from 'vitest';
import { newChannel, newDigitalContact, newTalkGroup } from '@core/domain/factories.ts';
import type { Channel, DigitalContact, TalkGroup } from '@core/models/library.ts';
import type { EntityRef } from '@core/models/libraryTypes.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { serialiseNeonplugContacts } from './contacts.ts';
import { NEONPLUG_DM32UV_PROFILE } from './profiles.ts';
import { serialiseNeonplugCodeplug } from './serialise.ts';

const projectId = '11111111-1111-4111-8111-111111111111';

function dmrChannel(id: string, name: string, contactRef: EntityRef | null): Channel {
  return {
    ...newChannel(projectId, name),
    id,
    rxFrequency: 430_450_000,
    txFrequency: 430_450_000,
    modeProfiles: [
      {
        mode: 'dmr',
        colourCode: 1,
        timeslot: 1,
        dmrId: null,
        contactRef,
        rxGroupListId: null,
      },
    ],
  };
}

describe('neonplug/contacts', () => {
  it('emits talk groups then digital contacts with sequential ids', () => {
    const tg: TalkGroup = { ...newTalkGroup(projectId, 'Local', 9), id: 'tg-1' };
    const dc: DigitalContact = {
      ...newDigitalContact(projectId, 'Alice', 1234567),
      id: 'dc-1',
      callsign: 'MM0ABC',
      city: 'Glasgow',
      state: 'Scotland',
      country: 'UK',
      remarks: 'Friend',
    };
    const assembled: AssembledBuild = {
      buildId: 'b1',
      formatId: 'neonplug',
      profileId: 'neonplug-dm32uv',
      buildName: 'DM32 Neon',
      channels: [],
      zones: [],
      talkGroups: [{ entity: tg, wireName: 'Local' }],
      digitalContacts: [{ entity: dc, wireName: 'Alice' }],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };

    const warnings: string[] = [];
    const { contacts, contactIdByEntityId } = serialiseNeonplugContacts(
      assembled,
      NEONPLUG_DM32UV_PROFILE,
      { shortenNames: false },
      warnings,
    );

    expect(warnings).toEqual([]);
    expect(contacts).toEqual([
      { id: 1, name: 'Local', dmrId: 9 },
      {
        id: 2,
        name: 'Alice',
        dmrId: 1234567,
        callSign: 'MM0ABC',
        city: 'Glasgow',
        province: 'Scotland',
        country: 'UK',
        remark: 'Friend',
      },
    ]);
    expect(contactIdByEntityId.get('tg-1')).toBe(1);
    expect(contactIdByEntityId.get('dc-1')).toBe(2);
  });

  it('wires channel contactId from talk-group contactRef', () => {
    const tg: TalkGroup = { ...newTalkGroup(projectId, 'Local', 9), id: 'tg-1' };
    const ch = dmrChannel('ch-1', 'TG9', { kind: 'talkGroup', id: 'tg-1' });
    const assembled: AssembledBuild = {
      buildId: 'b1',
      formatId: 'neonplug',
      profileId: 'neonplug-dm32uv',
      buildName: 'DM32 Neon',
      channels: [{ entity: ch, wireName: 'TG9' }],
      zones: [],
      talkGroups: [{ entity: tg, wireName: 'Local' }],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };

    const { data } = serialiseNeonplugCodeplug(assembled, {
      exportDate: '2026-07-20T12:00:00.000Z',
      shortenNames: false,
    });

    expect(data.contacts).toHaveLength(1);
    expect(data.channels[0]?.contactId).toBe(1);
  });
});
