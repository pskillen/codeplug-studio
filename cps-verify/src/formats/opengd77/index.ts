/**
 * OpenGD77 CPS wire verifier plugin.
 *
 * Tier-3 documentation sources:
 * - docs/reference/opengd77/file-format.md
 * - docs/reference/opengd77/channels.md
 * - docs/reference/opengd77/zones.md
 * - docs/reference/opengd77/contacts.md
 * - docs/reference/opengd77/tg-lists.md
 * - docs/reference/opengd77/dtmf-aprs.md
 * - docs/reference/opengd77/radios/baofeng-1701.md
 */

import { csvToTable } from '../../../../src/core/import-export/csvParse.ts';
import {
  APRS_HEADERS,
  CHANNEL_COL,
  CHANNEL_HEADERS,
  CONTACT_COL,
  CONTACT_HEADERS,
  DTMF_HEADERS,
  RX_GROUP_LIST_COL,
  RX_GROUP_LIST_HEADERS,
  ZONE_HEADERS,
  rxGroupListMemberHeaders,
  zoneMemberHeaders,
} from '../../../../src/core/import-export/formats/opengd77/columns.ts';
import {
  DEFAULT_OPENGD77_PROFILE_ID,
  OPENGD77_PROFILES,
  getOpenGd77Profile,
} from '../../../../src/core/import-export/formats/opengd77/profiles.ts';
import type { BundleFile, FormatVerifier, VerifyDiagnostic } from '../../types.ts';
import { checkForeignKey, checkNameLength } from '../../rules/foreignKeys.ts';
import { checkExactHeaders } from '../../rules/headers.ts';
import { checkLfLineEndings } from '../../rules/lfLineEndings.ts';
import { checkSelectiveQuoting } from '../../rules/selectiveQuoting.ts';

const HEADER_SPECS: Record<string, string[]> = {
  'Channels.csv': CHANNEL_HEADERS,
  'Zones.csv': ZONE_HEADERS,
  'Contacts.csv': CONTACT_HEADERS,
  'TG_Lists.csv': RX_GROUP_LIST_HEADERS,
  'DTMF.csv': DTMF_HEADERS,
  'APRS.csv': APRS_HEADERS,
};

const REQUIRED_CORE = ['Channels.csv', 'Zones.csv', 'Contacts.csv', 'TG_Lists.csv'] as const;

const FK_SENTINELS = new Set(['', 'None', 'Off']);

function findFile(files: BundleFile[], name: string): BundleFile | undefined {
  const lower = name.toLowerCase();
  return files.find((f) => f.name.toLowerCase() === lower);
}

function cell(headers: string[], row: string[], column: string): string {
  const idx = headers.indexOf(column);
  if (idx < 0) return '';
  return row[idx] ?? '';
}

function nameSet(headers: string[], rows: string[][], column: string): Set<string> {
  const set = new Set<string>();
  for (const row of rows) {
    const name = cell(headers, row, column).trim();
    if (name) set.add(name);
  }
  return set;
}

function headerSpecFor(fileName: string): string[] | undefined {
  if (HEADER_SPECS[fileName]) return HEADER_SPECS[fileName];
  const key = Object.keys(HEADER_SPECS).find((k) => k.toLowerCase() === fileName.toLowerCase());
  return key ? HEADER_SPECS[key] : undefined;
}

function verifyPhysical(file: BundleFile): VerifyDiagnostic[] {
  if (!file.name.toLowerCase().endsWith('.csv')) return [];
  return [
    ...checkLfLineEndings(file.name, file.text),
    ...checkSelectiveQuoting(file.name, file.text),
  ];
}

function verifyHeaders(file: BundleFile): VerifyDiagnostic[] {
  const expected = headerSpecFor(file.name);
  if (!expected) return [];
  const table = csvToTable(file.text);
  return checkExactHeaders(file.name, table.headers, expected);
}

function countFilledMembers(headers: string[], row: string[], memberHeaders: string[]): number {
  let count = 0;
  for (const h of memberHeaders) {
    if (cell(headers, row, h).trim()) count++;
  }
  return count;
}

