import {
  AT_D890_VITAL_UNITS,
  AT_D890_VITAL_UNIT_BYTES,
} from '@integrations/radio-io/radios/at-d890uv/vitalBackup.ts';
import { AT_D890_MAP_SIZE } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { atD890VitalComparison } from '@integrations/radio-io/radios/at-d890uv/debugCoverage.ts';
import type { DebugArchive } from './captureArchive.ts';

export const AT_D890_PROVENANCE_PATH = 'debug/read-provenance.json';

/** Acquisition facts are archive claims, not proof of the physical responding unit. */
export interface AtD890ReadProvenance {
  version: 1;
  ranges: AtD890ReadRange[];
}
export interface AtD890ReadRange {
  regionId: string;
  address: number;
  byteLength: number;
  kind: 'sparse' | 'vital';
  requestedUnit: string | null;
  respondingUnit: string | null;
  bothReadsMatched: boolean | null;
}

/** Reject the whole claim if any range contradicts the stored region or known acquisition layout. */
export function readAtD890Provenance(archive: DebugArchive): AtD890ReadProvenance | undefined {
  const data = archive.sidecars[AT_D890_PROVENANCE_PATH];
  if (!data || archive.manifest.radioModelId !== 'AT-D890UV') return undefined;
  try {
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data));
    if (!value || typeof value !== 'object') return undefined;
    const claim = value as Partial<AtD890ReadProvenance>;
    if (
      claim.version !== 1 ||
      !Array.isArray(claim.ranges) ||
      claim.ranges.length !== archive.manifest.regions.length
    )
      return undefined;
    if (
      claim.ranges.some((range) => range?.kind === 'vital') &&
      !atD890VitalComparison(archive.sidecars['debug/vital.json'])
    )
      return undefined;
    const seen = new Set<string>();
    for (const item of claim.ranges) {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof item.regionId !== 'string' ||
        seen.has(item.regionId)
      )
        return undefined;
      seen.add(item.regionId);
      const region = archive.manifest.regions.find((r) => r.id === item.regionId);
      if (
        !region ||
        region.restoreRole !== 'inspect-only' ||
        !Number.isSafeInteger(item.address) ||
        !Number.isSafeInteger(item.byteLength) ||
        item.address < 0 ||
        item.byteLength <= 0 ||
        !Number.isSafeInteger(item.address + item.byteLength) ||
        region.address !== item.address ||
        region.byteLength !== item.byteLength ||
        archive.regions[item.regionId]?.length !== item.byteLength
      )
        return undefined;
      // No current capture API supplies physical responding-unit evidence, so the app never writes
      // one. A sidecar may carry an explicit claim for a vital unit only; it must name a known unit.
      // Sparse configuration has no unit identity to claim.
      if (item.respondingUnit !== null) {
        if (
          item.kind !== 'vital' ||
          typeof item.respondingUnit !== 'string' ||
          !AT_D890_VITAL_UNITS.some((u) => u.id === item.respondingUnit)
        )
          return undefined;
      }
      if (item.kind === 'sparse') {
        if (
          item.regionId !== `sparse-${item.address.toString(16)}` ||
          item.requestedUnit !== null ||
          item.bothReadsMatched !== null
        )
          return undefined;
      } else if (item.kind === 'vital') {
        const unit = AT_D890_VITAL_UNITS.find((u) => u.id === item.requestedUnit);
        if (
          !unit ||
          item.regionId !== `vital-${unit.id}` ||
          item.address !== unit.address ||
          item.byteLength !== AT_D890_VITAL_UNIT_BYTES ||
          item.bothReadsMatched !== true
        )
          return undefined;
      } else return undefined;
    }
    return claim as AtD890ReadProvenance;
  } catch {
    return undefined;
  }
}

/**
 * Only sparse ranges inside the real AT-D890UV memory map are classified. A sparse range beyond it
 * (for example NXDN reads past the virtual map) stays unclassified and is never compared.
 */
export function isAtD890ClassifiedRange(range: AtD890ReadRange): boolean {
  return range.kind === 'vital' || range.address + range.byteLength <= AT_D890_MAP_SIZE;
}
