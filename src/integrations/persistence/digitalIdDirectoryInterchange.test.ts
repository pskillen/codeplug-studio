import { describe, expect, it } from 'vitest';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import {
  parseDirectoryInterchangeCsv,
  parseDirectoryInterchangeYaml,
  serialiseDirectoryInterchangeCsv,
  serialiseDirectoryInterchangeYaml,
} from './digitalIdDirectoryInterchange.ts';

const PROJECT_ID = 'proj-1';

function sampleEntry(digitalId: number, callsign: string): DigitalIdDirectoryEntry {
  return {
    projectId: PROJECT_ID,
    digitalId,
    mode: 'dmr',
    callsign,
    name: `${callsign} Name`,
    city: 'London',
    state: 'England',
    country: 'GB',
    remarks: 'note',
    fetchedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('digitalIdDirectoryInterchange', () => {
  it('round-trips directory rows through YAML', () => {
    const entries = [sampleEntry(1234567, 'M0ABC'), sampleEntry(7654321, 'G1XYZ')];
    const yaml = serialiseDirectoryInterchangeYaml(entries);
    expect(yaml).not.toContain('projectId');
    expect(yaml).toContain('schemaVersion: 1');
    const parsed = parseDirectoryInterchangeYaml(yaml, PROJECT_ID);
    expect(parsed).toEqual(entries);
  });

  it('round-trips directory rows through CSV (header-by-name)', () => {
    const entries = [sampleEntry(1234567, 'M0ABC')];
    const csv = serialiseDirectoryInterchangeCsv(entries);
    const parsed = parseDirectoryInterchangeCsv(csv, PROJECT_ID);
    expect(parsed).toEqual(entries);
  });

  it('parses CSV when optional columns are reordered', () => {
    const csv = [
      'name,callsign,digitalId,mode,city,state,country',
      'Alice,M0ABC,42,dmr,City,State,GB',
    ].join('\n');
    const parsed = parseDirectoryInterchangeCsv(csv, PROJECT_ID);
    expect(parsed).toEqual([
      {
        projectId: PROJECT_ID,
        digitalId: 42,
        mode: 'dmr',
        callsign: 'M0ABC',
        name: 'Alice',
        city: 'City',
        state: 'State',
        country: 'GB',
      },
    ]);
  });
});
