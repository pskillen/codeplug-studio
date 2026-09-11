#!/usr/bin/env node
/**
 * Validate a public-service channels.csv against the interchange schema.
 *
 * Usage:
 *   node scripts/public-services/validate-dataset.mjs [path-to-channels.csv ...]
 *
 * With no arguments, validates example.csv and every research/<iso2>/channels.csv.
 *
 * Checks mechanical items of the dataset quality bar. Judgement items (is the
 * source real, is the frequency plausible, is the system actually unencrypted)
 * remain a human review step.
 *
 * Exit code 0 = clean, 1 = errors found.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './csv.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const REQUIRED = [
  'country_code',
  'category',
  'group_id',
  'group_label',
  'channel_id',
  'name',
  'label',
  'rx_frequency_hz',
  'tx_frequency_hz',
  'mode',
  'is_primary_mode',
  'encryption',
  'status',
  'confidence',
  'source_type',
  'source_url',
  'source_title',
];

export const ENUMS = {
  category: new Set(['fire', 'maritime', 'sar', 'ambulance', 'utility', 'transport', 'event', 'other']),
  mode: new Set(['fm', 'dmr']),
  is_primary_mode: new Set(['true', 'false']),
  bandwidth_khz: new Set(['', '12.5', '25']),
  encryption: new Set(['none', 'unknown']),
  status: new Set(['active', 'historic', 'planned', 'unknown']),
  confidence: new Set(['high', 'medium', 'low']),
  source_type: new Set(['regulator', 'official', 'foi', 'industry', 'community']),
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TONE = /^(?:\d{2,3}\.\d|D\d{3}[NI])$/;
const DATE = /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/;
const NAME_MAX = 16;
const FREQ_MIN_HZ = 25_000_000;
const FREQ_MAX_HZ = 1_000_000_000;

/**
 * @param {string} path
 * @returns {string[]}
 */
export function loadTemplateHeader(path = join(__dirname, 'template.csv')) {
  const rows = parseCsv(readFileSync(path, 'utf8'));
  return rows[0] ?? [];
}

/**
 * @param {string} filePath
 * @param {string[]} expectedHeader
 * @returns {string[]}
 */
