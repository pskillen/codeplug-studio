import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import { hasProblemWarnings, pushKepsExcludedWarning } from '@core/import-export/exportWarning.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import type { SatelliteKepsWriteFn } from '../../../services/satelliteKepsWriteAdapters.ts';
import {
  openRadioSessionForEgress,
  prepareRadioWriteImage,
  uploadPreparedRadioWrite,
} from '../../../services/radioIoSession.ts';
import { DoneBody } from './steps/DoneStep.tsx';
import { reviewPauseReasons } from './reviewSections.tsx';
import type { WriteFlowActions } from './types.ts';
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
const descriptor = { label: 'OpenGD77', modelIds: ['1701'] } as never;

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

function mount(
  opts: { kepsWriteFn?: SatelliteKepsWriteFn; kepsSameSessionAfterUpload?: boolean } = {},
) {
  return renderHook(() =>
    useRadioWriteFlow({
      build,
      egress,
      descriptor,
      activeProjectId: 'p1',
      supportsDualBankWrite: false,
      kepsWriteFn: opts.kepsWriteFn,
      kepsSameSessionAfterUpload: opts.kepsSameSessionAfterUpload ?? false,
    }),
  );
}

const noopActions = {} as WriteFlowActions;

function cleanShorten(i: number): ExportWarning {
  return {
    kind: 'wire_name',
    severity: 'info',
    remediation: 'shortened',
    entityKind: 'Channel',
    original: `Name ${i}`,
    exported: `N${i}`,
    limit: 16,
  };
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

  it('a build problem stops on Review and Cancel sends nothing', async () => {
    const radioUpload = vi.fn(async () => undefined);
    vi.mocked(openRadioSessionForEgress).mockResolvedValueOnce({
      session: {
        descriptor: { label: 'OpenGD77', modelIds: ['1701'] },
        pipe: { writes: [] },
        radio: {
          upload: radioUpload,
          getDownloadCache: () => ({ blocks: new Map() }),
        },
      },
      descriptor: { label: 'OpenGD77', modelIds: ['1701'] },
    } as never);
    vi.mocked(prepareRadioWriteImage).mockResolvedValueOnce({
      image: undefined,
      warnings: [
        {
          kind: 'general',
          severity: 'problem',
          message: 'Channel CH1 is outside receive range',
        },
      ],
      organisation: {},
      channels: [{ wireName: 'CH1', empty: false } as never],
    });
    let uploadedAfterPause = false;
    vi.mocked(uploadPreparedRadioWrite).mockImplementation(async (_s, _e, _i, opts) => {
      await opts?.beforeTransmit?.({
        identity: { model: 'OpenGD77' },
        channelCount: 1,
        identityOnly: false,
      });
      uploadedAfterPause = true;
      return {};
    });
    const { result } = mount();
    act(() => result.current.open());
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });
    await act(async () => {
      result.current.actions.onConnectAndRead();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.view.step).toBe('review');
    expect(
      reviewPauseReasons(descriptor, {
        identity: result.current.view.identity ?? { model: 'OpenGD77' },
        parts: result.current.view.parts,
        channelCount: 1,
        contactsNote: null,
        kepsCount: null,
        estimateSeconds: null,
        identityOnly: false,
        restartsAfterWrite: false,
        buildWarnings: result.current.view.buildChecks.warnings,
      }),
    ).toContain('build-problems');
    await act(async () => {
      result.current.actions.onCancelReview();
      await Promise.resolve();
    });
    expect(result.current.view.open).toBe(false);
    expect(uploadedAfterPause).toBe(false);
    expect(radioUpload).not.toHaveBeenCalled();
  });

  it('Done recaps warnings and keps skips folded', async () => {
    const buildWarnings: ExportWarning[] = [
      {
        kind: 'general',
        severity: 'problem',
        message: 'Channel CH1 is outside receive range',
      },
      cleanShorten(1),
      cleanShorten(2),
    ];
    pushKepsExcludedWarning(buildWarnings, {
      satelliteId: 'AO-91',
      transmitterId: null,
      reason: 'wrong mode',
      label: 'AO-91',
    });
    vi.mocked(prepareRadioWriteImage).mockResolvedValue({
      image: undefined,
      warnings: buildWarnings,
      organisation: {},
      channels: [{ wireName: 'CH1', empty: false } as never],
    });
    vi.mocked(uploadPreparedRadioWrite).mockImplementation(async (_s, _e, _i, opts) => {
      await opts?.beforeTransmit?.({
        identity: { model: 'OpenGD77' },
        channelCount: 1,
        identityOnly: false,
      });
      return { channels: [{ wireName: 'CH1', empty: false } as never] };
    });
    const { result } = mount();
    act(() =>
      result.current.open({ codeplug: true, contacts: false, settings: false, keps: false }),
    );
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });
    await act(async () => {
      result.current.actions.onConnectAndRead();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.view.step).toBe('review');
    await act(async () => result.current.actions.onWrite());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.view.step).toBe('done');
    expect(result.current.view.summary?.warnings).toEqual(buildWarnings);
    render(
      <MantineProvider>
        <DoneBody
          config={
            {
              radioLabel: 'OpenGD77',
              buildId: 'b1',
              serialOk: true,
              writeHidden: false,
              support: { codeplug: true, contacts: true, settings: false, keps: true },
              sharedContactBankNote: false,
              sharedAddressBookNote: false,
              separateLookupDatabaseNote: false,
              restartWaitSeconds: 0,
            } as never
          }
          view={result.current.view}
          actions={noopActions}
        />
      </MantineProvider>,
    );
    expect(screen.getByText('1 problems · 3 notes')).toBeTruthy();
    fireEvent.click(screen.getByText('Details'));
    expect(screen.getByText('Channel CH1 is outside receive range')).toBeTruthy();
    expect(screen.getByText('3 notes')).toBeTruthy();
    fireEvent.click(screen.getByText('3 notes'));
    expect(screen.getByText('Channel names shortened (2)')).toBeTruthy();
    expect(screen.getByText('Skipped AO-91: wrong mode')).toBeTruthy();
  });
});
