import type { ParsedTleEntry, TleParseResult, TleParseWarning } from './tleTypes.ts';

const TLE_LINE_LENGTH = 69;

/**
 * Modulo-10 checksum over columns 1-68: digits count as themselves, `-`
 * counts as 1, everything else (letters, `+`, `.`, spaces) counts as 0.
 */
export function tleChecksum(line: string): number {
  let sum = 0;
  for (let i = 0; i < TLE_LINE_LENGTH - 1; i += 1) {
    const ch = line[i];
    if (ch >= '0' && ch <= '9') {
      sum += ch.charCodeAt(0) - 48;
    } else if (ch === '-') {
      sum += 1;
    }
  }
  return sum % 10;
}

export function validateTleLine(line: string): boolean {
  if (line.length !== TLE_LINE_LENGTH) return false;
  const checksumChar = line[TLE_LINE_LENGTH - 1];
  if (checksumChar < '0' || checksumChar > '9') return false;
  return tleChecksum(line) === Number(checksumChar);
}

/** Decimal point assumed before the field, e.g. eccentricity `"0001959"` → `0.0001959`. */
function parseAssumedDecimal(field: string): number {
  return Number(`0.${field.trim()}`);
}

/**
 * Assumed-decimal mantissa + signed single-digit exponent, e.g. BSTAR
 * `" 13844-3"` → `0.13844e-3`. No mantissa (all spaces/zeros) → `0`.
 */
function parseAssumedDecimalExponential(field: string): number {
  const trimmed = field.trim();
  if (trimmed === '' || /^[+-]?0+$/.test(trimmed)) return 0;
  const match = /^([+-]?)(\d+)([+-]\d)$/.exec(trimmed);
  if (!match) {
    throw new Error(`Malformed exponential field: "${field}"`);
  }
  const [, sign, mantissa, exponent] = match;
  const value = Number(`${sign}0.${mantissa}e${exponent}`);
  return value;
}

function epochToIso(yearTwoDigit: string, dayOfYear: string): string {
  const yy = Number(yearTwoDigit);
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  const dayFrac = Number(dayOfYear);
  if (!Number.isFinite(dayFrac) || dayFrac <= 0) {
    throw new Error(`Malformed epoch day-of-year: "${dayOfYear}"`);
  }
  const wholeDay = Math.floor(dayFrac);
  const fractionOfDay = dayFrac - wholeDay;
  const startOfYearMs = Date.UTC(year, 0, 1);
  const ms = startOfYearMs + (wholeDay - 1) * 86_400_000 + fractionOfDay * 86_400_000;
  return new Date(ms).toISOString();
}

function decodeTleGroup(name: string, line1: string, line2: string): ParsedTleEntry {
  const noradId = Number(line1.substring(2, 7));
  if (!Number.isInteger(noradId)) {
    throw new Error(`Malformed NORAD catalog id: "${line1.substring(2, 7)}"`);
  }
  const classification = line1.charAt(7).trim() || 'U';
  const epoch = epochToIso(line1.substring(18, 20), line1.substring(20, 32));
  const bstar = parseAssumedDecimalExponential(line1.substring(53, 61));
  const elementSetNumber = Number(line1.substring(64, 68).trim());

  const inclinationDeg = Number(line2.substring(8, 16).trim());
  const raanDeg = Number(line2.substring(17, 25).trim());
  const eccentricity = parseAssumedDecimal(line2.substring(26, 33));
  const argPerigeeDeg = Number(line2.substring(34, 42).trim());
  const meanAnomalyDeg = Number(line2.substring(43, 51).trim());
  const meanMotionRevPerDay = Number(line2.substring(52, 63).trim());
  const revolutionNumber = Number(line2.substring(63, 68).trim());

  for (const [label, value] of Object.entries({
    inclinationDeg,
    raanDeg,
    argPerigeeDeg,
    meanAnomalyDeg,
    meanMotionRevPerDay,
    revolutionNumber,
    elementSetNumber,
  })) {
    if (!Number.isFinite(value)) {
      throw new Error(`Malformed numeric field "${label}" for ${name}`);
    }
  }

  return {
    name,
    noradId,
    tleLine1: line1,
    tleLine2: line2,
    epoch,
    classification,
    inclinationDeg,
    raanDeg,
    eccentricity,
    argPerigeeDeg,
    meanAnomalyDeg,
    meanMotionRevPerDay,
    bstar,
    elementSetNumber,
    revolutionNumber,
  };
}

/**
 * Parse a block of 3-line TLE sets (name + line 1 + line 2). Malformed
 * groups (bad length/checksum, unparseable fields) are collected as
 * warnings and skipped — one bad satellite must not drop the whole feed.
 */
export function parseTleBlock(text: string): TleParseResult {
  const lines = text
    .split(/\r\n|\r|\n/)
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.length > 0);

  const entries: ParsedTleEntry[] = [];
  const warnings: TleParseWarning[] = [];

  let i = 0;
  while (i < lines.length) {
    const nameLine = lines[i];
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];

    if (line1 === undefined || line2 === undefined) {
      warnings.push({ index: i, message: 'Incomplete TLE group at end of file', raw: nameLine });
      break;
    }
    if (!line1.startsWith('1 ') || !line2.startsWith('2 ')) {
      warnings.push({
        index: i,
        message: 'Malformed TLE group (expected name / line 1 / line 2)',
        raw: nameLine,
      });
      i += 1;
      continue;
    }

    const name = nameLine.replace(/^0 /, '').trim();

    if (!validateTleLine(line1)) {
      warnings.push({
        index: i,
        message: `Line 1 length/checksum invalid for "${name}"`,
        raw: line1,
      });
      i += 3;
      continue;
    }
    if (!validateTleLine(line2)) {
      warnings.push({
        index: i,
        message: `Line 2 length/checksum invalid for "${name}"`,
        raw: line2,
      });
      i += 3;
      continue;
    }

    try {
      entries.push(decodeTleGroup(name, line1, line2));
    } catch (err) {
      warnings.push({
        index: i,
        message: `Failed to decode "${name}": ${(err as Error).message}`,
        raw: line1,
      });
    }
    i += 3;
  }

  return { entries, warnings };
}
