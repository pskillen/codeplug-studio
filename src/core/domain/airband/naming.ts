import { bandFromFrequencyMhz } from '../bandCatalog.ts';
import type { Channel } from '../../models/library.ts';
import type {
  AirbandAirportInput,
  AirbandGenerateOptions,
  AirbandNamePrefixKind,
} from './types.ts';

const AIRBAND_BAND_ID = 'airband';

const ALL_PREFIX_KINDS: readonly AirbandNamePrefixKind[] = ['iata', 'icao', 'name'];

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

export function titleCaseWords(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function formatLabelForChannelName(label: string, kind: AirbandNamePrefixKind): string {
  return kind === 'name' ? titleCaseWords(label) : label;
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

function addStripToken(tokens: string[], seen: Set<string>, token: string): void {
  const trimmed = token.trim();
  if (!trimmed) return;
  const key = trimmed.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  tokens.push(trimmed);
}

/** All non-empty airport tokens that may appear as a leading prefix on wire service names. */
export function airportNameStripTokens(airport: AirbandAirportInput): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const kind of ALL_PREFIX_KINDS) {
    const value = labelForKind(airport, kind);
    if (!value) continue;
    addStripToken(tokens, seen, value);
    for (const word of value.trim().split(/\s+/).filter(Boolean)) {
      addStripToken(tokens, seen, word);
    }
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
  const label = formatLabelForChannelName(resolveAirportNameLabel(airport, kind), kind);
  const serviceLabel = titleCaseWords(stripLeadingAirportTokens(service, airport));
  const base = `${label} ${serviceLabel}`.trim();
  return applyNamePrefix(base, options.namePrefix);
}

/** All plausible imported names for dedupe / existing-channel matching. */
export function possibleAirbandChannelNames(
  airport: AirbandAirportInput,
  service: string,
  options: Pick<AirbandGenerateOptions, 'namePrefix'> = {},
): string[] {
  const names = new Set<string>();
  const trimmedService = service.trim();
  if (trimmedService) names.add(trimmedService);

  for (const kind of ALL_PREFIX_KINDS) {
    names.add(formatAirbandChannelName(airport, service, { ...options, namePrefixKind: kind }));
  }

  return [...names];
}

export function isCivilAirbandHz(rxFrequencyHz: number): boolean {
  const mhz = rxFrequencyHz / 1_000_000;
  return bandFromFrequencyMhz(mhz)?.id === AIRBAND_BAND_ID;
}

export function isAirbandSimplexChannel(channel: Channel): boolean {
  if (channel.rxFrequency == null) return false;
  if (!channel.modeProfiles.some((profile) => profile.mode === 'am')) return false;
  return channel.txFrequency == null || channel.rxFrequency === channel.txFrequency;
}

export function channelsMatchingAirbandFrequency(
  channels: readonly Channel[],
  rxFrequencyHz: number,
): Channel[] {
  return channels.filter(
    (channel) => channel.rxFrequency === rxFrequencyHz && isAirbandSimplexChannel(channel),
  );
}

export function findExistingAirbandChannelMatch(
  airport: AirbandAirportInput,
  service: string,
  rxFrequencyHz: number,
  channels: readonly Channel[],
): Channel | undefined {
  if (!isCivilAirbandHz(rxFrequencyHz)) return undefined;

  const candidates = channelsMatchingAirbandFrequency(channels, rxFrequencyHz);
  if (candidates.length === 0) return undefined;

  const possibleNames = new Set(
    possibleAirbandChannelNames(airport, service).map((name) => name.toLowerCase()),
  );

  return candidates.find((channel) => possibleNames.has(channel.name.toLowerCase()));
}
