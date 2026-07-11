import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import ProjectInterchangeBar from './ProjectInterchangeBar.tsx';

const mockStartSaveToDrive = vi.fn();

vi.mock('../../hooks/useGoogleDrive.ts', () => ({
  useGoogleDrive: () => ({
    port: { writeFile: vi.fn() },
    withDriveAuthRetry: <T,>(operation: () => Promise<T>) => operation(),
    loading: false,
  }),
}));

vi.mock('../../hooks/useProjectPortableDirty.ts', () => ({
  useProjectPortableDirty: () => ({
    dirty: true,
    hasPortableDestination: true,
    refresh: vi.fn(),
  }),
}));

vi.mock('../../hooks/useDriveSaveFlow.ts', () => ({
  useDriveSaveFlow: () => ({
    saving: false,
    error: null,
    conflictOpen: false,
    conflict: null,
    projectName: 'Demo',
    saveAsBrowserOpen: false,
    setSaveAsBrowserOpen: vi.fn(),
    suggestedFileName: 'demo.yaml',
    interchangeFolderId: 'folder-1',
    startSaveToDrive: mockStartSaveToDrive,
    confirmSaveAnyway: vi.fn(),
    confirmRefreshFromDrive: vi.fn(),
    openSaveAsNew: vi.fn(),
    saveToNewTarget: vi.fn(),
    closeConflict: vi.fn(),
  }),
}));

vi.mock('../../state/useProjects.ts', () => ({
  useProjects: () => ({
    activeProjectId: 'project-1',
    activeProject: {
      id: 'project-1',
      projectId: 'project-1',
      name: 'Demo',
      interchange: {
        googleDrive: {
          folderId: 'folder-1',
          fileId: 'file-1',
          fileName: 'demo.yaml',
          exportedAt: '2026-07-09T10:00:00.000Z',
        },
      },
    },
    refreshProjects: vi.fn(),
  }),
}));

describe('ProjectInterchangeBar', () => {
  it('shows drive source label and save button', () => {
    render(
      <MemoryRouter>
        <MantineProvider>
          <ProjectInterchangeBar />
        </MantineProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Google Drive · demo.yaml')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save to Drive' })).toBeEnabled();
  });

  it('starts drive save flow when save is clicked', () => {
    render(
      <MemoryRouter>
        <MantineProvider>
          <ProjectInterchangeBar />
        </MantineProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save to Drive' }));

    expect(mockStartSaveToDrive).toHaveBeenCalledWith({
      folderId: 'folder-1',
      fileId: 'file-1',
      fileName: 'demo.yaml',
      exportedAt: '2026-07-09T10:00:00.000Z',
    });
  });
});
