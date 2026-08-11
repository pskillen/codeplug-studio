import { describe, expect, it } from 'vitest';
import { readSatelliteRow } from './satelliteRow.ts';

function baseRow() {
  return {
    id: 'sat-1',
    projectId: 'proj-1',
    revision: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'Test Sat',
    noradId: 12345,
    enabled: true,
    source: 'celestrak' as const,
    tleLine1: '1',
    tleLine2: '2',
    epoch: '2026-01-01T00:00:00.000Z',
    classification: 'U',
    inclinationDeg: 0,
    raanDeg: 0,
    eccentricity: 0,
    argPerigeeDeg: 0,
    meanAnomalyDeg: 0,
    meanMotionRevPerDay: 15,
    bstar: 0,
    elementSetNumber: 1,
    revolutionNumber: 1,
  };
}

describe('readSatelliteRow', () => {
  it('defaults includeInWrite to true on transmitters entries that lack it entirely', () => {
    const row = {
      ...baseRow(),
      transmitters: [
        {
          id: 'tx-1',
          label: 'Transmitter',
          mode: null,
          uplinkHz: 145_990_000,
          downlinkHz: 437_800_000,
          uplinkToneHz: null,
          downlinkToneHz: null,
          source: 'manual' as const,
          satnogsUuid: null,
          satnogsAlive: null,
          satnogsStatus: null,
          satnogsSyncedAt: null,
          dismissed: false,
          // includeInWrite intentionally absent — pre-ticket IndexedDB row shape.
        },
      ],
    };

    const result = readSatelliteRow(row);

    expect(result.transmitters).toHaveLength(1);
    expect(result.transmitters[0].includeInWrite).toBe(true);
  });

  it('preserves an explicit includeInWrite value on each entry (mixed true/false)', () => {
    const row = {
      ...baseRow(),
      transmitters: [
        {
          id: 'tx-1',
          label: 'Transmitter 1',
          mode: null,
          uplinkHz: null,
          downlinkHz: null,
          uplinkToneHz: null,
          downlinkToneHz: null,
          source: 'manual' as const,
          satnogsUuid: null,
          satnogsAlive: null,
          satnogsStatus: null,
          satnogsSyncedAt: null,
          dismissed: false,
          includeInWrite: false,
        },
        {
          id: 'tx-2',
          label: 'Transmitter 2',
          mode: null,
          uplinkHz: null,
          downlinkHz: null,
          uplinkToneHz: null,
          downlinkToneHz: null,
          source: 'manual' as const,
          satnogsUuid: null,
          satnogsAlive: null,
          satnogsStatus: null,
          satnogsSyncedAt: null,
          dismissed: false,
          includeInWrite: true,
        },
      ],
    };

    const result = readSatelliteRow(row);

    expect(result.transmitters[0].includeInWrite).toBe(false);
    expect(result.transmitters[1].includeInWrite).toBe(true);
  });

  it('synthesizes a write-eligible manual transmitter for a legacy scalar-field row', () => {
    const row = {
      ...baseRow(),
      uplinkHz: 145_990_000,
      downlinkHz: 437_800_000,
      uplinkToneHz: null,
      downlinkToneHz: null,
    };

    const result = readSatelliteRow(row);

    expect(result.transmitters).toHaveLength(1);
    expect(result.transmitters[0].includeInWrite).toBe(true);
  });
});
