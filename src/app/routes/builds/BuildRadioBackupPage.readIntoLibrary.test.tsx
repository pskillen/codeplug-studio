import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import type { RadioLibraryRead } from '@integrations/radio-io/readIntoLibrary.ts';
import { DesignSystemV2Provider } from '../../components/v2/index.ts';
import {
  applyRadioReadToLibrary,
  type RadioReadOutcome,
} from '../../services/radioReadIntoLibrary.ts';
import { closeRadioSession, openRadioSessionForEgress } from '../../services/radioIoSession.ts';
import { persistence } from '../../state/persistence.ts';
import { ProjectContext } from '../../state/ProjectContext.ts';
import { BuildLayoutProvider } from './BuildLayoutContext.tsx';
import BuildRadioBackupPage from './BuildRadioBackupPage.tsx';

const { read, serialSupported, session } = vi.hoisted(() => ({
  read: vi.fn(),
  serialSupported: vi.fn(),
  session: { radio: {}, descriptor: {} },
}));

vi.mock('../../services/radioIoSession.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/radioIoSession.ts')>();
  return {
    ...actual,
    isRadioSerialSupported: serialSupported,
    descriptorsForEgress: (egress: Parameters<typeof actual.descriptorsForEgress>[0]) =>
      actual
        .descriptorsForEgress(egress)
        .map((descriptor) =>
          descriptor.readIntoLibrary ? { ...descriptor, readIntoLibrary: { read } } : descriptor,
        ),
    openRadioSessionForEgress: vi.fn(async () => ({ session })),
    closeRadioSession: vi.fn(async () => {}),
  };
});

vi.mock('../../services/radioReadIntoLibrary.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/radioReadIntoLibrary.ts')>()),
  applyRadioReadToLibrary: vi.fn(),
}));

vi.mock('../../hooks/useUnsavedNavigationGuard.ts', () => ({
  useUnsavedNavigationGuard: () => ({ modalOpen: false, stay: vi.fn(), leave: vi.fn() }),
}));

const radioRead: RadioLibraryRead = {
  modelLabel: 'Baofeng UV-5R Mini',
  profileId: 'radio-io-uv5r-mini',
  firmwareLabel: 'Stock firmware',
  channels: [],
  zones: [],
  droppedFields: ['Busy channel lockout'],
  notes: [],
};

const outcome: RadioReadOutcome = {
  ok: true,
  summary: {
    modelLabel: radioRead.modelLabel,
    firmwareLabel: radioRead.firmwareLabel,
    channels: { created: 12, updated: 3, unchanged: 40 },
    zones: { created: 0, updated: 0, unchanged: 0, warnings: [] },
    build: {
      id: 'destination',
      name: 'Mini',
      action: 'updated',
      radioTargetId: 'baofeng-uv5r-mini',
      targetLabel: 'UV-5R Mini',
      channelsLeftOut: 0,
      zonesLeftOut: 0,
    },
    droppedFields: radioRead.droppedFields,
    notes: [],
  },
};

function renderPage(profile = 'radio-io-uv5r-mini', activeProjectId: string | null = 'project-1') {
  const { build, egress, egressPaths } = newRadioBuildForProfile('project-1', profile);
  render(
    <MemoryRouter initialEntries={[`/builds/${build.id}/backup`]}>
      <ProjectContext.Provider
        value={{
          projects: [],
          activeProjectId,
          activeProject: null,
          loading: false,
          createProject: vi.fn(),
          switchProject: vi.fn(),
          renameProject: vi.fn(),
          deleteProject: vi.fn(),
          refreshProjects: vi.fn(),
        }}
      >
        <BuildLayoutProvider
          value={{
            build,
            buildId: build.id,
            egressPaths,
            activeEgress: egress,
            setActiveEgressId: vi.fn(),
            reloadEgressPaths: vi.fn(),
          }}
        >
          <DesignSystemV2Provider>
            <BuildRadioBackupPage />
          </DesignSystemV2Provider>
        </BuildLayoutProvider>
      </ProjectContext.Provider>
    </MemoryRouter>,
  );
  return { build, egress };
}

