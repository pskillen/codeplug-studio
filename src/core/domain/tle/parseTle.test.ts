import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseTleBlock, tleChecksum, validateTleLine } from './parseTle.ts';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__');

function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf8');
}

describe('tleChecksum / validateTleLine', () => {
  const issLine1 = '1 25544U 98067A   24045.51782528  .00016717 00000-0   30589-3 0  9993';
  const issLine2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.4956032 430001';

  it('computes the modulo-10 checksum matching known-good lines', () => {
    expect(tleChecksum(issLine1)).toBe(3);
    expect(tleChecksum(issLine2)).toBe(1);
  });

  it('validates well-formed lines', () => {
    expect(validateTleLine(issLine1)).toBe(true);
    expect(validateTleLine(issLine2)).toBe(true);
  });

  it('rejects a line with a wrong checksum digit', () => {
    const corrupted = `${issLine1.slice(0, -1)}9`;
    expect(validateTleLine(corrupted)).toBe(false);
  });

  it('rejects a line that is not 69 characters', () => {
    expect(validateTleLine(issLine1.slice(0, -2))).toBe(false);
  });
});

describe('parseTleBlock', () => {
  it('parses a valid 3-line-per-satellite block with no warnings', () => {
    const { entries, warnings } = parseTleBlock(readFixture('valid.tle'));

    expect(warnings).toEqual([]);
    expect(entries).toHaveLength(2);

    const [iss, ao91] = entries;
    expect(iss.name).toBe('ISS (ZARYA)');
    expect(iss.noradId).toBe(25544);
    expect(iss.classification).toBe('U');
    expect(iss.inclinationDeg).toBeCloseTo(51.6416, 4);
    expect(iss.raanDeg).toBeCloseTo(247.4627, 4);
    expect(iss.eccentricity).toBeCloseTo(0.0006703, 7);
    expect(iss.argPerigeeDeg).toBeCloseTo(130.536, 4);
    expect(iss.meanAnomalyDeg).toBeCloseTo(325.0288, 4);
    expect(iss.meanMotionRevPerDay).toBeCloseTo(15.4956032, 6);
    expect(iss.revolutionNumber).toBe(43000);
    expect(iss.elementSetNumber).toBe(999);
    expect(iss.bstar).toBeCloseTo(0.00030589, 8);
    expect(iss.epoch.startsWith('2024-02-14')).toBe(true);
    expect(iss.tleLine1.length).toBe(69);
    expect(iss.tleLine2.length).toBe(69);

    expect(ao91.name).toBe('AO-91');
    expect(ao91.noradId).toBe(43017);
  });

  it('skips a bad-checksum group and a truncated-line group, keeping the trailing valid entry', () => {
    const { entries, warnings } = parseTleBlock(readFixture('invalid.tle'));

    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('ISS (ZARYA)');

    expect(warnings).toHaveLength(2);
    expect(warnings[0].message).toMatch(/Line 1 length\/checksum invalid/);
    expect(warnings[1].message).toMatch(/Line 2 length\/checksum invalid/);
  });

  it('returns no entries or warnings for empty input', () => {
    expect(parseTleBlock('')).toEqual({ entries: [], warnings: [] });
  });
});
