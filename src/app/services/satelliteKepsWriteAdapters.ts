/**
 * Registry of profileIds with a satellite-keps write adapter (#859).
 *
 * Nothing else in the codebase answers "which connected/configured radios support a keps
 * write." `RadioDescriptor` (`@integrations/radio-io/types.ts`) has
 * `writeStrategy` and `writeVerify` — all about full-codeplug write. This registry is the
 * satellite-keps-specific analogue: it lets Workflow A/B call sites ask "does this
 * formatId/profileId support a keps write" without hardcoding a D890-only check at every
 * call site. OpenGD77 DM-1701 / MD-9600 (#858) share one packer registered twice.
 */

import type { BuildEntityOverride } from '@core/models/radioBuild.ts';
import type { Satellite } from '@core/models/satellite.ts';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import { OPENGD77_FAMILY_LIMITS } from '@core/radios/opengd77/limits.ts';
import type { ProgressFn, RadioSession } from '@integrations/radio-io/index.ts';
import {
  listCapabilitySkippedTransmitters,
  previewSatelliteWriteRecords,
  type CapabilitySkippedTransmitter,
  type SatelliteWritePreviewEntry,
} from '@integrations/radio-io/radios/at-d890uv/index.ts';
import {
  listCapabilitySkippedTransmitters as listOpenGd77CapabilitySkippedTransmitters,
  previewSatelliteWriteRecords as previewOpenGd77SatelliteWriteRecords,
  skippedSatellites as skippedOpenGd77Satellites,
} from '@integrations/radio-io/radios/opengd77/satelliteCodec.ts';
import {
  countWriteEligibleSatelliteRecords,
  skippedSatellites,
  writeSatellitesToRadio,
} from './radioIoAtD890SatelliteWrite.ts';
import {
  countWriteEligibleSatelliteRecords as countOpenGd77WriteEligibleSatellites,
  writeOpenGd77SatellitesToRadio,
} from './radioIoOpenGd77SatelliteWrite.ts';

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

/**
 * Registry of profileIds with a satellite-keps write adapter. Callers treat "no entry"
 * as "not offered," not an error.
 */
export const SATELLITE_KEPS_WRITE_ADAPTERS: Readonly<Record<string, SatelliteKepsWriteFn>> = {
  'radio-io-at-d890uv': writeSatellitesToRadio,
  'radio-io-opengd77-1701': writeOpenGd77SatellitesToRadio,
  'radio-io-opengd77-md9600': writeOpenGd77SatellitesToRadio,
};

export function hasSatelliteKepsWriteAdapter(profileId: string): boolean {
  return profileId in SATELLITE_KEPS_WRITE_ADAPTERS;
}

export function getSatelliteKepsWriteAdapter(profileId: string): SatelliteKepsWriteFn | undefined {
  return SATELLITE_KEPS_WRITE_ADAPTERS[profileId];
}

export interface SatelliteKepsWriteCapacity {
  /** Cap this profile's radio enforces on write-eligible records (spacecraft or transmitters). */
  max: number;
  /** Non-throwing count of records the current library would produce for this profile. */
  countEligible: (satellites: readonly Satellite[]) => number;
  /** Wire name field length for this radio's satellite records. */
  nameLength: number;
  /** Noun in capacity warnings (`transmitter` vs `satellite`). */
  unitNoun: string;
  /** Wire name is one field per spacecraft (OpenGD77) vs per transmitter (D890). */
  nameScope: 'spacecraft' | 'transmitter';
  /** Tier-3 doc path cited in over-cap copy. */
  limitsDoc: string;
}

/**
 * Registry of profileIds with a known write-capacity ceiling (#1068) — parallel to
 * `SATELLITE_KEPS_WRITE_ADAPTERS` above, split out so a UI pre-flight check
 * (`BuildRadioIoPanel.tsx`) can warn before opening a session, without duplicating each
 * adapter's own eligibility/capability filtering logic.
 */
export const SATELLITE_KEPS_WRITE_CAPACITY: Readonly<Record<string, SatelliteKepsWriteCapacity>> = {
  'radio-io-at-d890uv': {
    max: AT_D890UV_LIMITS.SATELLITE_MAX,
    countEligible: countWriteEligibleSatelliteRecords,
    nameLength: AT_D890UV_LIMITS.SATELLITE_NAME_LENGTH,
    unitNoun: 'transmitter',
    nameScope: 'transmitter',
    limitsDoc: 'docs/reference/radios/anytone/at-d890uv/satellite-keps.md',
  },
  'radio-io-opengd77-1701': {
    max: OPENGD77_FAMILY_LIMITS.SATELLITE_MAX,
    countEligible: countOpenGd77WriteEligibleSatellites,
    nameLength: OPENGD77_FAMILY_LIMITS.SATELLITE_NAME_LENGTH,
    unitNoun: 'satellite',
    nameScope: 'spacecraft',
    limitsDoc: 'docs/reference/radios/opengd77/satellite-orbitals.md',
  },
  'radio-io-opengd77-md9600': {
    max: OPENGD77_FAMILY_LIMITS.SATELLITE_MAX,
    countEligible: countOpenGd77WriteEligibleSatellites,
    nameLength: OPENGD77_FAMILY_LIMITS.SATELLITE_NAME_LENGTH,
    unitNoun: 'satellite',
    nameScope: 'spacecraft',
    limitsDoc: 'docs/reference/radios/opengd77/satellite-orbitals.md',
  },
};

