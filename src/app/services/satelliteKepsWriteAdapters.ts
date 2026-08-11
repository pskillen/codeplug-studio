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

import type { Satellite } from '@core/models/satellite.ts';
import type { ProgressFn, RadioSession } from '@integrations/radio-io/index.ts';
import { writeSatellitesToRadio } from './radioIoAtD890SatelliteWrite.ts';

export interface SatelliteKepsWriteResult {
  written: number;
  skipped: { satelliteId: string; reason: string }[];
}

export type SatelliteKepsWriteFn = (
  session: RadioSession,
  satellites: readonly Satellite[],
  opts?: { onProgress?: ProgressFn; signal?: AbortSignal },
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
