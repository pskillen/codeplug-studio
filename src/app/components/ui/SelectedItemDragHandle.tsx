import { IconGripVertical } from '@tabler/icons-react';
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { ICON_STROKE } from '../../lib/iconSizes.ts';

export interface SelectedItemDragHandleProps {
  setActivatorNodeRef: (element: HTMLElement | null) => void;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners | undefined;
  disabled?: boolean;
}

/**
 * Grip control for role-C membership rows. Pass `dragHandle` from
 * {@link SelectedItemList} `renderItem` when `onReorder` is enabled.
 */
export default function SelectedItemDragHandle({
  dragHandle,
  label = 'Drag to reorder',
}: {
  dragHandle?: SelectedItemDragHandleProps | null;
  label?: string;
}) {
  if (!dragHandle) {
    return (
      <IconGripVertical
        size={14}
        stroke={ICON_STROKE}
        style={{ opacity: 0.35, flexShrink: 0 }}
        aria-hidden
      />
    );
  }

  return (
    <button
      type="button"
      ref={dragHandle.setActivatorNodeRef}
      {...dragHandle.attributes}
      {...dragHandle.listeners}
      disabled={dragHandle.disabled}
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: 0,
        padding: 2,
        border: 'none',
        background: 'transparent',
        color: 'inherit',
        cursor: dragHandle.disabled ? 'not-allowed' : 'grab',
        flexShrink: 0,
        touchAction: 'none',
        opacity: dragHandle.disabled ? 0.35 : 0.7,
      }}
    >
      <IconGripVertical size={14} stroke={ICON_STROKE} />
    </button>
  );
}
