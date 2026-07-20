import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Group, ScrollArea, Stack, Text, TextInput } from '@mantine/core';
import { Fragment, useCallback, useEffect, type CSSProperties, type ReactNode } from 'react';
import type { SelectedItemDragHandleProps } from './SelectedItemDragHandle.tsx';
import type { SelectedItemRowMoveProps } from './SelectedItemRowMoveButtons.tsx';

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
  /**
   * When {@link SelectedItemListProps.onReorder} is set, wire this to
   * {@link SelectedItemDragHandle}. `null` when drag is disabled (e.g. filter active).
   */
  dragHandle: SelectedItemDragHandleProps | null;
  /**
   * When {@link SelectedItemListProps.onMoveItem} is set, wire this to
   * {@link SelectedItemRowMoveButtons}. `null` when move is disabled.
   */
  rowMove: SelectedItemRowMoveProps | null;
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
  /**
   * When set, `renderItem` receives `rowMove` for per-row up/down arrows
   * ({@link SelectedItemRowMoveButtons}). Disabled while `reorderDisabled`.
   */
  onMoveItem?: (key: TKey, direction: 'up' | 'down') => void;
  /** When set, shows built-in Remove selected. */
  onRemoveSelected?: () => void;
  /**
   * Drag-and-drop reorder (role C reorder mode). Receives the full `itemKeys`
   * array after a drop. Disabled when `reorderDisabled` is true.
   */
  onReorder?: (orderedKeys: TKey[]) => void;
  /** Disable drag handles (e.g. while a find-in-list filter is active). */
  reorderDisabled?: boolean;
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

function SortableSelectedItem<TKey extends string>({
  itemKey,
  dragDisabled,
  children,
}: {
  itemKey: TKey;
  dragDisabled: boolean;
  children: (dragHandle: SelectedItemDragHandleProps | null) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: itemKey, disabled: dragDisabled });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
    position: 'relative',
    zIndex: isDragging ? 1 : undefined,
  };

  const dragHandle: SelectedItemDragHandleProps | null = dragDisabled
    ? null
    : {
        setActivatorNodeRef,
        attributes,
        listeners,
        disabled: false,
      };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid="selected-item-row"
      data-dragging={isDragging || undefined}
    >
      {children(dragHandle)}
    </div>
  );
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
  onMoveItem,
  onRemoveSelected,
  onReorder,
  reorderDisabled = false,
  reorderHint,
  enableReorderHotkeys,
  canMoveUp = true,
  canMoveDown = true,
}: SelectedItemListProps<TKey>) {
  const selectedSet = new Set(selectedKeys);
  const hotkeysEnabled = onMoveSelected != null && (enableReorderHotkeys ?? true);
  const showBuiltinReorder = onMoveSelected != null || onRemoveSelected != null;
  const dragEnabled = onReorder != null && !reorderDisabled;
  const rowMoveEnabled = onMoveItem != null && !reorderDisabled;
  const defaultHint =
    onMoveSelected != null || onReorder != null || onMoveItem != null ? (
      <Text size="xs" c="dimmed">
        {reorderDisabled
          ? 'Clear filter to reorder'
          : onReorder != null && rowMoveEnabled
            ? 'Drag handles or row arrows reorder · Alt+↑/↓ moves selection'
            : onReorder != null
              ? 'Drag handles reorder · Alt+↑/↓ moves selection'
              : rowMoveEnabled && onMoveSelected != null
                ? 'Row arrows reorder · Alt+↑/↓ moves selection'
                : rowMoveEnabled
                  ? 'Row arrows reorder one channel at a time'
                  : onMoveSelected != null
                    ? 'Alt+↑ / Alt+↓ reorders selection'
                    : 'Clear filter to reorder'}
      </Text>
    ) : null;
  const hint = reorderHint !== undefined ? reorderHint : defaultHint;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!onReorder || reorderDisabled) return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = itemKeys.indexOf(active.id as TKey);
      const newIndex = itemKeys.indexOf(over.id as TKey);
      if (oldIndex < 0 || newIndex < 0) return;
      onReorder(arrayMove([...itemKeys], oldIndex, newIndex));
    },
    [itemKeys, onReorder, reorderDisabled],
  );

  const rowMoveFor = useCallback(
    (itemKey: TKey): SelectedItemRowMoveProps | null => {
      if (!rowMoveEnabled || !onMoveItem) return null;
      const index = itemKeys.indexOf(itemKey);
      return {
        canMoveUp: index > 0,
        canMoveDown: index >= 0 && index < itemKeys.length - 1,
        onMoveUp: () => onMoveItem(itemKey, 'up'),
        onMoveDown: () => onMoveItem(itemKey, 'down'),
      };
    },
    [itemKeys, onMoveItem, rowMoveEnabled],
  );

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

  const listBody =
    itemKeys.length === 0 ? (
      <Text size="sm" c="dimmed" p="xs">
        {emptyMessage}
      </Text>
    ) : dragEnabled ? (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={[...itemKeys]} strategy={verticalListSortingStrategy}>
          <Stack gap={6}>
            {itemKeys.map((itemKey) => (
              <SortableSelectedItem key={itemKey} itemKey={itemKey} dragDisabled={false}>
                {(dragHandle) =>
                  renderItem({
                    itemKey,
                    selected: selectedSet.has(itemKey),
                    onToggleSelect: () => onToggleSelect(itemKey),
                    onRemove: () => onRemove(itemKey),
                    dragHandle,
                    rowMove: rowMoveFor(itemKey),
                  })
                }
              </SortableSelectedItem>
            ))}
          </Stack>
        </SortableContext>
      </DndContext>
    ) : (
      <Stack gap={6}>
        {itemKeys.map((itemKey) => (
          <Fragment key={itemKey}>
            {renderItem({
              itemKey,
              selected: selectedSet.has(itemKey),
              onToggleSelect: () => onToggleSelect(itemKey),
              onRemove: () => onRemove(itemKey),
              dragHandle: null,
              rowMove: rowMoveFor(itemKey),
            })}
          </Fragment>
        ))}
      </Stack>
    );

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

      {toolbar ? <Group>{toolbar}</Group> : null}

      <ScrollArea.Autosize mah={maxHeight} type="auto" offsetScrollbars>
        {listBody}
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
      ) : hint && (onReorder != null || onMoveItem != null) ? (
        <Group gap="xs">{hint}</Group>
      ) : null}
    </Stack>
  );
}
