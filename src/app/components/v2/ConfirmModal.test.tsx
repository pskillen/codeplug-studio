import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ConfirmModal from './ConfirmModal.tsx';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';

describe('ConfirmModal', () => {
  it('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <DesignSystemV2Provider>
        <ConfirmModal open onClose={() => undefined} onConfirm={onConfirm} title="Delete zone?">
          This cannot be undone.
        </ConfirmModal>
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('shows Working… and disables both buttons while busy', () => {
    render(
      <DesignSystemV2Provider>
        <ConfirmModal
          open
          onClose={() => undefined}
          onConfirm={() => undefined}
          title="Delete zone?"
          busy
        >
          This cannot be undone.
        </ConfirmModal>
      </DesignSystemV2Provider>,
    );

    const confirmButton = screen.getByRole('button', { name: 'Working…' });
    expect(confirmButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('hides the dismiss close button while busy', () => {
    render(
      <DesignSystemV2Provider>
        <ConfirmModal
          open
          onClose={() => undefined}
          onConfirm={() => undefined}
          title="Delete zone?"
          busy
        >
          This cannot be undone.
        </ConfirmModal>
      </DesignSystemV2Provider>,
    );

    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('destructive tone uses the destructive confirm button variant', () => {
    render(
      <DesignSystemV2Provider>
        <ConfirmModal
          open
          onClose={() => undefined}
          onConfirm={() => undefined}
          title="Delete zone?"
          tone="destructive"
        >
          This cannot be undone.
        </ConfirmModal>
      </DesignSystemV2Provider>,
    );

    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveAttribute(
      'data-variant',
      'destructive',
    );
  });
});
