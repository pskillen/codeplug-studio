import type { ParsedRadioBackupZip } from '../backup/parse.ts';

/** What an Overview identity builder reads from the open archive. A debug archive satisfies it. */
export type DebugIdentityArchive = ParsedRadioBackupZip & { source: 'file' | 'live-read' };

/** The Overview "Identity and firmware" rows after `Model · selected`: label, value. */
export type DebugIdentityRows = readonly (readonly [string, string])[];

export interface DebugIdentityInput {
  archive?: DebugIdentityArchive;
  /** The page's connection line: "Not connected", "Reading radio…", … */
  connection: string;
  /** The profile's family label, as a profile with no identity evidence of its own shows it. */
  family: string;
}

/**
 * Rows for a profile that has no identity evidence beyond the archive manifest. Names no radio.
 * `firmwareMod` and `evidence` let a radio that validates more say so.
 */
export function genericIdentityRows(
  { archive, connection, family }: DebugIdentityInput,
  extra?: { firmwareMod?: string; evidence?: string },
): DebugIdentityRows {
  return [
    ['Expected family', family],
    ['Serial · archive', archive?.manifest.serial || 'Unknown'],
    ['Firmware · archive', archive?.manifest.firmware || 'Unknown'],
    ['Firmware mod', extra?.firmwareMod ?? 'Unknown'],
    ['Evidence', extra?.evidence ?? (archive ? 'Archive manifest' : 'No radio identity observed')],
    ['Connection', connection],
  ];
}
