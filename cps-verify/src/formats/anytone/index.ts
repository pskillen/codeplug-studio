/**
 * Anytone CPS wire verifier plugin.
 *
 * Tier-3 documentation sources (every enforced rule is stated in these files):
 * - docs/reference/anytone/file-format.md
 * - docs/reference/anytone/channels.md
 * - docs/reference/anytone/zones.md
 * - docs/reference/anytone/scan-lists.md
 * - docs/reference/anytone/talk-groups.md
 * - docs/reference/anytone/rx-group-lists.md
 * - docs/reference/anytone/lst-manifest.md
 * - docs/reference/anytone/radios/at-d890uv.md
 * - docs/reference/anytone/am-air.md
 * - docs/reference/anytone/fm-broadcast.md
 * - docs/reference/anytone/aprs.md
 */

import { csvToTable } from '../../../../src/core/import-export/csvParse.ts';
import {
  AM_AIR_HEADERS,
  AM_ZONE_HEADERS,
  APRS_HEADERS,
  CHANNEL_COL,
  CHANNEL_HEADERS,
  DIGITAL_CONTACT_HEADERS,
  FM_BROADCAST_HEADERS,
  RADIO_ID_HEADERS,
  RX_GROUP_LIST_COL,
  RX_GROUP_LIST_HEADERS,
  SCAN_LIST_COL,
  SCAN_LIST_HEADERS,
  TALK_GROUP_COL,
  TALK_GROUP_HEADERS,
  ZONE_COL,
  ZONE_HEADERS,
} from '../../../../src/core/import-export/formats/anytone/columns.ts';
import {
  DEFAULT_ANYTONE_PROFILE_ID,
  getAnytoneProfile,
  ANYTONE_PROFILES,
} from '../../../../src/core/import-export/formats/anytone/profiles.ts';

import type { BundleFile, FormatVerifier, VerifyDiagnostic } from '../../types.ts';
import { checkCardinality, checkForeignKey, checkNameLength } from '../../rules/foreignKeys.ts';
import { checkExactHeaders } from '../../rules/headers.ts';
import { checkCrlfLineEndings } from '../../rules/lineEndings.ts';
import { checkUniversalQuoting } from '../../rules/quoting.ts';

/** Modelled export files that get exact header checks when present. */
const HEADER_SPECS: Record<string, string[]> = {
  'Channel.CSV': CHANNEL_HEADERS,
  'DMRZone.CSV': ZONE_HEADERS,
  'AMZone.CSV': AM_ZONE_HEADERS,
  'ScanList.CSV': SCAN_LIST_HEADERS,
  'DMRTalkGroups.CSV': TALK_GROUP_HEADERS,
  'DMRDigitalContactList.CSV': DIGITAL_CONTACT_HEADERS,
  'DMRReceiveGroupCallList.CSV': RX_GROUP_LIST_HEADERS,
  'RadioIDList.CSV': RADIO_ID_HEADERS,
  'AMAir.CSV': AM_AIR_HEADERS,
  'FM.CSV': FM_BROADCAST_HEADERS,
  'APRS.CSV': APRS_HEADERS,
};

/** Core files expected in a full AT-D890UV export-all style bundle. */
const REQUIRED_FULL_BUNDLE_FILES = [
  'Channel.CSV',
  'DMRZone.CSV',
  'ScanList.CSV',
  'DMRTalkGroups.CSV',
  'DMRReceiveGroupCallList.CSV',
] as const;

function findFile(files: BundleFile[], name: string): BundleFile | undefined {
  return files.find((f) => f.name === name);
}

function cell(headers: string[], row: string[], column: string): string {
  const idx = headers.indexOf(column);
  if (idx < 0) return '';
  return row[idx] ?? '';
}

function nameSetFromColumn(headers: string[], rows: string[][], column: string): Set<string> {
  const set = new Set<string>();
  for (const row of rows) {
    const name = cell(headers, row, column).trim();
    if (name) set.add(name);
  }
  return set;
}

function isCsvOrLst(name: string): boolean {
  const upper = name.toUpperCase();
  return upper.endsWith('.CSV') || upper.endsWith('.LST');
}

function verifyPhysical(file: BundleFile): VerifyDiagnostic[] {
  if (!isCsvOrLst(file.name)) return [];
  return [
    ...checkCrlfLineEndings(file.name, file.text),
    ...(file.name.toUpperCase().endsWith('.CSV')
      ? checkUniversalQuoting(file.name, file.text)
      : []),
  ];
}

function verifyHeaders(file: BundleFile): VerifyDiagnostic[] {
  const expected = HEADER_SPECS[file.name];
  if (!expected) return [];
  const table = csvToTable(file.text);
  return checkExactHeaders(file.name, table.headers, expected);
}

