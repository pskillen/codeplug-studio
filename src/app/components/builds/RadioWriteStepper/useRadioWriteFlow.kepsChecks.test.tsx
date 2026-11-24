import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';
import { grantRadioSerialPortForEgress } from '../../../services/radioIoSession.ts';
import { useRadioWriteFlow } from './useRadioWriteFlow.tsx';

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

function makeSatellite(overrides: Partial<Satellite> = {}): Satellite {
  return {
    id: 'sat-1',
    projectId: 'proj-1',
    revision: 1,
    updatedAt: '2024-01-01T00:00:00Z',
    name: 'ISS',
    noradId: 25544,
    enabled: true,
    source: 'celestrak',
    tleLine1: '1 25544U 98067A   24079.51782528  .00016717  00000-0  30721-3 0  9993',
    tleLine2: '2 25544  51.6416 335.6205 0006447  56.6529  36.3752 15.49560768 45087',
    epoch: '2024-01-01T00:00:00Z',
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
    transmitters: [makeTransmitter()],
    ...overrides,
  } as Satellite;
}

const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-at-d890uv', 'Keps checks build');
const descriptor = {
  label: 'Anytone AT-D890UV',
  modelIds: ['AT-D890UV'],
  supportsBle: false,
  protocolFactory: () => {
    throw new Error('not used');
  },
  capabilities: {
    maxChannels: 1000,
    supportsZones: true,
    supportsScanLists: true,
    analogOnly: false,
  },
  attributionIds: [],
  compatibleProfiles: [],
  writeStrategy: 'selective-ranges',
  baudRate: 921_600,
  hydration: {
    extractHydration: () => {
      throw new Error('not used');
    },
    mergeChannelsIntoHydration: () => {
      throw new Error('not used');
    },
  },
} as never;

vi.mock('../../../state/persistence.ts', () => ({
  persistence: {
    listSatellites: vi.fn(async () => [] as Satellite[]),
    countDigitalIdDirectoryEntries: vi.fn(async () => 0),
  },
}));

vi.mock('../../../services/radioIoSession.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/radioIoSession.ts')>();
  return {
    ...actual,
    grantRadioSerialPortForEgress: vi.fn(async () => ({
      transport: 'web' as const,
      port: {} as SerialPort,
    })),
    openRadioSessionForEgress: vi.fn(),
    closeRadioSession: vi.fn(),
    prepareRadioWriteImage: vi.fn(),
    uploadPreparedRadioWrite: vi.fn(),
    verifyRadioWrite: vi.fn(),
  };
});

import { persistence } from '../../../state/persistence.ts';

function mount() {
  return renderHook(() =>
    useRadioWriteFlow({
      build,
      egress,
      descriptor,
      activeProjectId: 'p1',
    }),
  );
}

describe('useRadioWriteFlow keps checks on step 1', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('keps over capacity refuse on step 1 and no port is requested', async () => {
    const satellites = Array.from({ length: AT_D890UV_LIMITS.SATELLITE_MAX + 1 }, (_, i) =>
      makeSatellite({ id: `sat-${i}`, transmitters: [makeTransmitter({ id: `tx-${i}` })] }),
    );
    vi.mocked(persistence.listSatellites).mockResolvedValue(satellites);
    const { result } = mount();
    act(() =>
      result.current.open({ codeplug: false, contacts: false, settings: false, keps: true }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.view.buildChecks.refusals.length).toBeGreaterThan(0);
    expect(result.current.view.buildChecks.refusals[0]!.message).toContain('only supports');
    await act(async () => {
      result.current.actions.onConnectAndRead();
      await Promise.resolve();
    });
    expect(grantRadioSerialPortForEgress).not.toHaveBeenCalled();
  });

  it('nothing eligible refuses on step 1', async () => {
    vi.mocked(persistence.listSatellites).mockResolvedValue([
      makeSatellite({ transmitters: [makeTransmitter({ mode: 'SSTV' })] }),
    ]);
    const { result } = mount();
    act(() =>
      result.current.open({ codeplug: false, contacts: false, settings: false, keps: true }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      result.current.view.buildChecks.refusals.some((r) => r.message.includes('Nothing to write')),
    ).toBe(true);
  });

  it('keps exclusions are folded notes on step 1', async () => {
    vi.mocked(persistence.listSatellites).mockResolvedValue([
      makeSatellite({
        id: 'sat-a',
        name: 'AO-91',
        transmitters: [
          makeTransmitter({ id: 'tx-a', label: 'Voice', mode: 'FM' }),
          makeTransmitter({ id: 'tx-b', label: 'SSTV', mode: 'SSTV' }),
        ],
      }),
    ]);
    const { result } = mount();
    act(() =>
      result.current.open({ codeplug: false, contacts: false, settings: false, keps: true }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      result.current.view.buildChecks.warnings.some(
        (w) => w.kind === 'keps_excluded' && 'label' in w && w.label === 'AO-91 / SSTV',
      ),
    ).toBe(true);
  });

  it("the keps write passes the build's overrides", async () => {
    const satellites = Array.from({ length: AT_D890UV_LIMITS.SATELLITE_MAX + 1 }, (_, i) =>
      makeSatellite({ id: `sat-${i}`, transmitters: [makeTransmitter({ id: `tx-${i}` })] }),
    );
    vi.mocked(persistence.listSatellites).mockResolvedValue(satellites);
    const buildWithOverride = {
      ...build,
      satelliteOverrides: [{ libraryEntityId: 'sat-0', excluded: true }],
    };
    const { result } = renderHook(() =>
      useRadioWriteFlow({
        build: buildWithOverride,
        egress,
        descriptor,
        activeProjectId: 'p1',
      }),
    );
    act(() =>
      result.current.open({ codeplug: false, contacts: false, settings: false, keps: true }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.view.buildChecks.refusals).toEqual([]);
  });
});
