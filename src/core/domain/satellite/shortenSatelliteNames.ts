import { parseSatelliteName, type ParsedSatelliteName } from './parseSatelliteName.ts';

export interface ShortenSatelliteNameInput {
  id: string;
  name: string;
  noradId: number;
  wireNameOverride?: string | null;
}

export interface ShortenSatelliteNameResult {
  shortName: string;
  /** Algorithm suggestion ignoring stored override — shown as Default in the UI. */
  generatedShortName: string;
  /** Best familiar-path short name (no OSCAR/catalogue/alternate alias tier). */
  suggestedFamiliar: string;
  /** Tier A OSCAR alias when present and ≤maxLength; otherwise null. */
  suggestedOscar: string | null;
  fromOverride: boolean;
}

export interface ShortenSatelliteNamesOptions {
  maxLength: number;
  /** When set, reject characters outside this predicate during squeeze/truncate. */
  isAllowedChar?: (char: string) => boolean;
}

const DEFAULT_ALLOWED = (char: string) => char.charCodeAt(0) >= 0x20 && char.charCodeAt(0) <= 0x7e;

function fits(candidate: string, maxLength: number): boolean {
  const trimmed = candidate.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength;
}

function stripAffix(head: string): string {
  const upper = head.toUpperCase();
  if (upper.endsWith('SATELLITE') && upper.length - 9 >= 4) {
    return head.slice(0, -9);
  }
  if (
    upper.endsWith('SAT') &&
    !upper.endsWith('OSAT') &&
    !upper.endsWith('ISAT') &&
    upper.length - 3 >= 4
  ) {
    return head.slice(0, -3);
  }
  return head;
}

/** Remove decorative punctuation from head; keep word separators for multi-word heads. */
function squeezeHeadPunctuation(head: string, isAllowedChar: (c: string) => boolean): string {
  return head
    .split(/([\s-]+)/)
    .map((part) =>
      /^[\s-]+$/.test(part)
        ? part
        : part
            .split('')
            .filter((c) => isAllowedChar(c) && c !== "'" && c !== '.' && c !== '+')
            .join(''),
    )
    .join('');
}

function truncateToLength(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen);
}

function shortenHeadWord(head: string, budget: number): string {
  if (head.length <= budget) return head;

  const words = head.split(/[\s-]+/).filter(Boolean);
  if (words.length <= 1) {
    return truncateToLength(head, budget);
  }

  const first = words[0]!;
  const rest = words.slice(1).join('-');
  const withSep = `${first}-${rest}`;
  if (withSep.length <= budget) return withSep;

  const minFirst = 4;
  if (first.length >= minFirst) {
    const restBudget = budget - 1 - first.length;
    if (restBudget >= 1) {
      return `${first}-${truncateToLength(rest, restBudget)}`;
    }
  }

  const glued = words.join('');
  return truncateToLength(glued, budget);
}

function buildWithIndex(
  head: string,
  index: string,
  indexSeparator: string,
  maxLength: number,
): string {
  const indexPart = `${indexSeparator}${index}`;
  const headBudget = maxLength - indexPart.length;
  if (headBudget < 1) return truncateToLength(`${head}${indexPart}`, maxLength);
  const shortHead = shortenHeadWord(head, headBudget);
  return `${shortHead}${indexPart}`;
}

interface SeriesGroup {
  headKey: string;
  maxIndexWidth: number;
}

function seriesHeadKey(parsed: ParsedSatelliteName): string {
  return parsed.head.toUpperCase();
}

function computeSeriesGroups(parsedList: ParsedSatelliteName[]): Map<string, SeriesGroup> {
  const groups = new Map<string, SeriesGroup>();
  for (const p of parsedList) {
    if (!p.index) continue;
    const key = seriesHeadKey(p);
    const width = p.index.length;
    const existing = groups.get(key);
    if (!existing || width > existing.maxIndexWidth) {
      groups.set(key, { headKey: key, maxIndexWidth: width });
    }
  }
  return groups;
}

