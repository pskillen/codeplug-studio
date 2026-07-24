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
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button, Group, Text } from '@mantine/core';
import { useCallback, useEffect, type ReactNode } from 'react';
import { reorderKeysByDrag, reorderSelectedKeys } from '@core/domain/zoneOrder.ts';

export interface DataTableBulkReorderConfig<T> {
  /** Canonical export-order key list (full list, not filtered display). */
  orderedKeys: string[];
  /** Persist new order after drag or toolbar move. */
  onSetOrder: (orderedKeys: string[]) => void;
  /** Master disable (filter active, saving). */
  disabled?: boolean;
  /** When false, rows are not selectable or draggable. */
  isRowReorderable?: (row: T) => boolean;
  /** Enable drag handles (default true). */
  enableDrag?: boolean;
  /** Hint when reorder is disabled (default copy). */
  disabledHint?: ReactNode;
}

interface DataTableBulkReorderToolbarProps {
  selectedKeys: readonly string[];
  orderedKeys: readonly string[];
  disabled?: boolean;
  onSetOrder: (orderedKeys: string[]) => void;
  disabledHint?: ReactNode;
}

export function DataTableBulkReorderToolbar({
  selectedKeys,
  orderedKeys,
  disabled = false,
  onSetOrder,
  disabledHint,
}: DataTableBulkReorderToolbarProps) {
  const selectedSet = new Set(selectedKeys.filter((key) => orderedKeys.includes(key)));

  const moveSelected = useCallback(
    (direction: 'up' | 'down') => {
      if (disabled || selectedSet.size === 0) return;
      onSetOrder(reorderSelectedKeys([...orderedKeys], selectedSet, direction));
    },
    [disabled, onSetOrder, orderedKeys, selectedSet],
  );

  const canMoveUp = [...selectedSet].some((id) => orderedKeys.indexOf(id) > 0);
  const canMoveDown = [...selectedSet].some((id) => {
    const index = orderedKeys.indexOf(id);
    return index >= 0 && index < orderedKeys.length - 1;
  });

  useEffect(() => {
    if (disabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || selectedSet.size === 0) return;
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveSelected('up');
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveSelected('down');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disabled, moveSelected, selectedSet.size]);

  const defaultHint = disabled ? (
    <Text size="xs" c="dimmed">
      Clear search to reorder
    </Text>
  ) : (
    <Text size="xs" c="dimmed">
      Drag handles or Move buttons reorder selection · Alt+↑/↓ moves selection
    </Text>
  );

  return (
    <Group gap="xs" align="center" wrap="wrap">
      <Button
        type="button"
        variant="default"
        size="compact-sm"
        onClick={() => moveSelected('up')}
        disabled={disabled || selectedSet.size === 0 || !canMoveUp}
      >
        Move up
      </Button>
      <Button
        type="button"
        variant="default"
        size="compact-sm"
        onClick={() => moveSelected('down')}
        disabled={disabled || selectedSet.size === 0 || !canMoveDown}
      >
        Move down
      </Button>
      {disabledHint !== undefined ? disabledHint : defaultHint}
    </Group>
  );
}

interface DataTableBulkReorderBodyProps {
  sortableKeys: string[];
  orderedKeys: readonly string[];
  selectedKeys: readonly string[];
  disabled?: boolean;
  onSetOrder: (orderedKeys: string[]) => void;
  children: ReactNode;
}

/** DndContext wrapper — must sit outside `<tbody>` (HiddenText renders a div). */
export function DataTableBulkReorderProvider({
  sortableKeys,
  orderedKeys,
  selectedKeys,
  disabled = false,
  onSetOrder,
  children,
}: DataTableBulkReorderBodyProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (disabled) return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const selected = new Set(selectedKeys);
      onSetOrder(
        reorderKeysByDrag(
          orderedKeys,
          String(active.id),
          String(over.id),
          selected.size > 0 ? selected : undefined,
        ),
      );
    },
    [disabled, onSetOrder, orderedKeys, selectedKeys],
  );

  if (disabled || sortableKeys.length === 0) {
    return <>{children}</>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      {children}
    </DndContext>
  );
}

/** SortableContext for tbody rows — no extra DOM nodes. */
export function DataTableBulkReorderSortable({
  sortableKeys,
  disabled = false,
  children,
}: {
  sortableKeys: string[];
  disabled?: boolean;
  children: ReactNode;
}) {
  if (disabled || sortableKeys.length === 0) {
    return <>{children}</>;
  }

  return (
    <SortableContext items={sortableKeys} strategy={verticalListSortingStrategy}>
      {children}
    </SortableContext>
  );
}

/** @deprecated Use {@link DataTableBulkReorderProvider} + {@link DataTableBulkReorderSortable}. */
export function DataTableBulkReorderBody(props: DataTableBulkReorderBodyProps) {
  return (
    <DataTableBulkReorderProvider {...props}>
      <DataTableBulkReorderSortable sortableKeys={props.sortableKeys} disabled={props.disabled}>
        {props.children}
      </DataTableBulkReorderSortable>
    </DataTableBulkReorderProvider>
  );
}
