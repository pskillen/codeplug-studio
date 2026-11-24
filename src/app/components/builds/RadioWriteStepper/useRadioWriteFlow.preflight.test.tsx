import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import { pushGeneralWarning } from '@core/import-export/exportWarning.ts';
import type { RadioDescriptor, RadioPreflightResult } from '@integrations/radio-io/types.ts';
import {
  openRadioSessionForEgress,
  uploadPreparedRadioWrite,
} from '../../../services/radioIoSession.ts';
import { useRadioWriteFlow } from './useRadioWriteFlow.tsx';

const build = { id: 'b1', revision: 1 } as RadioBuild;
const egress = { id: 'e1', profileId: 'radio-io-dm32uv', formatId: 'radio-io' } as EgressPath;

function descriptorWithPreflight(result: RadioPreflightResult): RadioDescriptor {
  return {
    label: 'Test',
    modelIds: ['T'],
    supportsBle: false,
    protocolFactory: () => {
      throw new Error('not used');
    },
    capabilities: {
      maxChannels: 100,
      supportsZones: false,
      supportsScanLists: false,
      analogOnly: false,
      supportsBle: false,
      supportsBulkRead: false,
    },
    attributionIds: [],
    compatibleProfiles: [],
    writeStrategy: 'full-image',
    baudRate: 57600,
    hydration: {
      extractHydration: () => {
        throw new Error('not used');
      },
      mergeChannelsIntoHydration: () => {
        throw new Error('not used');
      },
    },
    writePreflight: async () => result,
  };
}

vi.mock('../../../lib/loadLibrarySlice.ts', () => ({
  loadLibrarySlice: vi.fn(async () => ({
    channels: [],
    zones: [],
    scanLists: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    aprsConfiguration: null,
  })),
}));

vi.mock('../../../state/persistence.ts', () => ({
  persistence: {
    listSatellites: vi.fn(async () => []),
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
    openRadioSessionForEgress: vi.fn(async () => {
      const descriptor = { label: 'Test', modelIds: ['T'] };
      return {
        descriptor,
        session: {
          descriptor,
          pipe: {},
          radio: {
            disconnect: vi.fn(async () => undefined),
            upload: vi.fn(),
            getDownloadCache: () => ({ blocks: new Map() }),
          },
        },
      };
    }),
    closeRadioSession: vi.fn(),
    prepareRadioWriteImage: vi.fn(async () => ({
      image: undefined,
      warnings: [],
      organisation: {},
      channels: [],
    })),
    uploadPreparedRadioWrite: vi.fn(async () => ({
      channels: [],
      warnings: [],
    })),
  };
});

describe('useRadioWriteFlow pre-flight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a pre-flight refusal stops before the read', async () => {
    const refusal = Object.assign(new Error('cannot write'), {
      retry: 'none',
      sent: 'nothing-sent',
    });
    const { result } = renderHook(() =>
      useRadioWriteFlow({
        build,
        egress,
        descriptor: descriptorWithPreflight({
          identity: { model: 'Test' },
          rows: [],
          refusal,
        }),
        activeProjectId: 'p1',
      }),
    );
    act(() =>
      result.current.open({ codeplug: true, contacts: false, settings: false, keps: false }),
    );
    await act(async () => {
      vi.advanceTimersByTime(350);
      await result.current.actions.onConnectAndRead();
      await Promise.resolve();
    });
    expect(vi.mocked(uploadPreparedRadioWrite)).not.toHaveBeenCalled();
    expect(result.current.view.step).toBe('connect');
  });

  it('a radio without pre-flight shows the default rows', async () => {
    const { result } = renderHook(() =>
      useRadioWriteFlow({
        build,
        egress,
        descriptor: { label: 'OpenGD77', modelIds: ['1701'] } as never,
        activeProjectId: 'p1',
      }),
    );
    act(() =>
      result.current.open({ codeplug: true, contacts: false, settings: false, keps: false }),
    );
    await act(async () => {
      vi.advanceTimersByTime(350);
      await result.current.actions.onConnectAndRead();
    });
    expect(result.current.view.preflight.rows.some((r) => r.label === 'Serial')).toBe(true);
  });

  it('pre-flight findings make Review appear', async () => {
    const findings: ExportWarning[] = [];
    pushGeneralWarning(findings, 'Tick the codeplug part before writing.');
    const { result } = renderHook(() =>
      useRadioWriteFlow({
        build,
        egress,
        descriptor: descriptorWithPreflight({
          identity: { model: 'AT-D890UV', serial: 'D890UV2401234567' },
          rows: [],
          findings,
        }),
        activeProjectId: 'p1',
      }),
    );
    act(() =>
      result.current.open({ codeplug: true, contacts: false, settings: false, keps: false }),
    );
    await act(async () => {
      vi.advanceTimersByTime(350);
      await result.current.actions.onConnectAndRead();
    });
    expect(vi.mocked(openRadioSessionForEgress)).toHaveBeenCalled();
    expect(result.current.view.preflight.status).toBe('passed');
  });
});
