import type { ChannelExportNameMode } from '@core/domain/channelNaming.ts';
import { isCallsignToken } from '@core/domain/channelNaming.ts';
import { peelModeExportSuffix } from './modeExportSuffix.ts';
import { abbreviateWord, matchPhraseAbbreviation } from './abbreviations.ts';

export interface TalkGroupMemberSuffixReplacement {
  /** Full talk-group member wire label (without leading space). */
  full: string;
  /** Shorter export label from `TalkGroup.abbreviation`. */
  abbreviated: string;
}

export interface ShortenWireNameOptions {
  /** Apply progressive dictionary abbreviation. Default true. */
  useDictionary?: boolean;
  /** Apply vowel-squeeze on longest words. Default true. */
  useVowelSqueeze?: boolean;
  /** Allow `callsign_name` → `callsign_suffix` downgrade for this export row only. Default true. */
  allowCallsignSuffixDowngrade?: boolean;
  /** Stored export name mode — suffix downgrade runs only for `callsign_name`. */
  exportNameMode?: ChannelExportNameMode;
  /** Recompose the wire name with a different export name mode (suffix downgrade). */
  recomposeWithMode?: (mode: ChannelExportNameMode) => string;
  /** Recompose using `Channel.abbreviation` before dictionary / vowel strategies. */
  recomposeWithChannelAbbreviation?: () => string;
  /** Replace a trailing multi-talkgroup member suffix before other strategies. */
  talkGroupMemberSuffix?: TalkGroupMemberSuffixReplacement;
  /** Protected trailing suffix for multi-TG composed names — shorten the leading portion only. */
  fixedSuffix?: string;
}

const MAX_DICTIONARY_LEVELS = 12;

/** Append ` 2`, ` 3`, … when `base` is already reserved. */
export function uniqueWireName(base: string, reserved: ReadonlySet<string>): string {
  if (!reserved.has(base)) return base;
  let n = 2;
  while (reserved.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/** Length of the disambiguation suffix `uniqueWireName` would add for `base`. */
export function disambiguationSuffixLength(base: string, reserved: ReadonlySet<string>): number {
  if (!reserved.has(base)) return 0;
  let n = 2;
  while (reserved.has(`${base} ${n}`)) n++;
  return ` ${n}`.length;
}

function isTimeslotToken(token: string): boolean {
  return /^TS\d+$/i.test(token) || /^T\d+$/i.test(token);
}

/** Pure digits or short alnum designators with digits (S20, SU24, U280) — not PMR446. */
function isDesignatorToken(token: string): boolean {
  if (/^\d+$/.test(token)) return true;
  if (token.length > 5) return false;
  return /^[A-Za-z]{1,3}\d+[A-Za-z]{0,2}$/.test(token);
}

function isProtectedToken(token: string): boolean {
  if (!token) return true;
  if (token === '-F' || token === '-D') return true;
  if (isCallsignToken(token)) return true;
  if (isTimeslotToken(token)) return true;
  if (isDesignatorToken(token)) return true;
  return false;
}

function tokenizeName(stem: string): string[] {
  return stem.trim().split(/\s+/).filter(Boolean);
}

function joinTokens(tokens: string[]): string {
  return tokens.join(' ');
}

/**
 * Abbreviate a whitespace token: try the whole token first (keys like `PMR-446`),
 * then split on hyphens and abbreviate each part (so `PMR446-1` → `PMR-1`).
 */
function abbreviateHyphenatedToken(token: string, level: number): string {
  if (isProtectedToken(token)) return token;
  const whole = abbreviateWord(token, level);
  if (whole !== token) return whole;
  if (!token.includes('-')) return token;
  return token
    .split('-')
    .map((part) => (isProtectedToken(part) ? part : abbreviateWord(part, level)))
    .join('-');
}

function applyDictionaryAtLevel(tokens: string[], level: number): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const phrase = matchPhraseAbbreviation(tokens, i, level, isProtectedToken);
    if (phrase) {
      result.push(phrase.replacement);
      i += phrase.span;
      continue;
    }
    const token = tokens[i]!;
    result.push(abbreviateHyphenatedToken(token, level));
    i++;
  }
  return result;
}

function applyDictionaryProgressive(stem: string, maxLen: number): string {
  let tokens = tokenizeName(stem);
  for (let level = 0; level < MAX_DICTIONARY_LEVELS; level++) {
    const prev = tokens;
    const next = applyDictionaryAtLevel(tokens, level);
    const candidate = joinTokens(next);
    tokens = next;
    if (candidate.length <= maxLen) return candidate;
    if (next.every((token, i) => token === prev[i])) break;
  }
  return joinTokens(tokens);
}

