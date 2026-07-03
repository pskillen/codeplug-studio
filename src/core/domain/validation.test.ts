import { describe, expect, it } from 'vitest';
import { assertNonEmptyName, validateEntityRef } from './validation.ts';
import { emptyLibrary, newChannel, newDigitalContact, newTalkGroup, newZone } from './factories.ts';

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
      zones: [{ ...zone, members: [{ channelId: channel.id }] }],
    };
    validateEntityRef({ kind: 'channel', id: channel.id }, library);
  });

  it('creates channel with defaults', () => {
    const ch = newChannel('p1', 'Local', 'GB3DA');
    expect(ch.callsign).toBe('GB3DA');
    expect(ch.revision).toBe(1);
  });
});
