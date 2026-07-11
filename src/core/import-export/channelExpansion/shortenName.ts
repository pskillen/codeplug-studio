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

function isProtectedToken(token: string): boolean {
  if (!token) return true;
  if (token === '-F' || token === '-D') return true;
  if (isCallsignToken(token)) return true;
  if (isTimeslotToken(token)) return true;
  return false;
}

function tokenizeName(stem: string): string[] {
  return stem.trim().split(/\s+/).filter(Boolean);
}

function joinTokens(tokens: string[]): string {
  return tokens.join(' ');
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
    result.push(isProtectedToken(token) ? token : abbreviateWord(token, level));
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

function applyVowelSqueezeProgressive(stem: string, maxLen: number): string {
  const tokens = tokenizeName(stem);
  const squeezed = [...tokens];

  while (joinTokens(squeezed).length > maxLen) {
    let bestIndex = -1;
    let bestLength = -1;
    for (let i = 0; i < squeezed.length; i++) {
      const token = squeezed[i]!;
      if (isProtectedToken(token)) continue;
      const next = vowelSqueezeWord(token);
      if (next === token) continue;
      if (token.length > bestLength) {
        bestLength = token.length;
        bestIndex = i;
      }
    }
    if (bestIndex < 0) break;
    squeezed[bestIndex] = vowelSqueezeWord(squeezed[bestIndex]!);
  }

  return joinTokens(squeezed);
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

  if (opts.useVowelSqueeze !== false) {
    current = applyVowelSqueezeProgressive(current, stemBudget(0));
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
      return `${current.slice(0, stemMax)}${modeSuffix}${fixedSuffix}`;
    }
  }

  const combined = `${current}${suffix}${fixedSuffix}`;
  if (combined.length > maxLen) {
    const stemMax = stemBudget(suffix.length);
    return `${current.slice(0, stemMax)}${suffix}${fixedSuffix}`;
  }
  return combined;
}

/**
 * Shorten, disambiguate against `reserved`, and reserve the returned name when the set is mutable.
 */
export function finalizeWireName(
  base: string,
  reserved: ReadonlySet<string>,
  maxLen: number,
  opts: ShortenWireNameOptions = {},
): string {
  let name = shortenWireName(base, maxLen, opts);
  const suffixRoom = disambiguationSuffixLength(name, reserved);
  if (suffixRoom > 0 && name.length + suffixRoom > maxLen) {
    name = shortenWireName(base, Math.max(1, maxLen - suffixRoom), opts);
  }
  name = uniqueWireName(name, reserved);
  if (reserved instanceof Set) {
    reserved.add(name);
  }
  return name;
}
