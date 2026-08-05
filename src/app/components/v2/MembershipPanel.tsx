import { IconArrowDown, IconArrowUp, IconSearch } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import Button from './Button.tsx';
import classes from './MembershipPanel.module.css';
import RowActionIcon from './RowActionIcon.tsx';

export interface MembershipPanelSearchConfig {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export interface MembershipPanelProps {
  title: ReactNode;
  description?: ReactNode;
  /** Presence (with `onAdd`) shows the "+ Add" button. */
  addLabel?: string;
  onAdd?: () => void;
  /** Find-in-list filter. Disables the Sort… affordance while active. */
  search?: MembershipPanelSearchConfig;
  /** Permanent "Sort…" affordance — a confirm-gated rewrite of the true order, distinct from any temporary browse sort. */
  sortLabel?: string;
  onSortClick?: () => void;
  selectedCount?: number;
  onBulkMoveUp?: () => void;
  onBulkMoveDown?: () => void;
  onBulkRemove?: () => void;
  onClearSelection?: () => void;
  isEmpty?: boolean;
  emptyMessage?: ReactNode;
  /** The `MembershipRow` list. */
  children?: ReactNode;
  className?: string;
}

/**
 * Member-panel shell for the Membership family: title/description + Add,
 * find-in-list filter, permanent Sort… affordance, and a bulk toolbar shown
 * once rows are selected. Omitting `onAdd` yields the reorder-only,
 * no-pool variant (e.g. the build's zone member order screen).
 */
export function MembershipPanel({
  title,
  description,
  addLabel = 'Add',
  onAdd,
  search,
  sortLabel = 'Sort…',
  onSortClick,
  selectedCount = 0,
  onBulkMoveUp,
  onBulkMoveDown,
  onBulkRemove,
  onClearSelection,
  isEmpty,
  emptyMessage = 'No members yet.',
  children,
  className,
}: MembershipPanelProps) {
  const filtering = !!search && search.value.length > 0;
  const showBulkToolbar =
    selectedCount > 0 && (onBulkMoveUp || onBulkMoveDown || onBulkRemove || onClearSelection);

  return (
    <div className={[classes.root, className].filter(Boolean).join(' ')}>
      <div className={classes.header}>
        <div className={classes.headerCopy}>
          <div className={classes.title}>{title}</div>
          {description ? <div className={classes.description}>{description}</div> : null}
        </div>
        {onAdd ? (
          <Button variant="primary" size="sm" onClick={onAdd}>
            + {addLabel}
          </Button>
        ) : null}
      </div>

      {search || onSortClick ? (
        <div className={classes.toolbar}>
          {search ? (
            <div className={classes.search}>
              <IconSearch size={ICON_SIZE_NAV} stroke={ICON_STROKE} aria-hidden />
              <input
                type="text"
                value={search.value}
                onChange={(event) => search.onChange(event.currentTarget.value)}
                placeholder={search.placeholder ?? 'Find in list…'}
                aria-label="Find in list"
                className={classes.searchInput}
              />
            </div>
          ) : null}
          {onSortClick ? (
            filtering ? (
              <span className={classes.sortDisabled}>Reorder disabled while filtering</span>
            ) : (
              <button type="button" className={classes.sortButton} onClick={onSortClick}>
                {sortLabel}
              </button>
            )
          ) : null}
        </div>
      ) : null}

      {showBulkToolbar ? (
        <div className={classes.bulkToolbar}>
          <span className={classes.selectionCount}>{selectedCount} selected</span>
          {onBulkMoveUp ? (
            <RowActionIcon
              icon={<IconArrowUp size={14} stroke={ICON_STROKE} />}
              onClick={onBulkMoveUp}
              label="Move selected up"
            />
          ) : null}
          {onBulkMoveDown ? (
            <RowActionIcon
              icon={<IconArrowDown size={14} stroke={ICON_STROKE} />}
              onClick={onBulkMoveDown}
              label="Move selected down"
            />
          ) : null}
          {onBulkRemove ? (
            <Button variant="ghost" size="sm" onClick={onBulkRemove}>
              Remove selected
            </Button>
          ) : null}
          {onClearSelection ? (
            <button type="button" className={classes.clearSelection} onClick={onClearSelection}>
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      <div className={classes.body}>
        {isEmpty ? <div className={classes.empty}>{emptyMessage}</div> : children}
      </div>
    </div>
  );
}

/** Alias preferred by the design-system handoff. */
export const MembershipList = MembershipPanel;
