/** Parsed parts of a Celestrak-style spacecraft name for shortening. */

export type AliasTier = 'oscar' | 'catalogue' | 'alternate' | null;

export interface ParsedSatelliteName {
  /** Normalised full input (after composite trim, before alias strip). */
  raw: string;
  /** Text before trailing parenthetical, trimmed. */
  base: string;
  /** Contents of trailing `(...)`, if present. */
  alias: string | null;
  aliasTier: AliasTier;
  /** Stem before trailing series index (may include internal separators). */
  head: string;
  /** Trailing series token, e.g. `6`, `2B`, `01`, `XI-V` is NOT index — only digit/roman at end. */
  index: string | null;
  /** Separator between head and index (` ` or `-`), empty when index is glued. */
  indexSeparator: string;
}

const OSCAR_ALIAS = /^[A-Z]O-\d+$/;
const CATALOGUE_ALIAS = /^RS\d+[A-Z]?\d*$/i;
const DIGIT_INDEX_PATTERN = /[-\s](\d+[A-Z]?)$/;
const ROMAN_INDEX_PATTERN = /\s([IVXL]+)$/i;

function classifyAlias(alias: string): AliasTier {
  const upper = alias.toUpperCase();
  if (OSCAR_ALIAS.test(upper)) return 'oscar';
  if (CATALOGUE_ALIAS.test(upper)) return 'catalogue';
  return 'alternate';
}

/** Uppercase, fold common accents, collapse whitespace. */
export function normaliseSatelliteName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function extractAlias(raw: string): { base: string; alias: string | null } {
  const match = raw.match(/^(.*)\s+\(([^)]+)\)\s*$/);
  if (!match) return { base: raw.trim(), alias: null };
  return { base: match[1]!.trim(), alias: match[2]!.trim() };
}

function splitComposite(raw: string): string {
  const amp = raw.indexOf(' & ');
  return amp >= 0 ? raw.slice(0, amp).trim() : raw.trim();
}

function splitHeadIndex(base: string): Pick<ParsedSatelliteName, 'head' | 'index' | 'indexSeparator'> {
  const digitMatch = base.match(DIGIT_INDEX_PATTERN);
  if (digitMatch && digitMatch.index !== undefined) {
    const index = digitMatch[1]!;
    const sepStart = digitMatch.index;
    const head = base.slice(0, sepStart).trimEnd();
    const indexSeparator = base[sepStart] ?? ' ';
    return { head, index, indexSeparator };
  }
  const romanMatch = base.match(ROMAN_INDEX_PATTERN);
  if (romanMatch && romanMatch.index !== undefined) {
    const index = romanMatch[1]!;
    const sepStart = romanMatch.index;
    const head = base.slice(0, sepStart).trimEnd();
    return { head, index, indexSeparator: ' ' };
  }
  return { head: base.trim(), index: null, indexSeparator: '' };
}

export function parseSatelliteName(name: string): ParsedSatelliteName {
  const normalised = normaliseSatelliteName(name);
  const composite = splitComposite(normalised);
  const { base, alias } = extractAlias(composite);
  const { head, index, indexSeparator } = splitHeadIndex(base);
  return {
    raw: composite,
    base,
    alias,
    aliasTier: alias ? classifyAlias(alias) : null,
    head,
    index,
    indexSeparator,
  };
}