const readButton = () => screen.getByRole('button', { name: 'Read into library' });

beforeEach(() => {
  vi.clearAllMocks();
  serialSupported.mockReturnValue(true);
  read.mockResolvedValue(radioRead);
  vi.mocked(applyRadioReadToLibrary).mockResolvedValue(outcome);
});

describe('Backup / Restore Read into library', () => {
  it.each(['radio-io-uv5r-mini', 'radio-io-uv5r-mini-mm9pdy'])(
    'shows the action for %s',
    (profile) => {
      renderPage(profile);
      expect(screen.getByRole('heading', { name: 'Read into library' })).toBeInTheDocument();
      expect(readButton()).toBeEnabled();
    },
  );

  it('omits the action for a radio without the adapter hook', () => {
    renderPage('radio-io-dm32uv');
    expect(screen.queryByRole('button', { name: 'Read into library' })).not.toBeInTheDocument();
  });

  it('disables the action without serial support', () => {
    serialSupported.mockReturnValue(false);
    renderPage();
    expect(readButton()).toBeDisabled();
  });

  it('disables the action without an active project', () => {
    renderPage('radio-io-uv5r-mini', null);
    expect(readButton()).toBeDisabled();
  });

  it('closes the session before applying the read and shows the summary', async () => {
    const { build, egress } = renderPage();
    fireEvent.click(readButton());
    expect(await screen.findByText('Library and build changes are saved.')).toBeInTheDocument();
    expect(openRadioSessionForEgress).toHaveBeenCalledWith(egress, {
      forcePortSelection: true,
      purpose: 'read',
      signal: expect.any(AbortSignal),
    });
    expect(read).toHaveBeenCalledWith(session, {
      onProgress: expect.any(Function),
      signal: expect.any(AbortSignal),
    });
    expect(closeRadioSession).toHaveBeenCalledWith(session);
    expect(closeRadioSession).toHaveBeenCalledBefore(vi.mocked(applyRadioReadToLibrary));
    expect(applyRadioReadToLibrary).toHaveBeenCalledWith({
      persistence,
      projectId: 'project-1',
      read: radioRead,
      startedFromBuildId: build.id,
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
    expect(screen.getByText('Channels: 12 created, 3 updated, 40 unchanged')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mini' })).toHaveAttribute(
      'href',
      '/builds/destination/export',
    );
    expect(screen.getByText('Busy channel lockout')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('heading', { name: 'Read complete' })).not.toBeInTheDocument();
  });

  it('shows a thrown read error and allows a retry', async () => {
    read.mockRejectedValueOnce(new Error('The radio disconnected.'));
    renderPage();
    fireEvent.click(readButton());
    expect(await screen.findByText('The radio disconnected.')).toBeInTheDocument();
    expect(closeRadioSession).toHaveBeenCalledWith(session);
    expect(applyRadioReadToLibrary).not.toHaveBeenCalled();
    expect(readButton()).toBeEnabled();
  });

  it('releases the session and skips the save when cancelled', async () => {
    read.mockImplementationOnce(
      (_session, { signal }: { signal: AbortSignal }) =>
        new Promise<RadioLibraryRead>((_, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        }),
    );
    renderPage();
    fireEvent.click(readButton());
    await waitFor(() => expect(read).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(readButton()).toBeEnabled());
    expect(closeRadioSession).toHaveBeenCalledWith(session);
    expect(applyRadioReadToLibrary).not.toHaveBeenCalled();
  });

  it('shows a service failure without a success modal', async () => {
    vi.mocked(applyRadioReadToLibrary).mockResolvedValueOnce({
      ok: false,
      message:
        'Could not apply the radio read. 1 channels and 0 zones saved. The build may have been partially saved.',
    });
    renderPage();
    fireEvent.click(readButton());
    expect(await screen.findByText(/Could not apply the radio read\./)).toBeInTheDocument();
    expect(screen.queryByText('Library and build changes are saved.')).not.toBeInTheDocument();
    expect(readButton()).toBeEnabled();
  });
});
