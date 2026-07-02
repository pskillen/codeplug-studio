import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import WirePreviewTable from './WirePreviewTable.tsx';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';

const rows: WirePreviewRow[] = [
  {
    key: 'ch-1',
    libraryEntityId: 'ch-1',
    entityKind: 'channel',
    displayLabel: 'GB3DA Demo',
    generatedWireName: 'GB3DA Demo',
    effectiveWireName: 'GB3DA Demo',
    excluded: false,
  },
  {
    key: 'ch-2',
    libraryEntityId: 'ch-2',
    entityKind: 'channel',
    displayLabel: 'Excluded channel',
    generatedWireName: 'Excluded',
    effectiveWireName: 'Excluded',
    excluded: true,
  },
];

describe('WirePreviewTable', () => {
  it('renders include toggles and wire name inputs for preview rows', () => {
    render(
      <MantineProvider>
        <WirePreviewTable
          rows={rows}
          nameLimit={16}
          onExcludedChange={vi.fn()}
          onWireNameChange={vi.fn()}
        />
      </MantineProvider>,
    );

    expect(screen.getByText('GB3DA Demo')).toBeInTheDocument();
    expect(screen.getByText('Excluded channel')).toBeInTheDocument();
    expect(screen.getByLabelText('Include GB3DA Demo')).toBeChecked();
    expect(screen.getByLabelText('Include Excluded channel')).not.toBeChecked();
  });
});
