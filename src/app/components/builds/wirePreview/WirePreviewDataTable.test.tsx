import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import WirePreviewDataTable from './WirePreviewDataTable.tsx';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';

const rows: WirePreviewRow[] = [
  {
    key: 'ch-1',
    libraryEntityId: 'ch-1',
    entityKind: 'channel',
    displayLabel: 'GB3DA Demo',
    generatedWireName: 'GB3DA Demo',
    effectiveWireName: 'GB3DA Demo',
    hasWireNameOverride: false,
    excluded: false,
  },
  {
    key: 'ch-2',
    libraryEntityId: 'ch-2',
    entityKind: 'channel',
    displayLabel: 'Skipped channel',
    generatedWireName: 'Skipped',
    effectiveWireName: 'Skipped',
    hasWireNameOverride: false,
    excluded: true,
  },
];

describe('WirePreviewDataTable', () => {
  it('renders read-only status badges without per-row inputs', () => {
    render(
      <MemoryRouter>
        <MantineProvider>
          <WirePreviewDataTable rows={rows} onRowActivate={vi.fn()} />
        </MantineProvider>
      </MemoryRouter>,
    );

    expect(screen.getAllByText('GB3DA Demo').length).toBeGreaterThan(0);
    expect(screen.getByText('Skipped channel')).toBeInTheDocument();
    expect(screen.queryByLabelText('Skip GB3DA Demo from export')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getAllByText('Skipped').length).toBeGreaterThan(0);
  });

  it('calls onRowActivate when a row is clicked', () => {
    const onRowActivate = vi.fn();
    render(
      <MemoryRouter>
        <MantineProvider>
          <WirePreviewDataTable rows={rows} onRowActivate={onRowActivate} />
        </MantineProvider>
      </MemoryRouter>,
    );

    const nameCells = screen.getAllByText('GB3DA Demo');
    fireEvent.click(nameCells[0]!);
    expect(onRowActivate).toHaveBeenCalledWith(rows[0]);
  });
});
