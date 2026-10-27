import { describe, expect, it } from 'vitest';
import {
  assertNonEmptyName,
  rxGroupListModes,
  validateDigitalIdForMode,
  validateEntityRef,
} from './validation.ts';
import {
  emptyLibrary,
  newChannel,
  newDigitalContact,
  newRxGroupList,
  newTalkGroup,
  newZone,
} from './factories.ts';

describe('validation', () => {
  it('rejects empty names', () => {
    expect(() => assertNonEmptyName('  ', 'name')).toThrow(/must not be empty/);
  });

  it('validates entity refs against library', () => {
    const projectId = 'proj-1';
    const tg = newTalkGroup(projectId, 'World', 91);
    const library = {
      ...emptyLibrary(),
      talkGroups: [tg],
    };
    validateEntityRef({ kind: 'talkGroup', id: tg.id }, library);
    expect(() => validateEntityRef({ kind: 'talkGroup', id: 'missing' }, library)).toThrow(
      /not found/,
    );
  });

  it('validates digital contact refs', () => {
    const projectId = 'proj-1';
    const contact = newDigitalContact(projectId, 'Alice', 1234567);
    const library = { ...emptyLibrary(), digitalContacts: [contact] };
    validateEntityRef({ kind: 'digitalContact', id: contact.id }, library);
  });

  it('validates zone channel member refs', () => {
    const projectId = 'proj-1';
    const channel = newChannel(projectId, 'Local');
    const zone = newZone(projectId, 'Home');
    const library = {
      ...emptyLibrary(),
      channels: [channel],
      zones: [{ ...zone, members: [{ kind: 'channel' as const, channelId: channel.id }] }],
    };
    validateEntityRef({ kind: 'channel' as const, id: channel.id }, library);
  });

  it('creates channel with defaults', () => {
    const ch = newChannel('p1', 'Local', 'GB3DA');
    expect(ch.callsign).toBe('GB3DA');
    expect(ch.revision).toBe(1);
  });
});

describe('validateDigitalIdForMode', () => {
  it('limits NXDN IDs to 1-65519', () => {
    expect(validateDigitalIdForMode('nxdn', 0)).toBe('NXDN IDs are 1–65519');
    expect(validateDigitalIdForMode('nxdn', 65520)).toBe('NXDN IDs are 1–65519');
    expect(validateDigitalIdForMode('nxdn', 1)).toBeNull();
    expect(validateDigitalIdForMode('nxdn', 65519)).toBeNull();
  });

  it('leaves other modes unchecked', () => {
    expect(validateDigitalIdForMode('dmr', 0)).toBeNull();
    expect(validateDigitalIdForMode('dmr', 16777215)).toBeNull();
  });
});

describe('rxGroupListModes', () => {
  it('collects the modes of the members, skipping dangling ones', () => {
    const dmrTg = newTalkGroup('p', 'World', 91, 'dmr');
    const nxdnTg = newTalkGroup('p', 'NX', 10, 'nxdn');
    const nxdnContact = newDigitalContact('p', 'Bob', 12, 'nxdn');
    const library = {
      ...emptyLibrary(),
      talkGroups: [dmrTg, nxdnTg],
      digitalContacts: [nxdnContact],
    };
    const list = {
      ...newRxGroupList('p', 'Mixed'),
      members: [
        { ref: { kind: 'talkGroup' as const, id: dmrTg.id } },
        { ref: { kind: 'talkGroup' as const, id: nxdnTg.id } },
        { ref: { kind: 'digitalContact' as const, id: nxdnContact.id } },
        { ref: { kind: 'talkGroup' as const, id: 'gone' } },
      ],
    };
    expect([...rxGroupListModes(list, library)].sort()).toEqual(['dmr', 'nxdn']);
    expect([...rxGroupListModes({ ...list, members: [list.members[1]] }, library)]).toEqual([
      'nxdn',
    ]);
    expect(rxGroupListModes(newRxGroupList('p', 'Empty'), library).size).toBe(0);
  });
});
