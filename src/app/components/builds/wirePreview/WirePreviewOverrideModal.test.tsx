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
});
