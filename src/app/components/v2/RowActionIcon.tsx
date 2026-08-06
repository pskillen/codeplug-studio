import { ActionIcon } from '@mantine/core';
import type { MouseEvent, ReactNode } from 'react';
import { ICON_SIZE_ACTION } from '../../lib/iconSizes.ts';
import classes from './RowActionIcon.module.css';

export type RowActionIconTone = 'default' | 'destructive';

export interface RowActionIconProps {
  icon: ReactNode;
  onClick: () => void;
  label: string;
  tone?: RowActionIconTone;
  disabled?: boolean;
  className?: string;
}

/**
 * Small (26x26) icon-only row action button for DataTable / MembershipRow.
 * Stops propagation internally so it never triggers a parent row-activate handler.
 */
export default function RowActionIcon({
  icon,
  onClick,
  label,
  tone = 'default',
  disabled,
  className,
}: RowActionIconProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onClick();
  };

  return (
    <ActionIcon
      variant="subtle"
      size={ICON_SIZE_ACTION + 8}
      aria-label={label}
      disabled={disabled}
      onClick={handleClick}
      className={[classes.root, tone === 'destructive' ? classes.destructive : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      {icon}
    </ActionIcon>
  );
}
