import { IconX } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import SelectedItemDragHandle, {
  type SelectedItemDragHandleProps,
} from '../ui/SelectedItemDragHandle.tsx';
import { ICON_SIZE_ACTION } from '../../lib/iconSizes.ts';
import Checkbox from './Checkbox.tsx';
import classes from './MembershipRow.module.css';
import RowActionIcon from './RowActionIcon.tsx';

export interface MembershipRowProps {
  label: ReactNode;
  subtitle?: ReactNode;
  /** Pills/badges shown inline next to the label. */
  pills?: ReactNode;
  /** Reserve the leading drag-handle slot. Default `true`. */
  dragHandle?: boolean;
  /** Live dnd-kit wiring from `SelectedItemList`'s `renderItem`. Static (non-interactive) handle when omitted. */
  dragHandleProps?: SelectedItemDragHandleProps | null;
  checked?: boolean;
  /** Presence shows the row checkbox. */
  onCheck?: () => void;
  /** Edge-property slot — e.g. an `includeInScanList` or `timeSlotOverride` segmented control. */
  trailing?: ReactNode;
  /** Presence shows the trailing remove action. */
  onRemove?: () => void;
  className?: string;
}

/**
 * Member ("C" role) row for the Membership family — supersedes `ShuttleRow`
 * for the new members-first list + full-screen add takeover pattern. Designed
 * as a card-style row, not a render prop into an existing list shell.
 */
export default function MembershipRow({
  label,
  subtitle,
  pills,
  dragHandle = true,
  dragHandleProps = null,
  checked,
  onCheck,
  trailing,
  onRemove,
  className,
}: MembershipRowProps) {
  return (
    <div className={[classes.root, className].filter(Boolean).join(' ')}>
      {dragHandle ? <SelectedItemDragHandle dragHandle={dragHandleProps} /> : null}
      {onCheck ? (
        <Checkbox
          checked={checked}
          onCheckedChange={onCheck}
          aria-label={typeof label === 'string' ? `Select ${label}` : 'Select item'}
        />
      ) : null}
      <div className={classes.copy}>
        <div className={classes.labelRow}>
          <span className={classes.label}>{label}</span>
          {pills ? <span className={classes.pills}>{pills}</span> : null}
        </div>
        {subtitle ? <div className={classes.subtitle}>{subtitle}</div> : null}
      </div>
      {trailing ? <div className={classes.trailing}>{trailing}</div> : null}
      {onRemove ? (
        <RowActionIcon
          icon={<IconX size={ICON_SIZE_ACTION} />}
          onClick={onRemove}
          label={typeof label === 'string' ? `Remove ${label}` : 'Remove item'}
        />
      ) : null}
    </div>
  );
}
