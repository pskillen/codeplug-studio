import type { DigitalContact } from '@core/models/library.ts';

export function findDigitalContactByDigitalId(
  contacts: readonly DigitalContact[],
  digitalId: number,
): DigitalContact | null {
  return contacts.find((c) => c.digitalId === digitalId) ?? null;
}

export function findDigitalContactByCallsign(
  contacts: readonly DigitalContact[],
  callsign: string,
): DigitalContact | null {
  const needle = callsign.trim().toUpperCase();
  if (!needle) return null;
  return contacts.find((c) => c.callsign.trim().toUpperCase() === needle) ?? null;
}
