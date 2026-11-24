import type { RadioBackupManifestV1 } from '../../backup/types.ts';
import {
  RADIOFOUNDRY_DEBUG_INFO_SIDECAR,
  RADIOFOUNDRY_DEBUG_SUMS_SIDECAR,
  RADIOFOUNDRY_REGION,
} from './debugCapture.ts';
import { BLOCK_SIZE } from './constants.ts';
import { DMR_ID_DATABASE_AREA2_ADDRESS } from './idDatabase.ts';
import { radioFoundryCableBoardForModelId } from './board.ts';

export interface RadioFoundryCoverageRegion {
  id: string;
  label: string;
  start: number;
  end: number;
  blocksRead: number;
  blocksBlank: number;
}

export interface RadioFoundryCoverage {
  regions: readonly RadioFoundryCoverageRegion[];
  area2:
    { state: 'not-read' } | { state: 'read'; readTo: number; blankAfter: number; imageEnd: number };
  gap: { start: number; end: number };
  sums: 'present' | 'missing';
}

function readU32(data: Uint8Array, offset: number): number {
  return (
    (data[offset]! |
      (data[offset + 1]! << 8) |
      (data[offset + 2]! << 16) |
      (data[offset + 3]! << 24)) >>>
    0
  );
}

function parseSumsRows(sums: Uint8Array): { address: number; blank: boolean }[] {
  const rows: { address: number; blank: boolean }[] = [];
  for (let i = 0; i + 9 <= sums.length; i += 9) {
    rows.push({
      address: readU32(sums, i),
      blank: sums[i + 8]! !== 0,
    });
  }
  return rows;
}

function countBlocksInRange(
  rows: readonly { address: number; blank: boolean }[],
  start: number,
  end: number,
): { blocksRead: number; blocksBlank: number } {
  let blocksRead = 0;
  let blocksBlank = 0;
  for (const row of rows) {
    if (row.address < start || row.address >= end) continue;
    if (row.blank) blocksBlank += 1;
    else blocksRead += 1;
  }
  return { blocksRead, blocksBlank };
}

/** Classify a RadioFoundry partial archive for the Backup coverage panel; undefined for other radios. */
export function classifyRadioFoundryDebugCoverage(
  manifest: RadioBackupManifestV1,
  regions: Record<string, Uint8Array>,
  sidecars: Record<string, Uint8Array>,
): RadioFoundryCoverage | undefined {
  const board = radioFoundryCableBoardForModelId(manifest.radioModelId);
  if (!board) return undefined;

  const sumsBytes = sidecars[RADIOFOUNDRY_DEBUG_SUMS_SIDECAR];
  const sumsPresent = sumsBytes != null;
  const sumRows = sumsPresent ? parseSumsRows(sumsBytes) : [];

  const info = sidecars[RADIOFOUNDRY_DEBUG_INFO_SIDECAR];
  const reportedEnd = info && info.length >= 20 ? readU32(info, 16) : board.limits.IMAGE_END;
  const imageEnd = Math.min(reportedEnd, board.limits.IMAGE_END);

  const regionDefs: { id: string; label: string }[] = [
    { id: RADIOFOUNDRY_REGION.eeprom, label: 'EEPROM image' },
    { id: RADIOFOUNDRY_REGION.flash, label: 'Flash image' },
    { id: RADIOFOUNDRY_REGION.area2, label: 'DMR ID database area 2' },
  ];

  const coverageRegions: RadioFoundryCoverageRegion[] = [];
  for (const def of regionDefs) {
    const entry = manifest.regions.find((r) => r.id === def.id);
    if (!entry) continue;
    const bytes = regions[def.id];
    const end = entry.address + (bytes?.length ?? entry.byteLength);
    const { blocksRead, blocksBlank } = countBlocksInRange(sumRows, entry.address, end);
    coverageRegions.push({
      id: def.id,
      label: def.label,
      start: entry.address,
      end,
      blocksRead,
      blocksBlank,
    });
  }

  const area2Region = manifest.regions.find((r) => r.id === RADIOFOUNDRY_REGION.area2);
  const area2Sums = sumRows.filter((r) => r.address >= DMR_ID_DATABASE_AREA2_ADDRESS);
  let area2: RadioFoundryCoverage['area2'];
  if (!area2Region && area2Sums.length === 0) {
    area2 = { state: 'not-read' };
  } else {
    const readTo = area2Region
      ? area2Region.address + area2Region.byteLength
      : DMR_ID_DATABASE_AREA2_ADDRESS;
    const blankAfter = sumRows.filter(
      (r) => r.blank && r.address >= readTo && r.address < imageEnd,
    ).length;
    area2 = { state: 'read', readTo, blankAfter, imageEnd };
  }

  return {
    regions: coverageRegions,
    area2,
    gap: { start: 0x10000, end: 0x20000 },
    sums: sumsPresent ? 'present' : 'missing',
  };
}

/** Models that classify as RadioFoundry debug. */
export function isRadioFoundryDebugModelId(modelId: string): boolean {
  return radioFoundryCableBoardForModelId(modelId) != null;
}
