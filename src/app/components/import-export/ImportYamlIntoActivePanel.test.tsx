import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { theme } from '../../theme.ts';
import ImportYamlIntoActivePanel from './ImportYamlIntoActivePanel.tsx';

const confirmOverwrite = vi.fn();
const confirmImportAsNew = vi.fn();
const handleLocalFile = vi.fn();
const resetOverwrite = vi.fn();

function mockResolver(overrides: Record<string, unknown> = {}) {
  return {
    importing: false,
    error: null,
    overwriteOpen: true,
    overwriteTitle: 'Replace active project?',
    diffLines: ['Local: 1 channel'],
    projectName: 'Active project',
    idMismatch: false,
    localProjectId: 'proj-1',
    remoteProjectId: 'proj-1',
    setOverwriteOpen: vi.fn(),
    resetOverwrite,
    confirmOverwrite,
    confirmImportAsNew,
    handleDriveSelection: vi.fn(),
    handleLocalFile,
    handleYamlContent: vi.fn(),
    ...overrides,
  };
}

let resolverState = mockResolver();

vi.mock('../../hooks/useGoogleDrive.ts', () => ({
  useGoogleDrive: () => ({
    connected: true,
    isConfigured: true,
    sessionExpired: false,
    loading: false,
    connect: vi.fn(),
    withDriveAuthRetry: <T,>(operation: () => Promise<T>) => operation(),
    port: {},
  }),
}));

vi.mock('../../hooks/useYamlImportResolver.ts', () => ({
  useYamlImportResolver: () => resolverState,
}));

vi.mock('../../state/useProjects.ts', () => ({
  useProjects: () => ({
    activeProjectId: 'proj-1',
    activeProject: {
      id: 'proj-1',
      projectId: 'proj-1',
      name: 'Active project',
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      description: '',
      notes: '',
      author: '',
    },
    refreshProjects: vi.fn(),
    switchProject: vi.fn(),
    projects: [],
    loading: false,
    createProject: vi.fn(),
    renameProject: vi.fn(),
    deleteProject: vi.fn(),
  }),
}));

function renderPanel() {
  return render(
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <ImportYamlIntoActivePanel />
    </MantineProvider>,
  );
}

describe('ImportYamlIntoActivePanel', () => {
  beforeEach(() => {
    resolverState = mockResolver();
    confirmOverwrite.mockReset();
    confirmImportAsNew.mockReset();
    handleLocalFile.mockReset();
  });

  it('routes local file selection through yaml import resolver', async () => {
    renderPanel();

    const file = new File(['schemaVersion: 1'], 'backup.yaml', { type: 'application/yaml' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(handleLocalFile).toHaveBeenCalledWith('backup.yaml', 'schemaVersion: 1');
    });
  });

  it('confirms overwrite through interchange modal', () => {
    renderPanel();
    expect(screen.getByText('Local: 1 channel')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Overwrite local copy' }));
    expect(confirmOverwrite).toHaveBeenCalledOnce();
  });

  it('shows mismatch override actions when project ids differ', () => {
    resolverState = mockResolver({
      idMismatch: true,
      localProjectId: 'proj-1',
      remoteProjectId: 'remote-proj',
    });
    renderPanel();

    expect(screen.getByText(/Local project id: proj-1/)).toBeInTheDocument();
    expect(screen.getByText(/Remote project id: remote-proj/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Replace local content' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import as new project' }));
    expect(confirmOverwrite).toHaveBeenCalledOnce();
    expect(confirmImportAsNew).toHaveBeenCalledOnce();
  });
});
