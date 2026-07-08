/** OpenAIP frequency `type` enum → human-readable service label. */
const OPENAIP_FREQUENCY_TYPE_LABELS: Record<number, string> = {
  0: 'Approach',
  1: 'Apron',
  2: 'Arrival',
  3: 'Center',
  4: 'CTAF',
  5: 'Delivery',
  6: 'Departure',
  7: 'FIS',
  8: 'Gliding',
  9: 'Ground',
  10: 'Information',
  11: 'Multicom',
  12: 'Unicom',
  13: 'Radar',
  14: 'Tower',
  15: 'ATIS',
  16: 'Radio',
  17: 'Other',
  18: 'AIRMET',
  19: 'AWOS',
  20: 'Lights',
  21: 'VOLMET',
  22: 'AFIS',
  23: 'ASOS',
  24: 'AWIS',
  25: 'Emergency',
  26: 'Clearance Delivery',
  27: 'Remote Com Outlet',
  28: 'Ground Com Outlet',
  29: 'Flight Service Station',
  30: 'Class C',
  31: 'Class B',
  32: 'VFR Advisory',
  33: 'TRSA',
};

export function openAipFrequencyTypeLabel(type: number, name?: string): string {
  const trimmedName = name?.trim();
  if (trimmedName) return trimmedName;
  return OPENAIP_FREQUENCY_TYPE_LABELS[type] ?? `Type ${type}`;
}

/** Parse OpenAIP MHz wire string (e.g. `119.100`) to Hz. */
export function parseOpenAipFrequencyMhz(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const mhz = Number.parseFloat(trimmed);
  if (!Number.isFinite(mhz) || mhz <= 0) return null;
  return Math.round(mhz * 1_000_000);
}
