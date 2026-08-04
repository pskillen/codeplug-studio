import { ActionIcon, Checkbox } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import SelectedItemDragHandle, {
  type SelectedItemDragHandleProps,
} from '../ui/SelectedItemDragHandle.tsx';
import SelectedItemList, { type SelectedItemListProps } from '../ui/SelectedItemList.tsx';
import AvailableItemPicker, { type AvailableItemPickerProps } from '../ui/AvailableItemPicker.tsx';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import Button from './Button.tsx';
import classes from './ShuttleList.module.css';

export interface ShuttleListPanelProps<
  TKey extends string = string,
> extends SelectedItemListProps<TKey> {
  className?: string;
}

/**
 * v2-styled panel around {@link SelectedItemList}. Drag/reorder behaviour is
 * delegated — this does not reimplement dnd-kit.
 */
export function ShuttleListPanel<TKey extends string>({
  className,
  ...listProps
}: ShuttleListPanelProps<TKey>) {
  return (
    <div className={[classes.panel, className].filter(Boolean).join(' ')}>
      <SelectedItemList {...listProps} />
    </div>
  );
}

/** Alias preferred by the design-system handoff. */
export const ShuttleList = ShuttleListPanel;

export interface ShuttlePoolPanelProps<
  TKey extends string = string,
> extends AvailableItemPickerProps<TKey> {
  className?: string;
}

/** v2-styled panel around {@link AvailableItemPicker} (pool / role B side). */
export function ShuttlePoolPanel<TKey extends string>({
  className,
  ...pickerProps
}: ShuttlePoolPanelProps<TKey>) {
  return (
    <div className={[classes.panel, className].filter(Boolean).join(' ')}>
      <AvailableItemPicker {...pickerProps} />
    </div>
  );
}

export interface ShuttleRowProps {
  label: ReactNode;
  subtitle?: ReactNode;
  selected: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
  /**
   * From `SelectedItemList` `renderItem` — pass through to `SelectedItemDragHandle`.
   * `null` when drag is disabled.
   */
  dragHandle: SelectedItemDragHandleProps | null;
  trailing?: ReactNode;
  className?: string;
}

/**
 * Member-side row chrome for use inside `SelectedItemList` `renderItem`.
 * Designed as the JSX returned from that render prop, not an independent list.
 */
export function ShuttleRow({
  label,
  subtitle,
  selected,
  onToggleSelect,
  onRemove,
  dragHandle,
  trailing,
  className,
}: ShuttleRowProps) {
  return (
    <div
      className={[classes.row, selected ? classes.rowSelected : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      <SelectedItemDragHandle dragHandle={dragHandle} />
      <Checkbox
        checked={selected}
        onChange={onToggleSelect}
        aria-label={typeof label === 'string' ? `Select ${label}` : 'Select item'}
        size="xs"
      />
      <div className={classes.rowCopy}>
        <div className={classes.rowLabel}>{label}</div>
        {subtitle ? <div className={classes.rowSubtitle}>{subtitle}</div> : null}
      </div>
      {trailing ? <div className={classes.rowTrailing}>{trailing}</div> : null}
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm"
        aria-label={typeof label === 'string' ? `Remove ${label}` : 'Remove item'}
        onClick={onRemove}
      >
        <IconX size={ICON_SIZE_NAV} stroke={ICON_STROKE} />
      </ActionIcon>
    </div>
  );
}

export interface ShuttlePoolHeaderProps {
  /** Design-system prop name. */
  label?: string;
  /** Alias used by earlier v2 API — same as `label`. */
  title?: ReactNode;
  count?: number;
  actions?: ReactNode;
  className?: string;
}

/** Section header for the available-items (pool) side — uppercase eyebrow. */
export function ShuttlePoolHeader({
  title,
  label,
  count,
  actions,
  className,
}: ShuttlePoolHeaderProps) {
  const text = label ?? title;
  return (
    <div className={[classes.poolHeader, className].filter(Boolean).join(' ')}>
      <div className={classes.poolTitle}>
        <span>{text}</span>
        {count != null ? <span className={classes.poolCount}>{count}</span> : null}
      </div>
      {actions ? <div className={classes.poolActions}>{actions}</div> : null}
    </div>
  );
}

export interface ShuttleAddBarProps {
  onAdd: () => void;
  disabled?: boolean;
  label?: string;
  /** Preferred count prop (design system). */
  count?: number;
  /** Alias for `count`. */
  selectedCount?: number;
  className?: string;
}

/** Footer action bar for adding the current pool selection into the member list. */
export function ShuttleAddBar({
  onAdd,
  disabled,
  label = 'Add selected',
  selectedCount,
  count,
  className,
}: ShuttleAddBarProps) {
  const n = count ?? selectedCount ?? 0;
  const text = `${label} (${n})`;

  return (
    <div className={[classes.addBar, className].filter(Boolean).join(' ')}>
      <Button variant="secondary" size="sm" onClick={onAdd} disabled={disabled ?? n === 0}>
        {text}
      </Button>
    </div>
  );
}
