import { describe, expect, it } from 'vitest';
import {
  newDigitalContact,
  newOwnDigitalId,
  newRadioBuildForProfile,
} from '@core/domain/factories.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/inMemory.ts';
import { DMR_ID_DATABASE_ADDRESS } from '@integrations/radio-io/radios/dm32uv-radiofoundry/idDatabase.ts';
import { prepareRadioWriteImage } from './radioIoSession.ts';

const FALLBACK = 'Digital contacts will be written from the chosen source.';
/** Contact table in the open-firmware image. */
const CONTACT_BASE = 0xa7620;

function library(contacts: LibrarySlice['digitalContacts'] = []): LibrarySlice {
  return {
    channels: [],
    zones: [],
    scanLists: [],
    talkGroups: [],
    digitalContacts: contacts,
    analogContacts: [],
    rxGroupLists: [],
    ownDigitalIds: [{ ...newOwnDigitalId('p1', 'dmr', 'MM9PDY', 2_351_234), isDefault: true }],
    aprsConfiguration: null,
  };
}

function reviewNote(contacts: readonly unknown[] | undefined, partOn: boolean): string | null {
  if (!partOn) return null;
  return contacts ? `${contacts.length} digital contacts will be written.` : FALLBACK;
}

describe('prepareRadioWriteImage RadioFoundry contacts (#1495)', () => {
  it('counts library contacts and does not use the empty-source fallback', async () => {
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-dm32uv-radiofoundry');
    const contact = { ...newDigitalContact('p1', 'Alice', 1001, 'dmr'), id: 'dc-1' };
    const prepared = await prepareRadioWriteImage(build, egress, library([contact]), {
      dualBank: {
        mode: 'codeplug',
        options: { includeLibraryContacts: true, includeDigitalIdDirectory: false },
      },
    });
    expect(prepared.organisation.digitalContacts).toEqual([
      expect.objectContaining({ digitalId: 1001, wireName: 'Alice' }),
    ]);
    expect(reviewNote(prepared.organisation.digitalContacts, true)).toBe(
      '1 digital contacts will be written.',
    );
    expect(prepared.radioFoundryWrite?.owned[CONTACT_BASE]).toBe(1);
    expect(prepared.radioFoundryWrite?.owned[DMR_ID_DATABASE_ADDRESS]).toBe(0);

    const none = await prepareRadioWriteImage(build, egress, library(), {
      dualBank: {
        mode: 'codeplug',
        options: { includeLibraryContacts: true, includeDigitalIdDirectory: false },
      },
    });
    expect(none.organisation.digitalContacts).toEqual([]);
    expect(reviewNote(none.organisation.digitalContacts, true)).not.toBe(FALLBACK);
    expect(reviewNote(none.organisation.digitalContacts, true)).toBe(
      '0 digital contacts will be written.',
    );
  });

  it('leaves the contact table and the ID database unowned when Digital contacts is off', async () => {
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-dm32uv-radiofoundry');
    const contact = { ...newDigitalContact('p1', 'Alice', 1001, 'dmr'), id: 'dc-1' };
    const prepared = await prepareRadioWriteImage(build, egress, library([contact]), {
      dualBank: {
        mode: 'codeplug',
        options: { includeLibraryContacts: false, includeDigitalIdDirectory: false },
      },
    });
    expect(prepared.organisation.digitalContacts).toBeUndefined();
    expect(prepared.radioFoundryWrite?.owned[CONTACT_BASE]).toBe(0);
    expect(prepared.radioFoundryWrite?.bytes[CONTACT_BASE]).toBe('A'.charCodeAt(0));
    expect(prepared.radioFoundryWrite?.owned[DMR_ID_DATABASE_ADDRESS]).toBe(0);
  });

  it('owns the DMR ID database when the directory source has a row', async () => {
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-dm32uv-radiofoundry');
    const store = new InMemoryProjectPersistence();
    await store.putDigitalIdDirectoryEntriesBatch([
      {
        projectId: 'p1',
        digitalId: 123456,
        mode: 'dmr',
        name: 'Ada',
        callsign: 'M7ABC',
        city: '',
        state: '',
        country: '',
      },
    ]);
    const prepared = await prepareRadioWriteImage(build, egress, library(), {
      dualBank: {
        mode: 'codeplug',
        options: { includeLibraryContacts: false, includeDigitalIdDirectory: true },
      },
      persistence: store,
      projectId: 'p1',
    });
    expect(prepared.radioFoundryWrite?.owned[DMR_ID_DATABASE_ADDRESS]).toBe(1);
    expect(prepared.radioFoundryWrite?.bytes[DMR_ID_DATABASE_ADDRESS]).toBe(0x49);
    expect(prepared.radioFoundryWrite?.bytes[DMR_ID_DATABASE_ADDRESS + 2]).toBe(0x4e);
    expect(prepared.organisation.digitalContacts).toHaveLength(1);
    expect(reviewNote(prepared.organisation.digitalContacts, true)).toBe(
      '1 digital contacts will be written.',
    );
  });
});