function verifyCrossFile(
  files: BundleFile[],
  profile: ReturnType<typeof getAnytoneProfile>,
): VerifyDiagnostic[] {
  const diagnostics: VerifyDiagnostic[] = [];
  const channelFile = findFile(files, 'Channel.CSV');
  const zoneFile = findFile(files, 'DMRZone.CSV');
  const scanFile = findFile(files, 'ScanList.CSV');
  const tgFile = findFile(files, 'DMRTalkGroups.CSV');
  const contactFile = findFile(files, 'DMRDigitalContactList.CSV');
  const rglFile = findFile(files, 'DMRReceiveGroupCallList.CSV');
  const amAirFile = findFile(files, 'AMAir.CSV');

  const channelNames = new Set<string>();
  if (channelFile) {
    const table = csvToTable(channelFile.text);
    for (const name of nameSetFromColumn(table.headers, table.rows, CHANNEL_COL.name)) {
      channelNames.add(name);
    }
  }
  if (amAirFile) {
    const table = csvToTable(amAirFile.text);
    for (const name of nameSetFromColumn(table.headers, table.rows, 'Name')) {
      channelNames.add(name);
    }
  }

  const scanTable = scanFile ? csvToTable(scanFile.text) : null;
  const scanNames = scanTable
    ? nameSetFromColumn(scanTable.headers, scanTable.rows, SCAN_LIST_COL.name)
    : new Set<string>();

  const tgTable = tgFile ? csvToTable(tgFile.text) : null;
  const tgNames = tgTable
    ? nameSetFromColumn(tgTable.headers, tgTable.rows, TALK_GROUP_COL.name)
    : new Set<string>();

  const contactTable = contactFile ? csvToTable(contactFile.text) : null;
  const contactNames = contactTable
    ? nameSetFromColumn(contactTable.headers, contactTable.rows, 'Name')
    : new Set<string>();

  const contactOrTg = new Set([...tgNames, ...contactNames]);

  const rglTable = rglFile ? csvToTable(rglFile.text) : null;
  const rglNames = rglTable
    ? nameSetFromColumn(rglTable.headers, rglTable.rows, RX_GROUP_LIST_COL.name)
    : new Set<string>();

  if (channelFile) {
    const table = csvToTable(channelFile.text);
    table.rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      const name = cell(table.headers, row, CHANNEL_COL.name);
      diagnostics.push(
        ...checkNameLength(channelFile.name, CHANNEL_COL.name, rowNum, name, profile.nameLimit),
      );
      diagnostics.push(
        ...checkForeignKey({
          file: channelFile.name,
          column: CHANNEL_COL.scanList,
          row: rowNum,
          value: cell(table.headers, row, CHANNEL_COL.scanList),
          targets: scanNames,
          sentinels: new Set(['None', 'Off', '']),
        }),
      );
      diagnostics.push(
        ...checkForeignKey({
          file: channelFile.name,
          column: CHANNEL_COL.rxGroupList,
          row: rowNum,
          value: cell(table.headers, row, CHANNEL_COL.rxGroupList),
          targets: rglNames,
          sentinels: new Set(['None', 'Off', '']),
        }),
      );
      const contact = cell(table.headers, row, CHANNEL_COL.contactTalkGroup);
      if (contact && contact !== 'None' && contact !== 'Off') {
        diagnostics.push(
          ...checkForeignKey({
            file: channelFile.name,
            column: CHANNEL_COL.contactTalkGroup,
            row: rowNum,
            value: contact,
            targets: contactOrTg,
            sentinels: new Set(['None', 'Off', '']),
          }),
        );
      }
    });
  }

  if (zoneFile) {
    const table = csvToTable(zoneFile.text);
    table.rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      const zoneName = cell(table.headers, row, ZONE_COL.name);
      diagnostics.push(
        ...checkNameLength(zoneFile.name, ZONE_COL.name, rowNum, zoneName, profile.nameLimit),
      );
      const members = cell(table.headers, row, ZONE_COL.members);
      diagnostics.push(
        ...checkCardinality(
          zoneFile.name,
          ZONE_COL.members,
          rowNum,
          members,
          profile.zoneMembers,
          'Zone',
        ),
      );
      diagnostics.push(
        ...checkForeignKey({
          file: zoneFile.name,
          column: ZONE_COL.members,
          row: rowNum,
          value: members,
          targets: channelNames,
          pipeSeparated: true,
          sentinels: new Set(['']),
        }),
      );
      for (const col of [ZONE_COL.aChannel, ZONE_COL.bChannel] as const) {
        diagnostics.push(
          ...checkForeignKey({
            file: zoneFile.name,
            column: col,
            row: rowNum,
            value: cell(table.headers, row, col),
            targets: channelNames,
            sentinels: new Set(['None', 'Off', '']),
          }),
        );
      }
    });
  }

  if (scanFile) {
    const table = csvToTable(scanFile.text);
    table.rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      const scanName = cell(table.headers, row, SCAN_LIST_COL.name);
      diagnostics.push(
        ...checkNameLength(scanFile.name, SCAN_LIST_COL.name, rowNum, scanName, profile.nameLimit),
      );
      const members = cell(table.headers, row, SCAN_LIST_COL.members);
      diagnostics.push(
        ...checkCardinality(
          scanFile.name,
          SCAN_LIST_COL.members,
          rowNum,
          members,
          profile.scanListMembers,
          'Scan list',
        ),
      );
      diagnostics.push(
        ...checkForeignKey({
          file: scanFile.name,
          column: SCAN_LIST_COL.members,
          row: rowNum,
          value: members,
          targets: channelNames,
          pipeSeparated: true,
          sentinels: new Set(['']),
        }),
      );
    });
  }

  if (rglFile) {
    const table = csvToTable(rglFile.text);
    table.rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      const contacts = cell(table.headers, row, RX_GROUP_LIST_COL.contacts);
      diagnostics.push(
        ...checkCardinality(
          rglFile.name,
          RX_GROUP_LIST_COL.contacts,
          rowNum,
          contacts,
          profile.rxGroupListMembers,
          'RX group list',
        ),
      );
      diagnostics.push(
        ...checkForeignKey({
          file: rglFile.name,
          column: RX_GROUP_LIST_COL.contacts,
          row: rowNum,
          value: contacts,
          targets: tgNames,
          pipeSeparated: true,
          sentinels: new Set(['']),
        }),
      );
    });
  }

  return diagnostics;
}

