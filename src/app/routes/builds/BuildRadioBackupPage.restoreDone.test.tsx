/** Backup page: a finished Restore offers "Back to Export" and navigates there (#1393, PR 4d). */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import { DesignSystemV2Provider } from '../../components/v2/index.ts';
import { BuildLayoutProvider } from './BuildLayoutContext.tsx';
import BuildRadioBackupPage from './BuildRadioBackupPage.tsx';
import { resetBackupsThisSession } from '../../state/radioSessionBackups.ts';

vi.mock('../../services/radioIoSession.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/radioIoSession.ts')>();
  return {
    ...actual,
    isRadioSerialSupported: () => true,
    openRadioSessionForEgress: vi.fn(async () => ({ session: { radio: {}, descriptor: {} } })),
    closeRadioSession: vi.fn(async () => {}),
  };
});

vi.mock('../../services/radioBackupRestore.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/radioBackupRestore.ts')>();
  return {
    ...actual,
    descriptorSupportsRestore: () => true,
    assertRestoreIdentity: vi.fn(async () => ({
      label: 'Test radio',
      serial: 'SN-FULL-0123456789',
    })),
    restoreRadioBackup: vi.fn(async () => {}),
    backupLiveRadioSession: vi.fn(async () => ({
      manifest: {
        descriptorLabel: 'Test radio',
        radioModelId: 'test',
        serial: 'SN-FULL-0123456789',
        capturedAt: '2026-10-26T12:00:00Z',
        imageByteLength: 4,
        coverage: 'full-clone',
        regions: [
          {
            id: 'r1',
            label: 'R1',
            address: 0,
            byteLength: 4,
            path: 'regions/r1.bin',
            restoreRole: 'restorable',
          },
        ],
      },
      image: {},
      zipBytes: new Uint8Array(),
    })),
  };
});

vi.mock('../../hooks/useUnsavedNavigationGuard.ts', () => ({
  useUnsavedNavigationGuard: () => ({ modalOpen: false, stay: vi.fn(), leave: vi.fn() }),
}));

function renderPage() {
  const { build, egress, egressPaths } = newRadioBuildForProfile('project-1', 'radio-io-dm32uv');
  render(
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
        <Route path="/builds/:id/export" element={<div data-testid="export-page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => resetBackupsThisSession());

describe('BuildRadioBackupPage restore done', () => {
  it('"Back to Export" returns to the Export page', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Backup radio' }));
    await screen.findByText('Read complete');
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
    fireEvent.click(await screen.findByRole('button', { name: 'Restore to radio' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Restore to this radio' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Back to Export' }));
    expect(await screen.findByTestId('export-page')).toBeInTheDocument();
  });
});
