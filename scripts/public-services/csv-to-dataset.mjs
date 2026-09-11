#!/usr/bin/env node
/**
 * Convert a validated public-service channels.csv into a country TypeScript module.
 *
 * Usage:
 *   node scripts/public-services/csv-to-dataset.mjs [iso2 ...]
 *
 * With no arguments, converts every research/<iso2>/channels.csv.
 * Also rewrites data/index.generated.ts from every converted country.
 *
 * Options:
 *   --out-dir <path>  Write modules here instead of src/core/domain/publicServices/data
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './csv.mjs';
import { loadTemplateHeader, validatePath } from './validate-dataset.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT_DIR = join(__dirname, '../../src/core/domain/publicServices/data');
const RESEARCH_DIR = join(__dirname, 'research');

const FALLBACK_LABELS = {
  GB: 'United Kingdom',
  IE: 'Ireland',
  ZZ: 'Exampleland',
};

/**
 * @typedef {{
 *   mode: 'fm' | 'dmr';
 *   isPrimary: boolean;
 *   bandwidthKHz?: number;
 *   rxTone?: string;
 *   txTone?: string;
 *   colourCode?: number;
 *   timeslot?: 1 | 2;
 * }} ModeSpec
 *
 * @typedef {{
 *   channelId: string;
 *   name: string;
 *   label: string;
 *   rxFrequencyHz: number;
 *   txFrequencyHz: number;
 *   modes: ModeSpec[];
 *   status: string;
 *   confidence: string;
 *   source: {
 *     type: string;
 *     url: string;
 *     title: string;
 *     date?: string;
 *     url2?: string;
 *   };
 *   notes?: string;
 * }} Entry
 *
 * @typedef {{
 *   groupId: string;
 *   label: string;
 *   category: string;
 *   serviceOrg?: string;
 *   region?: string;
 *   entries: Entry[];
 * }} Group
 *
 * @typedef {{
 *   countryCode: string;
 *   countryLabel: string;
 *   datasetVersion: string;
 *   groups: Group[];
 *   knownGaps: { category: string; summary: string; sourceUrl?: string }[];
 * }} Country
 */

/**
 * @param {string} iso2
 * @param {string} [researchRoot]
 * @returns {Country}
 */
