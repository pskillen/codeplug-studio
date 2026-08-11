import { describe, expect, it } from 'vitest';
import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';
import {
  NO_FREQUENCY_DATA,
  distinctVisibleModes,
  formatFrequenciesCell,
  satelliteHasVisibleMode,
  transmitterWriteEligibleCount,
} from './satelliteKepsListHelpers.ts';

function transmitter(overrides: Partial<SatelliteTransmitter> = {}): SatelliteTransmitter {
  return {
    id: 'tx-1',
    label: 'FM repeater',
    mode: 'FM',
    uplinkHz: 145_200_000,
    downlinkHz: 145_800_000,
    uplinkToneHz: null,
    downlinkToneHz: null,
    source: 'manual',
    satnogsUuid: null,
    satnogsAlive: null,
    satnogsStatus: null,
    satnogsSyncedAt: null,
    dismissed: false,
    includeInWrite: true,
    ...overrides,
  };
}

function satellite(overrides: Partial<Satellite> = {}): Satellite {
  return {
    id: 'sat-1',
    projectId: 'proj-1',
    revision: 1,
    updatedAt: '2024-03-19T12:25:40Z',
    name: 'ISS',
    noradId: 25544,
    enabled: true,
    source: 'celestrak',
    tleLine1: '1 25544U 98067A   24079.51782528  .00016717  00000-0  30721-3 0  9993',
    tleLine2: '2 25544  51.6416 335.6205 0006447  56.6529  36.3752 15.49560768 45087',
    epoch: '2024-03-19T12:25:40Z',
    classification: 'U',
    inclinationDeg: 51.6416,
    raanDeg: 335.6205,
    eccentricity: 0.0006447,
    argPerigeeDeg: 56.6529,
    meanAnomalyDeg: 36.3752,
    meanMotionRevPerDay: 15.4956,
    bstar: 0.00030721,
    elementSetNumber: 999,
    revolutionNumber: 4508,
    transmitters: [],
    ...overrides,
  } as Satellite;
}

describe('formatFrequenciesCell', () => {
  it('shows the empty marker when there are no non-dismissed transmitters', () => {
    expect(formatFrequenciesCell(satellite({ transmitters: [] }))).toBe(NO_FREQUENCY_DATA);
    expect(
      formatFrequenciesCell(satellite({ transmitters: [transmitter({ dismissed: true })] })),
    ).toBe(NO_FREQUENCY_DATA);
  });

  it('shows uplink/downlink for a single non-dismissed transmitter', () => {
    const result = formatFrequenciesCell(
      satellite({
        transmitters: [transmitter({ uplinkHz: 145_200_000, downlinkHz: 145_800_000 })],
      }),
    );
    expect(result).toBe('145.2 / 145.8 MHz');
  });

  it('shows only the side that is set when the other is null', () => {
    expect(
      formatFrequenciesCell(
        satellite({ transmitters: [transmitter({ uplinkHz: 145_200_000, downlinkHz: null })] }),
      ),
    ).toBe('Up 145.2 MHz');
    expect(
      formatFrequenciesCell(
        satellite({ transmitters: [transmitter({ uplinkHz: null, downlinkHz: 145_800_000 })] }),
      ),
    ).toBe('Down 145.8 MHz');
  });

  it('shows the empty marker for a single transmitter with no frequency data at all', () => {
    expect(
      formatFrequenciesCell(
        satellite({ transmitters: [transmitter({ uplinkHz: null, downlinkHz: null })] }),
      ),
    ).toBe(NO_FREQUENCY_DATA);
  });

  it('shows a count for more than one non-dismissed transmitter, ignoring write-eligibility', () => {
    const result = formatFrequenciesCell(
      satellite({
        enabled: false,
        transmitters: [
          transmitter({ id: 'tx-a', includeInWrite: false }),
          transmitter({ id: 'tx-b' }),
        ],
      }),
    );
    expect(result).toBe('2 radios');
  });

  it('ignores dismissed transmitters when counting', () => {
    const result = formatFrequenciesCell(
      satellite({
        transmitters: [
          transmitter({ id: 'tx-a' }),
          transmitter({ id: 'tx-b' }),
          transmitter({ id: 'tx-c', dismissed: true }),
        ],
      }),
    );
    expect(result).toBe('2 radios');
  });
});

describe('distinctVisibleModes', () => {
  it('dedupes and alphabetises modes across satellites, ignoring dismissed transmitters', () => {
    const satellites = [
      satellite({
        id: 'sat-a',
        transmitters: [
          transmitter({ id: 'tx-1', mode: 'FM' }),
          transmitter({ id: 'tx-2', mode: 'SSTV', dismissed: true }),
        ],
      }),
      satellite({
        id: 'sat-b',
        transmitters: [
          transmitter({ id: 'tx-3', mode: 'CW' }),
          transmitter({ id: 'tx-4', mode: 'FM' }),
        ],
      }),
    ];
    expect(distinctVisibleModes(satellites)).toEqual(['CW', 'FM']);
  });

  it('skips null modes', () => {
    const satellites = [satellite({ transmitters: [transmitter({ mode: null })] })];
    expect(distinctVisibleModes(satellites)).toEqual([]);
  });
});

describe('satelliteHasVisibleMode', () => {
  it('matches a non-dismissed transmitter with the given mode', () => {
    const s = satellite({ transmitters: [transmitter({ mode: 'FM' })] });
    expect(satelliteHasVisibleMode(s, 'FM')).toBe(true);
    expect(satelliteHasVisibleMode(s, 'CW')).toBe(false);
  });

  it('does not match a dismissed transmitter', () => {
    const s = satellite({ transmitters: [transmitter({ mode: 'FM', dismissed: true })] });
    expect(satelliteHasVisibleMode(s, 'FM')).toBe(false);
  });
});

describe('transmitterWriteEligibleCount', () => {
  it('returns 0/0 for a satellite with no transmitters', () => {
    expect(transmitterWriteEligibleCount(satellite({ transmitters: [] }))).toEqual({
      eligible: 0,
      total: 0,
    });
  });

  it('counts write-eligible transmitters over non-dismissed transmitters', () => {
    const s = satellite({
      transmitters: [
        transmitter({ id: 'tx-a' }),
        transmitter({ id: 'tx-b', includeInWrite: false }),
        transmitter({ id: 'tx-c' }),
        transmitter({ id: 'tx-d', dismissed: true }),
      ],
    });
    expect(transmitterWriteEligibleCount(s)).toEqual({ eligible: 2, total: 3 });
  });

  it('reports 0 eligible when the satellite itself is disabled, but keeps the visible total', () => {
    const s = satellite({
      enabled: false,
      transmitters: [transmitter({ id: 'tx-a' }), transmitter({ id: 'tx-b' })],
    });
    expect(transmitterWriteEligibleCount(s)).toEqual({ eligible: 0, total: 2 });
  });
});
