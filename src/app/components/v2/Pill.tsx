import type { CSSProperties, ReactNode } from 'react';
import classes from './Pill.module.css';

export type PillTone = 'neutral' | 'accent' | 'accentSolid' | 'success' | 'warning' | 'semantic';

export interface PillProps {
  tone?: PillTone;
  /** Required when `tone="semantic"` — saturated fill for band/mode tags. */
  color?: string;
  /** Optional text color for `tone="semantic"` (defaults to white). */
  textColor?: string;
  children: ReactNode;
  className?: string;
}

const TONE_CLASS: Record<Exclude<PillTone, 'semantic'>, string> = {
  neutral: classes.neutral,
  accent: classes.accent,
  accentSolid: classes.accentSolid,
  success: classes.success,
  warning: classes.warning,
};

/**
 * Compact label pill. Use named tones for chrome; `tone="semantic"` for
 * one-off band/mode colors (domain BandPill/ModePill re-skin is out of scope).
 */
export default function Pill({
  tone = 'neutral',
  color,
  textColor = '#fff',
  children,
  className,
}: PillProps) {
  const toneClass = tone === 'semantic' ? classes.semantic : TONE_CLASS[tone];
  const style: CSSProperties | undefined =
    tone === 'semantic' && color
      ? { backgroundColor: color, color: textColor, borderColor: color }
      : undefined;

  return (
    <span className={[classes.root, toneClass, className].filter(Boolean).join(' ')} style={style}>
      {children}
    </span>
  );
}
