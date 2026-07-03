import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import GoogleDriveActionButton from './GoogleDriveActionButton.tsx';

vi.mock('../../hooks/useGoogleDrive.ts', () => ({
  useGoogleDrive: vi.fn(),
}));

import { useGoogleDrive, type DriveConnectResult } from '../../hooks/useGoogleDrive.ts';

const mockedUseGoogleDrive = vi.mocked(useGoogleDrive);

function mockDriveState(
  connected: boolean,
  isConfigured: boolean,
  connect: () => Promise<DriveConnectResult> = vi.fn(async (): Promise<DriveConnectResult> => ({
    status: 'connected',
  })),
) {
  mockedUseGoogleDrive.mockReturnValue({
    port: {} as never,
    connected,
    accountLabel: null,
    loading: false,
    error: null,
    isConfigured,
    connect,
    disconnect: vi.fn(),
    refresh: vi.fn(),
  });
}

function renderButton(
  connected: boolean,
  isConfigured = true,
  connect: () => Promise<DriveConnectResult> = vi.fn(async (): Promise<DriveConnectResult> => ({
    status: 'connected',
  })),
) {
  mockDriveState(connected, isConfigured, connect);
  return render(
    <MemoryRouter>
      <MantineProvider>
        <GoogleDriveActionButton onClick={vi.fn()}>Open from Drive</GoogleDriveActionButton>
      </MantineProvider>
    </MemoryRouter>,
  );
}

describe('GoogleDriveActionButton', () => {
  it('connects then runs onClick when Drive is not connected', async () => {
    const onClick = vi.fn();
    const connect = vi.fn(async () => ({ status: 'connected' as const }));
    mockDriveState(false, true, connect);
    render(
      <MemoryRouter>
        <MantineProvider>
          <GoogleDriveActionButton onClick={onClick}>Open from Drive</GoogleDriveActionButton>
        </MantineProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open from Drive' }));

    await waitFor(() => {
      expect(connect).toHaveBeenCalledOnce();
      expect(onClick).toHaveBeenCalledOnce();
    });
  });

  it('does not run onClick when connect is cancelled', async () => {
    const onClick = vi.fn();
    const connect = vi.fn(async () => ({ status: 'cancelled' as const }));
    mockDriveState(false, true, connect);
    render(
      <MemoryRouter>
        <MantineProvider>
          <GoogleDriveActionButton onClick={onClick}>Open from Drive</GoogleDriveActionButton>
        </MantineProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open from Drive' }));

    await waitFor(() => {
      expect(connect).toHaveBeenCalledOnce();
    });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows connect error when OAuth fails', async () => {
    const connect = vi.fn(async () => ({
      status: 'failed' as const,
      message: 'Google sign-in failed.',
    }));
    renderButton(false, true, connect);

    fireEvent.click(screen.getByRole('button', { name: 'Open from Drive' }));

    expect(await screen.findByText('Google sign-in failed.')).toBeInTheDocument();
  });

  it('calls onClick when Drive is connected', () => {
    const onClick = vi.fn();
    mockDriveState(true, true);
    render(
      <MemoryRouter>
        <MantineProvider>
          <GoogleDriveActionButton onClick={onClick}>Save to Drive</GoogleDriveActionButton>
        </MantineProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save to Drive' }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens not-configured modal when OAuth client is missing', async () => {
    renderButton(false, false);

    fireEvent.click(screen.getByRole('button', { name: 'Open from Drive' }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Google Drive not configured' }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'Go to Settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
  });
});
