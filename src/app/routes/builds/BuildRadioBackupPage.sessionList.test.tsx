/**
 * Backup page: "Backups saved this session" (#1393, PR 4d). Entries come from the Backup page's own
 * read and from the Write's Review; the list lives in memory only.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import { DesignSystemV2Provider } from '../../components/v2/index.ts';
import { BuildLayoutProvider } from './BuildLayoutContext.tsx';
import BuildRadioBackupPage from './BuildRadioBackupPage.tsx';
import { addBackupThisSession, resetBackupsThisSession } from '../../state/radioSessionBackups.ts';

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
    backupLiveRadioSession: vi.fn(async () => ({
      manifest: {
        descriptorLabel: 'Test radio',
        radioModelId: 'test',
        serial: 'SN-FULL-0123456789',
        capturedAt: '2026-10-26T12:00:00Z',
        imageByteLength: 4,
        coverage: 'full-clone',
        regions: [],
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
    <MemoryRouter>
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
    </MemoryRouter>,
  );
  return build;
}

function section() {
  return document.body;
}

beforeEach(() => resetBackupsThisSession());

describe('BuildRadioBackupPage backups this session', () => {
  it('shows the empty state', () => {
    renderPage();
    expect(screen.getByText('No backups this session')).toBeInTheDocument();
  });

  it('lists a backup saved from Review with the full serial, newest first', () => {
    const build = renderPage();
    act(() => {
      addBackupThisSession(build.id, {
        serial: 'SN-OLD-0001',
        model: 'AT-D890UV',
        name: 'MM9PDY-1',
        at: 1_000,
      });
      addBackupThisSession(build.id, {
        serial: 'SN-NEW-0002',
        model: 'AT-D890UV',
        name: 'MM9PDY-2',
        at: 2_000,
      });
    });
    const rows = within(section()).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('MM9PDY-2');
    expect(rows[0]).toHaveTextContent('SN-NEW-0002');
    expect(rows[1]).toHaveTextContent('SN-OLD-0001');
  });

  it('renders named and unnamed entries the same way: name over model, or model alone', () => {
    const build = renderPage();
    act(() => {
      addBackupThisSession(build.id, {
        serial: 'A',
        model: 'AT-D890UV',
        name: 'MM9PDY-1',
        at: 1_000,
      });
      addBackupThisSession(build.id, { serial: 'B', model: 'DM-32UV', name: '', at: 2_000 });
    });
    const rows = within(section()).getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('DM-32UV')).toBeInTheDocument();
    expect(within(rows[0]).queryByText('MM9PDY-1')).toBeNull();
    expect(within(rows[1]).getByText('MM9PDY-1')).toBeInTheDocument();
    expect(within(rows[1]).getByText('AT-D890UV')).toBeInTheDocument();
  });

  it('records a backup taken on this page, with the full serial', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Backup radio' }));
    await waitFor(() =>
      expect(within(section()).getByText('SN-FULL-0123456789')).toBeInTheDocument(),
    );
    expect(within(section()).getByText('Test radio')).toBeInTheDocument();
    expect(screen.queryByText('No backups this session')).toBeNull();
  });

  it('keeps the list in memory only', () => {
    const before = [localStorage.length, sessionStorage.length];
    renderPage();
    act(() => addBackupThisSession('x', { serial: 'S', model: 'M', name: '', at: 1 }));
    expect([localStorage.length, sessionStorage.length]).toEqual(before);
  });
});