function verifyCrossFile(
  files: BundleFile[],
  profile: ReturnType<typeof getOpenGd77Profile>,
): VerifyDiagnostic[] {
  const diagnostics: VerifyDiagnostic[] = [];
  const channels = findFile(files, 'Channels.csv');
  const zones = findFile(files, 'Zones.csv');
  const contacts = findFile(files, 'Contacts.csv');
  const tgLists = findFile(files, 'TG_Lists.csv');

  const channelTable = channels ? csvToTable(channels.text) : null;
  const channelNames = channelTable
    ? nameSet(channelTable.headers, channelTable.rows, CHANNEL_COL.name)
    : new Set<string>();

  const contactTable = contacts ? csvToTable(contacts.text) : null;
  const contactNames = contactTable
    ? nameSet(contactTable.headers, contactTable.rows, CONTACT_COL.name)
    : new Set<string>();

  const tgTable = tgLists ? csvToTable(tgLists.text) : null;
  const tgNames = tgTable
    ? nameSet(tgTable.headers, tgTable.rows, RX_GROUP_LIST_COL.name)
    : new Set<string>();

  const zoneMemberCols = zoneMemberHeaders(profile.zoneMembers);
  const tgMemberCols = rxGroupListMemberHeaders(profile.tgListMembers);

  if (channelTable && channels) {
    channelTable.rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      const name = cell(channelTable.headers, row, CHANNEL_COL.name);
      diagnostics.push(
        ...checkNameLength(channels.name, CHANNEL_COL.name, rowNum, name, profile.nameLimit),
      );
      diagnostics.push(
        ...checkForeignKey({
          file: channels.name,
          column: CHANNEL_COL.contact,
          row: rowNum,
          value: cell(channelTable.headers, row, CHANNEL_COL.contact),
          targets: contactNames,
          sentinels: FK_SENTINELS,
        }),
      );
      diagnostics.push(
        ...checkForeignKey({
          file: channels.name,
          column: CHANNEL_COL.tgList,
          row: rowNum,
          value: cell(channelTable.headers, row, CHANNEL_COL.tgList),
          targets: tgNames,
          sentinels: FK_SENTINELS,
        }),
      );
    });
  }

  if (zones) {
    const table = csvToTable(zones.text);
    table.rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      const filled = countFilledMembers(table.headers, row, zoneMemberCols);
      if (filled > profile.zoneMembers) {
        diagnostics.push({
          rule: 'cardinality',
          file: zones.name,
          row: rowNum,
          message: `Zone has ${filled} members but max is ${profile.zoneMembers}.`,
        });
      }
      for (const col of zoneMemberCols) {
        diagnostics.push(
          ...checkForeignKey({
            file: zones.name,
            column: col,
            row: rowNum,
            value: cell(table.headers, row, col),
            targets: channelNames,
            sentinels: FK_SENTINELS,
          }),
        );
      }
    });
  }

  if (tgLists && tgTable) {
    tgTable.rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      const filled = countFilledMembers(tgTable.headers, row, tgMemberCols);
      if (filled > profile.tgListMembers) {
        diagnostics.push({
          rule: 'cardinality',
          file: tgLists.name,
          row: rowNum,
          message: `TG list has ${filled} members but max is ${profile.tgListMembers}.`,
        });
      }
      for (const col of tgMemberCols) {
        diagnostics.push(
          ...checkForeignKey({
            file: tgLists.name,
            column: col,
            row: rowNum,
            value: cell(tgTable.headers, row, col),
            targets: contactNames,
            sentinels: FK_SENTINELS,
          }),
        );
      }
    });
  }

  return diagnostics;
}

function verifyRequiredFiles(files: BundleFile[]): VerifyDiagnostic[] {
  const names = new Set(files.map((f) => f.name.toLowerCase()));
  if (![...names].includes('channels.csv')) return [];
  const diagnostics: VerifyDiagnostic[] = [];
  for (const required of REQUIRED_CORE) {
    if (![...names].includes(required.toLowerCase())) {
      diagnostics.push({
        rule: 'required-files',
        message: `Missing required file ${required} for OpenGD77 full bundle verification.`,
      });
    }
  }
  return diagnostics;
}

export function verifyOpenGd77(files: BundleFile[], profileId: string): VerifyDiagnostic[] {
  const profile = getOpenGd77Profile(profileId);
  const diagnostics: VerifyDiagnostic[] = [];
  for (const file of files) {
    diagnostics.push(...verifyPhysical(file));
    if (file.name.toLowerCase().endsWith('.csv')) {
      diagnostics.push(...verifyHeaders(file));
    }
  }
  diagnostics.push(...verifyCrossFile(files, profile));
  diagnostics.push(...verifyRequiredFiles(files));
  return diagnostics;
}

export const opengd77Verifier: FormatVerifier = {
  id: 'opengd77',
  label: 'OpenGD77 CPS CSV',
  defaultProfileId: DEFAULT_OPENGD77_PROFILE_ID,
  supportedProfileIds: OPENGD77_PROFILES.map((p) => p.id),
  verify: verifyOpenGd77,
};
