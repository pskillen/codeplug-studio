import { bandFromFrequencyMhz } from '../bandCatalog.ts';
import type {
  AirbandAirportInput,
  AirbandGenerateOptions,
  AirbandNamePrefixKind,
} from './types.ts';

const AIRBAND_BAND_ID = 'airband';

const PREFIX_FALLBACK_ORDER: Record<AirbandNamePrefixKind, readonly AirbandNamePrefixKind[]> = {
  iata: ['iata', 'icao', 'name'],
  icao: ['icao', 'iata', 'name'],
  name: ['name', 'iata', 'icao'],
};

function labelForKind(airport: AirbandAirportInput, kind: AirbandNamePrefixKind): string | null {
  switch (kind) {
    case 'iata':
      return airport.iata?.trim() || null;
    case 'icao':
      return airport.icao?.trim() || null;
    case 'name':
      return airport.name?.trim() || null;
  }
}

/** Resolve the airport label for channel naming, with fallback when the preferred kind is missing. */
export function resolveAirportNameLabel(
  airport: AirbandAirportInput,
  kind: AirbandNamePrefixKind = 'iata',
): string {
  for (const candidate of PREFIX_FALLBACK_ORDER[kind]) {
    const label = labelForKind(airport, candidate);
    if (label) return label;
  }
  return airport.name.trim() || 'Airport';
}

/** All non-empty airport tokens that may appear as a leading prefix on wire service names. */
export function airportNameStripTokens(airport: AirbandAirportInput): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const kind of ['iata', 'icao', 'name'] as const) {
    const value = labelForKind(airport, kind);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tokens.push(value);
  }
  return tokens.sort((a, b) => b.length - a.length);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remove leading airport IATA/ICAO/name tokens from a service label before applying the chosen prefix.
 */
export function stripLeadingAirportTokens(service: string, airport: AirbandAirportInput): string {
  const raw = service.trim();
  if (!raw) return raw;

  let remainder = raw;
  const tokens = airportNameStripTokens(airport);
  let changed = true;

  while (changed) {
    changed = false;
    for (const token of tokens) {
      const pattern = new RegExp(`^${escapeRegExp(token)}(?:\\s+|$)`, 'i');
      if (pattern.test(remainder)) {
        remainder = remainder.replace(pattern, '').trim();
        changed = true;
      }
    }
  }

  return remainder || raw;
}

function applyNamePrefix(name: string, prefix: string | undefined): string {
  const trimmed = prefix?.trim() ?? '';
  if (!trimmed) return name;
  return `${trimmed}${name}`;
}

/** Final imported channel name for one airport frequency. */
export function formatAirbandChannelName(
  airport: AirbandAirportInput,
  service: string,
  options: AirbandGenerateOptions = {},
): string {
  const kind = options.namePrefixKind ?? 'iata';
  const label = resolveAirportNameLabel(airport, kind);
  const serviceLabel = stripLeadingAirportTokens(service, airport);
  const base = `${label} ${serviceLabel}`.trim();
  return applyNamePrefix(base, options.namePrefix);
}

/** Name before stripping duplicate airport tokens (for import preview). */
export function previewAirbandChannelNameBeforeStrip(
  airport: AirbandAirportInput,
  service: string,
  options: AirbandGenerateOptions = {},
): string {
  const kind = options.namePrefixKind ?? 'iata';
  const label = resolveAirportNameLabel(airport, kind);
  const base = `${label} ${service.trim()}`.trim();
  return applyNamePrefix(base, options.namePrefix);
}

export function isCivilAirbandHz(rxFrequencyHz: number): boolean {
  const mhz = rxFrequencyHz / 1_000_000;
  return bandFromFrequencyMhz(mhz)?.id === AIRBAND_BAND_ID;
}
