import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { DesignSystemV2Provider } from '../../v2/index.ts';
import WirePreviewOverrideModal from './WirePreviewOverrideModal.tsx';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';

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
  ...newRadioBuildForProfile('project-1', 'opengd77-1701').build,
  id: 'build-1',
  name: 'Test build',
};

function renderModal(props: ComponentProps<typeof WirePreviewOverrideModal>) {
  return render(
    <MemoryRouter>
      <MantineProvider>
        <DesignSystemV2Provider>
          <WirePreviewOverrideModal {...props} />
        </DesignSystemV2Provider>
      </MantineProvider>
    </MemoryRouter>,
  );
}

function rerenderModal(
  rerender: ReturnType<typeof render>['rerender'],
  props: ComponentProps<typeof WirePreviewOverrideModal>,
) {
  rerender(
    <MemoryRouter>
      <MantineProvider>
        <DesignSystemV2Provider>
          <WirePreviewOverrideModal {...props} />
        </DesignSystemV2Provider>
      </MantineProvider>
    </MemoryRouter>,
  );
}

describe('WirePreviewOverrideModal', () => {
  it('persists skip-from-export via callback', () => {
    const onExcludedChange = vi.fn();
    renderModal({
      opened: true,
      onClose: vi.fn(),
      row,
      build,
      entityKind: 'talkGroup',
      onExcludedChange,
      onWireNameChange: vi.fn(),
    });

    fireEvent.click(screen.getByLabelText('Skip Local 9 from export'));
    expect(onExcludedChange).toHaveBeenCalledWith(row, true);
  });

  it('reflects updated row props after persist', () => {
    const { rerender } = renderModal({
      opened: true,
      onClose: vi.fn(),
      row,
      build,
      entityKind: 'talkGroup',
      onExcludedChange: vi.fn(),
      onWireNameChange: vi.fn(),
    });

    expect(screen.getByLabelText('Skip Local 9 from export')).not.toBeChecked();

    rerenderModal(rerender, {
      opened: true,
      onClose: vi.fn(),
      row: { ...row, excluded: true },
      build,
      entityKind: 'talkGroup',
      onExcludedChange: vi.fn(),
      onWireNameChange: vi.fn(),
    });

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
    renderModal({
      opened: true,
      onClose: vi.fn(),
      row: omitZoneRow,
      build,
      entityKind: 'zone',
      onExcludedChange: vi.fn(),
      onForceIncludeChange: onForceIncludeChange,
      onWireNameChange: vi.fn(),
    });

    expect(screen.getByLabelText('Force export PMR446 as its own zone')).toBeInTheDocument();
    expect(screen.queryByLabelText('Skip PMR446 from export')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Force export PMR446 as its own zone'));
    expect(onForceIncludeChange).toHaveBeenCalledWith(omitZoneRow, true);
  });

  it('does not show skip when omit zone is force-included', () => {
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
    renderModal({
      opened: true,
      onClose: vi.fn(),
      row: omitZoneRow,
      build,
      entityKind: 'zone',
      onExcludedChange: vi.fn(),
      onForceIncludeChange: vi.fn(),
      onWireNameChange: vi.fn(),
    });

    expect(screen.getByLabelText('Force export PMR446 as its own zone')).toBeChecked();
    expect(screen.queryByLabelText('Skip PMR446 from export')).not.toBeInTheDocument();
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
    renderModal({
      opened: true,
      onClose: vi.fn(),
      row: zoneRow,
      build,
      entityKind: 'zone',
      onExcludedChange: vi.fn(),
      onWireNameChange: vi.fn(),
      membersSection: <div>Members content</div>,
      scanSection: <div>Scan content</div>,
    });

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
    renderModal({
      opened: true,
      onClose: vi.fn(),
      row: zoneRow,
      build,
      entityKind: 'zone',
      onExcludedChange: vi.fn(),
      onWireNameChange: vi.fn(),
      membersSection: <div>Members only</div>,
    });

    expect(screen.getByRole('tab', { name: 'Export' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Members' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Scan' })).not.toBeInTheDocument();
  });
});
