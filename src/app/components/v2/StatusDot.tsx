import type { ReactNode } from 'react';
import classes from './StatusDot.module.css';

export type StatusDotTone = 'success' | 'warning' | 'destructive' | 'neutral' | 'accent';

export interface StatusDotProps {
  label: ReactNode;
  tone?: StatusDotTone;
  className?: string;
}

const TONE_CLASS: Record<StatusDotTone, string> = {
  success: classes.success,
  warning: classes.warning,
  destructive: classes.destructive,
  neutral: classes.neutral,
  accent: classes.accent,
};

/**
 * Small filled-dot status indicator with a label — write status, sync state,
 * per-row status in WriteVerifyReport.
 */
export default function StatusDot({ label, tone = 'success', className }: StatusDotProps) {
  return (
    <span className={[classes.root, className].filter(Boolean).join(' ')}>
      <span className={[classes.dot, TONE_CLASS[tone]].join(' ')} aria-hidden />
      <span className={classes.label}>{label}</span>
    </span>
  );
}
