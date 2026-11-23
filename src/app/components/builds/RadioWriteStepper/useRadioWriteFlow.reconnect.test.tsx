import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import { RadioInterlockError, RadioProtocolError } from '@integrations/radio-io/kit/errors.ts';
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

  it('does not offer reconnect after a RadioInterlockError from the write', async () => {
    vi.mocked(uploadPreparedRadioWrite).mockRejectedValueOnce(
      new RadioInterlockError('Nothing was written.'),
    );
    const { result } = mount();
    act(() =>
      result.current.open({ codeplug: true, contacts: false, settings: false, keps: false }),
    );
    await act(async () => result.current.actions.onConnectAndRead());
    expect(result.current.view.error).toContain('Nothing was written.');
    expect(result.current.view.canReconnect).toBe(false);
  });

  it('offers reconnect after a RadioProtocolError before transmit', async () => {
    vi.mocked(uploadPreparedRadioWrite).mockRejectedValueOnce(
      new RadioProtocolError('Unexpected RadioFoundry codeplug reply.'),
    );
    const { result } = mount();
    act(() =>
      result.current.open({ codeplug: true, contacts: false, settings: false, keps: false }),
    );
    await act(async () => result.current.actions.onConnectAndRead());
    expect(result.current.view.error).toContain('Unexpected RadioFoundry');
    expect(result.current.view.canReconnect).toBe(true);
  });
});
