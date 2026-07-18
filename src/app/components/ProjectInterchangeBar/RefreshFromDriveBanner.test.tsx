import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import RefreshFromDriveBanner from './RefreshFromDriveBanner.tsx';

const mockUseDriveRefresh = vi.fn();

vi.mock('./DriveRefreshProvider.tsx', () => ({
  useDriveRefresh: () => mockUseDriveRefresh(),
}));

function baseHookState(overrides: Record<string, unknown> = {}) {
  return {
    bannerOpen: true,
    diff: null,
    overwriteOpen: false,
    importing: false,
    error: null,
    idMismatch: false,
    localProjectId: 'local-id',
    remoteProjectId: 'local-id',
    closeOverwrite: vi.fn(),
    dismissBanner: vi.fn(),
    openOverwrite: vi.fn(),
    confirmRefresh: vi.fn(),
    confirmImportAsNew: vi.fn(),
    projectName: 'Demo',
    ...overrides,
  };
}

describe('RefreshFromDriveBanner', () => {
  it('shows standard newer-copy banner when ids match', () => {
    mockUseDriveRefresh.mockReturnValue(baseHookState());

    render(
      <MantineProvider>
        <RefreshFromDriveBanner />
      </MantineProvider>,
    );

    expect(screen.getByText('Newer copy on Google Drive')).toBeInTheDocument();
    expect(screen.getByText(/A newer YAML file is available for this project/)).toBeInTheDocument();
  });

  it('shows mismatch warning when remote project id differs', () => {
    mockUseDriveRefresh.mockReturnValue(
      baseHookState({
        idMismatch: true,
        remoteProjectId: 'remote-id',
      }),
    );

    render(
      <MantineProvider>
        <RefreshFromDriveBanner />
      </MantineProvider>,
    );

    expect(screen.getByText('Drive file project mismatch')).toBeInTheDocument();
    expect(screen.getByText(/project id does not match this project/)).toBeInTheDocument();
  });

  it('opens mismatch modal with override actions', () => {
    const openOverwrite = vi.fn();
    mockUseDriveRefresh.mockReturnValue(
      baseHookState({
        idMismatch: true,
        overwriteOpen: true,
        localProjectId: 'local-id',
        remoteProjectId: 'remote-id',
        openOverwrite,
      }),
    );

    render(
      <MantineProvider>
        <RefreshFromDriveBanner />
      </MantineProvider>,
    );

    expect(screen.getByRole('button', { name: 'Replace local content' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import as new project' })).toBeInTheDocument();
  });

  it('wires refresh button to open overwrite modal', () => {
    const openOverwrite = vi.fn();
    mockUseDriveRefresh.mockReturnValue(baseHookState({ openOverwrite }));

    render(
      <MantineProvider>
        <RefreshFromDriveBanner />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Refresh from Drive' }));
    expect(openOverwrite).toHaveBeenCalledTimes(1);
  });
});
