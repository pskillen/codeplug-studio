/**
 * AT-D890UV dual-bank contacts (#1433): library contacts in the Contacts list (talk-group list)
 * as private entries, and the ID database filled from the Contacts part source.
 */

import { describe, expect, it } from 'vitest';
import {
  newChannel,
  newDigitalContact,
  newRadioBuildForProfile,
  newRxGroupList,
  newTalkGroup,
} from '@core/domain/factories.ts';
import { dualBankOptionsFromWriteSource } from '@core/domain/digitalIdDirectoryProjection.ts';
import { formatExportWarning } from '@core/import-export/exportWarning.ts';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import { assemble, type LibrarySlice } from '@core/services/assemble.ts';
import type { Channel } from '@core/models/library.ts';
import type { RadioDigitalContactDto } from '@integrations/radio-io/radioWriteProjection.ts';
import { buildRadioWriteProjection } from './radioIoWriteProjection.ts';

const P = 'p1';

function emptyLibrary(): LibrarySlice {
  return {
    channels: [],
    zones: [],
    scanLists: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    aprsConfiguration: null,
  };
}

function dmrChannel(id: string, name: string, contactId: string): Channel {
  return {
    ...newChannel(P, name),
    id,
    rxFrequency: 439_500_000,
    txFrequency: 430_500_000,
    power: 100,
    modeProfiles: [
      {
        mode: 'dmr' as const,
        dmrMode: null,
        colourCode: 1,
        timeslot: 2,
        dmrId: null,
        contactRef: { kind: 'digitalContact' as const, id: contactId },
        rxGroupListId: null,
      },
    ],
  };
}

const tgA = { ...newTalkGroup(P, 'Local', 9), id: 'tg-a' };
const tgB = { ...newTalkGroup(P, 'Scotland', 950), id: 'tg-b' };
const dcA = {
  ...newDigitalContact(P, 'Alice', 2_351_234),
  id: 'dc-a',
  callsign: 'MM0AAA',
  city: 'Glasgow',
  state: 'Scotland',
  country: 'United Kingdom',
  remarks: 'Club',
};
const dcB = { ...newDigitalContact(P, 'Bob', 2_351_999), id: 'dc-b', callsign: 'MM0BBB' };

function project(
  library: LibrarySlice,
  profileId: 'radio-io-at-d890uv' | 'radio-io-at-d890uv-mm9pdy' = 'radio-io-at-d890uv',
  context?: Parameters<typeof buildRadioWriteProjection>[4],
) {
  const { build, egress } = newRadioBuildForProfile(P, profileId);
  const assembled = assemble(build, library, {
    formatId: egress.formatId,
    profileId: egress.profileId,
  });
  return buildRadioWriteProjection(assembled, build, library, egress, context);
}

function warningTexts(projection: ReturnType<typeof project>): string[] {
  return projection.warnings.map(formatExportWarning);
}

