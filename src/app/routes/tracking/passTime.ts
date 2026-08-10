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

/** Compact human-readable countdown from a positive duration in milliseconds. */
export function formatCountdown(durationMs: number): string {
  if (durationMs <= 0) return '0s';
  const totalSec = Math.ceil(durationMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Label for the next pass of a satellite: "In pass" when active, otherwise countdown to AOS.
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
    return 'In pass';
  }
  if (nowMs < aosMs) {
    return formatCountdown(aosMs - nowMs);
  }
  return null;
}
