import type { RadioBackupManifestV1 } from '../../backup/types.ts';
import {
  regionSections,
  type DebugCompareAdapter,
  type RegionIdentity,
} from '../../debugCompare/index.ts';
import { dm32DecodedSnapshot } from './debugCompareDecoded.ts';
import { classifyDm32DebugCoverage, dm32DebugIdentity } from './debugCoverage.ts';
import { selectDm32LiveCalibration } from './calibrationFields.ts';
import {
  DM32_FACTORY_SECTOR_REGION_ID,
  decodeDm32CalibrationPage,
  decodeDm32FactorySector,
} from './calibrationDecode.ts';

/** Address space and representation of a DM-32 region: the factory sector, or a window region. */
export function dm32DebugRegionIdentity(
  archive: Dm32CompareArchive,
  id: string,
): RegionIdentity | undefined {
  const coverage = classifyDm32DebugCoverage(archive.manifest, archive.regions, archive.sidecars);
  const unclassified = coverage.unclassified.some((entry) => entry.region.id === id);
  if (coverage.factory?.id === id && !unclassified)
    return { space: 'DM-32 factory sector', representation: 'factory sector bytes' };
  if (
    id !== DM32_FACTORY_SECTOR_REGION_ID &&
    coverage.windowRegions.some((region) => region.id === id) &&
    !unclassified
  )
    return { space: 'DM-32 configuration', representation: 'configuration bytes' };
  return undefined;
}

export const dm32CompareAdapter: DebugCompareAdapter = {
  sections: (a, b) => regionSections(a, b, dm32DebugRegionIdentity),
  regionIdentity: dm32DebugRegionIdentity,
  decoded: dm32DecodedSnapshot,
};

export interface Dm32CompareArchive {
  manifest: RadioBackupManifestV1;
  regions: Record<string, Uint8Array>;
  sidecars: Record<string, Uint8Array>;
}

function flatten(target: Record<string, unknown>, prefix: string, value: unknown): void {
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) flatten(target, `${prefix} / ${key}`, child);
  } else target[prefix] = value;
}

/** Decode only classified captured bytes. Sidecar decoded summaries are not evidence. */
export function dm32ComparisonEvidence(archive: Dm32CompareArchive): Record<string, unknown> {
  const selection = selectDm32LiveCalibration(archive);
  const coverage = selection.coverage;
  const identity = dm32DebugIdentity(archive.sidecars, coverage.windowRegions, archive.regions);
  const fields: Record<string, unknown> = {
    'Identity / Model': identity.modelString,
    'Identity / Base firmware': identity.baseFirmware?.failed
      ? undefined
      : identity.baseFirmware?.hex,
    'Identity / Build date': identity.buildDate?.failed ? undefined : identity.buildDate?.hex,
    'Identity / DSP version': identity.dspVersion?.failed ? undefined : identity.dspVersion?.hex,
    'Identity / Radio version': identity.radioVersion?.failed
      ? undefined
      : identity.radioVersion?.hex,
    'Identity / Codeplug version': identity.codeplugVersion?.failed
      ? undefined
      : identity.codeplugVersion?.hex,
    'Identity / Chip UID (not a serial)': identity.chipUidHex,
  };
  if (selection.page && selection.address !== undefined) {
    const decoded = decodeDm32CalibrationPage(selection.page, selection.address);
    for (const [key, value] of Object.entries(decoded)) {
      if (key !== 'unknownRows' && key !== 'bootScalars' && key !== 'address')
        flatten(fields, `Calibration / ${key}`, value);
    }
  } else fields['Calibration'] = undefined;
  if (
    coverage.factory &&
    !coverage.unclassified.some((entry) => entry.region.id === coverage.factory?.id)
  ) {
    const decoded = decodeDm32FactorySector(archive.regions[coverage.factory.id]!);
    for (const [key, value] of Object.entries(decoded)) {
      if (key !== 'antiCloneKeyHex' && key !== 'address')
        flatten(fields, `Factory / ${key}`, value);
    }
  } else fields['Factory'] = undefined;
  return fields;
}

export function compareDm32Evidence(first: Dm32CompareArchive, second: Dm32CompareArchive) {
  const a = dm32ComparisonEvidence(first);
  const b = dm32ComparisonEvidence(second);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].map((field) => {
    const left = a[field];
    const right = b[field];
    const unavailable = (v: unknown) =>
      v === undefined ||
      v === null ||
      (typeof v === 'object' && JSON.stringify(v).includes('null'));
    return {
      field,
      left,
      right,
      status:
        unavailable(left) || unavailable(right)
          ? 'Unavailable'
          : JSON.stringify(left) === JSON.stringify(right)
            ? 'Unchanged'
            : 'Changed',
    };
  });
}
