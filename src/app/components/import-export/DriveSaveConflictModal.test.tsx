import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { DriveSaveConflict } from '@core/services/driveSaveConflict.ts';
import DriveSaveConflictModal from './DriveSaveConflictModal.tsx';

const baseConflict: DriveSaveConflict = {
  kinds: ['remoteNewer'],
  localProjectId: 'local-id',
  remoteProjectId: 'local-id',
  remoteModifiedAt: '2026-07-09T12:00:00.000Z',
  localSyncedAt: '2026-07-09T10:00:00.000Z',
  diffLines: ['Remote: 3 channels'],
  remoteYaml: 'yaml',
};

function renderModal(
  props: Partial<React.ComponentProps<typeof DriveSaveConflictModal>> = {},
  conflict: DriveSaveConflict = baseConflict,
) {
  const onClose = vi.fn();
  const onRefreshFromDrive = vi.fn();
  const onSaveAnyway = vi.fn();
  const onSaveAsNew = vi.fn();

  render(
    <MantineProvider>
      <DriveSaveConflictModal
        opened
        projectName="Demo"
        conflict={conflict}
        onClose={onClose}
        onRefreshFromDrive={onRefreshFromDrive}
        onSaveAnyway={onSaveAnyway}
        onSaveAsNew={onSaveAsNew}
        {...props}
      />
    </MantineProvider>,
  );

  return { onClose, onRefreshFromDrive, onSaveAnyway, onSaveAsNew };
}

describe('DriveSaveConflictModal', () => {
  it('shows refresh action when remote is newer', () => {
    renderModal();

    expect(screen.getByRole('button', { name: 'Refresh from Drive' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save anyway' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save as new file' })).toBeInTheDocument();
  });

  it('hides refresh when only project id mismatches', () => {
    renderModal(
      {},
      {
        ...baseConflict,
        kinds: ['projectIdMismatch'],
        remoteProjectId: 'remote-id',
      },
    );

    expect(screen.queryByRole('button', { name: 'Refresh from Drive' })).not.toBeInTheDocument();
    expect(screen.getByText(/Local project id: local-id/)).toBeInTheDocument();
    expect(screen.getByText(/Remote project id: remote-id/)).toBeInTheDocument();
  });

  it('calls action handlers from buttons', () => {
    const { onRefreshFromDrive, onSaveAnyway, onSaveAsNew } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh from Drive' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save anyway' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save as new file' }));

    expect(onRefreshFromDrive).toHaveBeenCalledTimes(1);
    expect(onSaveAnyway).toHaveBeenCalledTimes(1);
    expect(onSaveAsNew).toHaveBeenCalledTimes(1);
  });
});
