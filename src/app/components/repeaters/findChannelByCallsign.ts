import type { Channel } from '@core/models/library.ts';

export function normalizeCallsign(callsign: string): string {
  return callsign.trim().toUpperCase();
}

/** Find a library channel by case-insensitive callsign match. */
export function findChannelByCallsign(channels: Channel[], callsign: string): Channel | null {
  const key = normalizeCallsign(callsign);
  if (!key) return null;
  return channels.find((c) => normalizeCallsign(c.callsign) === key) ?? null;
}
