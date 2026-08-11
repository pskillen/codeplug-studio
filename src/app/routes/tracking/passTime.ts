import type { PassResult } from '@core/domain/satelliteTracking/types.ts';

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
 * `hour12: false` + `hourCycle: 'h23'` — `toLocaleTimeString([], { hour: '2-digit', ... })`
 * without an explicit hour cycle falls back to the runtime's default locale, which for en-US
 * zero-pads a 12-hour AM/PM hour (producing invalid-looking output like "04:49:52 PM"). Pass
 * types always show both local and UTC clocks now, and always in 24-hour form — see
 * `formatLocalClockTime`/`formatUtcClockTime` below.
 */
const CLOCK_TIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  hourCycle: 'h23',
};

/** `HH:mm:ss`, 24-hour, in the browser's local time zone. */
export function formatLocalClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], CLOCK_TIME_FORMAT_OPTIONS);
}

/** `HH:mm:ss`, 24-hour, in UTC. */
export function formatUtcClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { ...CLOCK_TIME_FORMAT_OPTIONS, timeZone: 'UTC' });
}
