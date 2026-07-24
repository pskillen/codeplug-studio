import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Table } from '@mantine/core';
import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import type { SelectedItemDragHandleProps } from '../../components/ui/SelectedItemDragHandle.tsx';

const RowBulkReorderDragHandleContext = createContext<SelectedItemDragHandleProps | null>(null);

/** Drag-handle props for the current {@link DataTableSortableRow} (reorder column cells). */
export function useDataTableBulkReorderDragHandle(): SelectedItemDragHandleProps | null {
  return useContext(RowBulkReorderDragHandleContext);
}

export interface DataTableSortableRowProps {
  itemKey: string;
  dragDisabled: boolean;
  className?: string;
  onClick?: () => void;
  style?: CSSProperties;
  'data-testid'?: string;
  'data-selected'?: boolean;
  children: ReactNode;
}

export default function DataTableSortableRow({
  itemKey,
  dragDisabled,
  className,
  onClick,
  style,
  children,
  'data-testid': dataTestId = 'datatable-tbody-row',
  'data-selected': dataSelected,
}: DataTableSortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: itemKey, disabled: dragDisabled });

  const rowStyle: CSSProperties = {
    ...style,
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
    <RowBulkReorderDragHandleContext.Provider value={dragHandle}>
      <Table.Tr
        ref={setNodeRef}
        data-testid={dataTestId}
        data-selected={dataSelected || undefined}
        data-dragging={isDragging || undefined}
        className={className}
        onClick={onClick}
        style={rowStyle}
      >
        {children}
      </Table.Tr>
    </RowBulkReorderDragHandleContext.Provider>
  );
}
