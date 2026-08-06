import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { DriveSaveConflict } from '@core/services/driveSaveConflict.ts';
import DriveSaveConflictModal from './DriveSaveConflictModal.tsx';
import { testProjectSyncDiff } from './testProjectSyncDiff.ts';

const baseConflict: DriveSaveConflict = {
  kinds: ['remoteNewer'],
  localProjectId: 'local-id',
  remoteProjectId: 'local-id',
  remoteModifiedAt: '2026-07-09T12:00:00.000Z',
  localSyncedAt: '2026-07-09T10:00:00.000Z',
  diff: testProjectSyncDiff({}, { counts: { channels: 3 } }),
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
  it('shows dual-card keep actions when remote is newer', () => {
    renderModal();

    expect(screen.getByRole('button', { name: 'Keep Drive version' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep this version' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save as new file instead' })).toBeInTheDocument();
    expect(screen.getByText(/What's changed in the Drive version/i)).toBeInTheDocument();
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
    expect(screen.getByText(/belongs to a different project/i)).toBeInTheDocument();
  });

  it('calls action handlers from buttons', () => {
    const { onRefreshFromDrive, onSaveAnyway, onSaveAsNew } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Keep Drive version' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep this version' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save as new file instead' }));

    expect(onRefreshFromDrive).toHaveBeenCalledTimes(1);
    expect(onSaveAnyway).toHaveBeenCalledTimes(1);
    expect(onSaveAsNew).toHaveBeenCalledTimes(1);
  });
});
