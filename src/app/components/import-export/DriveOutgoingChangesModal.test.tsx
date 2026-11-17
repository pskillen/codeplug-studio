import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { DriveOutgoingReview } from '../../services/driveOutgoingReviewService.ts';
import DriveOutgoingChangesModal from './DriveOutgoingChangesModal.tsx';

const review: DriveOutgoingReview = {
  entityChanges: [
    { kind: 'channels', id: 'c1', name: 'GB3DA', change: 'added' },
    { kind: 'zones', id: 'z1', name: 'Old zone', change: 'removed' },
  ],
  changedCounts: [],
  countSummary: '+1 channel, -1 zone',
  remoteModifiedAt: '2026-07-09T09:00:00.000Z',
  conflictKinds: [],
};

function renderModal(overrides: Partial<React.ComponentProps<typeof DriveOutgoingChangesModal>>) {
  const props = {
    opened: true,
    projectName: 'Demo',
    fileName: 'demo.yaml',
    review,
    onClose: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  };
  render(
    <MantineProvider>
      <DriveOutgoingChangesModal {...props} />
    </MantineProvider>,
  );
  return props;
}

describe('DriveOutgoingChangesModal', () => {
  it('lists what Drive will gain and lose', () => {
    renderModal({});
    expect(screen.getByText(/GB3DA/)).toBeInTheDocument();
    expect(screen.getByText('Added')).toBeInTheDocument();
    expect(screen.getByText(/Old zone/)).toBeInTheDocument();
    expect(screen.getByText('Removed')).toBeInTheDocument();
    expect(screen.getByText(/\+1 channel, -1 zone/)).toBeInTheDocument();
  });

  it('says so when only timestamps differ', () => {
    renderModal({ review: { ...review, entityChanges: [], countSummary: '' } });
    expect(screen.getByText(/only timestamps differ/)).toBeInTheDocument();
  });

  it('warns when Drive is newer or belongs to another project', () => {
    renderModal({
      review: { ...review, conflictKinds: ['remoteNewer', 'projectIdMismatch'] },
    });
    expect(screen.getByText(/Drive has a newer version/)).toBeInTheDocument();
    expect(screen.getByText(/different project/)).toBeInTheDocument();
  });

  it('Close does not save; Save to Drive does', () => {
    const props = renderModal({});
    // The modal chrome has its own X; the footer button is the last Close.
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
    expect(props.onClose).toHaveBeenCalled();
    expect(props.onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save to Drive' }));
    expect(props.onSave).toHaveBeenCalled();
  });
});
