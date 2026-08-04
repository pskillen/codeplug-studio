import { IconCircleCheck, IconInfoCircle } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import classes from './StatusBanner.module.css';

export type StatusBannerTone = 'success' | 'warning' | 'info';

export interface StatusBannerProps {
  tone?: StatusBannerTone;
  children: ReactNode;
  className?: string;
}

const TONE_ROOT: Record<StatusBannerTone, string> = {
  success: classes.success,
  warning: classes.warning,
  info: classes.info,
};

const TONE_ICON: Record<StatusBannerTone, string> = {
  success: classes.iconSuccess,
  warning: classes.iconWarning,
  info: classes.iconInfo,
};

const TONE_MESSAGE: Record<StatusBannerTone, string> = {
  success: classes.messageSuccess,
  warning: classes.messageWarning,
  info: classes.messageInfo,
};

/**
 * Inline feedback banner for integrity summaries and contextual notices.
 */
export default function StatusBanner({ tone = 'info', children, className }: StatusBannerProps) {
  const Icon = tone === 'success' ? IconCircleCheck : IconInfoCircle;

  return (
    <div className={[classes.root, TONE_ROOT[tone], className].filter(Boolean).join(' ')}>
      <Icon size={16} stroke={1.75} className={TONE_ICON[tone]} aria-hidden />
      <span className={[classes.message, TONE_MESSAGE[tone]].join(' ')}>{children}</span>
    </div>
  );
}
