import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { RadioDescriptor } from '@integrations/radio-io/types.ts';
import { createMemoryMap } from '@integrations/radio-io/kit/memoryMap.ts';
import { DM32UV_DESCRIPTOR } from '@integrations/radio-io/radios/dm32uv/descriptor.ts';
import { DM32_POWER_CYCLE_AFTER_SESSION_NOTE } from '@integrations/radio-io/radios/dm32uv/writeRole.ts';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import {
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
  type RadioBackupManifestV1,
} from '@integrations/radio-io/backup/index.ts';
import {
  assertRestoreIdentity,
  atD890RangeMismatch,
  RadioRestoreError,
  restoreRadioBackup,
} from '../../../services/radioBackupRestore.ts';
import { useRadioRestoreFlow } from './useRadioRestoreFlow.ts';

const egress = { id: 'e1', profileId: 'radio-io-dm32uv', formatId: 'radio-io' } as EgressPath;

function manifest(overrides?: Partial<RadioBackupManifestV1>): RadioBackupManifestV1 {
  return {
    format: RADIO_BACKUP_FORMAT,
    version: RADIO_BACKUP_VERSION,
    capturedAt: '2026-08-13T12:00:00.000Z',
    capturedVia: 'web-serial',
    app: { buildEnv: 'test', buildVersion: '0' },
    radioModelId: 'DM-32UV',
    descriptorLabel: 'TIDRADIO DM-32UV',
    coverage: 'full-clone',
    imageByteLength: 16,
    regions: [
      {
        id: 'channels',
        label: 'Channels',
        address: 0,
        byteLength: 8,
        path: 'regions/channels.bin',
        restoreRole: 'restorable',
      },
      {
        id: 'settings',
        label: 'Settings',
        address: 8,
        byteLength: 8,
        path: 'regions/settings.bin',
        restoreRole: 'restorable',
      },
    ],
    serial: 'SN-FULL-ARCHIVE-001',
    ...overrides,
  };
}

const backupSession = (m: RadioBackupManifestV1) => ({
  manifest: m,
  image: createMemoryMap(16),
  zipBytes: new Uint8Array(4),
  source: 'file' as const,
});

vi.mock('../../../services/radioIoSession.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/radioIoSession.ts')>();
  return {
    ...actual,
    openRadioSessionForEgress: vi.fn(),
    closeRadioSession: vi.fn(async () => undefined),
  };
});

vi.mock('../../../services/radioBackupRestore.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/radioBackupRestore.ts')>();
  return {
    ...actual,
    assertRestoreIdentity: vi.fn(),
    restoreRadioBackup: vi.fn(async () => undefined),
    atD890RangeMismatch: vi.fn(() => false),
  };
});

vi.mock('../../../services/egress/writeShellOptions.ts', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../services/egress/writeShellOptions.ts')>();
  return {
    ...actual,
    resolveWriteShellOptions: vi.fn(() => ({
      radioLabel: 'TIDRADIO DM-32UV',
      parts: { contacts: false, keps: false, settings: false },
      contactStore: 'generic',
      readPlan: true,
      programHoldSafeMs: 30_000,
      restartAfterEndSeconds: 0,
      check: { available: false },
      successNote: DM32_POWER_CYCLE_AFTER_SESSION_NOTE,
    })),
  };
});

import { openRadioSessionForEgress } from '../../../services/radioIoSession.ts';

