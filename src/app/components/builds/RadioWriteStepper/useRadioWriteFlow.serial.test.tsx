import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import {
  grantRadioSerialPortForEgress,
  openRadioSessionForEgress,
} from '../../../services/radioIoSession.ts';
import { useRadioWriteFlow } from './useRadioWriteFlow.tsx';

vi.mock('../../../state/persistence.ts', () => ({
  persistence: { listSatellites: vi.fn(async () => [{ id: 's1', enabled: true }]) },
}));
vi.mock('../../../services/radioIoSession.ts', () => ({
  RadioWriteCancelledError: class extends Error {},
  grantRadioSerialPortForEgress: vi.fn(),
  openRadioSessionForEgress: vi.fn(async () => ({
    session: { descriptor: { label: 'OpenGD77' }, pipe: {}, radio: {} },
  })),
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
      kepsWriteFn: vi.fn(),
      kepsSameSessionAfterUpload: true,
    }),
  );
}

describe('serial picker lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(grantRadioSerialPortForEgress).mockReset();
  });

  it('starts one port picker when Write is triggered twice before it settles', async () => {
    let choosePort!: (port: Awaited<ReturnType<typeof grantRadioSerialPortForEgress>>) => void;
    vi.mocked(grantRadioSerialPortForEgress)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            choosePort = resolve;
          }),
      )
      .mockRejectedValueOnce(new DOMException('No port selected by the user.', 'NotFoundError'));
    const { result } = mount();
    act(() =>
      result.current.open({ codeplug: false, contacts: false, settings: false, keps: true }),
    );
    await act(async () => {
      result.current.actions.onConnectAndRead();
      result.current.actions.onConnectAndRead();
    });
    expect(grantRadioSerialPortForEgress).toHaveBeenCalledTimes(1);
    await act(async () => choosePort({ transport: 'web', port: {} as never }));
    expect(result.current.view.step).toBe('review');
    expect(result.current.view.error).toBeNull();
    expect(result.current.view.canReconnect).toBe(false);
    await act(async () => result.current.actions.onWrite());
    expect(result.current.view.step).toBe('done');
    expect(result.current.view.error).toBeNull();
  });

  it('returns to options without a read error when the user cancels the port picker', async () => {
    vi.mocked(grantRadioSerialPortForEgress).mockRejectedValueOnce(
      new DOMException('No port selected by the user.', 'NotFoundError'),
    );
    const { result } = mount();
    act(() =>
      result.current.open({ codeplug: false, contacts: false, settings: false, keps: true }),
    );
    await act(async () => result.current.actions.onConnectAndRead());
    expect(result.current.view.step).toBe('whatToWrite');
    expect(result.current.view.error).toBeNull();
    expect(result.current.view.canReconnect).toBe(false);
    expect(openRadioSessionForEgress).not.toHaveBeenCalled();
  });
  it('keeps genuine session failures visible and clears them on a successful retry', async () => {
    vi.mocked(grantRadioSerialPortForEgress).mockResolvedValue({
      transport: 'web',
      port: {} as never,
    });
    vi.mocked(openRadioSessionForEgress).mockRejectedValueOnce(
      new DOMException('The serial device disconnected.', 'NotFoundError'),
    );
    const { result } = mount();
    act(() =>
      result.current.open({ codeplug: false, contacts: false, settings: false, keps: true }),
    );
    await act(async () => result.current.actions.onConnectAndRead());
    expect(result.current.view.error).toContain('The serial device disconnected.');
    expect(result.current.view.canReconnect).toBe(true);
    await act(async () => result.current.actions.onReconnect());
    expect(result.current.view.step).toBe('review');
    expect(result.current.view.error).toBeNull();
    expect(result.current.view.canReconnect).toBe(false);
  });
});
