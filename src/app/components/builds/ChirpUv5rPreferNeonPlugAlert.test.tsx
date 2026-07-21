import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import ChirpUv5rPreferNeonPlugAlert, {
  CHIRP_UV5R_PREFER_NEONPLUG_TITLE,
} from './ChirpUv5rPreferNeonPlugAlert.tsx';

describe('ChirpUv5rPreferNeonPlugAlert', () => {
  it('shows in-progress copy and NeonPlug CTAs', () => {
    render(
      <MemoryRouter>
        <MantineProvider>
          <ChirpUv5rPreferNeonPlugAlert />
        </MantineProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText(CHIRP_UV5R_PREFER_NEONPLUG_TITLE)).toBeInTheDocument();
    expect(screen.getByText(/isn.t fully proven yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'NeonPlug build' })).toHaveAttribute(
      'href',
      '/builds/new',
    );
    expect(screen.getByRole('link', { name: 'neonplug.app' })).toHaveAttribute(
      'href',
      'https://neonplug.app',
    );
  });
});
