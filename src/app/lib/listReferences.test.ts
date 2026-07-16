import { describe, expect, it } from 'vitest';
import type {
  Channel,
  ChannelModeProfileDMR,
  ChannelModeProfileNxdn,
  Library,
} from '@core/models/library.ts';
import {
  emptyLibrary,
  newAnalogContact,
  newChannel,
  newDigitalContact,
  newRxGroupList,
  newTalkGroup,
  newZone,
} from '@core/domain/factories.ts';
import { findReferencesTo, type ReferenceTarget } from '@core/domain/references.ts';
import {
  buildReferenceCountIndex,
  referenceCount,
  referenceCountFromIndex,
} from './listReferences.ts';

const projectId = 'p1';

function expectIndexMatchesFindReferences(library: Library) {
  const index = buildReferenceCountIndex(library);
  const targets: ReferenceTarget[] = [];

  for (const channel of library.channels) {
    targets.push({ kind: 'channel', id: channel.id });
  }
  for (const zone of library.zones) {
    targets.push({ kind: 'zone', id: zone.id });
  }
  for (const tg of library.talkGroups) {
    targets.push({ kind: 'talkGroup', id: tg.id });
  }
  for (const contact of library.digitalContacts) {
    targets.push({ kind: 'digitalContact', id: contact.id });
  }
  for (const contact of library.analogContacts) {
    targets.push({ kind: 'analogContact', id: contact.id });
  }
  for (const list of library.rxGroupLists) {
    targets.push({ kind: 'rxGroupList', id: list.id });
  }
  for (const list of library.scanLists) {
    targets.push({ kind: 'scanList', id: list.id });
  }

  for (const target of targets) {
    expect(referenceCountFromIndex(index, target)).toBe(referenceCount(library, target));
  }
}

describe('buildReferenceCountIndex', () => {
  it('matches findReferencesTo for a mixed fixture library', () => {
    const digitalContact = newDigitalContact(projectId, 'Alice', 123);
    const analogContact = newAnalogContact(projectId, 'Bob', '23');
    const talkGroup = newTalkGroup(projectId, 'Local', 9);
    const rxList = {
      ...newRxGroupList(projectId, 'Wide'),
      members: [{ ref: { kind: 'talkGroup' as const, id: talkGroup.id } }],
    };
    const dmrProfile: ChannelModeProfileDMR = {
      mode: 'dmr',
      colourCode: 1,
      timeslot: 1,
      dmrId: null,
      contactRef: { kind: 'digitalContact', id: digitalContact.id },
      rxGroupListId: rxList.id,
    };
    const nxdnProfile: ChannelModeProfileNxdn = {
      mode: 'nxdn',
      rxRan: null,
      txRan: null,
      unitId: null,
      talkGroupRef: { kind: 'talkGroup', id: talkGroup.id },
    };
    const channel: Channel = {
      ...newChannel(projectId, 'DMR ch'),
      modeProfiles: [dmrProfile, nxdnProfile],
    };
    const zone = {
      ...newZone(projectId, 'Home'),
      members: [{ kind: 'channel' as const, channelId: channel.id }],
    };
    const library: Library = {
      ...emptyLibrary(),
      channels: [channel],
      zones: [zone],
      talkGroups: [talkGroup],
      digitalContacts: [digitalContact],
      analogContacts: [analogContact],
      rxGroupLists: [rxList],
    };

    expectIndexMatchesFindReferences(library);
    expect(
      findReferencesTo(library, { kind: 'digitalContact', id: digitalContact.id }),
    ).toHaveLength(1);
    expect(
      referenceCountFromIndex(buildReferenceCountIndex(library), {
        kind: 'digitalContact',
        id: digitalContact.id,
      }),
    ).toBe(1);
  });
});
