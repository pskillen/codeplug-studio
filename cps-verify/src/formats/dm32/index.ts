/**
 * DM32 CPS wire verifier plugin.
 *
 * Tier-3 documentation sources:
 * - docs/reference/dm32/README.md
 * - docs/reference/dm32/channels.md
 * - docs/reference/dm32/zones.md
 * - docs/reference/dm32/talkgroups.md
 * - docs/reference/dm32/rx-group-lists.md
 * - docs/reference/dm32/scan-lists.md
 * - docs/reference/dm32/radios/baofeng-dm32uv.md
 */

import { csvToTable } from '../../../../src/core/import-export/csvParse.ts';
import {
  CHANNEL_COL,
  CHANNEL_HEADERS,
  CONTACT_COL,
  CONTACT_HEADERS,
  RX_GROUP_LIST_COL,
  RX_GROUP_LIST_HEADERS,
  SCAN_COL,
  SCAN_HEADERS,
  TALKGROUP_COL,
  TALKGROUP_HEADERS,
  ZONE_COL,
  ZONE_HEADERS,
} from '../../../../src/core/import-export/formats/dm32/columns.ts';
import {
  DEFAULT_DM32_PROFILE_ID,
  DM32_PROFILES,
  getDm32Profile,
} from '../../../../src/core/import-export/formats/dm32/profiles.ts';
import type { BundleFile, FormatVerifier, VerifyDiagnostic } from '../../types.ts';
import {
  checkCardinality,
  checkForeignKey,
  checkNameLength,
} from '../../rules/foreignKeys.ts';
import { checkExactHeaders } from '../../rules/headers.ts';
import { checkCrlfLineEndings } from '../../rules/lineEndings.ts';
import { checkSelectiveQuoting } from '../../rules/selectiveQuoting.ts';

const HEADER_SPECS: Record<string, string[]> = {
  'Channels.csv': CHANNEL_HEADERS,
  'Zones.csv': ZONE_HEADERS,
  'Talkgroups.csv': TALKGROUP_HEADERS,
  'Contacts.csv': CONTACT_HEADERS,
  'RXGroupLists.csv': RX_GROUP_LIST_HEADERS,
  'Scan.csv': SCAN_HEADERS,
};

const REQUIRED_CORE = [
  'Channels.csv',
  'Zones.csv',
  'Talkgroups.csv',
  'RXGroupLists.csv',
  'Scan.csv',
] as const;

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

function verifyPhysical(file: BundleFile): VerifyDiagnostic[] {
  if (!file.name.toLowerCase().endsWith('.csv')) return [];
  return [
    ...checkCrlfLineEndings(file.name, file.text),
    ...checkSelectiveQuoting(file.name, file.text),
  ];
}

function headerSpecFor(fileName: string): string[] | undefined {
  if (HEADER_SPECS[fileName]) return HEADER_SPECS[fileName];
  const key = Object.keys(HEADER_SPECS).find((k) => k.toLowerCase() === fileName.toLowerCase());
  return key ? HEADER_SPECS[key] : undefined;
}

function verifyHeaders(file: BundleFile): VerifyDiagnostic[] {
  const expected = headerSpecFor(file.name);
  if (!expected) return [];
  const table = csvToTable(file.text);
  return checkExactHeaders(file.name, table.headers, expected);
}