export function validatePath(filePath, expectedHeader = loadTemplateHeader()) {
  const errors = [];
  const raw = readFileSync(filePath);

  if (raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) {
    errors.push('file starts with a UTF-8 BOM; re-save without one');
  }
  if (raw.includes(0x0d)) {
    errors.push('file contains CR characters; use LF line endings only');
  }
  if (raw.length > 0 && raw[raw.length - 1] !== 0x0a) {
    errors.push('file has no trailing newline');
  }

  const rows = parseCsv(raw.toString('utf8'));
  if (rows.length === 0) {
    return ['file is empty'];
  }

  if (!headersEqual(rows[0], expectedHeader)) {
    errors.push(
      `header does not match template.csv\n  expected: ${expectedHeader.join(',')}\n  found:    ${rows[0].join(',')}`,
    );
    return errors;
  }

  /** @type {Set<string>} */
  const seenKeys = new Set();
  /** @type {Map<string, number>} */
  const primary = new Map();
  /** @type {Set<string>} */
  const countryCodes = new Set();

  for (let n = 1; n < rows.length; n += 1) {
    const row = rows[n];
    const line = n + 1;
    if (row.length !== expectedHeader.length) {
      errors.push(`row ${line}: has ${row.length} columns, expected ${expectedHeader.length}`);
      continue;
    }
    /** @type {Record<string, string>} */
    const r = Object.fromEntries(expectedHeader.map((col, i) => [col, row[i] ?? '']));
    const tag = `row ${line} (${r.group_id}/${r.channel_id}/${r.mode})`;

    for (const col of REQUIRED) {
      if (!r[col]?.trim()) {
        errors.push(`${tag}: required column '${col}' is empty`);
      }
    }

    for (const [col, allowed] of Object.entries(ENUMS)) {
      if (!allowed.has(r[col])) {
        errors.push(`${tag}: '${col}' = ${JSON.stringify(r[col])} is not one of ${[...allowed].sort().join(', ')}`);
      }
    }

    const cc = r.country_code;
    countryCodes.add(cc);
    if (!/^[A-Z]{2}$/.test(cc)) {
      errors.push(`${tag}: country_code ${JSON.stringify(cc)} must be two uppercase letters`);
    } else if (!r.group_id.startsWith(`${cc.toLowerCase()}-`)) {
      errors.push(`${tag}: group_id ${JSON.stringify(r.group_id)} must start with '${cc.toLowerCase()}-'`);
    }

    for (const col of ['group_id', 'channel_id']) {
      if (!SLUG.test(r[col])) {
        errors.push(`${tag}: '${col}' = ${JSON.stringify(r[col])} is not lowercase kebab-case`);
      }
    }

    const name = r.name;
    if (name.length > NAME_MAX) {
      errors.push(`${tag}: name ${JSON.stringify(name)} is ${name.length} chars, max ${NAME_MAX}`);
    }
    if (!isAscii(name)) {
      errors.push(`${tag}: name ${JSON.stringify(name)} contains non-ASCII characters`);
    }
    if (r.group_label.length > 60) {
      errors.push(`${tag}: group_label is ${r.group_label.length} chars, max 60`);
    }

    for (const col of ['rx_frequency_hz', 'tx_frequency_hz']) {
      const v = r[col];
      if (!/^\d+$/.test(v)) {
        errors.push(
          `${tag}: '${col}' = ${JSON.stringify(v)} must be a plain integer in Hz (no '.', ',' or units)`,
        );
      } else {
        const hz = Number(v);
        if (hz < FREQ_MIN_HZ || hz > FREQ_MAX_HZ) {
          errors.push(
            `${tag}: '${col}' = ${v} Hz is outside the plausible ${FREQ_MIN_HZ}-${FREQ_MAX_HZ} Hz window`,
          );
        }
      }
    }

    if (/^\d+$/.test(r.rx_frequency_hz) && /^\d+$/.test(r.tx_frequency_hz)) {
      const offset = Math.abs(Number(r.tx_frequency_hz) - Number(r.rx_frequency_hz));
      if (offset > 0 && offset < 100_000) {
        errors.push(
          `${tag}: duplex offset of ${offset} Hz is implausibly small — check the legs are not transcribed from adjacent rows of a source table`,
        );
      }
    }

    if (r.mode === 'fm') {
      for (const col of ['colour_code', 'timeslot', 'talkgroup_id']) {
        if (r[col]) {
          errors.push(`${tag}: '${col}' must be blank on an FM row`);
        }
      }
      if (!r.bandwidth_khz) {
        errors.push(`${tag}: bandwidth_khz should be set on an FM row (12.5 or 25)`);
      }
    } else if (r.mode === 'dmr') {
      if (r.bandwidth_khz) {
        errors.push(`${tag}: bandwidth_khz must be blank on a DMR row`);
      }
      for (const col of ['rx_tone', 'tx_tone']) {
        if (r[col]) {
          errors.push(`${tag}: '${col}' must be blank on a DMR row`);
        }
      }
      if (r.colour_code && !(/^\d+$/.test(r.colour_code) && Number(r.colour_code) >= 0 && Number(r.colour_code) <= 15)) {
        errors.push(`${tag}: colour_code ${JSON.stringify(r.colour_code)} must be an integer 0-15 or blank`);
      }
      if (r.timeslot !== '' && r.timeslot !== '1' && r.timeslot !== '2') {
        errors.push(`${tag}: timeslot ${JSON.stringify(r.timeslot)} must be 1, 2 or blank`);
      }
      if (r.talkgroup_id && !/^\d+$/.test(r.talkgroup_id)) {
        errors.push(`${tag}: talkgroup_id ${JSON.stringify(r.talkgroup_id)} must be an integer or blank`);
      }
    }

    for (const col of ['rx_tone', 'tx_tone']) {
      if (r[col] && !TONE.test(r[col])) {
        errors.push(`${tag}: '${col}' = ${JSON.stringify(r[col])} must be CTCSS like '77.0' or DCS like 'D023N'`);
      }
    }

    for (const col of ['source_url', 'source_url_2']) {
      if (r[col] && !r[col].startsWith('http://') && !r[col].startsWith('https://')) {
        errors.push(`${tag}: '${col}' = ${JSON.stringify(r[col])} is not an http(s) URL`);
      }
    }
    if (r.source_date && !DATE.test(r.source_date)) {
      errors.push(`${tag}: source_date ${JSON.stringify(r.source_date)} must be YYYY, YYYY-MM or YYYY-MM-DD`);
    }
    if (
      r.confidence === 'high' &&
      r.source_type !== 'regulator' &&
      r.source_type !== 'official' &&
      r.source_type !== 'foi' &&
      !r.source_url_2
    ) {
      errors.push(
        `${tag}: confidence=high needs a regulator/official/foi source or a corroborating source_url_2`,
      );
    }

    const key = `${r.group_id}\0${r.channel_id}\0${r.mode}`;
    if (seenKeys.has(key)) {
      errors.push(`${tag}: duplicate group_id+channel_id+mode`);
    }
    seenKeys.add(key);
    const channelKey = `${r.group_id}\0${r.channel_id}`;
    const current = primary.get(channelKey) ?? 0;
    primary.set(channelKey, r.is_primary_mode === 'true' ? current + 1 : current);
  }

  for (const [channelKey, count] of [...primary.entries()].sort()) {
    if (count !== 1) {
      const [gid, chid] = channelKey.split('\0');
      errors.push(`${gid}/${chid}: has ${count} rows with is_primary_mode=true, expected exactly 1`);
    }
  }

  if (countryCodes.size > 1) {
    errors.push(`file mixes country codes ${[...countryCodes].sort().join(', ')}; one country per file`);
  }

  return errors;
}