export function convertCountry(iso2, researchRoot = RESEARCH_DIR) {
  const code = iso2.toLowerCase();
  const csvPath = join(researchRoot, code, 'channels.csv');
  if (!existsSync(csvPath)) {
    throw new Error(`No channels.csv for ${code} at ${csvPath}`);
  }
  const header = loadTemplateHeader();
  const errors = validatePath(csvPath, header);
  if (errors.length > 0) {
    throw new Error(`${csvPath} failed validation:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }

  const rows = parseCsv(readFileSync(csvPath, 'utf8'));
  const dataRows = rows.slice(1).map((row) =>
    Object.fromEntries(header.map((col, i) => [col, row[i] ?? ''])),
  );
  const shippable = dataRows.filter((row) => row.encryption === 'none');
  if (shippable.length === 0) {
    throw new Error(`${csvPath}: no encryption=none rows to convert`);
  }

  const countryCode = shippable[0].country_code;
  const meta = loadCountryMeta(join(researchRoot, code), countryCode);
  /** @type {Map<string, Group>} */
  const groups = new Map();

  for (const row of shippable) {
    let group = groups.get(row.group_id);
    if (!group) {
      group = {
        groupId: row.group_id,
        label: row.group_label,
        category: row.category,
        ...(row.service_org ? { serviceOrg: row.service_org } : {}),
        ...(row.region ? { region: row.region } : {}),
        entries: [],
      };
      groups.set(row.group_id, group);
    }
    const existing = group.entries.find((entry) => entry.channelId === row.channel_id);
    const mode = modeSpecFromRow(row);
    if (existing) {
      existing.modes.push(mode);
      continue;
    }
    group.entries.push(entryFromRow(row, mode));
  }

  for (const group of groups.values()) {
    for (const entry of group.entries) {
      entry.modes.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
    }
  }

  return {
    countryCode,
    countryLabel: meta.countryLabel,
    datasetVersion: meta.datasetVersion,
    groups: [...groups.values()],
    knownGaps: meta.knownGaps,
  };
}

/**
 * @param {string} countryDir
 * @param {string} countryCode
 */
function loadCountryMeta(countryDir, countryCode) {
  const gapsPath = join(countryDir, 'known-gaps.json');
  if (!existsSync(gapsPath)) {
    return {
      countryLabel: FALLBACK_LABELS[countryCode] ?? countryCode,
      datasetVersion: '1',
      knownGaps: [],
    };
  }
  const raw = JSON.parse(readFileSync(gapsPath, 'utf8'));
  return {
    countryLabel: typeof raw.countryLabel === 'string' ? raw.countryLabel : (FALLBACK_LABELS[countryCode] ?? countryCode),
    datasetVersion: typeof raw.datasetVersion === 'string' ? raw.datasetVersion : '1',
    knownGaps: Array.isArray(raw.knownGaps) ? raw.knownGaps : [],
  };
}

/** @param {Record<string, string>} row */
function modeSpecFromRow(row) {
  /** @type {ModeSpec} */
  const spec = {
    mode: row.mode,
    isPrimary: row.is_primary_mode === 'true',
  };
  if (row.mode === 'fm') {
    if (row.bandwidth_khz) spec.bandwidthKHz = Number(row.bandwidth_khz);
    if (row.rx_tone) spec.rxTone = row.rx_tone;
    if (row.tx_tone) spec.txTone = row.tx_tone;
  } else {
    if (row.colour_code) spec.colourCode = Number(row.colour_code);
    if (row.timeslot === '1' || row.timeslot === '2') spec.timeslot = Number(row.timeslot);
  }
  return spec;
}

/**
 * @param {Record<string, string>} row
 * @param {ModeSpec} mode
 */
function entryFromRow(row, mode) {
  /** @type {Entry} */
  const entry = {
    channelId: row.channel_id,
    name: row.name,
    label: row.label,
    rxFrequencyHz: Number(row.rx_frequency_hz),
    txFrequencyHz: Number(row.tx_frequency_hz),
    modes: [mode],
    status: row.status,
    confidence: row.confidence,
    source: {
      type: row.source_type,
      url: row.source_url,
      title: row.source_title,
      ...(row.source_date ? { date: row.source_date } : {}),
      ...(row.source_url_2 ? { url2: row.source_url_2 } : {}),
    },
  };
  if (row.notes) entry.notes = row.notes;
  return entry;
}

/**
 * @param {unknown} value
 * @param {number} [indent]
 * @returns {string}
 */
function tsValue(value, indent = 0) {
  const pad = '  '.repeat(indent);
  const padIn = '  '.repeat(indent + 1);
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return `[\n${value.map((item) => `${padIn}${tsValue(item, indent + 1)},`).join('\n')}\n${pad}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '{}';
    return `{\n${entries.map(([k, v]) => `${padIn}${k}: ${tsValue(v, indent + 1)},`).join('\n')}\n${pad}}`;
  }
  throw new Error(`Cannot serialise ${typeof value}`);
}

/**
 * @param {Country} country
 * @param {string} iso2
 * @returns {string}
 */
export function renderCountryModule(country, iso2) {
  const code = iso2.toLowerCase();
  return [
    '/**',
    ` * Generated from scripts/public-services/research/${code}/channels.csv.`,
    ' * Do not edit by hand; run `node scripts/public-services/csv-to-dataset.mjs`.',
    ' */',
    "import type { PublicServiceCountry } from '../types.ts';",
    '',
    `const country: PublicServiceCountry = ${tsValue(country)};`,
    '',
    'export default country;',
    '',
  ].join('\n');
}

/**
 * @param {Country[]} countries
 * @returns {string}
 */
export function renderIndexModule(countries) {
  const summaries = countries.map((country) => ({
    countryCode: country.countryCode,
    countryLabel: country.countryLabel,
    datasetVersion: country.datasetVersion,
    groups: country.groups.map((group) => ({
      groupId: group.groupId,
      label: group.label,
      category: group.category,
      channelCount: group.entries.length,
    })),
  }));
  return [
    '/**',
    ' * Generated country/group summaries. Do not edit by hand.',
    ' * Run `node scripts/public-services/csv-to-dataset.mjs`.',
    ' */',
    "import type { PublicServiceCountrySummary } from '../types.ts';",
    '',
    `export const PUBLIC_SERVICE_COUNTRY_SUMMARIES: readonly PublicServiceCountrySummary[] = ${tsValue(summaries)};`,
    '',
  ].join('\n');
}

/**
 * @param {string} researchRoot
 * @returns {string[]}
 */
export function listResearchCountries(researchRoot = RESEARCH_DIR) {
  if (!existsSync(researchRoot)) return [];
  return readdirSync(researchRoot)
    .filter((name) => existsSync(join(researchRoot, name, 'channels.csv')))
    .sort();
}

/**
 * @param {{ iso2?: string[]; researchRoot?: string; outDir?: string }} options
 * @returns {{ written: string[]; countries: Country[] }}
 */
export function convertAll(options = {}) {
  const researchRoot = options.researchRoot ?? RESEARCH_DIR;
  const outDir = options.outDir ?? DEFAULT_OUT_DIR;
  const iso2List = options.iso2?.map((c) => c.toLowerCase()) ?? listResearchCountries(researchRoot);
  if (iso2List.length === 0) {
    throw new Error('No countries to convert. Pass an ISO-2 code or add research/<iso2>/channels.csv.');
  }
  mkdirSync(outDir, { recursive: true });
  const allIso2 = listResearchCountries(researchRoot);
  const convertSet = new Set(iso2List);
  /** @type {Country[]} */
  const countries = [];
  /** @type {string[]} */
  const written = [];

  for (const code of allIso2.length > 0 ? allIso2 : iso2List) {
    const country = convertCountry(code, researchRoot);
    countries.push(country);
    if (convertSet.has(code) || allIso2.length === 0) {
      const dest = join(outDir, `${code}.ts`);
      writeFileSync(dest, renderCountryModule(country, code), 'utf8');
      written.push(dest);
    }
  }

  const indexPath = join(outDir, 'index.generated.ts');
  writeFileSync(indexPath, renderIndexModule(countries), 'utf8');
  written.push(indexPath);
  return { written, countries };
}

/**
 * @param {string[]} argv
 * @returns {number}
 */
export function main(argv) {
  const iso2 = [];
  let outDir;
  let researchRoot;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out-dir') {
      outDir = resolve(argv[++i]);
    } else if (arg === '--research-dir') {
      researchRoot = resolve(argv[++i]);
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option ${arg}`);
    } else {
      iso2.push(arg);
    }
  }
  const result = convertAll({
    iso2: iso2.length > 0 ? iso2 : undefined,
    outDir,
    researchRoot,
  });
  for (const path of result.written) {
    console.log(`Wrote ${path}`);
  }
  return 0;
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
