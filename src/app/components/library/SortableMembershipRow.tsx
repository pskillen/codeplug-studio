import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';
import MembershipRow, { type MembershipRowProps } from '../v2/MembershipRow.tsx';

export interface SortableMembershipRowProps extends Omit<MembershipRowProps, 'dragHandleProps'> {
  itemKey: string;
  disabled?: boolean;
}

/**
 * dnd-kit sortable wrapper for {@link MembershipRow} — same pattern as
 * `/styleguide/membership` and DataTable v2 bulk reorder.
 */
export default function SortableMembershipRow({
  itemKey,
  disabled = false,
  dragHandle = true,
  ...rowProps
}: SortableMembershipRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: itemKey, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.65 : undefined,
      }}
    >
      <MembershipRow
        {...rowProps}
        dragHandle={dragHandle}
        dragHandleProps={
          dragHandle && !disabled
            ? { setActivatorNodeRef, attributes, listeners, disabled: false }
            : null
        }
      />
    </div>
  );
}

export function MembershipRowList({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>;
}
