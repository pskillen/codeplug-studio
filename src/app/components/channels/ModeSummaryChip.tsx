import type { ChannelModeSummary } from '../../lib/channelModeSummary.ts';
import { modeColor } from '../../lib/channelModes.ts';
import { DSV2_TOKENS } from '../../theme-v2.ts';
import type { ChannelMode } from '../../lib/channelModes.ts';
import classes from './ModeSummaryChip.module.css';

export interface ModeSummaryChipProps {
  summary: ChannelModeSummary;
  size?: 'xs' | 'sm';
  /** When true, detail text wraps instead of ellipsising (wrap layout in cards and tables). */
  detailWrap?: boolean;
}

function modePillTextColor(mode: ChannelMode): string {
  return mode === 'dstar' || mode === 'dmr' || mode === 'tetra'
    ? DSV2_TOKENS.colors.pillTextLight
    : DSV2_TOKENS.colors.pillTextDark;
}

function chipTitle(summary: ChannelModeSummary): string {
  const base = summary.detail ? `${summary.label} ${summary.detail}` : summary.label;
  return summary.isMain ? `${base} · main mode` : base;
}

export default function ModeSummaryChip({
  summary,
  size = 'sm',
  detailWrap = false,
}: ModeSummaryChipProps) {
  const modeColour = modeColor(summary.mode);
  const sizeClass = size === 'xs' ? classes.sizeXs : classes.sizeSm;

  return (
    <span
      className={`${classes.chip} ${sizeClass}${summary.isMain ? ` ${classes.chipMain}` : ''}${detailWrap ? ` ${classes.chipDetailWrap}` : ''}`}
      style={summary.isMain ? { borderColor: modeColour } : undefined}
      title={chipTitle(summary)}
    >
      <span
        className={classes.label}
        style={{ backgroundColor: modeColour, color: modePillTextColor(summary.mode) }}
      >
        {summary.label}
      </span>
      {summary.detail ? (
        <span className={`${classes.detail}${detailWrap ? ` ${classes.detailWrap}` : ''}`}>
          {summary.detail}
        </span>
      ) : null}
      {summary.isMain ? <span className={classes.srOnly}> (main mode)</span> : null}
    </span>
  );
}
