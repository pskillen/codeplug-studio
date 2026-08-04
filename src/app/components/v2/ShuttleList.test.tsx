import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import { ShuttleAddBar, ShuttleListPanel, ShuttlePoolHeader, ShuttleRow } from './ShuttleList.tsx';

describe('ShuttleList family', () => {
  it('renders a member panel with ShuttleRow via SelectedItemList', () => {
    const onRemove = vi.fn();
    render(
      <DesignSystemV2Provider>
        <ShuttleListPanel
          title="In this zone"
          itemKeys={['a']}
          selectedKeys={[]}
          onToggleSelect={() => undefined}
          onRemove={onRemove}
          onReorder={() => undefined}
          renderItem={({ itemKey, selected, onToggleSelect, onRemove: remove, dragHandle }) => (
            <ShuttleRow
              key={itemKey}
              label={`Channel ${itemKey}`}
              subtitle="145.500"
              selected={selected}
              onToggleSelect={onToggleSelect}
              onRemove={remove}
              dragHandle={dragHandle}
            />
          )}
        />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('In this zone')).toBeInTheDocument();
    expect(screen.getByText('Channel a')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Drag to reorder' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Channel a' }));
    expect(onRemove).toHaveBeenCalledWith('a');
  });

  it('renders pool header and add bar', () => {
    const onAdd = vi.fn();
    render(
      <DesignSystemV2Provider>
        <ShuttlePoolHeader title="Available" count={4} />
        <ShuttleAddBar onAdd={onAdd} selectedCount={2} />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add selected (2)' }));
    expect(onAdd).toHaveBeenCalledOnce();
  });
});