function verifyCrossFile(
  files: BundleFile[],
  profile: ReturnType<typeof getDm32Profile>,
): VerifyDiagnostic[] {
  const diagnostics: VerifyDiagnostic[] = [];
  const channels = findFile(files, 'Channels.csv');
  const zones = findFile(files, 'Zones.csv');
  const talkgroups = findFile(files, 'Talkgroups.csv');
  const contacts = findFile(files, 'Contacts.csv');
  const rgls = findFile(files, 'RXGroupLists.csv');
  const scan = findFile(files, 'Scan.csv');

  const channelTable = channels ? csvToTable(channels.text) : null;
  const channelNames = channelTable
    ? nameSet(channelTable.headers, channelTable.rows, CHANNEL_COL.name)
    : new Set<string>();

  const tgTable = talkgroups ? csvToTable(talkgroups.text) : null;
  const tgNames = tgTable
    ? nameSet(tgTable.headers, tgTable.rows, TALKGROUP_COL.name)
    : new Set<string>();

  const contactTable = contacts ? csvToTable(contacts.text) : null;
  const contactNames = contactTable
    ? nameSet(contactTable.headers, contactTable.rows, CONTACT_COL.name)
    : new Set<string>();

  const contactOrTg = new Set([...tgNames, ...contactNames]);

  const rglTable = rgls ? csvToTable(rgls.text) : null;
  const rglNames = rglTable
    ? nameSet(rglTable.headers, rglTable.rows, RX_GROUP_LIST_COL.name)
    : new Set<string>();

  const scanTable = scan ? csvToTable(scan.text) : null;
  const scanNames = scanTable
    ? nameSet(scanTable.headers, scanTable.rows, SCAN_COL.name)
    : new Set<string>();

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
          column: CHANNEL_COL.txContact,
          row: rowNum,
          value: cell(channelTable.headers, row, CHANNEL_COL.txContact),
          targets: contactOrTg,
          sentinels: new Set(['', 'None', 'Off']),
        }),
      );
      diagnostics.push(
        ...checkForeignKey({
          file: channels.name,
          column: CHANNEL_COL.rxGroupList,
          row: rowNum,
          value: cell(channelTable.headers, row, CHANNEL_COL.rxGroupList),
          targets: rglNames,
          sentinels: new Set(['', 'ALL', 'None', 'Off']),
        }),
      );
      diagnostics.push(
        ...checkForeignKey({
          file: channels.name,
          column: CHANNEL_COL.scanList,
          row: rowNum,
          value: cell(channelTable.headers, row, CHANNEL_COL.scanList),
          targets: scanNames,
          sentinels: new Set(['', 'None', 'Off']),
        }),
      );
    });
  }

  if (zones) {
    const table = csvToTable(zones.text);
    table.rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      const members = cell(table.headers, row, ZONE_COL.members);
      diagnostics.push(
        ...checkForeignKey({
          file: zones.name,
          column: ZONE_COL.members,
          row: rowNum,
          value: members,
          targets: channelNames,
          pipeSeparated: true,
          sentinels: new Set(['']),
        }),
      );
    });
  }

  if (rgls && rglTable) {
    rglTable.rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      const members = cell(rglTable.headers, row, RX_GROUP_LIST_COL.members);
      diagnostics.push(
        ...checkCardinality(
          rgls.name,
          RX_GROUP_LIST_COL.members,
          rowNum,
          members,
          profile.rxGroupListMembers,
          'RX group list',
        ),
      );
      diagnostics.push(
        ...checkForeignKey({
          file: rgls.name,
          column: RX_GROUP_LIST_COL.members,
          row: rowNum,
          value: members,
          targets: contactOrTg,
          pipeSeparated: true,
          sentinels: new Set(['']),
        }),
      );
    });
  }

  if (scan && scanTable) {
    scanTable.rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      const members = cell(scanTable.headers, row, SCAN_COL.channelMembers);
      diagnostics.push(
        ...checkCardinality(
          scan.name,
          SCAN_COL.channelMembers,
          rowNum,
          members,
          profile.scanListMembers,
          'Scan list',
        ),
      );
      diagnostics.push(
        ...checkForeignKey({
          file: scan.name,
          column: SCAN_COL.channelMembers,
          row: rowNum,
          value: members,
          targets: channelNames,
          pipeSeparated: true,
          sentinels: new Set(['']),
        }),
      );
    });
  }

  return diagnostics;
}

function verifyRequiredFiles(files: BundleFile[]): VerifyDiagnostic[] {
  const names = new Set(files.map((f) => f.name.toLowerCase()));
  if (![...names].some((n) => n === 'channels.csv')) return [];
  const diagnostics: VerifyDiagnostic[] = [];
  for (const required of REQUIRED_CORE) {
    if (![...names].includes(required.toLowerCase())) {
      diagnostics.push({
        rule: 'required-files',
        message: `Missing required file ${required} for DM32 full bundle verification.`,
      });
    }
  }
  return diagnostics;
}

export function verifyDm32(files: BundleFile[], profileId: string): VerifyDiagnostic[] {
  const profile = getDm32Profile(profileId);
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

export const dm32Verifier: FormatVerifier = {
  id: 'dm32',
  label: 'Baofeng DM32 CPS CSV',
  defaultProfileId: DEFAULT_DM32_PROFILE_ID,
  supportedProfileIds: DM32_PROFILES.map((p) => p.id),
  verify: verifyDm32,
};
