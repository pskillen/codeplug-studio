import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import Dm32AprsSetupAlert from './Dm32AprsSetupAlert.tsx';

describe('Dm32AprsSetupAlert', () => {
  it('renders nothing without APRS.md', () => {
    render(
      <MantineProvider>
        <Dm32AprsSetupAlert exportFileNames={['Channels.csv']} />
      </MantineProvider>,
    );
    expect(screen.queryByText(/DM-32 APRS setup/)).not.toBeInTheDocument();
  });

  it('shows CPS setup instructions when APRS.md is in the export', () => {
    render(
      <MantineProvider>
        <Dm32AprsSetupAlert exportFileNames={['Channels.csv', 'APRS.md']} />
      </MantineProvider>,
    );
    expect(screen.getByText(/DM-32 APRS setup/)).toBeInTheDocument();
    expect(screen.getByText(/APRS\.md/)).toBeInTheDocument();
    expect(screen.getByText(/Upload number/)).toBeInTheDocument();
  });
});
