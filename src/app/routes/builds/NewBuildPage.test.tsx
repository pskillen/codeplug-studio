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
  it('lists radios grouped by manufacturer with egress pathway summary', () => {
    render(
      <MemoryRouter>
        <MantineProvider>
          <NewBuildPage />
        </MantineProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Radio target')).toBeInTheDocument();
    expect(screen.getByText('Baofeng UV-5R Mini')).toBeInTheDocument();

    const uv5rCard = screen.getByText('Baofeng UV-5R Mini').closest('button');
    expect(uv5rCard).not.toBeNull();
    expect(uv5rCard!).toHaveTextContent('Web Serial');
    expect(uv5rCard!).toHaveTextContent('NeonPlug');
    expect(uv5rCard!).toHaveTextContent('CHIRP CSV');
    expect(screen.queryByText('Choose format')).not.toBeInTheDocument();
  });

  it('does not show prefer-NeonPlug warning on New Radio (export-time only)', () => {
    render(
      <MemoryRouter>
        <MantineProvider>
          <NewBuildPage />
        </MantineProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Baofeng DM-32UV')).toBeInTheDocument();
    expect(screen.queryByText(DM32_PREFER_NEONPLUG_TITLE)).not.toBeInTheDocument();
  });

  it('advances to name step when a radio is selected', () => {
    render(
      <MemoryRouter>
        <MantineProvider>
          <NewBuildPage />
        </MantineProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Baofeng UV-5R Mini'));

    expect(screen.getByLabelText('Build name')).toBeInTheDocument();
    expect(screen.getByLabelText('Build name')).toHaveValue('Baofeng UV-5R Mini');
  });
});
