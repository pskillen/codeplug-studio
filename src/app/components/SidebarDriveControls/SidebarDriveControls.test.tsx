import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import SidebarDriveControls from './SidebarDriveControls.tsx';
import DriveRefreshProvider from '../ProjectInterchangeBar/DriveRefreshProvider.tsx';

const mockStartSaveToDrive = vi.fn();
const mockCheckNow = vi.fn();
const mockRunAction = vi.fn();

vi.mock('@integrations/cloud/drivePrefs.ts', () => ({
  loadDriveLastAccount: vi.fn(() => 'user@example.com'),
}));

vi.mock('../../hooks/useGoogleDrive.ts', () => ({
  useGoogleDrive: () => ({
    port: {},
    connected: true,
    sessionExpired: false,
    loading: false,
    withDriveAuthRetry: async <T,>(op: () => Promise<T>) => op(),
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

vi.mock('../../hooks/useDriveActionClick.ts', () => ({
  useDriveActionClick: () => ({
    driveReady: true,
    driveLoading: false,
    operationBlocked: false,
    runAction: mockRunAction,
  }),
}));

vi.mock('../../hooks/useYamlImportResolver.ts', () => ({
  useRefreshFromDrivePrompt: () => ({
    bannerOpen: false,
    diffLines: [],
    overwriteOpen: false,
    importing: false,
    checking: false,
    error: null,
    idMismatch: false,
    localProjectId: 'project-1',
    remoteProjectId: 'project-1',
    dismissBanner: vi.fn(),
    openOverwrite: vi.fn(),
    closeOverwrite: vi.fn(),
    confirmRefresh: vi.fn(),
    confirmImportAsNew: vi.fn(),
    checkNow: mockCheckNow,
    projectName: 'Demo',
    setOverwriteOpen: vi.fn(),
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
  }),
}));

function renderControls() {
  return render(
    <MemoryRouter>
      <MantineProvider>
        <DriveRefreshProvider>
          <SidebarDriveControls />
        </DriveRefreshProvider>
      </MantineProvider>
    </MemoryRouter>,
  );
}

describe('SidebarDriveControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunAction.mockImplementation(async ({ action }: { action: () => void }) => {
      action();
      return { ok: true };
    });
  });

  it('shows drive source label and action buttons', () => {
    renderControls();

    expect(screen.getByText('Google Drive · demo.yaml')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save to Drive' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Check Drive' })).toBeEnabled();
  });

  it('starts save flow when save is clicked', () => {
    renderControls();

    fireEvent.click(screen.getByRole('button', { name: 'Save to Drive' }));

    expect(mockRunAction).toHaveBeenCalled();
    expect(mockStartSaveToDrive).toHaveBeenCalledWith({
      folderId: 'folder-1',
      fileId: 'file-1',
      fileName: 'demo.yaml',
      exportedAt: '2026-07-09T10:00:00.000Z',
    });
  });

  it('runs check when Check Drive is clicked', () => {
    renderControls();

    fireEvent.click(screen.getByRole('button', { name: 'Check Drive' }));

    expect(mockRunAction).toHaveBeenCalled();
    expect(mockCheckNow).toHaveBeenCalled();
  });

  it('does not show a Reconnect button', () => {
    renderControls();

    expect(screen.queryByRole('button', { name: /reconnect/i })).not.toBeInTheDocument();
  });
});
