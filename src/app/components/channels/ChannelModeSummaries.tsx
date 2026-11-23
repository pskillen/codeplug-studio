import type { Channel } from '@core/models/library.ts';
import { channelModeSummaries, type ModeSummaryLookup } from '../../lib/channelModeSummary.ts';
import ModeSummaryChip from './ModeSummaryChip.tsx';
import classes from './ChannelModeSummaries.module.css';

export interface ChannelModeSummariesProps {
  channel: Pick<Channel, 'modeProfiles' | 'primaryMode'>;
  lookup: ModeSummaryLookup;
  layout: 'wrap' | 'line';
  maxVisible?: number;
  size?: 'xs' | 'sm';
}

export default function ChannelModeSummaries({
  channel,
  lookup,
  layout,
  maxVisible,
  size = 'sm',
}: ChannelModeSummariesProps) {
  const summaries = channelModeSummaries(channel, lookup);
  if (summaries.length === 0) return null;

  const visible =
    layout === 'line' && maxVisible != null && summaries.length > maxVisible
      ? summaries.slice(0, maxVisible)
      : summaries;
  const hidden =
    layout === 'line' && maxVisible != null && summaries.length > maxVisible
      ? summaries.slice(maxVisible)
      : [];

  const layoutClass = layout === 'line' ? classes.line : classes.wrap;

  return (
    <div className={layoutClass}>
      {visible.map((summary) => (
        <ModeSummaryChip key={summary.mode} summary={summary} size={size} />
      ))}
      {hidden.length > 0 ? (
        <span
          className={`${classes.overflowChip}${size === 'xs' ? ` ${classes.sizeXs}` : ''}`}
          title={hidden
            .map((entry) => (entry.detail ? `${entry.label} ${entry.detail}` : entry.label))
            .join(' · ')}
        >
          +{hidden.length}
        </span>
      ) : null}
    </div>
  );
}