function vowelSqueezeWord(word: string): string {
  return word.replace(/[aeiou]/g, '');
}

/** Squeeze unprotected hyphen parts inside a whitespace token. */
function vowelSqueezeToken(token: string): string {
  if (isProtectedToken(token) || !token.includes('-')) {
    return isProtectedToken(token) ? token : vowelSqueezeWord(token);
  }
  return token
    .split('-')
    .map((part) => (isProtectedToken(part) ? part : vowelSqueezeWord(part)))
    .join('-');
}

function applyVowelSqueezeProgressive(stem: string, maxLen: number): string {
  const tokens = tokenizeName(stem);
  const squeezed = [...tokens];

  while (joinTokens(squeezed).length > maxLen) {
    let bestIndex = -1;
    let bestLength = -1;
    for (let i = 0; i < squeezed.length; i++) {
      const token = squeezed[i]!;
      if (isProtectedToken(token)) continue;
      const next = vowelSqueezeToken(token);
      if (next === token) continue;
      if (token.length > bestLength) {
        bestLength = token.length;
        bestIndex = i;
      }
    }
    if (bestIndex < 0) break;
    squeezed[bestIndex] = vowelSqueezeToken(squeezed[bestIndex]!);
  }

  return joinTokens(squeezed);
}

/**
 * Split a stem into hyphen/space segments with the separator that precedes each
 * segment after the first (`''` for the first).
 */
function splitSegments(stem: string): { text: string; sep: '' | ' ' | '-' }[] {
  const trimmed = stem.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/([ -])/);
  const segments: { text: string; sep: '' | ' ' | '-' }[] = [];
  let pendingSep: '' | ' ' | '-' = '';
  for (const part of parts) {
    if (part === ' ' || part === '-') {
      pendingSep = part;
      continue;
    }
    if (!part) continue;
    segments.push({ text: part, sep: segments.length === 0 ? '' : pendingSep || ' ' });
    pendingSep = '';
  }
  return segments;
}

function joinSegments(segments: { text: string; sep: '' | ' ' | '-' }[]): string {
  return segments.map((s, i) => (i === 0 ? s.text : `${s.sep}${s.text}`)).join('');
}

/**
 * Drop leftmost unprotected segments (space or hyphen) until the stem fits `maxLen`.
 * Prefers keeping trailing designators (e.g. `UHF-SU24` → `SU24`).
 */
function dropLeadingSegments(stem: string, maxLen: number): string {
  let segments = splitSegments(stem);
  while (joinSegments(segments).length > maxLen && segments.length > 1) {
    const dropIndex = segments.findIndex((s) => !isProtectedToken(s.text));
    if (dropIndex < 0) break;
    segments = segments.filter((_, i) => i !== dropIndex);
    if (segments.length > 0) {
      segments = [{ text: segments[0]!.text, sep: '' }, ...segments.slice(1)];
    }
  }
  return joinSegments(segments);
}

/**
 * Hard-truncate preferring a trailing protected segment when present
 * (e.g. keep `SU24` rather than left-slicing into `UHF-SU`).
 */
function hardTruncateStem(stem: string, maxLen: number): string {
  if (stem.length <= maxLen) return stem;
  const segments = splitSegments(stem);
  if (segments.length >= 2) {
    const last = segments[segments.length - 1]!;
    if (isProtectedToken(last.text) && last.text.length <= maxLen) {
      return last.text;
    }
  }
  return stem.slice(0, maxLen);
}

function applyTalkGroupMemberSuffix(
  name: string,
  replacement: TalkGroupMemberSuffixReplacement,
): string {
  const suffix = ` ${replacement.full}`;
  if (!name.endsWith(suffix)) return name;
  return `${name.slice(0, -suffix.length)} ${replacement.abbreviated}`;
}

/**
 * Shorten a composed CPS wire name to fit `maxLen` using progressively lossy strategies.
 * Returns the input unchanged when already within budget.
 */
