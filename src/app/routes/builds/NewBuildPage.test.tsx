import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { DM32_PREFER_NEONPLUG_TITLE } from '../../components/builds/Dm32PreferNeonPlugAlert.tsx';
import NewBuildPage from './NewBuildPage.tsx';

vi.mock('../../state/useFormatBuilds.ts', () => ({
  useFormatBuilds: () => ({
    createBuild: vi.fn(),
  }),
}));

describe('NewBuildPage', () => {
  it('shows prefer-NeonPlug warning on the DM32 profile step', async () => {
    render(
      <MemoryRouter>
        <MantineProvider>
          <NewBuildPage />
        </MantineProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('DM32 CSV'));

    expect(await screen.findByText(DM32_PREFER_NEONPLUG_TITLE)).toBeInTheDocument();
    expect(screen.getByText('Choose profile')).toBeInTheDocument();
  });

  it('does not show the DM32 warning on the CHIRP profile step', async () => {
    render(
      <MemoryRouter>
        <MantineProvider>
          <NewBuildPage />
        </MantineProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('CHIRP CSV'));

    expect(await screen.findByText('Choose profile')).toBeInTheDocument();
    expect(screen.queryByText(DM32_PREFER_NEONPLUG_TITLE)).not.toBeInTheDocument();
  });
});
