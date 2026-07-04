import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
  it('renders tabs and table headers from parsed CSV tables', () => {
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
    expect(screen.getByRole('columnheader', { name: /Name/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /RxFrequency/ })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '145.00000' })).toBeInTheDocument();
  });

  it('filters rows by column text', () => {
    render(
      <MantineProvider>
        <CpsCsvPreview fileNames={['Channels.csv']} tablesByFile={sampleTable} />
      </MantineProvider>,
    );

    fireEvent.change(screen.getByLabelText('Filter RxFrequency'), {
      target: { value: '430' },
    });

    expect(screen.getByRole('cell', { name: 'Bravo' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Alpha' })).not.toBeInTheDocument();
    expect(screen.getByText(/Showing 1 of 3 rows/)).toBeInTheDocument();
  });

  it('sorts rows when a column header is clicked', () => {
    render(
      <MantineProvider>
        <CpsCsvPreview fileNames={['Channels.csv']} tablesByFile={sampleTable} />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Name/ }));

    const names = screen.getAllByRole('cell', { name: /^(Alpha|Bravo|Charlie)$/ });
    expect(names.map((cell) => cell.textContent)).toEqual(['Alpha', 'Bravo', 'Charlie']);
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
