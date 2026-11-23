import { describe, expect, it } from 'vitest';
import validTle from '@core/domain/tle/__fixtures__/valid.tle?raw';
import type { BuildEntityOverride } from '@core/models/radioBuild.ts';
import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';
import { RADIOFOUNDRY_LIMITS, type RadioFoundryBand } from '@core/radios/radiofoundry/limits.ts';
import {
  countRadioFoundryWriteSatellites,
  packRadioFoundrySatellites,
  previewRadioFoundrySatelliteWriteRecords,
  radioFoundrySkippedSatellites,
  radioFoundrySkippedTransmitters,
  type RadioFoundryKepsOptions,
} from './satelliteCodec.ts';

const BANDS: RadioFoundryBand[] = [
  { minHz: 136_000_000, maxHz: 174_000_000 },
  { minHz: 400_000_000, maxHz: 480_000_000 },
];

const OPTIONS: RadioFoundryKepsOptions = { bands: BANDS };

function issTle(): { line1: string; line2: string } {
  const blocks = validTle.trim().split(/\n\n+/);
  const iss = blocks[0]!.trim().split('\n');
  return { line1: iss[1]!, line2: iss[2]! };
}

function makeTransmitter(overrides: Partial<SatelliteTransmitter> = {}): SatelliteTransmitter {
  return {
    id: 'tx-1',
    label: 'FM Voice',
    mode: 'FM',
    uplinkHz: 145_850_000,
    downlinkHz: 436_795_000,
    uplinkToneHz: 67,
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

function makeSatellite(overrides: Partial<Satellite> = {}): Satellite {
  const tle = issTle();
  return {
    id: 'sat-1',
    projectId: 'proj-1',
    revision: 1,
    updatedAt: '2024-01-01T00:00:00Z',
    name: 'SO-50',
    noradId: 27607,
    enabled: true,
    source: 'celestrak',
    tleLine1: tle.line1.replace(/25544/g, '27607'),
    tleLine2: tle.line2.replace(/25544/g, '27607'),
    epoch: '2024-01-01T00:00:00Z',
    classification: 'U',
    inclinationDeg: 51.6416,
    raanDeg: 247.4627,
    eccentricity: 0.0006703,
    argPerigeeDeg: 130.536,
    meanAnomalyDeg: 325.0288,
    meanMotionRevPerDay: 15.49560319,
    bstar: 0.0001023,
    elementSetNumber: 999,
    revolutionNumber: 99999,
    transmitters: [makeTransmitter()],
    ...overrides,
  };
}

describe('packRadioFoundrySatellites', () => {
  it('writes one record and profile per satellite from its first FM pair', () => {
    const packed = packRadioFoundrySatellites([makeSatellite()], OPTIONS);
    expect(packed.records).toHaveLength(1);
    expect(packed.profiles).toHaveLength(1);
    const rec = packed.records[0]!;
    expect(rec.catalogId).toBe(27607);
    expect(rec.line1).toBe(makeSatellite().tleLine1);
    expect(rec.line2).toBe(makeSatellite().tleLine2);
    expect(packed.profiles[0]).toEqual({
      catalogId: 27607,
      rxHz: 436_795_000,
      txHz: 145_850_000,
      toneTenths: 670,
    });
  });

  it('lets the build pick another FM transmitter', () => {
    const tx1 = makeTransmitter({ id: 'tx-a', label: 'Primary' });
    const tx2 = makeTransmitter({ id: 'tx-b', label: 'Alternate', uplinkHz: 145_850_000 });
    const sat = makeSatellite({ transmitters: [tx1, tx2] });
    const override: BuildEntityOverride = {
      libraryEntityId: 'tx-b',
      satelliteBankSlot: 'fm',
    };
    const packed = packRadioFoundrySatellites([sat], {
      ...OPTIONS,
      satelliteOverrides: [override],
    });
    expect(packed.profiles[0]!.txHz).toBe(145_850_000);
    const skipped = radioFoundrySkippedTransmitters([sat], {
      ...OPTIONS,
      satelliteOverrides: [override],
    });
    expect(skipped).toEqual([
      {
        satelliteId: sat.id,
        transmitterId: 'tx-a',
        reason: 'Not chosen: RadioFoundry stores one frequency pair per satellite.',
      },
    ]);
  });

  it('skips satellites it cannot track, with the reason', () => {
    const tle = issTle();
    const cases: { sat: Satellite; reason: string }[] = [
      {
        sat: makeSatellite({
          id: 'beacon',
          transmitters: [
            makeTransmitter({ mode: 'Beacon', uplinkHz: null, downlinkHz: 436_795_000 }),
          ],
        }),
        reason: 'RadioFoundry tracks FM satellites only.',
      },
      {
        sat: makeSatellite({
          id: 'cw',
          transmitters: [makeTransmitter({ mode: 'CW' })],
        }),
        reason: 'RadioFoundry tracks FM satellites only.',
      },
      {
        sat: makeSatellite({
          id: 'no-ul',
          transmitters: [makeTransmitter({ uplinkHz: null })],
        }),
        reason: 'RadioFoundry needs an uplink frequency to track a satellite.',
      },
      {
        sat: makeSatellite({
          id: 'ghz',
          transmitters: [
            makeTransmitter({
              uplinkHz: 10_489_500_000,
              downlinkHz: 10_489_500_000,
            }),
          ],
        }),
        reason: "Its uplink or downlink is outside this radio's bands.",
      },
      {
        sat: makeSatellite({
          id: 'catalog',
          noradId: 100_000,
        }),
        reason: `RadioFoundry stores catalog numbers up to ${RADIOFOUNDRY_LIMITS.SATELLITE_CATALOG_MAX} only.`,
      },
      {
        sat: makeSatellite({ id: 'off', enabled: false }),
        reason: 'unused',
      },
      {
        sat: makeSatellite({
          id: 'no-tx',
          transmitters: [makeTransmitter({ includeInWrite: false })],
        }),
        reason: 'It has no transmitter marked for write.',
      },
    ];
    for (const { sat, reason } of cases) {
      if (!sat.enabled) {
        expect(
          radioFoundrySkippedSatellites([sat], OPTIONS).find((s) => s.satelliteId === sat.id),
        ).toBeUndefined();
        continue;
      }
      const row = radioFoundrySkippedSatellites([sat], OPTIONS).find(
        (s) => s.satelliteId === sat.id,
      );
      expect(row?.reason).toBe(reason);
    }
  });

  it('uses the build name override and keeps names within 48 bytes', () => {
    const override: BuildEntityOverride = { libraryEntityId: 'sat-1', wireName: '  My ISS  ' };
    const preview = previewRadioFoundrySatelliteWriteRecords([makeSatellite()], {
      ...OPTIONS,
      satelliteOverrides: [override],
    });
    expect(preview[0]!.encodedName).toBe('My ISS');
    expect(preview[0]!.hasWireNameOverride).toBe(true);
    const longName = 'X'.repeat(60);
    const previewLong = previewRadioFoundrySatelliteWriteRecords(
      [makeSatellite({ name: longName })],
      OPTIONS,
    );
    expect(previewLong[0]!.encodedName.length).toBeLessThanOrEqual(
      RADIOFOUNDRY_LIMITS.SATELLITE_NAME_MAX_BYTES,
    );
    expect(previewLong[0]!.nameTruncated).toBe(true);
  });

  it('counts what it would write', () => {
    const tle = issTle();
    const satellites: Satellite[] = [];
    for (let i = 0; i < 12; i += 1) {
      const norad = 27_000 + i;
      const writable = i < 11;
      satellites.push(
        makeSatellite({
          id: `sat-${i}`,
          noradId: norad,
          name: `Sat ${i}`,
          enabled: writable || i === 11,
          tleLine1: tle.line1.replace(/25544/g, String(norad).padStart(5, '0')),
          tleLine2: tle.line2.replace(/25544/g, String(norad).padStart(5, '0')),
          transmitters: writable
            ? [makeTransmitter({ id: `tx-${i}` })]
            : [makeTransmitter({ id: `tx-${i}`, mode: 'CW' })],
        }),
      );
    }
    expect(countRadioFoundryWriteSatellites(satellites, OPTIONS)).toBe(11);
    expect(packRadioFoundrySatellites(satellites, OPTIONS).records.length).toBe(11);
  });

  it('previews exactly what it packs', () => {
    const satellites = [makeSatellite()];
    const packed = packRadioFoundrySatellites(satellites, OPTIONS);
    const preview = previewRadioFoundrySatelliteWriteRecords(satellites, OPTIONS);
    expect(preview).toHaveLength(packed.records.length);
    expect(preview[0]!.encodedName).toBe(packed.records[0]!.name);
    expect(preview[0]!.transmitterId).toBe(makeTransmitter().id);
    expect(preview[0]!.slot).toBe('fm');
  });
});
