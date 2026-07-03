import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import GoogleDriveActionButton from './GoogleDriveActionButton.tsx';

vi.mock('../../hooks/useGoogleDrive.ts', () => ({
  useGoogleDrive: vi.fn(),
}));

import { useGoogleDrive } from '../../hooks/useGoogleDrive.ts';

const mockedUseGoogleDrive = vi.mocked(useGoogleDrive);

function mockDriveState(connected: boolean, isConfigured: boolean) {
  mockedUseGoogleDrive.mockReturnValue({
    port: {} as never,
    connected,
    accountLabel: null,
    loading: false,
    error: null,
    isConfigured,
    connect: vi.fn(),
    disconnect: vi.fn(),
    refresh: vi.fn(),
  });
}

function renderButton(connected: boolean, isConfigured = true) {
  mockDriveState(connected, isConfigured);
  return render(
    <MemoryRouter>
      <MantineProvider>
        <GoogleDriveActionButton onClick={vi.fn()}>Open from Drive</GoogleDriveActionButton>
      </MantineProvider>
    </MemoryRouter>,
  );
}

describe('GoogleDriveActionButton', () => {
  it('opens settings prompt when Drive is not connected', async () => {
    renderButton(false);

    fireEvent.click(screen.getByRole('button', { name: 'Open from Drive' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Google Drive not connected' })).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'Go to Settings' })).toHaveAttribute('href', '/settings');
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

  it('explains missing OAuth client when not configured', async () => {
    renderButton(false, false);

    fireEvent.click(screen.getByRole('button', { name: 'Open from Drive' }));

    await waitFor(() => {
      expect(screen.getByText(/not configured for this build/i)).toBeInTheDocument();
    });
  });
});
