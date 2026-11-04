import type { ExportWarning } from '@core/import-export/exportWarning.ts';
/** CPS file export projection from directory shadow — vendor-neutral; wire at serialise boundary. */

import type { CpsExportOptions } from '@core/import-export/types.ts';
import { initialRevision } from '@core/models/revision.ts';
import type { DigitalContact } from '@core/models/library.ts';
import type { AssembledBuild, AssembledEntity } from '@core/services/assemble.ts';
import type { ProjectedDigitalContactRow } from './digitalIdDirectoryProjection.ts';

export interface CpsDm32RadioIdRow {
  dmrId: number;
  name: string;
}

/** OpenGD77 CPS zip has no User Database file — directory belongs on Web Serial Write. */
export const OPENGD77_CPS_DIRECTORY_WARNING =
  'OpenGD77 CPS export cannot write the firmware User Database (Write DMR IDs). Directory rows are omitted from Contacts.csv — use Web Serial Write with RadioID directory selected.';

/** DM-32 CPS DigitalContacts.csv is 250 rows; directory lookup is Web Serial address book. */
export const DM32_CPS_DIRECTORY_WARNING =
  'DM-32 CPS export cannot hold the RadioID directory in DigitalContacts.csv (250-row CPS cap) or DMR-ID.csv (operator TX identities). Directory rows are omitted — use Web Serial Write with RadioID directory selected.';

export interface CpsDirectoryProjectionPayload {
  warnings?: ExportWarning[];
  /** Dual-bank directory choice: library contacts and directory rows for the lookup file. */
  dualBank?: {
    /** Library contacts in the lookup file (and, unless kept below, in the assembly). */
    includeLibraryContacts: boolean;
    /** Directory rows for the lookup file (Anytone `DMRDigitalContactList.CSV`). */
    directoryDigitalContacts: AssembledEntity<DigitalContact>[];
    dm32RadioIds: CpsDm32RadioIdRow[];
    includeDm32RadioIdFile: boolean;
    /**
     * Library contacts also live in the talk-group list (AT-D890), so the toggle selects only
     * the lookup file rows.
     */
    keepLibraryContactsInAssembly?: boolean;
  };
}

/**
 * Shared fields of every projected directory contact. These entities exist only inside one export
 * and are never stored, so there is no per-row id or clock: minting them (a UUID and a timestamp)
 * for every row of a 300k-row directory cost seconds for nothing.
 */
const DIRECTORY_PROJECTION_CONTACT_BASE = {
  revision: initialRevision(),
  updatedAt: '1970-01-01T00:00:00.000Z',
  mode: 'dmr',
  comment: '',
} as const;

export function projectedRowToAssembledDigitalContact(
  row: ProjectedDigitalContactRow,
  projectId: string,
): AssembledEntity<DigitalContact> {
  const id = `directory-proj:${row.digitalId}`;
  return {
    entity: {
      ...DIRECTORY_PROJECTION_CONTACT_BASE,
      id,
      projectId,
      name: row.wireName,
      digitalId: row.digitalId,
      callsign: row.callsign,
      city: row.city,
      state: row.province,
      country: row.country,
      remarks: row.remark,
    },
    wireName: row.wireName,
  };
}

export function applyCpsDigitalDirectoryProjection(
  assembled: AssembledBuild,
  options: CpsExportOptions,
): { assembled: AssembledBuild; warnings: ExportWarning[] } {
  const payload = options.directoryProjection;
  if (!payload) {
    return { assembled, warnings: [] };
  }

  const warnings = [...(payload.warnings ?? [])];

  const dual = payload.dualBank;
  if (dual?.keepLibraryContactsInAssembly) {
    return { assembled, warnings };
  }
  if (dual) {
    const digitalContacts = dual.includeLibraryContacts ? [...assembled.digitalContacts] : [];
    return { assembled: { ...assembled, digitalContacts }, warnings };
  }

  return { assembled, warnings };
}
