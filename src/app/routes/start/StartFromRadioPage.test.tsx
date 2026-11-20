import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { RadioLibraryRead } from '@integrations/radio-io/readIntoLibrary.ts';
import {
  applyRadioReadToLibrary,
  type RadioReadOutcome,
} from '../../services/radioReadIntoLibrary.ts';
import { openRadioSessionForEgress } from '../../services/radioIoSession.ts';
import { ProjectContext, type ProjectContextValue } from '../../state/ProjectContext.ts';
import StartFromRadioPage from './StartFromRadioPage.tsx';

const { read, serialSupported, flashOffered } = vi.hoisted(() => ({
  read: vi.fn(),
  serialSupported: vi.fn(() => true),
  flashOffered: vi.fn(() => true),
}));

vi.mock('../../services/radioIoSession.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/radioIoSession.ts')>()),
  isRadioSerialSupported: serialSupported,
  openRadioSessionForEgress: vi.fn(async () => ({
    session: {},
    descriptor: { label: 'Baofeng UV-5R Mini', readIntoLibrary: { read } },
  })),
  closeRadioSession: vi.fn(async () => {}),
}));

vi.mock('../../services/radioReadIntoLibrary.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/radioReadIntoLibrary.ts')>()),
  applyRadioReadToLibrary: vi.fn(),
}));

vi.mock('../../services/startFromRadio.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/startFromRadio.ts')>()),
  firmwareFlashOfferedForTarget: flashOffered,
}));

vi.mock('../../hooks/useUnsavedNavigationGuard.ts', () => ({
  useUnsavedNavigationGuard: () => ({ modalOpen: false, stay: vi.fn(), leave: vi.fn() }),
}));

const radioRead: RadioLibraryRead = {
  modelLabel: 'Baofeng UV-5R Mini',
  profileId: 'radio-io-uv5r-mini',
  firmwareLabel: 'Stock',
  channels: [],
  zones: [],
  droppedFields: [],
  notes: [],
};

function outcomeFor(radioTargetId: string, zones = 0): RadioReadOutcome {
  return {
    ok: true,
    summary: {
      modelLabel: 'Baofeng UV-5R Mini',
      firmwareLabel: radioTargetId.endsWith('mm9pdy') ? 'MM9PDY' : 'Stock',
      channels: { created: 87, updated: 0, unchanged: 0 },
      zones: { created: zones, updated: 0, unchanged: 0, warnings: [] },
      build: {
        id: 'build-1',
        name: 'UV-5R Mini',
        action: 'created',
        radioTargetId,
        targetLabel: 'Baofeng UV-5R Mini',
        channelsLeftOut: 0,
        zonesLeftOut: 0,
      },
      droppedFields: [],
      notes: [],
    },
  };
}

function renderPage() {
  const projects: ProjectContextValue = {
    projects: [],
    activeProjectId: null,
    activeProject: null,
    loading: false,
    createProject: vi.fn(async () => 'project-1'),
    switchProject: vi.fn(),
    renameProject: vi.fn(async () => {}),
    deleteProject: vi.fn(async () => {}),
    refreshProjects: vi.fn(async () => {}),
  };
  render(
    <MemoryRouter>
      <ProjectContext.Provider value={projects}>
        <StartFromRadioPage />
      </ProjectContext.Provider>
    </MemoryRouter>,
  );
  return projects;
}

function goToRead() {
  expect(screen.getByRole('radio', { name: /UV-5R Mini/ })).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByLabelText('Project name')).toHaveValue('My UV-5R Mini');
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
}

describe('StartFromRadioPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serialSupported.mockReturnValue(true);
    flashOffered.mockReturnValue(true);
    read.mockResolvedValue(radioRead);
  });

  it('lists radios that can be read into a library', () => {
    renderPage();
    const radios = within(screen.getByRole('radiogroup', { name: 'Radio' })).getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual([
      'Baofeng UV-5R MiniStock or MM9PDY firmware',
    ]);
  });

  it('creates the project after connecting, reads, then offers a firmware update on stock', async () => {
    vi.mocked(applyRadioReadToLibrary).mockResolvedValue(outcomeFor('baofeng-uv5r-mini'));
    const projects = renderPage();
    goToRead();
    fireEvent.click(screen.getByRole('button', { name: 'Connect and read' }));
    await waitFor(() => expect(applyRadioReadToLibrary).toHaveBeenCalled());
    expect(openRadioSessionForEgress).toHaveBeenCalledWith(
      { formatId: 'radio-io', profileId: 'radio-io-uv5r-mini' },
      expect.objectContaining({ purpose: 'read' }),
    );
    expect(projects.createProject).toHaveBeenCalledWith('My UV-5R Mini');
    expect(vi.mocked(applyRadioReadToLibrary).mock.calls[0]![0]).toMatchObject({
      projectId: 'project-1',
      read: radioRead,
    });
    fireEvent.click(await screen.findByRole('button', { name: 'See next steps' }));
    const steps = within(screen.getByRole('list', { name: 'Next steps' })).getAllByRole('listitem');
    expect(steps[0]).toHaveTextContent('Update your radio’s firmware');
    expect(screen.queryByText(/Arrange your zones/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Write/ })).not.toBeInTheDocument();
  });

  it('leads with zones when the radio runs firmware with zones', async () => {
    vi.mocked(applyRadioReadToLibrary).mockResolvedValue(outcomeFor('baofeng-uv5r-mini-mm9pdy', 6));
    renderPage();
    goToRead();
    fireEvent.click(screen.getByRole('button', { name: 'Connect and read' }));
    fireEvent.click(await screen.findByRole('button', { name: 'See next steps' }));
    const steps = within(screen.getByRole('list', { name: 'Next steps' })).getAllByRole('listitem');
    expect(steps[0]).toHaveTextContent('Arrange your zones');
    expect(screen.queryByText(/Update your radio’s firmware/)).not.toBeInTheDocument();
  });

  it('keeps the project after a failed read and reuses it when trying again', async () => {
    read.mockRejectedValueOnce(new Error('The radio did not answer.'));
    vi.mocked(applyRadioReadToLibrary).mockResolvedValue(outcomeFor('baofeng-uv5r-mini'));
    const projects = renderPage();
    goToRead();
    fireEvent.click(screen.getByRole('button', { name: 'Connect and read' }));
    expect(await screen.findByText(/The radio did not answer/)).toHaveTextContent(
      'won’t make a copy',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(applyRadioReadToLibrary).toHaveBeenCalled());
    expect(projects.createProject).toHaveBeenCalledTimes(1);
  });

  it('does not create a project when the port is not chosen', async () => {
    vi.mocked(openRadioSessionForEgress).mockRejectedValueOnce(new Error('No port selected.'));
    const projects = renderPage();
    goToRead();
    fireEvent.click(screen.getByRole('button', { name: 'Connect and read' }));
    expect(await screen.findByText(/No port selected/)).toBeInTheDocument();
    expect(projects.createProject).not.toHaveBeenCalled();
  });

  it('explains when the browser cannot talk to the cable', () => {
    serialSupported.mockReturnValue(false);
    renderPage();
    goToRead();
    expect(screen.getByRole('button', { name: 'Connect and read' })).toBeDisabled();
    expect(screen.getByText(/Chrome or Edge/)).toBeInTheDocument();
  });
});