describe('AT-D890 Contacts list carries library contacts as private entries', () => {
  it('places talk groups first (group) then contacts (private) with extras copied', () => {
    const library = { ...emptyLibrary(), talkGroups: [tgA, tgB], digitalContacts: [dcA, dcB] };
    const tgs = project(library).organisation.talkGroups ?? [];
    expect(tgs.map((t) => [t.index, t.digitalId, t.callType])).toEqual([
      [1, 9, 0x04],
      [2, 950, 0x04],
      [3, 2_351_234, 0x03],
      [4, 2_351_999, 0x03],
    ]);
    expect(tgs[2]).toMatchObject({
      callsign: 'MM0AAA',
      city: 'Glasgow',
      province: 'Scotland',
      country: 'United Kingdom',
      remark: 'Club',
    });
  });

  for (const profileId of ['radio-io-at-d890uv', 'radio-io-at-d890uv-mm9pdy'] as const) {
    it(`resolves a channel TX contact to the contact's Contacts-list index (${profileId})`, () => {
      const library = {
        ...emptyLibrary(),
        channels: [dmrChannel('ch-1', 'Alice PC', dcB.id)],
        talkGroups: [tgA],
        digitalContacts: [dcA, dcB],
      };
      const projection = project(library, profileId);
      const bob = projection.organisation.talkGroups?.find((t) => t.digitalId === dcB.digitalId);
      expect(bob?.callType).toBe(0x03);
      const digital = projection.channels.filter((c) => !c.empty && c.mode !== 'analog');
      expect(digital.length).toBeGreaterThan(0);
      expect(digital.every((c) => c.txContactId === bob?.index)).toBe(true);
    });
  }

  it('maps RX group contact members to 0-based slots on stock', () => {
    const rx = {
      ...newRxGroupList(P, 'Mixed'),
      id: 'rx-1',
      members: [
        { ref: { kind: 'talkGroup' as const, id: tgA.id } },
        { ref: { kind: 'digitalContact' as const, id: dcA.id } },
      ],
    };
    const library = {
      ...emptyLibrary(),
      talkGroups: [tgA],
      digitalContacts: [dcA],
      rxGroupLists: [rx],
    };
    expect(project(library).organisation.rxGroups?.[0]?.memberDigitalIds).toEqual([0, 1]);
  });

  it('gives RX group contact members no timeslot override on MM9PDY', () => {
    const rx = {
      ...newRxGroupList(P, 'Mixed'),
      id: 'rx-1',
      members: [
        { ref: { kind: 'talkGroup' as const, id: tgA.id }, timeSlotOverride: 2 as const },
        { ref: { kind: 'digitalContact' as const, id: dcA.id } },
      ],
    };
    const library = {
      ...emptyLibrary(),
      talkGroups: [tgA],
      digitalContacts: [dcA],
      rxGroupLists: [rx],
    };
    const group = project(library, 'radio-io-at-d890uv-mm9pdy').organisation.rxGroups?.[0];
    expect(group?.memberDigitalIds).toEqual([0, 1]);
    expect(group?.memberTimeSlotOverrides).toEqual([2, undefined]);
  });

  it('skips a contact with DMR ID 0 without leaving an index gap', () => {
    const zero = { ...newDigitalContact(P, 'Nobody', 0), id: 'dc-0' };
    const library = { ...emptyLibrary(), talkGroups: [tgA], digitalContacts: [zero, dcA] };
    const tgs = project(library).organisation.talkGroups ?? [];
    expect(tgs.map((t) => t.index)).toEqual([1, 2]);
    expect(tgs[1]?.digitalId).toBe(2_351_234);
  });

  it('drops contacts past the shared cap, warns, and leaves their channels without a TX contact', () => {
    const many = Array.from({ length: AT_D890UV_LIMITS.TALK_GROUPS_MAX }, (_, i) => ({
      ...tgA,
      id: `tg-${i}`,
      name: `TG ${i}`,
      digitalId: 100 + i,
    }));
    const library = {
      ...emptyLibrary(),
      channels: [dmrChannel('ch-1', 'Alice PC', dcA.id)],
      talkGroups: many,
      digitalContacts: [dcA],
    };
    const projection = project(library);
    const tgs = projection.organisation.talkGroups ?? [];
    expect(tgs).toHaveLength(AT_D890UV_LIMITS.TALK_GROUPS_MAX);
    expect(tgs.every((t) => t.callType === 0x04)).toBe(true);
    const digital = projection.channels.filter((c) => !c.empty && c.mode !== 'analog');
    expect(digital.length).toBeGreaterThan(0);
    expect(digital.every((c) => c.txContactId === undefined)).toBe(true);
    const texts = warningTexts(projection);
    expect(texts.some((t) => t.includes("The radio's Contacts list holds 10000 entries"))).toBe(
      true,
    );
    expect(
      texts.some((t) =>
        t.includes("1 channel(s) call a contact that is not in the radio's Contacts list"),
      ),
    ).toBe(true);
  }, 30_000);
});

describe('AT-D890 ID database follows the Contacts part source', () => {
  const directoryRow: RadioDigitalContactDto = {
    wireName: 'Dir Carol',
    digitalId: 2_350_001,
    callsign: 'GM0CCC',
    city: '',
    province: '',
    country: '',
    remark: '',
  };
  const overlapRow: RadioDigitalContactDto = {
    ...directoryRow,
    wireName: 'Dir Alice',
    digitalId: 2_351_234,
  };
  const library = { ...emptyLibrary(), talkGroups: [tgA], digitalContacts: [dcA] };

  function withSource(
    source: 'none' | 'library' | 'directory' | 'both',
    directory: RadioDigitalContactDto[] = [directoryRow],
  ) {
    return project(library, 'radio-io-at-d890uv', {
      dualBank: {
        mode: 'codeplug',
        options: dualBankOptionsFromWriteSource(source),
        directorySlice: { radioIds: [], digitalContacts: directory },
      },
    });
  }

  it('leaves the ID database alone with no dual-bank context', () => {
    expect(project(library).organisation.digitalContacts).toBeUndefined();
  });

  it('leaves the ID database alone when the Contacts part is unticked', () => {
    const projection = withSource('none');
    expect(projection.organisation.digitalContacts).toBeUndefined();
    // Contacts still ride with the codeplug.
    expect(projection.organisation.talkGroups?.map((t) => t.callType)).toEqual([0x04, 0x03]);
  });

  it('writes the library contacts with the same wire name as the Contacts list', () => {
    const projection = withSource('library');
    const db = projection.organisation.digitalContacts ?? [];
    expect(db.map((d) => d.digitalId)).toEqual([2_351_234]);
    expect(db[0]?.wireName).toBe(projection.organisation.talkGroups?.[1]?.wireName);
  });

  it('writes only the directory slice for ID directory', () => {
    const db = withSource('directory').organisation.digitalContacts ?? [];
    expect(db.map((d) => d.wireName)).toEqual(['Dir Carol']);
  });

  it('writes library plus non-overlapping directory rows for Both, with the overlap warning', () => {
    const projection = withSource('both', [overlapRow, directoryRow]);
    const db = projection.organisation.digitalContacts ?? [];
    expect(db.map((d) => d.wireName)).toEqual([
      projection.organisation.talkGroups?.[1]?.wireName,
      'Dir Carol',
    ]);
    expect(
      warningTexts(projection).some((t) =>
        t.includes(
          'Skipped 1 directory row(s) whose DMR ID already exists on a library digital contact',
        ),
      ),
    ).toBe(true);
  });
});
