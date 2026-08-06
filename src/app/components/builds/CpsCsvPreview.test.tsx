import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import CpsCsvPreview from './CpsCsvPreview.tsx';

const sampleTable = {
  'Channels.csv': {
    headers: ['Name', 'RxFrequency'],
    rows: [
      ['Alpha', '145.00000'],
      ['Bravo', '430.00000'],
      ['Charlie', '145.62500'],
    ],
  },
};

describe('CpsCsvPreview', () => {
  it('renders tabs and WirePreviewTable dump for CSV files', () => {
    render(
      <MantineProvider>
        <CpsCsvPreview
          fileNames={['Channels.csv', 'Zones.csv']}
          tablesByFile={{
            ...sampleTable,
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
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('RxFrequency')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('145.00000')).toBeInTheDocument();
  });

  it('filters rows client-side when using legacy table helpers is removed — shows all rows', () => {
    render(
      <MantineProvider>
        <CpsCsvPreview fileNames={['Channels.csv']} tablesByFile={sampleTable} />
      </MantineProvider>,
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Bravo')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(
      <MantineProvider>
        <CpsCsvPreview fileNames={['Channels.csv']} tablesByFile={{}} loading />
      </MantineProvider>,
    );

    expect(screen.getByText(/Generating export preview/i)).toBeInTheDocument();
  });

  it('shows error state', () => {
    render(
      <MantineProvider>
        <CpsCsvPreview fileNames={['Channels.csv']} tablesByFile={{}} error="boom" />
      </MantineProvider>,
    );

    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('shows empty export message', () => {
    render(
      <MantineProvider>
        <CpsCsvPreview fileNames={[]} tablesByFile={{}} />
      </MantineProvider>,
    );

    expect(screen.getByText(/No export files available/i)).toBeInTheDocument();
  });
});