describe('useRadioRestoreFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(assertRestoreIdentity).mockResolvedValue({
      label: 'TIDRADIO DM-32UV',
      serial: 'SN-FULL-ARCHIVE-001',
    });
    vi.mocked(openRadioSessionForEgress).mockResolvedValue({
      descriptor: DM32UV_DESCRIPTOR,
      session: {
        descriptor: DM32UV_DESCRIPTOR,
        pipe: {},
        radio: {
          disconnect: vi.fn(),
          getIdentBandCode: () => 0,
        },
      },
    } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a serial mismatch refuses at pre-flight with no retry', async () => {
    vi.mocked(assertRestoreIdentity).mockRejectedValue(
      new RadioRestoreError('serial-mismatch', 'Restore refused — serial mismatch'),
    );
    const { result } = renderHook(() =>
      useRadioRestoreFlow({ egress, descriptor: DM32UV_DESCRIPTOR, profileId: egress.profileId }),
    );
    act(() => result.current.open(backupSession(manifest()), ['channels']));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.view.step).toBe('connect');
    expect(result.current.view.errorOutcome?.retry).toBe('none');
    expect(result.current.view.retryLabel).toBeNull();
    expect(restoreRadioBackup).not.toHaveBeenCalled();
  });

  it('Review is always shown and names the radio and the backup serial in full', async () => {
    const { result } = renderHook(() =>
      useRadioRestoreFlow({ egress, descriptor: DM32UV_DESCRIPTOR, profileId: egress.profileId }),
    );
    act(() => result.current.open(backupSession(manifest()), ['channels']));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.view.step).toBe('review');
    expect(result.current.view.identity?.serial).toBe('SN-FULL-ARCHIVE-001');
    expect(result.current.view.identity?.label).toBe('TIDRADIO DM-32UV');
  });

  it('the range mismatch note shows and all regions are restored together', async () => {
    vi.mocked(atD890RangeMismatch).mockReturnValue(true);
    const d890Descriptor = {
      ...DM32UV_DESCRIPTOR,
      label: 'AT-D890UV',
      planStages: () => [{ label: 'Restore', weight: 1 }],
    } as RadioDescriptor;
    vi.mocked(openRadioSessionForEgress).mockResolvedValue({
      descriptor: d890Descriptor,
      session: {
        descriptor: d890Descriptor,
        pipe: {},
        radio: Object.assign(Object.create(AtD890uvProtocol.prototype), {
          disconnect: vi.fn(),
          getIdentBandCode: () => 14,
        }),
      },
    } as never);
    const { result } = renderHook(() =>
      useRadioRestoreFlow({ egress, descriptor: d890Descriptor, profileId: egress.profileId }),
    );
    act(() => result.current.open(backupSession(manifest()), ['channels']));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.view.rangeMismatch).toBe(true);
    expect(result.current.view.step).toBe('review');
    act(() => result.current.actions.onRestore());
    await act(async () => {
      await Promise.resolve();
    });
    expect(restoreRadioBackup).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ regionIds: ['channels', 'settings'] }),
    );
  });

  it('Restore to this radio runs the restore with the chosen regions', async () => {
    const { result } = renderHook(() =>
      useRadioRestoreFlow({ egress, descriptor: DM32UV_DESCRIPTOR, profileId: egress.profileId }),
    );
    act(() => result.current.open(backupSession(manifest()), ['settings']));
    await act(async () => {
      await Promise.resolve();
    });
    act(() => result.current.actions.onRestore());
    await act(async () => {
      await Promise.resolve();
    });
    expect(restoreRadioBackup).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ regionIds: ['settings'] }),
    );
  });

  it('Done shows the DM-32UV power-cycle note from the radio options', async () => {
    const { result } = renderHook(() =>
      useRadioRestoreFlow({ egress, descriptor: DM32UV_DESCRIPTOR, profileId: egress.profileId }),
    );
    act(() => result.current.open(backupSession(manifest()), ['channels']));
    await act(async () => {
      await Promise.resolve();
    });
    act(() => result.current.actions.onRestore());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.view.step).toBe('done');
    expect(result.current.view.successNote).toBe(DM32_POWER_CYCLE_AFTER_SESSION_NOTE);
  });

  it('Cancel on Review sends nothing', async () => {
    const { result } = renderHook(() =>
      useRadioRestoreFlow({ egress, descriptor: DM32UV_DESCRIPTOR, profileId: egress.profileId }),
    );
    act(() => result.current.open(backupSession(manifest()), ['channels']));
    await act(async () => {
      await Promise.resolve();
    });
    act(() => result.current.actions.onCancelReview());
    await act(async () => {
      await Promise.resolve();
    });
    expect(restoreRadioBackup).not.toHaveBeenCalled();
    expect(result.current.view.open).toBe(false);
  });
});
