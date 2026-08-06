import { CloseButton, UnstyledButton } from '@mantine/core';
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import { useState, type ReactNode } from 'react';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import classes from './DismissibleNotice.module.css';

export type DismissibleNoticeTone = 'warning' | 'info';

export interface DismissibleNoticeAction {
  label: string;
  onClick: () => void;
}

export interface DismissibleNoticeProps {
  tone?: DismissibleNoticeTone;
  children: ReactNode;
  action?: DismissibleNoticeAction;
  onDismiss?: () => void;
}

const TONE_ICON: Record<DismissibleNoticeTone, typeof IconAlertTriangle> = {
  warning: IconAlertTriangle,
  info: IconInfoCircle,
};

/**
 * Chrome-level inline dismissible notice — single-line, no re-show once
 * dismissed. Distinct from the page-level persistent `StatusBanner`. Adapts
 * `ui/SoftWarning`'s tone/dismiss shape as a new independent component
 * rather than editing that one.
 */
export default function DismissibleNotice({
  tone = 'warning',
  children,
  action,
  onDismiss,
}: DismissibleNoticeProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const Icon = TONE_ICON[tone];

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className={[classes.root, classes[tone]].join(' ')} data-tone={tone}>
      <Icon size={ICON_SIZE_NAV} stroke={ICON_STROKE} className={classes.icon} aria-hidden />
      <span className={classes.message}>{children}</span>
      {action ? (
        <UnstyledButton className={classes.action} onClick={action.onClick}>
          {action.label}
        </UnstyledButton>
      ) : null}
      <CloseButton
        aria-label="Dismiss"
        size="sm"
        className={classes.close}
        onClick={handleDismiss}
      />
    </div>
  );
}
