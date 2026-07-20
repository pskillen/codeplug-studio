import { ActionIcon, Group } from '@mantine/core';
import { IconArrowDown, IconArrowUp } from '@tabler/icons-react';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';

/** Per-row move controls from {@link SelectedItemList} `renderItem` when `onMoveItem` is set. */
export interface SelectedItemRowMoveProps {
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

/**
 * Up/down arrows for a single role-C membership row. Pass `rowMove` from
 * {@link SelectedItemList} `renderItem` when `onMoveItem` is enabled.
 */
export default function SelectedItemRowMoveButtons({
  rowMove,
  upLabel = 'Move up',
  downLabel = 'Move down',
}: {
  rowMove?: SelectedItemRowMoveProps | null;
  upLabel?: string;
  downLabel?: string;
}) {
  if (!rowMove) return null;

  return (
    <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
      <ActionIcon
        variant="subtle"
        size="sm"
        aria-label={upLabel}
        disabled={!rowMove.canMoveUp}
        onClick={(event) => {
          event.stopPropagation();
          rowMove.onMoveUp();
        }}
      >
        <IconArrowUp size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
      </ActionIcon>
      <ActionIcon
        variant="subtle"
        size="sm"
        aria-label={downLabel}
        disabled={!rowMove.canMoveDown}
        onClick={(event) => {
          event.stopPropagation();
          rowMove.onMoveDown();
        }}
      >
        <IconArrowDown size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
      </ActionIcon>
    </Group>
  );
}
