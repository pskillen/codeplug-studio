/**
 * CHIRP CSV wire verifier plugin.
 *
 * Tier-3 documentation sources:
 * - docs/reference/chirp/README.md
 * - docs/reference/chirp/channels.md
 * - docs/reference/chirp/radios/chirp-uv5r.md
 */

import { csvToTable } from '../../../../src/core/import-export/csvParse.ts';
import { CHIRP_HEADERS } from '../../../../src/core/import-export/formats/chirp/columns.ts';
import {
  CHIRP_PROFILES,
  DEFAULT_CHIRP_PROFILE_ID,
  getChirpProfile,
} from '../../../../src/core/import-export/formats/chirp/profiles.ts';
import type { BundleFile, FormatVerifier, VerifyDiagnostic } from '../../types.ts';
import { checkNameLength } from '../../rules/foreignKeys.ts';
import { checkExactHeaders } from '../../rules/headers.ts';
import { checkLfLineEndings } from '../../rules/lfLineEndings.ts';
import { checkSelectiveQuoting } from '../../rules/selectiveQuoting.ts';

function isCsv(name: string): boolean {
  return name.toLowerCase().endsWith('.csv');
}

function verifyPhysical(file: BundleFile): VerifyDiagnostic[] {
  if (!isCsv(file.name)) return [];
  return [
    ...checkLfLineEndings(file.name, file.text),
    ...checkSelectiveQuoting(file.name, file.text),
  ];
}

function verifyCsvContent(
  file: BundleFile,
  profile: ReturnType<typeof getChirpProfile>,
): VerifyDiagnostic[] {
  const diagnostics: VerifyDiagnostic[] = [];
  const table = csvToTable(file.text);
  diagnostics.push(...checkExactHeaders(file.name, table.headers, [...CHIRP_HEADERS]));

  if (table.rows.length > profile.maxMemorySlots) {
    diagnostics.push({
      rule: 'cardinality',
      file: file.name,
      message: `Channel row count ${table.rows.length} exceeds max memory slots ${profile.maxMemorySlots}.`,
    });
  }

  const nameIdx = table.headers.indexOf('Name');
  if (nameIdx >= 0) {
    table.rows.forEach((row, idx) => {
      const name = row[nameIdx] ?? '';
      diagnostics.push(...checkNameLength(file.name, 'Name', idx + 1, name, profile.nameLimit));
    });
  }

  return diagnostics;
}

export function verifyChirp(files: BundleFile[], profileId: string): VerifyDiagnostic[] {
  const profile = getChirpProfile(profileId);
  const csvFiles = files.filter((f) => isCsv(f.name));
  const diagnostics: VerifyDiagnostic[] = [];

  if (csvFiles.length === 0) {
    diagnostics.push({
      rule: 'required-files',
      message: 'CHIRP verification requires at least one .csv file.',
    });
    return diagnostics;
  }

  for (const file of csvFiles) {
    diagnostics.push(...verifyPhysical(file));
    diagnostics.push(...verifyCsvContent(file, profile));
  }
  return diagnostics;
}

export const chirpVerifier: FormatVerifier = {
  id: 'chirp',
  label: 'CHIRP CSV',
  defaultProfileId: DEFAULT_CHIRP_PROFILE_ID,
  supportedProfileIds: CHIRP_PROFILES.map((p) => p.id),
  verify: verifyChirp,
};
