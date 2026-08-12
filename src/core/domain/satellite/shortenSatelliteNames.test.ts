import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseSatelliteName } from './parseSatelliteName.ts';
import { shortenSatelliteNames } from './shortenSatelliteNames.ts';

const N = 8;
const fixtureDir = dirname(fileURLToPath(import.meta.url));

function shortenAll(
  names: { id: string; name: string; noradId: number; wireNameOverride?: string }[],
) {
  return shortenSatelliteNames(names, { maxLength: N });
}

describe('parseSatelliteName', () => {
  it('splits alias, composite, and index', () => {
    expect(parseSatelliteName('GEOSCAN 6 (RS92S6)')).toMatchObject({
      base: 'GEOSCAN 6',
      alias: 'RS92S6',
      aliasTier: 'catalogue',
      head: 'GEOSCAN',
      index: '6',
    });
    expect(parseSatelliteName('CAS-2T & KS-1Q').base).toBe('CAS-2T');
    expect(parseSatelliteName('ISS (ZARYA)')).toMatchObject({
      base: 'ISS',
      alias: 'ZARYA',
      aliasTier: 'alternate',
    });
    expect(parseSatelliteName('DIWATA-2B')).toMatchObject({
      head: 'DIWATA',
      index: '2B',
      indexSeparator: '-',
    });
    expect(parseSatelliteName('CUBESAT XI-V').index).toBeNull();
  });
});

describe('shortenSatelliteNames — familiar-name-first', () => {
  const cases: [string, string][] = [
    ['GREENCUBE (IO-117)', 'GREENCUB'],
    ['FOX-1A (AO-85)', 'FOX-1A'],
    ['OSCAR 7 (AO-7)', 'OSCAR 7'],
    ['ISS (ZARYA)', 'ISS'],
    ['XW-3 (CAS-9)', 'XW-3'],
    ['TEVEL2-4', 'TEVEL2-4'],
    ["ES'HAIL 2", 'ESHAIL 2'],
    ['GEOSCAN 6 (RS92S6)', 'GEOSCA 6'],
    ['MONITOR-3 (RS58S)', 'MONITO-3'],
    ['DUCHIFAT-1', 'DUCHIF-1'],
    ['CAS-2T & KS-1Q', 'CAS-2T'],
  ];

  it.each(cases)('%s → %s', (name, expected) => {
    const result = shortenAll([{ id: '1', name, noradId: 1 }]);
    expect(result.get('1')!.shortName).toBe(expected);
  });

  it('keeps INNOSAT series on a shared stem', () => {
    const result = shortenAll([
      { id: 'a', name: 'INNOSAT 16 (RS92S7)', noradId: 64878 },
      { id: 'b', name: 'INNOSAT 3 (RS92S0)', noradId: 64894 },
    ]);
    expect(result.get('a')!.shortName).toBe('INNOS 16');
    expect(result.get('b')!.shortName).toBe('INNOS 3');
  });

  it('reserves override names and still exposes generated default', () => {
    const result = shortenAll([
      { id: 'a', name: 'GEOSCAN 1 (RS92S1)', noradId: 64880 },
      { id: 'b', name: 'GEOSCAN 6 (RS92S6)', noradId: 64879, wireNameOverride: 'MYGEOS 6' },
    ]);
    expect(result.get('b')!.shortName).toBe('MYGEOS 6');
    expect(result.get('b')!.fromOverride).toBe(true);
    expect(result.get('b')!.generatedShortName).toBe('GEOSCA 6');
    expect(result.get('a')!.shortName).toBe('GEOSCA 1');
  });

  it('exposes familiar and OSCAR suggestions', () => {
    const fox = shortenAll([{ id: '1', name: 'FOX-1A (AO-85)', noradId: 1 }]).get('1')!;
    expect(fox.suggestedFamiliar).toBe('FOX-1A');
    expect(fox.suggestedOscar).toBe('AO-85');

    const iss = shortenAll([{ id: '1', name: 'ISS (ZARYA)', noradId: 1 }]).get('1')!;
    expect(iss.suggestedFamiliar).toBe('ISS');
    expect(iss.suggestedOscar).toBeNull();
  });
});

describe('shortenSatelliteNames — amateur catalogue fixture', () => {
  const csv = readFileSync(join(fixtureDir, 'test-data/amateur-object-names.csv'), 'utf8');
  const rows = csv
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => {
      const name = line.split(',')[0]!;
      const noradId = Number(line.split(',')[11]);
      return { id: String(noradId), name, noradId };
    });

  it('assigns unique names within maxLength', () => {
    const result = shortenAll(rows);
    const names = [...result.values()].map((r) => r.shortName);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) {
      expect(n.length).toBeGreaterThan(0);
      expect(n.length).toBeLessThanOrEqual(N);
    }
  });

  it('is deterministic regardless of input order', () => {
    const shuffled = [...rows].reverse();
    const a = shortenAll(rows);
    const b = shortenAll(shuffled);
    for (const row of rows) {
      expect(a.get(row.id)!.shortName).toBe(b.get(row.id)!.shortName);
    }
  });
});
