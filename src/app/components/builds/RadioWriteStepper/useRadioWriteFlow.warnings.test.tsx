import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import { hasProblemWarnings } from '@core/import-export/exportWarning.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import {
  prepareRadioWriteImage,
  uploadPreparedRadioWrite,
} from '../../../services/radioIoSession.ts';
import { useRadioWriteFlow } from './useRadioWriteFlow.tsx';

const emptyLibrary: LibrarySlice = {
  channels: [],
  zones: [],
  scanLists: [],
  talkGroups: [],
  digitalContacts: [],
  analogContacts: [],
  rxGroupLists: [],
  aprsConfiguration: null,
};

vi.mock('../../../lib/loadLibrarySlice.ts', () => ({
  loadLibrarySlice: vi.fn(async () => emptyLibrary),
}));

vi.mock('../../../state/persistence.ts', () => ({
  persistence: {
    listSatellites: vi.fn(async () => []),
    countDigitalIdDirectoryEntries: vi.fn(async () => 0),
  },
}));

const build = { id: 'b1', revision: 1 } as RadioBuild;
const egress = {
  id: 'e1',
  profileId: 'radio-io-opengd77-1701',
  formatId: 'opengd77',
} as EgressPath;

vi.mock('../../../services/radioIoSession.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/radioIoSession.ts')>();
  return {
    ...actual,
    grantRadioSerialPortForEgress: vi.fn(async () => ({
      transport: 'web' as const,
      port: {} as SerialPort,
    })),
    openRadioSessionForEgress: vi.fn(async () => ({
      descriptor: { label: 'OpenGD77', modelIds: ['1701'] },
      pipe: { writes: [] },
      radio: {
        upload: vi.fn(async () => undefined),
        getDownloadCache: () => ({ blocks: new Map() }),
      },
    })),
    closeRadioSession: vi.fn(async () => undefined),
    prepareRadioWriteImage: vi.fn(async () => ({
      image: undefined,
      warnings: [] as ExportWarning[],
      organisation: {},
      channels: [],
    })),
    uploadPreparedRadioWrite: vi.fn(async () => ({})),
    verifyRadioWrite: vi.fn(),
  };
});

function mount() {
  return renderHook(() =>
    useRadioWriteFlow({
      build,
      egress,
      descriptor: { label: 'OpenGD77', modelIds: ['1701'] } as never,
      activeProjectId: 'p1',
      supportsDualBankWrite: false,
      kepsWriteFn: undefined,
      kepsSameSessionAfterUpload: false,
    }),
  );
}

describe('useRadioWriteFlow build checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('prepares when the dialog opens and the write reuses it', async () => {
    const { result } = mount();
    act(() => result.current.open());
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });
    const callsAfterOpen = vi.mocked(prepareRadioWriteImage).mock.calls.length;
    expect(callsAfterOpen).toBeGreaterThanOrEqual(1);
    await act(async () => result.current.actions.onConnectAndRead());
    await act(async () => {
      await Promise.resolve();
    });
    expect(prepareRadioWriteImage).toHaveBeenCalledTimes(callsAfterOpen);
  });

  it('changing the ticks aborts the previous prepare and runs a new one', async () => {
    const { result } = mount();
    act(() => result.current.open());
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });
    expect(prepareRadioWriteImage).toHaveBeenCalledTimes(1);
    act(() =>
      result.current.actions.onPartsChange({ ...result.current.view.parts, contacts: true }),
    );
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });
    expect(prepareRadioWriteImage).toHaveBeenCalledTimes(2);
  });

  it('a notes-only build goes from Read to Writing with no Review', async () => {
    vi.mocked(prepareRadioWriteImage).mockResolvedValueOnce({
      image: undefined,
      warnings: [
        {
          kind: 'wire_name',
          severity: 'info',
          remediation: 'shortened',
          entityKind: 'Channel',
          original: 'A',
          exported: 'B',
          limit: 16,
        },
      ],
      organisation: {},
      channels: [{ wireName: 'B', empty: false } as never],
    });
    vi.mocked(uploadPreparedRadioWrite).mockImplementation(async (_s, _e, _i, opts) => {
      await opts?.beforeTransmit?.({
        identity: { model: 'OpenGD77' },
        channelCount: 1,
        identityOnly: false,
      });
      return {};
    });
    const { result } = mount();
    act(() => result.current.open());
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });
    expect(hasProblemWarnings(result.current.view.buildChecks.warnings)).toBe(false);
    await act(async () => result.current.actions.onConnectAndRead());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.view.step).not.toBe('review');
  });
});
