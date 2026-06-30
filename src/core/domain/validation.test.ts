import { describe, expect, it } from 'vitest';
import { assertNonEmptyName, validateEntityRef } from './validation.ts';
import { newChannel, newContact, newTalkGroup } from './factories.ts';
import { emptyLibrary } from './factories.ts';

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

  it('validates contact refs', () => {
    const projectId = 'proj-1';
    const contact = newContact(projectId, 'Alice', 1234567);
    const library = { ...emptyLibrary(), contacts: [contact] };
    validateEntityRef({ kind: 'contact', id: contact.id }, library);
  });

  it('creates channel with defaults', () => {
    const ch = newChannel('p1', 'Local', 'GB3DA');
    expect(ch.callsign).toBe('GB3DA');
    expect(ch.mode).toBe('fm');
    expect(ch.revision).toBe(1);
  });
});
