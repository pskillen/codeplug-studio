/**
 * Anytone CPS dual-bank contacts (#1433): library contacts as private rows in DMRTalkGroups.CSV
 * and DMRDigitalContactList.CSV (the ID database) by toggle.
 */

import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import {
  newChannel,
  newDigitalContact,
  newFormatBuild,
  newRxGroupList,
  newTalkGroup,
} from '@core/domain/factories.ts';
import { projectedRowToAssembledDigitalContact } from '@core/domain/cpsDigitalDirectoryProjection.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { assemble, type LibrarySlice } from '@core/services/assemble.ts';
import { csvToTable } from '@core/import-export/csvParse.ts';
import { formatExportWarning } from '@core/import-export/exportWarning.ts';
import { serialiseAnytoneFiles } from './serialise.ts';
import { collectAnytoneExportWarnings } from './warnings.ts';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

const tg = { ...newTalkGroup(PROJECT_ID, 'Scotland', 950), id: 'tg-1' };
const alice = { ...newDigitalContact(PROJECT_ID, 'Alice', 2_351_234), id: 'dc-1' };

function dmrChannel(): Channel {
  return {
    ...newChannel(PROJECT_ID, 'Alice PC'),
    id: 'ch-1',
    rxFrequency: 438_800_000,
    txFrequency: 434_000_000,
    power: 25,
    modeProfiles: [
      {
        mode: 'dmr' as const,
        colourCode: 1,
        timeslot: 2 as const,
        dmrId: 1234567,
        contactRef: { kind: 'digitalContact' as const, id: alice.id },
        rxGroupListId: 'rx-1',
      },
    ],
  };
}

function libraryWith(overrides: Partial<LibrarySlice> = {}): LibrarySlice {
  return {
    channels: [dmrChannel()],
    zones: [],
    talkGroups: [tg],
    digitalContacts: [alice],
    analogContacts: [],
    rxGroupLists: [
      {
        ...newRxGroupList(PROJECT_ID, 'Mixed'),
        id: 'rx-1',
        members: [
          { ref: { kind: 'talkGroup' as const, id: tg.id } },
          { ref: { kind: 'digitalContact' as const, id: alice.id } },
        ],
      },
    ],
    scanLists: [],
    aprsConfiguration: null,
    ...overrides,
  };
}

function exportFiles(library: LibrarySlice, options?: CpsExportOptions) {
  const build = {
    ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
    layout: { sections: [{ kind: 'zoneGrouping' as const, zones: [] }] },
  };
  const assembled = assemble(build, library);
  return serialiseAnytoneFiles(assembled, library, options);
}

function column(csv: string, header: string): string[] {
  const table = csvToTable(csv);
  const index = table.headers.indexOf(header);
  return table.rows.map((row) => row[index] ?? '');
}

const directoryCarol = projectedRowToAssembledDigitalContact(
  {
    digitalId: 2_350_001,
    wireName: 'Carol',
    callsign: 'GM0CCC',
    city: '',
    province: '',
    country: '',
    remark: '',
  },
  PROJECT_ID,
);

function dualBank(includeLibraryContacts: boolean, directory = [directoryCarol]): CpsExportOptions {
  return {
    directoryProjection: {
      dualBank: {
        includeLibraryContacts,
        directoryDigitalContacts: directory,
        dm32RadioIds: [],
        includeDm32RadioIdFile: false,
        keepLibraryContactsInAssembly: true,
      },
    },
  };
}

describe('Anytone DMRTalkGroups.CSV carries contacts as private calls', () => {
  it('lists the talk group (Group Call) then the contact (Private Call) with continuous No.', () => {
    const csv = exportFiles(libraryWith())['DMRTalkGroups.CSV'];
    expect(column(csv, 'No.')).toEqual(['1', '2']);
    expect(column(csv, 'Radio ID')).toEqual(['950', '2351234']);
    expect(column(csv, 'Call Type')).toEqual(['Group Call', 'Private Call']);
  });

  it('names the contact the way Channel.CSV and the RX group list call it', () => {
    const files = exportFiles(libraryWith());
    const tgNames = column(files['DMRTalkGroups.CSV'], 'Name');
    const channelContact = column(files['Channel.CSV'], 'Contact/Talk Group');
    expect(channelContact.length).toBeGreaterThan(0);
    for (const name of channelContact) expect(tgNames).toContain(name);
    const rxMembers = column(files['DMRReceiveGroupCallList.CSV'], 'Contact')[0]!.split('|');
    for (const name of rxMembers) expect(tgNames).toContain(name);
  });
});