function headShortenCandidate(
  parsed: ParsedSatelliteName,
  maxLength: number,
  seriesGroups: Map<string, SeriesGroup>,
): string | null {
  const { head, index, indexSeparator } = parsed;
  if (index) {
    const series = seriesGroups.get(seriesHeadKey(parsed));
    const indexWidth = series?.maxIndexWidth ?? index.length;
    const indexPartForBudget = indexSeparator.length + indexWidth;
    const headBudget = maxLength - indexPartForBudget;
    if (headBudget >= 1) {
      let shortHead = shortenHeadWord(stripAffix(head), headBudget);
      if (shortHead.length > headBudget) {
        shortHead = truncateToLength(shortHead, headBudget);
      }
      const candidate = `${shortHead}${indexSeparator}${index}`;
      if (fits(candidate, maxLength)) return candidate.trim();
    }
    const fallback = buildWithIndex(stripAffix(head), index, indexSeparator, maxLength);
    if (fits(fallback, maxLength)) return fallback.trim();
    return null;
  }

  const affixed = stripAffix(head);
  if (fits(affixed, maxLength)) return affixed;
  const truncated = truncateToLength(affixed, maxLength);
  return fits(truncated, maxLength) ? truncated : null;
}

function separatorSqueezeCandidate(
  parsed: ParsedSatelliteName,
  maxLength: number,
  isAllowedChar: (c: string) => boolean,
): string | null {
  const { head, index, indexSeparator } = parsed;
  const squeezed = squeezeHeadPunctuation(head, isAllowedChar);
  if (index) {
    const withSep = `${squeezed}${indexSeparator}${index}`;
    if (fits(withSep, maxLength)) return withSep;
    return null;
  }
  if (fits(squeezed, maxLength)) return squeezed;
  return null;
}

function buildCandidateLadder(
  parsed: ParsedSatelliteName,
  maxLength: number,
  seriesGroups: Map<string, SeriesGroup>,
  isAllowedChar: (c: string) => boolean,
): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();

  const push = (value: string | null | undefined) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!fits(trimmed, maxLength) || seen.has(trimmed)) return;
    seen.add(trimmed);
    candidates.push(trimmed);
  };

  push(parsed.base);

  push(separatorSqueezeCandidate(parsed, maxLength, isAllowedChar));

  push(headShortenCandidate(parsed, maxLength, seriesGroups));

  if (parsed.alias) {
    if (parsed.aliasTier === 'oscar') push(parsed.alias.toUpperCase());
    if (parsed.aliasTier === 'catalogue') push(parsed.alias.toUpperCase());
    if (parsed.aliasTier === 'alternate') push(parsed.alias.toUpperCase());
  }

  return candidates;
}

function buildFamiliarCandidateLadder(
  parsed: ParsedSatelliteName,
  maxLength: number,
  seriesGroups: Map<string, SeriesGroup>,
  isAllowedChar: (c: string) => boolean,
): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();

  const push = (value: string | null | undefined) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!fits(trimmed, maxLength) || seen.has(trimmed)) return;
    seen.add(trimmed);
    candidates.push(trimmed);
  };

  push(parsed.base);
  push(separatorSqueezeCandidate(parsed, maxLength, isAllowedChar));
  push(headShortenCandidate(parsed, maxLength, seriesGroups));

  return candidates;
}

function oscarSuggestion(parsed: ParsedSatelliteName, maxLength: number): string | null {
  if (parsed.aliasTier !== 'oscar' || !parsed.alias) return null;
  const upper = parsed.alias.toUpperCase();
  return fits(upper, maxLength) ? upper : null;
}

function assignFromLadder(
  inputs: ShortenSatelliteNameInput[],
  parsedById: Map<string, ParsedSatelliteName>,
  ladders: Map<string, string[]>,
  maxLength: number,
  reserved: Set<string>,
): Map<string, string> {
  return assignGeneratedNames([...inputs], parsedById, ladders, maxLength, reserved);
}

