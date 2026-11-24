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

vi.mock('../../../../services/dangerZone/radioFoundryStorageClaimService.ts', () => ({
  runStorageClaimCheck: () => check(),
  openStorageClaimState: vi.fn(),
  runStorageClaimBackupDownload: vi.fn(),
  acknowledgeStorageBackupSaved: vi.fn(),
  runStorageClaimUnlock: vi.fn(),
  pollStorageClaimForOurs: vi.fn(),
  recheckStorageClaim: vi.fn(),
}));

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
});
