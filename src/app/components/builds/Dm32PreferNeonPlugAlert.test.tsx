import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import Dm32PreferNeonPlugAlert from './Dm32PreferNeonPlugAlert.tsx';

describe('Dm32PreferNeonPlugAlert', () => {
  it('shows deprecation copy and NeonPlug CTAs', () => {
    render(
      <MemoryRouter>
        <MantineProvider>
          <Dm32PreferNeonPlugAlert />
        </MantineProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/DM-32 CPS export is deprecated for radio write/)).toBeInTheDocument();
    expect(screen.getByText(/too full of bugs/)).toBeInTheDocument();
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
