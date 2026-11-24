import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { COPY } from './storageClaimCopy.ts';
import { useStorageClaimFlow } from './useStorageClaimFlow.tsx';

const check = vi.fn(async () => ({
  layout: {
    region: 'foreign' as const,
    claimPending: false,
    settings: { address: 0x711000, size: 0x8000 },
    journal: { address: 0x719000, size: 0x2000 },
    calibration: { address: 0, size: 0 },
  },
  boardReported: 'DM-32UV',
  firmwareGit: '454a5b76',
  ranges: [],
}));

const svc = vi.hoisted(() => ({
  state: { sender: { claimSent: false } },
  backup: vi.fn(),
  unlock: vi.fn(),
  poll: vi.fn(),
  recheck: vi.fn(),
}));

vi.mock('../../../../services/dangerZone/radioFoundryStorageClaimService.ts', () => ({
  runStorageClaimCheck: () => check(),
  openStorageClaimState: () => svc.state,
  runStorageClaimBackupDownload: () => svc.backup(),
  acknowledgeStorageBackupSaved: vi.fn(),
  runStorageClaimUnlock: () => svc.unlock(),
  pollStorageClaimForOurs: () => svc.poll(),
  recheckStorageClaim: () => svc.recheck(),
}));

const LAYOUT = {
  region: 'foreign' as const,
  claimPending: false,
  settings: { address: 0x711000, size: 0x8000 },
  journal: { address: 0x719000, size: 0x2000 },
  calibration: { address: 0, size: 0 },
};

function renderFlow() {
  return renderHook(() =>
    useStorageClaimFlow({
      buildId: 'b1',
      egress: { formatId: 'radio-io', profileId: 'radio-io-dm32uv-radiofoundry' },
      navigateInBuild: vi.fn(),
    }),
  );
}

/** Check, back up, tick, confirm: ready for Unlock. */
async function toConfirm(result: ReturnType<typeof renderFlow>['result']) {
  svc.state.sender.claimSent = false;
  svc.backup.mockResolvedValue({
    manifest: { token: 0x12345678, storageInfo: LAYOUT },
    fileName: 'storage_12345678_20261124-140000.zip',
    zipBytes: new Uint8Array([1]),
    tokenHex: '12345678',
  });
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
  globalThis.URL.revokeObjectURL = vi.fn();
  await act(async () => {
    await result.current.actions.onConnectCheck();
  });
  await act(async () => {
    await result.current.actions.onBackup();
  });
  act(() => result.current.actions.onSaveTick(true));
  act(() => result.current.actions.onBackupNext());
  act(() => result.current.actions.onConfirmTick(true));
  expect(result.current.view.step).toBe('confirm');
}

vi.mock('../../../../services/radioIoSession.ts', () => ({
  openRadioSessionForEgress: vi.fn(async () => ({
    session: { pipe: {} },
  })),
  closeRadioSession: vi.fn(),
}));

describe('useStorageClaimFlow', () => {
  it('refused check shows nothing has changed', async () => {
    check.mockRejectedValueOnce(new Error('Board mismatch'));
    const { result } = renderHook(() =>
      useStorageClaimFlow({
        buildId: 'b1',
        egress: { formatId: 'radio-io', profileId: 'radio-io-dm32uv-radiofoundry' },
        navigateInBuild: vi.fn(),
      }),
    );
    await act(async () => {
      await result.current.actions.onConnectCheck();
    });
    await waitFor(() => expect(result.current.view.notice).toContain(COPY.nothingChanged));
  });

  it('foreign check advances to backup', async () => {
    check.mockResolvedValueOnce({
      layout: {
        region: 'foreign',
        claimPending: false,
        settings: { address: 1, size: 4096 },
        journal: { address: 2, size: 0x2000 },
        calibration: { address: 0, size: 0 },
      },
      boardReported: 'DM-32UV',
      firmwareGit: '454a5b76',
      ranges: [],
    });
    const { result } = renderHook(() =>
      useStorageClaimFlow({
        buildId: 'b1',
        egress: { formatId: 'radio-io', profileId: 'radio-io-dm32uv-radiofoundry' },
        navigateInBuild: vi.fn(),
      }),
    );
    await act(async () => {
      await result.current.actions.onConnectCheck();
    });
    expect(result.current.view.step).toBe('backup');
  });

  it('Unlock does nothing before the backup is done and ticked', async () => {
    svc.unlock.mockClear();
    const { result } = renderFlow();
    await act(async () => {
      await result.current.actions.onConnectCheck();
    });
    act(() => result.current.actions.onConfirmTick(true));
    await act(async () => {
      await result.current.actions.onUnlock();
    });
    expect(svc.unlock).not.toHaveBeenCalled();
  });

  it('Done says unlocked when the radio reports ours', async () => {
    const { result } = renderFlow();
    await toConfirm(result);
    svc.unlock.mockImplementationOnce(async () => {
      svc.state.sender.claimSent = true;
    });
    svc.poll.mockResolvedValueOnce({ kind: 'ours' });
    await act(async () => {
      await result.current.actions.onUnlock();
    });
    expect(result.current.view.step).toBe('done');
    expect(result.current.view.notice).toBe(COPY.oursDone);
    expect(result.current.view.layout?.region).toBe('ours');
  });

  it('after a claim went out, an error lands on Done and Unlock is never sent again', async () => {
    svc.unlock.mockClear();
    const { result } = renderFlow();
    await toConfirm(result);
    svc.unlock.mockImplementationOnce(async () => {
      svc.state.sender.claimSent = true;
    });
    svc.poll.mockRejectedValueOnce(new Error('The serial device disconnected.'));
    await act(async () => {
      await result.current.actions.onUnlock();
    });
    expect(result.current.view.step).toBe('done');
    expect(result.current.view.notice).toContain(COPY.notConfirmed);
    await act(async () => {
      await result.current.actions.onUnlock();
    });
    expect(svc.unlock).toHaveBeenCalledTimes(1);
  });

  it('Check again reads storage only and never unlocks', async () => {
    svc.unlock.mockClear();
    const { result } = renderFlow();
    await toConfirm(result);
    svc.unlock.mockImplementationOnce(async () => {
      svc.state.sender.claimSent = true;
    });
    svc.poll.mockResolvedValueOnce({ kind: 'timeout', last: LAYOUT });
    await act(async () => {
      await result.current.actions.onUnlock();
    });
    expect(result.current.view.notice).toBe(COPY.notConfirmed);
    svc.recheck.mockResolvedValueOnce({ ...LAYOUT, region: 'ours' });
    await act(async () => {
      await result.current.actions.onCheckAgain();
    });
    expect(svc.recheck).toHaveBeenCalledTimes(1);
    expect(svc.unlock).toHaveBeenCalledTimes(1);
    expect(result.current.view.notice).toBe(COPY.oursDone);
  });
});
