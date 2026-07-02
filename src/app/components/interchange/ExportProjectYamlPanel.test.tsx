import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { theme } from '../../theme.ts';
import ExportProjectYamlPanel from './ExportProjectYamlPanel.tsx';

const exportProjectToYaml = vi.fn();
const refreshProjects = vi.fn();

vi.mock('../../services/projectInterchangeService.ts', () => ({
  exportProjectToYaml: (...args: unknown[]) => exportProjectToYaml(...args),
  importProjectFromYaml: vi.fn(),
}));

vi.mock('../../lib/downloadBlob.ts', () => ({
  downloadBlob: vi.fn(),
}));

vi.mock('../../state/useProjects.ts', () => ({
  useProjects: () => ({
    activeProjectId: 'proj-1',
    activeProject: {
      id: 'proj-1',
      projectId: 'proj-1',
      name: 'North Wales',
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      description: '',
      notes: '',
      author: '',
      interchange: { localFile: { fileName: 'north-wales.yaml', exportedAt: '2026-01-02T00:00:00.000Z' } },
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

describe('ExportProjectYamlPanel', () => {
  beforeEach(() => {
    exportProjectToYaml.mockReset();
    refreshProjects.mockReset();
    exportProjectToYaml.mockResolvedValue({
      content: 'schemaVersion: 1',
      fileName: 'north-wales.yaml',
      projectId: 'proj-1',
      warnings: [],
    });
    refreshProjects.mockResolvedValue(undefined);
  });

  it('pre-fills filename from interchange metadata', () => {
    render(
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <ExportProjectYamlPanel />
      </MantineProvider>,
    );

    expect(screen.getByLabelText(/Download filename/i)).toHaveValue('north-wales.yaml');
  });

  it('exports on button click', async () => {
    render(
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <ExportProjectYamlPanel />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Download YAML/i }));

    await waitFor(() => {
      expect(exportProjectToYaml).toHaveBeenCalledWith('proj-1', {
        fileName: 'north-wales.yaml',
        recordDestination: 'localFile',
      });
      expect(refreshProjects).toHaveBeenCalled();
    });
  });
});
