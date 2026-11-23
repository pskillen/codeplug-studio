import { describe, expect, it, vi } from 'vitest';
import validTle from '@core/domain/tle/__fixtures__/valid.tle?raw';
import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';
import { RADIOFOUNDRY_LIMITS } from '@core/radios/radiofoundry/limits.ts';
import { DM32_RADIOFOUNDRY_DESCRIPTOR } from '@integrations/radio-io/radios/radiofoundry/descriptor.ts';
import { DM32UV_RADIOFOUNDRY_CABLE_BOARD } from '@integrations/radio-io/radios/radiofoundry/board.ts';
import { createRadioFoundryCableProtocol } from '@integrations/radio-io/radios/radiofoundry/protocol.ts';
import type { BytePipe, RadioSession } from '@integrations/radio-io/types.ts';
import { RadioFoundrySatellitesUnavailableError } from '@integrations/radio-io/radios/radiofoundry/satelliteWrite.ts';
import { RadioWriteBlockedError } from './radioIoSession.ts';
import { writeRadioFoundrySatellitesToRadio } from './radioIoRadioFoundrySatelliteWrite.ts';

const { writeSpy } = vi.hoisted(() => ({
  writeSpy: vi.fn(async () => ({ written: 2, capacity: 10 })),
}));

vi.mock('@integrations/radio-io/radios/radiofoundry/satelliteWrite.ts', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@integrations/radio-io/radios/radiofoundry/satelliteWrite.ts')
    >();
  return {
    ...actual,
    writeRadioFoundrySatellites: writeSpy,
  };
});

const pipe: BytePipe = {
  write: async () => {},
  readExact: async () => new Uint8Array(0),
  close: async () => {},
};

function makeTransmitter(overrides: Partial<SatelliteTransmitter> = {}): SatelliteTransmitter {
  return {
    id: 'tx-1',
    label: 'FM',
    mode: 'FM',
    uplinkHz: 145_850_000,
    downlinkHz: 436_795_000,
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

function issTleFor(catalog: number): { line1: string; line2: string } {
  const blocks = validTle.trim().split(/\n\n+/);
  const iss = blocks[0]!.trim().split('\n');
  const cat = String(catalog).padStart(5, '0');
  return {
    line1: iss[1]!.replace(/25544/g, cat),
    line2: iss[2]!.replace(/25544/g, cat),
  };
}

function makeSatellite(overrides: Partial<Satellite> = {}): Satellite {
  const noradId = overrides.noradId ?? 27_607;
  const tle = issTleFor(noradId);
  return {
    id: 'sat-1',
    projectId: 'proj-1',
    revision: 1,
    updatedAt: '2024-01-01T00:00:00Z',
    name: 'SO-50',
    noradId,
    enabled: true,
    source: 'celestrak',
    tleLine1: tle.line1,
    tleLine2: tle.line2,
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

function foundrySession(): RadioSession {
  const radio = createRadioFoundryCableProtocol(DM32UV_RADIOFOUNDRY_CABLE_BOARD);
  return {
    descriptor: { ...DM32_RADIOFOUNDRY_DESCRIPTOR, label: 'Baofeng DM-32UV (RadioFoundry)' },
    pipe,
    radio,
  };
}

describe('writeRadioFoundrySatellitesToRadio', () => {
  it('packs the library and writes it', async () => {
    writeSpy.mockClear();
    writeSpy.mockResolvedValueOnce({ written: 2, capacity: 10 });
    const sats = [makeSatellite({ id: 'a' }), makeSatellite({ id: 'b', noradId: 27_608 })];
    const result = await writeRadioFoundrySatellitesToRadio(foundrySession(), sats);
    expect(writeSpy).toHaveBeenCalledOnce();
    const input = writeSpy.mock.calls[0]![1];
    expect(input.records).toHaveLength(2);
    expect(input.profiles).toHaveLength(2);
    expect(result.written).toBe(2);
  });

  it('blocks more than ten satellites before touching the radio', async () => {
    writeSpy.mockClear();
    const sats = Array.from({ length: RADIOFOUNDRY_LIMITS.SATELLITE_MAX + 1 }, (_, i) =>
      makeSatellite({ id: `sat-${i}`, noradId: 27_000 + i }),
    );
    await expect(writeRadioFoundrySatellitesToRadio(foundrySession(), sats)).rejects.toMatchObject({
      capacity: { selected: 11, max: 10, radioLabel: 'Baofeng DM-32UV (RadioFoundry)' },
    });
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('blocks when nothing can be written', async () => {
    writeSpy.mockClear();
    const sats = [makeSatellite({ transmitters: [makeTransmitter({ mode: 'CW' })] })];
    await expect(writeRadioFoundrySatellitesToRadio(foundrySession(), sats)).rejects.toBeInstanceOf(
      RadioWriteBlockedError,
    );
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('turns an unavailable radio into a blocked write', async () => {
    writeSpy.mockClear();
    writeSpy.mockRejectedValueOnce(new RadioFoundrySatellitesUnavailableError('x'));
    await expect(
      writeRadioFoundrySatellitesToRadio(foundrySession(), [makeSatellite()]),
    ).rejects.toMatchObject({
      message: 'x Nothing was written.',
    });
  });

  it('refuses a session that is not RadioFoundry', async () => {
    const session: RadioSession = {
      ...foundrySession(),
      radio: {} as RadioSession['radio'],
    };
    await expect(writeRadioFoundrySatellitesToRadio(session, [makeSatellite()])).rejects.toThrow(
      'RadioFoundry satellite write needs a RadioFoundry radio session.',
    );
  });
});
