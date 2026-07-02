import { ABBREVIATIONS, STOPWORDS } from './dictionary.generated.ts';

export { ABBREVIATIONS, STOPWORDS } from './dictionary.generated.ts';

const STOPWORD_LOOKUP = new Set(STOPWORDS.map((word) => word.toLowerCase()));

/** Multi-word phrase keys, longest token-span first (greedy left-to-right matching). */
const PHRASE_ENTRIES = Object.keys(ABBREVIATIONS)
  .filter((key) => key.includes(' '))
  .map((key) => ({ key, tokens: key.split(' ') }))
  .sort((a, b) => b.tokens.length - a.tokens.length || b.key.length - a.key.length);

export interface PhraseAbbreviationMatch {
  /** How many tokens from `start` the phrase consumed. */
  span: number;
  replacement: string;
}

function tokensMatchPhrase(
  tokens: readonly string[],
  start: number,
  phraseTokens: readonly string[],
): boolean {
  if (start + phraseTokens.length > tokens.length) return false;
  for (let i = 0; i < phraseTokens.length; i++) {
    if (tokens[start + i]!.toLowerCase() !== phraseTokens[i]!) return false;
  }
  return true;
}

/**
 * Longest dictionary phrase match at `start` in `tokens`.
 * Skips spans that include a protected token when `isProtected` is supplied.
 */
export function matchPhraseAbbreviation(
  tokens: readonly string[],
  start: number,
  level: number,
  isProtected?: (token: string) => boolean,
): PhraseAbbreviationMatch | null {
  if (level < 0) return null;

  for (const { key, tokens: phraseTokens } of PHRASE_ENTRIES) {
    if (!tokensMatchPhrase(tokens, start, phraseTokens)) continue;
    if (isProtected) {
      let blocked = false;
      for (let i = 0; i < phraseTokens.length; i++) {
        if (isProtected(tokens[start + i]!)) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
    }

    const forms = ABBREVIATIONS[key];
    if (!forms || forms.length === 0) continue;

    const sourcePhrase = tokens.slice(start, start + phraseTokens.length).join(' ');
    const index = Math.min(level, forms.length - 1);
    return { span: phraseTokens.length, replacement: matchWordCasing(sourcePhrase, forms[index]!) };
  }

  return null;
}

/** Case-insensitive stopword check (for export-time token dropping). */
export function isStopword(word: string): boolean {
  return STOPWORD_LOOKUP.has(word.toLowerCase());
}

/** Apply the same letter casing pattern as `source` to `replacement`. */
export function matchWordCasing(source: string, replacement: string): string {
  if (source === source.toUpperCase() && source !== source.toLowerCase()) {
    return replacement.toUpperCase();
  }
  if (source[0] === source[0]?.toUpperCase() && source.slice(1) === source.slice(1).toLowerCase()) {
    return replacement[0]!.toUpperCase() + replacement.slice(1).toLowerCase();
  }
  if (source === source.toLowerCase()) {
    return replacement.toLowerCase();
  }
  return replacement;
}

/**
 * Return a progressively shorter form of `word` from the curated dictionary.
 * `level` 0 is the mildest abbreviation; higher levels are more aggressive.
 * Unknown words are returned unchanged. Levels beyond the last form clamp to the shortest entry.
 */
export function abbreviateWord(word: string, level: number): string {
  if (level < 0 || word.length === 0) {
    return word;
  }

  const forms = ABBREVIATIONS[word.toLowerCase()];
  if (!forms || forms.length === 0) {
    return word;
  }

  const index = Math.min(level, forms.length - 1);
  return matchWordCasing(word, forms[index]!);
}
