import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import { MembershipList, MembershipPanel } from './MembershipPanel.tsx';

describe('MembershipPanel', () => {
  it('MembershipList is an alias for MembershipPanel', () => {
    expect(MembershipList).toBe(MembershipPanel);
  });

  it('omits the Add button when onAdd is not provided (reorder-only, no-pool variant)', () => {
    render(
      <DesignSystemV2Provider>
        <MembershipPanel title="Zone member order">Row content</MembershipPanel>
      </DesignSystemV2Provider>,
    );
    expect(screen.queryByRole('button', { name: /Add/ })).not.toBeInTheDocument();
  });

  it('shows the Add button and calls onAdd when provided', () => {
    const onAdd = vi.fn();
    render(
      <DesignSystemV2Provider>
        <MembershipPanel title="Zone members" addLabel="Add members" onAdd={onAdd}>
          Row content
        </MembershipPanel>
      </DesignSystemV2Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '+ Add members' }));
    expect(onAdd).toHaveBeenCalled();
  });

  it('replaces the Sort… affordance with disabled copy while filtering', () => {
    const onSortClick = vi.fn();
    const { rerender } = render(
      <DesignSystemV2Provider>
        <MembershipPanel
          title="Zone members"
          search={{ value: '', onChange: () => undefined }}
          onSortClick={onSortClick}
        >
          Row content
        </MembershipPanel>
      </DesignSystemV2Provider>,
    );
    expect(screen.getByRole('button', { name: 'Sort…' })).toBeInTheDocument();

    rerender(
      <DesignSystemV2Provider>
        <MembershipPanel
          title="Zone members"
          search={{ value: 'chan', onChange: () => undefined }}
          onSortClick={onSortClick}
        >
          Row content
        </MembershipPanel>
      </DesignSystemV2Provider>,
    );
    expect(screen.queryByRole('button', { name: 'Sort…' })).not.toBeInTheDocument();
    expect(screen.getByText('Reorder disabled while filtering')).toBeInTheDocument();
  });

  it('shows the bulk toolbar only once selectedCount > 0 and a handler is provided', () => {
    const onBulkRemove = vi.fn();
    const { rerender } = render(
      <DesignSystemV2Provider>
        <MembershipPanel title="Zone members" selectedCount={0} onBulkRemove={onBulkRemove}>
          Row content
        </MembershipPanel>
      </DesignSystemV2Provider>,
    );
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();

    rerender(
      <DesignSystemV2Provider>
        <MembershipPanel title="Zone members" selectedCount={2} onBulkRemove={onBulkRemove}>
          Row content
        </MembershipPanel>
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove selected' }));
    expect(onBulkRemove).toHaveBeenCalled();
  });

  it('shows emptyMessage instead of children when isEmpty', () => {
    render(
      <DesignSystemV2Provider>
        <MembershipPanel title="Zone members" isEmpty emptyMessage="Nothing here yet.">
          Row content
        </MembershipPanel>
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument();
    expect(screen.queryByText('Row content')).not.toBeInTheDocument();
  });
});
