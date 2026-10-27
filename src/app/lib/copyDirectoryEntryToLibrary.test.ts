import { describe, expect, it, vi } from 'vitest';
import { newDigitalContact } from '@core/domain/factories.ts';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import {
  addDirectoryEntryToContacts,
  prepareCopyDirectoryEntryToLibrary,
} from './copyDirectoryEntryToLibrary.ts';

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

describe('addDirectoryEntryToContacts', () => {
  it('persists a new contact and returns its id', async () => {
    const put = vi.fn().mockResolvedValue({ ok: true });
    const result = await addDirectoryEntryToContacts(entry, [], put);
    expect(result.kind).toBe('added');
    if (result.kind !== 'added') return;
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][0].id).toBe(result.contactId);
    expect(put.mock.calls[0][1]).toBeNull();
  });

  it('does not persist when the digitalId is already a contact', async () => {
    const existing = {
      ...newDigitalContact('p1', 'Existing', entry.digitalId, 'dmr'),
      id: 'dc-existing',
    };
    const put = vi.fn();
    const result = await addDirectoryEntryToContacts(entry, [existing], put);
    expect(result).toEqual({ kind: 'duplicate', existingContactId: 'dc-existing' });
    expect(put).not.toHaveBeenCalled();
  });

  it('reports an error when the save is rejected or throws', async () => {
    expect(
      await addDirectoryEntryToContacts(entry, [], vi.fn().mockResolvedValue({ ok: false })),
    ).toEqual({ kind: 'error' });
    expect(
      await addDirectoryEntryToContacts(entry, [], vi.fn().mockRejectedValue(new Error('x'))),
    ).toEqual({ kind: 'error' });
  });
});