/**
 * @param {string[]} a
 * @param {string[]} b
 */
function headersEqual(a, b) {
  return a.length === b.length && a.every((col, i) => col === b[i]);
}

/** @param {string} value */
function isAscii(value) {
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) > 127) return false;
  }
  return true;
}

/**
 * @returns {string[]}
 */
export function defaultTargets() {
  const targets = [join(__dirname, 'example.csv')];
  const researchDir = join(__dirname, 'research');
  if (!existsSync(researchDir)) {
    return targets;
  }
  for (const name of readdirSync(researchDir).sort()) {
    const csvPath = join(researchDir, name, 'channels.csv');
    if (existsSync(csvPath)) {
      targets.push(csvPath);
    }
  }
  return targets;
}

/**
 * @param {string[]} argv
 * @param {{ log?: (line: string) => void }} [io]
 * @returns {number}
 */
export function main(argv, io = {}) {
  const log = io.log ?? console.log;
  const targets = argv.length > 0 ? argv.map((arg) => resolve(arg)) : defaultTargets();
  let status = 0;
  const header = loadTemplateHeader();

  for (const filePath of targets) {
    if (!existsSync(filePath)) {
      log(`${filePath}: not found`);
      status = 1;
      continue;
    }
    const errors = validatePath(filePath, header);
    const rows = parseCsv(readFileSync(filePath, 'utf8'));
    const dataRows = rows.slice(1);
    log(`\n=== ${filePath} — ${dataRows.length} data rows ===`);
    if (dataRows.length > 0) {
      /** @type {Record<string, Record<string, number>>} */
      const counts = {};
      for (const field of ['category', 'confidence', 'encryption', 'mode', 'source_type']) {
        const colIndex = header.indexOf(field);
        const tally = {};
        for (const row of dataRows) {
          const value = row[colIndex] ?? '';
          tally[value] = (tally[value] ?? 0) + 1;
        }
        counts[field] = tally;
        log(
          `  ${field.padEnd(12)} ${Object.entries(tally)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join(', ')}`,
        );
      }
      void counts;
    }
    if (errors.length > 0) {
      status = 1;
      log(`\n  ${errors.length} ERROR(S):`);
      for (const error of errors) {
        log(`   - ${error}`);
      }
    } else {
      log('\n  OK — mechanical checks passed. Human review still required for');
      log('  source validity, frequency plausibility, and encryption claims.');
    }
  }
  return status;
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  process.exit(main(process.argv.slice(2)));
}
