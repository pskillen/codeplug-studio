/**
 * Anytone CPS wire verifier plugin.
 *
 * Tier-3 documentation sources (every enforced rule is stated in these files):
 * - docs/reference/export-formats/anytone/file-format.md
 * - docs/reference/export-formats/anytone/channels.md
 * - docs/reference/export-formats/anytone/zones.md
 * - docs/reference/export-formats/anytone/scan-lists.md
 * - docs/reference/export-formats/anytone/talk-groups.md
 * - docs/reference/export-formats/anytone/rx-group-lists.md
 * - docs/reference/export-formats/anytone/lst-manifest.md
 * - docs/reference/radios/anytone/at-d890uv/README.md
 * - docs/reference/export-formats/anytone/am-air.md
 * - docs/reference/export-formats/anytone/fm-broadcast.md
 * - docs/reference/export-formats/anytone/aprs.md
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

import type { BundleFile, CheckOutcome, FormatVerifier, VerifyDiagnostic } from '../../types.ts';
import { checkOutcome, flattenOutcomes } from '../../types.ts';
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

function pushPhysicalOutcomes(file: BundleFile, outcomes: CheckOutcome[]): void {
  if (!isCsvOrLst(file.name)) return;
  outcomes.push(
    checkOutcome(
      {
        id: `physical.${file.name}.line-endings`,
        rule: 'line-endings',
        label: `${file.name} CRLF line endings`,
      },
      checkCrlfLineEndings(file.name, file.text),
    ),
  );
  if (file.name.toUpperCase().endsWith('.CSV')) {
    outcomes.push(
      checkOutcome(
        {
          id: `physical.${file.name}.quoting`,
          rule: 'quoting',
          label: `${file.name} universal quoting`,
        },
        checkUniversalQuoting(file.name, file.text),
      ),
    );
  }
}

function pushHeaderOutcome(file: BundleFile, outcomes: CheckOutcome[]): void {
  const expected = HEADER_SPECS[file.name];
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
  profile: ReturnType<typeof getAnytoneProfile>,
  outcomes: CheckOutcome[],
): void {
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
    const nameLen: VerifyDiagnostic[] = [];
    const fkScan: VerifyDiagnostic[] = [];
    const fkRgl: VerifyDiagnostic[] = [];
    const fkContact: VerifyDiagnostic[] = [];
    table.rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      const name = cell(table.headers, row, CHANNEL_COL.name);
      nameLen.push(
        ...checkNameLength(channelFile.name, CHANNEL_COL.name, rowNum, name, profile.nameLimit),
      );
      fkScan.push(
        ...checkForeignKey({
          file: channelFile.name,
          column: CHANNEL_COL.scanList,
          row: rowNum,
          value: cell(table.headers, row, CHANNEL_COL.scanList),
          targets: scanNames,
          sentinels: new Set(['None', 'Off', '']),
        }),
      );
      fkRgl.push(
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
        fkContact.push(
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
    outcomes.push(
      checkOutcome(
        {
          id: 'name-length.Channel.CSV',
          rule: 'name-length',
          label: 'Channel name length',
        },
        nameLen,
      ),
      checkOutcome(
        {
          id: 'fk.channel.scanList',
          rule: 'foreign-key',
          label: 'Channel → ScanList FK',
        },
        fkScan,
      ),
      checkOutcome(
        {
          id: 'fk.channel.rxGroupList',
          rule: 'foreign-key',
          label: 'Channel → RX group list FK',
        },
        fkRgl,
      ),
      checkOutcome(
        {
          id: 'fk.channel.contactTalkGroup',
          rule: 'foreign-key',
          label: 'Channel → contact/TG FK',
        },
        fkContact,
      ),
    );
  }

  if (zoneFile) {
    const table = csvToTable(zoneFile.text);
    const nameLen: VerifyDiagnostic[] = [];
    const cardinality: VerifyDiagnostic[] = [];
    const fkMembers: VerifyDiagnostic[] = [];
    const fkAb: VerifyDiagnostic[] = [];
    table.rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      const zoneName = cell(table.headers, row, ZONE_COL.name);
      nameLen.push(
        ...checkNameLength(zoneFile.name, ZONE_COL.name, rowNum, zoneName, profile.nameLimit),
      );
      const members = cell(table.headers, row, ZONE_COL.members);
      cardinality.push(
        ...checkCardinality(
          zoneFile.name,
          ZONE_COL.members,
          rowNum,
          members,
          profile.zoneMembers,
          'Zone',
        ),
      );
      fkMembers.push(
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
        fkAb.push(
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
    outcomes.push(
      checkOutcome(
        { id: 'name-length.DMRZone.CSV', rule: 'name-length', label: 'Zone name length' },
        nameLen,
      ),
      checkOutcome(
        {
          id: 'cardinality.zone.members',
          rule: 'cardinality',
          label: 'Zone member cardinality',
        },
        cardinality,
      ),
      checkOutcome(
        { id: 'fk.zone.members', rule: 'foreign-key', label: 'Zone members → channel FK' },
        fkMembers,
      ),
      checkOutcome(
        {
          id: 'fk.zone.abChannel',
          rule: 'foreign-key',
          label: 'Zone A/B channel → channel FK',
        },
        fkAb,
      ),
    );
  }

  if (scanFile) {
    const table = csvToTable(scanFile.text);
    const nameLen: VerifyDiagnostic[] = [];
    const cardinality: VerifyDiagnostic[] = [];
    const fkMembers: VerifyDiagnostic[] = [];
    table.rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      const scanName = cell(table.headers, row, SCAN_LIST_COL.name);
      nameLen.push(
        ...checkNameLength(scanFile.name, SCAN_LIST_COL.name, rowNum, scanName, profile.nameLimit),
      );
      const members = cell(table.headers, row, SCAN_LIST_COL.members);
      cardinality.push(
        ...checkCardinality(
          scanFile.name,
          SCAN_LIST_COL.members,
          rowNum,
          members,
          profile.scanListMembers,
          'Scan list',
        ),
      );
      fkMembers.push(
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
    outcomes.push(
      checkOutcome(
        {
          id: 'name-length.ScanList.CSV',
          rule: 'name-length',
          label: 'Scan list name length',
        },
        nameLen,
      ),
      checkOutcome(
        {
          id: 'cardinality.scan.members',
          rule: 'cardinality',
          label: 'Scan list member cardinality',
        },
        cardinality,
      ),
      checkOutcome(
        {
          id: 'fk.scan.members',
          rule: 'foreign-key',
          label: 'Scan list members → channel FK',
        },
        fkMembers,
      ),
    );
  }

  if (rglFile) {
    const table = csvToTable(rglFile.text);
    const cardinality: VerifyDiagnostic[] = [];
    const fkContacts: VerifyDiagnostic[] = [];
    table.rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      const contacts = cell(table.headers, row, RX_GROUP_LIST_COL.contacts);
      cardinality.push(
        ...checkCardinality(
          rglFile.name,
          RX_GROUP_LIST_COL.contacts,
          rowNum,
          contacts,
          profile.rxGroupListMembers,
          'RX group list',
        ),
      );
      fkContacts.push(
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
    outcomes.push(
      checkOutcome(
        {
          id: 'cardinality.rxGroup.contacts',
          rule: 'cardinality',
          label: 'RX group list contact cardinality',
        },
        cardinality,
      ),
      checkOutcome(
        {
          id: 'fk.rxGroup.contacts',
          rule: 'foreign-key',
          label: 'RX group contacts → TG FK',
        },
        fkContacts,
      ),
    );
  }
}

function pushRequiredFileOutcomes(files: BundleFile[], outcomes: CheckOutcome[]): void {
  const names = new Set(files.map((f) => f.name));
  // Only enforce full-bundle required set when Channel.CSV is present (partial snippets skip)
  if (!names.has('Channel.CSV')) return;

  const coreMissing: VerifyDiagnostic[] = [];
  for (const required of REQUIRED_FULL_BUNDLE_FILES) {
    if (!names.has(required)) {
      coreMissing.push({
        rule: 'required-files',
        message: `Missing required file ${required} for Anytone full bundle verification.`,
      });
    }
  }
  outcomes.push(
    checkOutcome(
      {
        id: 'required.core-files',
        rule: 'required-files',
        label: 'Required Anytone core CSV files',
      },
      coreMissing,
    ),
  );

  const hasLst = [...names].some((n) => n.toUpperCase().endsWith('.LST'));
  const hasAllCore = REQUIRED_FULL_BUNDLE_FILES.every((n) => names.has(n));
  const lstPresence: VerifyDiagnostic[] = [];
  if (hasAllCore && !hasLst) {
    lstPresence.push({
      rule: 'required-files',
      message: 'Full Anytone bundle should include a .LST manifest sidecar.',
    });
  }
  outcomes.push(
    checkOutcome(
      {
        id: 'required.lst-manifest',
        rule: 'required-files',
        label: 'Anytone .LST manifest present',
      },
      lstPresence,
    ),
  );

  if (hasLst) {
    const lst = files.find((f) => f.name.toUpperCase().endsWith('.LST'));
    const lstEntries: VerifyDiagnostic[] = [];
    if (lst) {
      const listed = parseLstEntries(lst.text);
      for (const entry of listed) {
        if (!names.has(entry)) {
          lstEntries.push({
            rule: 'required-files',
            file: lst.name,
            message: `LST lists ${JSON.stringify(entry)} but file is not in the bundle.`,
          });
        }
      }
    }
    outcomes.push(
      checkOutcome(
        {
          id: 'required.lst-entries',
          rule: 'required-files',
          label: 'Anytone .LST entries resolve',
        },
        lstEntries,
      ),
    );
  }
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

export function verifyAnytoneDetailed(files: BundleFile[], profileId: string): CheckOutcome[] {
  const profile = getAnytoneProfile(profileId);
  const outcomes: CheckOutcome[] = [];
  for (const file of files) {
    pushPhysicalOutcomes(file, outcomes);
    if (file.name.toUpperCase().endsWith('.CSV')) {
      pushHeaderOutcome(file, outcomes);
    }
  }
  pushCrossFileOutcomes(files, profile, outcomes);
  pushRequiredFileOutcomes(files, outcomes);
  return outcomes;
}

export function verifyAnytone(files: BundleFile[], profileId: string): VerifyDiagnostic[] {
  return flattenOutcomes(verifyAnytoneDetailed(files, profileId));
}

export const anytoneVerifier: FormatVerifier = {
  id: 'anytone',
  label: 'Anytone CPS CSV',
  defaultProfileId: DEFAULT_ANYTONE_PROFILE_ID,
  supportedProfileIds: ANYTONE_PROFILES.map((p) => p.id),
  verifyDetailed: verifyAnytoneDetailed,
  verify: verifyAnytone,
};
