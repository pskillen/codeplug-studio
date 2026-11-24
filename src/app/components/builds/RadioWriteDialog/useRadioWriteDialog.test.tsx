import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import { useRadioWriteDialog } from './useRadioWriteDialog.tsx';

const openMock = vi.fn();

vi.mock('../RadioWriteStepper/useRadioWriteFlow.tsx', () => ({
  useRadioWriteFlow: () => ({
    view: { open: false, busy: false, step: 'whatToWrite' },
    actions: {},
    open: openMock,
    checkResult: null,
  }),
}));

vi.mock('../../../state/useProjects.ts', () => ({
  useProjects: () => ({ activeProjectId: 'p1', activeProject: null }),
}));

vi.mock('../../../state/atD890RadioSettingsSession.ts', () => ({
  useAtD890RadioSettingsSession: () => ({ overrides: {}, applyToEveryRadio: false }),
  atD890OverrideCount: () => 0,
  overridesForWrite: () => [],
  setApplyToEveryRadio: vi.fn(),
  setWriteSettingsRequested: vi.fn(),
}));

vi.mock('../../../state/rt95RadioSettingsSession.ts', () => ({
  useRt95RadioSettingsSession: () => ({ overrides: {}, writeSettingsRequested: false }),
  rt95OverrideCount: () => 0,
  overridesForWrite: () => [],
  setWriteSettingsRequested: vi.fn(),
}));

vi.mock('../../../services/radioIoSession.ts', () => ({
  descriptorsForEgress: () => [
    {
      label: 'D890',
      modelIds: ['AT-D890UV'],
      writeVerify: undefined,
    },
  ],
  isRadioSerialSupported: () => true,
}));

vi.mock('../../../services/egress/writeShellOptions.ts', () => ({
  resolveWriteShellOptions: () => ({
    radioLabel: 'D890',
    parts: { contacts: true, keps: true, settings: false },
    contactStore: 'generic',
    readPlan: true,
    programHoldSafeMs: 30_000,
    restartAfterEndSeconds: 0,
    check: { available: false },
    keps: { writeFn: vi.fn(), session: 'after-restart' },
  }),
}));

vi.mock('../../../services/radioWriteEnvGate.ts', () => ({
  resolveRadioWriteGate: () => 'enabled',
}));

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

const build = { id: 'b1', revision: 1, radioTargetId: 'at-d890' } as RadioBuild;
const egress = {
  id: 'e1',
  profileId: 'radio-io-at-d890uv',
  formatId: 'radio-io',
} as EgressPath;

describe('useRadioWriteDialog', () => {
  it('opens with only keps ticked', () => {
    const { result } = renderHook(() => useRadioWriteDialog({ build, egress }));
    act(() => {
      result.current.open({ codeplug: false, contacts: false, settings: false, keps: true });
    });
    expect(openMock).toHaveBeenCalledWith({
      codeplug: false,
      contacts: false,
      settings: false,
      keps: true,
    });
  });
});
