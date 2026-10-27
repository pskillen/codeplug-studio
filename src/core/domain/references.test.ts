import { describe, expect, it } from 'vitest';
import {
  emptyLibrary,
  newChannel,
  newDigitalContact,
  newRxGroupList,
  newTalkGroup,
  newZone,
} from './factories.ts';
import { findDanglingReferences, findReferencesTo, isReferenced } from './references.ts';
import type { ChannelModeProfileDMR, ChannelModeProfileNxdn, Library } from '../models/library.ts';

const projectId = 'p1';

describe('findReferencesTo', () => {
  it('finds zones that reference a channel', () => {
    const channel = newChannel(projectId, 'Local');
    const zone = {
      ...newZone(projectId, 'Home'),
      members: [{ kind: 'channel' as const, channelId: channel.id }],
    };
    const library: Library = { ...emptyLibrary(), channels: [channel], zones: [zone] };

    const refs = findReferencesTo(library, { kind: 'channel' as const, id: channel.id });
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ fromKind: 'zone', fromName: 'Home' });
    expect(isReferenced(library, { kind: 'channel' as const, id: channel.id })).toBe(true);
  });

  it('finds RX group lists that reference a talk group', () => {
    const tg = newTalkGroup(projectId, 'World', 91);
    const list = {
      ...newRxGroupList(projectId, 'Wide area'),
      members: [{ ref: { kind: 'talkGroup' as const, id: tg.id } }],
    };
    const library: Library = { ...emptyLibrary(), talkGroups: [tg], rxGroupLists: [list] };

    const refs = findReferencesTo(library, { kind: 'talkGroup', id: tg.id });
    expect(refs).toHaveLength(1);
    expect(refs[0]?.fromKind).toBe('rxGroupList');
  });

  it('finds channels that reference an RX group list via their DMR profile', () => {
    const list = newRxGroupList(projectId, 'Wide area');
    const dmrProfile: ChannelModeProfileDMR = {
      mode: 'dmr',
      colourCode: 1,
      timeslot: 1,
      ownDigitalIdId: null,
      contactRef: null,
      rxGroupListId: list.id,
    };
    const channel = { ...newChannel(projectId, 'DMR ch'), modeProfiles: [dmrProfile] };
    const library: Library = { ...emptyLibrary(), channels: [channel], rxGroupLists: [list] };

    const refs = findReferencesTo(library, { kind: 'rxGroupList', id: list.id });
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ fromKind: 'channel', relationship: 'channel RX group list' });
  });

  it('finds channels that reference a talk group via NXDN profile', () => {
    const tg = newTalkGroup(projectId, 'World', 91);
    const nxdnProfile: ChannelModeProfileNxdn = {
      mode: 'nxdn',
      rxRan: null,
      txRan: null,
      ownDigitalIdId: null,
      contactRef: { kind: 'talkGroup', id: tg.id },
    };
    const channel = { ...newChannel(projectId, 'NXDN ch'), modeProfiles: [nxdnProfile] };
    const library: Library = { ...emptyLibrary(), channels: [channel], talkGroups: [tg] };

    const refs = findReferencesTo(library, { kind: 'talkGroup', id: tg.id });
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      fromKind: 'channel',
      relationship: 'channel NXDN call',
    });
  });

  it('finds an NXDN profile that calls a digital contact and names an RX group list', () => {
    const contact = newDigitalContact(projectId, 'Bob', 12, 'nxdn');
    const list = newRxGroupList(projectId, 'NX list');
    const profile: ChannelModeProfileNxdn = {
      mode: 'nxdn',
      rxRan: null,
      txRan: null,
      ownDigitalIdId: null,
      contactRef: { kind: 'digitalContact', id: contact.id },
      rxGroupListId: list.id,
    };
    const channel = { ...newChannel(projectId, 'NXDN ch'), modeProfiles: [profile] };
    const library: Library = {
      ...emptyLibrary(),
      channels: [channel],
      digitalContacts: [contact],
      rxGroupLists: [list],
    };
    expect(findReferencesTo(library, { kind: 'digitalContact', id: contact.id })).toEqual([
      expect.objectContaining({ fromId: channel.id, relationship: 'channel NXDN call' }),
    ]);
    expect(findReferencesTo(library, { kind: 'rxGroupList', id: list.id })).toEqual([
      expect.objectContaining({ fromId: channel.id, relationship: 'channel NXDN RX group list' }),
    ]);
  });

  it('reports a dangling NXDN call and RX group list', () => {
    const profile: ChannelModeProfileNxdn = {
      mode: 'nxdn',
      rxRan: null,
      txRan: null,
      ownDigitalIdId: null,
      contactRef: { kind: 'digitalContact', id: 'gone-contact' },
      rxGroupListId: 'gone-list',
    };
    const channel = { ...newChannel(projectId, 'NXDN ch'), modeProfiles: [profile] };
    const library: Library = { ...emptyLibrary(), channels: [channel] };
    expect(findDanglingReferences(library).map((d) => d.relationship)).toEqual([
      'channel NXDN call',
      'channel NXDN RX group list',
    ]);
  });

  it('finds zones that nest another zone', () => {
    const inner = newZone(projectId, 'Inner');
    const outer = {
      ...newZone(projectId, 'Outer'),
      members: [{ kind: 'zone' as const, zoneId: inner.id }],
    };
    const library: Library = { ...emptyLibrary(), zones: [inner, outer] };

    const refs = findReferencesTo(library, { kind: 'zone', id: inner.id });
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ fromName: 'Outer', relationship: 'nested zone member' });
  });

  it('returns empty when nothing references the target', () => {
    const tg = newTalkGroup(projectId, 'Orphan', 1);
    const library: Library = { ...emptyLibrary(), talkGroups: [tg] };
    expect(findReferencesTo(library, { kind: 'talkGroup', id: tg.id })).toEqual([]);
    expect(isReferenced(library, { kind: 'talkGroup', id: tg.id })).toBe(false);
  });
});

