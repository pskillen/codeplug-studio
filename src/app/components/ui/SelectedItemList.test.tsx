import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { ComponentProps } from 'react';
import SelectedItemList from './SelectedItemList.tsx';

function renderList(props: Partial<ComponentProps<typeof SelectedItemList>> = {}) {
  return render(
    <MantineProvider>
      <SelectedItemList
        title="Members"
        itemKeys={['a', 'b', 'c']}
        selectedKeys={['b']}
        onToggleSelect={() => undefined}
        onRemove={() => undefined}
        renderItem={({ itemKey }) => <div key={itemKey}>{itemKey}</div>}
        {...props}
      />
    </MantineProvider>,
  );
}

describe('SelectedItemList', () => {
  it('renders built-in move and remove when handlers are set', () => {
    const onMoveSelected = vi.fn();
    const onRemoveSelected = vi.fn();
    renderList({
      onMoveSelected,
      onRemoveSelected,
      canMoveUp: true,
      canMoveDown: true,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Move up' }));
    expect(onMoveSelected).toHaveBeenCalledWith('up');
    fireEvent.click(screen.getByRole('button', { name: 'Move down' }));
    expect(onMoveSelected).toHaveBeenCalledWith('down');
    fireEvent.click(screen.getByRole('button', { name: 'Remove selected' }));
    expect(onRemoveSelected).toHaveBeenCalled();
  });

  it('disables move when nothing is selected', () => {
    renderList({
      selectedKeys: [],
      onMoveSelected: vi.fn(),
      onRemoveSelected: vi.fn(),
    });
    expect(screen.getByRole('button', { name: 'Move up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove selected' })).toBeDisabled();
  });

  it('calls onMoveSelected on Alt+ArrowUp/Down', () => {
    const onMoveSelected = vi.fn();
    renderList({ onMoveSelected });
    fireEvent.keyDown(window, { key: 'ArrowUp', altKey: true });
    expect(onMoveSelected).toHaveBeenCalledWith('up');
    fireEvent.keyDown(window, { key: 'ArrowDown', altKey: true });
    expect(onMoveSelected).toHaveBeenCalledWith('down');
  });
});
