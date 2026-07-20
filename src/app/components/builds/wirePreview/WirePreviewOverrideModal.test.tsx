import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import WirePreviewOverrideModal from './WirePreviewOverrideModal.tsx';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';
import type { FormatBuild } from '@core/models/formatBuild.ts';

const row: WirePreviewRow = {
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

const build = {
  id: 'build-1',
  name: 'Test build',
  formatId: 'opengd77',
  profileId: 'opengd77-md380',
} as FormatBuild;

describe('WirePreviewOverrideModal', () => {
  it('persists skip-from-export via callback', () => {
    const onExcludedChange = vi.fn();
    render(
      <MemoryRouter>
        <MantineProvider>
          <WirePreviewOverrideModal
            opened
            onClose={vi.fn()}
            row={row}
            build={build}
            entityKind="talkGroup"
            onExcludedChange={onExcludedChange}
            onWireNameChange={vi.fn()}
          />
        </MantineProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText('Skip Local 9 from export'));
    expect(onExcludedChange).toHaveBeenCalledWith(row, true);
  });

  it('reflects updated row props after persist', () => {
    const { rerender } = render(
      <MemoryRouter>
        <MantineProvider>
          <WirePreviewOverrideModal
            opened
            onClose={vi.fn()}
            row={row}
            build={build}
            entityKind="talkGroup"
            onExcludedChange={vi.fn()}
            onWireNameChange={vi.fn()}
          />
        </MantineProvider>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Skip Local 9 from export')).not.toBeChecked();

    rerender(
      <MemoryRouter>
        <MantineProvider>
          <WirePreviewOverrideModal
            opened
            onClose={vi.fn()}
            row={{ ...row, excluded: true }}
            build={build}
            entityKind="talkGroup"
            onExcludedChange={vi.fn()}
            onWireNameChange={vi.fn()}
          />
        </MantineProvider>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Skip Local 9 from export')).toBeChecked();
  });

  it('shows force export control for omitFromExport zones when handler provided', () => {
    const omitZoneRow: WirePreviewRow = {
      key: 'zone-pmr',
      libraryEntityId: 'zone-pmr',
      entityKind: 'zone',
      displayLabel: 'PMR446',
      generatedWireName: 'PMR446',
      effectiveWireName: 'PMR446',
      hasWireNameOverride: false,
      hasOrderOrSlotOverride: false,
      excluded: false,
      omitFromExport: true,
      forceInclude: false,
    };
    const onForceIncludeChange = vi.fn();
    render(
      <MemoryRouter>
        <MantineProvider>
          <WirePreviewOverrideModal
            opened
            onClose={vi.fn()}
            row={omitZoneRow}
            build={build}
            entityKind="zone"
            onExcludedChange={vi.fn()}
            onForceIncludeChange={onForceIncludeChange}
            onWireNameChange={vi.fn()}
          />
        </MantineProvider>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Force export PMR446 as its own zone')).toBeInTheDocument();
    expect(screen.queryByLabelText('Skip PMR446 from export')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Force export PMR446 as its own zone'));
    expect(onForceIncludeChange).toHaveBeenCalledWith(omitZoneRow, true);
  });

  it('shows skip toggle when omit zone is force-included', () => {
    const omitZoneRow: WirePreviewRow = {
      key: 'zone-pmr',
      libraryEntityId: 'zone-pmr',
      entityKind: 'zone',
      displayLabel: 'PMR446',
      generatedWireName: 'PMR446',
      effectiveWireName: 'PMR446',
      hasWireNameOverride: false,
      hasOrderOrSlotOverride: false,
      excluded: false,
      omitFromExport: true,
      forceInclude: true,
    };
    render(
      <MemoryRouter>
        <MantineProvider>
          <WirePreviewOverrideModal
            opened
            onClose={vi.fn()}
            row={omitZoneRow}
            build={build}
            entityKind="zone"
            onExcludedChange={vi.fn()}
            onForceIncludeChange={vi.fn()}
            onWireNameChange={vi.fn()}
          />
        </MantineProvider>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Skip PMR446 from export')).toBeInTheDocument();
  });

  it('tabs Export / Members / Scan when zone sections are provided', () => {
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
    render(
      <MemoryRouter>
        <MantineProvider>
          <WirePreviewOverrideModal
            opened
            onClose={vi.fn()}
            row={zoneRow}
            build={build}
            entityKind="zone"
            onExcludedChange={vi.fn()}
            onWireNameChange={vi.fn()}
            membersSection={<div>Members content</div>}
            scanSection={<div>Scan content</div>}
          />
        </MantineProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('tab', { name: 'Export' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Members' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Scan' })).toBeInTheDocument();
    expect(screen.getByText('Members content')).not.toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Members' }));
    expect(screen.getByText('Members content')).toBeVisible();
  });

  it('omits Scan tab when only membersSection is provided', () => {
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
    render(
      <MemoryRouter>
        <MantineProvider>
          <WirePreviewOverrideModal
            opened
            onClose={vi.fn()}
            row={zoneRow}
            build={build}
            entityKind="zone"
            onExcludedChange={vi.fn()}
            onWireNameChange={vi.fn()}
            membersSection={<div>Members only</div>}
          />
        </MantineProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('tab', { name: 'Export' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Members' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Scan' })).not.toBeInTheDocument();
  });
});
