import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import Dm32PreferNeonPlugAlert, { DM32_PREFER_NEONPLUG_TITLE } from './Dm32PreferNeonPlugAlert.tsx';

describe('Dm32PreferNeonPlugAlert', () => {
  it('shows deprecation copy and NeonPlug CTAs', () => {
    render(
      <MemoryRouter>
        <MantineProvider>
          <Dm32PreferNeonPlugAlert />
        </MantineProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText(DM32_PREFER_NEONPLUG_TITLE)).toBeInTheDocument();
    expect(screen.getByText(/imports CSV incompletely/)).toBeInTheDocument();
    expect(screen.getByText(/choose the/i)).toBeInTheDocument();
    expect(screen.getByText('NeonPlug')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'neonplug.app' })).toHaveAttribute(
      'href',
      'https://neonplug.app',
    );
  });
});
