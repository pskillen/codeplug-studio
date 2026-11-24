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
    openRadioSessionForEgress: vi.fn(async () => {
      throw new DOMException('User cancelled', 'NotFoundError');
    }),
    closeRadioSession: vi.fn(async () => {}),
  };
});

vi.mock('../../hooks/useUnsavedNavigationGuard.ts', () => ({
  useUnsavedNavigationGuard: () => ({ modalOpen: false, stay: vi.fn(), leave: vi.fn() }),
}));

vi.mock('../../services/radioBackupRestore.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/radioBackupRestore.ts')>();
  return { ...actual, backupLiveRadioSession: vi.fn() };
});

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
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => resetBackupsThisSession());

describe('BuildRadioBackupPage read errors', () => {
  it('a failed backup read shows Debug details', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Backup radio' }));
    expect(await screen.findByTestId('backup-page-read-error')).toBeInTheDocument();
    expect(screen.getByText('Debug details')).toBeInTheDocument();
  });
});
