/**
 * Registry of profileIds with a satellite-keps write adapter (#859).
 *
 * Nothing else in the codebase answers "which connected/configured radios support a keps
 * write." `RadioDescriptor` (`@integrations/radio-io/types.ts`) has `hydrationRequiredForWrite`,
 * `writeStrategy`, `writeVerify` — all about full-codeplug write. This registry is the
 * satellite-keps-specific analogue: it lets Workflow A/B call sites ask "does this
 * formatId/profileId support a keps write" without hardcoding a D890-only check at every
 * call site, so adding OpenGD77 (#858) later is additive — a new registry entry — not a
 * rewrite of the write workflows.
 */

import type { BuildEntityOverride } from '@core/models/radioBuild.ts';
import type { Satellite } from '@core/models/satellite.ts';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import type { ProgressFn, RadioSession } from '@integrations/radio-io/index.ts';
import {
  listCapabilitySkippedTransmitters,
  previewSatelliteWriteRecords,
  type CapabilitySkippedTransmitter,
  type SatelliteWritePreviewEntry,
} from '@integrations/radio-io/radios/at-d890uv/index.ts';
import {
  countWriteEligibleSatelliteRecords,
  skippedSatellites,
  writeSatellitesToRadio,
} from './radioIoAtD890SatelliteWrite.ts';

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
 * Registry of profileIds with a satellite-keps write adapter. Empty for any profile without
 * one (e.g. OpenGD77 targets, until #858 ships) — callers treat "no entry" as "not offered,"
 * not an error.
 */
export const SATELLITE_KEPS_WRITE_ADAPTERS: Readonly<Record<string, SatelliteKepsWriteFn>> = {
  'radio-io-at-d890uv': writeSatellitesToRadio,
};

export function hasSatelliteKepsWriteAdapter(profileId: string): boolean {
  return profileId in SATELLITE_KEPS_WRITE_ADAPTERS;
}

export function getSatelliteKepsWriteAdapter(profileId: string): SatelliteKepsWriteFn | undefined {
  return SATELLITE_KEPS_WRITE_ADAPTERS[profileId];
}

export interface SatelliteKepsWriteCapacity {
  /** Cap this profile's radio enforces on write-eligible `(satellite, transmitter)` records. */
  max: number;
  /** Non-throwing count of records the current library would produce for this profile. */
  countEligible: (satellites: readonly Satellite[]) => number;
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
  },
};

export function getSatelliteKepsWriteCapacity(
  profileId: string,
): SatelliteKepsWriteCapacity | undefined {
  return SATELLITE_KEPS_WRITE_CAPACITY[profileId];
}

export interface SatelliteKepsWritePreviewOptions {
  satelliteOverrides?: readonly BuildEntityOverride[];
}

export type SatelliteKepsWritePreviewFn = (
  satellites: readonly Satellite[],
  options?: SatelliteKepsWritePreviewOptions,
) => SatelliteWritePreviewEntry[];

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
};

export function getSatelliteKepsExclusions(
  profileId: string,
): SatelliteKepsExclusionsFn | undefined {
  return SATELLITE_KEPS_EXCLUSIONS[profileId];
}
