/**
 * Backup page: a D890 Restore onto a radio whose range has changed since the backup restores every restorable
 * region together, and says why (#1369). A same-range Restore keeps the user's region choice.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import { DesignSystemV2Provider } from '../../components/v2/index.ts';
import { resetBackupsThisSession } from '../../state/radioSessionBackups.ts';
import { BuildLayoutProvider } from './BuildLayoutContext.tsx';
import BuildRadioBackupPage from './BuildRadioBackupPage.tsx';

const state = vi.hoisted(() => ({
  liveCode: 3,
  restoreCalls: [] as string[][],
  LOCAL_INFO: 0x04f80000,
}));

function fakeD890Radio(): AtD890uvProtocol {
  const radio = Object.create(AtD890uvProtocol.prototype) as AtD890uvProtocol;
  radio.getIdentBandCode = () => state.liveCode;
  return radio;
}

vi.mock('../../services/radioIoSession.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/radioIoSession.ts')>();
  return {
    ...actual,
    isRadioSerialSupported: () => true,
    openRadioSessionForEgress: vi.fn(async () => ({
      session: { radio: fakeD890Radio(), descriptor: {} },
    })),
    closeRadioSession: vi.fn(async () => {}),
  };
});

vi.mock('../../services/radioBackupRestore.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/radioBackupRestore.ts')>();
  const localInfo = new Uint8Array(0x100);
  localInfo[3] = 3; // the backup was taken on code 3
  const manifest = {
    descriptorLabel: 'Test radio',
    radioModelId: 'AT-D890UV',
    serial: 'TESTSERIAL01',
    capturedAt: '2026-10-26T12:00:00Z',
    capturedVia: 'web-serial',
    imageByteLength: state.LOCAL_INFO + 0x100,
    coverage: 'known-map-regions',
    regions: [
      {
        id: 'local-info',
        label: 'LocalInfo',
        address: state.LOCAL_INFO,
        byteLength: 0x100,
        path: 'regions/local-info.bin',
        restoreRole: 'inspect-only',
      },
      ...['zone-set', 'optional-settings-main'].map((id, i) => ({
        id,
        label: id,
        address: 0x1000 * (i + 1),
        byteLength: 16,
        path: `regions/${id}.bin`,
        restoreRole: 'restorable',
      })),
    ],
  };
  return {
    ...actual,
    descriptorSupportsRestore: () => true,
    openRadioBackupZip: vi.fn(() => ({
      source: 'file',
      manifest,
      image: { size: state.LOCAL_INFO + 0x100, get: () => localInfo },
      zipBytes: new Uint8Array(),
    })),
    assertRestoreIdentity: vi.fn(async () => ({ label: 'Test radio', serial: 'TESTSERIAL01' })),
    restoreRadioBackup: vi.fn(
      async (_s: unknown, _a: unknown, opts?: { regionIds?: readonly string[] }) => {
        state.restoreCalls.push([...(opts?.regionIds ?? [])]);
      },
    ),
  };
});

vi.mock('../../hooks/useUnsavedNavigationGuard.ts', () => ({
  useUnsavedNavigationGuard: () => ({ modalOpen: false, stay: vi.fn(), leave: vi.fn() }),
}));

function renderPage() {
  const { build, egress, egressPaths } = newRadioBuildForProfile('project-1', 'radio-io-at-d890uv');
  return render(
    <MemoryRouter initialEntries={[`/builds/${build.id}/backup`]}>
      <Routes>
        <Route
          path="/builds/:id/backup"
          element={
            <BuildLayoutProvider
              value={{
                build,
                buildId: build.id,
                egressPaths,
                activeEgress: egress,
                setActiveEgressId: vi.fn(),
                reloadEgressPaths: vi.fn(async () => {}),
              }}
            >
              <DesignSystemV2Provider>
                <BuildRadioBackupPage />
              </DesignSystemV2Provider>
            </BuildLayoutProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

async function openFileAndRestore(container: HTMLElement) {
  const input = [...container.querySelectorAll('input[type="file"]')].at(-1) as HTMLInputElement;
  fireEvent.change(input, {
    target: { files: [new File([new Uint8Array(4)], 'b.zip', { type: 'application/zip' })] },
  });
  await screen.findByText('Regions');
  // Untick one restorable region: a same-range Restore keeps that choice.
  fireEvent.click(screen.getByRole('checkbox', { name: 'Restore optional-settings-main' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Restore to radio' }));
  await screen.findByRole('button', { name: 'Restore to this radio' });
}

beforeEach(() => {
  resetBackupsThisSession();
  state.restoreCalls = [];
});

describe('Backup page restore range guard', () => {
  it('a radio whose range changed since the backup: every restorable region, with the reason', async () => {
    state.liveCode = 7;
    const { container } = renderPage();
    await openFileAndRestore(container);
    expect(screen.getByTestId('restore-range-mismatch')).toHaveTextContent(
      "This radio's range has changed since the backup, so Studio restores everything together. Restoring settings alone would stop the radio starting.",
    );
    // The boxes show what will happen: every region ticked, and locked.
    for (const id of ['zone-set', 'optional-settings-main']) {
      const box = screen.getByRole('checkbox', { name: `Restore ${id}` });
      expect(box).toBeChecked();
      expect(box).toBeDisabled();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Restore to this radio' }));
    await waitFor(() => expect(state.restoreCalls).toHaveLength(1));
    expect(state.restoreCalls[0]).toEqual(['zone-set', 'optional-settings-main']);
  });

  it('the same range: nothing new, and the unticked region stays unticked', async () => {
    state.liveCode = 3;
    const { container } = renderPage();
    await openFileAndRestore(container);
    expect(screen.queryByTestId('restore-range-mismatch')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Restore to this radio' }));
    await waitFor(() => expect(state.restoreCalls).toHaveLength(1));
    expect(state.restoreCalls[0]).toEqual(['zone-set']);
  });
});
