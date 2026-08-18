import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import ChromeDismissibleNotices from './ChromeDismissibleNotices.tsx';

const mockUseDriveRefresh = vi.fn();
const mockUseDriveSaveFlowContext = vi.fn();
const mockUseProjects = vi.fn();
const mockUseGoogleDrive = vi.fn();
const mockRunAction = vi.fn();

vi.mock('../ProjectInterchangeBar/DriveRefreshProvider.tsx', () => ({
  useDriveRefresh: () => mockUseDriveRefresh(),
}));

vi.mock('../SidebarDriveControls/DriveSaveFlowProvider.tsx', () => ({
  useDriveSaveFlowContext: () => mockUseDriveSaveFlowContext(),
}));

vi.mock('../../state/useProjects.ts', () => ({
  useProjects: () => mockUseProjects(),
}));

vi.mock('../../hooks/useGoogleDrive.ts', () => ({
  useGoogleDrive: () => mockUseGoogleDrive(),
}));

vi.mock('../../hooks/useDriveActionClick.ts', () => ({
  useDriveActionClick: () => ({
    runAction: mockRunAction,
  }),
}));

function baseRefreshState(overrides: Record<string, unknown> = {}) {
  return {
    bannerOpen: false,
    diff: null,
    overwriteOpen: false,
    importing: false,
    error: null,
    idMismatch: false,
    localProjectId: 'local-id',
    remoteProjectId: 'local-id',
    dismissBanner: vi.fn(),
    openOverwrite: vi.fn(),
    closeOverwrite: vi.fn(),
    confirmRefresh: vi.fn(),
    confirmImportAsNew: vi.fn(),
    clearRefreshError: vi.fn(),
    projectName: 'Demo',
    ...overrides,
  };
}

function baseSaveState(overrides: Record<string, unknown> = {}) {
  return {
    error: null,
    conflictOpen: false,
    clearSaveError: vi.fn(),
    ...overrides,
  };
}

function renderNotices() {
  return render(
    <MantineProvider>
      <ChromeDismissibleNotices />
    </MantineProvider>,
  );
}

describe('ChromeDismissibleNotices', () => {
  beforeEach(() => {
    mockUseProjects.mockReturnValue({
      activeProjectId: 'project-1',
      activeProject: {
        projectId: 'project-1',
        interchange: { googleDrive: { fileId: 'f1' } },
      },
    });
    mockUseGoogleDrive.mockReturnValue({
      sessionExpired: false,
      connected: true,
    });
    mockUseDriveRefresh.mockReturnValue(baseRefreshState());
    mockUseDriveSaveFlowContext.mockReturnValue(baseSaveState());
  });

  it('shows refresh parse failure when newer banner is not open', () => {
    mockUseDriveRefresh.mockReturnValue(
      baseRefreshState({
        error: 'Build channel override ch-1:scratch not found in library',
      }),
    );

    renderNotices();

    expect(
      screen.getByText(/Could not refresh from Google Drive: Build channel override/),
    ).toBeInTheDocument();
  });

  it('clears refresh error when dismiss is clicked', () => {
    const clearRefreshError = vi.fn();
    mockUseDriveRefresh.mockReturnValue(
      baseRefreshState({
        error: 'Invalid YAML syntax',
        clearRefreshError,
      }),
    );

    renderNotices();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(clearRefreshError).toHaveBeenCalledTimes(1);
  });

  it('shows save failure when conflict modal is not open', () => {
    mockUseDriveSaveFlowContext.mockReturnValue(
      baseSaveState({
        error: 'NativeYamlImportError: corrupt document',
      }),
    );

    renderNotices();

    expect(
      screen.getByText(/Could not save to Google Drive: NativeYamlImportError/),
    ).toBeInTheDocument();
  });
});
