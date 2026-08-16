import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { DesignSystemV2Provider } from '../../v2/index.ts';
import WirePreviewDataTable from './WirePreviewDataTable.tsx';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';
import type { ZoneGroupingLayout } from '@core/models/traitLayout.ts';
import type { Channel } from '@core/models/library.ts';

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

  it('edits the export name inline via the pencil when onWireNameChange is set (#1217)', () => {
    const onWireNameChange = vi.fn();
    renderTable({
      rows: [rows[0]!],
      onRowActivate: vi.fn(),
      onWireNameChange,
      nameLimit: 16,
    });

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Edit export name'));
    const input = screen.getByPlaceholderText('GB3DA Demo');
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Custom name' } });
    fireEvent.click(screen.getByLabelText('Save wire name'));
    expect(onWireNameChange).toHaveBeenCalledWith(rows[0], 'Custom name');
  });

  it('does not open the row-activate modal when the pencil is clicked', () => {
    const onRowActivate = vi.fn();
    renderTable({
      rows: [rows[0]!],
      onRowActivate,
      onWireNameChange: vi.fn(),
    });

    fireEvent.click(screen.getByLabelText('Edit export name'));
    expect(onRowActivate).not.toHaveBeenCalled();
  });

  it('shows a remediation marker driven by row.remediation, not a truncation flag', () => {
    const truncatedRow: WirePreviewRow = {
      ...rows[0]!,
      key: 'ch-truncated',
      hasWireNameOverride: true,
      remediation: 'truncated',
    };
    renderTable({
      rows: [truncatedRow],
      onRowActivate: vi.fn(),
      onWireNameChange: vi.fn(),
      nameLimit: 16,
    });

    expect(screen.getByLabelText('Name truncated')).toBeInTheDocument();
  });

  it('shows a dimmed marker (not the orange triangle) for a clean shorten', () => {
    const shortenedRow: WirePreviewRow = {
      ...rows[0]!,
      key: 'ch-shortened',
      remediation: 'shortened',
    };
    renderTable({
      rows: [shortenedRow],
      onRowActivate: vi.fn(),
      onWireNameChange: vi.fn(),
      nameLimit: 16,
    });

    expect(screen.getByLabelText('Name shortened')).toBeInTheDocument();
    expect(screen.queryByLabelText('Name truncated')).not.toBeInTheDocument();
  });

  it('shows a Mode column badge for channel rows with channelMode set', () => {
    const dmrRow: WirePreviewRow = { ...rows[0]!, key: 'ch-dmr', channelMode: 'dmr' };
    const fmRow: WirePreviewRow = { ...rows[1]!, key: 'ch-fm', channelMode: 'fm', excluded: false };
    renderTable({
      rows: [dmrRow, fmRow],
      entityKind: 'channel',
      onRowActivate: vi.fn(),
    });

    expect(screen.getByText('DMR')).toBeInTheDocument();
    expect(screen.getByText('FM')).toBeInTheDocument();
  });

  it('does not show a Mode column for non-channel entity kinds', () => {
    const talkGroupRow: WirePreviewRow = {
      key: 'tg-1',
      libraryEntityId: 'tg-1',
      entityKind: 'talkGroup',
      displayLabel: 'Local 9',
      generatedWireName: 'Local 9',
      effectiveWireName: 'Local 9',
      hasWireNameOverride: false,
      hasOrderOrSlotOverride: false,
      excluded: false,
    };
    renderTable({
      rows: [talkGroupRow],
      entityKind: 'talkGroup',
      onRowActivate: vi.fn(),
    });

    expect(screen.queryByRole('columnheader', { name: 'Mode' })).not.toBeInTheDocument();
  });

  it('offers one suggestion per ChannelExportNameMode for channel rows when channelsById is set (ux-proposal §6a)', () => {
    const channel = {
      id: 'ch-1',
      callsign: 'MM9PDY',
      name: 'Demo Repeater',
      abbreviation: undefined,
    } as unknown as Channel;
    renderTable({
      rows: [rows[0]!],
      onRowActivate: vi.fn(),
      onWireNameChange: vi.fn(),
      channelsById: new Map([['ch-1', channel]]),
      nameLimit: 16,
    });

    fireEvent.click(screen.getByLabelText('Edit export name'));
    expect(screen.getByText(/Callsign \+ name:/)).toBeInTheDocument();
    expect(screen.getByText(/Callsign only:/)).toBeInTheDocument();
    expect(screen.getByText(/Name only:/)).toBeInTheDocument();
    expect(screen.getByText(/Callsign suffix \+ name:/)).toBeInTheDocument();
  });

  it('offers exactly one suggestion for non-channel kinds even with no style data', () => {
    const talkGroupRow: WirePreviewRow = {
      key: 'tg-1',
      libraryEntityId: 'tg-1',
      entityKind: 'talkGroup',
      displayLabel: 'Local 9',
      generatedWireName: 'Local 9',
      effectiveWireName: 'Local 9',
      hasWireNameOverride: false,
      hasOrderOrSlotOverride: false,
      excluded: false,
    };
    renderTable({
      rows: [talkGroupRow],
      entityKind: 'talkGroup',
      onRowActivate: vi.fn(),
      onWireNameChange: vi.fn(),
    });

    fireEvent.click(screen.getByLabelText('Edit export name'));
    expect(screen.getByText('Suggestion:')).toBeInTheDocument();
    expect(screen.queryByText(/Callsign/)).not.toBeInTheDocument();
  });
});
