/**
 * CHIRP CSV wire verifier plugin.
 *
 * Tier-3 documentation sources:
 * - docs/reference/export-formats/chirp/README.md
 * - docs/reference/export-formats/chirp/channels.md
 * - docs/reference/export-formats/chirp/enum-verification.md
 * - docs/reference/export-formats/chirp/radios/
 */

import { csvToTable } from '../../../../src/core/import-export/csvParse.ts';
import { CHIRP_HEADERS } from '../../../../src/core/import-export/formats/chirp/columns.ts';
import {
  CHIRP_PROFILES,
  DEFAULT_CHIRP_PROFILE_ID,
  getChirpProfile,
} from '../../../../src/core/import-export/formats/chirp/profiles.ts';
import type { BundleFile, CheckOutcome, FormatVerifier, VerifyDiagnostic } from '../../types.ts';
import { checkOutcome, flattenOutcomes } from '../../types.ts';
import { checkNameLength } from '../../rules/foreignKeys.ts';
import { checkExactHeaders } from '../../rules/headers.ts';
import { checkLfLineEndings } from '../../rules/lfLineEndings.ts';
import { checkSelectiveQuoting } from '../../rules/selectiveQuoting.ts';

function isCsv(name: string): boolean {
  return name.toLowerCase().endsWith('.csv');
}

function pushPhysicalOutcomes(file: BundleFile, outcomes: CheckOutcome[]): void {
  if (!isCsv(file.name)) return;
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

function pushCsvContentOutcomes(
  file: BundleFile,
  profile: ReturnType<typeof getChirpProfile>,
  outcomes: CheckOutcome[],
): void {
  const table = csvToTable(file.text);

  outcomes.push(
    checkOutcome(
      {
        id: `headers.${file.name}`,
        rule: 'headers',
        label: `${file.name} exact headers`,
      },
      checkExactHeaders(file.name, table.headers, [...CHIRP_HEADERS]),
    ),
  );

  const memorySlots: VerifyDiagnostic[] = [];
  if (table.rows.length > profile.maxMemorySlots) {
    memorySlots.push({
      rule: 'cardinality',
      file: file.name,
      message: `Channel row count ${table.rows.length} exceeds max memory slots ${profile.maxMemorySlots}.`,
    });
  }
  outcomes.push(
    checkOutcome(
      {
        id: 'cardinality.memory-slots',
        rule: 'cardinality',
        label: 'Memory slot cardinality',
      },
      memorySlots,
    ),
  );

  const nameIdx = table.headers.indexOf('Name');
  const nameLen: VerifyDiagnostic[] = [];
  if (nameIdx >= 0) {
    table.rows.forEach((row, idx) => {
      const name = row[nameIdx] ?? '';
      nameLen.push(...checkNameLength(file.name, 'Name', idx + 1, name, profile.nameLimit));
    });
  }
  outcomes.push(
    checkOutcome(
      {
        id: 'name-length.Name',
        rule: 'name-length',
        label: 'Channel Name length',
      },
      nameLen,
    ),
  );
}

export function verifyChirpDetailed(files: BundleFile[], profileId: string): CheckOutcome[] {
  const profile = getChirpProfile(profileId);
  const csvFiles = files.filter((f) => isCsv(f.name));
  const outcomes: CheckOutcome[] = [];

  if (csvFiles.length === 0) {
    outcomes.push(
      checkOutcome(
        {
          id: 'required.core-files',
          rule: 'required-files',
          label: 'Required CHIRP CSV file',
        },
        [
          {
            rule: 'required-files',
            message: 'CHIRP verification requires at least one .csv file.',
          },
        ],
      ),
    );
    return outcomes;
  }

  for (const file of csvFiles) {
    pushPhysicalOutcomes(file, outcomes);
    pushCsvContentOutcomes(file, profile, outcomes);
  }
  return outcomes;
}

export function verifyChirp(files: BundleFile[], profileId: string): VerifyDiagnostic[] {
  return flattenOutcomes(verifyChirpDetailed(files, profileId));
}

export const chirpVerifier: FormatVerifier = {
  id: 'chirp',
  label: 'CHIRP CSV',
  defaultProfileId: DEFAULT_CHIRP_PROFILE_ID,
  supportedProfileIds: CHIRP_PROFILES.map((p) => p.id),
  verifyDetailed: verifyChirpDetailed,
  verify: verifyChirp,
};
