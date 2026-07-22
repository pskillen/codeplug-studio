/**
 * OpenGD77 CPS wire verifier plugin.
 *
 * Tier-3 documentation sources:
 * - docs/reference/export-formats/opengd77/file-format.md
 * - docs/reference/export-formats/opengd77/channels.md
 * - docs/reference/export-formats/opengd77/zones.md
 * - docs/reference/export-formats/opengd77/contacts.md
 * - docs/reference/export-formats/opengd77/tg-lists.md
 * - docs/reference/export-formats/opengd77/dtmf-aprs.md
 * - docs/reference/radios/baofeng/dm-1701/README.md
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
import type { BundleFile, CheckOutcome, FormatVerifier, VerifyDiagnostic } from '../../types.ts';
import { checkOutcome, flattenOutcomes } from '../../types.ts';
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

function countFilledMembers(headers: string[], row: string[], memberHeaders: string[]): number {
  let count = 0;
  for (const h of memberHeaders) {
    if (cell(headers, row, h).trim()) count++;
  }
  return count;
}

function pushPhysicalOutcomes(file: BundleFile, outcomes: CheckOutcome[]): void {
  if (!file.name.toLowerCase().endsWith('.csv')) return;
  outcomes.push(
    checkOutcome(
      {
        id: `physical.${file.name}.line-endings`,
        rule: 'line-endings',
        label: `${file.name} LF line endings`,
      },
      checkLfLineEndings(file.name, file.text),
    ),
    checkOutcome(
      {
        id: `physical.${file.name}.quoting`,
        rule: 'quoting',
        label: `${file.name} selective quoting`,
      },
      checkSelectiveQuoting(file.name, file.text),
    ),
  );
}

function pushHeaderOutcome(file: BundleFile, outcomes: CheckOutcome[]): void {
  const expected = headerSpecFor(file.name);
  if (!expected) return;
  const table = csvToTable(file.text);
  outcomes.push(
    checkOutcome(
      {
        id: `headers.${file.name}`,
        rule: 'headers',
        label: `${file.name} exact headers`,
      },
      checkExactHeaders(file.name, table.headers, expected),
    ),
  );
}

function pushCrossFileOutcomes(
  files: BundleFile[],
  profile: ReturnType<typeof getOpenGd77Profile>,
  outcomes: CheckOutcome[],
): void {
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
    const nameLen: VerifyDiagnostic[] = [];
    const fkContact: VerifyDiagnostic[] = [];
    const fkTgList: VerifyDiagnostic[] = [];
    channelTable.rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      const name = cell(channelTable.headers, row, CHANNEL_COL.name);
      nameLen.push(
        ...checkNameLength(channels.name, CHANNEL_COL.name, rowNum, name, profile.nameLimit),
      );
      fkContact.push(
        ...checkForeignKey({
          file: channels.name,
          column: CHANNEL_COL.contact,
          row: rowNum,
          value: cell(channelTable.headers, row, CHANNEL_COL.contact),
          targets: contactNames,
          sentinels: FK_SENTINELS,
        }),
      );
      fkTgList.push(
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
    outcomes.push(
      checkOutcome(
        {
          id: 'name-length.Channels.csv',
          rule: 'name-length',
          label: 'Channel name length',
        },
        nameLen,
      ),
      checkOutcome(
        {
          id: 'fk.channel.contact',
          rule: 'foreign-key',
          label: 'Channel → contact FK',
        },
        fkContact,
      ),
      checkOutcome(
        {
          id: 'fk.channel.tgList',
          rule: 'foreign-key',
          label: 'Channel → TG list FK',
        },
        fkTgList,
      ),
    );
  }

  if (zones) {
    const table = csvToTable(zones.text);
    const cardinality: VerifyDiagnostic[] = [];
    const fkMembers: VerifyDiagnostic[] = [];
    table.rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      const filled = countFilledMembers(table.headers, row, zoneMemberCols);
      if (filled > profile.zoneMembers) {
        cardinality.push({
          rule: 'cardinality',
          file: zones.name,
          row: rowNum,
          message: `Zone has ${filled} members but max is ${profile.zoneMembers}.`,
        });
      }
      for (const col of zoneMemberCols) {
        fkMembers.push(
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
    outcomes.push(
      checkOutcome(
        {
          id: 'cardinality.zone.members',
          rule: 'cardinality',
          label: 'Zone member cardinality',
        },
        cardinality,
      ),
      checkOutcome(
        {
          id: 'fk.zone.members',
          rule: 'foreign-key',
          label: 'Zone members → channel FK',
        },
        fkMembers,
      ),
    );
  }

  if (tgLists && tgTable) {
    const cardinality: VerifyDiagnostic[] = [];
    const fkMembers: VerifyDiagnostic[] = [];
    tgTable.rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      const filled = countFilledMembers(tgTable.headers, row, tgMemberCols);
      if (filled > profile.tgListMembers) {
        cardinality.push({
          rule: 'cardinality',
          file: tgLists.name,
          row: rowNum,
          message: `TG list has ${filled} members but max is ${profile.tgListMembers}.`,
        });
      }
      for (const col of tgMemberCols) {
        fkMembers.push(
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
    outcomes.push(
      checkOutcome(
        {
          id: 'cardinality.tgList.members',
          rule: 'cardinality',
          label: 'TG list member cardinality',
        },
        cardinality,
      ),
      checkOutcome(
        {
          id: 'fk.tgList.members',
          rule: 'foreign-key',
          label: 'TG list members → contact FK',
        },
        fkMembers,
      ),
    );
  }
}

function pushRequiredFileOutcomes(files: BundleFile[], outcomes: CheckOutcome[]): void {
  const names = new Set(files.map((f) => f.name.toLowerCase()));
  if (![...names].includes('channels.csv')) return;

  const coreMissing: VerifyDiagnostic[] = [];
  for (const required of REQUIRED_CORE) {
    if (![...names].includes(required.toLowerCase())) {
      coreMissing.push({
        rule: 'required-files',
        message: `Missing required file ${required} for OpenGD77 full bundle verification.`,
      });
    }
  }
  outcomes.push(
    checkOutcome(
      {
        id: 'required.core-files',
        rule: 'required-files',
        label: 'Required OpenGD77 core CSV files',
      },
      coreMissing,
    ),
  );
}

export function verifyOpenGd77Detailed(files: BundleFile[], profileId: string): CheckOutcome[] {
  const profile = getOpenGd77Profile(profileId);
  const outcomes: CheckOutcome[] = [];
  for (const file of files) {
    pushPhysicalOutcomes(file, outcomes);
    if (file.name.toLowerCase().endsWith('.csv')) {
      pushHeaderOutcome(file, outcomes);
    }
  }
  pushCrossFileOutcomes(files, profile, outcomes);
  pushRequiredFileOutcomes(files, outcomes);
  return outcomes;
}

export function verifyOpenGd77(files: BundleFile[], profileId: string): VerifyDiagnostic[] {
  return flattenOutcomes(verifyOpenGd77Detailed(files, profileId));
}

export const opengd77Verifier: FormatVerifier = {
  id: 'opengd77',
  label: 'OpenGD77 CPS CSV',
  defaultProfileId: DEFAULT_OPENGD77_PROFILE_ID,
  supportedProfileIds: OPENGD77_PROFILES.map((p) => p.id),
  verifyDetailed: verifyOpenGd77Detailed,
  verify: verifyOpenGd77,
};
