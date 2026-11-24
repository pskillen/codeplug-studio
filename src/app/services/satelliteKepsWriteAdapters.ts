/**
 * Satellite-keps write adapters (#859). Limits, preview and exclusions come from each
 * `RadioDescriptor.satelliteKeps`; the write functions stay here because they use app services.
 */

import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import { pushKepsExcludedWarning } from '@core/import-export/exportWarning.ts';
import { isEntityExcluded } from '@core/domain/formatBuildOverrides.ts';
import type { BuildEntityOverride } from '@core/models/radioBuild.ts';
import type { Satellite } from '@core/models/satellite.ts';
import type { ProgressFn, RadioSession } from '@integrations/radio-io/index.ts';
import { listDescriptorsForProfile } from '@integrations/radio-io/registry.ts';
import type {
  SatelliteKepsExclusion,
  SatelliteKepsExclusionsFn,
  SatelliteKepsPreviewEntry,
  SatelliteKepsPreviewFn,
  SatelliteKepsPreviewOptions,
} from '@integrations/radio-io/satelliteKepsCapability.ts';
import type { CapabilitySkippedTransmitter } from '@integrations/radio-io/radios/at-d890uv/index.ts';
import {
  countWriteEligibleSatelliteRecords,
  writeSatellitesToRadio,
} from './radioIoAtD890SatelliteWrite.ts';
import {
  countWriteEligibleSatelliteRecords as countOpenGd77WriteEligibleSatellites,
  writeOpenGd77SatellitesToRadio,
} from './radioIoOpenGd77SatelliteWrite.ts';

export type {
  SatelliteKepsExclusion,
  SatelliteKepsExclusionsFn,
  SatelliteKepsPreviewEntry as SatelliteKepsWritePreviewEntry,
  SatelliteKepsPreviewFn as SatelliteKepsWritePreviewFn,
  SatelliteKepsPreviewOptions as SatelliteKepsWritePreviewOptions,
};

export interface SatelliteKepsWriteResult {
  written: number;
  skipped: { satelliteId: string; reason: string }[];
  /** Transmitters skipped for a radio-capability reason (e.g. unsupported mode), #1068. */
  skippedTransmitters: CapabilitySkippedTransmitter[];
}

export type SatelliteKepsWriteFn = (
  session: RadioSession,
  satellites: readonly Satellite[],
  opts?: {
    onProgress?: ProgressFn;
    signal?: AbortSignal;
    satelliteOverrides?: readonly BuildEntityOverride[];
  },
) => Promise<SatelliteKepsWriteResult>;

/** Profile → write fn — the only profile-keyed table; everything else uses the descriptor. */
const KEPS_WRITE_BY_PROFILE: Readonly<Record<string, SatelliteKepsWriteFn>> = {
  'radio-io-at-d890uv': writeSatellitesToRadio,
  'radio-io-at-d890uv-mm9pdy': writeSatellitesToRadio,
  'radio-io-opengd77-1701': writeOpenGd77SatellitesToRadio,
  'radio-io-opengd77-md9600': writeOpenGd77SatellitesToRadio,
};

/** @deprecated Use `getSatelliteKepsWriteAdapter`; kept for tests that pin the write-fn table. */
export const SATELLITE_KEPS_WRITE_ADAPTERS = KEPS_WRITE_BY_PROFILE;

/**
 * Profiles whose keps writer can run in the codeplug's own session, after `upload()` and before
 * END. Empty today (#1406).
 */
const KEPS_SAME_SESSION_AFTER_UPLOAD: ReadonlySet<string> = new Set<string>();

function descriptorKepsForProfile(profileId: string) {
  return listDescriptorsForProfile('radio-io', profileId)[0]?.satelliteKeps;
}

function countEligibleForWriteFn(
  writeFn: SatelliteKepsWriteFn,
  satellites: readonly Satellite[],
  overrides?: readonly BuildEntityOverride[],
): number {
  if (writeFn === writeSatellitesToRadio) {
    return countWriteEligibleSatelliteRecords(satellites, overrides);
  }
  if (writeFn === writeOpenGd77SatellitesToRadio) {
    return countOpenGd77WriteEligibleSatellites(satellites, overrides);
  }
  return 0;
}

export function satelliteKepsSameSessionAfterUpload(profileId: string): boolean {
  return KEPS_SAME_SESSION_AFTER_UPLOAD.has(profileId);
}

export function hasSatelliteKepsWriteAdapter(profileId: string): boolean {
  return Boolean(descriptorKepsForProfile(profileId) && KEPS_WRITE_BY_PROFILE[profileId]);
}

export function getSatelliteKepsWriteAdapter(profileId: string): SatelliteKepsWriteFn | undefined {
  if (!descriptorKepsForProfile(profileId)) return undefined;
  return KEPS_WRITE_BY_PROFILE[profileId];
}

export interface SatelliteKepsWriteCapacity {
  max: number;
  countEligible: (
    satellites: readonly Satellite[],
    overrides?: readonly BuildEntityOverride[],
  ) => number;
  nameLength: number;
  unitNoun: string;
  nameScope: 'spacecraft' | 'transmitter';
  limitsDoc: string;
}

