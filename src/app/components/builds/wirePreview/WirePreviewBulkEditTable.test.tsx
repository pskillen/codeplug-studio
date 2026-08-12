import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import DesignSystemV2Provider from '../../v2/DesignSystemV2Provider.tsx';
import WirePreviewBulkEditTable from './WirePreviewBulkEditTable.tsx';
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
    hasOrderOrSlotOverride: false,
    excluded: false,
  },
  {
    key: 'ch-2',
    libraryEntityId: 'ch-2',
    entityKind: 'channel',
    displayLabel: 'Excluded channel',
    generatedWireName: 'Excluded',
    effectiveWireName: 'Excluded',
    hasWireNameOverride: false,
    hasOrderOrSlotOverride: false,
    excluded: true,
  },
];

describe('WirePreviewBulkEditTable', () => {
  function renderTable(props: ComponentProps<typeof WirePreviewBulkEditTable>) {
    return render(
      <MemoryRouter>
        <MantineProvider>
          <DesignSystemV2Provider>
            <WirePreviewBulkEditTable {...props} />
          </DesignSystemV2Provider>
        </MantineProvider>
      </MemoryRouter>,
    );
  }

  it('renders skip-from-export toggles and wire name inputs for preview rows', () => {
    renderTable({
      rows,
      nameLimit: 16,
      onExcludedChange: vi.fn(),
    });

    expect(screen.getByRole('columnheader', { name: 'Skip from export' })).toBeInTheDocument();
    expect(screen.getAllByText('GB3DA Demo').length).toBeGreaterThan(0);
    expect(screen.getByText('Excluded channel')).toBeInTheDocument();
    expect(screen.getByLabelText('Skip GB3DA Demo from export')).not.toBeChecked();
    expect(screen.getByLabelText('Skip Excluded channel from export')).toBeChecked();
  });

  it('calls onExcludedChange with skip state when toggle changes', () => {
    const onExcludedChange = vi.fn();
    renderTable({
      rows: [rows[0]!],
      onExcludedChange,
    });

    fireEvent.click(screen.getByLabelText('Skip GB3DA Demo from export'));
    expect(onExcludedChange).toHaveBeenCalledWith(rows[0], true);
  });

  it('links each row to the library editor', () => {
    renderTable({
      rows,
      onExcludedChange: vi.fn(),
    });

    const links = screen.getAllByRole('link', { name: 'Edit in library' });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/library/channels/ch-1');
    expect(links[1]).toHaveAttribute('href', '/library/channels/ch-2');
  });

  it('accumulates pending wire names without a per-row Apply control', () => {
    const onPendingWireNamesChange = vi.fn();
    renderTable({
      rows,
      onExcludedChange: vi.fn(),
      onPendingWireNamesChange,
    });

    expect(screen.queryByLabelText('Apply wire name')).not.toBeInTheDocument();

    const input = screen.getByPlaceholderText('GB3DA Demo');
    fireEvent.change(input, { target: { value: 'Custom' } });

    const pending = onPendingWireNamesChange.mock.calls.at(-1)?.[0] as Map<string, string>;
    expect(pending.get('ch-1')).toBe('Custom');
    expect(screen.queryByLabelText('Apply wire name')).not.toBeInTheDocument();
  });

  it('fills the draft from Default without committing a pending override when unchanged from generated', () => {
    const onPendingWireNamesChange = vi.fn();
    renderTable({
      rows,
      onExcludedChange: vi.fn(),
      onPendingWireNamesChange,
    });

    fireEvent.click(screen.getByRole('button', { name: 'GB3DA Demo' }));
    expect(screen.getByPlaceholderText('GB3DA Demo')).toHaveValue('GB3DA Demo');
    const pending = onPendingWireNamesChange.mock.calls.at(-1)?.[0] as Map<string, string>;
    // No override committed yet; draft equals generated while committed is '' → pending
    expect(pending.get('ch-1')).toBe('GB3DA Demo');
  });

  it('reports unapplied wire name drafts and clears them on draftEpoch bump', () => {
    const onUnsavedChangesChange = vi.fn();
    const onPendingWireNamesChange = vi.fn();
    const { rerender } = renderTable({
      rows,
      onExcludedChange: vi.fn(),
      onPendingWireNamesChange,
      onUnsavedChangesChange,
      draftEpoch: 0,
    });

    expect(onUnsavedChangesChange).toHaveBeenCalledWith(false);

    fireEvent.change(screen.getByPlaceholderText('GB3DA Demo'), {
      target: { value: 'Custom' },
    });
    expect(onUnsavedChangesChange).toHaveBeenLastCalledWith(true);

    rerender(
      <MemoryRouter>
        <MantineProvider>
          <DesignSystemV2Provider>
            <WirePreviewBulkEditTable
              rows={rows}
              onExcludedChange={vi.fn()}
              onPendingWireNamesChange={onPendingWireNamesChange}
              onUnsavedChangesChange={onUnsavedChangesChange}
              draftEpoch={1}
            />
          </DesignSystemV2Provider>
        </MantineProvider>
      </MemoryRouter>,
    );

    expect(onUnsavedChangesChange).toHaveBeenLastCalledWith(false);
    const pending = onPendingWireNamesChange.mock.calls.at(-1)?.[0] as Map<string, string>;
    expect(pending.size).toBe(0);
  });
});
