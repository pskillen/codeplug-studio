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

  it('calls onMoveItem from per-row move buttons via render props', () => {
    const onMoveItem = vi.fn();
    render(
      <MantineProvider>
        <SelectedItemList
          title="Members"
          itemKeys={['a', 'b', 'c']}
          selectedKeys={[]}
          onToggleSelect={() => undefined}
          onRemove={() => undefined}
          onMoveItem={onMoveItem}
          renderItem={({ itemKey, rowMove }) => (
            <div key={itemKey}>
              <span>{itemKey}</span>
              {rowMove ? (
                <>
                  <button type="button" onClick={rowMove.onMoveUp} disabled={!rowMove.canMoveUp}>
                    Up {itemKey}
                  </button>
                  <button
                    type="button"
                    onClick={rowMove.onMoveDown}
                    disabled={!rowMove.canMoveDown}
                  >
                    Down {itemKey}
                  </button>
                </>
              ) : null}
            </div>
          )}
        />
      </MantineProvider>,
    );

    expect(screen.getByRole('button', { name: 'Up a' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Down a' }));
    expect(onMoveItem).toHaveBeenCalledWith('a', 'down');
    fireEvent.click(screen.getByRole('button', { name: 'Up b' }));
    expect(onMoveItem).toHaveBeenCalledWith('b', 'up');
  });
});