function forcedDisambiguation(
  best: string,
  noradId: number,
  taken: Set<string>,
  maxLength: number,
): string {
  for (let i = 2; i < 100; i++) {
    const suffix = `~${i}`;
    const base = best.slice(0, maxLength - suffix.length);
    const candidate = `${base}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  const fallback = `N${noradId}`;
  return truncateToLength(fallback, maxLength);
}

function assignGeneratedNames(
  inputs: ShortenSatelliteNameInput[],
  parsedById: Map<string, ParsedSatelliteName>,
  ladders: Map<string, string[]>,
  maxLength: number,
  reserved: Set<string>,
): Map<string, string> {
  const sorted = [...inputs].sort((a, b) => a.noradId - b.noradId);
  const assigned = new Map<string, string>();
  const taken = new Set(reserved);

  for (const input of sorted) {
    const ladder = ladders.get(input.id) ?? [];
    let picked: string | null = null;
    for (const candidate of ladder) {
      if (!taken.has(candidate)) {
        picked = candidate;
        break;
      }
    }
    if (!picked) {
      const fallback = ladder[0] ?? parsedById.get(input.id)!.base;
      picked = forcedDisambiguation(fallback, input.noradId, taken, maxLength);
    }
    assigned.set(input.id, picked);
    taken.add(picked);
  }

  return assigned;
}

/**
 * Assign distinct ≤maxLength wire names for a write set. Familiar-name-first: keep fitting
 * bases before OSCAR/catalogue aliases. Stored overrides reserve their string; generated
 * names avoid collisions with overrides and each other (lowest noradId wins contested picks).
 */
export function shortenSatelliteNames(
  inputs: readonly ShortenSatelliteNameInput[],
  options: ShortenSatelliteNamesOptions,
): Map<string, ShortenSatelliteNameResult> {
  const { maxLength } = options;
  const isAllowedChar = options.isAllowedChar ?? DEFAULT_ALLOWED;

  const parsedById = new Map<string, ParsedSatelliteName>();
  const parsedList: ParsedSatelliteName[] = [];
  for (const input of inputs) {
    const parsed = parseSatelliteName(input.name);
    parsedById.set(input.id, parsed);
    parsedList.push(parsed);
  }

  const seriesGroups = computeSeriesGroups(parsedList);

  const ladders = new Map<string, string[]>();
  for (const input of inputs) {
    const parsed = parsedById.get(input.id)!;
    ladders.set(input.id, buildCandidateLadder(parsed, maxLength, seriesGroups, isAllowedChar));
  }

  const reserved = new Set<string>();
  for (const input of inputs) {
    const override = input.wireNameOverride?.trim();
    if (override) reserved.add(override);
  }

  const generated = assignGeneratedNames([...inputs], parsedById, ladders, maxLength, reserved);

  const familiarLadders = new Map<string, string[]>();
  for (const input of inputs) {
    const parsed = parsedById.get(input.id)!;
    familiarLadders.set(
      input.id,
      buildFamiliarCandidateLadder(parsed, maxLength, seriesGroups, isAllowedChar),
    );
  }
  const familiarAssigned = assignFromLadder(
    inputs.filter((i) => !i.wireNameOverride?.trim()),
    parsedById,
    familiarLadders,
    maxLength,
    reserved,
  );

  const results = new Map<string, ShortenSatelliteNameResult>();
  for (const input of inputs) {
    const override = input.wireNameOverride?.trim();
    const parsed = parsedById.get(input.id)!;
    const suggestedOscar = oscarSuggestion(parsed, maxLength);
    const generatedShortName = (() => {
      const othersReserved = new Set<string>();
      for (const other of inputs) {
        if (other.id === input.id) continue;
        const o = other.wireNameOverride?.trim();
        if (o) othersReserved.add(o);
      }
      const withoutSelf = inputs.map((i) =>
        i.id === input.id ? { ...i, wireNameOverride: undefined } : i,
      );
      return (
        assignGeneratedNames(
          withoutSelf.filter((i) => !i.wireNameOverride?.trim()),
          parsedById,
          ladders,
          maxLength,
          othersReserved,
        ).get(input.id) ?? generated.get(input.id)!
      );
    })();

    const suggestedFamiliar =
      familiarAssigned.get(input.id) ??
      assignFromLadder([input], parsedById, familiarLadders, maxLength, new Set()).get(input.id) ??
      generatedShortName;

    if (override && fits(override, maxLength)) {
      results.set(input.id, {
        shortName: override,
        generatedShortName,
        suggestedFamiliar,
        suggestedOscar,
        fromOverride: true,
      });
    } else {
      const effectiveReserved = new Set(reserved);
      const shortName =
        assignGeneratedNames(
          inputs.filter((i) => !i.wireNameOverride?.trim()),
          parsedById,
          ladders,
          maxLength,
          effectiveReserved,
        ).get(input.id) ?? generatedShortName;
      results.set(input.id, {
        shortName,
        generatedShortName,
        suggestedFamiliar,
        suggestedOscar,
        fromOverride: false,
      });
    }
  }

  return results;
}

/** Lookup short name for one satellite within an already-resolved write set. */
export function shortNameForSatellite(
  inputs: readonly ShortenSatelliteNameInput[],
  options: ShortenSatelliteNamesOptions,
  satelliteId: string,
): ShortenSatelliteNameResult | undefined {
  return shortenSatelliteNames(inputs, options).get(satelliteId);
}
