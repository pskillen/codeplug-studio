import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import {
  RadioInterlockError,
  RadioProtocolError,
  RadioTimeoutError,
  adviseRadioError,
} from '@integrations/radio-io/kit/errors.ts';
import {
  grantRadioSerialPortForEgress,
  openRadioSessionForEgress,
  prepareRadioWriteImage,
  uploadPreparedRadioWrite,
} from '../../../services/radioIoSession.ts';
import { useRadioWriteFlow } from './useRadioWriteFlow.tsx';

vi.mock('../../../state/persistence.ts', () => ({
  persistence: { listSatellites: vi.fn(async () => []) },
}));

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

vi.mock('../../../services/radioIoSession.ts', () => ({
  RadioWriteCancelledError: class extends Error {},
  RadioWriteBlockedError: class extends Error {},
  grantRadioSerialPortForEgress: vi.fn(),
  openRadioSessionForEgress: vi.fn(),
  closeRadioSession: vi.fn(async () => undefined),
  prepareRadioWriteImage: vi.fn(),
  uploadPreparedRadioWrite: vi.fn(),
  verifyRadioWrite: vi.fn(),
}));

function mount() {
  return renderHook(() =>
    useRadioWriteFlow({
      build: { id: 'b1' } as RadioBuild,
      egress: { id: 'e1', profileId: 'opengd77-1701' } as EgressPath,
      descriptor: undefined,
      activeProjectId: 'p1',
      supportsDualBankWrite: false,
      kepsWriteFn: undefined,
      kepsSameSessionAfterUpload: true,
    }),
  );
}

const PREPARED = {
  image: new Uint8Array(0),
  channels: [],
  organisation: {},
  warnings: [],
};

describe('useRadioWriteFlow reconnect after write errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(grantRadioSerialPortForEgress).mockResolvedValue({
      transport: 'web',
      port: {} as never,
    });
    vi.mocked(openRadioSessionForEgress).mockResolvedValue({
      session: { descriptor: { label: 'Test' }, pipe: {}, radio: {} },
    } as never);
    vi.mocked(prepareRadioWriteImage).mockResolvedValue(PREPARED as never);
  });

  it('offers no retry after a RadioInterlockError from the write', async () => {
    vi.mocked(uploadPreparedRadioWrite).mockRejectedValueOnce(
      adviseRadioError(new RadioInterlockError('Nothing was written.'), {
        retry: 'none',
        sent: 'nothing-sent',
      }),
    );
    const { result } = mount();
    act(() =>
      result.current.open({ codeplug: true, contacts: false, settings: false, keps: false }),
    );
    await act(async () => result.current.actions.onConnectAndRead());
    expect(result.current.view.errorOutcome?.message).toContain('Nothing was written.');
    expect(result.current.view.retryLabel).toBeNull();
  });

  it('offers Reconnect and try again after a RadioProtocolError before transmit', async () => {
    vi.mocked(uploadPreparedRadioWrite).mockRejectedValueOnce(
      new RadioProtocolError('Unexpected RadioFoundry codeplug reply.'),
    );
    const { result } = mount();
    act(() =>
      result.current.open({ codeplug: true, contacts: false, settings: false, keps: false }),
    );
    await act(async () => result.current.actions.onConnectAndRead());
    expect(result.current.view.errorOutcome?.message).toContain('Unexpected RadioFoundry');
    expect(result.current.view.retryLabel).toBe('Reconnect and try again');
  });

  it('offers Write again after a timeout once transmit started', async () => {
    vi.mocked(uploadPreparedRadioWrite).mockImplementationOnce(async (_s, _e, _i, opts) => {
      opts?.onProgress?.({ cur: 1, max: 2, stage: 'Upload' });
      await Promise.resolve();
      throw adviseRadioError(new RadioTimeoutError(), {
        retry: 'rewrite',
        sent: 'may-hold-part',
      });
    });
    const { result } = mount();
    act(() =>
      result.current.open({ codeplug: true, contacts: false, settings: false, keps: false }),
    );
    await act(async () => result.current.actions.onConnectAndRead());
    expect(result.current.view.errorOutcome?.sent).toBe('may-hold-part');
    expect(result.current.view.retryLabel).toBe('Write again');
  });

  it('a user Cancel during the read returns to step 1 with Read cancelled and no error', async () => {
    let rejectOpen: (err: Error) => void = () => undefined;
    vi.mocked(openRadioSessionForEgress).mockImplementationOnce(
      () =>
        new Promise((_res, reject) => {
          rejectOpen = reject;
        }),
    );
    const { result } = mount();
    act(() =>
      result.current.open({ codeplug: true, contacts: false, settings: false, keps: false }),
    );
    await act(async () => {
      void result.current.actions.onConnectAndRead();
      await new Promise((r) => setTimeout(r, 0));
      result.current.actions.onAbort();
      rejectOpen(new Error('aborted'));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.view.step).toBe('whatToWrite');
    expect(result.current.view.notice).toContain('Read cancelled');
    expect(result.current.view.errorOutcome).toBeNull();
  });

  it('a dismissed port picker returns to step 1 with the no-port line', async () => {
    const err = new Error('cancelled');
    err.name = 'NotFoundError';
    vi.mocked(grantRadioSerialPortForEgress).mockRejectedValueOnce(err);
    const { result } = mount();
    act(() =>
      result.current.open({ codeplug: true, contacts: false, settings: false, keps: false }),
    );
    await act(async () => result.current.actions.onConnectAndRead());
    expect(result.current.view.step).toBe('whatToWrite');
    expect(result.current.view.notice).toContain('No port chosen');
    expect(result.current.view.errorOutcome).toBeNull();
  });

  it('every error is logged to the console with [radio-write]', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(uploadPreparedRadioWrite).mockRejectedValueOnce(new Error('fail'));
    const { result } = mount();
    act(() =>
      result.current.open({ codeplug: true, contacts: false, settings: false, keps: false }),
    );
    await act(async () => result.current.actions.onConnectAndRead());
    expect(spy).toHaveBeenCalledWith('[radio-write]', expect.any(String), expect.any(String));
    spy.mockRestore();
  });
});