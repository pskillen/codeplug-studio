/** CPS file export projection from directory shadow — vendor-neutral; wire at serialise boundary. */

import type { CpsExportOptions } from '@core/import-export/types.ts';
import { newDigitalContact } from '@core/domain/factories.ts';
import type { DigitalContact } from '@core/models/library.ts';
import type { AssembledBuild, AssembledEntity } from '@core/services/assemble.ts';
import type { ProjectedDigitalContactRow } from './digitalIdDirectoryProjection.ts';

export interface CpsDm32RadioIdRow {
  dmrId: number;
  name: string;
}

export interface CpsDirectoryProjectionPayload {
  warnings?: string[];
  /** Single-bank replacement list (Anytone `DMRDigitalContactList.CSV`). */
  singleBankDigitalContacts?: AssembledEntity<DigitalContact>[];
  /** When true, emit header-only digital contact CPS files (single-bank skip). */
  omitDigitalContactList?: boolean;
  dualBank?: {
    includeLibraryContacts: boolean;
    directoryDigitalContacts: AssembledEntity<DigitalContact>[];
    dm32RadioIds: CpsDm32RadioIdRow[];
    includeDm32RadioIdFile: boolean;
  };
}

export function projectedRowToAssembledDigitalContact(
  row: ProjectedDigitalContactRow,
  projectId: string,
): AssembledEntity<DigitalContact> {
  const id = `directory-proj:${row.digitalId}`;
  return {
    entity: {
      ...newDigitalContact(projectId, row.wireName, row.digitalId, 'dmr'),
      id,
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
): { assembled: AssembledBuild; warnings: string[] } {
  const payload = options.directoryProjection;
  if (!payload) {
    return { assembled, warnings: [] };
  }

  const warnings = [...(payload.warnings ?? [])];

  if (payload.omitDigitalContactList) {
    return { assembled: { ...assembled, digitalContacts: [] }, warnings };
  }

  if (payload.singleBankDigitalContacts) {
    return {
      assembled: { ...assembled, digitalContacts: payload.singleBankDigitalContacts },
      warnings,
    };
  }

  const dual = payload.dualBank;
  if (dual) {
    let digitalContacts = dual.includeLibraryContacts ? [...assembled.digitalContacts] : [];
    if (dual.directoryDigitalContacts.length > 0) {
      digitalContacts = [...digitalContacts, ...dual.directoryDigitalContacts];
    }
    return { assembled: { ...assembled, digitalContacts }, warnings };
  }

  return { assembled, warnings };
}
