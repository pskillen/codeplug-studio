import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCsv } from '@core/import-export/csvParse.ts';
import {
  buildRadioidDumpHeaderIndex,
  mapRadioidDumpRowToDirectoryEntry,
} from './mapDumpRowToDirectoryEntry.ts';

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const sampleCsv = readFileSync(join(fixtureDir, 'fixtures/user-dump.sample.csv'), 'utf8');

describe('mapRadioidDumpRowToDirectoryEntry', () => {
  const parsed = parseCsv(sampleCsv.trim());
  const [headerRow, ...dataRows] = parsed;
  const headerIndex = buildRadioidDumpHeaderIndex(headerRow!);

  it('maps a valid dump row', () => {
    const entry = mapRadioidDumpRowToDirectoryEntry(
      dataRows[0]!,
      headerIndex,
      'project-1',
      '2026-01-01T00:00:00.000Z',
    );
    expect(entry).toMatchObject({
      projectId: 'project-1',
      digitalId: 1023007,
      callsign: 'VA3BOC',
      name: 'Hans Juergen',
      city: 'Cornwall',
      state: 'Ontario',
      country: 'Canada',
      mode: 'dmr',
    });
  });

  it('returns null for invalid radio id', () => {
    const entry = mapRadioidDumpRowToDirectoryEntry(
      dataRows[2]!,
      headerIndex,
      'project-1',
      '2026-01-01T00:00:00.000Z',
    );
    expect(entry).toBeNull();
  });
});
