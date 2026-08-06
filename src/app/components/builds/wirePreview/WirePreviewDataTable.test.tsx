import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { DesignSystemV2Provider } from '../../v2/index.ts';
import WirePreviewDataTable from './WirePreviewDataTable.tsx';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';
import type { ZoneGroupingLayout } from '@core/models/traitLayout.ts';

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
    displayLabel: 'Skipped channel',
    generatedWireName: 'Skipped',
    effectiveWireName: 'Skipped',
    hasWireNameOverride: false,
    hasOrderOrSlotOverride: false,
    excluded: true,
  },
];

function renderTable(props: ComponentProps<typeof WirePreviewDataTable>) {
  return render(
    <MemoryRouter>
      <MantineProvider>
        <DesignSystemV2Provider>
          <WirePreviewDataTable {...props} />
        </DesignSystemV2Provider>
      </MantineProvider>
    </MemoryRouter>,
  );
}

describe('WirePreviewDataTable', () => {
  it('renders read-only status badges without per-row inputs by default', () => {
    renderTable({ rows, onRowActivate: vi.fn() });

    expect(screen.getAllByText('GB3DA Demo').length).toBeGreaterThan(0);
    expect(screen.getByText('Skipped channel')).toBeInTheDocument();
    expect(screen.queryByLabelText('Skip GB3DA Demo from export')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getAllByText('Skipped').length).toBeGreaterThan(0);
  });

  it('renders Skip from export when inclusionColumn is set', () => {
    const onExcludedChange = vi.fn();
    renderTable({
      rows,
      onRowActivate: vi.fn(),
      inclusionColumn: { onExcludedChange },
    });

    const skip = screen.getByLabelText('Skip GB3DA Demo from export');
    fireEvent.click(skip);
    expect(onExcludedChange).toHaveBeenCalledWith(rows[0], true);
  });

  it('renders Force export for library omit zones without Skip', () => {
    const onExcludedChange = vi.fn();
    const onForceIncludeChange = vi.fn();
    const zoneRow: WirePreviewRow = {
      key: 'zone-1',
      libraryEntityId: 'zone-1',
      entityKind: 'zone',
      displayLabel: 'Nested',
      generatedWireName: 'Nested',
      effectiveWireName: 'Nested',
      hasWireNameOverride: false,
      hasOrderOrSlotOverride: false,
      omitFromExport: true,
      forceInclude: true,
      excluded: false,
    };
    renderTable({
      rows: [zoneRow],
      onRowActivate: vi.fn(),
      inclusionColumn: { onExcludedChange, onForceIncludeChange },
    });

    expect(screen.getByLabelText('Force export Nested as its own zone')).toBeChecked();
    expect(screen.queryByLabelText('Skip Nested from export')).not.toBeInTheDocument();
  });

  it('renders Force export for library omit zones', () => {
    const onExcludedChange = vi.fn();
    const onForceIncludeChange = vi.fn();
    const zoneRow: WirePreviewRow = {
      key: 'zone-1',
      libraryEntityId: 'zone-1',
      entityKind: 'zone',
      displayLabel: 'Nested',
      generatedWireName: 'Nested',
      effectiveWireName: 'Nested',
      hasWireNameOverride: false,
      hasOrderOrSlotOverride: false,
      omitFromExport: true,
      forceInclude: false,
      excluded: false,
    };
    renderTable({
      rows: [zoneRow],
      onRowActivate: vi.fn(),
      inclusionColumn: { onExcludedChange, onForceIncludeChange },
    });

    expect(screen.getByLabelText('Force export Nested as its own zone')).toBeInTheDocument();
    expect(screen.queryByLabelText('Skip Nested from export')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Force export Nested as its own zone'));
    expect(onForceIncludeChange).toHaveBeenCalledWith(zoneRow, true);
  });

  it('calls onRowActivate when a row is clicked', () => {
    const onRowActivate = vi.fn();
    renderTable({ rows, onRowActivate: onRowActivate });

    fireEvent.click(screen.getAllByText('GB3DA Demo')[0]!);
    expect(onRowActivate).toHaveBeenCalledWith(rows[0]);
  });

  it('shows expansion context in the library name column', () => {
    const expandedRows: WirePreviewRow[] = [
      {
        ...rows[0]!,
        key: 'ch-1:tg-9',
        displayDetails: [{ label: 'Talk group', value: 'Local 9 (9) · Slot 1' }],
      },
    ];
    renderTable({ rows: expandedRows, onRowActivate: vi.fn() });

    expect(screen.getAllByText('GB3DA Demo').length).toBeGreaterThan(0);
    expect(screen.getByText(/Talk group: Local 9 \(9\) · Slot 1/)).toBeInTheDocument();
    expect(screen.queryByText(/Channel:/)).not.toBeInTheDocument();
  });

  it('nests multi-projection channels under a collapsible shaded parent', () => {
    const multi: WirePreviewRow[] = [
      {
        key: 'ch-1:-F',
        libraryEntityId: 'ch-1',
        entityKind: 'channel',
        displayLabel: 'Site (FM)',
        generatedWireName: 'Site-F',
        effectiveWireName: 'Site-F',
        hasWireNameOverride: false,
        hasOrderOrSlotOverride: false,
        excluded: false,
      },
      {
        key: 'ch-1:-D',
        libraryEntityId: 'ch-1',
        entityKind: 'channel',
        displayLabel: 'Site (DMR)',
        generatedWireName: 'Site-D',
        effectiveWireName: 'Site-D',
        hasWireNameOverride: false,
        hasOrderOrSlotOverride: false,
        excluded: false,
      },
    ];
    const onRowActivate = vi.fn();
    renderTable({
      rows: multi,
      entityKind: 'channel',
      onRowActivate: onRowActivate,
      inclusionColumn: { onExcludedChange: vi.fn() },
    });

    expect(screen.getAllByText('2 projections').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Collapse projections for Site')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Collapse projections for Site'));
    expect(screen.queryByText('Site (FM)')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Expand projections for Site')).toBeInTheDocument();
    expect(onRowActivate).not.toHaveBeenCalled();
  });

  it('renders export scan list switch for zone rows when zoneScanColumn is set', () => {
    const zoneRow: WirePreviewRow = {
      key: 'zone-1',
      libraryEntityId: 'zone-1',
      entityKind: 'zone',
      displayLabel: 'Glasgow',
      generatedWireName: 'Glasgow',
      effectiveWireName: 'Glasgow',
      hasWireNameOverride: false,
      hasOrderOrSlotOverride: false,
      excluded: false,
    };
    const layout: ZoneGroupingLayout = {
      kind: 'zoneGrouping',
      zones: [{ id: 'zone-1', name: 'Glasgow', channelIds: [], exportScanList: true }],
    };
    const onExportScanListChange = vi.fn();

    renderTable({
      rows: [zoneRow],
      onRowActivate: vi.fn(),
      zoneScanColumn: { layout, saving: false, onExportScanListChange },
    });

    const toggle = screen.getByLabelText('Export Glasgow as scan list');
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(onExportScanListChange).toHaveBeenCalledWith('zone-1', false);
  });

  it('hides export scan list switch when showExportScanListForZone returns false', () => {
    const zoneRow: WirePreviewRow = {
      key: 'zone-air',
      libraryEntityId: 'zone-air',
      entityKind: 'zone',
      displayLabel: 'AM only',
      generatedWireName: 'AM only',
      effectiveWireName: 'AM only',
      hasWireNameOverride: false,
      hasOrderOrSlotOverride: false,
      excluded: false,
    };
    const layout: ZoneGroupingLayout = {
      kind: 'zoneGrouping',
      zones: [{ id: 'zone-air', name: 'AM only', channelIds: [], exportScanList: true }],
    };

    renderTable({
      rows: [zoneRow],
      onRowActivate: vi.fn(),
      zoneScanColumn: {
        layout,
        saving: false,
        onExportScanListChange: vi.fn(),
        showExportScanListForZone: (zoneId) => zoneId !== 'zone-air',
      },
    });

    expect(screen.queryByLabelText('Export AM only as scan list')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows Custom member order badge when zone member layout order is overridden', () => {
    const zoneRow: WirePreviewRow = {
      key: 'zone-1',
      libraryEntityId: 'zone-1',
      entityKind: 'zone',
      displayLabel: 'Glasgow',
      generatedWireName: 'Glasgow',
      effectiveWireName: 'Glasgow',
      hasWireNameOverride: false,
      hasOrderOrSlotOverride: false,
      hasMemberOrderOverride: true,
      excluded: false,
    };

    renderTable({ rows: [zoneRow], onRowActivate: vi.fn() });

    expect(screen.getByText('Custom member order')).toBeInTheDocument();
  });

  it('does not show Custom member order for zone list orderOrSlot alone', () => {
    const zoneRow: WirePreviewRow = {
      key: 'zone-1',
      libraryEntityId: 'zone-1',
      entityKind: 'zone',
      displayLabel: 'Glasgow',
      generatedWireName: 'Glasgow',
      effectiveWireName: 'Glasgow',
      hasWireNameOverride: false,
      hasOrderOrSlotOverride: true,
      hasMemberOrderOverride: false,
      excluded: false,
    };

    renderTable({
      rows: [zoneRow],
      onRowActivate: vi.fn(),
      reorder: {
        orderedKeys: ['zone-1'],
        onMove: vi.fn(),
        onSetOrder: vi.fn(),
      },
    });

    expect(screen.queryByText('Custom member order')).not.toBeInTheDocument();
    expect(screen.queryByText('Custom order')).not.toBeInTheDocument();
  });
});
