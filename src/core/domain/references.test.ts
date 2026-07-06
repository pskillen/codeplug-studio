import { describe, expect, it } from 'vitest';
import { emptyLibrary, newChannel, newRxGroupList, newTalkGroup, newZone } from './factories.ts';
import { findReferencesTo, isReferenced } from './references.ts';
import type { ChannelModeProfileDMR, Library } from '../models/library.ts';

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
      dmrId: null,
      contactRef: null,
      rxGroupListId: list.id,
    };
    const channel = { ...newChannel(projectId, 'DMR ch'), modeProfiles: [dmrProfile] };
    const library: Library = { ...emptyLibrary(), channels: [channel], rxGroupLists: [list] };

    const refs = findReferencesTo(library, { kind: 'rxGroupList', id: list.id });
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ fromKind: 'channel', relationship: 'channel RX group list' });
  });

  it('returns empty when nothing references the target', () => {
    const tg = newTalkGroup(projectId, 'Orphan', 1);
    const library: Library = { ...emptyLibrary(), talkGroups: [tg] };
    expect(findReferencesTo(library, { kind: 'talkGroup', id: tg.id })).toEqual([]);
    expect(isReferenced(library, { kind: 'talkGroup', id: tg.id })).toBe(false);
  });
});
