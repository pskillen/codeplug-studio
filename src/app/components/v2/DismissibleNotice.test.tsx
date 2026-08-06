import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import DismissibleNotice from './DismissibleNotice.tsx';

describe('DismissibleNotice', () => {
  it('renders the message and an optional action', () => {
    const onActionClick = vi.fn();
    render(
      <DesignSystemV2Provider>
        <DismissibleNotice action={{ label: 'Reconnect', onClick: onActionClick }}>
          Drive session expired.
        </DismissibleNotice>
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('Drive session expired.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Reconnect'));
    expect(onActionClick).toHaveBeenCalled();
  });

  it('renders null and calls onDismiss once dismissed, with no re-show', () => {
    const onDismiss = vi.fn();
    render(
      <DesignSystemV2Provider>
        <DismissibleNotice onDismiss={onDismiss}>
          3 channels missing a talk group.
        </DismissibleNotice>
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('3 channels missing a talk group.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalled();
    expect(screen.queryByText('3 channels missing a talk group.')).not.toBeInTheDocument();
  });

  it('defaults to warning tone', () => {
    const { container } = render(
      <DesignSystemV2Provider>
        <DismissibleNotice>Note</DismissibleNotice>
      </DesignSystemV2Provider>,
    );
    expect(container.querySelector('[data-tone="warning"]')).toBeTruthy();
  });
});
