import { Button, Group, ScrollArea, Stack, Text, TextInput } from '@mantine/core';
import { Fragment, useEffect, type ReactNode } from 'react';

export interface SelectedItemListFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  'aria-label'?: string;
}

export interface SelectedItemListRenderProps<TKey extends string> {
  itemKey: TKey;
  selected: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
}

export interface SelectedItemListProps<TKey extends string = string> {
  title: ReactNode;
  description?: ReactNode;
  filter?: SelectedItemListFilterProps;
  itemKeys: readonly TKey[];
  selectedKeys: readonly TKey[];
  onToggleSelect: (key: TKey) => void;
  onRemove: (key: TKey) => void;
  renderItem: (props: SelectedItemListRenderProps<TKey>) => ReactNode;
  emptyMessage?: string;
  maxHeight?: number;
  toolbar?: ReactNode;
  /** When set, shows built-in Move up / Move down for the current selection. */
  onMoveSelected?: (direction: 'up' | 'down') => void;
  /** When set, shows built-in Remove selected. */
  onRemoveSelected?: () => void;
  /** Hint beside built-in reorder controls (default Alt+↑/↓ text when move is enabled). */
  reorderHint?: ReactNode;
  /**
   * When true (default if `onMoveSelected` is set), Alt+ArrowUp/Down calls `onMoveSelected`.
   * Ignored when `onMoveSelected` is absent.
   */
  enableReorderHotkeys?: boolean;
  /** Optional disable flags for built-in move buttons. */
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export default function SelectedItemList<TKey extends string>({
  title,
  description,
  filter,
  itemKeys,
  selectedKeys,
  onToggleSelect,
  onRemove,
  renderItem,
  emptyMessage = 'No items',
  maxHeight = 360,
  toolbar,
  onMoveSelected,
  onRemoveSelected,
  reorderHint,
  enableReorderHotkeys,
  canMoveUp = true,
  canMoveDown = true,
}: SelectedItemListProps<TKey>) {
  const selectedSet = new Set(selectedKeys);
  const hotkeysEnabled = onMoveSelected != null && (enableReorderHotkeys ?? true);
  const showBuiltinReorder = onMoveSelected != null || onRemoveSelected != null;
  const defaultHint =
    onMoveSelected != null ? (
      <Text size="xs" c="dimmed">
        Alt+↑ / Alt+↓ reorders selection
      </Text>
    ) : null;
  const hint = reorderHint !== undefined ? reorderHint : defaultHint;

  useEffect(() => {
    if (!hotkeysEnabled || !onMoveSelected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        onMoveSelected('up');
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        onMoveSelected('down');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hotkeysEnabled, onMoveSelected]);

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Stack gap={4}>
          <Text size="sm" fw={600}>
            {title}
          </Text>
          {description ? (
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          ) : null}
        </Stack>
        {filter ? (
          <TextInput
            placeholder={filter.placeholder ?? 'Filter…'}
            value={filter.value}
            onChange={(e) => filter.onChange(e.currentTarget.value)}
            size="xs"
            maw={240}
            aria-label={filter['aria-label'] ?? 'Filter items'}
          />
        ) : null}
      </Group>

      <ScrollArea.Autosize mah={maxHeight} type="auto" offsetScrollbars>
        <Stack gap={6}>
          {itemKeys.length === 0 ? (
            <Text size="sm" c="dimmed" p="xs">
              {emptyMessage}
            </Text>
          ) : (
            itemKeys.map((itemKey) => (
              <Fragment key={itemKey}>
                {renderItem({
                  itemKey,
                  selected: selectedSet.has(itemKey),
                  onToggleSelect: () => onToggleSelect(itemKey),
                  onRemove: () => onRemove(itemKey),
                })}
              </Fragment>
            ))
          )}
        </Stack>
      </ScrollArea.Autosize>

      {showBuiltinReorder ? (
        <Group gap="xs">
          {onMoveSelected ? (
            <>
              <Button
                type="button"
                variant="default"
                size="compact-sm"
                onClick={() => onMoveSelected('up')}
                disabled={!selectedKeys.length || !canMoveUp}
              >
                Move up
              </Button>
              <Button
                type="button"
                variant="default"
                size="compact-sm"
                onClick={() => onMoveSelected('down')}
                disabled={!selectedKeys.length || !canMoveDown}
              >
                Move down
              </Button>
            </>
          ) : null}
          {onRemoveSelected ? (
            <Button
              type="button"
              variant="light"
              size="compact-sm"
              onClick={onRemoveSelected}
              disabled={!selectedKeys.length}
            >
              Remove selected
            </Button>
          ) : null}
          {hint}
        </Group>
      ) : null}

      {toolbar}
    </Stack>
  );
}
