import type { PassResult } from '@core/domain/satelliteTracking/types.ts';
import type { SatelliteTransmitterInfo } from '@core/models/satelliteEnrichment.ts';

/** Whether wall-clock `nowMs` falls inside a pass window [AOS, LOS). */
export function isPassActive(nowMs: number, aosAt: string, losAt: string): boolean {
  const aosMs = Date.parse(aosAt);
  const losMs = Date.parse(losAt);
  if (Number.isNaN(aosMs) || Number.isNaN(losMs)) return false;
  return nowMs >= aosMs && nowMs < losMs;
}

export interface PassWithSatelliteId extends PassResult {
  satelliteId: string;
}

export interface PassWithElevation extends PassWithSatelliteId {
  maxElevationDeg: number;
}

/** Client-side pass filters shared by the pass grid and ground-track map. */
export function filterTrackingPasses<T extends PassWithElevation>(
  passes: T[],
  minElevation: string,
  interestedSatelliteIds: Set<string>,
): T[] {
  const minElevationValue = Number.parseFloat(minElevation);
  return passes.filter((pass) => {
    if (!Number.isNaN(minElevationValue) && pass.maxElevationDeg < minElevationValue) {
      return false;
    }
    if (!interestedSatelliteIds.has(pass.satelliteId)) {
      return false;
    }
    return true;
  });
}

export function filterPassesToInterestedSatellites<T extends PassWithSatelliteId>(
  passes: T[],
  interestedSatelliteIds: Set<string>,
): T[] {
  return passes.filter((pass) => interestedSatelliteIds.has(pass.satelliteId));
}

/**
 * Earliest upcoming pass per satellite (by AOS). When multiple rows share a satellite,
 * keeps the one with the smallest `aosAt`.
 */
export function nextPassBySatelliteId<T extends PassWithSatelliteId>(passes: T[]): Map<string, T> {
  const byId = new Map<string, T>();
  for (const pass of passes) {
    const existing = byId.get(pass.satelliteId);
    if (!existing || pass.aosAt.localeCompare(existing.aosAt) < 0) {
      byId.set(pass.satelliteId, pass);
    }
  }
  return byId;
}

/** `mm:ss` countdown (minutes may exceed 59 for long windows). */
export function formatCountdownMmSs(durationMs: number): string {
  const totalSec = Math.max(0, Math.ceil(durationMs / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Label for the next pass of a satellite: `LOS mm:ss` when active, `AOS mm:ss` before AOS.
 */
export function formatNextPassCountdown(
  nowMs: number,
  aosAt: string,
  losAt: string,
): string | null {
  const aosMs = Date.parse(aosAt);
  const losMs = Date.parse(losAt);
  if (Number.isNaN(aosMs) || Number.isNaN(losMs)) return null;
  if (isPassActive(nowMs, aosAt, losAt)) {
    return `LOS ${formatCountdownMmSs(losMs - nowMs)}`;
  }
  if (nowMs < aosMs) {
    return `AOS ${formatCountdownMmSs(aosMs - nowMs)}`;
  }
  return null;
}

/**
 * Best-effort transmitter mode for display (e.g. on `NextPassCard`) — SatNOGS enrichment is
 * session-scoped and not persisted onto `Satellite` (there is no `Satellite.mode` field), so
 * this picks the first `alive` transmitter's mode, falling back to the first transmitter, and
 * `null` when no enrichment/transmitters are available. Not an authoritative per-satellite
 * setting, just a convenience summary of whatever SatNOGS last reported.
 */
export function pickPrimaryTransmitterMode(
  transmitters: SatelliteTransmitterInfo[] | undefined,
): string | null {
  if (!transmitters || transmitters.length === 0) return null;
  const alive = transmitters.find((transmitter) => transmitter.alive);
  return (alive ?? transmitters[0])?.mode ?? null;
}
