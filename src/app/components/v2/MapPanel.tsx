import { IconAdjustments } from '@tabler/icons-react';
import type { CSSProperties, ReactNode } from 'react';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import classes from './MapPanel.module.css';

export interface MapPanelProps {
  title?: string;
  /** Placeholder height in px (design system default 200). */
  height?: number;
  /** Overlay caption inside the hatch (default `[ map ]`). */
  caption?: ReactNode;
  /** Optional legend row under the map. */
  legend?: ReactNode;
  /** When true, gear control uses accent border (settings popover open). */
  gearActive?: boolean;
  onSettingsClick?: () => void;
  className?: string;
  /** Accessible label for the placeholder map region. */
  mapLabel?: string;
}

/**
 * Map chrome with a diagonal-hatch placeholder. Real CodeplugMap wiring is #925.
 * Matches the design-system MapPanel structure (title + gear above hatch).
 */
export default function MapPanel({
  title,
  height = 200,
  caption = '[ map ]',
  legend,
  gearActive = false,
  onSettingsClick,
  className,
  mapLabel = 'Map placeholder',
}: MapPanelProps) {
  const showHeader = Boolean(title || onSettingsClick || gearActive);
  const mapStyle: CSSProperties = { height };

  return (
    <div className={[classes.root, className].filter(Boolean).join(' ')}>
      {showHeader ? (
        <div className={classes.header}>
          {title ? <div className={classes.title}>{title}</div> : null}
          {onSettingsClick || gearActive ? (
            <button
              type="button"
              className={[classes.gear, gearActive ? classes.gearActive : '']
                .filter(Boolean)
                .join(' ')}
              aria-label="Map settings"
              aria-pressed={gearActive || undefined}
              onClick={onSettingsClick}
            >
              <IconAdjustments size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
            </button>
          ) : null}
        </div>
      ) : null}
      <div className={classes.map} role="img" aria-label={mapLabel} style={mapStyle}>
        {caption ? <span className={classes.caption}>{caption}</span> : null}
      </div>
      {legend ? <div className={classes.legend}>{legend}</div> : null}
    </div>
  );
}
