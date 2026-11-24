/**
 * Step 5 keeps the write plan's weights (bar, percent, time left) on a reconnect pass: a Review held
 * past the radio's hold time re-reads and auto-proceeds, and must still set the plan.
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import { DM1701_RADIOFOUNDRY_DESCRIPTOR } from '@integrations/radio-io/radios/radiofoundry/descriptor.ts';
import type { PlannedStage, RadioDescriptor } from '@integrations/radio-io/types.ts';
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

// The real DM-1701 RF descriptor; only the pre-flight is stubbed (it talks to the radio).
const DESC: RadioDescriptor = {
  ...DM1701_RADIOFOUNDRY_DESCRIPTOR,
  writePreflight: async () => ({ identity: { model: 'Baofeng DM-1701' }, rows: [] }),
};

const FULL_PLAN: PlannedStage[] = [
  { label: 'Block checksums', weight: 1_603_600 },
  { label: 'Pre-write read', weight: 458_752 },
  { label: 'Codeplug blocks', weight: 2107 * 4096 },
  { label: 'Commit', weight: 32 },
];

function mount() {
  return renderHook(() =>
    useRadioWriteFlow({
      build: { id: 'b1' } as RadioBuild,
      egress: { id: 'e1', profileId: 'radio-io-dm1701-radiofoundry' } as EgressPath,
      descriptor: DESC,
      activeProjectId: 'p1',
    }),
  );
}

const PREPARED = {
  image: new Uint8Array(0),
  channels: [],
  organisation: {},
  warnings: [],
  radioFoundryWrite: { bytes: new Uint8Array(0), owned: new Uint8Array(0), warnings: [] },
};

function scenario(plan: PlannedStage[] | undefined) {
  vi.mocked(uploadPreparedRadioWrite).mockImplementationOnce(async (_s, _e, _i, opts) => {
    for (let i = 1; i <= 175; i += 1)
      opts?.onProgress?.({ cur: i, max: 175, stage: 'Block checksums', msg: '' });
    for (let i = 1; i <= 112; i += 1)
      opts?.onProgress?.({ cur: i, max: 112, stage: 'Pre-write read', msg: '' });
    await opts!.beforeTransmit!({
      identity: { model: 'Baofeng DM-1701' },
      channelCount: 0,
      identityOnly: false,
      ...(plan ? { plan } : {}),
    } as never);
    for (let i = 1; i <= 797; i += 1)
      opts?.onProgress?.({ cur: i, max: 2107, stage: 'Codeplug blocks', msg: '' });
    await new Promise(() => undefined); // hold in Writing
    return {};
  });
}

async function startAndSettle(result: ReturnType<typeof mount>['result']) {
  act(() => result.current.open({ codeplug: true, contacts: true, settings: false, keps: false }));
  await act(async () => {
    void result.current.actions.onConnectAndRead();
    await new Promise((r) => setTimeout(r, 300));
  });
}

describe('useRadioWriteFlow — write plan on step 5 (RadioFoundry)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(grantRadioSerialPortForEgress).mockResolvedValue({
      transport: 'web',
      port: {} as never,
    });
    vi.mocked(openRadioSessionForEgress).mockResolvedValue({
      session: { descriptor: DESC, pipe: {}, radio: {} },
    } as never);
    vi.mocked(prepareRadioWriteImage).mockResolvedValue(PREPARED as never);
  });

  it('a skipped Review keeps weighted Codeplug blocks and Commit rows', async () => {
    scenario(FULL_PLAN);
    const { result } = mount();
    await startAndSettle(result);
    const v = result.current.view;
    expect(v.step).toBe('writing');
    expect(v.writeRows.map((r) => r.label)).toEqual(['Codeplug blocks', 'Commit']);
    expect(v.writeRows.every((r) => r.weight != null)).toBe(true);
  });

  it('a long Review on RadioFoundry does not reconnect; writing keeps the weighted plan', async () => {
    vi.mocked(uploadPreparedRadioWrite).mockImplementationOnce(async (_s, _e, _i, opts) => {
      for (let i = 1; i <= 112; i += 1)
        opts?.onProgress?.({ cur: i, max: 112, stage: 'Pre-write read', msg: '' });
      await opts!.beforeTransmit!({
        identity: { model: 'Baofeng DM-1701' },
        channelCount: 0,
        identityOnly: false,
        plan: FULL_PLAN,
        radioWarnings: [{ kind: 'general', severity: 'problem', message: 'x' }],
      } as never);
      for (let i = 1; i <= 797; i += 1)
        opts?.onProgress?.({ cur: i, max: 2107, stage: 'Codeplug blocks', msg: '' });
      await new Promise(() => undefined);
      return {};
    });
    const { result } = mount();
    await startAndSettle(result);
    expect(result.current.view.step).toBe('review');
    const realNow = Date.now;
    const t0 = realNow();
    Date.now = () => t0 + 31_000;
    try {
      await act(async () => {
        result.current.actions.onWrite();
        await new Promise((r) => setTimeout(r, 300));
      });
    } finally {
      Date.now = realNow;
    }
    const v = result.current.view;
    expect(vi.mocked(uploadPreparedRadioWrite).mock.calls.length).toBe(1);
    expect(v.step).toBe('writing');
    expect(v.writeRows.map((r) => r.label)).toEqual(['Codeplug blocks', 'Commit']);
    expect(v.writeRows.every((r) => r.weight != null)).toBe(true);
  });

  it('a reconnect pass after a long Review keeps the weighted plan when hold time is finite', async () => {
    const finiteHoldDesc: RadioDescriptor = { ...DESC, programHoldSafeMs: 30_000 };
    vi.mocked(openRadioSessionForEgress).mockResolvedValue({
      session: { descriptor: finiteHoldDesc, pipe: {}, radio: {} },
    } as never);
    vi.mocked(uploadPreparedRadioWrite).mockImplementationOnce(async (_s, _e, _i, opts) => {
      for (let i = 1; i <= 112; i += 1)
        opts?.onProgress?.({ cur: i, max: 112, stage: 'Pre-write read', msg: '' });
      await opts!.beforeTransmit!({
        identity: { model: 'Baofeng DM-1701' },
        channelCount: 0,
        identityOnly: false,
        plan: FULL_PLAN,
        radioWarnings: [{ kind: 'general', severity: 'problem', message: 'x' }],
      } as never);
      throw new Error('should not transmit on the first pass');
    });
    scenario(FULL_PLAN);
    const { result } = renderHook(() =>
      useRadioWriteFlow({
        build: { id: 'b1' } as RadioBuild,
        egress: { id: 'e1', profileId: 'radio-io-dm1701-radiofoundry' } as EgressPath,
        descriptor: finiteHoldDesc,
        activeProjectId: 'p1',
      }),
    );
    await startAndSettle(result);
    expect(result.current.view.step).toBe('review');
    const realNow = Date.now;
    const t0 = realNow();
    Date.now = () => t0 + 31_000;
    try {
      await act(async () => {
        result.current.actions.onWrite();
        await new Promise((r) => setTimeout(r, 300));
      });
    } finally {
      Date.now = realNow;
    }
    const v = result.current.view;
    expect(vi.mocked(uploadPreparedRadioWrite).mock.calls.length).toBe(2);
    expect(v.step).toBe('writing');
    expect(v.writeRows.map((r) => r.label)).toEqual(['Codeplug blocks', 'Commit']);
    expect(v.writeRows.every((r) => r.weight != null)).toBe(true);
  });
});