describe('Anytone DMRDigitalContactList.CSV is the ID database', () => {
  it('holds the library contacts by default', () => {
    const csv = exportFiles(libraryWith())['DMRDigitalContactList.CSV'];
    expect(column(csv, 'Radio ID')).toEqual(['2351234']);
  });

  it('holds only the directory row, with a non-blank Name, when the library is off', () => {
    const csv = exportFiles(libraryWith(), dualBank(false))['DMRDigitalContactList.CSV'];
    expect(column(csv, 'Radio ID')).toEqual(['2350001']);
    expect(column(csv, 'Name')).toEqual(['Carol']);
  });

  it('holds both with both toggles on', () => {
    const csv = exportFiles(libraryWith(), dualBank(true))['DMRDigitalContactList.CSV'];
    expect(column(csv, 'Radio ID')).toEqual(['2351234', '2350001']);
    // The contact is still in the Contacts list.
    expect(
      column(exportFiles(libraryWith(), dualBank(false))['DMRTalkGroups.CSV'], 'Call Type'),
    ).toContain('Private Call');
  });
});

describe('collectAnytoneExportWarnings contacts list (#1433)', () => {
  function warningsFor(library: LibrarySlice): string[] {
    const build = {
      ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
      layout: { sections: [{ kind: 'zoneGrouping' as const, zones: [] }] },
    };
    return collectAnytoneExportWarnings(assemble(build, library), library).map(formatExportWarning);
  }

  it('warns when talk groups and contacts exceed DMRTalkGroups.CSV', () => {
    const many = Array.from({ length: 10_000 }, (_, i) => ({
      ...tg,
      id: `tg-${i}`,
      name: `TG ${i}`,
      digitalId: 100 + i,
    }));
    const texts = warningsFor(libraryWith({ channels: [], rxGroupLists: [], talkGroups: many }));
    expect(
      texts.some((t) =>
        t.includes(
          'Talk groups and contacts total 10001; DMRTalkGroups.CSV holds 10000 — 1 contact(s) left out',
        ),
      ),
    ).toBe(true);
  }, 30_000);

  it('warns when a contact has the same name as a talk group', () => {
    const twin = { ...newDigitalContact(PROJECT_ID, 'Scotland', 2_351_000), id: 'dc-twin' };
    const texts = warningsFor(
      libraryWith({ channels: [], rxGroupLists: [], digitalContacts: [twin] }),
    );
    expect(
      texts.some((t) => t.includes('Contact "Scotland" has the same name as a talk group')),
    ).toBe(true);
  });
});

describe('Anytone CSV keeps only DMR talk groups and contacts (#1438)', () => {
  const nxdnTg = { ...newTalkGroup(PROJECT_ID, 'NXDN Local', 1234, 'nxdn'), id: 'tg-nx' };
  const nxdnContact = { ...newDigitalContact(PROJECT_ID, 'NX Carol', 4321, 'nxdn'), id: 'dc-nx' };

  function nxdnLibrary(): LibrarySlice {
    const base = libraryWith();
    const channel = dmrChannel();
    return {
      ...base,
      channels: [
        {
          ...channel,
          modeProfiles: channel.modeProfiles.map((profile) =>
            profile.mode === 'dmr'
              ? { ...profile, contactRef: { kind: 'talkGroup' as const, id: nxdnTg.id } }
              : profile,
          ),
        },
      ],
      talkGroups: [nxdnTg, tg],
      digitalContacts: [nxdnContact, alice],
      rxGroupLists: [
        {
          ...base.rxGroupLists[0]!,
          members: [
            { ref: { kind: 'talkGroup' as const, id: nxdnTg.id } },
            { ref: { kind: 'talkGroup' as const, id: tg.id } },
            { ref: { kind: 'digitalContact' as const, id: nxdnContact.id } },
            { ref: { kind: 'digitalContact' as const, id: alice.id } },
          ],
        },
      ],
    };
  }

  it('writes no NXDN row to DMRTalkGroups, DMRDigitalContactList or the RX list', () => {
    const files = exportFiles(nxdnLibrary());
    expect(column(files['DMRTalkGroups.CSV'], 'Radio ID')).toEqual(['950', '2351234']);
    expect(column(files['DMRDigitalContactList.CSV'], 'Radio ID')).toEqual(['2351234']);
    expect(column(files['DMRReceiveGroupCallList.CSV'], 'Contact TG/DMR ID')).toEqual([
      '950|2351234',
    ]);
  });

  it('fans out only DMR RX members and writes an NXDN TX talk group as no contact', () => {
    const csv = exportFiles(nxdnLibrary())['Channel.CSV'];
    // RX-list fan-out rows (DMR members only), then the scratch row with the channel's own contact.
    expect(column(csv, 'Contact/Talk Group')).toEqual(['Scotland', 'Alice', '']);
    expect(column(csv, 'Contact/Talk Group TG/DMR ID')).toEqual(['950', '2351234', '']);
  });

  it('warns once with the skipped counts', () => {
    const library = nxdnLibrary();
    const build = {
      ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
      layout: { sections: [{ kind: 'zoneGrouping' as const, zones: [] }] },
    };
    const texts = collectAnytoneExportWarnings(assemble(build, library), library).map(
      formatExportWarning,
    );
    expect(
      texts.filter((t) =>
        t.includes(
          "1 talk group(s) and 1 contact(s) are not DMR (e.g. NXDN) and were left out of the radio's DMR contact lists and RX group lists; 1 DMR channel(s) that call one are written with no TX contact",
        ),
      ),
    ).toHaveLength(1);
  });
});