export function getSatelliteKepsWriteCapacity(
  profileId: string,
): SatelliteKepsWriteCapacity | undefined {
  return SATELLITE_KEPS_WRITE_CAPACITY[profileId];
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
): string | null {
  const capacity = getSatelliteKepsWriteCapacity(profileId);
  if (!capacity) return null;
  return formatSatelliteKepsCapacityWarning(capacity.countEligible(satellites), capacity.max, {
    unitNoun: capacity.unitNoun,
    limitsDoc: capacity.limitsDoc,
  });
}

export interface SatelliteKepsWritePreviewOptions {
  satelliteOverrides?: readonly BuildEntityOverride[];
}

/** Common preview row for any registered keps adapter (OpenGD77 may add extra fields). */
export type SatelliteKepsWritePreviewEntry = SatelliteWritePreviewEntry;

export type SatelliteKepsWritePreviewFn = (
  satellites: readonly Satellite[],
  options?: SatelliteKepsWritePreviewOptions,
) => SatelliteKepsWritePreviewEntry[];

/**
 * Registry of profileIds with a live write-preview function (#1074) — parallel to
 * `SATELLITE_KEPS_WRITE_ADAPTERS`/`SATELLITE_KEPS_WRITE_CAPACITY` above, so the export page can
 * render exactly what a write would send before/without opening a session.
 */
export const SATELLITE_KEPS_WRITE_PREVIEW: Readonly<Record<string, SatelliteKepsWritePreviewFn>> = {
  'radio-io-at-d890uv': (satellites, options) =>
    previewSatelliteWriteRecords(satellites, {
      satelliteOverrides: options?.satelliteOverrides,
    }),
  'radio-io-opengd77-1701': (satellites, options) =>
    previewOpenGd77SatelliteWriteRecords(satellites, {
      satelliteOverrides: options?.satelliteOverrides,
    }),
  'radio-io-opengd77-md9600': (satellites, options) =>
    previewOpenGd77SatelliteWriteRecords(satellites, {
      satelliteOverrides: options?.satelliteOverrides,
    }),
};

export function getSatelliteKepsWritePreview(
  profileId: string,
): SatelliteKepsWritePreviewFn | undefined {
  return SATELLITE_KEPS_WRITE_PREVIEW[profileId];
}

/**
 * One enabled satellite or transmitter excluded from the write preview, with a reason.
 * `transmitterId: null` means the whole satellite was excluded (e.g. no write-eligible
 * transmitter at all); a set `transmitterId` means one specific transmitter was excluded
 * (e.g. unsupported mode or out-of-range frequency, #1068/#1085) while others on the same
 * satellite may still be written.
 */
export interface SatelliteKepsExclusion {
  satelliteId: string;
  transmitterId: string | null;
  reason: string;
}

export type SatelliteKepsExclusionsFn = (
  satellites: readonly Satellite[],
) => SatelliteKepsExclusion[];

/**
 * Registry of profileIds exposing a live "why was this excluded" computation (#1085 follow-up)
 * — parallel to `SATELLITE_KEPS_WRITE_PREVIEW` above, so the preview page can explain gaps
 * between "enabled in the library" and "appears in the write preview" without requiring a
 * session or an actual write. Both `skippedSatellites` (satellite-level: no write-eligible
 * transmitter at all) and `listCapabilitySkippedTransmitters` (transmitter-level: mode or
 * frequency excluded) are pure functions of the `satellites` array — no session needed.
 */
function openGd77Exclusions(satellites: readonly Satellite[]): SatelliteKepsExclusion[] {
  return [
    ...skippedOpenGd77Satellites(satellites).map((s) => ({
      satelliteId: s.satelliteId,
      transmitterId: null,
      reason: s.reason,
    })),
    ...listOpenGd77CapabilitySkippedTransmitters(satellites).map((t) => ({
      satelliteId: t.satelliteId,
      transmitterId: t.transmitterId,
      reason: t.reason,
    })),
  ];
}

export const SATELLITE_KEPS_EXCLUSIONS: Readonly<Record<string, SatelliteKepsExclusionsFn>> = {
  'radio-io-at-d890uv': (satellites) => [
    ...skippedSatellites(satellites).map((s) => ({
      satelliteId: s.satelliteId,
      transmitterId: null,
      reason: s.reason,
    })),
    ...listCapabilitySkippedTransmitters(satellites).map((t) => ({
      satelliteId: t.satelliteId,
      transmitterId: t.transmitterId,
      reason: t.reason,
    })),
  ],
  'radio-io-opengd77-1701': openGd77Exclusions,
  'radio-io-opengd77-md9600': openGd77Exclusions,
};

export function getSatelliteKepsExclusions(
  profileId: string,
): SatelliteKepsExclusionsFn | undefined {
  return SATELLITE_KEPS_EXCLUSIONS[profileId];
}