export function shortenWireName(
  name: string,
  maxLen: number,
  opts: ShortenWireNameOptions = {},
): string {
  if (maxLen < 1 || name.length <= maxLen) return name;

  let fixedSuffix = opts.fixedSuffix ?? '';
  let peelTarget = name;
  if (fixedSuffix && name.endsWith(fixedSuffix)) {
    peelTarget = name.slice(0, -fixedSuffix.length);
  } else {
    fixedSuffix = '';
  }

  const { stem: inputStem, suffix: modeSuffix } = peelModeExportSuffix(peelTarget);
  let current = inputStem;

  if (opts.recomposeWithChannelAbbreviation) {
    const withAbbrev = opts.recomposeWithChannelAbbreviation();
    const { stem: abbrevStem } = peelModeExportSuffix(withAbbrev);
    const withAbbrevAndMode = `${abbrevStem}${modeSuffix}${fixedSuffix}`;
    if (withAbbrevAndMode.length <= maxLen) return withAbbrevAndMode;
    current = abbrevStem;
  }

  const suffix = modeSuffix;
  const fixedLen = fixedSuffix.length;
  const stemBudget = (extra: number) => Math.max(0, maxLen - suffix.length - fixedLen - extra);

  if (opts.talkGroupMemberSuffix) {
    current = applyTalkGroupMemberSuffix(current, opts.talkGroupMemberSuffix);
    if (`${current}${suffix}${fixedSuffix}`.length <= maxLen) {
      return `${current}${suffix}${fixedSuffix}`;
    }
  }

  if (opts.useDictionary !== false) {
    current = applyDictionaryProgressive(current, stemBudget(0));
    if (`${current}${suffix}${fixedSuffix}`.length <= maxLen) {
      return `${current}${suffix}${fixedSuffix}`;
    }
  }

  // Hyphenated sets: drop unprotected prefixes (UHF-SU24 → SU24) before vowel-squeeze
  // so short band tokens are not mangled into a still-fitting but opaque form (HF-SU24).
  if (current.includes('-')) {
    current = dropLeadingSegments(current, stemBudget(0));
    if (`${current}${suffix}${fixedSuffix}`.length <= maxLen) {
      return `${current}${suffix}${fixedSuffix}`;
    }
  }

  if (opts.useVowelSqueeze !== false) {
    current = applyVowelSqueezeProgressive(current, stemBudget(0));
    if (`${current}${suffix}${fixedSuffix}`.length <= maxLen) {
      return `${current}${suffix}${fixedSuffix}`;
    }
  }

  if (current.includes('-')) {
    current = dropLeadingSegments(current, stemBudget(0));
    if (`${current}${suffix}${fixedSuffix}`.length <= maxLen) {
      return `${current}${suffix}${fixedSuffix}`;
    }
  }

  if (
    opts.allowCallsignSuffixDowngrade !== false &&
    opts.exportNameMode === 'callsign_name' &&
    opts.recomposeWithMode
  ) {
    const downgraded = peelModeExportSuffix(opts.recomposeWithMode('callsign_suffix'));
    if (downgraded.stem !== current || downgraded.suffix !== suffix) {
      current = downgraded.stem;
      const modeSuffix = downgraded.suffix || suffix;
      const downgradedCombined = `${current}${modeSuffix}${fixedSuffix}`;
      if (downgradedCombined.length <= maxLen) return downgradedCombined;
      const stemMax = stemBudget(modeSuffix.length);
      return `${hardTruncateStem(current, stemMax)}${modeSuffix}${fixedSuffix}`;
    }
  }

  const combined = `${current}${suffix}${fixedSuffix}`;
  if (combined.length > maxLen) {
    const stemMax = stemBudget(suffix.length);
    return `${hardTruncateStem(current, stemMax)}${suffix}${fixedSuffix}`;
  }
  return combined;
}

/**
 * Shorten, disambiguate against `reserved`, and reserve the returned name when the set is mutable.
 *
 * Leaves room for ` 2`, ` 3`, … / ` 10` disambiguation so the final name never exceeds `maxLen`
 * (CHIRP UV-5R is 7 characters — without this, `PMR44` + ` 10` becomes an 8-character overflow).
 */
export function finalizeWireName(
  base: string,
  reserved: ReadonlySet<string>,
  maxLen: number,
  opts: ShortenWireNameOptions = {},
): string {
  let name = '';
  for (let suffixBudget = 0; suffixBudget <= maxLen; suffixBudget++) {
    const stemBudget = Math.max(1, maxLen - suffixBudget);
    let stem = shortenWireName(base, stemBudget, opts);
    if (stem.length > stemBudget) {
      stem = stem.slice(0, stemBudget);
    }
    const needed = disambiguationSuffixLength(stem, reserved);
    if (needed > suffixBudget) {
      continue;
    }
    const candidate = uniqueWireName(stem, reserved);
    if (candidate.length <= maxLen) {
      name = candidate;
      break;
    }
  }

  if (!name) {
    // Exhausted budgets — hard-truncate stem so uniquify can still fit.
    const stemBudget = Math.max(1, maxLen - 3);
    const stem = shortenWireName(base, stemBudget, opts).slice(0, stemBudget) || 'X';
    name = uniqueWireName(stem, reserved).slice(0, maxLen);
  }

  if (reserved instanceof Set) {
    reserved.add(name);
  }
  return name;
}
