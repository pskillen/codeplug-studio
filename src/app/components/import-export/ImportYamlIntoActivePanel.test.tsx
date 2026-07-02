import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { theme } from '../../theme.ts';
import ImportYamlIntoActivePanel from './ImportYamlIntoActivePanel.tsx';

const importProjectFromYaml = vi.fn();
const refreshProjects = vi.fn();

vi.mock('../../services/projectImportExportService.ts', () => ({
  importProjectFromYaml: (...args: unknown[]) => importProjectFromYaml(...args),
  exportProjectToYaml: vi.fn(),
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
    refreshProjects,
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
    importProjectFromYaml.mockReset();
    refreshProjects.mockReset();
    importProjectFromYaml.mockResolvedValue({ projectId: 'proj-1', warnings: [] });
    refreshProjects.mockResolvedValue(undefined);
  });

  it('does not import until replace is confirmed', async () => {
    renderPanel();

    const file = new File(['schemaVersion: 1'], 'backup.yaml', { type: 'application/yaml' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/Replace active project/i)).toBeInTheDocument();
    expect(importProjectFromYaml).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Replace project/i }));

    await waitFor(() => {
      expect(importProjectFromYaml).toHaveBeenCalledWith('schemaVersion: 1', {
        kind: 'replaceExisting',
        projectId: 'proj-1',
      });
    });
  });
});
