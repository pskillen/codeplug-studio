/**
 * The Write flow's progress coalescing (#1558): events fold into the stage refs at once but reach
 * React state at about 10 Hz. Driven through the keps-only path, where a fake keps writer emits the
 * events: connect, then (nothing needs Review) the writer's burst of progress.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { ProgressUpdate, RadioSession } from '@integrations/radio-io/types.ts';
import type { SatelliteKepsWriteFn } from '../../../services/satelliteKepsWriteAdapters.ts';
import { useRadioWriteFlow, type RadioWriteFlow } from './useRadioWriteFlow.tsx';

vi.mock('../../../state/persistence.ts', () => ({
  persistence: { listSatellites: vi.fn(async () => [{ id: 's1', enabled: true }]) },
}));

vi.mock('../../../services/radioIoSession.ts', () => {
  class RadioWriteCancelledError extends Error {}
  return {
    RadioWriteCancelledError,
    grantRadioSerialPortForEgress: vi.fn(async () => ({})),
    openRadioSessionForEgress: vi.fn(async () => ({
      session: { descriptor: { label: 'Fake radio' }, pipe: {}, radio: {} },
    })),
    closeRadioSession: vi.fn(async () => undefined),
    prepareRadioWriteImage: vi.fn(),
    uploadPreparedRadioWrite: vi.fn(),
    verifyRadioWrite: vi.fn(),
  };
});

const BUILD = { id: 'b1', satelliteOverrides: undefined } as unknown as RadioBuild;
const EGRESS = { id: 'e1', profileId: 'fake-profile' } as unknown as EgressPath;

function ev(cur: number, stage = 'Write keps', max = 1000): ProgressUpdate {
  return { cur, max, stage } as ProgressUpdate;
}

/** The writer: emits `events` in a burst, then waits on `gate`, then settles as `outcome`. */
function fakeKepsWriter(
  events: readonly ProgressUpdate[],
  gate: Promise<void>,
  outcome: 'ok' | 'fail',
): SatelliteKepsWriteFn {
  return async (_session: RadioSession, _sats, opts) => {
    for (const e of events) opts?.onProgress?.(e);
    await gate;
    if (outcome === 'fail') throw new Error('radio went away');
    return { written: 1 } as never;
  };
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

function mount(kepsWriteFn: SatelliteKepsWriteFn) {
  return renderHook(() =>
    useRadioWriteFlow({
      build: BUILD,
      egress: EGRESS,
      descriptor: undefined,
      activeProjectId: 'p1',
      supportsDualBankWrite: false,
      kepsWriteFn,
      kepsSameSessionAfterUpload: true,
    }),
  );
}

/** Open the dialog for keps only and press Read & write: nothing needs Review, the writer starts. */
async function startWrite(flow: { current: RadioWriteFlow }): Promise<void> {
  act(() => flow.current.open({ codeplug: false, contacts: false, settings: false, keps: true }));
  await act(async () => {
    flow.current.actions.onConnectAndRead();
  });
  expect(flow.current.view.step).toBe('writing');
}

describe('useRadioWriteFlow progress coalescing (#1558)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the first event at once and the latest after the interval, not every frame', async () => {
    const gate = deferred();
    const burst = Array.from({ length: 200 }, (_, i) => ev(i + 1));
    const { result } = mount(fakeKepsWriter(burst, gate.promise, 'ok'));
    await startWrite(result);
    // The leading event went through; the other 199 are waiting on the trailing timer.
    expect(result.current.view.progress?.cur).toBe(1);
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.view.progress?.cur).toBe(200);
  });

  it('on an error, shows the last event and the error at once', async () => {
    const gate = deferred();
    const burst = Array.from({ length: 50 }, (_, i) => ev(i + 1));
    const { result } = mount(fakeKepsWriter(burst, gate.promise, 'fail'));
    await startWrite(result);
    expect(result.current.view.progress?.cur).toBe(1);
    await act(async () => {
      gate.resolve();
    });
    // No timer has fired: the flush came with the error.
    expect(result.current.view.error).toBe('radio went away');
    expect(result.current.view.progress?.cur).toBe(50);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('on completion, flushes the last event', async () => {
    const gate = deferred();
    const burst = Array.from({ length: 50 }, (_, i) => ev(i + 1));
    const { result } = mount(fakeKepsWriter(burst, gate.promise, 'ok'));
    await startWrite(result);
    await act(async () => {
      gate.resolve();
    });
    expect(result.current.view.step).toBe('done');
    expect(result.current.view.progress?.cur).toBe(50);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('drops the pending event when the dialog is reset: nothing lands afterwards', async () => {
    const gate = deferred();
    const burst = Array.from({ length: 50 }, (_, i) => ev(i + 1));
    const { result } = mount(fakeKepsWriter(burst, gate.promise, 'ok'));
    await startWrite(result);
    expect(result.current.view.progress?.cur).toBe(1);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    act(() =>
      result.current.open({ codeplug: false, contacts: false, settings: false, keps: true }),
    );
    expect(result.current.view.progress).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.view.progress).toBeNull();
  });

  it('cancels the timer on unmount: no state update is scheduled afterwards', async () => {
    const gate = deferred();
    const burst = Array.from({ length: 50 }, (_, i) => ev(i + 1));
    const { result, unmount } = mount(fakeKepsWriter(burst, gate.promise, 'ok'));
    await startWrite(result);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
