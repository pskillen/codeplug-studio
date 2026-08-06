import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AddMembersScreen from './AddMembersScreen.tsx';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';

describe('AddMembersScreen', () => {
  it('renders nothing when closed', () => {
    render(
      <DesignSystemV2Provider>
        <AddMembersScreen
          open={false}
          title="Add members"
          onCancel={() => undefined}
          totalStaged={0}
          onCommit={() => undefined}
        >
          Pool rows
        </AddMembersScreen>
      </DesignSystemV2Provider>,
    );
    expect(screen.queryByText('Add members')).not.toBeInTheDocument();
  });

  it('renders children and calls onCancel', () => {
    const onCancel = vi.fn();
    render(
      <DesignSystemV2Provider>
        <AddMembersScreen
          open
          title="Add members"
          onCancel={onCancel}
          totalStaged={0}
          onCommit={() => undefined}
        >
          Pool rows
        </AddMembersScreen>
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('Pool rows')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('disables "Add selected" at zero staged and enables/calls onCommit once staged', () => {
    const onCommit = vi.fn();
    const { rerender } = render(
      <DesignSystemV2Provider>
        <AddMembersScreen
          open
          title="Add members"
          onCancel={() => undefined}
          totalStaged={0}
          onCommit={onCommit}
        />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByRole('button', { name: 'Add selected (0)' })).toBeDisabled();

    rerender(
      <DesignSystemV2Provider>
        <AddMembersScreen
          open
          title="Add members"
          onCancel={() => undefined}
          totalStaged={2}
          onCommit={onCommit}
        />
      </DesignSystemV2Provider>,
    );
    const commitButton = screen.getByRole('button', { name: 'Add selected (2)' });
    expect(commitButton).not.toBeDisabled();
    fireEvent.click(commitButton);
    expect(onCommit).toHaveBeenCalled();
  });

  it('renders section tabs only when more than one section, and switches on click', () => {
    const onSectionChange = vi.fn();
    const { rerender } = render(
      <DesignSystemV2Provider>
        <AddMembersScreen
          open
          title="Add members"
          onCancel={() => undefined}
          totalStaged={0}
          onCommit={() => undefined}
          sections={[{ id: 'channels', label: 'Channels', count: 12 }]}
        />
      </DesignSystemV2Provider>,
    );
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();

    rerender(
      <DesignSystemV2Provider>
        <AddMembersScreen
          open
          title="Add members"
          onCancel={() => undefined}
          totalStaged={0}
          onCommit={() => undefined}
          sections={[
            { id: 'channels', label: 'Channels', count: 12 },
            { id: 'zones', label: 'Zones', count: 3 },
          ]}
          activeSectionId="channels"
          onSectionChange={onSectionChange}
        />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Zones/ }));
    expect(onSectionChange).toHaveBeenCalledWith('zones');
  });
});