describe('Digital ID references', () => {
  const own = (id: string, protocol: 'dmr' | 'nxdn', isDefault = false) => ({
    id,
    projectId,
    revision: 1,
    updatedAt: '',
    name: '',
    protocol,
    number: 1234,
    isDefault,
  });
  const dmr = (ownDigitalIdId: string | null): ChannelModeProfileDMR => ({
    mode: 'dmr',
    colourCode: 1,
    timeslot: 1,
    ownDigitalIdId,
    contactRef: null,
    rxGroupListId: null,
  });

  it('a channel that chooses an ID references it, so the ID cannot be deleted', () => {
    const channel = { ...newChannel(projectId, 'Chan'), modeProfiles: [dmr('d1')] };
    const library: Library = {
      ...emptyLibrary(),
      channels: [channel],
      ownDigitalIds: [own('d1', 'dmr')],
    };
    const refs = findReferencesTo(library, { kind: 'ownDigitalId', id: 'd1' });
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ fromKind: 'channel', relationship: 'channel DMR ID' });
  });

  it('being the default is not a reference', () => {
    const channel = { ...newChannel(projectId, 'Chan'), modeProfiles: [dmr(null)] };
    const library: Library = {
      ...emptyLibrary(),
      channels: [channel],
      ownDigitalIds: [own('d1', 'dmr', true)],
    };
    expect(findReferencesTo(library, { kind: 'ownDigitalId', id: 'd1' })).toEqual([]);
  });

  it('reports a channel that names a missing or wrong-protocol ID as dangling', () => {
    const channel = {
      ...newChannel(projectId, 'Chan'),
      modeProfiles: [dmr('gone'), dmr('n1')],
    };
    const library: Library = {
      ...emptyLibrary(),
      channels: [channel],
      ownDigitalIds: [own('n1', 'nxdn')],
    };
    expect(findDanglingReferences(library).map((d) => d.relationship)).toEqual([
      'channel DMR ID',
      'channel DMR ID',
    ]);
  });
});
