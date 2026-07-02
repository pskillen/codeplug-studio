import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
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
    hasWireNameOverride: false,
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
    excluded: true,
  },
];

describe('WirePreviewTable', () => {
  function renderTable(props: ComponentProps<typeof WirePreviewTable>) {
    return render(
      <MemoryRouter>
        <MantineProvider>
          <WirePreviewTable {...props} />
        </MantineProvider>
      </MemoryRouter>,
    );
  }

  it('renders include toggles and wire name inputs for preview rows', () => {
    renderTable({
      rows,
      nameLimit: 16,
      onExcludedChange: vi.fn(),
      onWireNameChange: vi.fn(),
    });

    expect(screen.getByText('GB3DA Demo')).toBeInTheDocument();
    expect(screen.getByText('Excluded channel')).toBeInTheDocument();
    expect(screen.getByLabelText('Include GB3DA Demo')).toBeChecked();
    expect(screen.getByLabelText('Include Excluded channel')).not.toBeChecked();
  });

  it('links each row to the library editor', () => {
    renderTable({
      rows,
      onExcludedChange: vi.fn(),
      onWireNameChange: vi.fn(),
    });

    const links = screen.getAllByRole('link', { name: 'Edit in library' });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/library/channels/ch-1');
    expect(links[1]).toHaveAttribute('href', '/library/channels/ch-2');
  });

  it('commits wire name only when apply is clicked', () => {
    const onWireNameChange = vi.fn();
    renderTable({
      rows,
      onExcludedChange: vi.fn(),
      onWireNameChange,
    });

    const input = screen.getByPlaceholderText('GB3DA Demo');
    fireEvent.change(input, { target: { value: 'Custom' } });
    expect(onWireNameChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Apply wire name'));
    expect(onWireNameChange).toHaveBeenCalledWith(rows[0], 'Custom');
  });

  it('reverts draft wire name without persisting', () => {
    const onWireNameChange = vi.fn();
    renderTable({
      rows,
      onExcludedChange: vi.fn(),
      onWireNameChange,
    });

    const input = screen.getByPlaceholderText('GB3DA Demo');
    fireEvent.change(input, { target: { value: 'Custom' } });
    fireEvent.click(screen.getByLabelText('Revert wire name'));

    expect(onWireNameChange).not.toHaveBeenCalled();
    expect(input).toHaveValue('');
  });

  it('applies generated wire name when default label is clicked', () => {
    const onWireNameChange = vi.fn();
    renderTable({
      rows,
      clickableDefaultWireName: true,
      onExcludedChange: vi.fn(),
      onWireNameChange,
    });

    fireEvent.click(screen.getByRole('button', { name: 'GB3DA Demo' }));
    expect(onWireNameChange).toHaveBeenCalledWith(rows[0], 'GB3DA Demo');
    expect(screen.getByPlaceholderText('GB3DA Demo')).toHaveValue('GB3DA Demo');
  });

  it('reports unapplied wire name drafts', () => {
    const onUnsavedChangesChange = vi.fn();
    renderTable({
      rows,
      onExcludedChange: vi.fn(),
      onWireNameChange: vi.fn(),
      onUnsavedChangesChange,
    });

    expect(onUnsavedChangesChange).toHaveBeenCalledWith(false);

    fireEvent.change(screen.getByPlaceholderText('GB3DA Demo'), {
      target: { value: 'Custom' },
    });
    expect(onUnsavedChangesChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByLabelText('Revert wire name'));
    expect(onUnsavedChangesChange).toHaveBeenLastCalledWith(false);
  });
});
