import { describe, expect, it } from 'vitest';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import { mapDirectoryEntryToDigitalContact } from './mapDirectoryEntryToDigitalContact.ts';

describe('mapDirectoryEntryToDigitalContact', () => {
  it('assigns a new UUID and copies metadata fields', () => {
    const entry: DigitalIdDirectoryEntry = {
      projectId: 'proj',
      digitalId: 42,
      mode: 'dmr',
      name: 'Ada Lovelace',
      callsign: 'M0ABC',
      city: 'London',
      state: '',
      country: 'United Kingdom',
    };
    const contact = mapDirectoryEntryToDigitalContact(entry);
    expect(contact.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(contact.projectId).toBe('proj');
    expect(contact.digitalId).toBe(42);
    expect(contact.mode).toBe('dmr');
    expect(contact.name).toBe('Ada Lovelace');
    expect(contact.callsign).toBe('M0ABC');
    expect(contact.city).toBe('London');
    expect(contact.country).toBe('United Kingdom');
    expect(contact.remarks).toBe('');
  });
});