function verifyRequiredFiles(files: BundleFile[]): VerifyDiagnostic[] {
  const names = new Set(files.map((f) => f.name));
  // Only enforce full-bundle required set when Channel.CSV is present (partial snippets skip)
  if (!names.has('Channel.CSV')) return [];
  const diagnostics: VerifyDiagnostic[] = [];
  for (const required of REQUIRED_FULL_BUNDLE_FILES) {
    if (!names.has(required)) {
      diagnostics.push({
        rule: 'required-files',
        message: `Missing required file ${required} for Anytone full bundle verification.`,
      });
    }
  }
  // LST: if any .LST present, or if validating a "full" bundle with all core CSVs, prefer a manifest
  const hasLst = [...names].some((n) => n.toUpperCase().endsWith('.LST'));
  const hasAllCore = REQUIRED_FULL_BUNDLE_FILES.every((n) => names.has(n));
  if (hasAllCore && !hasLst) {
    diagnostics.push({
      rule: 'required-files',
      message: 'Full Anytone bundle should include a .LST manifest sidecar.',
    });
  }
  if (hasLst) {
    const lst = files.find((f) => f.name.toUpperCase().endsWith('.LST'));
    if (lst) {
      const listed = parseLstEntries(lst.text);
      for (const entry of listed) {
        if (!names.has(entry)) {
          diagnostics.push({
            rule: 'required-files',
            file: lst.name,
            message: `LST lists ${JSON.stringify(entry)} but file is not in the bundle.`,
          });
        }
      }
    }
  }
  return diagnostics;
}

/**
 * Parse Anytone `.LST` body: official `count` + `index,"File.CSV"` lines,
 * or a simple one-filename-per-line list (test snippets).
 */
export function parseLstEntries(text: string): string[] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const entries: string[] = [];
  for (const line of lines) {
    const indexed = /^(\d+)\s*,\s*"([^"]+)"\s*$/.exec(line);
    if (indexed) {
      entries.push(indexed[2]!);
      continue;
    }
    // Skip bare decimal count line at top of official manifests
    if (/^\d+$/.test(line)) continue;
    // Simple filename line (fixtures / partial tools)
    const bare = line.replace(/^"|"$/g, '');
    if (bare.toUpperCase().endsWith('.CSV') || bare.toUpperCase().endsWith('.LST')) {
      entries.push(bare);
    }
  }
  return entries;
}

export function verifyAnytone(files: BundleFile[], profileId: string): VerifyDiagnostic[] {
  const profile = getAnytoneProfile(profileId);
  const diagnostics: VerifyDiagnostic[] = [];
  for (const file of files) {
    diagnostics.push(...verifyPhysical(file));
    if (file.name.toUpperCase().endsWith('.CSV')) {
      diagnostics.push(...verifyHeaders(file));
    }
  }
  diagnostics.push(...verifyCrossFile(files, profile));
  diagnostics.push(...verifyRequiredFiles(files));
  return diagnostics;
}

export const anytoneVerifier: FormatVerifier = {
  id: 'anytone',
  label: 'Anytone CPS CSV',
  defaultProfileId: DEFAULT_ANYTONE_PROFILE_ID,
  supportedProfileIds: ANYTONE_PROFILES.map((p) => p.id),
  verify: verifyAnytone,
};
