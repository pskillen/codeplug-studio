import type { CSSProperties, ReactNode } from 'react';
import { DSV2_TOKENS } from '../../theme-v2.ts';
import classes from './Pill.module.css';

export type PillTone = 'neutral' | 'accent' | 'accentSolid' | 'success' | 'warning' | 'semantic';

export interface PillProps {
  tone?: PillTone;
  /** Required when `tone="semantic"` — saturated fill for band/mode tags. */
  color?: string;
  /**
   * Text color for `tone="semantic"`. Defaults to design-system `--pill-text-dark`
   * (yellow/light semantic fills); pass `--dsv2-pill-text-light` / `#fff` for dark fills.
   */
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
  textColor = DSV2_TOKENS.colors.pillTextDark,
  children,
  className,
}: PillProps) {
  const toneClass = tone === 'semantic' ? classes.semantic : TONE_CLASS[tone];
  const style: CSSProperties | undefined =
    tone === 'semantic'
      ? {
          backgroundColor: color ?? DSV2_TOKENS.colors.modeFm,
          color: textColor,
        }
      : undefined;

  return (
    <span className={[classes.root, toneClass, className].filter(Boolean).join(' ')} style={style}>
      {children}
    </span>
  );
}