export function getSatelliteKepsWriteCapacity(
  profileId: string,
): SatelliteKepsWriteCapacity | undefined {
  const keps = descriptorKepsForProfile(profileId);
  const writeFn = KEPS_WRITE_BY_PROFILE[profileId];
  if (!keps || !writeFn) return undefined;
  return {
    ...keps.limits,
    countEligible: (satellites, overrides) =>
      countEligibleForWriteFn(writeFn, satellites, overrides),
  };
}

export function formatSatelliteKepsCapacityWarning(
  eligibleCount: number,
  max: number,
  opts?: { unitNoun?: string; limitsDoc?: string },
): string | null {
  if (eligibleCount <= max) return null;
  const unitNoun = opts?.unitNoun ?? 'transmitter';
  const limitsDoc = opts?.limitsDoc ?? 'docs/reference/radios/anytone/at-d890uv/satellite-keps.md';
  return (
    `${eligibleCount} ${unitNoun}(s) are eligible to write, but this radio only supports ` +
    `${max} (see ${limitsDoc}). Deselect some satellites or transmitters in the library before writing.`
  );
}

export function satelliteKepsCapacityWarning(
  profileId: string,
  satellites: readonly Satellite[],
  overrides?: readonly BuildEntityOverride[],
): string | null {
  const capacity = getSatelliteKepsWriteCapacity(profileId);
  if (!capacity) return null;
  return formatSatelliteKepsCapacityWarning(
    capacity.countEligible(satellites, overrides),
    capacity.max,
    {
      unitNoun: capacity.unitNoun,
      limitsDoc: capacity.limitsDoc,
    },
  );
}

const NOTHING_KEPS_ELIGIBLE_REFUSAL =
  'Nothing to write: none of the enabled satellites has a transmitter this radio can carry. Check the satellites in the library.';

function isOpenGd77BuildSlotSkip(reason: string): boolean {
  return (
    reason.startsWith('Not selected for ') ||
    reason === 'Only one FM pair fits an OpenGD77 satellite record.' ||
    reason === 'Only one APRS pair fits an OpenGD77 satellite record.' ||
    reason === 'Only one beacon frequency fits an OpenGD77 satellite record.'
  );
}

function kepsExcludedLabel(
  satellites: readonly Satellite[],
  exclusion: SatelliteKepsExclusion,
): string {
  const satellite = satellites.find((s) => s.id === exclusion.satelliteId);
  const name = satellite?.name ?? exclusion.satelliteId;
  if (exclusion.transmitterId == null) return name;
  const transmitter = satellite?.transmitters.find((t) => t.id === exclusion.transmitterId);
  const txLabel = transmitter?.label ?? exclusion.transmitterId;
  return `${name} / ${txLabel}`;
}

export interface KepsWriteChecksResult {
  refusals: { message: string; retry: 'none' }[];
  warnings: ExportWarning[];
  eligible: number;
}

export function kepsWriteChecks(
  profileId: string,
  satellites: readonly Satellite[],
  overrides?: readonly BuildEntityOverride[],
): KepsWriteChecksResult {
  const capacity = getSatelliteKepsWriteCapacity(profileId);
  const eligible = capacity?.countEligible(satellites, overrides) ?? 0;
  const refusals: KepsWriteChecksResult['refusals'] = [];
  const warnings: ExportWarning[] = [];

  if (capacity) {
    const capacityMsg = formatSatelliteKepsCapacityWarning(eligible, capacity.max, {
      unitNoun: capacity.unitNoun,
      limitsDoc: capacity.limitsDoc,
    });
    if (capacityMsg) refusals.push({ message: capacityMsg, retry: 'none' });
  }

  if (capacity && eligible === 0 && satellites.length > 0) {
    refusals.push({ message: NOTHING_KEPS_ELIGIBLE_REFUSAL, retry: 'none' });
  }

  const exclusionsFn = getSatelliteKepsExclusions(profileId);
  if (exclusionsFn) {
    for (const exclusion of exclusionsFn(satellites, { satelliteOverrides: overrides })) {
      if (isEntityExcluded(overrides, exclusion.satelliteId)) continue;
      if (exclusion.transmitterId != null && isEntityExcluded(overrides, exclusion.transmitterId)) {
        continue;
      }
      if (isOpenGd77BuildSlotSkip(exclusion.reason)) continue;
      pushKepsExcludedWarning(warnings, {
        satelliteId: exclusion.satelliteId,
        transmitterId: exclusion.transmitterId,
        reason: exclusion.reason,
        label: kepsExcludedLabel(satellites, exclusion),
      });
    }
  }

  return { refusals, warnings, eligible };
}

export function getSatelliteKepsWritePreview(
  profileId: string,
): SatelliteKepsPreviewFn | undefined {
  return descriptorKepsForProfile(profileId)?.preview;
}

export function getSatelliteKepsExclusions(
  profileId: string,
): SatelliteKepsExclusionsFn | undefined {
  return descriptorKepsForProfile(profileId)?.exclusions;
}
