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
 * Grip button for role-C membership rows. Pass `dragHandle` from
 * {@link SelectedItemList} `renderItem` when `onReorder` is enabled.
 *
 * dnd-kit activator ref + listeners are intentional render props — not React
 * state refs read during render.
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

  const { setActivatorNodeRef, attributes, listeners, disabled } = dragHandle;

  return (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      disabled={disabled}
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
        cursor: disabled ? 'not-allowed' : 'grab',
        flexShrink: 0,
        touchAction: 'none',
        opacity: disabled ? 0.35 : 0.7,
      }}
    >
      <IconGripVertical size={14} stroke={ICON_STROKE} />
    </button>
  );
}
