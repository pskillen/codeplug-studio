import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import CpsCsvPreview from './CpsCsvPreview.tsx';

describe('CpsCsvPreview', () => {
  it('renders tabs and table headers from parsed CSV tables', () => {
    render(
      <MantineProvider>
        <CpsCsvPreview
          fileNames={['Channels.csv', 'Zones.csv']}
          tablesByFile={{
            'Channels.csv': {
              headers: ['Name', 'RxFrequency'],
              rows: [['TestCh', '145.00000']],
            },
            'Zones.csv': {
              headers: ['Name', 'Channels'],
              rows: [['Zone1', 'TestCh']],
            },
          }}
        />
      </MantineProvider>,
    );

    expect(screen.getByRole('tab', { name: /Channels\.csv/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Zones\.csv/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'RxFrequency' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'TestCh' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '145.00000' })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(
      <MantineProvider>
        <CpsCsvPreview fileNames={[]} tablesByFile={{}} loading />
      </MantineProvider>,
    );

    expect(screen.getByText(/Generating export preview/)).toBeInTheDocument();
  });
});
