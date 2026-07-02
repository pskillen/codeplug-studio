#!/usr/bin/env node
/**
 * Flatten data/dictionaries/abbreviations.yaml into
 * src/core/import-export/channelExpansion/dictionary.generated.ts.
 * Run via: npm run generate:abbreviations
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const sourcePath = join(repoRoot, 'data/dictionaries/abbreviations.yaml');
const outputPath = join(
  repoRoot,
  'src/core/import-export/channelExpansion/dictionary.generated.ts',
);

/** @param {unknown} value */
function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * @param {unknown} node
 * @param {Map<string, { term: string; forms: string[] }>} entries
 * @param {string[]} path
 */
function collectAbbreviations(node, entries, path) {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'stopwords') {
      continue;
    }
    if (isStringArray(value)) {
      const lookupKey = key.toLowerCase();
      const existing = entries.get(lookupKey);
      if (existing) {
        throw new Error(
          `Duplicate abbreviation key "${lookupKey}" at ${[...path, key].join('.')} ` +
            `(already defined for "${existing.term}")`,
        );
      }
      entries.set(lookupKey, { term: key, forms: value });
      continue;
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      collectAbbreviations(value, entries, [...path, key]);
    }
  }
}

const raw = readFileSync(sourcePath, 'utf8');
const doc = parse(raw);

if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
  throw new Error('abbreviations.yaml must parse to a mapping');
}

/** @type {Map<string, { term: string; forms: string[] }>} */
const entries = new Map();
collectAbbreviations(doc, entries, []);

const stopwordsRaw = doc.stopwords;
if (!Array.isArray(stopwordsRaw) || !stopwordsRaw.every((w) => typeof w === 'string')) {
  throw new Error('stopwords must be a list of strings');
}

const sortedKeys = [...entries.keys()].sort();
const abbreviationsObject = Object.fromEntries(
  sortedKeys.map((key) => [key, entries.get(key).forms]),
);

const lines = [
  '/**',
  ' * Progressive abbreviation dictionary — generated from data/dictionaries/abbreviations.yaml.',
  ' * Do not edit by hand; run `npm run generate:abbreviations` after changing the YAML source.',
  ' */',
  '',
  '/** Lowercase lookup key → progressively shorter replacement forms (mildest first). */',
  `export const ABBREVIATIONS: Record<string, readonly string[]> = ${JSON.stringify(abbreviationsObject, null, 2)} as const;`,
  '',
  '/** Tokens that may be dropped entirely as a last-resort shortening step. */',
  `export const STOPWORDS: readonly string[] = ${JSON.stringify(stopwordsRaw)} as const;`,
  '',
];

writeFileSync(outputPath, lines.join('\n'), 'utf8');
console.log(`Wrote ${outputPath} (${sortedKeys.length} terms, ${stopwordsRaw.length} stopwords)`);
