import { describe, expect, it } from 'vitest';
import { newDigitalContact } from '@core/domain/factories.ts';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import { prepareCopyDirectoryEntryToLibrary } from './copyDirectoryEntryToLibrary.ts';

const entry: DigitalIdDirectoryEntry = {
  projectId: 'p1',
  digitalId: 3109478,
  mode: 'dmr',
  name: 'Hiram Percy Maxim',
  callsign: 'W1AW',
  city: 'Newington',
  state: 'CT',
  country: 'United States',
  remarks: 'Club station',
};

describe('prepareCopyDirectoryEntryToLibrary', () => {
  it('maps directory fields to a new library contact', () => {
    const result = prepareCopyDirectoryEntryToLibrary(entry, []);
    expect(result.kind).toBe('success');
    if (result.kind !== 'success') return;
    expect(result.contact.projectId).toBe('p1');
    expect(result.contact.digitalId).toBe(3109478);
    expect(result.contact.name).toBe('Hiram Percy Maxim');
    expect(result.contact.callsign).toBe('W1AW');
    expect(result.contact.city).toBe('Newington');
    expect(result.contact.state).toBe('CT');
    expect(result.contact.country).toBe('United States');
    expect(result.contact.remarks).toBe('Club station');
    expect(result.contact.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('blocks copy when library already has the digitalId', () => {
    const existing = {
      ...newDigitalContact('p1', 'Existing', entry.digitalId, 'dmr'),
      id: 'dc-existing',
    };
    const result = prepareCopyDirectoryEntryToLibrary(entry, [existing]);
    expect(result).toEqual({ kind: 'duplicate', existingContactId: 'dc-existing' });
  });
});
